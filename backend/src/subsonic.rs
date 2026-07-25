use actix_web::http::header::{HeaderName, HeaderValue};
use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::{json, Value};
use std::collections::BTreeMap;

use crate::handlers::AppState;
use crate::models::{Album, Artist, Library, Playlist, Track};

const SUBSONIC_VERSION: &str = "1.16.1";

// ── ID mapping helpers ─────────────────────────────────────────────

fn song_id(id: &str) -> String {
    format!("s{}", id)
}

fn album_id(id: &str) -> String {
    format!("al{}", id)
}

fn artist_id(id: &str) -> String {
    format!("ar{}", id)
}

fn playlist_id_enc(id: &str) -> String {
    format!("pl{}", id)
}

fn strip_prefix(id: &str) -> &str {
    if id.len() > 2
        && (id.starts_with("s")
            || id.starts_with("al")
            || id.starts_with("ar")
            || id.starts_with("pl"))
    {
        &id[2..]
    } else {
        id
    }
}

fn strip_song_prefix(id: &str) -> &str {
    if id.starts_with('s') && id.len() > 1 {
        &id[1..]
    } else {
        id
    }
}

fn strip_album_prefix(id: &str) -> &str {
    if id.starts_with("al") && id.len() > 2 {
        &id[2..]
    } else {
        id
    }
}

fn strip_artist_prefix(id: &str) -> &str {
    if id.starts_with("ar") && id.len() > 2 {
        &id[2..]
    } else {
        id
    }
}

fn strip_playlist_prefix(id: &str) -> &str {
    if id.starts_with("pl") && id.len() > 2 {
        &id[2..]
    } else {
        id
    }
}

// ── Response helpers ───────────────────────────────────────────────

fn ok_response(data: Value) -> HttpResponse {
    let mut response = json!({
        "subsonic-response": {
            "status": "ok",
            "version": SUBSONIC_VERSION,
            "type": "resonance",
        }
    });

    if let (Some(obj), Some(data_obj)) = (
        response
            .get_mut("subsonic-response")
            .and_then(|v| v.as_object_mut()),
        data.as_object(),
    ) {
        for (k, v) in data_obj {
            obj.insert(k.clone(), v.clone());
        }
    }

    HttpResponse::Ok().json(response)
}

fn error_response(code: i32, message: &str) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "subsonic-response": {
            "status": "failed",
            "version": SUBSONIC_VERSION,
            "type": "resonance",
            "error": {
                "code": code,
                "message": message,
            }
        }
    }))
}

fn get_param(params: &Value, key: &str) -> Option<String> {
    params.get(key).and_then(|v| {
        if v.is_string() {
            v.as_str().map(|s| s.to_string())
        } else if v.is_number() {
            v.as_f64().map(|n| n.to_string())
        } else {
            None
        }
    })
}

fn get_param_i64(params: &Value, key: &str) -> Option<i64> {
    params.get(key).and_then(|v| {
        if v.is_string() {
            v.as_str().and_then(|s| s.parse().ok())
        } else if v.is_number() {
            v.as_f64().map(|n| n as i64)
        } else {
            None
        }
    })
}

fn get_param_i32(params: &Value, key: &str, default: i32) -> i32 {
    get_param_i64(params, key).unwrap_or(default as i64) as i32
}

// ── Track → Subsonic song mapping ──────────────────────────────────

fn track_to_song(track: &Track) -> Value {
    json!({
        "id": song_id(&track.id),
        "title": track.title,
        "artist": track.artist,
        "album": track.album,
        "albumId": album_id(&track.album),
        "artistId": artist_id(&track.artist),
        "track": track.track_number.unwrap_or(0),
        "discNumber": track.disc_number.unwrap_or(1),
        "duration": track.duration_ms / 1000,
        "year": track.year.unwrap_or(0),
        "genre": track.genre.as_deref().unwrap_or(""),
        "size": track.file_size,
        "bitRate": track.bitrate.unwrap_or(0),
        "contentType": get_content_type(&track.format),
        "path": track.file_path,
        "playCount": track.play_count,
        "created": track.date_added,
    })
}

fn get_content_type(format: &str) -> &str {
    match format.to_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "wav" => "audio/wav",
        "aiff" | "aif" => "audio/aiff",
        "ogg" => "audio/ogg",
        "opus" => "audio/opus",
        "aac" => "audio/aac",
        "m4a" | "m4b" | "mp4" => "audio/mp4",
        "dsf" | "dff" => "audio/dsd",
        _ => "application/octet-stream",
    }
}

// ── Route configuration ────────────────────────────────────────────

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/rest")
            .route("/ping.view", web::get().to(ping))
            .route("/ping.view", web::post().to(ping))
            .route("/getMusicFolders.view", web::get().to(get_music_folders))
            .route("/getMusicFolders.view", web::post().to(get_music_folders))
            .route("/getArtists.view", web::get().to(get_artists))
            .route("/getArtists.view", web::post().to(get_artists))
            .route("/getAlbumList.view", web::get().to(get_album_list))
            .route("/getAlbumList.view", web::post().to(get_album_list))
            .route("/getAlbum.view", web::get().to(get_album))
            .route("/getAlbum.view", web::post().to(get_album))
            .route(
                "/getSongsByAlbumId.view",
                web::get().to(get_songs_by_album_id),
            )
            .route(
                "/getSongsByAlbumId.view",
                web::post().to(get_songs_by_album_id),
            )
            .route("/stream.view", web::get().to(stream))
            .route("/stream.view", web::post().to(stream))
            .route("/getCoverArt.view", web::get().to(get_cover_art))
            .route("/getCoverArt.view", web::post().to(get_cover_art))
            .route("/search2.view", web::get().to(search2))
            .route("/search2.view", web::post().to(search2))
            .route("/getPlaylists.view", web::get().to(get_playlists))
            .route("/getPlaylists.view", web::post().to(get_playlists))
            .route("/createPlaylist.view", web::get().to(create_playlist))
            .route("/createPlaylist.view", web::post().to(create_playlist))
            .route("/updatePlaylist.view", web::get().to(update_playlist))
            .route("/updatePlaylist.view", web::post().to(update_playlist))
            .route("/deletePlaylist.view", web::get().to(delete_playlist))
            .route("/deletePlaylist.view", web::post().to(delete_playlist))
            .route("/scrobble.view", web::get().to(scrobble))
            .route("/scrobble.view", web::post().to(scrobble))
            .route("/getUser.view", web::get().to(get_user))
            .route("/getUser.view", web::post().to(get_user))
            .route("/login.view", web::get().to(login))
            .route("/login.view", web::post().to(login)),
    );
}

// ── Handlers ───────────────────────────────────────────────────────

async fn ping(_data: web::Data<AppState>) -> HttpResponse {
    ok_response(json!({}))
}

async fn get_music_folders(data: web::Data<AppState>) -> HttpResponse {
    let libraries = sqlx::query_as::<_, Library>("SELECT * FROM libraries ORDER BY name")
        .fetch_all(&data.db)
        .await;

    match libraries {
        Ok(libs) => {
            let folders: Vec<Value> = libs
                .iter()
                .map(|lib| {
                    json!({
                        "id": lib.id,
                        "name": lib.name,
                    })
                })
                .collect();
            ok_response(json!({ "musicFolders": { "musicFolder": folders } }))
        }
        Err(e) => error_response(0, &e.to_string()),
    }
}

async fn get_artists(data: web::Data<AppState>) -> HttpResponse {
    let artists = sqlx::query_as::<_, Artist>("SELECT * FROM artists ORDER BY name ASC")
        .fetch_all(&data.db)
        .await;

    match artists {
        Ok(artists) => {
            let mut indexed: BTreeMap<String, Vec<Value>> = BTreeMap::new();

            for artist in &artists {
                let first_char = artist
                    .name
                    .chars()
                    .next()
                    .map(|c| {
                        if c.is_ascii_alphanumeric() {
                            c.to_uppercase().to_string()
                        } else {
                            "#".to_string()
                        }
                    })
                    .unwrap_or_else(|| "#".to_string());

                indexed.entry(first_char).or_default().push(json!({
                    "id": artist_id(&artist.id),
                    "name": artist.name,
                    "albumCount": artist.album_count,
                    "artistImageUrl": null,
                }));
            }

            let index_list: Vec<Value> = indexed
                .into_iter()
                .map(|(letter, artists)| {
                    json!({
                        "name": letter,
                        "artist": artists,
                    })
                })
                .collect();

            ok_response(json!({
                "artists": {
                    "index": index_list,
                }
            }))
        }
        Err(e) => error_response(0, &e.to_string()),
    }
}

async fn get_album_list(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let album_type = get_param(&query, "type").unwrap_or_else(|| "newest".to_string());
    let size = get_param_i32(&query, "size", 50);
    let offset = get_param_i32(&query, "offset", 0);

    let order_clause = match album_type.as_str() {
        "newest" => "date_added DESC",
        "recent" => "date_added DESC",
        "frequent" => "total_duration_ms DESC",
        "random" => "RANDOM()",
        "starred" => "date_added DESC",
        "alphabeticalByName" => "title ASC",
        "alphabeticalByArtist" => "artist ASC",
        "byYear" => "year DESC",
        "byGenre" => "genre ASC",
        _ => "date_added DESC",
    };

    let sql = format!(
        "SELECT * FROM albums ORDER BY {} LIMIT {} OFFSET {}",
        order_clause, size, offset
    );

    let albums = sqlx::query_as::<_, Album>(&sql)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default();

    let album_list: Vec<Value> = albums
        .iter()
        .map(|a| {
            json!({
                "id": album_id(&a.id),
                "name": a.title,
                "artist": a.artist,
                "artistId": artist_id(&a.artist),
                "coverArt": album_id(&a.id),
                "songCount": a.track_count,
                "duration": a.total_duration_ms / 1000,
                "playCount": 0,
                "year": a.year.unwrap_or(0),
                "genre": a.genre.as_deref().unwrap_or(""),
                "created": a.date_added,
            })
        })
        .collect();

    ok_response(json!({
        "albumList": {
            "album": album_list,
        }
    }))
}

async fn get_album(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let id = match get_param(&query, "id") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: id"),
    };

    let album_uuid = strip_album_prefix(&id);

    let album = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
        .bind(album_uuid)
        .fetch_one(&data.db)
        .await;

    match album {
        Ok(album) => {
            let tracks = sqlx::query_as::<_, Track>(
                "SELECT * FROM tracks WHERE album = ? ORDER BY disc_number ASC, track_number ASC",
            )
            .bind(&album.title)
            .fetch_all(&data.db)
            .await
            .unwrap_or_default();

            let song_list: Vec<Value> = tracks.iter().map(|t| track_to_song(t)).collect();

            ok_response(json!({
                "album": {
                    "id": album_id(&album.id),
                    "name": album.title,
                    "artist": album.artist,
                    "artistId": artist_id(&album.artist),
                    "coverArt": album_id(&album.id),
                    "songCount": album.track_count,
                    "duration": album.total_duration_ms / 1000,
                    "playCount": 0,
                    "year": album.year.unwrap_or(0),
                    "genre": album.genre.as_deref().unwrap_or(""),
                    "created": album.date_added,
                    "song": song_list,
                }
            }))
        }
        Err(_) => error_response(70, "Album not found"),
    }
}

async fn get_songs_by_album_id(
    data: web::Data<AppState>,
    query: web::Query<Value>,
) -> HttpResponse {
    let id = match get_param(&query, "id") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: id"),
    };

    let album_uuid = strip_album_prefix(&id);

    let tracks = sqlx::query_as::<_, Track>(
        "SELECT t.* FROM tracks t JOIN albums a ON t.album = a.title WHERE a.id = ? ORDER BY t.disc_number ASC, t.track_number ASC"
    )
    .bind(album_uuid)
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    let song_list: Vec<Value> = tracks.iter().map(|t| track_to_song(t)).collect();

    ok_response(json!({
        "songsByAlbumId": {
            "song": song_list,
        }
    }))
}

async fn stream(
    data: web::Data<AppState>,
    query: web::Query<Value>,
    req: HttpRequest,
) -> HttpResponse {
    let id = match get_param(&query, "id") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: id"),
    };

    let track_uuid = strip_song_prefix(&id);

    let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
        .bind(track_uuid)
        .fetch_one(&data.db)
        .await;

    let track = match track {
        Ok(t) => t,
        Err(_) => return error_response(70, "Track not found"),
    };

    let file_path = std::path::Path::new(&track.file_path);
    if !file_path.exists() {
        return error_response(70, "File not found");
    }

    let mime = get_content_type(&track.format);

    match actix_files::NamedFile::open(file_path) {
        Ok(f) => {
            let mut response = f.into_response(&req);
            response.headers_mut().insert(
                HeaderName::from_static("accept-ranges"),
                HeaderValue::from_static("bytes"),
            );
            response.headers_mut().insert(
                HeaderName::from_static("content-type"),
                HeaderValue::from_str(mime)
                    .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
            );
            response
        }
        Err(_) => error_response(70, "Failed to open file"),
    }
}

async fn get_cover_art(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let id = match get_param(&query, "id") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: id"),
    };

    if id.starts_with("al") {
        let album_uuid = strip_album_prefix(&id);

        let track = sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks WHERE album = (SELECT title FROM albums WHERE id = ?) LIMIT 1",
        )
        .bind(album_uuid)
        .fetch_optional(&data.db)
        .await;

        if let Ok(Some(track)) = track {
            let cached = sqlx::query_as::<_, (Vec<u8>, String)>(
                "SELECT artwork_data, mime_type FROM artwork_cache WHERE track_id = ?",
            )
            .bind(&track.id)
            .fetch_optional(&data.db)
            .await;

            if let Ok(Some((art_data, mime))) = cached {
                return HttpResponse::Ok().content_type(mime).body(art_data);
            }

            let file_path = std::path::Path::new(&track.file_path);
            if file_path.exists() {
                if let Ok(Some(artwork)) = crate::scanner::extract_artwork(file_path) {
                    let mime = "image/jpeg".to_string();
                    let _ = sqlx::query(
                        "INSERT OR REPLACE INTO artwork_cache (track_id, artwork_data, mime_type, hash, cached_at) VALUES (?, ?, ?, '', datetime('now'))"
                    )
                    .bind(&track.id)
                    .bind(&artwork)
                    .bind(&mime)
                    .execute(&data.db)
                    .await;

                    return HttpResponse::Ok().content_type(mime).body(artwork);
                }
            }
        }
    } else if id.starts_with('s') {
        let track_uuid = strip_song_prefix(&id);

        let cached = sqlx::query_as::<_, (Vec<u8>, String)>(
            "SELECT artwork_data, mime_type FROM artwork_cache WHERE track_id = ?",
        )
        .bind(track_uuid)
        .fetch_optional(&data.db)
        .await;

        if let Ok(Some((art_data, mime))) = cached {
            return HttpResponse::Ok().content_type(mime).body(art_data);
        }

        let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
            .bind(track_uuid)
            .fetch_optional(&data.db)
            .await;

        if let Ok(Some(track)) = track {
            let file_path = std::path::Path::new(&track.file_path);
            if file_path.exists() {
                if let Ok(Some(artwork)) = crate::scanner::extract_artwork(file_path) {
                    let mime = "image/jpeg".to_string();
                    let _ = sqlx::query(
                        "INSERT OR REPLACE INTO artwork_cache (track_id, artwork_data, mime_type, hash, cached_at) VALUES (?, ?, ?, '', datetime('now'))"
                    )
                    .bind(&track.id)
                    .bind(&artwork)
                    .bind(&mime)
                    .execute(&data.db)
                    .await;

                    return HttpResponse::Ok().content_type(mime).body(artwork);
                }
            }
        }
    }

    error_response(70, "Cover art not found")
}

async fn search2(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let search_query = match get_param(&query, "query") {
        Some(q) => q,
        None => return error_response(10, "Missing parameter: query"),
    };

    let artist_count = get_param_i32(&query, "artistCount", 20);
    let album_count = get_param_i32(&query, "albumCount", 20);
    let song_count = get_param_i32(&query, "songCount", 20);
    let music_folder_id = get_param(&query, "musicFolderId");

    let like_pattern = format!("%{}%", search_query.replace('\'', "''"));

    let artists = if let Some(ref folder_id) = music_folder_id {
        sqlx::query_as::<_, Artist>(
            "SELECT * FROM artists WHERE name LIKE ?1 AND library_id = ?2 ORDER BY name LIMIT ?3",
        )
        .bind(&like_pattern)
        .bind(folder_id)
        .bind(artist_count)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, Artist>(
            "SELECT * FROM artists WHERE name LIKE ?1 ORDER BY name LIMIT ?2",
        )
        .bind(&like_pattern)
        .bind(artist_count)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default()
    };

    let albums = if let Some(ref folder_id) = music_folder_id {
        sqlx::query_as::<_, Album>(
            "SELECT * FROM albums WHERE (title LIKE ?1 OR artist LIKE ?1) AND library_id = ?2 ORDER BY title LIMIT ?3"
        )
        .bind(&like_pattern)
        .bind(folder_id)
        .bind(album_count)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, Album>(
            "SELECT * FROM albums WHERE title LIKE ?1 OR artist LIKE ?1 ORDER BY title LIMIT ?2",
        )
        .bind(&like_pattern)
        .bind(album_count)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default()
    };

    let songs = if let Some(ref folder_id) = music_folder_id {
        sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks WHERE (title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1) AND library_id = ?2 ORDER BY title LIMIT ?3"
        )
        .bind(&like_pattern)
        .bind(folder_id)
        .bind(song_count)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, Track>(
            "SELECT * FROM tracks WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 ORDER BY title LIMIT ?2"
        )
        .bind(&like_pattern)
        .bind(song_count)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default()
    };

    let artist_results: Vec<Value> = artists
        .iter()
        .map(|a| {
            json!({
                "id": artist_id(&a.id),
                "name": a.name,
                "albumCount": a.album_count,
                "artistImageUrl": null,
            })
        })
        .collect();

    let album_results: Vec<Value> = albums
        .iter()
        .map(|a| {
            json!({
                "id": album_id(&a.id),
                "name": a.title,
                "artist": a.artist,
                "artistId": artist_id(&a.artist),
                "coverArt": album_id(&a.id),
                "songCount": a.track_count,
                "duration": a.total_duration_ms / 1000,
                "year": a.year.unwrap_or(0),
                "genre": a.genre.as_deref().unwrap_or(""),
            })
        })
        .collect();

    let song_results: Vec<Value> = songs.iter().map(|t| track_to_song(t)).collect();

    ok_response(json!({
        "searchResult2": {
            "artist": artist_results,
            "album": album_results,
            "song": song_results,
        }
    }))
}

async fn get_playlists(data: web::Data<AppState>) -> HttpResponse {
    let playlists =
        sqlx::query_as::<_, Playlist>("SELECT * FROM playlists ORDER BY sort_order, name")
            .fetch_all(&data.db)
            .await;

    match playlists {
        Ok(lists) => {
            let playlist_list: Vec<Value> = lists
                .iter()
                .map(|p| {
                    json!({
                        "id": playlist_id_enc(&p.id),
                        "name": p.name,
                        "songCount": p.track_count,
                        "duration": p.total_duration_ms / 1000,
                        "owner": "admin",
                        "public": false,
                        "created": p.created_at,
                        "changed": p.updated_at,
                    })
                })
                .collect();

            ok_response(json!({
                "playlists": {
                    "playlist": playlist_list,
                }
            }))
        }
        Err(e) => error_response(0, &e.to_string()),
    }
}

async fn create_playlist(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let name = match get_param(&query, "name") {
        Some(n) => n,
        None => return error_response(10, "Missing parameter: name"),
    };

    let song_ids: Vec<String> = query
        .get("songId")
        .and_then(|v| {
            if v.is_array() {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
            } else if v.is_string() {
                v.as_str().map(|s| vec![s.to_string()])
            } else {
                None
            }
        })
        .unwrap_or_default();

    let id = uuid::Uuid::new_v4().to_string();

    let result = sqlx::query(
        "INSERT INTO playlists (id, name, description, is_smart, smart_filter, parent_id, library_id) VALUES (?, ?, NULL, FALSE, NULL, NULL, '')"
    )
    .bind(&id)
    .bind(&name)
    .execute(&data.db)
    .await;

    if let Err(e) = result {
        return error_response(0, &e.to_string());
    }

    for (pos, song_id) in song_ids.iter().enumerate() {
        let track_uuid = strip_song_prefix(song_id);
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, datetime('now'))"
        )
        .bind(&id)
        .bind(track_uuid)
        .bind(pos as i32)
        .execute(&data.db)
        .await;
    }

    let _ = sqlx::query(
        "UPDATE playlists SET track_count = (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?), updated_at = datetime('now') WHERE id = ?"
    )
    .bind(&id)
    .bind(&id)
    .execute(&data.db)
    .await;

    ok_response(json!({
        "playlist": {
            "id": playlist_id_enc(&id),
            "name": name,
            "songCount": song_ids.len(),
        }
    }))
}

async fn update_playlist(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let playlist_id_str = match get_param(&query, "playlistId") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: playlistId"),
    };

    let playlist_uuid = strip_playlist_prefix(&playlist_id_str);

    if let Some(name) = get_param(&query, "name") {
        let _ =
            sqlx::query("UPDATE playlists SET name = ?, updated_at = datetime('now') WHERE id = ?")
                .bind(&name)
                .bind(playlist_uuid)
                .execute(&data.db)
                .await;
    }

    let song_ids: Vec<String> = query
        .get("songId")
        .and_then(|v| {
            if v.is_array() {
                v.as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
            } else if v.is_string() {
                v.as_str().map(|s| vec![s.to_string()])
            } else {
                None
            }
        })
        .unwrap_or_default();

    if !song_ids.is_empty() {
        let max_pos: i32 = sqlx::query_scalar::<_, i32>(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_tracks WHERE playlist_id = ?",
        )
        .bind(playlist_uuid)
        .fetch_one(&data.db)
        .await
        .unwrap_or(-1);

        for (i, song_id) in song_ids.iter().enumerate() {
            let track_uuid = strip_song_prefix(song_id);
            let _ = sqlx::query(
                "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, datetime('now'))"
            )
            .bind(playlist_uuid)
            .bind(track_uuid)
            .bind(max_pos + 1 + i as i32)
            .execute(&data.db)
            .await;
        }
    }

    if let Some(remove_indices) = query.get("songIndexToRemove") {
        let indices: Vec<i32> = if let Some(arr) = remove_indices.as_array() {
            arr.iter()
                .filter_map(|v| v.as_i64().map(|n| n as i32))
                .collect()
        } else if let Some(n) = remove_indices.as_i64() {
            vec![n as i32]
        } else {
            vec![]
        };

        for idx in indices {
            let _ = sqlx::query(
                "DELETE FROM playlist_tracks WHERE id IN (SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position LIMIT 1 OFFSET ?)"
            )
            .bind(playlist_uuid)
            .bind(idx)
            .execute(&data.db)
            .await;
        }
    }

    let _ = sqlx::query(
        "UPDATE playlists SET track_count = (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?), updated_at = datetime('now') WHERE id = ?"
    )
    .bind(playlist_uuid)
    .bind(playlist_uuid)
    .execute(&data.db)
    .await;

    ok_response(json!({}))
}

async fn delete_playlist(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let id = match get_param(&query, "id") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: id"),
    };

    let playlist_uuid = strip_playlist_prefix(&id);

    let _ = sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ?")
        .bind(playlist_uuid)
        .execute(&data.db)
        .await;

    let result = sqlx::query("DELETE FROM playlists WHERE id = ?")
        .bind(playlist_uuid)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => ok_response(json!({})),
        Err(e) => error_response(0, &e.to_string()),
    }
}

async fn scrobble(data: web::Data<AppState>, query: web::Query<Value>) -> HttpResponse {
    let id = match get_param(&query, "id") {
        Some(id) => id,
        None => return error_response(10, "Missing parameter: id"),
    };

    let submission = get_param(&query, "submission")
        .map(|s| s == "true" || s == "1")
        .unwrap_or(true);

    let track_uuid = strip_song_prefix(&id);

    let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
        .bind(track_uuid)
        .fetch_one(&data.db)
        .await;

    match track {
        Ok(_track) => {
            if submission {
                sqlx::query("UPDATE tracks SET play_count = play_count + 1, last_played = datetime('now') WHERE id = ?")
                    .bind(track_uuid)
                    .execute(&data.db)
                    .await
                    .ok();

                sqlx::query("INSERT INTO listening_history (track_id, played_at) VALUES (?, datetime('now'))")
                    .bind(track_uuid)
                    .execute(&data.db)
                    .await
                    .ok();
            }
            ok_response(json!({}))
        }
        Err(_) => error_response(70, "Track not found"),
    }
}

async fn get_user(_data: web::Data<AppState>) -> HttpResponse {
    ok_response(json!({
        "user": {
            "username": "admin",
            "email": "admin@resonance.local",
            "scrobblingEnabled": true,
            "adminRole": true,
            "settingsRole": true,
            "downloadRole": true,
            "uploadRole": true,
            "playlistRole": true,
            "coverArtRole": true,
            "commentRole": true,
            "podcastRole": true,
            "streamRole": true,
            "nowPlayingRole": true,
            "internetRadioRole": true,
            "userRole": true,
            "musicFolderId": null,
            "lastLogin": "2026-01-01T00:00:00",
        }
    }))
}

async fn login(_data: web::Data<AppState>) -> HttpResponse {
    ok_response(json!({}))
}
