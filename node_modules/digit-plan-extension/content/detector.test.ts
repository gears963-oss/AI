import { describe, it, expect } from 'vitest';
import { detectSupportedSite } from './detector';

describe('detectSupportedSite', () => {
	it('detects linkedin', () => {
		const loc = { host: 'www.linkedin.com' } as Location;
		expect(detectSupportedSite(loc)).toBe('linkedin');
	});
	it('detects google maps', () => {
		const loc = { host: 'maps.google.com' } as Location;
		expect(detectSupportedSite(loc)).toBe('google_maps');
	});
	it('falls back to website', () => {
		const loc = { host: 'acme.example.com' } as Location;
		expect(detectSupportedSite(loc)).toBe('website');
	});
});


