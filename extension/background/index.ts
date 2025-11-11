import type { Features, ScoreResult, ICP } from '@shared/types';
import { toCsv } from '../shared/csv';

type QuotaState = {
	windowStartMs: number;
	used: number;
	limit: number;
	windowMs: number;
};

const quota: QuotaState = {
	windowStartMs: Date.now(),
	used: 0,
	limit: 60,
	windowMs: 60_000
};

type BufferedItem = { features: Partial<Features>; result: ScoreResult; ts: number };
let buffer: BufferedItem[] = [];

function withinQuota(): boolean {
	const now = Date.now();
	if (now - quota.windowStartMs > quota.windowMs) {
		quota.windowStartMs = now;
		quota.used = 0;
	}
	return quota.used < quota.limit;
}

async function callBackendScore(features: Partial<Features>, icp?: ICP): Promise<ScoreResult> {
	if (!withinQuota()) {
		return { score: 0, reasons: ['Rate limit exceeded. Try again later.'] };
	}
	quota.used += 1;
	const baseUrl = (await chrome.storage?.local?.get?.('backendUrl'))?.backendUrl || 'http://localhost:3001';
	const resp = await fetch(`${baseUrl}/score`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ features, icp })
	});
	if (!resp.ok) {
		return { score: 0, reasons: [`Backend error: ${resp.status}`] };
	}
	return resp.json();
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
	(async () => {
		switch (message?.type) {
			case 'SITE_DETECTED': {
				// no-op for now
				break;
			}
			case 'EXTRACTION': {
				const features: Partial<Features> = message.payload?.features || {};
				const stored = await chrome.storage.local.get('icp');
				const icp = stored?.icp as ICP | undefined;
				const result = await callBackendScore(features, icp);

				// Broadcast to content UI to render
				chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
					const tabId = tabs[0]?.id;
					if (tabId) {
						chrome.tabs.sendMessage(tabId, {
							type: 'WIDGET_UPDATE',
							payload: { prospect: { name: undefined }, result }
						});
					}
				});
				// Buffer locally (not persisted server-side)
				buffer.push({ features, result, ts: Date.now() });
				break;
			}
			case 'SCORE_ICP': {
				const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
				if (!tab?.id) break;
				// Ask content to re-extract minimal fields by reading DOM side already done. For simplicity reuse last known prospect if kept
				// In production, we would persist last extraction. Here we no-op and rely on immediate extraction flow to have run.
				chrome.tabs.sendMessage(tab.id, { type: 'WIDGET_UPDATE', payload: {} });
				break;
			}
			case 'GET_BUFFER': {
				chrome.runtime.sendMessage({ type: 'BUFFER_DATA', payload: buffer });
				break;
			}
			case 'CLEAR_BUFFER': {
				buffer = [];
				chrome.runtime.sendMessage({ type: 'BUFFER_CLEARED' });
				break;
			}
			case 'EXPORT_CSV': {
				const rows = buffer.map((b) => ({ features: b.features, result: b.result }));
				const csv = toCsv(rows as any);
				// Download locally
				const filename = `digit-plan-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
				const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
				chrome.downloads.download({ url: blobUrl, filename, saveAs: true });
				// Optional webhook post
				const stored = await chrome.storage.local.get('webhookUrl');
				const webhookUrl = stored?.webhookUrl as string | undefined;
				if (webhookUrl) {
					try {
						await fetch(webhookUrl, {
							method: 'POST',
							headers: { 'Content-Type': 'text/plain' },
							body: csv
						});
					} catch {
						// ignore webhook errors
					}
				}
				break;
			}
		}
	})();
});


