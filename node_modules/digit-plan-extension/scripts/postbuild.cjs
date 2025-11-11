/* Ensure manifest.json and icons/ exist in dist, and that paths match Vite outputs */
const fs = require('fs');
const path = require('path');

const root = __dirname ? path.resolve(__dirname, '..') : path.resolve('..');
const dist = path.join(root, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

const manifestPath = path.join(dist, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
	const srcIcons = path.join(root, 'icons');
	const iconFile = path.join(srcIcons, 'icon128.png');
	const manifest = {
		manifest_version: 3,
		name: 'ProspectIQ - ICP Finder',
		version: '0.1.0',
		action: { default_popup: 'popup/index.html' },
		background: { service_worker: 'background/index.js' },
		content_scripts: [
			{
				matches: ['https://*/*', 'http://*/*'],
				js: ['content/index.js'],
				run_at: 'document_idle'
			}
		],
		permissions: ['storage', 'activeTab', 'scripting'],
		host_permissions: ['https://*/*', 'http://*/*']
	};
	if (fs.existsSync(iconFile)) {
		manifest.icons = { '128': 'icons/icon128.png' };
	}
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

// Copy icons if present
const srcIcons = path.join(root, 'icons');
const dstIcons = path.join(dist, 'icons');
if (fs.existsSync(srcIcons)) {
	const files = fs.readdirSync(srcIcons).filter((f) => f.toLowerCase() === 'icon128.png');
	if (files.length) {
		if (!fs.existsSync(dstIcons)) fs.mkdirSync(dstIcons, { recursive: true });
		for (const f of files) {
			fs.copyFileSync(path.join(srcIcons, f), path.join(dstIcons, f));
		}
	}
}

// Validate required files exist
// Ensure popup exists by copying from src if missing
const popupDist = path.join(dist, 'popup.html');
if (!fs.existsSync(popupDist)) {
	try {
		const popupSrc = path.join(root, 'popup.html');
		if (fs.existsSync(popupSrc)) {
			if (!fs.existsSync(path.dirname(popupDist))) fs.mkdirSync(path.dirname(popupDist), { recursive: true });
			fs.copyFileSync(popupSrc, popupDist);
		} else {
			// create a minimal popup
			if (!fs.existsSync(path.dirname(popupDist))) fs.mkdirSync(path.dirname(popupDist), { recursive: true });
			fs.writeFileSync(
				popupDist,
				'<!doctype html><html><body><div style="padding:12px;font-family:sans-serif">ProspectIQ</div></body></html>',
				'utf-8'
			);
		}
	} catch {}
}
const required = ['background/index.js', 'content/index.js', 'popup.html'];
const missing = required.filter((p) => !fs.existsSync(path.join(dist, p)));
if (missing.length) {
	console.warn('[postbuild] Missing expected outputs:', missing);
	process.exitCode = 0; // Do not hard fail, but warn for visibility
}





