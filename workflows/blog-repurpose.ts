import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import type { FlueContext } from '@flue/runtime';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const OutputSchema = v.object({
	platform: v.string(),
	content: v.string(),
});

const RepurposeResultSchema = v.object({
	outputs: v.array(OutputSchema),
});

const DEFAULT_PLATFORMS = ['linkedin', 'twitter', 'newsletter'];

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

	const platforms =
		typeof payload === 'object' &&
		payload !== null &&
		'platforms' in payload &&
		Array.isArray(payload.platforms)
			? (payload.platforms as string[])
			: DEFAULT_PLATFORMS;

	// ── Phase 1: Read file ───────────────────────────────────────────────────
	const fileContent = await readFile(path, 'utf-8');

	// ── Phase 2: Repurpose for each platform ─────────────────────────────────
	const w = await init(writer, { name: 'blog-repurpose' });
	const allOutputs: Array<{ platform: string; content: string }> = [];

	for (const platform of platforms) {
		const session = await w.session(`repurpose-${platform}`);
		const result = await session.prompt(
			`Transform the following blog post into a ${platform}-optimized version.

			Platform requirements:
			${getPlatformInstructions(platform)}

			Extract key insights, statistics, quotes, and the main argument from the post, then adapt for ${platform}.

			## Source file: ${path}

			${fileContent}

			Return an object with platform name and the adapted content.`,
			{ result: OutputSchema },
		);
		allOutputs.push(result.data);
	}

	return { outputs: allOutputs };
}

function getPlatformInstructions(platform: string): string {
	const instructions: Record<string, string> = {
		linkedin:
			'800-1200 words, professional tone, personal story hook, numbered lists, short paragraphs, end with engagement question. No external links in body.',
		twitter:
			'Thread of 7-9 tweets, each under 280 chars. Hook with curiosity gap or bold stat. One key point per tweet. Closing with CTA and 2 hashtags max.',
		newsletter:
			'150-200 words. Curiosity subject line (40-60 chars). TL;DR summary. 3 key takeaways with stats. Single CTA button.',
		reddit:
			'Frame as discussion question or observation. Share key findings as peer-to-peer. No clickbait. Include 3-5 data points. End with discussion prompt.',
		youtube:
			'Complete video script: hook (0-15s), intro, 3-5 talking points with visual cues [SHOW CHART], CTA. ~150 words/min spoken.',
	};
	return (
		instructions[platform] ??
		`Adapt for ${platform} following its content conventions and audience expectations.`
	);
}
