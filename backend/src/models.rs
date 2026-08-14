use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub created_at: String,
    pub last_login: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: Option<String>,
}

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
    pub waveform_peaks: Option<String>,
    pub track_gain: Option<f64>,
    pub track_peak: Option<f64>,
    pub album_gain: Option<f64>,
    pub album_peak: Option<f64>,
    pub gain_computed_at: Option<String>,
    pub track_loudness: Option<f64>,
}

impl Track {
    pub async fn insert<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
    {
        sqlx::query(
            "INSERT OR REPLACE INTO tracks (id, title, artist, album, album_artist, genre, year, track_number, disc_number, duration_ms, file_path, file_name, file_size, file_modified, format, sample_rate, bit_depth, bitrate, channels, codec, composer, lyricist, mood, bpm, rating, play_count, skip_count, last_played, date_added, has_artwork, artwork_hash, lyrics, comment, grouping, copyright, custom_tags, folder, library_id, fingerprint, waveform_peaks, track_gain, track_peak, album_gain, album_peak, gain_computed_at, track_loudness) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&self.id)
        .bind(&self.title)
        .bind(&self.artist)
        .bind(&self.album)
        .bind(&self.album_artist)
        .bind(&self.genre)
        .bind(self.year)
        .bind(self.track_number)
        .bind(self.disc_number)
        .bind(self.duration_ms)
        .bind(&self.file_path)
        .bind(&self.file_name)
        .bind(self.file_size)
        .bind(&self.file_modified)
        .bind(&self.format)
        .bind(self.sample_rate)
        .bind(self.bit_depth)
        .bind(self.bitrate)
        .bind(self.channels)
        .bind(&self.codec)
        .bind(&self.composer)
        .bind(&self.lyricist)
        .bind(&self.mood)
        .bind(self.bpm)
        .bind(self.rating)
        .bind(self.play_count)
        .bind(self.skip_count)
        .bind(&self.last_played)
        .bind(&self.date_added)
        .bind(self.has_artwork)
        .bind(&self.artwork_hash)
        .bind(&self.lyrics)
        .bind(&self.comment)
        .bind(&self.grouping)
        .bind(&self.copyright)
        .bind(&self.custom_tags)
        .bind(&self.folder)
        .bind(&self.library_id)
        .bind(&self.fingerprint)
        .bind(&self.waveform_peaks)
        .bind(self.track_gain)
        .bind(self.track_peak)
        .bind(self.album_gain)
        .bind(self.album_peak)
        .bind(&self.gain_computed_at)
        .bind(self.track_loudness)
        .execute(executor)
        .await
        .map(|_| ())
    }
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
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
pub struct QueryParams {
    pub page: Option<i32>,
    pub per_page: Option<i32>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub search: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub artist_id: Option<String>,
    pub album_id: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub folder: Option<String>,
    pub mood: Option<String>,
    pub min_rating: Option<i32>,
    pub recent: Option<bool>,
    pub last_id: Option<String>,
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
    pub playlists: Vec<Playlist>,
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
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub rating: Option<i32>,
    pub mood: Option<String>,
    pub bpm: Option<f64>,
    pub lyrics: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub composer: Option<String>,
    pub musical_key: Option<String>,
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
#[allow(dead_code)]
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
#[allow(dead_code)]
pub struct WSMessage {
    pub msg_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ImportPreviewRequest {
    pub platform: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportConfirmRequest {
    pub platform: String,
    pub playlist_name: String,
    pub tracks: Vec<ImportConfirmTrack>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ImportConfirmTrack {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    pub platform_id: Option<String>,
    pub track_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SmartPlaylistRule {
    pub field: String,
    pub op: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SmartPlaylistConfig {
    pub rules: Vec<SmartPlaylistRule>,
    pub match_all: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastTarget {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub protocol: String,
    pub is_connected: bool,
    pub current_track_id: Option<String>,
    pub volume: f32,
}

#[derive(Debug, Deserialize)]
pub struct CastPlayRequest {
    pub target_id: String,
    pub track_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CastControlRequest {
    pub target_id: String,
    pub action: String,
    pub value: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRatingRequest {
    pub rating: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrobblingConfig {
    pub lastfm: LastfmConfig,
    pub listenbrainz: ListenbrainzConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastfmConfig {
    pub enabled: bool,
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub session_key: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenbrainzConfig {
    pub enabled: bool,
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScrobblingRequest {
    pub lastfm: Option<LastfmConfig>,
    pub listenbrainz: Option<ListenbrainzConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeConfig {
    pub enabled: bool,
    pub format: String,
    pub bitrate: i32,
}

#[derive(Debug, Deserialize, FromRow)]
pub struct SettingRow {
    pub key: String,
    pub value: String,
}

impl Track {
    pub fn new(file_path: String, library_id: String) -> Self {
        let path = std::path::Path::new(&file_path);
        let file_name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let folder = path
            .parent()
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
            waveform_peaks: None,
            track_gain: None,
            track_peak: None,
            album_gain: None,
            album_peak: None,
            gain_computed_at: None,
            track_loudness: None,
        }
    }
}
