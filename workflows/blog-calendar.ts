import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const CalendarSchema = v.object({
	months: v.array(
		v.object({
			name: v.string(),
			theme: v.string(),
			posts: v.array(
				v.object({
					topic: v.string(),
					type: v.string(),
					targetDate: v.string(),
					cluster: v.string(),
					keywords: v.array(v.string()),
				}),
			),
		}),
	),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const niche =
		typeof payload === 'object' && payload !== null && 'niche' in payload
			? String(payload.niche)
			: '';
	const cadenceRaw =
		typeof payload === 'object' && payload !== null && 'cadence' in payload
			? String(payload.cadence)
			: 'weekly';
	const cadence = ['daily', 'weekly', 'biweekly', 'monthly'].includes(cadenceRaw)
		? cadenceRaw
		: 'weekly';

	if (!niche) {
		throw new Error('A niche is required. Pass {"niche": "..."} as payload.');
	}

	// ── Phase 1: Content strategy analysis ─────────────────────────────────
	const r = await init(writer, { name: 'calendar-strategy' });
	const strategySession = await r.session('calendar-strategy');
	const strategy = await strategySession.prompt(
		`Analyze content decay patterns and seasonal opportunities for the "${niche}" niche.

		Identify:
		- Which types of content typically decay fastest in this niche
		- Seasonal topics and events relevant to this niche for the next 3 months
		- Evergreen content opportunities that need periodic updates
		- Cluster planning: how to group related topics into content clusters

		Return your analysis as structured findings.`,
		{
			result: v.object({
				decayPatterns: v.array(v.string()),
				seasonalTopics: v.array(
					v.object({
						month: v.string(),
						topics: v.array(v.string()),
					}),
				),
				evergreenOpportunities: v.array(v.string()),
				clusterSuggestions: v.array(v.string()),
			}),
		},
	);

	// ── Phase 2: Generate editorial calendar ──────────────────────────────
	const w = await init(writer, { name: 'generate-calendar' });
	const calendarSession = await w.session('generate-calendar');
	const calendar = await calendarSession.prompt(
		`Create a 3-month editorial calendar for the "${niche}" niche.

		## Cadence
		- Publishing cadence: ${cadence}
		- ${cadence === 'daily' ? '5 posts per week' : cadence === 'weekly' ? '1 post per week' : cadence === 'biweekly' ? '1 post every 2 weeks' : '1 post per month'}

		## Strategy Input
		- Content decay patterns: ${JSON.stringify(strategy.data.decayPatterns)}
		- Seasonal topics: ${JSON.stringify(strategy.data.seasonalTopics)}
		- Evergreen opportunities: ${JSON.stringify(strategy.data.evergreenOpportunities)}
		- Cluster suggestions: ${JSON.stringify(strategy.data.clusterSuggestions)}

		## Requirements
		1. Each month must have a clear theme tying the posts together
		2. Mix of post types: how-to guides, listicles, opinion pieces, case studies, data-driven posts, interviews
		3. Assign each post to a content cluster
		4. Set target dates (ISO format: YYYY-MM-DD) spread evenly according to cadence
		5. Include primary keywords for each post
		6. Align with seasonal events and industry trends
		7. Leave room for timely/trending content (max 20% of slots)
		8. Ensure no two posts in the same week target the same cluster`,
		{ result: CalendarSchema },
	);

	return {
		calendar: {
			months: calendar.data.months,
		},
	};
}
