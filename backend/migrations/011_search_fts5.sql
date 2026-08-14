-- Search: FTS5 virtual table over tracks + sync triggers.
-- Backfill is handled in code at startup (INSERT INTO tracks_fts(tracks_fts) VALUES('rebuild'))
-- to avoid a long lock inside the migration runner.

CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    title,
    artist,
    album,
    genre,
    file_name,
    folder,
    lyrics,
    track_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS tracks_fts_ai AFTER INSERT ON tracks BEGIN
    INSERT INTO tracks_fts(rowid, title, artist, album, genre, file_name, folder, lyrics, track_id)
    VALUES (new.rowid, new.title, new.artist, new.album, new.genre, new.file_name, new.folder, new.lyrics, new.id);
END;

CREATE TRIGGER IF NOT EXISTS tracks_fts_ad AFTER DELETE ON tracks BEGIN
    INSERT INTO tracks_fts(tracks_fts, rowid, track_id) VALUES ('delete', old.rowid, old.id);
END;

CREATE TRIGGER IF NOT EXISTS tracks_fts_au AFTER UPDATE ON tracks BEGIN
    INSERT INTO tracks_fts(tracks_fts, rowid, track_id) VALUES ('delete', old.rowid, old.id);
    INSERT INTO tracks_fts(rowid, title, artist, album, genre, file_name, folder, lyrics, track_id)
    VALUES (new.rowid, new.title, new.artist, new.album, new.genre, new.file_name, new.folder, new.lyrics, new.id);
END;
