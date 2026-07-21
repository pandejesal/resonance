use log::info;
use serde::Deserialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportTrack {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    pub platform_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportPreview {
    pub platform: String,
    pub playlist_name: String,
    pub total_tracks: usize,
    pub matched: Vec<MatchedTrack>,
    pub unmatched: Vec<ImportTrack>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MatchedTrack {
    pub import_track: ImportTrack,
    pub track_id: String,
    pub match_type: String,
    pub confidence: f64,
}

#[derive(Debug, Deserialize)]
pub struct SpotifyTrack {
    pub track: Option<SpotifyTrackInner>,
}

#[derive(Debug, Deserialize)]
pub struct SpotifyTrackInner {
    pub name: String,
    pub artists: Vec<SpotifyArtist>,
    pub album: Option<SpotifyAlbum>,
    pub duration_ms: Option<i64>,
    pub id: Option<String>,
    pub uri: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SpotifyArtist {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct SpotifyAlbum {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct SpotifyPlaylist {
    pub name: Option<String>,
    pub tracks: Option<SpotifyPlaylistTracks>,
}

#[derive(Debug, Deserialize)]
pub struct SpotifyPlaylistTracks {
    pub items: Vec<SpotifyTrack>,
}

#[derive(Debug, Deserialize)]
pub struct YoutubeMusicTrack {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct YoutubeMusicPlaylist {
    pub title: Option<String>,
    pub content: Option<Vec<YoutubeMusicTrack>>,
}

#[derive(Debug, Deserialize)]
pub struct AppleMusicTrack {
    pub name: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<f64>,
    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AppleMusicPlaylist {
    pub name: Option<String>,
    pub tracks: Option<Vec<AppleMusicTrack>>,
}

#[derive(Debug, Deserialize)]
pub struct SoundCloudTrack {
    pub title: Option<String>,
    pub user: Option<SoundCloudUser>,
    pub duration: Option<i64>,
    pub id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SoundCloudUser {
    pub username: Option<String>,
}

pub fn normalize(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn parse_spotify(content: &str) -> Result<ImportPreview, String> {
    let data: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut tracks = Vec::new();
    let mut playlist_name = "Spotify Playlist".to_string();

    if let Some(name) = data.get("name").and_then(|v| v.as_str()) {
        playlist_name = name.to_string();
    }

    if let Some(items) = data.get("tracks").and_then(|t| t.get("items")).and_then(|i| i.as_array()) {
        for item in items {
            if let Some(track) = item.get("track") {
                let title = track.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                let artist = track.get("artists")
                    .and_then(|a| a.as_array())
                    .and_then(|a| a.first())
                    .and_then(|a| a.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown")
                    .to_string();
                let album = track.get("album")
                    .and_then(|a| a.get("name"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let duration_ms = track.get("duration_ms").and_then(|v| v.as_i64());
                let id = track.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());

                tracks.push(ImportTrack {
                    title,
                    artist,
                    album,
                    duration_ms,
                    platform_id: id,
                });
            }
        }
    }

    Ok(ImportPreview {
        platform: "spotify".to_string(),
        playlist_name,
        total_tracks: tracks.len(),
        matched: Vec::new(),
        unmatched: tracks,
    })
}

pub fn parse_youtube_music(content: &str) -> Result<ImportPreview, String> {
    let data: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut tracks = Vec::new();
    let mut playlist_name = "YouTube Music Playlist".to_string();

    if let Some(name) = data.get("title").and_then(|v| v.as_str()) {
        playlist_name = name.to_string();
    }

    if let Some(content_arr) = data.get("content").and_then(|c| c.as_array()) {
        for item in content_arr {
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let artist = item.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let album = item.get("album").and_then(|v| v.as_str()).map(|s| s.to_string());
            let duration_ms = item.get("duration_ms").and_then(|v| v.as_i64());
            let id = item.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());

            tracks.push(ImportTrack {
                title,
                artist,
                album,
                duration_ms,
                platform_id: id,
            });
        }
    }

    Ok(ImportPreview {
        platform: "youtube_music".to_string(),
        playlist_name,
        total_tracks: tracks.len(),
        matched: Vec::new(),
        unmatched: tracks,
    })
}

pub fn parse_apple_music(content: &str) -> Result<ImportPreview, String> {
    let data: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut tracks = Vec::new();
    let mut playlist_name = "Apple Music Playlist".to_string();

    if let Some(name) = data.get("name").and_then(|v| v.as_str()) {
        playlist_name = name.to_string();
    }

    if let Some(tracks_arr) = data.get("tracks").and_then(|t| t.as_array()) {
        for item in tracks_arr {
            let title = item.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let artist = item.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let album = item.get("album").and_then(|v| v.as_str()).map(|s| s.to_string());
            let duration_ms = item.get("duration").and_then(|v| v.as_f64()).map(|d| (d * 1000.0) as i64);
            let id = item.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());

            tracks.push(ImportTrack {
                title,
                artist,
                album,
                duration_ms,
                platform_id: id,
            });
        }
    }

    Ok(ImportPreview {
        platform: "apple_music".to_string(),
        playlist_name,
        total_tracks: tracks.len(),
        matched: Vec::new(),
        unmatched: tracks,
    })
}

pub fn parse_soundcloud(content: &str) -> Result<ImportPreview, String> {
    let data: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut tracks = Vec::new();
    let mut playlist_name = "SoundCloud Playlist".to_string();

    if let Some(name) = data.get("title").and_then(|v| v.as_str()) {
        playlist_name = name.to_string();
    }

    let items = if let Some(tracks_arr) = data.get("tracks").and_then(|t| t.as_array()) {
        tracks_arr.clone()
    } else if let Some(arr) = data.as_array() {
        arr.clone()
    } else {
        Vec::new()
    };

    for item in &items {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let artist = item.get("user")
            .and_then(|u| u.get("username"))
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();
        let duration_ms = item.get("duration").and_then(|v| v.as_i64());
        let id = item.get("id").and_then(|v| v.as_i64()).map(|i| i.to_string());

        tracks.push(ImportTrack {
            title,
            artist,
            album: None,
            duration_ms,
            platform_id: id,
        });
    }

    Ok(ImportPreview {
        platform: "soundcloud".to_string(),
        playlist_name,
        total_tracks: tracks.len(),
        matched: Vec::new(),
        unmatched: tracks,
    })
}

pub fn parse_m3u(content: &str) -> Result<ImportPreview, String> {
    let mut tracks = Vec::new();
    let mut title = "M3U Playlist".to_string();

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("#EXTINF:") {
            if let Some(info) = line.strip_prefix("#EXTINF:") {
                let parts: Vec<&str> = info.splitn(2, ',').collect();
                if parts.len() > 1 {
                    let artist_title = parts[1].trim().to_string();
                    let (artist, track_title) = if let Some(pos) = artist_title.find(" - ") {
                        (artist_title[..pos].trim().to_string(), artist_title[pos + 3..].trim().to_string())
                    } else {
                        ("Unknown".to_string(), artist_title)
                    };
                    tracks.push(ImportTrack {
                        title: track_title,
                        artist,
                        album: None,
                        duration_ms: None,
                        platform_id: None,
                    });
                }
            }
        }
    }

    if let Some(first_track) = tracks.first() {
        title = format!("{} - {}", first_track.artist, first_track.title);
        if tracks.len() > 1 {
            title = format!("Imported Playlist ({} tracks)", tracks.len());
        }
    }

    Ok(ImportPreview {
        platform: "m3u".to_string(),
        playlist_name: title,
        total_tracks: tracks.len(),
        matched: Vec::new(),
        unmatched: tracks,
    })
}

pub fn parse_xspf(content: &str) -> Result<ImportPreview, String> {
    let mut tracks = Vec::new();
    let mut playlist_name = "XSPF Playlist".to_string();

    if let Ok(doc) = roxmltree::Document::parse(content) {
        if let Some(root) = doc.root_element().first_child() {
            if let Some(name_node) = root.children().find(|n| n.has_tag_name("title")) {
                playlist_name = name_node.text().unwrap_or("XSPF Playlist").to_string();
            }

            for track_node in root.children().filter(|n| n.has_tag_name("track")) {
                let title = track_node.children()
                    .find(|n| n.has_tag_name("title"))
                    .and_then(|n| n.text())
                    .unwrap_or("Unknown")
                    .to_string();
                let creator = track_node.children()
                    .find(|n| n.has_tag_name("creator"))
                    .and_then(|n| n.text())
                    .unwrap_or("Unknown")
                    .to_string();
                let album = track_node.children()
                    .find(|n| n.has_tag_name("album"))
                    .and_then(|n| n.text())
                    .map(|s| s.to_string());
                let duration_ms = track_node.children()
                    .find(|n| n.has_tag_name("duration"))
                    .and_then(|n| n.text())
                    .and_then(|s| s.parse::<i64>().ok());

                tracks.push(ImportTrack {
                    title,
                    artist: creator,
                    album,
                    duration_ms,
                    platform_id: None,
                });
            }
        }
    }

    Ok(ImportPreview {
        platform: "xspf".to_string(),
        playlist_name,
        total_tracks: tracks.len(),
        matched: Vec::new(),
        unmatched: tracks,
    })
}

pub async fn match_tracks(pool: &SqlitePool, preview: &mut ImportPreview) {
    let db_tracks = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, title, artist, album FROM tracks"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut matched = Vec::new();
    let mut unmatched = Vec::new();

    for import_track in preview.unmatched.drain(..) {
        let norm_title = normalize(&import_track.title);
        let norm_artist = normalize(&import_track.artist);

        let mut best_match: Option<(String, String, f64)> = None;

        for (id, db_title, db_artist, db_album) in &db_tracks {
            let norm_db_title = normalize(db_title);
            let norm_db_artist = normalize(db_artist);

            if norm_title == norm_db_title && norm_artist == norm_db_artist {
                best_match = Some((id.clone(), "exact".to_string(), 1.0));
                break;
            }

            if norm_title.contains(&norm_db_title) || norm_db_title.contains(&norm_title) {
                if norm_artist.contains(&norm_db_artist) || norm_db_artist.contains(&norm_artist) {
                    if best_match.as_ref().map_or(true, |(_, _, conf)| *conf < 0.9) {
                        best_match = Some((id.clone(), "fuzzy".to_string(), 0.9));
                    }
                }
            }

            if (norm_title.contains(&norm_db_title) || norm_db_title.contains(&norm_title)) && best_match.is_none() {
                best_match = Some((id.clone(), "title_only".to_string(), 0.6));
            }
        }

        if let Some((track_id, match_type, confidence)) = best_match {
            matched.push(MatchedTrack {
                import_track,
                track_id,
                match_type,
                confidence,
            });
        } else {
            unmatched.push(import_track);
        }
    }

    preview.matched = matched;
    preview.unmatched = unmatched;
}
