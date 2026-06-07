import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { researcher } from '../agents/researcher.ts';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const KeywordResearchSchema = v.object({
	keywords: v.array(
		v.object({
			keyword: v.string(),
			searchVolume: v.string(),
			difficulty: v.string(),
			intent: v.string(),
		}),
	),
	trends: v.array(
		v.object({
			term: v.string(),
			direction: v.string(),
			velocity: v.string(),
		}),
	),
});

const CompetitorAnalysisSchema = v.object({
	competitors: v.array(
		v.object({
			name: v.string(),
			topPost: v.string(),
			gaps: v.array(v.string()),
		}),
	),
	opportunities: v.array(v.string()),
});

const BriefSchema = v.object({
	title: v.string(),
	audience: v.string(),
	competitors: v.array(v.string()),
	statistics: v.array(
		v.object({
			value: v.string(),
			source: v.string(),
		}),
	),
	sections: v.array(
		v.object({
			heading: v.string(),
			focusPoints: v.array(v.string()),
		}),
	),
	instructions: v.array(v.string()),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const topic =
		typeof payload === 'object' && payload !== null && 'topic' in payload
			? String(payload.topic)
			: '';
	const keyword =
		typeof payload === 'object' && payload !== null && 'keyword' in payload
			? String(payload.keyword)
			: undefined;
	const audience =
		typeof payload === 'object' && payload !== null && 'audience' in payload
			? String(payload.audience)
			: undefined;

	if (!topic) {
		throw new Error('A topic is required. Pass {"topic": "..."} as payload.');
	}

	// ── Phase 1: Keyword research ──────────────────────────────────────────
	const r = await init(researcher, { name: 'keyword-research' });
	const kwSession = await r.session('keyword-research');
	const keywords = await kwSession.prompt(
		`Research keywords for the topic "${topic}"${keyword ? `, focusing on the key term "${keyword}"` : ''}.

		Find 5-8 primary and related keywords with:
		- Search volume estimates
		- Keyword difficulty scores
		- Search intent (informational, commercial, navigational, transactional)
		- Trending subtopics and their trajectory

		Return the results in the expected structured format.`,
		{ result: KeywordResearchSchema },
	);

	// ── Phase 2: Competitor analysis ──────────────────────────────────────
	const c = await init(researcher, { name: 'competitor-analysis' });
	const compSession = await c.session('competitor-analysis');
	const competitors = await compSession.prompt(
		`Analyze the top-ranking competitors for "${topic}".

		Identify 3-5 main competitors:
		- Their top-performing post for this topic
		- Content gaps they are not covering
		- Market opportunities for differentiation
		${audience ? `Target audience: ${audience}` : ''}

		Return the results in the expected structured format.`,
		{ result: CompetitorAnalysisSchema },
	);

	// ── Phase 3: Generate brief ───────────────────────────────────────────
	const w = await init(writer, { name: 'generate-brief' });
	const briefSession = await w.session('generate-brief');
	const brief = await briefSession.prompt(
		`Create a comprehensive content brief for topic "${topic}".

		## Context
		- Target audience: ${audience || 'General / broad interest'}
		- Primary keywords: ${JSON.stringify(keywords.data.keywords.map((k: { keyword: string }) => k.keyword))}
		- Competitors: ${JSON.stringify(competitors.data.competitors.map((c: { name: string }) => c.name))}

		## Requirements
		Include:
		1. An SEO-optimized title (under 60 characters) targeting the primary keyword
		2. Target audience definition with demographics and psychographics
		3. Competitor list with differentiation angles for each
		4. 5-7 key statistics with tier 1-3 sources that must be cited in the post
		5. 5-7 sections with heading suggestions and focus points for each
		6. Writing instructions: tone, style, formatting, and SEO requirements`,
		{ result: BriefSchema },
	);

	return {
		brief: {
			title: brief.data.title,
			audience: brief.data.audience,
			competitors: brief.data.competitors,
			statistics: brief.data.statistics,
			sections: brief.data.sections,
			instructions: brief.data.instructions,
		},
	};
}
