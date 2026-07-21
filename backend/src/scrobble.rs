use crate::models::{LastfmConfig, ListenbrainzConfig, ScrobblingConfig};
use log::{info, warn};
use reqwest::Client;
use serde_json::json;
use sqlx::SqlitePool;
use std::collections::BTreeMap;

const LASTFM_API_URL: &str = "https://ws.audioscrobbler.com/2.0/";
const LISTENBRAINZ_API_URL: &str = "https://api.listenbrainz.org/1/";

pub struct ScrobbleService {
    client: Client,
}

impl ScrobbleService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn scrobble(
        &self,
        db: &SqlitePool,
        track_id: &str,
        artist: &str,
        track_name: &str,
        album: &str,
        timestamp: i64,
    ) {
        let config = get_scrobbling_config(db).await;

        if config.lastfm.enabled {
            if let Err(e) = self
                .scrobble_lastfm(&config.lastfm, artist, track_name, album, timestamp)
                .await
            {
                warn!("Last.fm scrobble failed: {}. Queuing for retry.", e);
                store_pending_scrobble(db, "lastfm", track_id, artist, track_name, album, timestamp).await;
            }
        }

        if config.listenbrainz.enabled {
            if let Err(e) = self
                .scrobble_listenbrainz(&config.listenbrainz, artist, track_name, album, timestamp)
                .await
            {
                warn!("ListenBrainz scrobble failed: {}. Queuing for retry.", e);
                store_pending_scrobble(db, "listenbrainz", track_id, artist, track_name, album, timestamp).await;
            }
        }
    }

    pub async fn update_now_playing(
        &self,
        db: &SqlitePool,
        artist: &str,
        track_name: &str,
        album: &str,
    ) {
        let config = get_scrobbling_config(db).await;

        if config.lastfm.enabled {
            if let Err(e) = self
                .update_now_playing_lastfm(&config.lastfm, artist, track_name, album)
                .await
            {
                warn!("Last.fm now playing update failed: {}", e);
            }
        }

        if config.listenbrainz.enabled {
            if let Err(e) = self
                .update_now_playing_listenbrainz(&config.listenbrainz, artist, track_name, album)
                .await
            {
                warn!("ListenBrainz now playing update failed: {}", e);
            }
        }
    }

    pub async fn retry_pending_scrobbles(&self, db: &SqlitePool) {
        let pending = sqlx::query_as::<_, (i64, String, String, String, String, Option<String>, i64)>(
            "SELECT id, service, track_id, artist, track_name, album, timestamp FROM pending_scrobbles WHERE attempts < max_attempts ORDER BY created_at LIMIT 10"
        )
        .fetch_all(db)
        .await
        .unwrap_or_default();

        for (id, service, _track_id, artist, track_name, album, timestamp) in pending {
            let config = get_scrobbling_config(db).await;
            let result = match service.as_str() {
                "lastfm" => {
                    self.scrobble_lastfm(
                        &config.lastfm,
                        &artist,
                        &track_name,
                        album.as_deref().unwrap_or(""),
                        timestamp,
                    )
                    .await
                }
                "listenbrainz" => {
                    self.scrobble_listenbrainz(
                        &config.listenbrainz,
                        &artist,
                        &track_name,
                        album.as_deref().unwrap_or(""),
                        timestamp,
                    )
                    .await
                }
                _ => Ok(()),
            };

            match result {
                Ok(_) => {
                    sqlx::query("DELETE FROM pending_scrobbles WHERE id = ?")
                        .bind(id)
                        .execute(db)
                        .await
                        .ok();
                    info!("Retry successful for pending scrobble id={}", id);
                }
                Err(e) => {
                    sqlx::query("UPDATE pending_scrobbles SET attempts = attempts + 1, last_error = ? WHERE id = ?")
                        .bind(e.to_string())
                        .bind(id)
                        .execute(db)
                        .await
                        .ok();
                }
            }
        }
    }

    async fn scrobble_lastfm(
        &self,
        config: &LastfmConfig,
        artist: &str,
        track: &str,
        album: &str,
        timestamp: i64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let api_key = config.api_key.as_deref().ok_or("Last.fm API key not set")?;
        let session_key = config.session_key.as_deref().ok_or("Last.fm session key not set")?;
        let api_secret = config.api_secret.as_deref().unwrap_or("");

        let mut params = BTreeMap::new();
        params.insert("method", "track.scrobble");
        params.insert("api_key", api_key);
        params.insert("sk", session_key);
        params.insert("artist", artist);
        params.insert("track", track);
        params.insert("album", album);
        let ts = timestamp.to_string();
        params.insert("timestamp", &ts);
        params.insert("format", "json");

        let signature = generate_lastfm_signature(&params, api_secret);
        params.insert("api_sig", &signature);

        let response = self
            .client
            .post(LASTFM_API_URL)
            .form(&params)
            .send()
            .await?;

        let status = response.status();
        let body: serde_json::Value = response.json().await.unwrap_or_default();

        if status.is_success() {
            if let Some(error) = body.get("error") {
                let code = error.as_i64().unwrap_or(0);
                if code != 0 {
                    return Err(format!("Last.fm API error {}: {}", code, body.get("message").unwrap_or(&json!("unknown"))).into());
                }
            }
            info!("Last.fm scrobble successful: {} - {}", artist, track);
            Ok(())
        } else {
            Err(format!("Last.fm HTTP {}: {}", status, body).into())
        }
    }

    async fn scrobble_listenbrainz(
        &self,
        config: &ListenbrainzConfig,
        artist: &str,
        track: &str,
        album: &str,
        timestamp: i64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let token = config.token.as_deref().ok_or("ListenBrainz token not set")?;

        let payload = json!({
            "listen_type": "import",
            "payload": [{
                "track_metadata": {
                    "artist_name": artist,
                    "track_name": track,
                    "release_name": album
                },
                "listened_at": timestamp
            }]
        });

        let response = self
            .client
            .post(format!("{}submit-listens", LISTENBRAINZ_API_URL))
            .header("Authorization", format!("Token {}", token))
            .json(&payload)
            .send()
            .await?;

        let status = response.status();

        if status.is_success() {
            info!("ListenBrainz scrobble successful: {} - {}", artist, track);
            Ok(())
        } else {
            let body = response.text().await.unwrap_or_default();
            Err(format!("ListenBrainz HTTP {}: {}", status, body).into())
        }
    }

    async fn update_now_playing_lastfm(
        &self,
        config: &LastfmConfig,
        artist: &str,
        track: &str,
        album: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let api_key = config.api_key.as_deref().ok_or("Last.fm API key not set")?;
        let session_key = config.session_key.as_deref().ok_or("Last.fm session key not set")?;
        let api_secret = config.api_secret.as_deref().unwrap_or("");

        let mut params = BTreeMap::new();
        params.insert("method", "track.updateNowPlaying");
        params.insert("api_key", api_key);
        params.insert("sk", session_key);
        params.insert("artist", artist);
        params.insert("track", track);
        params.insert("album", album);
        params.insert("format", "json");

        let signature = generate_lastfm_signature(&params, api_secret);
        params.insert("api_sig", &signature);

        let response = self
            .client
            .post(LASTFM_API_URL)
            .form(&params)
            .send()
            .await?;

        let status = response.status();
        if status.is_success() {
            info!("Last.fm now playing updated: {} - {}", artist, track);
            Ok(())
        } else {
            let body = response.text().await.unwrap_or_default();
            Err(format!("Last.fm now playing HTTP {}: {}", status, body).into())
        }
    }

    async fn update_now_playing_listenbrainz(
        &self,
        config: &ListenbrainzConfig,
        artist: &str,
        track: &str,
        album: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let token = config.token.as_deref().ok_or("ListenBrainz token not set")?;

        let payload = json!({
            "listen_type": "playing_now",
            "payload": [{
                "track_metadata": {
                    "artist_name": artist,
                    "track_name": track,
                    "release_name": album
                }
            }]
        });

        let response = self
            .client
            .post(format!("{}submit-listens", LISTENBRAINZ_API_URL))
            .header("Authorization", format!("Token {}", token))
            .json(&payload)
            .send()
            .await?;

        let status = response.status();
        if status.is_success() {
            info!("ListenBrainz now playing updated: {} - {}", artist, track);
            Ok(())
        } else {
            let body = response.text().await.unwrap_or_default();
            Err(format!("ListenBrainz now playing HTTP {}: {}", status, body).into())
        }
    }
}

fn generate_lastfm_signature(params: &BTreeMap<&str, &str>, secret: &str) -> String {
    let mut sig_string = String::new();
    for (key, value) in params {
        if key != &"format" && key != &"callback" {
            sig_string.push_str(key);
            sig_string.push_str(value);
        }
    }
    sig_string.push_str(secret);

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    sig_string.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub async fn get_scrobbling_config(db: &SqlitePool) -> ScrobblingConfig {
    let lastfm_enabled = get_setting(db, "lastfm_enabled").await == Some("true".to_string());
    let lastfm_api_key = get_setting(db, "lastfm_api_key").await;
    let lastfm_api_secret = get_setting(db, "lastfm_api_secret").await;
    let lastfm_session_key = get_setting(db, "lastfm_session_key").await;
    let lastfm_username = get_setting(db, "lastfm_username").await;

    let lb_enabled = get_setting(db, "listenbrainz_enabled").await == Some("true".to_string());
    let lb_token = get_setting(db, "listenbrainz_token").await;

    ScrobblingConfig {
        lastfm: LastfmConfig {
            enabled: lastfm_enabled,
            api_key: lastfm_api_key,
            api_secret: lastfm_api_secret,
            session_key: lastfm_session_key,
            username: lastfm_username,
        },
        listenbrainz: ListenbrainzConfig {
            enabled: lb_enabled,
            token: lb_token,
        },
    }
}

pub async fn save_scrobbling_config(db: &SqlitePool, config: &ScrobblingConfig) {
    set_setting(db, "lastfm_enabled", &config.lastfm.enabled.to_string()).await;
    if let Some(ref v) = config.lastfm.api_key {
        set_setting(db, "lastfm_api_key", v).await;
    }
    if let Some(ref v) = config.lastfm.api_secret {
        set_setting(db, "lastfm_api_secret", v).await;
    }
    if let Some(ref v) = config.lastfm.session_key {
        set_setting(db, "lastfm_session_key", v).await;
    }
    if let Some(ref v) = config.lastfm.username {
        set_setting(db, "lastfm_username", v).await;
    }

    set_setting(db, "listenbrainz_enabled", &config.listenbrainz.enabled.to_string()).await;
    if let Some(ref v) = config.listenbrainz.token {
        set_setting(db, "listenbrainz_token", v).await;
    }
}

async fn get_setting(db: &SqlitePool, key: &str) -> Option<String> {
    sqlx::query_as::<_, (String,)>("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(db)
        .await
        .ok()
        .flatten()
        .map(|row| row.0)
}

async fn set_setting(db: &SqlitePool, key: &str, value: &str) {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))")
        .bind(key)
        .bind(value)
        .execute(db)
        .await
        .ok();
}

async fn store_pending_scrobble(
    db: &SqlitePool,
    service: &str,
    track_id: &str,
    artist: &str,
    track_name: &str,
    album: &str,
    timestamp: i64,
) {
    sqlx::query(
        "INSERT INTO pending_scrobbles (service, track_id, artist, track_name, album, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(service)
    .bind(track_id)
    .bind(artist)
    .bind(track_name)
    .bind(album)
    .bind(timestamp)
    .execute(db)
    .await
    .ok();
}
