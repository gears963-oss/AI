import type { ICP, Features } from '@shared/types';

export interface LLMClient {
	complete(prompt: string): Promise<string>;
}

class StubLLM implements LLMClient {
	async complete(prompt: string): Promise<string> {
		// Produce deterministic placeholder: exactly 3 concise bullets
		const lines = [
			'- Secteur et critères cohérents avec l’ICP',
			'- Taille et signaux conformes',
			'- Localisation et tech pertinentes'
		];
		return lines.join('\n');
	}
}

const defaultClient: LLMClient = new StubLLM();

export async function callLLM(prompt: string): Promise<string> {
	const url = process.env.LLM_PROVIDER_URL;
	const apiKey = process.env.LLM_API_KEY;
	const model = process.env.LLM_MODEL || 'gpt-4o-mini';
	if (!url || !apiKey) {
		// Fallback to stub if not configured
		return defaultClient.complete(prompt);
	}
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages: [
				{ role: 'system', content: 'You are a helpful assistant that outputs STRICT JSON only.' },
				{ role: 'user', content: prompt }
			],
			temperature: 0.2
		})
	});
	if (!resp.ok) {
		throw new Error(`LLM error ${resp.status}`);
	}
	const data = await resp.json();
	// OpenAI-style
	const content =
		data?.choices?.[0]?.message?.content ??
		data?.choices?.[0]?.text ??
		(typeof data === 'string' ? data : JSON.stringify(data));
	return content;
}

// Placeholder async stubs. Replace with your LLM provider integration when ready.
export async function enrichProspect(prospect: Partial<Features>): Promise<Partial<Features>> {
	// Simulate enrichment latency
	await new Promise((r) => setTimeout(r, 50));
	return {
		...prospect,
		notes: prospect.notes ?? 'Auto-enriched: minimal stub data'
	};
}

export function buildIcpSummaryPrompt(features: Partial<Features>, icp?: ICP): string {
	const parts: string[] = [];
	parts.push('Tu es un assistant sales français. Génère exactement 3 puces courtes et concrètes:');
	parts.push('Titre: "Pourquoi ce lead matche". N’ajoute aucune intro ni conclusion.');
	parts.push('');
	parts.push('Contraintes:');
	parts.push('- 1 phrase par puce, factuelle, sans jargon.');
	parts.push('- Pas de répétitions, pas de variables entre crochets.');
	parts.push('- Mentionne des éléments observables (secteur, techno, taille, rating, localisation).');
	parts.push('');
	parts.push('ICP (critères):');
	parts.push(`- Pays: ${icp?.country ?? 'n/a'}`);
	parts.push(`- Secteurs: ${(icp?.sectors ?? []).join(', ') || 'n/a'}`);
	parts.push(`- Taille: ${icp?.sizeMin ?? 'n/a'}–${icp?.sizeMax ?? 'n/a'}`);
	parts.push(`- Roles: ${(icp?.roles ?? []).join(', ') || 'n/a'}`);
	parts.push(`- Exclusions: ${(icp?.excludes ?? []).join(', ') || 'n/a'}`);
	parts.push(`- Signaux: ${(icp?.signals ?? []).join(', ') || 'n/a'}`);
	if (typeof icp?.googleRatingMax === 'number') {
	parts.push(`- Note Google max: ${icp.googleRatingMax}`);
	}
	parts.push('');
	parts.push('Features (observées):');
	parts.push(`- Pays détecté: ${features.country ?? 'n/a'}`);
	parts.push(`- Secteur texte: ${features.sectorText ?? 'n/a'}`);
	parts.push(`- Employés: ${features.employeeCount ?? 'n/a'}`);
	parts.push(`- Site: ${features.websiteUrl ?? 'n/a'}`);
	parts.push(`- Tech: ${(features.technologies ?? []).join(', ') || 'n/a'}`);
	if (typeof features.googleRating === 'number') {
		parts.push(`- Note Google: ${features.googleRating}`);
	}
	parts.push(`- Contexte: ${(features.textBlob ?? '').slice(0, 300)}`);
	parts.push('');
	parts.push('Format de sortie strict:');
	parts.push('- Puce 1');
	parts.push('- Puce 2');
	parts.push('- Puce 3');
	return parts.join('\n');
}

export async function summarizeProspect(
	features: Partial<Features>,
	icp?: ICP,
	client: LLMClient = defaultClient
): Promise<string> {
	const prompt = buildIcpSummaryPrompt(features, icp);
	const out = await client.complete(prompt);
	// Ensure exactly 3 lines; trim extras in stub context
	const lines = out
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.startsWith('-'));
	if (lines.length >= 3) return lines.slice(0, 3).join('\n');
	// Pad with generic if fewer
	const pad = ['- Pertinence sectorielle', '- Taille adéquate', '- Signaux compatibles'];
	return [...lines, ...pad].slice(0, 3).join('\n');
}


