import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { writeFile } from 'node:fs/promises';
import { researcher } from '../agents/researcher.ts';
import { writer } from '../agents/writer.ts';
import { reviewer } from '../agents/reviewer.ts';


// ─── Schemas (valibot, for prompt result validation) ─────────────────────────

const ResearchSchema = v.object({
	statistics: v.array(
		v.object({
			value: v.string(),
			source: v.string(),
			url: v.string(),
			tier: v.number(),
			verified: v.boolean(),
		}),
	),
	images: v.array(
		v.object({
			url: v.string(),
			altText: v.string(),
			platform: v.string(),
		}),
	),
	competitiveGaps: v.array(
		v.object({
			competitor: v.string(),
			gap: v.string(),
			significance: v.string(),
		}),
	),
	additionalNotes: v.optional(v.string()),
});

const OutlineSchema = v.object({
	title: v.string(),
	metaDescription: v.string(),
	sections: v.array(
		v.object({
			heading: v.string(),
			wordCount: v.number(),
			type: v.string(),
			keyStat: v.optional(v.string()),
		}),
	),
	faqItems: v.array(v.string()),
});

const ArticleSchema = v.object({
	content: v.string(),
	wordCount: v.number(),
	sections: v.number(),
	imagesEmbedded: v.number(),
	chartsEmbedded: v.number(),
	faqPresent: v.boolean(),
});

const QualitySchema = v.object({
	overall: v.number(),
	categories: v.object({
		contentQuality: v.number(),
		seoOptimization: v.number(),
		eeatSignals: v.number(),
		technicalElements: v.number(),
		aiCitationReadiness: v.number(),
	}),
	rating: v.union([
		v.literal('exceptional'),
		v.literal('strong'),
		v.literal('acceptable'),
		v.literal('belowStandard'),
		v.literal('rewrite'),
	]),
	issues: v.array(
		v.object({
			severity: v.string(),
			location: v.string(),
			fix: v.string(),
		}),
	),
	aiDetection: v.optional(
		v.object({
			burstiness: v.number(),
			aiPhrasesFound: v.array(v.string()),
			vocabularyTTR: v.number(),
			aiProbability: v.number(),
		}),
	),
});

// ─── Workflow ─────────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const topic =
		typeof payload === 'object' && payload !== null && 'topic' in payload
			? String(payload.topic)
			: '';
	const platform =
		typeof payload === 'object' && payload !== null && 'platform' in payload
			? String(payload.platform)
			: 'markdown';

	if (!topic) {
		throw new Error('A topic is required. Pass {\"topic\": \"...\"} as payload.');
	}

	// ── Phase 1: Research ──────────────────────────────────────────────────
	const r = await init(researcher, { name: 'research' });
	const researchSession = await r.session('research');
	const research = await researchSession.prompt(
		`Research the topic "${topic}" for a blog post.

		Find:
		- 8-12 current statistics with tier 1-3 sources (verify each source)
		- 3-5 relevant images from Pixabay or Unsplash
		- Competitive gaps in the top-ranking content

		For every statistic, verify it appears on the source page before including it.
		Reject tier 4-5 sources (content mills, unsourced listicles, affiliate sites).

		Return the results in the expected structured format.`,
		{ result: ResearchSchema },
	);

	// ── Phase 2: Outline ───────────────────────────────────────────────────
	const o = await init(writer, { name: 'outline' });
	const outlineSession = await o.session('outline');
	const outline = await outlineSession.prompt(
		`Create a detailed outline for a blog post titled "${topic}".

		Available statistics:
		${JSON.stringify(research.data.statistics, null, 2)}

		Requirements:
		- 6-8 H2 sections, 60-70% phrased as questions
		- One H1 only (the title)
		- FAQ section with 3-5 items
		- Each section should feature at least one statistic from the research
		- Title under 60 characters, meta description 150-160 chars with a statistic`,
		{ result: OutlineSchema },
	);

	// ── Phase 3: Write ─────────────────────────────────────────────────────
	const w = await init(writer, { name: 'write' });
	const writeSession = await w.session('write');
	const article = await writeSession.prompt(
		`Write the full blog post "${topic}" in ${platform} format.

		## Outline to follow:
		${JSON.stringify(outline.data, null, 2)}

		## Research data to use:
		${JSON.stringify(research.data, null, 2)}

		## Style Requirements:
		- Every H2 opens with a statistic + source (40-60 words)
		- No paragraph exceeds 150 words
		- All statistics have named tier 1-3 sources
		- 60-70% of H2s as questions
		- Max 1 brand mention
		- FAQ section at the end (3-5 items)
		- Key Takeaways box after introduction
		- Citation capsules in each H2 section (40-60 words, self-contained)
		- Internal link zones: [INTERNAL-LINK: anchor → target]
		- Chart markers: [CHART: type - data - source]
		- Image markers: [IMAGE: description]
		- Anti-AI patterns: no em dashes, varied sentence length, contractions, hedging
		- Include information gain markers: [ORIGINAL DATA], [PERSONAL EXPERIENCE], [UNIQUE INSIGHT]
		- Include a TL;DR box after the introduction`,
		{ result: ArticleSchema },
	);

	// ── Phase 4: Write to file ─────────────────────────────────────────────
	const slug = topic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	const ext = platform === 'html' ? 'html' : 'md';
	const filePath = `./workspace/${slug}.${ext}`;
	await writeFile(filePath, article.data.content, 'utf-8');

	// ── Phase 5: Quality gate ──────────────────────────────────────────────
	const rv = await init(reviewer, { name: 'review' });
	const reviewSession = await rv.session('review');
	const quality = await reviewSession.prompt(
		`Score the following blog post for quality:\n\n${article.data.content}`,
		{ result: QualitySchema },
	);

	return {
		path: filePath,
		score: quality.data.overall,
		rating: quality.data.rating,
		wordCount: article.data.wordCount,
		sections: article.data.sections,
		statsUsed: research.data.statistics.length,
		imagesIncluded: article.data.imagesEmbedded,
		chartsIncluded: article.data.chartsEmbedded,
		issueCount: quality.data.issues.length,
		categories: quality.data.categories,
		aiDetection: quality.data.aiDetection,
	};
}
