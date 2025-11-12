(() => {
	const BADGE_ID = 'prospectiq-badge';
	const CARD_ID = 'prospectiq-card';
	const STORAGE_KEY = 'ICP_ACTIVE';

	if (document.getElementById(BADGE_ID)) return;

	function createBadge() {
		const btn = document.createElement('button');
		btn.id = BADGE_ID;
		btn.textContent = 'Score ICP';
		btn.style.position = 'fixed';
		btn.style.bottom = '16px';
		btn.style.right = '16px';
		btn.style.zIndex = '2147483647';
		btn.style.background = '#22c55e';
		btn.style.color = '#0f172a';
		btn.style.fontWeight = '700';
		btn.style.border = '0';
		btn.style.borderRadius = '10px';
		btn.style.padding = '10px 12px';
		btn.style.boxShadow = '0 6px 20px rgba(2,6,23,0.35)';
		btn.style.cursor = 'pointer';
		btn.addEventListener('click', onScoreClick);
		document.body.appendChild(btn);
	}

	async function loadICP() {
		try {
			const data = await chrome.storage.sync.get(STORAGE_KEY);
			return data?.[STORAGE_KEY] || {};
		} catch {
			return {};
		}
	}

	function extractFeatures() {
		const host = location.hostname.toLowerCase();
		const html = document.documentElement.outerHTML || '';
		const text = document.body?.innerText || '';
		const features = {
			pays: undefined,
			secteur_text: undefined,
			taille_estimee: undefined,
			role_text: undefined,
			note_google: undefined,
			techno_detectees: [],
			texte: text.slice(0, 2000)
		};

		// TLD -> pays guess
		const tldMatch = host.match(/\.([a-z]{2})(?:$|:|\/)/);
		const tldMap = { fr: 'FR', de: 'DE', es: 'ES', it: 'IT', nl: 'NL', be: 'BE', ch: 'CH', uk: 'UK' };
		if (tldMatch) features.pays = tldMap[tldMatch[1]] || tldMatch[1].toUpperCase();

		// Google Maps detection
		const isMaps = /(^|\.)(google\.)[^/]+\/maps/.test(location.href) || /maps\.google\./.test(host);
		if (isMaps) {
			// rating via aria-label with stars or regex like "4,5 ★"
			let rating;
			const starEl = document.querySelector('[aria-label*="Étoiles"], [aria-label*="stars"], [aria-label*="rating"]');
			if (starEl) {
				const m = (starEl.getAttribute('aria-label') || '').match(/(\d+[.,]\d+)/);
				if (m) rating = Number(m[1].replace(',', '.'));
			}
			if (rating == null) {
				const m2 = html.match(/(\d+,[0-9])\s*★/);
				if (m2) rating = Number(m2[1].replace(',', '.'));
			}
			features.note_google = rating;
			return features;
		}

		// LinkedIn detection
		const isLinkedIn = host.includes('linkedin.com');
		if (isLinkedIn) {
			const role =
				(document.querySelector('h1')?.textContent || '') ||
				(document.querySelector('h2')?.textContent || '');
			features.role_text = role.trim() || undefined;

			const sectEl = document.querySelector('.inline-show-more-text');
			if (sectEl) features.secteur_text = sectEl.textContent?.trim();
			if (!features.secteur_text) {
				const metaSector = document.querySelector('meta[name="industry"], meta[property="og:description"]');
				if (metaSector) features.secteur_text = metaSector.getAttribute('content') || undefined;
			}

			const sizeText = (text.match(/(\d[\d\s]*)(?:\+)?\s*employ[eé]s?/i) || [])[0] || '';
			const range = sizeText.match(/(\d+)\s*[-–]\s*(\d+)/);
			if (range) {
				const min = Number(range[1]);
				const max = Number(range[2]);
				features.taille_estimee = Math.round((min + max) / 2);
			} else {
				const plus = sizeText.match(/(\d+)\s*\+\s*employ/i);
				if (plus) features.taille_estimee = Number(plus[1]);
			}
			return features;
		}

		// Generic site
		try {
			if (window.Shopify || /shopify/i.test(html) || Array.from(document.scripts).some((s) => /shopify/i.test(s.src))) {
				features.techno_detectees.push('Shopify');
			}
		} catch {}
		if (/woocommerce/i.test(html) || Array.from(document.scripts).some((s) => /woocommerce/i.test(s.src))) {
			features.techno_detectees.push('WooCommerce');
		}
		// sector heuristic: meta description or title
		const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
		features.secteur_text = metaDesc || document.title || undefined;

		return features;
	}

	function includesAny(hay, needles) {
		if (!hay) return false;
		const h = hay.toLowerCase();
		return needles.some((n) => h.includes(String(n).toLowerCase()));
	}

	function computeScore(icp, f) {
		let score = 0;
		const reasons = [];
		const sectors = icp.secteurs || [];
		const roles = icp.roles || [];
		const technoIncl = icp.techno_inclues || [];
		const excludes = icp.exclusions_mots || [];

		// +25 TLD/pays match if pays defined
		if (icp.pays && f.pays && String(icp.pays).toUpperCase() === String(f.pays).toUpperCase()) {
			score += 25;
			reasons.push('Pays/TLD correspondant (+25)');
		}

		// +20 sector keyword match in secteur_text or texte
		if (sectors.length && (includesAny(f.secteur_text, sectors) || includesAny(f.texte, sectors))) {
			score += 20;
			reasons.push('Secteur correspondant (+20)');
		}

		// +15 size in range if provided
		if ((icp.taille_min != null || icp.taille_max != null) && f.taille_estimee != null) {
			const min = icp.taille_min != null ? Number(icp.taille_min) : -Infinity;
			const max = icp.taille_max != null ? Number(icp.taille_max) : Infinity;
			if (f.taille_estimee >= min && f.taille_estimee <= max) {
				score += 15;
				reasons.push('Taille dans la plage (+15)');
			}
		}

		// +15 role match
		if (roles.length && includesAny(f.role_text, roles)) {
			score += 15;
			reasons.push('Rôle ciblé présent (+15)');
		}

		// +10 technologies intersect
		if ((f.techno_detectees || []).length && technoIncl.length) {
			const inter = f.techno_detectees.filter((t) =>
				technoIncl.map((x) => String(x).toLowerCase()).includes(String(t).toLowerCase())
			);
			if (inter.length) {
				score += 10;
				reasons.push('Technologie demandée détectée (+10)');
			}
		}

		// +10 google rating <= max
		if (icp.note_google_max != null && f.note_google != null) {
			if (Number(f.note_google) <= Number(icp.note_google_max)) {
				score += 10;
				reasons.push('Note Google sous le seuil (+10)');
			}
		}

		// -20 excluded keyword in texte
		if (excludes.length && includesAny(f.texte, excludes)) {
			score -= 20;
			reasons.push('Mot-clé d’exclusion détecté (-20)');
		}

		score = Math.max(0, Math.min(100, score));
		return { score, reasons };
	}

	function renderCard(result) {
		let card = document.getElementById(CARD_ID);
		if (!card) {
			card = document.createElement('div');
			card.id = CARD_ID;
			card.style.position = 'fixed';
			card.style.bottom = '64px';
			card.style.right = '16px';
			card.style.zIndex = '2147483647';
			card.style.background = '#0f172a';
			card.style.color = '#fff';
			card.style.padding = '12px 14px';
			card.style.borderRadius = '10px';
			card.style.boxShadow = '0 6px 24px rgba(2,6,23,0.4)';
			card.style.width = '320px';
			document.body.appendChild(card);
		}
		card.replaceChildren();
		const header = document.createElement('div');
		header.style.fontWeight = '700';
		header.style.marginBottom = '6px';
		header.textContent = `Score: ${Number(result.score)}/100`;
		card.appendChild(header);
		const list = document.createElement('ul');
		list.style.margin = '0';
		list.style.padding = '0';
		list.style.listStyle = 'none';
		list.style.fontSize = '12px';
		list.style.color = '#cbd5e1';
		for (const reason of (result.reasons || []).slice(0, 3)) {
			const item = document.createElement('li');
			item.textContent = `• ${reason}`;
			list.appendChild(item);
		}
		card.appendChild(list);

		// badge color by score
		const badge = document.getElementById(BADGE_ID);
		if (badge) {
			const s = Number(result.score) || 0;
			if (s >= 75) {
				badge.style.background = '#22c55e'; // green
				badge.style.color = '#0f172a';
			} else if (s >= 50) {
				badge.style.background = '#f59e0b'; // orange
				badge.style.color = '#0f172a';
			} else {
				badge.style.background = '#64748b'; // gray
				badge.style.color = '#ffffff';
			}
		}
	}

	async function onScoreClick() {
		console.log('[PIQ/content] scoring click', location.href);
		const icp = await loadICP();
		const f = extractFeatures();
		const pageText = (f.texte || (document.body?.innerText || '')).slice(0, 30_000);
		// First compute rules
		const rules = computeScore(icp, f);
		renderCard({
			score: rules.score,
			reasons: [...(rules.reasons || []).slice(0, 2), 'IA: pending…']
		});
		// Ask AI via background
		try {
			const aiResp = await new Promise((resolve) => {
				chrome.runtime.sendMessage(
					{ type: 'PIQ_SCORE_AI', icp, features: f, pageText },
					(resp) => resolve(resp)
				);
			});
			let finalScore = rules.score;
			let reasons = [...(rules.reasons || [])];
			if (aiResp && aiResp.ok && aiResp.data) {
				const ai = aiResp.data;
				const aiScore = Number(ai.score_ai) || 0;
				finalScore = Math.round(0.6 * rules.score + 0.4 * aiScore);
				const aiReason = Array.isArray(ai.reasons_ai) && ai.reasons_ai[0] ? ai.reasons_ai[0] : undefined;
				reasons = [...(rules.reasons || []).slice(0, 2)];
				if (aiReason) reasons.push(aiReason);
			} else {
				reasons = [...(rules.reasons || []).slice(0, 2), 'IA offline — score règles affiché'];
			}
			renderCard({ score: finalScore, reasons });
		} catch {
			const reasons = [...(rules.reasons || []).slice(0, 2), 'IA offline — score règles affiché'];
			renderCard({ score: rules.score, reasons });
		}
	}

	// Mount badge
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', createBadge, { once: true });
	} else {
		createBadge();
	}
})();


