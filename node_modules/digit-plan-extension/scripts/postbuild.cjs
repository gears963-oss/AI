/* Ensure manifest.json and icons/ exist in dist, and that paths match Vite outputs */
const fs = require('fs');
const path = require('path');

const root = __dirname ? path.resolve(__dirname, '..') : path.resolve('..');
const dist = path.join(root, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

// Ensure manifest.json exists with correct paths
const manifestPath = path.join(dist, 'manifest.json');
const srcIcons = path.join(root, 'icons');
const iconFile = path.join(srcIcons, 'icon128.png');
const manifest = {
	manifest_version: 3,
	name: 'ProspectIQ - ICP Finder',
	version: '0.3.0',
	action: { default_popup: 'popup.html' },
	background: { service_worker: 'background.js' },
	content_scripts: [
		{
			matches: ['https://*/*', 'http://*/*'],
			js: ['content/detector.js'],
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

// Copy icons if present
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

// Copy popup.html and popup.js to dist root (always overwrite to ensure latest)
const popupHtmlSrc = path.join(root, 'popup.html');
const popupHtmlDst = path.join(dist, 'popup.html');
const popupJsSrc = path.join(root, 'popup.js');
const popupJsDst = path.join(dist, 'popup.js');

if (fs.existsSync(popupHtmlSrc)) {
	fs.copyFileSync(popupHtmlSrc, popupHtmlDst);
	console.log('[postbuild] Copied popup.html');
} else {
	console.warn('[postbuild] popup.html not found in root');
}

if (fs.existsSync(popupJsSrc)) {
	fs.copyFileSync(popupJsSrc, popupJsDst);
	console.log('[postbuild] Copied popup.js');
} else {
	console.warn('[postbuild] popup.js not found in root');
}

// Copy background.js and content/detector.js if they exist (vanilla versions)
const bgJsSrc = path.join(root, 'background.js');
const bgJsDst = path.join(dist, 'background.js');
if (fs.existsSync(bgJsSrc)) {
	fs.copyFileSync(bgJsSrc, bgJsDst);
	console.log('[postbuild] Copied background.js');
}

const contentDetectorSrc = path.join(root, 'content', 'detector.js');
const contentDetectorDst = path.join(dist, 'content', 'detector.js');
if (fs.existsSync(contentDetectorSrc)) {
	const contentDir = path.dirname(contentDetectorDst);
	if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });
	fs.copyFileSync(contentDetectorSrc, contentDetectorDst);
	console.log('[postbuild] Copied content/detector.js');
}

// Validate required files exist
const required = ['popup.html', 'popup.js', 'background.js', 'content/detector.js'];
const missing = required.filter((p) => !fs.existsSync(path.join(dist, p)));
if (missing.length) {
	console.warn('[postbuild] Missing expected outputs:', missing);
	process.exitCode = 0; // Do not hard fail, but warn for visibility
} else {
	console.log('[postbuild] All required files present');
}





