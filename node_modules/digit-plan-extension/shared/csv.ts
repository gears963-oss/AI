import type { Features, ScoreResult } from '@shared/types';

export type CsvRow = {
	features: Partial<Features>;
	result: ScoreResult;
};

function escapeCsv(value: unknown): string {
	const s = value == null ? '' : String(value);
	if (/[",\n]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

export function toCsv(rows: CsvRow[]): string {
	const headers = [
		'websiteUrl',
		'country',
		'sectorText',
		'employeeCount',
		'technologies',
		'googleRating',
		'score',
		'reasons'
	];
	const lines: string[] = [];
	lines.push(headers.join(','));
	for (const r of rows) {
		const tech = (r.features.technologies ?? []).join('|');
		const line = [
			escapeCsv(r.features.websiteUrl),
			escapeCsv(r.features.country),
			escapeCsv(r.features.sectorText),
			escapeCsv(r.features.employeeCount),
			escapeCsv(tech),
			escapeCsv(r.features.googleRating),
			escapeCsv(r.result.score),
			escapeCsv(r.result.reasons.join('; '))
		].join(',');
		lines.push(line);
	}
	return lines.join('\n');
}


