import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { readFile, writeFile } from 'node:fs/promises';
import { researcher } from '../agents/researcher.ts';
import { writer } from '../agents/writer.ts';
import { reviewer } from '../agents/reviewer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const AuditSchema = v.object({
	score: v.number(),
	issues: v.array(
		v.object({
			severity: v.string(),
			location: v.string(),
			description: v.string(),
		}),
	),
	missingData: v.array(v.string()),
	outdatedStats: v.array(v.string()),
	seoIssues: v.array(v.string()),
});

const UpdatedResearchSchema = v.object({
	statistics: v.array(
		v.object({
			value: v.string(),
			source: v.string(),
			url: v.string(),
			tier: v.number(),
			verified: v.boolean(),
		}),
	),
	competitiveGaps: v.array(
		v.object({
			competitor: v.string(),
			gap: v.string(),
			significance: v.string(),
		}),
	),
});

const RewriteSchema = v.object({
	content: v.string(),
	changes: v.array(v.string()),
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
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const path =
		typeof payload === 'object' && payload !== null && 'path' in payload
			? String(payload.path)
			: '';
	const platform =
		typeof payload === 'object' && payload !== null && 'platform' in payload
			? String(payload.platform)
			: 'markdown';

	if (!path) {
		throw new Error('A file path is required. Pass {"path": "..."} as payload.');
	}

	// ── Phase 1: Read and audit current content ───────────────────────────
	const r = await init(reviewer, { name: 'audit-current' });
	const auditSession = await r.session('audit-current');

	let currentContent: string;
	try {
		currentContent = await readFile(path, 'utf-8');
	} catch {
		throw new Error(`Could not read file at "${path}". Check that the path exists and is readable.`);
	}

	const audit = await auditSession.prompt(
		`Audit the following blog content for quality, accuracy, and SEO:

		--- File: ${path} ---
		${currentContent}

		Score the content thoroughly:
		1. Identify outdated statistics and data that needs replacement
		2. Find missing data, sources, or citations
		3. Note SEO issues (title, meta, headings, keywords)
		4. Identify structural and readability problems
		5. Assign an overall quality score (0-100)`,
		{ result: AuditSchema },
	);

	const scoreBefore = audit.data.score;

	// ── Phase 2: Research updated data ────────────────────────────────────
	const rs = await init(researcher, { name: 'find-updated-data' });
	const researchSession = await rs.session('find-updated-data');
	const research = await researchSession.prompt(
		`Find updated statistics and data to replace outdated content for this topic.

		Outdated stats that need replacement: ${JSON.stringify(audit.data.outdatedStats)}
		Missing data to find: ${JSON.stringify(audit.data.missingData)}

		For each item:
		- Find current tier 1-3 sourced statistics (preferably from the last 12 months)
		- Identify competitive gaps in current top-ranking content
		- Verify each source tier before including`,
		{ result: UpdatedResearchSchema },
	);

	// ── Phase 3: Rewrite in 14 steps ──────────────────────────────────────
	const w = await init(writer, { name: 'rewrite-content' });
	const rewriteSession = await w.session('rewrite-content');
	const rewrite = await rewriteSession.prompt(
		`Rewrite the following ${platform} blog content in 14 structured steps.

		## Original content:
		${currentContent}

		## Updated research data:
		${JSON.stringify(research.data, null, 2)}

		## Issues to fix:
		${JSON.stringify(audit.data.issues, null, 2)}

		## SEO issues to resolve:
		${JSON.stringify(audit.data.seoIssues, null, 2)}

		## 14-Step Rewrite Process:
		1. Refresh H1 title (under 60 chars, include primary keyword)
		2. Rewrite meta description (150-160 chars with a statistic)
		3. Restructure introduction to open with a key statistic
		4. Update all outdated statistics with new verified data
		5. Add missing internal link zones: [INTERNAL-LINK: anchor → target]
		6. Insert citation capsules (40-60 words, self-contained, quotable)
		7. Add information gain markers where appropriate
		8. Restructure H2s (60-70% as questions)
		9. Ensure every H2 opens with a statistic + source
		10. Add/update chart markers: [CHART: type - data - source]
		11. Add/update image markers: [IMAGE: description]
		12. Create key takeaways box after introduction
		13. Add TL;DR box and FAQ section (3-5 items)
		14. Apply anti-AI detection patterns

		Return the complete rewritten content and a list of all changes made.`,
		{ result: RewriteSchema },
	);

	// ── Phase 4: Write file and verify ────────────────────────────────────
	await writeFile(path, rewrite.data.content, 'utf-8');

	// ── Phase 5: Score the rewrite ────────────────────────────────────────
	const rv = await init(reviewer, { name: 'score-rewrite' });
	const scoreSession = await rv.session('score-rewrite');
	const quality = await scoreSession.prompt(
		`Score the following rewritten blog post for quality:\n\n${rewrite.data.content}`,
		{ result: QualitySchema },
	);

	return {
		path,
		scoreBefore,
		scoreAfter: quality.data.overall,
		changes: rewrite.data.changes,
		ratings: {
			before: audit.data.score,
			after: quality.data.overall,
		},
		issuesFixed: quality.data.issues.length,
	};
}
