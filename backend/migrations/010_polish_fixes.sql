-- Polish fixes: musical_key column + performance indexes.

ALTER TABLE tracks ADD COLUMN musical_key TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_fingerprint ON tracks(fingerprint);
CREATE INDEX IF NOT EXISTS idx_listening_history_track_played ON listening_history(track_id, played_at);
