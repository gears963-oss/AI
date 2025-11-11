import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

	function copyManifestAndIcons() {
	return {
		name: 'copy-manifest-and-icons',
		closeBundle: async () => {
			const outDir = resolve(__dirname, 'dist');
			await fs.mkdir(outDir, { recursive: true });
				// Detect icon presence
				const srcIcons = resolve(__dirname, 'icons');
				const icon128Path = resolve(srcIcons, 'icon128.png');
				let hasIcon = false;
				try {
					const stat = await fs.stat(icon128Path);
					hasIcon = stat.isFile();
				} catch {}
				// Write manifest.json with requested structure
				const manifest: any = {
					manifest_version: 3,
					name: 'ProspectIQ - ICP Finder',
					version: '0.1.0',
					action: { default_popup: 'popup.html' },
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
				if (hasIcon) {
					manifest.icons = { '128': 'icons/icon128.png' };
					// Copy icons folder if present
					const dstIcons = resolve(outDir, 'icons');
					await fs.mkdir(dstIcons, { recursive: true });
					await fs.copyFile(icon128Path, resolve(dstIcons, 'icon128.png'));
				}
				await fs.writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
				// Copy popup.html (vanilla)
				try {
					const popupSrc = resolve(__dirname, 'popup.html');
					const popupDst = resolve(outDir, 'popup.html');
					const stat = await fs.stat(popupSrc);
					if (stat.isFile()) {
						await fs.copyFile(popupSrc, popupDst);
					}
				} catch {}
		}
	};
}

export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				'popup/index': resolve(__dirname, 'src/popup/index.html'),
				'background/index': resolve(__dirname, 'src/background/index.ts'),
				'content/index': resolve(__dirname, 'src/content/index.ts')
			},
			output: {
				entryFileNames: (chunk) => {
					// Ensure flat output paths that match manifest references
					return `${chunk.name}.js`;
				},
				assetFileNames: (assetInfo) => {
					return assetInfo.name || '[name][extname]';
				}
			}
		},
		target: 'chrome120'
	},
	plugins: [react(), copyManifestAndIcons()]
});


