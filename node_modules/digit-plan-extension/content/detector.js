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
			const data = await chrome.storage?.sync?.get?.(STORAGE_KEY);
			return data?.[STORAGE_KEY] || {};
		} catch (err) {
			console.error('[PIQ/content] storage read error', err);
			return {};
		}
	}

	function extractFeatures() {
		const host = location.hostname.toLowerCase();
		const html = document.documentElement?.outerHTML || '';
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

		const tldMatch = host.match(/\.([a-z]{2})(?:$|:|\/)/);
		const tldMap = { fr: 'FR', de: 'DE', es: 'ES', it: 'IT', nl: 'NL', be: 'BE', ch: 'CH', uk: 'UK' };
		if (tldMatch) features.pays = tldMap[tldMatch[1]] || tldMatch[1].toUpperCase();

		const isMaps = /(^|\.)(google\.)[^/]+\/maps/.test(location.href) || /maps\.google\./.test(host);
		if (isMaps) {
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

		try {
			if (window.Shopify || /shopify/i.test(html) || Array.from(document.scripts).some((s) => /shopify/i.test(s.src))) {
				features.techno_detectees.push('Shopify');
			}
		} catch {}
		if (/woocommerce/i.test(html) || Array.from(document.scripts).some((s) => /woocommerce/i.test(s.src))) {
			features.techno_detectees.push('WooCommerce');
		}
		const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
		features.secteur_text = metaDesc || document.title || undefined;

		return features;
	}

	function includesAny(hay, needles) {
		if (!hay) return false;
		const lowerHay = hay.toLowerCase();
		return needles.some((needle) => lowerHay.includes(String(needle).toLowerCase()));
	}

	function computeScore(icp, f, profile) {
		let score = 0;
		const reasons = [];
		
		// Use profile.compiled if available, otherwise fallback to ICP
		const compiled = profile?.compiled;
		const weights = compiled?.weights || {
			country: 25,
			sector: 20,
			size: 15,
			role: 15,
			tech: 10,
			rating: 10,
			exclusion: -20
		};
		
		const sectors = compiled?.sectors || icp.secteurs || [];
		const roles = compiled?.roles || icp.roles || [];
		const technos = compiled?.technologies || icp.techno_inclues || [];
		const excludes = compiled?.exclusions || icp.exclusions_mots || [];
		const targetCountry = compiled?.country || icp.pays;
		const sizeMin = compiled?.sizeMin ?? icp.taille_min;
		const sizeMax = compiled?.sizeMax ?? icp.taille_max;
		const ratingMax = compiled?.ratingMax ?? icp.note_google_max;

		if (targetCountry && f.pays && String(targetCountry).toUpperCase() === String(f.pays).toUpperCase()) {
			score += weights.country;
			reasons.push(`Pays/TLD correspondant (+${weights.country})`);
		}
		if (sectors.length && (includesAny(f.secteur_text, sectors) || includesAny(f.texte, sectors))) {
			score += weights.sector;
			reasons.push(`Secteur correspondant (+${weights.sector})`);
		}
		if ((sizeMin != null || sizeMax != null) && f.taille_estimee != null) {
			const min = sizeMin != null ? Number(sizeMin) : -Infinity;
			const max = sizeMax != null ? Number(sizeMax) : Infinity;
			if (f.taille_estimee >= min && f.taille_estimee <= max) {
				score += weights.size;
				reasons.push(`Taille dans la plage (+${weights.size})`);
			}
		}
		if (roles.length && includesAny(f.role_text, roles)) {
			score += weights.role;
			reasons.push(`Rôle ciblé présent (+${weights.role})`);
		}
		if ((f.techno_detectees || []).length && technos.length) {
			const inter = f.techno_detectees.filter((t) =>
				technos.map((x) => String(x).toLowerCase()).includes(String(t).toLowerCase())
			);
			if (inter.length) {
				score += weights.tech;
				reasons.push(`Technologie demandée détectée (+${weights.tech})`);
			}
		}
		if (ratingMax != null && f.note_google != null) {
			if (Number(f.note_google) <= Number(ratingMax)) {
				score += weights.rating;
				reasons.push(`Note Google sous le seuil (+${weights.rating})`);
			}
		}
		if (excludes.length && includesAny(f.texte, excludes)) {
			score += weights.exclusion;
			reasons.push(`Mot-clé d'exclusion détecté (${weights.exclusion})`);
		}
		score = Math.max(0, Math.min(100, score));
		return { score, reasons, profileName: profile?.name };
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
		
		if (result.profileName) {
			const profileLabel = document.createElement('div');
			profileLabel.style.fontSize = '10px';
			profileLabel.style.color = '#94a3b8';
			profileLabel.style.marginBottom = '4px';
			profileLabel.textContent = `Profil: ${result.profileName}`;
			card.appendChild(profileLabel);
		}
		
		const header = document.createElement('div');
		header.style.fontWeight = '700';
		header.style.marginBottom = '6px';
		header.textContent = `Score: ${Number(result.score) || 0}/100`;
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

		const badge = document.getElementById(BADGE_ID);
		if (badge) {
			const s = Number(result.score) || 0;
			if (s >= 75) {
				badge.style.background = '#22c55e';
				badge.style.color = '#0f172a';
			} else if (s >= 50) {
				badge.style.background = '#f59e0b';
				badge.style.color = '#0f172a';
			} else {
				badge.style.background = '#64748b';
				badge.style.color = '#ffffff';
			}
		}
	}

	async function onScoreClick() {
		console.log('[PIQ/content] scoring click', location.href);
		
		// Load active profile or fallback to ICP
		const { PIQ_ACTIVE_PROFILE_ID, PIQ_PROFILES } = await chrome.storage.sync.get(['PIQ_ACTIVE_PROFILE_ID', 'PIQ_PROFILES']).catch(() => ({}));
		let profile = null;
		if (PIQ_ACTIVE_PROFILE_ID && Array.isArray(PIQ_PROFILES)) {
			profile = PIQ_PROFILES.find(p => p.id === PIQ_ACTIVE_PROFILE_ID);
		}
		
		const icp = await loadICP();
		const features = extractFeatures();
		const pageText = (features.texte || document.body?.innerText || '').slice(0, 30_000);
		const ruleScore = computeScore(icp, features, profile);
		
		// Add profile note if available
		let displayReasons = [...(ruleScore.reasons || []).slice(0, 2)];
		if (profile?.compiled?.notes && displayReasons.length < 3) {
			displayReasons.push(profile.compiled.notes);
		}
		if (displayReasons.length < 3) {
			displayReasons.push('IA: pending…');
		}
		
		renderCard({
			score: ruleScore.score,
			reasons: displayReasons,
			profileName: ruleScore.profileName
		});

		try {
			const aiResp = await new Promise((resolve) => {
				chrome.runtime.sendMessage(
					{ type: 'PIQ_SCORE_AI', icp, features, pageText, profile: profile?.compiled },
					(resp) => resolve(resp)
				);
			});
			let finalScore = ruleScore.score;
			let reasons = [...(ruleScore.reasons || [])];
			if (aiResp && aiResp.ok && aiResp.data) {
				const aiScore = Number(aiResp.data.score_ai) || 0;
				finalScore = Math.round(0.6 * ruleScore.score + 0.4 * aiScore);
				const aiReason = Array.isArray(aiResp.data.reasons_ai) ? aiResp.data.reasons_ai[0] : undefined;
				reasons = [...(ruleScore.reasons || []).slice(0, 2)];
				if (aiReason) reasons.push(aiReason);
			} else {
				const errMsg = String(aiResp?.error || '');
				const fallbackReason = /configurer le backend url/i.test(errMsg) || /Aucune URL backend/i.test(errMsg)
					? 'Configurer le Backend URL dans le popup.'
					: 'IA offline — score règles affiché';
				reasons = [...(ruleScore.reasons || []).slice(0, 2), fallbackReason];
			}
			renderCard({ score: finalScore, reasons, profileName: ruleScore.profileName });
		} catch (err) {
			console.error('[PIQ/content] AI error', err);
			const reasons = [...(ruleScore.reasons || []).slice(0, 2), 'IA offline — score règles affiché'];
			renderCard({ score: ruleScore.score, reasons, profileName: ruleScore.profileName });
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', createBadge, { once: true });
	} else {
		createBadge();
	}
})();


