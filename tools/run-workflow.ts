import { defineTool, Type } from '@flue/runtime';

export const runWorkflow = defineTool({
	name: 'runWorkflow',
	description:
		'Run a blog engine workflow by name with a JSON payload. Returns the workflow run result. Available workflows: blog-write, blog-rewrite, blog-analyze, blog-outline, blog-brief, blog-seo-check, blog-schema, blog-geo, blog-factcheck, blog-cannibalization, blog-repurpose, blog-audit, blog-strategy, blog-calendar, blog-cluster, blog-translate, blog-localize, blog-multilingual, blog-locale-audit. Use ?wait=result to wait for completion.',
	parameters: Type.Object({
		name: Type.String({
			description:
				'Workflow name (e.g. blog-write, blog-rewrite, blog-analyze, blog-outline, blog-seo-check, blog-translate)',
		}),
		payload: Type.Optional(
			Type.Record(Type.String(), Type.Any(), {
				description: 'JSON payload for the workflow (e.g. { topic: "..." } for blog-write)',
			}),
		),
		wait: Type.Optional(
			Type.Boolean({
				description: 'Wait for the result (default true). Set to false to fire-and-forget.',
			}),
		),
	}),
	async execute(params, _signal) {
		const { name, payload, wait } = params as {
			name: string;
			payload?: Record<string, unknown>;
			wait?: boolean;
		};

		const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3583}`;
		const url = wait !== false
			? `${baseUrl}/workflows/${encodeURIComponent(name)}?wait=result`
			: `${baseUrl}/workflows/${encodeURIComponent(name)}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload ?? {}),
		});

		if (response.status === 202) {
			const data = (await response.json()) as { runId?: string };
			return `Workflow "${name}" accepted. Run ID: ${data.runId}. Check status later.`;
		}

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Workflow "${name}" failed: ${response.status} ${response.statusText} — ${body}`);
		}

		const data = (await response.json()) as Record<string, unknown>;
		const result = (data.result ?? data) as Record<string, unknown>;

		if (typeof result === 'object' && result !== null) {
			const lines: string[] = [`**Workflow "${name}" completed**`];
			for (const [key, value] of Object.entries(result)) {
				lines.push(`- **${key}**: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
			}
			return lines.join('\n');
		}

		return String(result);
	},
});
