import { defineTool, Type } from '@flue/runtime';

interface SerperResult {
	title: string;
	link: string;
	snippet: string;
	position: number;
}

interface SerperResponse {
	organic?: SerperResult[];
	searchParameters?: { totalResults?: number };
}

export const webSearch = defineTool({
	name: 'webSearch',
	description:
		'Search the web for current information. Returns results with titles, URLs, and snippets. Use this to find statistics, sources, images, and competitive data.',
	parameters: Type.Object({
		query: Type.String({ description: 'Search query' }),
		count: Type.Optional(
			Type.Number({ description: 'Number of results to return (1-20)' }),
		),
	}),
	async execute(params, _signal) {
		const { query, count } = params as { query: string; count?: number };
		const apiKey = process.env.SEARCH_API_KEY;
		if (!apiKey) {
			throw new Error(
				'SEARCH_API_KEY environment variable is not set. Configure it in .env or app.ts.',
			);
		}

		const response = await fetch('https://google.serper.dev/search', {
			method: 'POST',
			headers: {
				'X-API-KEY': apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ q: query, num: count ?? 10 }),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Search API error: ${response.status} ${response.statusText} — ${body}`);
		}

		const data = (await response.json()) as SerperResponse;
		const results = data.organic ?? [];
		const totalResults = data.searchParameters?.totalResults ?? results.length;

		if (results.length === 0) {
			return 'No search results found.';
		}

		return results
			.map(
				(r: SerperResult, i: number) =>
					`${i + 1}. ${r.title}\n   URL: ${r.link}\n   ${r.snippet}`,
			)
			.join('\n\n');
	},
});
