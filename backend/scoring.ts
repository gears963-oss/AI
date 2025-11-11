import type { ScoreResult, ICP, Features } from '@shared/types';

function normalizeScore(value: number, min: number, max: number): number {
	if (max === min) return 50;
	const clamped = Math.max(min, Math.min(max, value));
	const ratio = (clamped - min) / (max - min);
	return Math.round(ratio * 100);
}

function llmStubScore(_icp: ICP | undefined, _features: Features | undefined): { score: number; reason: string } {
	// Placeholder: neutral 50/100 influence which will be weighted 30% in final score
	return { score: 50, reason: 'LLM stub (neutral influence)' };
}

export function scoreProspect(icp?: ICP, features?: Features): ScoreResult {
	let rulePoints = 0;
	let ruleMin = -50;
	let ruleMax = 100;
	const reasons: string[] = [];

	// Country rule
	if (icp?.country) {
		if (features?.country && features.country.toLowerCase() === icp.country.toLowerCase()) {
			rulePoints += 20;
			reasons.push('Country match (+20)');
		} else {
			rulePoints -= 20;
			reasons.push('Out of ICP country (-20)');
		}
	}

	// Sector keywords
	if (icp?.sectors?.length) {
		const blob = (features?.sectorText ?? '').toLowerCase();
		const hit = icp.sectors.some((kw) => blob.includes(kw.toLowerCase()));
		if (hit) {
			rulePoints += 20;
			reasons.push('Sector keyword match (+20)');
		} else {
			rulePoints -= 5;
			reasons.push('Sector not in ICP (-5)');
		}
	}

	// Size min/max
	if (typeof features?.employeeCount === 'number' && (icp?.sizeMin != null || icp?.sizeMax != null)) {
		const min = icp?.sizeMin ?? Number.NEGATIVE_INFINITY;
	const max = icp?.sizeMax ?? Number.POSITIVE_INFINITY;
		if (features.employeeCount >= min && features.employeeCount <= max) {
			rulePoints += 15;
			reasons.push('Size within range (+15)');
		} else {
			rulePoints -= 5;
			reasons.push('Size outside range (-5)');
		}
	}

	// Positive signals
	if (features?.websiteUrl) {
		rulePoints += 5;
		reasons.push('Website present (+5)');
	}
	if (icp?.signals?.some((s) => /shopify/i.test(s))) {
		if (features?.technologies?.some((t) => /shopify/i.test(t))) {
			rulePoints += 5;
			reasons.push('Shopify detected as requested (+5)');
		}
	}
	if (typeof icp?.googleRatingMax === 'number' && typeof features?.googleRating === 'number') {
		if (features.googleRating <= icp.googleRatingMax) {
			rulePoints += 5;
			reasons.push('Google rating under ICP max (+5)');
		} else {
			rulePoints -= 5;
			reasons.push('Google rating above ICP max (-5)');
		}
	}

	// Negative signals: excludes
	if (icp?.excludes?.length) {
		const blob =
			`${features?.textBlob ?? ''} ${features?.sectorText ?? ''} ${features?.websiteUrl ?? ''}`.toLowerCase();
		const excluded = icp.excludes.some((x) => blob.includes(x.toLowerCase()));
		if (excluded) {
			rulePoints -= 15;
			reasons.push('Excluded keyword matched (-15)');
		}
	}

	// Normalize rules to 0..100 then 70% weighting
	const normalizedRules = normalizeScore(rulePoints, ruleMin, ruleMax);
	const weightedRules = normalizedRules * 0.7;

	// LLM stub 30%
	const llm = llmStubScore(icp, features);
	const weightedLlm = llm.score * 0.3;

	const finalScore = Math.max(0, Math.min(100, Math.round(weightedRules + weightedLlm)));
	if (llm.reason) reasons.push(llm.reason);

	return { score: finalScore, reasons };
}


