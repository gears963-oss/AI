(() => {
	const KEY = 'ICP_ACTIVE';
	const KEY_BACKEND = 'PIQ_BACKEND_URL';
	const $ = (id) => document.getElementById(id);

	function parseCsv(input) {
		const v = (input || '').trim();
		if (!v) return [];
		return v.split(',').map((s) => s.trim()).filter(Boolean);
	}

	function toNumber(val) {
		const n = Number(val);
		return Number.isFinite(n) ? n : undefined;
	}

	function readForm() {
		return {
			pays: $('pays').value.trim() || undefined,
			secteurs: parseCsv($('secteurs').value),
			taille_min: toNumber($('taille_min').value),
			taille_max: toNumber($('taille_max').value),
			roles: parseCsv($('roles').value),
			note_google_max: toNumber($('note_google_max').value),
			techno_inclues: parseCsv($('techno_inclues').value),
			exclusions_mots: parseCsv($('exclusions_mots').value)
		};
	}

	function writeForm(icp) {
		$('pays').value = icp.pays ?? '';
		$('secteurs').value = (icp.secteurs ?? []).join(', ');
		$('taille_min').value = icp.taille_min ?? '';
		$('taille_max').value = icp.taille_max ?? '';
		$('roles').value = (icp.roles ?? []).join(', ');
		$('note_google_max').value = icp.note_google_max ?? '';
		$('techno_inclues').value = (icp.techno_inclues ?? []).join(', ');
		$('exclusions_mots').value = (icp.exclusions_mots ?? []).join(', ');
	}

	async function saveIcp() {
		const icp = readForm();
		await chrome.storage.sync.set({ [KEY]: icp });
		window.close();
	}

	async function loadIcp() {
		const data = await chrome.storage.sync.get(KEY);
		const icp = data?.[KEY] || {};
		writeForm(icp);
	}

	async function saveBackend() {
		const url = $('piq_backend_url').value.trim();
		if (url) await chrome.storage.sync.set({ [KEY_BACKEND]: url });
	}

	async function loadBackend() {
		const data = await chrome.storage.sync.get(KEY_BACKEND);
		$('piq_backend_url').value = data?.[KEY_BACKEND] || '';
	}

	document.addEventListener('DOMContentLoaded', () => {
		$('save').addEventListener('click', saveIcp);
		$('load').addEventListener('click', loadIcp);
		$('save_backend').addEventListener('click', saveBackend);
		$('load_backend').addEventListener('click', loadBackend);
		// Auto-load on open
		loadIcp();
		loadBackend();
	});
})();


