/**
 * D1 SQL-based session storage for Cloudflare Workers.
 * Replaces the file-system based sessions.ts for Cloudflare deployment.
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface SessionMeta {
	id: string;
	name: string;
	created: string; // ISO
	updated: string; // ISO
	messageCount: number;
}

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	ts: string;
}

interface SessionRow {
	id: string;
	name: string;
	created: string;
	updated: string;
	messages: string; // JSON string
}

function pathFor(_id: string): string {
	// Not used in D1 version - kept for interface compatibility
	return '';
}

export async function listSessions(db: D1Database): Promise<SessionMeta[]> {
	const result = await db
		.prepare('SELECT id, name, created, updated, message_count FROM sessions ORDER BY updated DESC')
		.all<SessionRow>();

	return result.results.map((row) => ({
		id: row.id,
		name: row.name,
		created: row.created,
		updated: row.updated,
		messageCount: 0, // not stored in list query
	}));
}

export async function createSession(
	db: D1Database,
	name: string,
): Promise<SessionMeta> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(
			'INSERT INTO sessions (id, name, created, updated, message_count, messages) VALUES (?, ?, ?, ?, 0, ?)',
		)
		.bind(id, name, now, now, '[]')
		.run();

	return { id, name, created: now, updated: now, messageCount: 0 };
}

export async function deleteSession(db: D1Database, id: string): Promise<boolean> {
	const result = await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
	return result.success && result.meta.changes > 0;
}

export async function getSession(
	db: D1Database,
	id: string,
): Promise<{ id: string; name: string; created: string; updated: string; messages: ChatMessage[] } | null> {
	const result = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first<SessionRow>();

	if (!result) return null;

	return {
		id: result.id,
		name: result.name,
		created: result.created,
		updated: result.updated,
		messages: JSON.parse(result.messages),
	};
}

export async function renameSession(
	db: D1Database,
	id: string,
	name: string,
): Promise<SessionMeta | null> {
	const now = new Date().toISOString();
	const result = await db
		.prepare('UPDATE sessions SET name = ?, updated = ? WHERE id = ?')
		.bind(name, now, id)
		.run();

	if (!result.success || result.meta.changes === 0) return null;

	const session = await getSession(db, id);
	if (!session) return null;

	return {
		id: session.id,
		name: session.name,
		created: session.created,
		updated: session.updated,
		messageCount: session.messages.length,
	};
}

export async function appendMessage(
	db: D1Database,
	id: string,
	msg: ChatMessage,
): Promise<void> {
	const now = new Date().toISOString();
	const msgJson = JSON.stringify(msg);

	// Get current messages and append
	const session = await getSession(db, id);
	if (!session) return;

	const messages = [...session.messages, msg];
	const messagesJson = JSON.stringify(messages);

	await db
		.prepare('UPDATE sessions SET messages = ?, updated = ?, message_count = ? WHERE id = ?')
		.bind(messagesJson, now, messages.length, id)
		.run();
}