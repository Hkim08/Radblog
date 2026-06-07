import * as v from 'valibot';
import type { FlueContext } from '@flue/runtime';
import { writeFile } from 'node:fs/promises';
import { researcher } from '../agents/researcher.ts';
import { writer } from '../agents/writer.ts';

// ─── Schemas ────────────────────────────────────────────────────────────────

const ResearchClusterSchema = v.object({
	overview: v.string(),
	subtopics: v.array(
		v.object({
			topic: v.string(),
			angle: v.string(),
			searchVolume: v.string(),
			competition: v.string(),
		}),
	),
	keywords: v.array(v.string()),
});

const ClusterPlanSchema = v.object({
	cluster: v.object({
		topic: v.string(),
		posts: v.array(
			v.object({
				title: v.string(),
				outline: v.array(v.string()),
				targetKeywords: v.array(v.string()),
				estimatedWordCount: v.number(),
			}),
		),
	}),
});

const PostResultSchema = v.object({
	content: v.string(),
	title: v.string(),
	wordCount: v.number(),
});

// ─── Workflow ───────────────────────────────────────────────────────────────

export async function run({ init, payload }: FlueContext) {
	const command =
		typeof payload === 'object' && payload !== null && 'command' in payload
			? String(payload.command)
			: '';
	const seed =
		typeof payload === 'object' && payload !== null && 'seed' in payload
			? String(payload.seed)
			: undefined;
	const plan =
		typeof payload === 'object' && payload !== null && 'plan' in payload
			? payload.plan
			: undefined;

	if (!command || (command !== 'plan' && command !== 'execute')) {
		throw new Error('A valid command is required. Pass {"command": "plan"|"execute"} as payload.');
	}

	if (command === 'plan') {
		if (!seed) {
			throw new Error('A seed topic is required for planning. Pass {"command": "plan", "seed": "..."} as payload.');
		}

		// ── Plan Phase 1: Research seed topic ────────────────────────────
		const r = await init(researcher, { name: 'seed-research' });
		const researchSession = await r.session('seed-research');
		const research = await researchSession.prompt(
			`Research the topic "${seed}" for a blog content cluster plan.

			Find:
			- An overview of the topic landscape
			- 3-5 distinct subtopics with unique angles for individual posts
			- Search volume estimates and competition level for each subtopic
			- 10-15 related keywords covering the topic cluster

			Return the results in the expected structured format.`,
			{ result: ResearchClusterSchema },
		);

		// ── Plan Phase 2: Define cluster structure ──────────────────────
		const rs = await init(researcher, { name: 'cluster-structure' });
		const structureSession = await rs.session('cluster-structure');
		const structure = await structureSession.prompt(
			`Analyze the subtopics and keywords for "${seed}" to determine optimal cluster structure.

			Subtopics: ${JSON.stringify(research.data.subtopics.map((s: { topic: string }) => s.topic))}
			Keywords: ${JSON.stringify(research.data.keywords)}

			Determine:
			- Which subtopics form a cohesive cluster
			- How posts should link to each other (hub-and-spoke or sequential)
			- Primary pillar post and supporting cluster posts
			- Internal linking strategy between cluster posts`,
			{
				result: v.object({
					clusterStructure: v.string(),
					internalLinkingStrategy: v.string(),
					pillarPost: v.string(),
					supportingPosts: v.array(v.string()),
				}),
			},
		);

		// ── Plan Phase 3: Create cluster plan ───────────────────────────
		const w = await init(writer, { name: 'cluster-plan' });
		const planSession = await w.session('cluster-plan');
		const clusterPlan = await planSession.prompt(
			`Create a content cluster plan for the seed topic "${seed}".

			## Research data
			${JSON.stringify(research.data, null, 2)}

			## Structure
			${JSON.stringify(structure.data, null, 2)}

			## Requirements
			Create 3-5 posts for this cluster:
			1. One pillar post (comprehensive, authoritative, linking to all cluster posts)
			2. 2-4 supporting cluster posts (each focused on a specific subtopic)

			For each post provide:
			- SEO-optimized title (under 60 characters)
			- Detailed outline with 5-8 bullet points
			- Target keywords (3-5 per post)
			- Estimated word count`,
			{ result: ClusterPlanSchema },
		);

		return {
			plan: {
				cluster: clusterPlan.data.cluster,
			},
		};
	}

	// ── Execute Phase: Generate posts from plan ─────────────────────────
	if (!plan || typeof plan !== 'object') {
		throw new Error('A plan object is required for execution. Pass {"command": "execute", "plan": {...}} as payload.');
	}

	const planObj = plan as { cluster?: { topic?: string; posts?: Array<{ title: string; outline: string[] }> } };

	if (!planObj.cluster?.posts || !Array.isArray(planObj.cluster.posts)) {
		throw new Error('The plan must include a cluster with a posts array.');
	}

	const posts: Array<{ path: string; title: string }> = [];

	for (const post of planObj.cluster.posts) {
		const w = await init(writer, { name: `write-${post.title.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '-')}` });
		const postSession = await w.session(`write-${post.title}`);
		const result = await postSession.prompt(
			`Write a blog post for topic "${post.title}" in the cluster "${planObj.cluster.topic}".

			## Outline to follow:
			${JSON.stringify(post.outline, null, 2)}

			## Requirements:
			- Every H2 opens with a statistic + source (40-60 words)
			- No paragraph exceeds 150 words
			- All statistics have named tier 1-3 sources
			- 60-70% of H2s as questions
			- FAQ section at the end (3-5 items)
			- Key Takeaways box after introduction
			- Include [INTERNAL-LINK: anchor → other cluster post title] references to other posts in this cluster
			- Citation capsules in each H2 section
			- Anti-AI patterns: no em dashes, varied sentence length, contractions, hedging`,
			{ result: PostResultSchema },
		);

		const slug = post.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		const filePath = `./workspace/${slug}.md`;
		await writeFile(filePath, result.data.content, 'utf-8');

		posts.push({ path: filePath, title: result.data.title });
	}

	return { posts };
}
