import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import { defineAgentProfile, createAgent } from '@flue/runtime';
import type { FlueContext } from '@flue/runtime';

// ─── Inline Locale Auditor Agent ────────────────────────────────────────────

const localeAuditorProfile = defineAgentProfile({
	name: 'blog-locale-auditor',
	instructions: `You audit multilingual blog content for completeness, consistency, correct tagging, and SEO optimization.

## Audit Checks
1. **Translation Coverage**: Which posts exist in which languages
2. **Content Parity**: Section count, FAQ count, image count, word count ratio across languages
3. **SEO Parity**: Title tag, meta description, lang attribute, schema inLanguage, alt text, slug, tags, keywords
4. **Hreflang Audit**: Self-referencing, return tags, x-default, language codes, URL consistency
5. **Freshness Audit**: Source updated after translation, translation older than 90 days, lastUpdated mismatch

## Scoring
- Overall health score 0-100
- Critical issues and warnings with file references`,
});

const localeAuditor = createAgent(({ id }) => ({
	model: 'opencode-zen/big-pickle',
	profile: localeAuditorProfile,
}));

export { localeAuditor };
export default localeAuditor;

// ─── Schemas ────────────────────────────────────────────────────────────────

const IssueSchema = v.object({
	severity: v.string(),
	check: v.string(),
	file: v.string(),
	detail: v.string(),
});

const FixSchema = v.object({
	priority: v.string(),
	action: v.string(),
	command: v.optional(v.string()),
});

const LocaleAuditResultSchema = v.object({
	coverage: v.object({
		total: v.number(),
		present: v.number(),
		percent: v.number(),
		missing: v.array(v.string()),
	}),
	issues: v.array(IssueSchema),
	fixes: v.array(FixSchema),
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

	// ── Phase 1: Read the target file ────────────────────────────────────────
	const fileContent = await readFile(path, 'utf-8');

	// ── Phase 2: Run locale audit ────────────────────────────────────────────
	const a = await init(localeAuditor, { name: 'blog-locale-audit' });
	const session = await a.session('locale-audit');
	const result = await session.prompt(
		`Run a comprehensive locale audit on the following blog post.

		Run the following 5 parallel audit checks:
		1. Translation Coverage — assess what languages are present
		2. Content Parity — section count, FAQ count, image count consistency
		3. SEO Parity — title tag, meta description, lang, schema, alt text
		4. Hreflang Audit — self-referencing, return tags, x-default
		5. Freshness Audit — translation staleness, lastUpdated mismatches

		Return:
		- coverage: total posts, present count, completion percent, missing items
		- issues: array of { severity, check, file, detail }
		- fixes: array of { priority, action, command? }

		## File: ${path}

		${fileContent}`,
		{ result: LocaleAuditResultSchema },
	);

	return result.data;
}
