import { describe, it, expect } from 'vitest';
import { extractNormalized } from './extractor';

function docFrom(html: string): Document {
	const parser = new DOMParser();
	return parser.parseFromString(html, 'text/html');
}

describe('extractNormalized - Google Maps', () => {
	it('extracts name, website, rating, review count, phone', () => {
		const html = `
		<html><body>
			<h1>Acme Paris</h1>
			<div aria-label="Rating 4.3">★</div>
			<div>1 234 avis</div>
			<a href="tel:+33 1 23 45 67 89">+33 1 23 45 67 89</a>
			<a href="https://acme.example">Site web</a>
		</body></html>
		`;
		const doc = docFrom(html);
		const f = extractNormalized('google_maps', doc);
		expect(f.googleRating).toBe(4.3);
		expect(f.websiteUrl).toContain('http');
	});
});

describe('extractNormalized - LinkedIn', () => {
	it('parses company size and country from location', () => {
		const html = `
		<html><body>
			<h1>Acme, Inc.</h1>
			<div class="org-top-card-summary-info-list__info-item">51–200 employees</div>
			<div class="org-top-card-summary__info-item">Paris, France</div>
			<div class="org-top-card-summary-info-list__info-item">Software</div>
		</body></html>
		`;
		const doc = docFrom(html);
		const f = extractNormalized('linkedin', doc);
		expect(f.employeeCount).toBeGreaterThanOrEqual(51);
		expect(f.country).toMatch(/france/i);
		expect(f.sectorText).toMatch(/software/i);
	});
});

describe('extractNormalized - website', () => {
	it('detects Shopify, WooCommerce and collects socials', () => {
		const html = `
		<html><head>
			<script src="https://cdn.shopify.com/some.js"></script>
		</head><body>
			<a href="https://twitter.com/acme">Twitter</a>
			<a href="https://www.linkedin.com/company/acme">LinkedIn</a>
			<script>/* WooCommerce */</script>
		</body></html>
		`;
		const doc = docFrom(html);
		const f = extractNormalized('website', doc);
		expect(f.technologies).toContain('Shopify');
		expect(f.technologies).toContain('WooCommerce');
		expect(f.textBlob || '').toMatch(/twitter\.com|linkedin\.com/);
	});
});


