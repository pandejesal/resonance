ALTER TABLE playlists ADD COLUMN source_platform TEXT;
ALTER TABLE playlists ADD COLUMN source_url TEXT;

-- Fix: allow playlists without a library (e.g., imported playlists)
CREATE TABLE IF NOT EXISTS playlists_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_smart BOOLEAN DEFAULT FALSE,
    smart_filter TEXT,
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    library_id TEXT,
    source_platform TEXT,
    source_url TEXT,
    FOREIGN KEY (parent_id) REFERENCES playlists(id) ON DELETE SET NULL
);

INSERT INTO playlists_new (id, name, description, is_smart, smart_filter, parent_id, sort_order, track_count, total_duration_ms, created_at, updated_at, library_id)
SELECT id, name, description, is_smart, smart_filter, parent_id, sort_order, track_count, total_duration_ms, created_at, updated_at, library_id
FROM playlists;

DROP TABLE playlists;
ALTER TABLE playlists_new RENAME TO playlists;

CREATE INDEX IF NOT EXISTS idx_playlists_library ON playlists(library_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
