export const sectorWeights: Record<string, number> = {
	'saas': 10,
	'software': 8,
	'fintech': 6,
	'healthcare': 4,
	'education': 2
};

export const roleSignals: Array<{ label: string; regex: RegExp; weight: number }> = [
	{ label: 'Founder/CEO', regex: /\b(ceo|founder|co[-\s]?founder)\b/i, weight: 12 },
	{ label: 'VP/Head', regex: /\b(vp|vice president|head of)\b/i, weight: 8 },
	{ label: 'Director', regex: /\b(director)\b/i, weight: 6 },
	{ label: 'Manager', regex: /\b(manager)\b/i, weight: 3 },
	{ label: 'Intern/Junior', regex: /\b(intern|junior)\b/i, weight: -5 }
];


