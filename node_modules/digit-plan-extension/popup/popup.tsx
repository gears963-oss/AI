import React from 'react';
import type { ICP } from '@shared/types';

export function App(): JSX.Element {
	const [icp, setIcp] = React.useState<ICP>({
		country: '',
		sectors: [],
		sizeMin: undefined,
		sizeMax: undefined,
		roles: [],
		excludes: [],
		signals: []
	});
	const [saving, setSaving] = React.useState(false);
	const [isListPage, setIsListPage] = React.useState(false);
	const [scanning, setScanning] = React.useState(false);
	const [webhookUrl, setWebhookUrl] = React.useState<string>('');

	React.useEffect(() => {
		(async () => {
			const stored = await chrome.storage?.local?.get?.(['icp', 'webhookUrl']);
			if (stored?.icp) setIcp(stored.icp as ICP);
			if (stored?.webhookUrl) setWebhookUrl(stored.webhookUrl as string);
			// Detect list page by URL
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
			const url = tabs[0]?.url || '';
			const listLike =
				/url=|\/search\/results\//i.test(url) ||
				/url=.*maps/i.test(url) ||
				/linkedin\.com\/search\//i.test(url) ||
				/google\.[^/]+\/maps\/(search|place)/i.test(url);
			setIsListPage(Boolean(listLike));
		})();
	}, []);

	async function save(): Promise<void> {
		setSaving(true);
		await chrome.storage?.local?.set?.({ icp, webhookUrl });
		setSaving(false);
	}

	function handleCsv(name: keyof ICP): (e: React.ChangeEvent<HTMLInputElement>) => void {
		return (e) => {
			const value = e.target.value.trim();
			const arr = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
			setIcp((prev) => ({ ...prev, [name]: arr as any }));
		};
	}

	async function startScan(): Promise<void> {
		setScanning(true);
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) {
			chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' });
		}
	}

	async function stopScan(): Promise<void> {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) {
			chrome.tabs.sendMessage(tab.id, { type: 'STOP_SCAN' });
		}
		setScanning(false);
	}

	async function exportCsv(): Promise<void> {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) {
			chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_BUFFER' });
			// Ask background directly to export
			chrome.runtime.sendMessage({ type: 'EXPORT_CSV' });
		}
	}

	return (
		<div style={{ fontFamily: 'system-ui, sans-serif', padding: 12, width: 320 }}>
			<h3 style={{ marginTop: 0 }}>Digit Plan</h3>
			{isListPage ? (
				<div style={{ marginBottom: 12, padding: 8, background: '#f1f5f9', borderRadius: 8 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<strong>Scanner cette page</strong>
						{!scanning ? (
							<button onClick={startScan} style={{ padding: '6px 10px' }}>
								Lancer
							</button>
						) : (
							<button onClick={stopScan} style={{ padding: '6px 10px', background: '#fee2e2' }}>
								Arrêter
							</button>
						)}
					</div>
					<small style={{ color: '#475569' }}>
						Traite les éléments visibles avec des délais aléatoires. Aucune donnée n’est stockée côté
						serveur sans action explicite.
					</small>
					<div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
						<label>
							<div>Webhook URL (Airtable/Notion)</div>
							<input
								placeholder="https://hooks..."
								value={webhookUrl}
								onChange={(e) => setWebhookUrl(e.target.value)}
							/>
						</label>
						<button onClick={exportCsv} style={{ padding: '6px 10px' }} disabled={scanning}>
							Exporter CSV
						</button>
					</div>
				</div>
			) : null}
			<div style={{ display: 'grid', gap: 8 }}>
				<label>
					<div>Country</div>
					<input value={icp.country ?? ''} onChange={(e) => setIcp({ ...icp, country: e.target.value })} />
				</label>
				<label>
					<div>Sectors (csv)</div>
					<input value={(icp.sectors ?? []).join(', ')} onChange={handleCsv('sectors')} />
				</label>
				<div style={{ display: 'flex', gap: 8 }}>
					<label style={{ flex: 1 }}>
						<div>Size min</div>
						<input
							type="number"
							value={icp.sizeMin ?? ''}
							onChange={(e) =>
								setIcp({ ...icp, sizeMin: e.target.value ? Number(e.target.value) : undefined })
							}
						/>
					</label>
					<label style={{ flex: 1 }}>
						<div>Size max</div>
						<input
							type="number"
							value={icp.sizeMax ?? ''}
							onChange={(e) =>
								setIcp({ ...icp, sizeMax: e.target.value ? Number(e.target.value) : undefined })
							}
						/>
					</label>
				</div>
				<label>
					<div>Roles (csv)</div>
					<input value={(icp.roles ?? []).join(', ')} onChange={handleCsv('roles')} />
				</label>
				<label>
					<div>Excludes (csv)</div>
					<input value={(icp.excludes ?? []).join(', ')} onChange={handleCsv('excludes')} />
				</label>
				<label>
					<div>Signals (csv)</div>
					<input value={(icp.signals ?? []).join(', ')} onChange={handleCsv('signals')} />
				</label>
				<button onClick={save} disabled={saving}>
					{saving ? 'Saving…' : 'Save ICP'}
				</button>
			</div>
		</div>
	);
}


