import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
	it('produces well-formed CSV for 5 items', () => {
		const rows = Array.from({ length: 5 }).map((_, i) => ({
			features: {
				websiteUrl: `https://example${i}.com`,
				country: 'FR',
				sectorText: 'ecommerce',
				employeeCount: 100 + i,
				technologies: ['Shopify'],
				googleRating: 3.5
			},
			result: { score: 80 + i, reasons: ['Match ICP', 'Shopify'] }
		}));
		const csv = toCsv(rows as any);
		const lines = csv.split('\n');
		expect(lines.length).toBe(1 + 5); // header + 5 rows
		const header = lines[0].split(',');
		expect(header).toEqual([
			'websiteUrl',
			'country',
			'sectorText',
			'employeeCount',
			'technologies',
			'googleRating',
			'score',
			'reasons'
		]);
		for (let i = 1; i < lines.length; i++) {
			const cols = lines[i].split(',');
			expect(cols.length).toBe(8);
		}
	});
});


