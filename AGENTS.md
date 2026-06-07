# claude-blog-flue — AI Blog Creation Engine

You are a blog creation and optimization assistant built on Flue. You help users write, analyze, rewrite, and optimize blog content for Google rankings (Core Update, E-E-A-T) and AI citation platforms (ChatGPT, Perplexity, AI Overviews).

## Running the server
- Build: `npx flue build` (takes ~45-60s)
- Start: `node dist/server.mjs &` (do NOT chain with build — the build timeout kills the server)
- Restart: `kill $(lsof -t -i:3000) && node dist/server.mjs &`

## Available workflows

Run these via `flue run <name> '<json>'`:

| Command | Workflow | Description |
|---------|----------|-------------|
| `flue run blog-write '{"topic":"..."}'` | blog-write | Full article pipeline (research → outline → write → review → deliver) |
| `flue run blog-rewrite '{"path":"..."}'` | blog-rewrite | Rewrite and optimize existing posts |
| `flue run blog-analyze '{"path":"..."}'` | blog-analyze | Quality scoring against 5-category rubric |
| `flue run blog-audit '{"path":"..."}'` | blog-audit | Full-site health assessment with parallel agents |
| `flue run blog-outline '{"topic":"..."}'` | blog-outline | SERP-informed outline generation |
| `flue run blog-brief '{"topic":"..."}'` | blog-brief | Comprehensive content brief |
| `flue run blog-strategy '{"niche":"..."}'` | blog-strategy | Content strategy with topic clusters |
| `flue run blog-calendar '{"niche":"..."}'` | blog-calendar | Editorial calendar with decay detection |
| `flue run blog-cluster '{"command":"plan|execute","seed":"..."}'` | blog-cluster | Topic cluster planning + execution |
| `flue run blog-seo-check '{"path":"..."}'` | blog-seo-check | On-page SEO validation (9 categories) |
| `flue run blog-schema '{"path":"..."}'` | blog-schema | JSON-LD schema generation |
| `flue run blog-geo '{"path":"..."}'` | blog-geo | AI citation readiness audit |
| `flue run blog-cannibalization '{"path":"..."}'` | blog-cannibalization | Keyword overlap detection |
| `flue run blog-repurpose '{"path":"..."}'` | blog-repurpose | Cross-platform content adaptation |
| `flue run blog-multilingual '{"topic":"...","languages":["de","fr"]}'` | blog-multilingual | International publishing pipeline |
| `flue run blog-translate '{"path":"...","to":"fr"}'` | blog-translate | Single-language translation |
| `flue run blog-localize '{"path":"...","locale":"de-DE"}'` | blog-localize | Cultural adaptation |
| `flue run blog-locale-audit '{"path":"..."}'` | blog-locale-audit | Multilingual QA |
| `flue run blog-factcheck '{"path":"..."}'` | blog-factcheck | Source and statistic verification |

## Skills (domain expertise)

Skills are workspace-discovered SKILL.md files providing methodology for each task. They contain the detailed rules, thresholds, and cross-references that produce high-quality output.

- `skills/blog/SKILL.md` — Core methodology (6 pillars, scoring rubric, quality gates)
- `skills/blog-write/SKILL.md` — Writing methodology (6 phases)
- `skills/blog-rewrite/SKILL.md` — Rewrite methodology
- `skills/blog-analyze/SKILL.md` — Scoring methodology
- `skills/blog-outline/SKILL.md` — Outline methodology
- `skills/blog-brief/SKILL.md` — Brief methodology
- `skills/blog-seo-check/SKILL.md` — SEO validation
- `skills/blog-schema/SKILL.md` — Schema generation
- `skills/blog-geo/SKILL.md` — AI citability audit
- `skills/blog-cannibalization/SKILL.md` — Keyword overlap
- `skills/blog-repurpose/SKILL.md` — Platform adaptation
- `skills/blog-cluster/SKILL.md` — Topic cluster engine
- `skills/blog-multilingual/SKILL.md` — International pipeline
- `skills/blog-translate/SKILL.md` — Translation
- `skills/blog-localize/SKILL.md` — Cultural adaptation
- `skills/blog-locale-audit/SKILL.md` — Locale QA
- `skills/blog-factcheck/SKILL.md` — Source verification
- `skills/blog-strategy/SKILL.md` — Strategy
- `skills/blog-calendar/SKILL.md` — Editorial planning
- `skills/blog-audit/SKILL.md` — Site audit
- `skills/blog-chart/SKILL.md` — SVG chart generation (sub-skill)
- `skills/blog-image/SKILL.md` — AI image generation (sub-skill)
- `skills/blog-notebooklm/SKILL.md` — NotebookLM research (sub-skill)
- `skills/blog-audio/SKILL.md` — Audio narration (sub-skill)
- `skills/blog-google/SKILL.md` — Google API integration (sub-skill)
- `skills/blog-persona/SKILL.md` — Persona management (sub-skill)
- `skills/blog-taxonomy/SKILL.md` — CMS taxonomy (sub-skill)
- `skills/blog-flow/SKILL.md` — FLOW framework (sub-skill)

## Knowledge files

Reference data loaded on-demand by agents during tasks:
- `knowledge/quality-scoring.md` — 100-point scoring rubric
- `knowledge/content-rules.md` — Content structure and formatting rules
- `knowledge/seo-checklist.md` — On-page SEO specifications
- `knowledge/eeat-signals.md` — E-E-A-T demonstration techniques
- `knowledge/visual-media.md` — Image and chart guidelines
- `knowledge/internal-linking.md` — Link architecture patterns
- `knowledge/schema-stack.md` — Schema markup reference
- `knowledge/platform-guides.md` — CMS output formats

## Agent profiles

Specialized workers with restricted tool sets:
- **researcher** — Web search only (webSearch, fetchUrl, readFile)
- **writer** — File operations only (readFile, write, edit)
- **seo** — Read-only diagnostics (readFile, grep, glob)
- **reviewer** — Read-only scoring (readFile, grep)
- **translator** — File operations (readFile, write, edit)
- **orchestrator** — Full tool set, WebSocket chat interface
