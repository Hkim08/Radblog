import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import type { FlueContext } from '@flue/runtime';
import { reviewer } from '../agents/reviewer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const CategoryScoreSchema = v.object({
	name: v.string(),
	raw: v.number(),
	display: v.number(),
	max: v.number(),
});

const PlatformScoreSchema = v.object({
	platform: v.string(),
	rating: v.string(),
	recommendations: v.array(v.string()),
});

const CapsuleSchema = v.object({
	section: v.string(),
	capsule: v.string(),
});

const GeoResultSchema = v.object({
	score: v.number(),
	categories: v.array(CategoryScoreSchema),
	platforms: v.array(PlatformScoreSchema),
	capsules: v.array(CapsuleSchema),
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
	const fileContent = await readFile(path, 'utf-8');

	// ── Phase 2: Audit AI citation readiness ─────────────────────────────────
	const r = await init(reviewer, { name: 'blog-geo-audit' });
	const session = await r.session('geo-audit');
	const result = await session.prompt(
		`Perform a 10-step AI citation readiness audit on the following blog post.

		Score the post across these categories and map to a 0-100 display score:

		1. Passage-Level Citability (raw /4, display /27): Check each section for 120-180 word self-contained passages
		2. Q&A Formatting (raw /3, display /20): 60-70% question headings, answer-first format, FAQ section
		3. Entity Clarity (raw /3, display /20): Canonical topic, consistent naming, intro statement
		4. Content Structure (raw /3, display /20): TL;DR, comparison tables, ordered lists, definitions, citation capsules
		5. AI Crawler Accessibility (raw /2, display /13): Static HTML, robots.txt, schema in HTML

		For each platform (ChatGPT, Perplexity, Google AI Overviews), rate citability (High/Medium/Low) and give recommendations.

		Generate one citation capsule (40-60 words, self-contained, quotable) for each H2 section.

		## File: ${path}

		${fileContent}

		Return the results in the expected structured format.`,
		{ result: GeoResultSchema },
	);

	return result.data;
}
