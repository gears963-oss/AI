import { Features, SupportedSite } from '@shared/types';
import { detectSupportedSite } from './detector';

function parseCompanySizeToEmployees(sizeText: string | null | undefined): number | undefined {
	if (!sizeText) return undefined;
	// Examples: "11–50 employees", "51-200 employés", "1000+ employees"
	const text = sizeText.replace(/\s+/g, ' ').toLowerCase();
	const plus = text.match(/(\d+)\s*\+\s*(?:employees|employ[eé]s?)/i);
	if (plus) return Number(plus[1]);
	const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
	if (range) {
		const min = Number(range[1]);
		const max = Number(range[2]);
		return Math.round((min + max) / 2);
	}
	const single = text.match(/(\d+)\s*(?:employees|employ[eé]s?)/i);
	if (single) return Number(single[1]);
	return undefined;
}

function extractFromLinkedIn(doc: Document): Features {
	const title =
		doc.querySelector('h1')?.textContent?.trim() ||
		doc.querySelector('[data-test-profile-name]')?.textContent?.trim() ||
		undefined;
	const sizeText =
		doc.querySelector('[data-test=company-size], .org-top-card-summary-info-list__info-item')?.textContent?.trim() ||
		undefined;
	const employeeCount = parseCompanySizeToEmployees(sizeText);
	const locationText =
		doc.querySelector('[data-test=location], .org-top-card-summary__info-item')?.textContent?.trim() ||
		undefined;
	const industryText =
		doc.querySelector('[data-test=industry], .org-top-card-summary-info-list__info-item')?.textContent?.trim() ||
		undefined;
	// best-effort country extraction from location (last token)
	const country = locationText?.split(',').pop()?.trim();
	const sectorText = industryText;
	return {
		sectorText,
		employeeCount,
		country,
		textBlob: [title, locationText, industryText].filter(Boolean).join(' | '),
		websiteUrl: location.href
	};
}

function extractFromGoogleMaps(doc: Document): Features {
	const name = doc.querySelector('h1')?.textContent?.trim() || undefined;
	const websiteLink =
		(Array.from(doc.querySelectorAll('a')) as HTMLAnchorElement[]).find((a) =>
			/(site web|website)/i.test(a.textContent || '') || /https?:\/\//i.test(a.getAttribute('href') || '')
		)?.href || undefined;
	const ratingText =
		doc.querySelector('[aria-label*="rating"], [aria-label*="note"], .F7nice')?.getAttribute('aria-label') ||
		doc.querySelector('.F7nice')?.textContent ||
		undefined;
	const rating = ratingText ? Number((ratingText.match(/(\d+(\.\d+)?)/) || [])[1]) : undefined;
	const reviewsText =
		doc.querySelector('[aria-label*="reviews"], [aria-label*="avis"], .hh2c6')?.textContent || undefined;
	const reviewCount = reviewsText ? Number((reviewsText.replace(/[\s,\.]/g, '').match(/(\d+)/) || [])[1]) : undefined;
	const phone =
		(Array.from(doc.querySelectorAll('button, a')) as Array<HTMLElement>).map((el) => el.textContent || '').join(' ')
			.match(/(\+?\d[\d\s\-().]{6,}\d)/)?.[1] || undefined;
	return {
		websiteUrl: location.href,
		textBlob: name,
		googleRating: isFinite(rating as number) ? (rating as number) : undefined,
		sectorText: undefined,
		employeeCount: undefined,
		country: undefined,
		// Keep auxiliary details inside textBlob if needed
	};
}

function extractFromWebsite(doc: Document): Features {
	const html = doc.documentElement?.outerHTML || '';
	const technologies: string[] = [];
	if (/shopify/i.test(html) || Array.from(doc.scripts).some((s) => /shopify/i.test(s.src))) technologies.push('Shopify');
	if (/woocommerce/i.test(html) || Array.from(doc.scripts).some((s) => /woocommerce/i.test(s.src)))
		technologies.push('WooCommerce');

	const anchors = Array.from(doc.querySelectorAll('a')) as HTMLAnchorElement[];
	const socials = anchors
		.map((a) => a.href)
		.filter((href) => /(facebook|instagram|twitter|x\.com|linkedin|tiktok)\.com/i.test(href));

	return {
		websiteUrl: location.href,
		technologies,
		textBlob: socials.join(' ')
	};
}

export function extractNormalized(site: SupportedSite, doc: Document = document): Features {
	switch (site) {
		case 'linkedin':
			return extractFromLinkedIn(doc);
		case 'google_maps':
			return extractFromGoogleMaps(doc);
		case 'website':
			return extractFromWebsite(doc);
		default:
			return {};
	}
}

(() => {
	const site = detectSupportedSite();
	if (!site) return;
	const features = extractNormalized(site);
	chrome.runtime?.sendMessage?.({ type: 'EXTRACTION', payload: { site, features } });
})();

// Scan visible list items on Maps or LinkedIn search pages with random delay and cancellation
let SCAN_CANCELLED = false;
chrome.runtime.onMessage.addListener((message) => {
	if (message?.type === 'STOP_SCAN') {
		SCAN_CANCELLED = true;
	}
	if (message?.type === 'SCAN_PAGE') {
		SCAN_CANCELLED = false;
		(async () => {
			const site = detectSupportedSite();
			const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
			function randMs(): number {
				return 700 + Math.floor(Math.random() * (2200 - 700));
			}
			let items: Element[] = [];
			if (site === 'google_maps') {
				items = Array.from(document.querySelectorAll('.Nv2PK, .bfdHYd, [data-result]'));
			} else if (site === 'linkedin') {
				items = Array.from(
					document.querySelectorAll('.reusable-search__result-container, li.reusable-search__result-container')
				);
			}
			for (const el of items) {
				if (SCAN_CANCELLED) break;
				// Shallow features from item
				const text = (el.textContent || '').trim();
				let href: string | undefined;
				const a = el.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
				if (a?.href) href = a.href;
				const features: Features = {
					websiteUrl: href || location.href,
					sectorText: text.slice(0, 500),
					textBlob: text
				};
				chrome.runtime.sendMessage({ type: 'EXTRACTION', payload: { site, features } });
				await delay(randMs());
			}
			chrome.runtime.sendMessage({ type: 'SCAN_DONE' });
		})();
	}
});


