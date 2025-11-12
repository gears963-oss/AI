// Minimal background entry and AI scoring bridge
chrome.runtime.onInstalled.addListener(() => {
	// no-op
});

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 12_000): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		const resp = await fetch(url, { ...options, signal: controller.signal });
		return resp;
	} finally {
		clearTimeout(timer);
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'PIQ_SCORE_AI') {
		(async () => {
			try {
				const stored = await chrome.storage.sync.get('PIQ_BACKEND_URL');
				const base = stored?.PIQ_BACKEND_URL as string | undefined;
				if (!base) throw new Error('BACKEND_URL manquant');
				console.log('[PIQ/bg] url=', base);
				const url = `${base.replace(/\/+$/, '')}/api/score`;
				// Retry with exponential backoff (max 2 retries), timeout 12s each
				const payload = {
					icp: message.icp ?? {},
					features: message.features ?? {},
					pageText: typeof message.pageText === 'string' ? message.pageText.slice(0, 30_000) : ''
				};
				const maxRetries = 1;
				let lastErr: any = null;
				for (let attempt = 0; attempt <= maxRetries; attempt++) {
					try {
						const resp = await fetchWithTimeout(
							url,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(payload)
							},
							12_000
						);
						if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
						const data = await resp.json();
						sendResponse({ ok: true, data });
						return;
					} catch (e: any) {
						console.error(`[PIQ/bg] fetch attempt ${attempt + 1} failed`, e);
						lastErr = e;
						if (attempt === maxRetries) break;
						await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
					}
				}
				throw new Error(lastErr?.message || 'Network error');
			} catch (e: any) {
				console.error('[PIQ/bg] error', e);
				sendResponse({ ok: false, error: e?.message || String(e) });
			}
		})();
		return true; // keep sendResponse alive
	}
});





