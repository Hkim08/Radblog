import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { researcher } from '../agents/researcher.ts';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const CompetitorResearchSchema = v.object({
	nicheOverlap: v.string(),
	competitors: v.array(
		v.object({
			name: v.string(),
			domain: v.string(),
			strengths: v.array(v.string()),
			weaknesses: v.array(v.string()),
			contentStrategy: v.string(),
		}),
	),
	marketPosition: v.string(),
});

const AudienceAnalysisSchema = v.object({
	segments: v.array(
		v.object({
			name: v.string(),
			demographics: v.string(),
			needs: v.array(v.string()),
			contentPreferences: v.array(v.string()),
		}),
	),
	primaryPersona: v.string(),
});

const PillarPlanSchema = v.object({
	pillars: v.array(
		v.object({
			topic: v.string(),
			keywords: v.array(v.string()),
			clusterCount: v.number(),
		}),
	),
	contentPlan: v.array(
		v.object({
			pillar: v.string(),
			title: v.string(),
			type: v.string(),
			priority: v.string(),
		}),
	),
	gaps: v.array(v.string()),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const niche =
		typeof payload === 'object' && payload !== null && 'niche' in payload
			? String(payload.niche)
			: '';
	const competitors =
		typeof payload === 'object' &&
		payload !== null &&
		'competitors' in payload &&
		Array.isArray(payload.competitors)
			? payload.competitors.map(String)
			: [];

	if (!niche) {
		throw new Error('A niche is required. Pass {"niche": "..."} as payload.');
	}

	// ── Phase 1: Competitive research ─────────────────────────────────────
	const r = await init(researcher, { name: 'competitive-research' });
	const crSession = await r.session('competitive-research');
	const competitorResearch = await crSession.prompt(
		`Research the niche "${niche}" for blog content strategy.

		${competitors.length > 0 ? `Known competitors: ${competitors.join(', ')}.` : ''}

		Find:
		- 3-6 main competitors in this niche with their domain names
		- Their key strengths and weaknesses
		- Their content strategy approach
		- Market position and niche overlap analysis

		Return the results in the expected structured format.`,
		{ result: CompetitorResearchSchema },
	);

	// ── Phase 2: Audience analysis ────────────────────────────────────────
	const a = await init(researcher, { name: 'audience-analysis' });
	const audSession = await a.session('audience-analysis');
	const audienceAnalysis = await audSession.prompt(
		`Analyze the target audience for the "${niche}" niche.

		Competitive landscape: ${competitorResearch.data.marketPosition}

		Find:
		- 2-4 audience segments with demographics
		- Key needs and pain points for each segment
		- Content format and channel preferences
		- Primary buyer persona definition

		Return the results in the expected structured format.`,
		{ result: AudienceAnalysisSchema },
	);

	// ── Phase 3: Pillar and cluster design ────────────────────────────────
	const w = await init(writer, { name: 'pillar-design' });
	const planSession = await w.session('pillar-design');
	const plan = await planSession.prompt(
		`Create a pillar-cluster content strategy for the "${niche}" niche.

		## Context
		- Audience segments: ${JSON.stringify(audienceAnalysis.data.segments.map((s: { name: string }) => s.name))}
		- Primary persona: ${audienceAnalysis.data.primaryPersona}
		- Competitors: ${JSON.stringify(competitorResearch.data.competitors.map((c: { name: string }) => c.name))}

		## Requirements
		Design 3-5 content pillars with:
		1. Each pillar topic (broad, authoritative topic covering a core aspect of the niche)
		2. 5-8 related keywords per pillar for cluster content
		3. Suggested cluster count (number of supporting posts)
		4. A content plan with specific post titles, content types, and priorities
		5. Content gaps: topics competitors cover but we are missing, or entirely new angles`,
		{ result: PillarPlanSchema },
	);

	return {
		strategy: {
			pillars: plan.data.pillars,
			contentPlan: plan.data.contentPlan,
			gaps: plan.data.gaps,
		},
	};
}
