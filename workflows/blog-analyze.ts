import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import type { FlueContext } from '@flue/runtime';
import { reviewer } from '../agents/reviewer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const CategoriesSchema = v.object({
	contentQuality: v.number(),
	seoOptimization: v.number(),
	eeatSignals: v.number(),
	technicalElements: v.number(),
	aiCitationReadiness: v.number(),
});

const AiDetectionSchema = v.object({
	burstiness: v.number(),
	aiPhrasesFound: v.array(v.string()),
	vocabularyTTR: v.number(),
	aiProbability: v.number(),
});

const IssueSchema = v.object({
	severity: v.string(),
	location: v.string(),
	fix: v.string(),
});

const AnalyzeResultSchema = v.object({
	file: v.string(),
	overall: v.number(),
	categories: CategoriesSchema,
	rating: v.string(),
	aiDetection: AiDetectionSchema,
	issues: v.array(IssueSchema),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const path =
		typeof payload === 'object' && payload !== null && 'path' in payload
			? String(payload.path)
			: '';

	if (!path) {
		throw new Error(
			'A file path is required. Pass {"path": "..."} as payload.',
		);
	}

	// ── Phase 1: Read file ───────────────────────────────────────────────────
	const fileContent = await read(path);

	// ── Phase 2: Analyze ─────────────────────────────────────────────────────
	const r = await init(reviewer, { name: 'blog-analyze-review' });
	const session = await r.session('analyze');
	const result = await session.prompt(
		`Audit and score the following blog post using the blog-analyze quality system.

		Score the post on a 0-100 scale across 5 categories:
		1. Content Quality (30 pts): Depth, readability, originality, structure, engagement, grammar
		2. SEO Optimization (25 pts): Title, meta description, headings, links, URL
		3. E-E-A-T Signals (15 pts): Author attribution, source citations, trust, experience
		4. Technical Elements (15 pts): Schema, images, structured data, page speed, OG tags
		5. AI Citation Readiness (15 pts): Passage citability, Q&A format, entity clarity, structure

		Also perform AI content detection:
		- Burstiness (sentence length variance, target SD > 6)
		- Known AI phrases detection
		- Vocabulary diversity (type-token ratio, target > 0.50)

		Return the results in the expected structured format.

		## File: ${path}

		${fileContent}`,
		{ result: AnalyzeResultSchema },
	);

	return result.data;
}

async function read(filePath: string): Promise<string> {
	return await readFile(filePath, 'utf-8');
}
