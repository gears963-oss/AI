import { describe, it, expect } from 'vitest';
import { buildIcpSummaryPrompt, summarizeProspect, type LLMClient } from './llm';

class MockLLM implements LLMClient {
	constructor(private response: string) {}
	async complete(): Promise<string> {
		return this.response;
	}
}

describe('buildIcpSummaryPrompt', () => {
	it('includes ICP criteria and features', () => {
		const prompt = buildIcpSummaryPrompt(
			{ country: 'FR', sectorText: 'ecommerce', employeeCount: 120, technologies: ['Shopify'] },
			{ country: 'FR', sectors: ['retail'], sizeMin: 10, sizeMax: 200, signals: ['shopify'], googleRatingMax: 4.2 }
		);
		expect(prompt).toMatch(/Pays: FR/);
		expect(prompt).toMatch(/ecommerce/);
		expect(prompt).toMatch(/Shopify/);
	});
});

describe('summarizeProspect', () => {
	it('returns exactly 3 bullets when LLM provides more', async () => {
		const llm = new MockLLM(['- a', '- b', '- c', '- d'].join('\n'));
		const summary = await summarizeProspect({}, undefined, llm);
		const lines = summary.split('\n');
		expect(lines.length).toBe(3);
		expect(lines[0]).toBe('- a');
	});
	it('pads to 3 bullets when LLM provides fewer', async () => {
		const llm = new MockLLM('- only one');
		const summary = await summarizeProspect({}, undefined, llm);
		const lines = summary.split('\n');
		expect(lines.length).toBe(3);
	});
});


