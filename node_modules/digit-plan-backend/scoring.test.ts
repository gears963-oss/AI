import { describe, it, expect } from 'vitest';
import { scoreProspect } from './scoring';

describe('scoreProspect rules and signals', () => {
	it('1) Full match with Shopify and rating under max -> high score', () => {
		const icp = {
			country: 'FR',
			sectors: ['retail', 'ecommerce'],
			sizeMin: 10,
			sizeMax: 200,
			signals: ['shopify'],
			googleRatingMax: 4.0
		};
		const features = {
			country: 'FR',
			sectorText: 'Leading ecommerce retail brand',
			employeeCount: 120,
			websiteUrl: 'https://acme.shop',
			technologies: ['Shopify'],
			googleRating: 3.9,
			textBlob: 'Acme retail ecommerce'
		};
		const result = scoreProspect(icp, features);
		expect(result.score).toBeGreaterThan(80);
		expect(result.reasons.join(' ')).toMatch(/Shopify detected|rating under/i);
	});

	it('2) Country mismatch -> penalty', () => {
		const icp = { country: 'FR' };
		const features = { country: 'DE' };
		const result = scoreProspect(icp, features);
		expect(result.reasons.join(' ')).toMatch(/Out of ICP country/);
	});

	it('3) Sector mismatch -> small penalty', () => {
		const icp = { sectors: ['fintech'] };
		const features = { sectorText: 'logistics and supply chain' };
		const result = scoreProspect(icp, features);
		expect(result.reasons.join(' ')).toMatch(/Sector not in ICP/);
	});

	it('4) Size below min -> penalty', () => {
		const icp = { sizeMin: 50 };
		const features = { employeeCount: 10 };
		const result = scoreProspect(icp, features);
		expect(result.reasons.join(' ')).toMatch(/Size outside range/);
	});

	it('5) Excluded keyword matched -> strong penalty', () => {
		const icp = { excludes: ['agency'] };
		const features = { textBlob: 'We are a creative agency' };
		const result = scoreProspect(icp, features);
		expect(result.reasons.join(' ')).toMatch(/Excluded keyword/);
	});

	it('6) Website missing -> no bonus', () => {
		const icp = {};
		const features = {};
		const resultNoSite = scoreProspect(icp, features);
		const withSite = scoreProspect(icp, { websiteUrl: 'https://x.io' });
		expect(withSite.score).toBeGreaterThanOrEqual(resultNoSite.score);
	});

	it('7) Google rating above max -> penalty', () => {
		const icp = { googleRatingMax: 3.0 };
		const features = { googleRating: 4.2 };
		const result = scoreProspect(icp, features);
		expect(result.reasons.join(' ')).toMatch(/above ICP max/);
	});

	it('8) Shopify requested but not detected -> no Shopify bonus', () => {
		const icp = { signals: ['shopify'] };
		const result = scoreProspect(icp, { technologies: ['woocommerce'] });
		expect(result.reasons.join(' ')).not.toMatch(/Shopify detected/);
	});
});


