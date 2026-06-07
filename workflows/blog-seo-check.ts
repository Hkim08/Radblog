import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import { defineAgentProfile, createAgent } from '@flue/runtime';
import type { FlueContext } from '@flue/runtime';

// ─── Inline SEO Agent ───────────────────────────────────────────────────────

const seoProfile = defineAgentProfile({
	name: 'blog-seo-check',
	instructions: `You are an SEO validation specialist. You check blog posts against 9 SEO categories and return a structured pass/fail report.

## Categories
1. **Title Tag**: 40-60 chars, keyword in first half, power word present
2. **Meta Description**: 150-160 chars, contains statistic, value proposition, keyword
3. **Heading Hierarchy**: Single H1, no skipped levels, keyword in 2-3 headings, 60-70% H2s as questions
4. **Internal Links**: 3-10 internal links, descriptive anchor text, distributed across post
5. **External Links**: Links to tier 1-3 sources, at least 3 outbound, no broken links
6. **Canonical URL**: Defined, absolute, self-referencing
7. **OG Meta Tags**: og:title, og:description, og:image (1200x630), og:type="article", og:url
8. **Twitter Card**: twitter:card="summary_large_image", twitter:title, twitter:description
9. **URL Structure**: Under 75 chars, keyword in slug, no dates, lowercase, no special chars`,
});

const seo = createAgent(({ id }) => ({
	model: 'opencode-zen/big-pickle',
	profile: seoProfile,
}));

export { seo };
export default seo;

// ─── Schemas ────────────────────────────────────────────────────────────────

const FixSchema = v.object({
	category: v.string(),
	description: v.string(),
	priority: v.string(),
});

const CheckSchema = v.object({
	category: v.string(),
	passed: v.boolean(),
	details: v.string(),
	fix: v.optional(v.string()),
});

const SeoResultSchema = v.object({
	checks: v.array(CheckSchema),
	passed: v.number(),
	failed: v.number(),
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

	// ── Phase 1: Read file ───────────────────────────────────────────────────
	const fileContent = await read(path);

	// ── Phase 2: SEO check ───────────────────────────────────────────────────
	const s = await init(seo, { name: 'blog-seo-check' });
	const session = await s.session('seo-check');
	const result = await session.prompt(
		`Validate the following blog post against 9 SEO categories.

		For each category, return:
		- category: name of the category
		- passed: boolean (true if all checks in this category pass)
		- details: what was checked and the findings
		- fix: if failed, a specific actionable fix

		Also provide a prioritized list of fixes.

		## File: ${path}

		${fileContent}

		Return the results in the expected structured format.`,
		{ result: SeoResultSchema },
	);

	return {
		checks: result.data.checks,
		passed: result.data.passed,
		failed: result.data.failed,
	};
}

async function read(filePath: string): Promise<string> {
	return await readFile(filePath, 'utf-8');
}
