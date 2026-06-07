# Radblog

AI-powered blog creation and optimization engine built on Flue for Cloudflare Workers.

## Features

- **Blog Writing** - Full pipeline (research → outline → write → review)
- **SEO Optimization** - On-page validation and scoring
- **Content Analysis** - Quality scoring against E-E-A-T criteria
- **Multi-language** - Translation and localization support
- **Cloudflare Workers** - Edge-deployed, globally fast

## Tech Stack

- **Flue** - AI agent framework
- **Cloudflare Workers** - Edge runtime with Durable Objects
- **Cloudflare AI** - Workers AI for model inference

## Quick Start

```bash
# Build for Cloudflare
npx flue build --target cloudflare

# Deploy
npx wrangler deploy
```

## Project Structure

```
├── agents/          # AI agent definitions
├── skills/          # Domain expertise (blog, SEO, etc.)
├── workflows/       # Multi-step pipelines
├── knowledge/       # Reference data and rules
└── app.ts           # HTTP entry point
```

## Available Workflows

- `blog-write` - Full article pipeline
- `blog-rewrite` - Rewrite existing posts
- `blog-analyze` - Quality scoring
- `blog-seo-check` - On-page validation
- `blog-translate` - Multi-language support
- And more...

## Chat Interface

Open `/chat` in your browser to interact with the blog orchestrator agent via WebSocket.