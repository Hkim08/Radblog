import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const SectionSchema = v.object({
	heading: v.string(),
	wordCount: v.number(),
	type: v.string(),
	keyStat: v.optional(v.string()),
});

const OutlineDataSchema = v.object({
	title: v.string(),
	metaDescription: v.string(),
	sections: v.array(SectionSchema),
	faqItems: v.array(
		v.object({
			question: v.string(),
			answer: v.string(),
		}),
	),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const topic =
		typeof payload === 'object' && payload !== null && 'topic' in payload
			? String(payload.topic)
			: '';

	if (!topic) {
		throw new Error(
			'A topic is required. Pass {"topic": "..."} as payload.',
		);
	}

	const keyword =
		typeof payload === 'object' && payload !== null && 'keyword' in payload
			? String(payload.keyword)
			: topic;

	// ── Phase 1: Generate outline ────────────────────────────────────────────
	const o = await init(writer, { name: 'blog-outline-gen' });
	const session = await o.session('outline');
	const result = await session.prompt(
		`Create a SERP-informed blog outline for the topic "${topic}".

		## Primary Keyword
		${keyword}

		## Requirements
		- 6-8 H2 sections, 60-70% phrased as questions
		- One H1 only (the title)
		- Title under 60 characters, front-loaded keyword
		- Meta description 150-160 characters with a statistic
		- FAQ section with 3-5 items
		- Each section should have a target word count and type (how-to, list, comparison, deep-dive)
		- Include a key statistic or data point suggestion per section where relevant

		Return the results in the expected structured format.`,
		{ result: OutlineDataSchema },
	);

	return { outline: result.data };
}
