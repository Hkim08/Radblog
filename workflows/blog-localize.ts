import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import { defineAgentProfile, createAgent } from '@flue/runtime';
import type { FlueContext } from '@flue/runtime';

// ─── Inline Localizer Agent ─────────────────────────────────────────────────

const localizerProfile = defineAgentProfile({
	name: 'blog-localizer',
	instructions: `You perform cultural deep-adaptation of translated blog posts. The result must feel like it was written for the target market, not translated into it.

## Adaptation Areas
1. **Brand examples**: Swap US/UK brands for local equivalents (Walmart → MediaMarkt for DACH, Carrefour for FR)
2. **Statistics**: Replace with local data when available; keep original with geographic scope note if not
3. **CTAs**: Adjust aggressiveness per culture (DACH/JP prefer informational, US imperative)
4. **Idioms**: Replace literally translated English expressions with natural local equivalents
5. **Legal references**: CCPA → DSGVO (DE), RGPD (FR), LGPD (BR)
6. **Tone**: Match local formality conventions
7. **Cultural references**: Foreign holidays, events, customs → local equivalents

## Quality Verification
- All critical adaptation targets addressed
- Tone is consistent throughout
- No remaining foreign-origin markers
- Statistics have valid sources (original or localized)
- CTAs match cultural expectations
- Content still supports the same argument as the original`,
});

const localizer = createAgent(({ id }) => ({
	model: 'opencode-zen/big-pickle',
	profile: localizerProfile,
}));

export { localizer };
export default localizer;

// ─── Schemas ────────────────────────────────────────────────────────────────

const AdaptationSchema = v.object({
	type: v.string(),
	count: v.number(),
	examples: v.array(v.string()),
});

const LocalizeScoresSchema = v.object({
	naturalness: v.number(),
	marketRelevance: v.number(),
	toneMatch: v.number(),
	overall: v.number(),
});

const LocalizeResultSchema = v.object({
	adaptations: v.array(AdaptationSchema),
	scores: LocalizeScoresSchema,
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

	const locale =
		typeof payload === 'object' && payload !== null && 'locale' in payload
			? String(payload.locale)
			: '';

	if (!locale) {
		throw new Error(
			'A locale is required. Pass {"locale": "de-DE"} as payload.',
		);
	}

	// ── Phase 1: Read file ───────────────────────────────────────────────────
	const fileContent = await readFile(path, 'utf-8');

	// ── Phase 2: Cultural adaptation ─────────────────────────────────────────
	const l = await init(localizer, { name: 'blog-localize' });
	const session = await l.session('localize');
	const result = await session.prompt(
		`Perform cultural deep-adaptation of the following blog post for locale: ${locale}.

		## Adaptation Areas to Audit & Fix
		1. Brand examples — identify foreign brands, suggest local equivalents
		2. Statistics sources — check if from local market, flag if foreign-only
		3. CTA tone — adjust per cultural norms
		4. Idioms — find literally translated expressions, make natural
		5. Legal references — replace foreign laws with local equivalents
		6. Cultural references — swap holidays, events, customs
		7. Tone — calibrate formality (Sie/du, vous/tu, formal/informal)
		8. Currency & pricing — localize if present

		For each adaptation type, report count of changes and specific examples.

		Score the result on:
		- Naturalness (1-10): reads like originally written in this locale
		- Market relevance (1-10): examples and references resonate locally
		- Tone match (1-10): formality and register are appropriate
		- Overall (sum)

		## File: ${path}

		${fileContent}

		Return the results in the expected structured format.`,
		{ result: LocalizeResultSchema },
	);

	return result.data;
}
