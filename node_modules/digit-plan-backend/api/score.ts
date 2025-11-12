import http from 'node:http';
import { callLLM } from '../llm';

type ScoreBody = {
	icp?: unknown;
	features?: unknown;
	pageText?: string;
};

type ScoreAI = {
	score_ai: number;
	reasons_ai: string[];
	labels: string[];
};

function buildPrompt(input: ScoreBody): string {
	const { icp, features, pageText } = input;
	return [
		'Tu es un assistant sales.',
		'Analyse les informations suivantes et réponds STRICTEMENT en JSON au format:',
		'{',
		'  "score_ai": number (0..100),',
		'  "reasons_ai": string[3],',
		'  "labels": string[]',
		'}',
		'Règles:',
		'- "reasons_ai" doit contenir exactement 3 puces courtes et concrètes.',
		'- "score_ai" entre 0 et 100.',
		'- "labels" contient des tags utiles détectés (ex: "recrute", "delivery", "franchise").',
		'',
		'Contexte ICP:',
		JSON.stringify(icp ?? {}, null, 2),
		'',
		'Features observées:',
		JSON.stringify(features ?? {}, null, 2),
		'',
		'Texte de page (tronqué):',
		(pageText ?? '').slice(0, 2000)
	].join('\n');
}

function validateAndNormalize(raw: string): ScoreAI {
	let obj: any;
	try {
		obj = JSON.parse(raw);
	} catch {
		// Fallback attempt to extract JSON block
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error('LLM did not return JSON');
		obj = JSON.parse(match[0]);
	}
	let score = Number(obj?.score_ai);
	if (!Number.isFinite(score)) score = 0;
	score = Math.max(0, Math.min(100, Math.round(score)));
	let reasons: string[] = Array.isArray(obj?.reasons_ai) ? obj.reasons_ai.map(String) : [];
	if (reasons.length < 3) {
		while (reasons.length < 3) reasons.push('Raison manquante');
	} else if (reasons.length > 3) {
		reasons = reasons.slice(0, 3);
	}
	const labels: string[] = Array.isArray(obj?.labels) ? obj.labels.map(String) : [];
	return { score_ai: score, reasons_ai: reasons, labels };
}

export async function handler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
	if (req.method !== 'POST') {
		res.statusCode = 405;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ error: 'Method Not Allowed' }));
		return;
	}
	try {
		const body = await new Promise<string>((resolve, reject) => {
			let data = '';
			req.on('data', (chunk) => (data += chunk));
			req.on('end', () => resolve(data));
			req.on('error', reject);
		});
		const json = body ? (JSON.parse(body) as ScoreBody) : {};
		const prompt = buildPrompt(json);
		const llmRaw = await callLLM(prompt);
		const validated = validateAndNormalize(llmRaw);
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(validated));
	} catch (e: any) {
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ error: e?.message || 'server error' }));
	}
}

// Local dev server when executed directly
if (require.main === module) {
	const port = process.env.PORT ? Number(process.env.PORT) : 3001;
	const server = http.createServer((req, res) => handler(req, res));
	server.listen(port, () => {
		// eslint-disable-next-line no-console
		console.log(`[serverless] score endpoint listening on http://localhost:${port}`);
	});
}



