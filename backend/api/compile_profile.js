export const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function send(res, status, bodyObj) {
	res.statusCode = status;
	for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(bodyObj));
}

function buildCompilePrompt(nlPrompt) {
	return [
		'Tu es un assistant qui compile des descriptions de profils de scoring en JSON structuré.',
		'Réponds STRICTEMENT en JSON au format:',
		'{',
		'  "name": "Nom court du profil (ex: E-commerce FR 50-200)",',
		'  "compiled": {',
		'    "country": "FR" ou null,',
		'    "sectors": ["ecommerce", "retail"] ou [],',
		'    "sizeMin": 50 ou null,',
		'    "sizeMax": 200 ou null,',
		'    "roles": ["CEO", "VP Marketing"] ou [],',
		'    "technologies": ["Shopify", "WooCommerce"] ou [],',
		'    "ratingMax": 4.5 ou null,',
		'    "exclusions": ["agence", "freelance"] ou [],',
		'    "weights": {',
		'      "country": 25,',
		'      "sector": 20,',
		'      "size": 15,',
		'      "role": 15,',
		'      "tech": 10,',
		'      "rating": 10,',
		'      "exclusion": -20',
		'    },',
		'    "notes": "Résumé en 1 phrase"',
		'  },',
		'  "summary": "Résumé optionnel"',
		'}',
		'Contrainte: pas de prose hors JSON. Extrais uniquement les critères mentionnés explicitement.',
		'',
		'Description:',
		nlPrompt
	].join('\n');
}

function parseStubProfile(nlPrompt) {
	const lower = nlPrompt.toLowerCase();
	const compiled = {
		country: null,
		sectors: [],
		sizeMin: null,
		sizeMax: null,
		roles: [],
		technologies: [],
		ratingMax: null,
		exclusions: [],
		weights: {
			country: 25,
			sector: 20,
			size: 15,
			role: 15,
			tech: 10,
			rating: 10,
			exclusion: -20
		},
		notes: 'Profil compilé (mode stub - configurez LLM_PROVIDER_URL pour une meilleure extraction)'
	};
	
	// Country detection
	if (lower.includes('france') || lower.includes(' fr ') || lower.includes('.fr')) compiled.country = 'FR';
	if (lower.includes('allemagne') || lower.includes('germany') || lower.includes(' de ') || lower.includes('.de')) compiled.country = 'DE';
	if (lower.includes('espagne') || lower.includes('spain') || lower.includes(' es ') || lower.includes('.es')) compiled.country = 'ES';
	
	// Sectors
	if (lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('e commerce')) compiled.sectors.push('ecommerce');
	if (lower.includes('retail')) compiled.sectors.push('retail');
	if (lower.includes('saas')) compiled.sectors.push('saas');
	if (lower.includes('tech')) compiled.sectors.push('tech');
	
	// Technologies
	if (lower.includes('shopify')) compiled.technologies.push('Shopify');
	if (lower.includes('woocommerce') || lower.includes('woo commerce')) compiled.technologies.push('WooCommerce');
	if (lower.includes('magento')) compiled.technologies.push('Magento');
	
	// Size range
	const sizeMatch = nlPrompt.match(/(\d+)\s*[-–]\s*(\d+)/);
	if (sizeMatch) {
		compiled.sizeMin = Number(sizeMatch[1]);
		compiled.sizeMax = Number(sizeMatch[2]);
	} else {
		const minMatch = nlPrompt.match(/min[^\d]*(\d+)|(\d+)\s*\+/i);
		if (minMatch) compiled.sizeMin = Number(minMatch[1] || minMatch[2]);
	}
	
	// Rating
	const ratingMatch = nlPrompt.match(/note[^\d]*(\d+[.,]\d+)|rating[^\d]*(\d+[.,]\d+)|(\d+[.,]\d+)\s*★/i);
	if (ratingMatch) {
		const val = ratingMatch[1] || ratingMatch[2] || ratingMatch[3];
		compiled.ratingMax = Number(val.replace(',', '.'));
	}
	
	// Exclusions
	if (lower.includes('agence') || lower.includes('agency')) compiled.exclusions.push('agence');
	if (lower.includes('freelance')) compiled.exclusions.push('freelance');
	if (lower.includes('consultant')) compiled.exclusions.push('consultant');
	
	// Generate name
	let name = 'Profil';
	if (compiled.country) name += ` ${compiled.country}`;
	if (compiled.sectors.length) name += ` ${compiled.sectors[0]}`;
	if (compiled.sizeMin && compiled.sizeMax) name += ` ${compiled.sizeMin}-${compiled.sizeMax}`;
	
	return {
		name: name.trim() || 'Profil généré',
		compiled,
		summary: 'Profil compilé en mode stub'
	};
}

async function callLLM(prompt, nlPrompt) {
	const url = process.env.LLM_PROVIDER_URL;
	const key = process.env.LLM_API_KEY;
	const model = process.env.LLM_MODEL || 'gpt-4o-mini';
	
	// If no LLM configured, use stub parser
	if (!url || !key) {
		console.log('[PIQ/api] Using stub parser (no LLM config)');
		return JSON.stringify(parseStubProfile(nlPrompt));
	}
	
	try {
		const resp = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${key}`
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: 'You output STRICT JSON only. No markdown, no code blocks.' },
					{ role: 'user', content: prompt }
				],
				temperature: 0.2
			})
		});
		
		if (!resp.ok) {
			const errorText = await resp.text().catch(() => '');
			console.error('[PIQ/api] LLM error:', resp.status, errorText);
			// Fallback to stub on auth error
			if (resp.status === 401 || resp.status === 403) {
				console.log('[PIQ/api] LLM auth failed, using stub parser');
				return JSON.stringify(parseStubProfile(nlPrompt));
			}
			throw new Error(`LLM HTTP ${resp.status}: ${errorText.slice(0, 200)}`);
		}
		
		const data = await resp.json();
		return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? JSON.stringify(data);
	} catch (err) {
		// On network/parse errors, fallback to stub
		if (err.message.includes('401') || err.message.includes('403')) {
			console.log('[PIQ/api] LLM auth error, using stub parser');
			return JSON.stringify(parseStubProfile(nlPrompt));
		}
		throw err;
	}
}

function normalizeCompiled(raw) {
	let obj;
	try {
		obj = JSON.parse(raw);
	} catch {
		const m = raw.match(/\{[\s\S]*\}/);
		if (!m) throw new Error('Invalid LLM output');
		obj = JSON.parse(m[0]);
	}
	const name = String(obj?.name || 'Profil sans nom').slice(0, 100);
	const compiled = obj?.compiled || {};
	
	// Ensure weights exist
	if (!compiled.weights) {
		compiled.weights = {
			country: 25,
			sector: 20,
			size: 15,
			role: 15,
			tech: 10,
			rating: 10,
			exclusion: -20
		};
	}
	
	// Normalize arrays
	if (!Array.isArray(compiled.sectors)) compiled.sectors = [];
	if (!Array.isArray(compiled.roles)) compiled.roles = [];
	if (!Array.isArray(compiled.technologies)) compiled.technologies = [];
	if (!Array.isArray(compiled.exclusions)) compiled.exclusions = [];
	
	// Normalize numbers
	if (compiled.sizeMin != null) compiled.sizeMin = Number(compiled.sizeMin);
	if (compiled.sizeMax != null) compiled.sizeMax = Number(compiled.sizeMax);
	if (compiled.ratingMax != null) compiled.ratingMax = Number(compiled.ratingMax);
	
	// Ensure notes
	if (!compiled.notes) compiled.notes = 'Profil compilé';
	
	return {
		name,
		compiled,
		summary: String(obj?.summary || '').slice(0, 200)
	};
}

export default async function handler(req, res) {
	// CORS preflight
	if (req.method === 'OPTIONS') {
		for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
		res.statusCode = 204;
		return res.end();
	}
	if (req.method !== 'POST') {
		return send(res, 405, { error: 'Method Not Allowed' });
	}
	try {
		console.log('[PIQ/api] compile_profile hit', new Date().toISOString());
		const chunks = [];
		for await (const c of req) chunks.push(c);
		const bodyStr = Buffer.concat(chunks).toString('utf-8');
		let payload;
		try {
			payload = bodyStr ? JSON.parse(bodyStr) : {};
		} catch (e) {
			return send(res, 400, { error: 'Invalid JSON', detail: String(e?.message || e) });
		}
		const { nl_prompt } = payload;
		if (!nl_prompt || typeof nl_prompt !== 'string') {
			return send(res, 400, { error: 'nl_prompt required (string)' });
		}
		const prompt = buildCompilePrompt(nl_prompt);
		try {
			const raw = await callLLM(prompt, nl_prompt);
			const out = normalizeCompiled(raw);
			return send(res, 200, out);
		} catch (err) {
			console.error('[PIQ/api] compile_profile error:', err);
			// Try stub as last resort
			try {
				const stub = parseStubProfile(nl_prompt);
				return send(res, 200, stub);
			} catch (stubErr) {
				return send(res, 502, { error: 'Compilation failed', detail: String(err?.message || err) });
			}
		}
	} catch (e) {
		return send(res, 500, { error: String(e?.message || e) });
	}
}

