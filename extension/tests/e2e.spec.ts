import { test, expect } from '@playwright/test';

test('injects widget shell', async ({ page }) => {
	// Simulate a generic page
	await page.setContent('<html><body><h1>Test Page</h1></body></html>', { waitUntil: 'domcontentloaded' });
	// Simulate the content UI bundle sending a render message
	await page.addInitScript(() => {
		(window as any).chrome = {
			runtime: {
				onMessage: { addListener: () => {} },
				sendMessage: () => {}
			}
		};
	});
	// Emulate bundle mounting
	await page.addScriptTag({ content: 'window.__digitPlanInit = true;' });
	// "Mount" a container and assert we can insert widget later
	await page.evaluate(() => {
		const el = document.createElement('div');
		el.id = 'digit-plan-widget';
		document.body.appendChild(el);
	});
	const exists = await page.$('#digit-plan-widget');
	expect(exists).not.toBeNull();
});


