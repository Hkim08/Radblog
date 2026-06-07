import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import type { FlueContext } from '@flue/runtime';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const SchemaResultSchema = v.object({
	schema: v.record(v.string(), v.unknown()),
	appended: v.boolean(),
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
	const fileContent = await readFile(path, 'utf-8');

	// ── Phase 2: Extract frontmatter ─────────────────────────────────────────
	const frontmatter = extractFrontmatter(fileContent);

	// ── Phase 3: Generate schema ─────────────────────────────────────────────
	const w = await init(writer, { name: 'blog-schema-gen' });
	const session = await w.session('schema');
	const result = await session.prompt(
		`Generate complete, validated JSON-LD schema markup for the following blog post using the @graph pattern.

		Combine these schema types:
		- BlogPosting (headline, description, datePublished, dateModified, author, publisher, image, wordCount)
		- Person (author name, job title, url, sameAs)
		- Organization (site name, url, logo, sameAs)
		- BreadcrumbList (Home > Category > Post)
		- FAQPage (question and answer pairs extracted from FAQ section)
		- ImageObject (cover image with dimensions)

		## Frontmatter
		${JSON.stringify(frontmatter, null, 2)}

		## Content
		${fileContent}

		Return the schema as a JSON object with @graph array. Set appended to true if the post already has schema markup that was replaced.`,
		{ result: SchemaResultSchema },
	);

	return result.data;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractFrontmatter(content: string): Record<string, unknown> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};
	const result: Record<string, unknown> = {};
	for (const line of (match[1] ?? '').split('\n')) {
		const sep = line.indexOf(':');
		if (sep === -1) continue;
		const key = line.slice(0, sep).trim();
		const value = line.slice(sep + 1).trim();
		result[key] = value;
	}
	return result;
}
