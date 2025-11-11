import { SupportedSite } from '@shared/types';

const SUPPORTED_HOSTS: Array<{ hostIncludes: string; site: SupportedSite }> = [
	{ hostIncludes: 'linkedin.com', site: 'linkedin' },
	{ hostIncludes: 'google.com', site: 'google_maps' }
];

export function detectSupportedSite(currentLocation: Location = window.location): SupportedSite | null {
	const host = currentLocation.host.toLowerCase();
	for (const entry of SUPPORTED_HOSTS) {
		if (host.includes(entry.hostIncludes)) return entry.site;
	}
	return 'website';
}

// Expose simple hook for the extractor
(() => {
	const site = detectSupportedSite();
	if (site) {
		// Communicate detection to background
		chrome.runtime?.sendMessage?.({ type: 'SITE_DETECTED', payload: { site } });
	}
})();


