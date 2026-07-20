use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::migrate;
use std::path::Path;
use log::info;

pub mod db {
    use super::*;

    pub struct Database {
        pub pool: SqlitePool,
    }

    impl Database {
        pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
            let file_path = database_url
                .strip_prefix("sqlite:")
                .unwrap_or(database_url)
                .split('?')
                .next()
                .unwrap_or(database_url);
            let db_path = Path::new(file_path);
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }

            let pool = SqlitePoolOptions::new()
                .max_connections(10)
                .min_connections(2)
                .connect(database_url)
                .await?;

            sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await?;
            sqlx::query("PRAGMA synchronous=NORMAL").execute(&pool).await?;
            sqlx::query("PRAGMA cache_size=-64000").execute(&pool).await?;
            sqlx::query("PRAGMA temp_store=MEMORY").execute(&pool).await?;
            sqlx::query("PRAGMA mmap_size=268435456").execute(&pool).await?;
            sqlx::query("PRAGMA optimize").execute(&pool).await?;

            Ok(Self { pool })
        }

        pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
            migrate!("./migrations").run(&self.pool).await?;
            info!("Database migrations completed");
            Ok(())
        }
    }
}

pub fn create_schema() -> String {
    r#"
    CREATE TABLE IF NOT EXISTS libraries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        is_scanning BOOLEAN DEFAULT FALSE,
        track_count INTEGER DEFAULT 0,
        last_scan TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT NOT NULL DEFAULT '',
        album_artist TEXT,
        genre TEXT,
        year INTEGER,
        track_number INTEGER,
        disc_number INTEGER DEFAULT 1,
        duration_ms INTEGER DEFAULT 0,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        file_modified TEXT,
        format TEXT NOT NULL,
        sample_rate INTEGER,
        bit_depth INTEGER,
        bitrate INTEGER,
        channels INTEGER,
        codec TEXT,
        composer TEXT,
        lyricist TEXT,
        mood TEXT,
        bpm REAL,
        rating INTEGER,
        play_count INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        last_played TEXT,
        date_added TEXT NOT NULL DEFAULT (datetime('now')),
        has_artwork BOOLEAN DEFAULT FALSE,
        artwork_hash TEXT,
        lyrics TEXT,
        comment TEXT,
        grouping TEXT,
        copyright TEXT,
        custom_tags TEXT,
        folder TEXT NOT NULL,
        library_id TEXT NOT NULL,
        fingerprint TEXT,
        FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        year INTEGER,
        genre TEXT,
        track_count INTEGER DEFAULT 0,
        total_duration_ms INTEGER DEFAULT 0,
        has_artwork BOOLEAN DEFAULT FALSE,
        artwork_hash TEXT,
        date_added TEXT NOT NULL DEFAULT (datetime('now')),
        library_id TEXT NOT NULL,
        FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        album_count INTEGER DEFAULT 0,
        track_count INTEGER DEFAULT 0,
        total_duration_ms INTEGER DEFAULT 0,
        has_artwork BOOLEAN DEFAULT FALSE,
        artwork_hash TEXT,
        date_added TEXT NOT NULL DEFAULT (datetime('now')),
        library_id TEXT NOT NULL,
        FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlists (
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
        library_id TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES playlists(id) ON DELETE SET NULL,
        FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_progress (
        library_id TEXT PRIMARY KEY,
        files_found INTEGER DEFAULT 0,
        files_processed INTEGER DEFAULT 0,
        files_skipped INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        is_complete BOOLEAN DEFAULT FALSE,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS artwork_cache (
        track_id TEXT PRIMARY KEY,
        artwork_data BLOB,
        mime_type TEXT,
        width INTEGER,
        height INTEGER,
        hash TEXT NOT NULL,
        cached_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listening_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        played_at TEXT NOT NULL DEFAULT (datetime('now')),
        duration_ms INTEGER,
        completed BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
    CREATE INDEX IF NOT EXISTS idx_tracks_year ON tracks(year);
    CREATE INDEX IF NOT EXISTS idx_tracks_folder ON tracks(folder);
    CREATE INDEX IF NOT EXISTS idx_tracks_library ON tracks(library_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
    CREATE INDEX IF NOT EXISTS idx_tracks_format ON tracks(format);
    CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating);
    CREATE INDEX IF NOT EXISTS idx_tracks_mood ON tracks(mood);
    CREATE INDEX IF NOT EXISTS idx_tracks_date_added ON tracks(date_added);
    CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count);
    CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
    CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);
    CREATE INDEX IF NOT EXISTS idx_albums_library ON albums(library_id);
    CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
    CREATE INDEX IF NOT EXISTS idx_artists_library ON artists(library_id);
    CREATE INDEX IF NOT EXISTS idx_playlists_library ON playlists(library_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
    CREATE INDEX IF NOT EXISTS idx_listening_history_track ON listening_history(track_id);
    CREATE INDEX IF NOT EXISTS idx_listening_history_date ON listening_history(played_at);
    "#
    .to_string()
}
