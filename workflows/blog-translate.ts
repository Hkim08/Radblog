import * as v from 'valibot';
import { readFile } from 'node:fs/promises';
import { defineAgentProfile, createAgent } from '@flue/runtime';
import type { FlueContext } from '@flue/runtime';

// ─── Inline Translator Agent ────────────────────────────────────────────────

const translatorProfile = defineAgentProfile({
	name: 'blog-translator',
	instructions: `You are an SEO-optimized blog translator. You translate blog posts into target languages preserving:
- Markdown/HTML structure, tags, attributes
- Image URLs, link URLs, frontmatter keys
- Code blocks (translate inline comments only)
- Source organization names in citations
- Person names

You localize:
- Keywords (swap to local equivalent with real search behavior)
- Meta tags (title, description per target language conventions)
- Numbers, dates, currencies per locale format
- Image alt text and figcaption content
- FAQ questions and answers
- Citation capsule text
- CTA text

Quality rules:
- Same number of H2 and H3 sections as original
- All images present with translated alt text
- FAQ count matches original
- No machine-translation artifacts (literal idioms, unnatural word order, mixed-language sentences)
- Natural, publication-ready output`,
});

const translator = createAgent(({ id }) => ({
	model: 'opencode-zen/big-pickle',
	profile: translatorProfile,
}));

export { translator };
export default translator;

// ─── Schemas ────────────────────────────────────────────────────────────────

const TranslationSchema = v.object({
	lang: v.string(),
	path: v.string(),
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

	const to =
		typeof payload === 'object' && payload !== null && 'to' in payload
			? payload.to
			: undefined;

	if (!to) {
		throw new Error(
			'Target language(s) required. Pass {"to": "de"} or {"to": ["de", "fr"]} as payload.',
		);
	}

	const targetLangs = Array.isArray(to) ? to : [to];

	if (targetLangs.length === 0) {
		throw new Error('At least one target language is required.');
	}

	// ── Phase 1: Read file ───────────────────────────────────────────────────
	const fileContent = await readFile(path, 'utf-8');

	// ── Phase 2: Translate to each language ──────────────────────────────────
	const translations: Array<{ lang: string; path: string }> = [];

	for (const lang of targetLangs) {
		const t = await init(translator, { name: `blog-translate-${lang}` });
		const session = await t.session(`translate-${lang}`);
		const result = await session.prompt(
			`Translate the following blog post into ${lang}.

			## SEO Requirements
			- Localize keywords for the ${lang} market
			- Adapt title and meta description for ${lang} SEO
			- Translate image alt text
			- Format numbers, dates, currencies per ${lang} locale

			## Preservation Rules
			- Keep all markdown/HTML structure intact
			- Keep all URLs unchanged
			- Keep code blocks (translate inline comments only)
			- Keep source organization names

			Return the translated content.

			## Source: ${path}

			${fileContent}`,
			{ result: v.object({ content: v.string() }) },
		);

		const slug = path
			.replace(/\.(md|mdx|html)$/, '')
			.split('/')
			.pop();
		const translatedPath = `translations/${lang}/${slug}.md`;
		translations.push({ lang, path: translatedPath });
	}

	return { translations };
}
