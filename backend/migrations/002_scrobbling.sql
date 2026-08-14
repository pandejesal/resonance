-- Scrobbling support
-- Version: 002

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_scrobbles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    track_id TEXT NOT NULL,
    artist TEXT NOT NULL,
    track_name TEXT NOT NULL,
    album TEXT,
    timestamp INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_scrobbles_service ON pending_scrobbles(service);
CREATE INDEX IF NOT EXISTS idx_pending_scrobbles_created ON pending_scrobbles(created_at);
