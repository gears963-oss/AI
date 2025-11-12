import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { scoreProspect } from './scoring';
import { summarizeProspect, enrichProspect } from './llm';
import type { Prospect, ScoreResult, ICP, Features } from '@shared/types';

const app = express();
app.use(cors());
app.use(express.json());

const ProspectSchema = z.object({
	name: z.string().optional(),
	role: z.string().optional(),
	company: z.string().optional(),
	sector: z.string().optional(),
	sourceUrl: z.string().url().optional(),
	notes: z.string().optional()
}) as z.ZodType<Partial<Prospect>>;

app.get('/health', (_req, res) => {
	res.json({ ok: true });
});

const ScoreBodySchema = z.object({
	prospect: ProspectSchema.default({}).optional(),
	features: z
		.object({
			country: z.string().optional(),
			sectorText: z.string().optional(),
			employeeCount: z.number().optional(),
			websiteUrl: z.string().optional(),
			technologies: z.array(z.string()).optional(),
			googleRating: z.number().optional(),
			textBlob: z.string().optional()
		})
		.optional(),
	icp: z
		.object({
			country: z.string().optional(),
			sectors: z.array(z.string()).optional(),
			sizeMin: z.number().optional(),
			sizeMax: z.number().optional(),
			roles: z.array(z.string()).optional(),
			excludes: z.array(z.string()).optional(),
			signals: z.array(z.string()).optional(),
			googleRatingMax: z.number().optional()
		})
		.optional()
});

app.post('/score', (req, res) => {
	const parsed = ScoreBodySchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.flatten() });
	}
	// Map legacy prospect fields into features when explicit features not provided
	let features: Features | undefined = parsed.data.features as Features | undefined;
	if (!features && parsed.data.prospect) {
		const p = parsed.data.prospect as Partial<Prospect>;
		features = {
			sectorText: p.sector,
			websiteUrl: p.sourceUrl
		};
	}
	const result: ScoreResult = scoreProspect(parsed.data.icp as ICP | undefined, features);
	res.json(result);
});

app.post('/enrich', async (req, res) => {
	const parsed = ProspectSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.flatten() });
	}
	try {
		const enriched = await enrichProspect(parsed.data);
		res.json(enriched);
	} catch (e: any) {
		res.status(500).json({ error: e?.message || 'enrich error' });
	}
});

const SummarizeBodySchema = z.object({
	features: z
		.object({
			country: z.string().optional(),
			sectorText: z.string().optional(),
			employeeCount: z.number().optional(),
			websiteUrl: z.string().optional(),
			technologies: z.array(z.string()).optional(),
			googleRating: z.number().optional(),
			textBlob: z.string().optional()
		})
		.optional(),
	icp: z
		.object({
			country: z.string().optional(),
			sectors: z.array(z.string()).optional(),
			sizeMin: z.number().optional(),
			sizeMax: z.number().optional(),
			roles: z.array(z.string()).optional(),
			excludes: z.array(z.string()).optional(),
			signals: z.array(z.string()).optional(),
			googleRatingMax: z.number().optional()
		})
		.optional()
});

app.post('/summarize', async (req, res) => {
	const parsed = SummarizeBodySchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.flatten() });
	}
	try {
		const summary = await summarizeProspect(parsed.data.features ?? {}, parsed.data.icp);
		res.json({ summary });
	} catch (e: any) {
		res.status(500).json({ error: e?.message || 'summarize error' });
	}
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`[digit-plan] api listening on http://localhost:${port}`);
});


