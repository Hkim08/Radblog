-- Create sessions table for D1
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	created TEXT NOT NULL,
	updated TEXT NOT NULL,
	message_count INTEGER NOT NULL DEFAULT 0,
	messages TEXT NOT NULL DEFAULT '[]'
);

-- Index for listing sessions by updated time
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated DESC);