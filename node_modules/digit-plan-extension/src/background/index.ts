// Minimal background entry and AI scoring bridge
chrome.runtime.onInstalled.addListener(() => {
	// no-op
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'PIQ_SCORE_AI') {
		(async () => {
			try {
				const stored = await chrome.storage.sync.get('PIQ_BACKEND_URL');
				const base = stored?.PIQ_BACKEND_URL as string | undefined;
				if (!base) throw new Error('BACKEND_URL manquant');
				const url = `${base.replace(/\/+$/, '')}/api/score`;
				// Retry with exponential backoff (max 2 retries), timeout 12s each
				const payload = {
					icp: message.icp ?? {},
					features: message.features ?? {},
					pageText: typeof message.pageText === 'string' ? message.pageText.slice(0, 30_000) : ''
				};
				const maxRetries = 2;
				let attempt = 0;
				let lastErr: any;
				while (attempt <= maxRetries) {
					const controller = new AbortController();
					const timer = setTimeout(() => controller.abort(), 12_000);
					try {
						const resp = await fetch(url, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload),
							signal: controller.signal
						});
						clearTimeout(timer);
						if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
						const data = await resp.json();
						sendResponse({ ok: true, data });
						return;
					} catch (e: any) {
						clearTimeout(timer);
						lastErr = e;
						if (attempt === maxRetries) break;
						// Exponential backoff: 500ms, 1500ms
						const delay = 500 * Math.pow(3, attempt);
						await new Promise((r) => setTimeout(r, delay));
						attempt += 1;
					}
				}
				throw new Error(lastErr?.message || 'Network error');
			} catch (e: any) {
				sendResponse({ ok: false, error: e?.message || String(e) });
			}
		})();
		return true; // keep sendResponse alive
	}
});





