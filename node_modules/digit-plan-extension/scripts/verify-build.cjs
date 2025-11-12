#!/usr/bin/env node
/* Vérifie que tous les fichiers nécessaires sont présents dans dist/ */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

console.log('🔍 Vérification du build...\n');

if (!fs.existsSync(dist)) {
	console.error('❌ Le dossier dist/ n\'existe pas. Lancez: npm run build');
	process.exit(1);
}

const required = {
	'manifest.json': 'Manifest de l\'extension',
	'popup.html': 'Fichier popup HTML',
	'popup.js': 'Fichier popup JavaScript',
	'background.js': 'Service worker background',
	'content/detector.js': 'Content script detector'
};

let allOk = true;
for (const [file, desc] of Object.entries(required)) {
	const fullPath = path.join(dist, file);
	if (fs.existsSync(fullPath)) {
		const stat = fs.statSync(fullPath);
		console.log(`✅ ${file} (${desc}) - ${stat.size} bytes`);
	} else {
		console.error(`❌ ${file} (${desc}) - MANQUANT`);
		allOk = false;
	}
}

// Vérifier le manifest
const manifestPath = path.join(dist, 'manifest.json');
if (fs.existsSync(manifestPath)) {
	try {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
		console.log('\n📋 Manifest:');
		console.log(`   default_popup: ${manifest.action?.default_popup || 'MANQUANT'}`);
		console.log(`   service_worker: ${manifest.background?.service_worker || 'MANQUANT'}`);
		console.log(`   content_script: ${manifest.content_scripts?.[0]?.js?.[0] || 'MANQUANT'}`);
		
		if (manifest.action?.default_popup !== 'popup.html') {
			console.error('❌ Le manifest pointe vers:', manifest.action?.default_popup, '(devrait être popup.html)');
			allOk = false;
		}
	} catch (e) {
		console.error('❌ Erreur lecture manifest:', e.message);
		allOk = false;
	}
}

if (allOk) {
	console.log('\n✅ Tous les fichiers sont présents!');
	console.log('\n📦 Pour charger dans Chrome:');
	console.log('   1. Ouvrez chrome://extensions');
	console.log('   2. Activez "Mode développeur"');
	console.log('   3. Cliquez "Charger l\'extension non empaquetée"');
	console.log('   4. Sélectionnez le dossier:', dist);
	console.log('\n⚠️  Si la popup ne se met pas à jour:');
	console.log('   - Rechargez l\'extension (bouton ↻)');
	console.log('   - Fermez et rouvrez la popup');
	console.log('   - Vérifiez la console (clic droit sur popup → Inspecter)');
} else {
	console.error('\n❌ Des fichiers manquent. Lancez: npm run build');
	process.exit(1);
}

