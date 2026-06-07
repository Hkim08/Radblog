import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import type { FlueContext } from '@flue/runtime';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const ClusterSchema = v.object({
	keyword: v.string(),
	posts: v.array(v.string()),
	severity: v.string(),
	recommendation: v.string(),
});

const CannibalizationResultSchema = v.object({
	clusters: v.array(ClusterSchema),
	severity: v.string(),
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

	const keyword =
		typeof payload === 'object' && payload !== null && 'keyword' in payload
			? String(payload.keyword)
			: '';

	// ── Phase 1: Read the file ───────────────────────────────────────────────
	const fileContent = await read(path);

	// ── Phase 2: Scan for keyword overlap ────────────────────────────────────
	const w = await init(writer, { name: 'blog-cannibalization-scan' });
	const session = await w.session('cannibalization');
	const result = await session.prompt(
		`Analyze the following blog post for keyword cannibalization risk.

		Extract the primary keyword and secondary keywords from:
		- Title / H1
		- H2 headings
		- First paragraph
		- Meta description (if in frontmatter)

		Then evaluate potential overlap:
		- What exact keyword phrases is this post targeting?
		- What other posts on the same site might compete for these keywords?
		- What is the severity (Critical / High / Medium / Low)?

		${keyword ? `\nTarget keyword to check: ${keyword}` : ''}

		## File: ${path}

		${fileContent}

		Return the results in the expected structured format with clusters containing overlapping keywords, affected post paths, severity, and a merge/differentiate/canonical/no-action recommendation.`,
		{ result: CannibalizationResultSchema },
	);

	return result.data;
}

async function read(filePath: string): Promise<string> {
	return await readFile(filePath, 'utf-8');
}