use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub duration_ms: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub file_modified: Option<String>,
    pub format: String,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub bitrate: Option<i32>,
    pub channels: Option<i32>,
    pub codec: Option<String>,
    pub composer: Option<String>,
    pub lyricist: Option<String>,
    pub mood: Option<String>,
    pub bpm: Option<f64>,
    pub rating: Option<i32>,
    pub play_count: i32,
    pub skip_count: i32,
    pub last_played: Option<String>,
    pub date_added: String,
    pub has_artwork: bool,
    pub artwork_hash: Option<String>,
    pub lyrics: Option<String>,
    pub comment: Option<String>,
    pub grouping: Option<String>,
    pub copyright: Option<String>,
    pub custom_tags: Option<String>,
    pub folder: String,
    pub library_id: String,
    pub fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Album {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub track_count: i32,
    pub total_duration_ms: i64,
    pub has_artwork: bool,
    pub artwork_hash: Option<String>,
    pub date_added: String,
    pub library_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub album_count: i32,
    pub track_count: i32,
    pub total_duration_ms: i64,
    pub has_artwork: bool,
    pub artwork_hash: Option<String>,
    pub date_added: String,
    pub library_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_smart: bool,
    pub smart_filter: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: i32,
    pub track_count: i32,
    pub total_duration_ms: i64,
    pub created_at: String,
    pub updated_at: String,
    pub library_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlaylistTrack {
    pub playlist_id: String,
    pub track_id: String,
    pub position: i32,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Library {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_scanning: bool,
    pub track_count: i32,
    pub last_scan: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScanProgress {
    pub library_id: String,
    pub files_found: i32,
    pub files_processed: i32,
    pub files_skipped: i32,
    pub errors: i32,
    pub is_complete: bool,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInfo {
    pub format: String,
    pub codec: String,
    pub sample_rate: i32,
    pub bit_depth: Option<i32>,
    pub bitrate: i32,
    pub channels: i32,
    pub duration_ms: i64,
    pub file_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub search: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub folder: Option<String>,
    pub mood: Option<String>,
    pub min_rating: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i32,
    pub per_page: i32,
    pub total_pages: i32,
}

#[derive(Debug, Serialize)]
pub struct SearchResults {
    pub tracks: Vec<Track>,
    pub albums: Vec<Album>,
    pub artists: Vec<Artist>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePlaylistRequest {
    pub name: String,
    pub description: Option<String>,
    pub is_smart: Option<bool>,
    pub smart_filter: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddTrackToPlaylistRequest {
    pub track_id: String,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTrackRequest {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub rating: Option<i32>,
    pub mood: Option<String>,
    pub bpm: Option<f64>,
    pub lyrics: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLibraryRequest {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct ShufflePlaylistRequest {
    pub mode: Option<String>, // "random", "smart", "no-consecutive-artist"
}

#[derive(Debug, Deserialize)]
pub struct SortPlaylistRequest {
    pub sort_by: String, // "title", "artist", "album", "duration", "year", "date_added", "play_count", "random"
    pub order: Option<String>, // "asc" or "desc"
}

#[derive(Debug, Deserialize)]
pub struct DedupePlaylistRequest {
    pub strategy: Option<String>, // "exact", "title_artist", "fingerprint"
}

#[derive(Debug, Deserialize)]
pub struct GeneratePlaylistRequest {
    pub name: String,
    pub source: String, // "library", "genre", "artist", "mood", "recently_played", "unplayed", "top_rated"
    pub source_value: Option<String>, // genre name, artist name, mood value, etc.
    pub count: Option<i32>,
    pub exclude_explicit: Option<bool>,
    pub min_rating: Option<i32>,
    pub min_duration_ms: Option<i64>,
    pub max_duration_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SharePlaylistRequest {
    pub name: String,
    pub description: Option<String>,
    pub include_metadata: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct PlaylistToolResult {
    pub success: bool,
    pub message: String,
    pub playlist_id: Option<String>,
    pub affected_tracks: Option<i32>,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WSMessage {
    pub msg_type: String,
    pub data: serde_json::Value,
}

impl Track {
    pub fn new(file_path: String, library_id: String) -> Self {
        let path = std::path::Path::new(&file_path);
        let file_name = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let folder = path.parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        Self {
            id: Uuid::new_v4().to_string(),
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            disc_number: None,
            duration_ms: 0,
            file_path,
            file_name,
            file_size: 0,
            file_modified: None,
            format: String::new(),
            sample_rate: None,
            bit_depth: None,
            bitrate: None,
            channels: None,
            codec: None,
            composer: None,
            lyricist: None,
            mood: None,
            bpm: None,
            rating: None,
            play_count: 0,
            skip_count: 0,
            last_played: None,
            date_added: Utc::now().to_rfc3339(),
            has_artwork: false,
            artwork_hash: None,
            lyrics: None,
            comment: None,
            grouping: None,
            copyright: None,
            custom_tags: None,
            folder,
            library_id,
            fingerprint: None,
        }
    }
}
