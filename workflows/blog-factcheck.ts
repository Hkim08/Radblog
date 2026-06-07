import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import type { FlueContext } from '@flue/runtime';
import { researcher } from '../agents/researcher.ts';
import { webSearch } from '../tools/web-search.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const ClaimSchema = v.object({
	claimText: v.string(),
	value: v.string(),
	attribution: v.optional(v.string()),
	url: v.optional(v.string()),
	location: v.string(),
});

const VerifiedClaimSchema = v.object({
	claimText: v.string(),
	value: v.string(),
	attribution: v.optional(v.string()),
	url: v.optional(v.string()),
	location: v.string(),
	score: v.number(),
	status: v.string(),
	notes: v.string(),
});

const FactcheckResultSchema = v.object({
	claims: v.array(VerifiedClaimSchema),
	verified: v.number(),
	unverified: v.number(),
	recommendations: v.array(v.string()),
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

	// ── Phase 2: Extract claims ──────────────────────────────────────────────
	const r = await init(researcher, { name: 'blog-factcheck-extract' });
	const extractSession = await r.session('extract-claims');
	const claimsResult = await extractSession.prompt(
		`Extract all statistical claims from the following blog post.

		Look for:
		- Any sentence containing a number, percentage, dollar amount, or named source
		- Claims with markdown links (fully cited)
		- Standalone statistics (uncited)
		- Multiplier claims (X times more/less)
		- Weak signals ("studies show", "research indicates")

		For each claim, return:
		- claimText: the exact sentence containing the statistic
		- value: the numeric value (e.g., "42%", "$1.2M", "3x")
		- attribution: named source if present
		- url: cited URL if present
		- location: the heading or paragraph where the claim appears

		## File: ${path}

		${fileContent}

		Return the results in the expected structured format.`,
		{
			result: v.object({
				claims: v.array(ClaimSchema),
			}),
		},
	);

	const claims = claimsResult.data.claims;
	const verifiedResults: Array<{
		claimText: string;
		value: string;
		attribution?: string;
		url?: string;
		location: string;
		score: number;
		status: string;
		notes: string;
	}> = [];
	const recommendations: string[] = [];

	// ── Phase 3: Verify each claim via web search ───────────────────────────
	for (const claim of claims) {
		if (claim.url) {
			// Claim has a URL — note it but we can't verify via webSearch directly
			verifiedResults.push({
				...claim,
				score: 0.5,
				status: 'WEAK',
				notes: `Has URL: ${claim.url}. Manual verification recommended.`,
			});
			recommendations.push(`Verify URL ${claim.url} for claim: "${claim.claimText}"`);
		} else if (claim.attribution) {
			// Has attribution but no URL — search for it
			try {
				const searchQuery = `${claim.value} ${claim.attribution}`;
				const searchResult = await webSearch.execute(
					{ query: searchQuery, count: 5 },
					new AbortController().signal,
				);

				verifiedResults.push({
					...claim,
					score: 0.3,
					status: 'UNVERIFIED',
					notes: `Attributed to ${claim.attribution}. Search performed: "${searchQuery}". Review results to confirm.`,
				});
			} catch {
				verifiedResults.push({
					...claim,
					score: 0,
					status: 'UNVERIFIED',
					notes: `Could not search for attribution: ${claim.attribution}`,
				});
			}
		} else {
			// No URL and no attribution — unverifiable
			verifiedResults.push({
				...claim,
				score: 0,
				status: 'UNVERIFIED',
				notes: 'No source URL or attribution provided. Suggest finding a source for this claim.',
			});
			recommendations.push(
				`Find a source for: "${claim.claimText}" — suggest searching: "${claim.value}"`,
			);
		}
	}

	const verified = verifiedResults.filter(
		(c) => c.score >= 0.7,
	).length;
	const unverified = verifiedResults.length - verified;

	return {
		claims: verifiedResults,
		verified,
		unverified,
		recommendations,
	};
}

async function read(filePath: string): Promise<string> {
	return await readFile(filePath, 'utf-8');
}
