(() => {
	const FALLBACK_BACKEND = 'https://TON-PROJET.vercel.app';

	function sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function fetchWithTimeout(url, options = {}, ms = 12_000) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), ms);
		try {
			const response = await fetch(url, { ...options, signal: controller.signal });
			return response;
		} finally {
			clearTimeout(timer);
		}
	}

	chrome.runtime.onInstalled.addListener(() => {
		console.log('[PIQ/bg] installed');
	});

	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		if (msg?.type === 'PIQ_SCORE_AI') {
			(async () => {
				try {
					let storedUrl = '';
					try {
						const stored = await chrome.storage?.sync?.get?.('PIQ_BACKEND_URL');
						storedUrl = stored?.PIQ_BACKEND_URL || '';
					} catch (err) {
						console.error('[PIQ/bg] storage read error', err);
					}
					const base = (storedUrl || FALLBACK_BACKEND || '').trim().replace(/\/$/, '');
					if (!base) throw new Error('Configurer le Backend URL dans le popup');
					const endpoint = `${base}/api/score`;
					console.log('[PIQ/bg] calling', endpoint);

					const body = JSON.stringify({
						icp: msg.icp || {},
						features: msg.features || {},
						pageText: typeof msg.pageText === 'string' ? msg.pageText.slice(0, 30_000) : ''
					});

					let result = null;
					let lastErr = null;
					for (let attempt = 1; attempt <= 2; attempt++) {
						try {
							const resp = await fetchWithTimeout(
								endpoint,
								{
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body
								},
								12_000
							);
							const text = await resp.text();
							let json;
							try {
								json = JSON.parse(text);
							} catch {
								json = { raw: text };
							}
							if (!resp.ok) {
								throw new Error(`HTTP ${resp.status} ${text.slice(0, 200)}`);
							}
							result = json;
							break;
						} catch (err) {
							lastErr = err;
							console.error('[PIQ/bg] fetch err attempt', attempt, err);
							if (attempt < 2) await sleep(800);
						}
					}

					if (!result) throw lastErr || new Error('fetch failed');
					sendResponse({ ok: true, data: result });
				} catch (err) {
					console.error('[PIQ/bg] error:', err);
					sendResponse({ ok: false, error: String(err) });
				}
			})();
			return true;
		}
	});
})();


