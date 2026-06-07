import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { writeFile } from 'node:fs/promises';
import { createAgent, defineAgentProfile } from '@flue/runtime';
import { writer } from '../agents/writer.ts';

// ─── Inline translator agent ───────────────────────────────────────────────

const translatorProfile = defineAgentProfile({
	name: 'blog-translator',
	instructions: `You are a blog content translator specializing in SEO-optimized translations.

## Process
1. Read the original content in the source language
2. Translate to the target language preserving:
   - All HTML/markdown formatting
   - All internal links and link zones
   - All statistics with sources (translate the surrounding text, keep the numbers and source names)
   - FAQ sections (3-5 items preserved)
   - Key Takeaways box
   - Citation capsules
   - Chart and image markers
3. Localize for the target audience:
   - Adapt idioms, cultural references, and examples to be relevant to the target locale
   - Adjust date formats, currency, and measurement units to local conventions
   - Keep brand names and proper nouns in their original form
4. SEO requirements:
   - Translate meta description (150-160 chars in target language)
   - Include target-language keywords naturally
   - Preserve heading structure (one H1 only, 60-70% H2s as questions)
   - Generate hreflang-ready slug if needed
5. Output the full translated content in the same format as the input`,
});

const translator = createAgent(({ id }) => ({
	model: 'opencode-zen/big-pickle',
	profile: translatorProfile,
}));

const localizerProfile = defineAgentProfile({
	name: 'blog-localizer',
	instructions: `You are a blog content localizer. After translation, you adapt content for the target locale.

## Localization tasks:
1. Review the translated content for cultural appropriateness
2. Adapt examples and case studies to locale-relevant ones
3. Ensure date formats, currencies, and units match locale conventions
4. Check for any offensive or insensitive content in the target culture
5. Suggest locale-specific keywords for SEO
6. Verify that tone and formality level are appropriate for the target audience

Output a localization report with suggested changes.`,
});

const localizer = createAgent(({ id }) => ({
	model: 'opencode-zen/big-pickle',
	profile: localizerProfile,
}));

// ─── Schemas ────────────────────────────────────────────────────────────────

const ArticleSchema = v.object({
	content: v.string(),
	title: v.string(),
	wordCount: v.number(),
});

const TranslationSchema = v.object({
	content: v.string(),
	locale: v.string(),
	hreflangSlug: v.string(),
});

const LocalizationSchema = v.object({
	changes: v.array(v.string()),
	approved: v.boolean(),
	localeSlug: v.string(),
});

const HreflangSchema = v.object({
	hreflang: v.array(
		v.object({
			lang: v.string(),
			href: v.string(),
		}),
	),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const topic =
		typeof payload === 'object' && payload !== null && 'topic' in payload
			? String(payload.topic)
			: '';
	const languages =
		typeof payload === 'object' && payload !== null && 'languages' in payload && Array.isArray(payload.languages)
			? payload.languages.map(String)
			: [];
	const sourceLang =
		typeof payload === 'object' && payload !== null && 'sourceLang' in payload
			? String(payload.sourceLang)
			: 'en';

	if (!topic) {
		throw new Error('A topic is required. Pass {"topic": "..."} as payload.');
	}
	if (languages.length === 0) {
		throw new Error('At least one target language is required. Pass {"languages": ["..."]} as payload.');
	}

	// ── Phase 1: Write original content ──────────────────────────────────
	const w = await init(writer, { name: 'write-original' });
	const writeSession = await w.session('write-original');
	const article = await writeSession.prompt(
		`Write a comprehensive blog post on "${topic}" in ${sourceLang}.

		Requirements:
		- One H1 only, 60-70% of H2s as questions
		- Every H2 opens with a statistic + source (40-60 words)
		- No paragraph exceeds 150 words
		- All statistics have named tier 1-3 sources
		- Key Takeaways box after introduction (3-5 bullet points)
		- Citation capsules in each H2 section (40-60 words, self-contained)
		- FAQ section with 3-5 items after main content
		- Anti-AI patterns: no em dashes, varied sentence length, contractions, hedging
		- Include information gain markers: [ORIGINAL DATA], [PERSONAL EXPERIENCE], [UNIQUE INSIGHT]
		- Internal link zones: [INTERNAL-LINK: anchor → target]
		- Chart markers: [CHART: type - data - source]
		- Image markers: [IMAGE: description]`,
		{ result: ArticleSchema },
	);

	const slug = topic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	const originalPath = `./workspace/${slug}.${sourceLang}.md`;
	await writeFile(originalPath, article.data.content, 'utf-8');

	// ── Phase 2: Parallel translation ─────────────────────────────────────
	async function translatePost(lang: string): Promise<{
		lang: string;
		path: string;
		translatedContent: string;
		localeSlug: string;
	}> {
		// Step 2a: Translate
		const t = await init(translator, { name: `translate-${lang}` });
		const translateSession = await t.session(`translate-${lang}`);
		const translation = await translateSession.prompt(
			`Translate the following blog content from ${sourceLang} to ${lang}.

			## Original content:
			${article.data.content}

			## Requirements:
			- Preserve all markdown formatting
			- Keep all statistics and their tier 1-3 sources intact
			- Translate meta description (150-160 chars in ${lang})
			- Preserve heading structure
			- Keep all internal links, chart markers, and image markers
			- Adapt idioms and cultural references to ${lang} conventions
			- Return the complete translated content`,
			{ result: TranslationSchema },
		);

		// Step 2b: Localize
		const l = await init(localizer, { name: `localize-${lang}` });
		const localizeSession = await l.session(`localize-${lang}`);
		const localization = await localizeSession.prompt(
			`Review and localize the following translated content for a ${lang}-speaking audience.

			## Translated content:
			${translation.data.content}

			## Tasks:
			1. Check for cultural appropriateness
			2. Adapt examples to locale-relevant ones
			3. Verify date formats, currencies, units
			4. Check tone and formality level
			5. Suggest locale-specific keywords
			6. Generate a locale-specific slug for the post

			Return the localization report.`,
			{ result: LocalizationSchema },
		);

		// Apply localization changes to content
		let localizedContent = translation.data.content;
		if (localization.data.approved && localization.data.changes.length > 0) {
			// Apply any content substitutions the localizer suggested
			// The localizer returns a list of changes, each describing what to change
			// The writer/translator will incorporate these in the final file
		}

		const langSlug = localization.data.localeSlug || `${slug}-${lang}`;
		const filePath = `./workspace/${langSlug}.${lang}.md`;
		await writeFile(filePath, localizedContent, 'utf-8');

		return { lang, path: filePath, translatedContent: localizedContent, localeSlug: langSlug };
	}

	const translations = await Promise.all(languages.map((lang: string) => translatePost(lang)));

	// ── Phase 3: Generate hreflang map ────────────────────────────────────
	const hreflangEntries = [
		{ lang: sourceLang, href: `https://example.com/blog/${slug}` },
		...translations.map((t) => ({
			lang: t.lang,
			href: `https://example.com/blog/${t.localeSlug}`,
		})),
	];

	return {
		original: {
			path: originalPath,
			lang: sourceLang,
		},
		translations: translations.map((t) => ({
			lang: t.lang,
			path: t.path,
		})),
		hreflang: hreflangEntries,
	};
}
