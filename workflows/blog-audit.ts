import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { readFile, readdir } from 'node:fs/promises';
import { reviewer } from '../agents/reviewer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const PostScoreSchema = v.object({
	path: v.string(),
	score: v.number(),
	rating: v.string(),
	aiProbability: v.number(),
	wordCount: v.number(),
	categories: v.object({
		contentQuality: v.number(),
		seoOptimization: v.number(),
		eeatSignals: v.number(),
		technicalElements: v.number(),
		aiCitationReadiness: v.number(),
	}),
	issues: v.array(
		v.object({
			severity: v.string(),
			location: v.string(),
			description: v.string(),
		}),
	),
	isOrphan: v.boolean(),
	isStale: v.boolean(),
});

const AggregationSchema = v.object({
	totalPosts: v.number(),
	avgScore: v.number(),
	orphans: v.array(v.string()),
	stale: v.array(v.string()),
	avgCategories: v.object({
		contentQuality: v.number(),
		seoOptimization: v.number(),
		eeatSignals: v.number(),
		technicalElements: v.number(),
		aiCitationReadiness: v.number(),
	}),
	issues: v.array(v.string()),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const targetPath =
		typeof payload === 'object' && payload !== null && 'path' in payload
			? String(payload.path)
			: '';

	// ── Phase 1: Discover blog files ──────────────────────────────────────
	const r = await init(reviewer, { name: 'discover-posts' });

	let mdFiles: string[];
	try {
		if (targetPath) {
			// Single file mode — still need an array
			const content = await readFile(targetPath, 'utf-8');
			mdFiles = [targetPath];
		} else {
			// Discover all .md files in current directory
			const entries = await readdir('.');
			mdFiles = entries.filter((entry: string) => entry.endsWith('.md'));
		}
	} catch (err) {
		throw new Error(`Could not discover blog files: ${err instanceof Error ? err.message : String(err)}`);
	}

	if (mdFiles.length === 0) {
		throw new Error('No markdown files found to audit.');
	}

	// ── Phase 2: Score each file in parallel ──────────────────────────────

	async function scorePost(filePath: string) {
		const p = await init(reviewer, { name: `review-${filePath.replace(/[^a-z0-9]/gi, '-')}` });
		const reviewSession = await p.session(`score-${filePath.replace(/[^a-z0-9]/gi, '-')}`);
		const fileContent = await import('node:fs/promises').then(fs => fs.readFile(filePath, 'utf-8'));
		const result = await reviewSession.prompt(
			`Score the following blog post for quality:\n\n${fileContent}\n\nProvide overall score, category scores, rating, AI detection, word count, issues, whether orphan, whether stale.`,
			{ result: PostScoreSchema },
		);
		return result as unknown as { data: v.InferOutput<typeof PostScoreSchema> };
	}

	const results = await Promise.all(mdFiles.map((f: string) => scorePost(f)));

	// ── Phase 3: Aggregate scores ─────────────────────────────────────────
	const totalPosts = results.length;
	const scores = results.map((r) => r.data.score);
	const avgScore = Math.round((scores.reduce((a: number, b: number) => a + b, 0) / totalPosts) * 10) / 10;

	const orphans = results.filter((r) => r.data.isOrphan).map((r) => r.data.path);
	const stale = results.filter((r) => r.data.isStale).map((r) => r.data.path);

	// Aggregate category averages
	const categoryKeys = ['contentQuality', 'seoOptimization', 'eeatSignals', 'technicalElements', 'aiCitationReadiness'] as const;
	const avgCategories = {} as Record<string, number>;
	for (const key of categoryKeys) {
		const sum = results.reduce((acc: number, r: { data: Record<string, unknown> }) => acc + ((r.data.categories as Record<string, number>)[key] || 0), 0);
		avgCategories[key] = Math.round((sum / totalPosts) * 10) / 10;
	}

	// Collect all unique high-severity issues
	const allIssues = results.flatMap((r) => r.data.issues);
	const criticalIssues = [...new Set(allIssues.filter((i) => i.severity === 'high' || i.severity === 'critical').map((i) => i.description))];

	return {
		totalPosts,
		avgScore,
		orphans,
		stale,
		avgCategories,
		issues: criticalIssues,
	};
}
