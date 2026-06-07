import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const SESSIONS_DIR = './workspace/sessions';

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

interface SessionFile {
	id: string;
	name: string;
	created: string;
	updated: string;
	messages: ChatMessage[];
}


function pathFor(id: string): string {
	return `${SESSIONS_DIR}/${id}.json`;
}

async function ensureDir() {
	if (!existsSync(SESSIONS_DIR)) {
		await mkdir(SESSIONS_DIR, { recursive: true });
	}
}

export async function listSessions(): Promise<SessionMeta[]> {
	await ensureDir();
	const entries = await readdir(SESSIONS_DIR);
	const sessions: SessionMeta[] = [];
	for (const entry of entries) {
		if (!entry.endsWith('.json')) continue;
		try {
			const raw = await readFile(`${SESSIONS_DIR}/${entry}`, 'utf-8');
			const data: SessionFile = JSON.parse(raw);
			sessions.push({
				id: data.id,
				name: data.name,
				created: data.created,
				updated: data.updated,
				messageCount: data.messages.length,
			});
		} catch {
			// skip corrupt files
		}
	}
	sessions.sort((a, b) => b.updated.localeCompare(a.updated));
	return sessions;
}

export async function createSession(name: string): Promise<SessionMeta> {
	await ensureDir();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const data: SessionFile = { id, name, created: now, updated: now, messages: [] };
	await writeFile(pathFor(id), JSON.stringify(data, null, 2));
	return { id, name, created: now, updated: now, messageCount: 0 };
}

export async function deleteSession(id: string): Promise<boolean> {
	await ensureDir();
	try {
		await unlink(pathFor(id));
		return true;
	} catch {
		return false;
	}
}

export async function getSession(id: string): Promise<SessionFile | null> {
	try {
		const raw = await readFile(pathFor(id), 'utf-8');
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export async function renameSession(id: string, name: string): Promise<SessionMeta | null> {
	const session = await getSession(id);
	if (!session) return null;
	session.name = name;
	session.updated = new Date().toISOString();
	await writeFile(pathFor(id), JSON.stringify(session, null, 2));
	return { id, name, created: session.created, updated: session.updated, messageCount: session.messages.length };
}

export async function appendMessage(id: string, msg: ChatMessage): Promise<void> {
	const session = await getSession(id);
	if (!session) return;
	session.messages.push(msg);
	session.updated = new Date().toISOString();
	await writeFile(pathFor(id), JSON.stringify(session, null, 2));
}
