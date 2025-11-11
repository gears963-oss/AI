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

function buildPrompt(icp, features, pageText) {
	return [
		'Tu es un assistant sales.',
		'Réponds STRICTEMENT en JSON au format:',
		'{',
		'  "score_ai": number (0..100),',
		'  "reasons_ai": string[3],',
		'  "labels": string[]',
		'}',
		'Contrainte: pas de prose hors JSON. 3 raisons concrètes et courtes.',
		'',
		'ICP:',
		JSON.stringify(icp ?? {}, null, 2),
		'',
		'Features:',
		JSON.stringify(features ?? {}, null, 2),
		'',
		'Texte:',
		String(pageText ?? '').slice(0, 30000)
	].join('\n');
}

async function callLLM(prompt) {
	const url = process.env.LLM_PROVIDER_URL;
	const key = process.env.LLM_API_KEY;
	const model = process.env.LLM_MODEL || 'gpt-4o-mini';
	if (!url || !key) {
		// stub fallback
		return JSON.stringify({
			score_ai: 60,
			reasons_ai: ['Pertinent secteur', 'Taille adéquate', 'Signal positif'],
			labels: ['stub']
		});
	}
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${key}`
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: 'system', content: 'You output STRICT JSON only.' },
				{ role: 'user', content: prompt }
			],
			temperature: 0.2
		})
	});
	if (!resp.ok) {
		throw new Error(`LLM HTTP ${resp.status}`);
	}
	const data = await resp.json();
	return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? JSON.stringify(data);
}

function normalizeLLM(raw) {
	let obj;
	try {
		obj = JSON.parse(raw);
	} catch {
		const m = raw.match(/\{[\s\S]*\}/);
		if (!m) throw new Error('Invalid LLM output');
		obj = JSON.parse(m[0]);
	}
	let score = Number(obj?.score_ai);
	if (!Number.isFinite(score)) score = 0;
	score = Math.max(0, Math.min(100, Math.round(score)));
	let reasons = Array.isArray(obj?.reasons_ai) ? obj.reasons_ai.map(String) : [];
	if (reasons.length > 3) reasons = reasons.slice(0, 3);
	while (reasons.length < 3) reasons.push('Raison manquante');
	const labels = Array.isArray(obj?.labels) ? obj.labels.map(String) : [];
	return { score_ai: score, reasons_ai: reasons, labels };
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
		const chunks = [];
		for await (const c of req) chunks.push(c);
		const bodyStr = Buffer.concat(chunks).toString('utf-8');
		const { icp, features, pageText } = bodyStr ? JSON.parse(bodyStr) : {};
		const prompt = buildPrompt(icp, features, pageText);
		const raw = await callLLM(prompt);
		const out = normalizeLLM(raw);
		return send(res, 200, out);
	} catch (e) {
		return send(res, 500, { error: String(e?.message || e) });
	}
}


