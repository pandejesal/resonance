CREATE TABLE IF NOT EXISTS smart_playlists (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL UNIQUE,
    rules TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
