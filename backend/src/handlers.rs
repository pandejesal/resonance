use actix_web::{web, HttpResponse, HttpRequest};
use actix_web::http::header::{HeaderName, HeaderValue};
use sqlx::SqlitePool;
use crate::models::*;
use crate::scanner::Scanner;
use std::sync::Arc;
use parking_lot::Mutex;

pub struct AppState {
    pub db: SqlitePool,
    pub scanner: Arc<Mutex<Scanner>>,
}

pub async fn get_libraries(data: web::Data<AppState>) -> HttpResponse {
    let libraries = sqlx::query_as::<_, Library>("SELECT * FROM libraries ORDER BY name")
        .fetch_all(&data.db)
        .await;

    match libraries {
        Ok(libs) => HttpResponse::Ok().json(libs),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn create_library(
    data: web::Data<AppState>,
    body: web::Json<CreateLibraryRequest>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let result = sqlx::query(
        "INSERT INTO libraries (id, name, path) VALUES (?, ?, ?)"
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&body.path)
    .execute(&data.db)
    .await;

    match result {
        Ok(_) => {
            let library = sqlx::query_as::<_, Library>("SELECT * FROM libraries WHERE id = ?")
                .bind(&id)
                .fetch_one(&data.db)
                .await;
            match library {
                Ok(lib) => HttpResponse::Created().json(lib),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn delete_library(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM libraries WHERE id = ?")
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn scan_library(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let library_id = path.into_inner();

    let library = sqlx::query_as::<_, Library>("SELECT * FROM libraries WHERE id = ?")
        .bind(&library_id)
        .fetch_one(&data.db)
        .await;

    let library = match library {
        Ok(lib) => lib,
        Err(_) => return HttpResponse::NotFound().json(serde_json::json!({"error": "Library not found"})),
    };

    let scanner = data.scanner.lock();
    let state = scanner.scan_library(library_id.clone(), library.path.clone());
    let is_scanning = state.is_scanning.clone();
    let files_found = state.files_found.clone();
    let files_processed = state.files_processed.clone();
    let files_skipped = state.files_skipped.clone();
    let errors = state.errors.clone();
    drop(state);
    drop(scanner);

    let db = data.db.clone();
    let lib_id = library_id.clone();
    let lib_path = library.path.clone();

    tokio::spawn(async move {
        sqlx::query("UPDATE libraries SET is_scanning = TRUE WHERE id = ?")
            .bind(&lib_id)
            .execute(&db)
            .await
            .ok();

        sqlx::query(
            "INSERT OR REPLACE INTO scan_progress (library_id, files_found, files_processed, files_skipped, errors, is_complete, started_at) VALUES (?, 0, 0, 0, 0, FALSE, datetime('now'))"
        )
        .bind(&lib_id)
        .execute(&db)
        .await
        .ok();

        let files = Scanner::collect_files(&lib_path);
        files_found.store(files.len() as i32, std::sync::atomic::Ordering::Relaxed);

        let scan_state = crate::scanner::LibraryScanState {
            is_scanning: is_scanning.clone(),
            files_found: files_found.clone(),
            files_processed: files_processed.clone(),
            files_skipped: files_skipped.clone(),
            errors: errors.clone(),
        };

        let tracks = Scanner::scan_files_parallel(files, &lib_id, &scan_state);

        let mut tx = db.begin().await.unwrap();

        for track in &tracks {
            let _ = sqlx::query(
                r#"INSERT OR REPLACE INTO tracks (
                    id, title, artist, album, album_artist, genre, year, track_number,
                    disc_number, duration_ms, file_path, file_name, file_size, file_modified,
                    format, sample_rate, bit_depth, bitrate, channels, codec, composer,
                    lyricist, mood, bpm, rating, play_count, skip_count, last_played,
                    date_added, has_artwork, artwork_hash, lyrics, comment, grouping,
                    copyright, custom_tags, folder, library_id, fingerprint
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#
            )
            .bind(&track.id)
            .bind(&track.title)
            .bind(&track.artist)
            .bind(&track.album)
            .bind(&track.album_artist)
            .bind(&track.genre)
            .bind(&track.year)
            .bind(&track.track_number)
            .bind(&track.disc_number)
            .bind(&track.duration_ms)
            .bind(&track.file_path)
            .bind(&track.file_name)
            .bind(&track.file_size)
            .bind(&track.file_modified)
            .bind(&track.format)
            .bind(&track.sample_rate)
            .bind(&track.bit_depth)
            .bind(&track.bitrate)
            .bind(&track.channels)
            .bind(&track.codec)
            .bind(&track.composer)
            .bind(&track.lyricist)
            .bind(&track.mood)
            .bind(&track.bpm)
            .bind(&track.rating)
            .bind(&track.play_count)
            .bind(&track.skip_count)
            .bind(&track.last_played)
            .bind(&track.date_added)
            .bind(&track.has_artwork)
            .bind(&track.artwork_hash)
            .bind(&track.lyrics)
            .bind(&track.comment)
            .bind(&track.grouping)
            .bind(&track.copyright)
            .bind(&track.custom_tags)
            .bind(&track.folder)
            .bind(&track.library_id)
            .bind(&track.fingerprint)
            .execute(&mut *tx)
            .await
            .ok();
        }

        tx.commit().await.ok();

        sqlx::query("UPDATE libraries SET is_scanning = FALSE, track_count = ?, last_scan = datetime('now') WHERE id = ?")
            .bind(tracks.len() as i32)
            .bind(&lib_id)
            .execute(&db)
            .await
            .ok();

        sqlx::query("UPDATE scan_progress SET files_processed = ?, is_complete = TRUE WHERE library_id = ?")
            .bind(files_processed.load(std::sync::atomic::Ordering::Relaxed))
            .bind(&lib_id)
            .execute(&db)
            .await
            .ok();
    });

    HttpResponse::Ok().json(serde_json::json!({
        "message": "Scan started",
        "library_id": library_id,
    }))
}

pub async fn get_scan_progress(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let library_id = path.into_inner();
    let scanner = data.scanner.lock();

    match scanner.get_progress(&library_id) {
        Some((found, processed, skipped, errors, is_scanning)) => {
            HttpResponse::Ok().json(serde_json::json!({
                "files_found": found,
                "files_processed": processed,
                "files_skipped": skipped,
                "errors": errors,
                "is_scanning": is_scanning,
            }))
        }
        None => HttpResponse::Ok().json(serde_json::json!({
            "files_found": 0,
            "files_processed": 0,
            "files_skipped": 0,
            "errors": 0,
            "is_scanning": false,
        })),
    }
}

pub async fn get_tracks(
    data: web::Data<AppState>,
    query: web::Query<QueryParams>,
) -> HttpResponse {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).min(500);
    let offset = (page - 1) * per_page;

    let mut where_clauses = vec!["1=1".to_string()];

    if let Some(ref artist) = query.artist {
        where_clauses.push(format!("artist = '{}'", artist.replace('\'', "''")));
    }
    if let Some(ref album) = query.album {
        where_clauses.push(format!("album = '{}'", album.replace('\'', "''")));
    }
    if let Some(ref genre) = query.genre {
        where_clauses.push(format!("genre = '{}'", genre.replace('\'', "''")));
    }
    if let Some(year) = query.year {
        where_clauses.push(format!("year = {}", year));
    }
    if let Some(ref folder) = query.folder {
        where_clauses.push(format!("folder LIKE '{}%'", folder.replace('\'', "''")));
    }
    if let Some(ref mood) = query.mood {
        where_clauses.push(format!("mood = '{}'", mood.replace('\'', "''")));
    }
    if let Some(min_rating) = query.min_rating {
        where_clauses.push(format!("rating >= {}", min_rating));
    }

    let where_str = where_clauses.join(" AND ");
    let count_query = format!("SELECT COUNT(*) FROM tracks WHERE {}", where_str);

    let total: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);

    let sort = query.sort.as_deref().unwrap_or("date_added");
    let order = query.order.as_deref().unwrap_or("DESC");
    let allowed_sorts = [
        "title", "artist", "album", "year", "date_added",
        "duration_ms", "play_count", "rating", "genre",
    ];
    let sort_col = if allowed_sorts.contains(&sort) { sort } else { "date_added" };
    let order_dir = if order.to_uppercase() == "ASC" { "ASC" } else { "DESC" };

    let sql = format!(
        "SELECT * FROM tracks WHERE {} ORDER BY {} {} LIMIT {} OFFSET {}",
        where_str, sort_col, order_dir, per_page, offset
    );

    let tracks = sqlx::query_as::<_, Track>(&sql)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default();

    let total_pages = (total as f64 / per_page as f64).ceil() as i32;

    HttpResponse::Ok().json(PaginatedResponse {
        items: tracks,
        total,
        page,
        per_page,
        total_pages,
    })
}

pub async fn get_track(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
        .bind(&id)
        .fetch_one(&data.db)
        .await;

    match track {
        Ok(t) => HttpResponse::Ok().json(t),
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({"error": "Track not found"})),
    }
}

pub async fn update_track(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateTrackRequest>,
) -> HttpResponse {
    let id = path.into_inner();

    let mut updates = vec![];

    if body.title.is_some() { updates.push("title = ?"); }
    if body.artist.is_some() { updates.push("artist = ?"); }
    if body.album.is_some() { updates.push("album = ?"); }
    if body.genre.is_some() { updates.push("genre = ?"); }
    if body.year.is_some() { updates.push("year = ?"); }
    if body.rating.is_some() { updates.push("rating = ?"); }
    if body.mood.is_some() { updates.push("mood = ?"); }
    if body.bpm.is_some() { updates.push("bpm = ?"); }
    if body.lyrics.is_some() { updates.push("lyrics = ?"); }

    if updates.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "No fields to update"}));
    }

    let sql = format!("UPDATE tracks SET {} WHERE id = ?", updates.join(", "));
    let result = sqlx::query(&sql)
        .bind(&body.title)
        .bind(&body.artist)
        .bind(&body.album)
        .bind(&body.genre)
        .bind(&body.year)
        .bind(&body.rating)
        .bind(&body.mood)
        .bind(&body.bpm)
        .bind(&body.lyrics)
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => {
            let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
                .bind(&id)
                .fetch_one(&data.db)
                .await;
            match track {
                Ok(t) => HttpResponse::Ok().json(t),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn play_track(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();

    sqlx::query("UPDATE tracks SET play_count = play_count + 1, last_played = datetime('now') WHERE id = ?")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    sqlx::query("INSERT INTO listening_history (track_id, played_at) VALUES (?, datetime('now'))")
        .bind(&id)
        .execute(&data.db)
        .await
        .ok();

    HttpResponse::Ok().json(serde_json::json!({"success": true}))
}

pub async fn stream_track(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: HttpRequest,
) -> HttpResponse {
    let id = path.into_inner();
    let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
        .bind(&id)
        .fetch_one(&data.db)
        .await;

    let track = match track {
        Ok(t) => t,
        Err(_) => return HttpResponse::NotFound().finish(),
    };

    let file_path = std::path::Path::new(&track.file_path);
    if !file_path.exists() {
        return HttpResponse::NotFound().finish();
    }

    let mime = get_mime_type(&track.format);

    match actix_files::NamedFile::open(file_path) {
        Ok(f) => {
            let mut response = f.into_response(&req);
            response.headers_mut().insert(
                HeaderName::from_static("accept-ranges"),
                HeaderValue::from_static("bytes"),
            );
            response.headers_mut().insert(
                HeaderName::from_static("content-type"),
                HeaderValue::from_str(mime).unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
            );
            response
        }
        Err(_) => HttpResponse::NotFound().finish(),
    }
}

pub async fn get_artwork(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();

    let cached = sqlx::query_as::<_, (Vec<u8>, String)>(
        "SELECT artwork_data, mime_type FROM artwork_cache WHERE track_id = ?"
    )
    .bind(&id)
    .fetch_optional(&data.db)
    .await;

    if let Ok(Some((art_data, mime))) = cached {
        return HttpResponse::Ok()
            .content_type(mime)
            .body(art_data);
    }

    let track = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE id = ?")
        .bind(&id)
        .fetch_one(&data.db)
        .await;

    let track = match track {
        Ok(t) => t,
        Err(_) => return HttpResponse::NotFound().finish(),
    };

    let file_path = std::path::Path::new(&track.file_path);
    if !file_path.exists() {
        return HttpResponse::NotFound().finish();
    }

    match crate::scanner::extract_artwork(file_path) {
        Ok(Some(artwork)) => {
            let mime = "image/jpeg".to_string();
            let _ = sqlx::query(
                "INSERT OR REPLACE INTO artwork_cache (track_id, artwork_data, mime_type, hash, cached_at) VALUES (?, ?, ?, '', datetime('now'))"
            )
            .bind(&id)
            .bind(&artwork)
            .bind(&mime)
            .execute(&data.db)
            .await;

            HttpResponse::Ok()
                .content_type(mime)
                .body(artwork)
        }
        _ => HttpResponse::NotFound().finish(),
    }
}

pub async fn get_albums(
    data: web::Data<AppState>,
    query: web::Query<QueryParams>,
) -> HttpResponse {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).min(500);
    let offset = (page - 1) * per_page;

    let sort = query.sort.as_deref().unwrap_or("date_added");
    let order = query.order.as_deref().unwrap_or("DESC");
    let sort_col = match sort {
        "title" => "title",
        "artist" => "artist",
        "year" => "year",
        "track_count" => "track_count",
        _ => "date_added",
    };
    let order_dir = if order.to_uppercase() == "ASC" { "ASC" } else { "DESC" };

    let sql = format!(
        "SELECT * FROM albums ORDER BY {} {} LIMIT {} OFFSET {}",
        sort_col, order_dir, per_page, offset
    );

    let albums = sqlx::query_as::<_, Album>(&sql)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default();

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM albums")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);

    let total_pages = (total as f64 / per_page as f64).ceil() as i32;

    HttpResponse::Ok().json(PaginatedResponse {
        items: albums,
        total,
        page,
        per_page,
        total_pages,
    })
}

pub async fn get_artists(
    data: web::Data<AppState>,
    query: web::Query<QueryParams>,
) -> HttpResponse {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).min(500);
    let offset = (page - 1) * per_page;

    let sql = format!(
        "SELECT * FROM artists ORDER BY name ASC LIMIT {} OFFSET {}",
        per_page, offset
    );

    let artists = sqlx::query_as::<_, Artist>(&sql)
        .fetch_all(&data.db)
        .await
        .unwrap_or_default();

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM artists")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);

    let total_pages = (total as f64 / per_page as f64).ceil() as i32;

    HttpResponse::Ok().json(PaginatedResponse {
        items: artists,
        total,
        page,
        per_page,
        total_pages,
    })
}

pub async fn search(
    data: web::Data<AppState>,
    query: web::Query<SearchQuery>,
) -> HttpResponse {
    let q = format!("%{}%", query.q.replace('\'', "''"));
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    let tracks = sqlx::query_as::<_, Track>(
        "SELECT * FROM tracks WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 OR genre LIKE ?1 OR file_name LIKE ?1 OR folder LIKE ?1 OR lyrics LIKE ?1 ORDER BY play_count DESC LIMIT ?2 OFFSET ?3"
    )
    .bind(&q)
    .bind(limit)
    .bind(offset)
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    let albums = sqlx::query_as::<_, Album>(
        "SELECT * FROM albums WHERE title LIKE ?1 OR artist LIKE ?1 ORDER BY track_count DESC LIMIT ?2"
    )
    .bind(&q)
    .bind(limit / 2)
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    let artists = sqlx::query_as::<_, Artist>(
        "SELECT * FROM artists WHERE name LIKE ?1 ORDER BY track_count DESC LIMIT ?2"
    )
    .bind(&q)
    .bind(limit / 2)
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    let total = tracks.len() as i64 + albums.len() as i64 + artists.len() as i64;

    HttpResponse::Ok().json(SearchResults {
        tracks,
        albums,
        artists,
        total,
    })
}

pub async fn get_genres(data: web::Data<AppState>) -> HttpResponse {
    let genres = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT genre FROM tracks WHERE genre IS NOT NULL AND genre != '' ORDER BY genre"
    )
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    HttpResponse::Ok().json(genres)
}

pub async fn get_folders(data: web::Data<AppState>) -> HttpResponse {
    let folders = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT folder FROM tracks ORDER BY folder"
    )
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    HttpResponse::Ok().json(folders)
}

pub async fn get_stats(data: web::Data<AppState>) -> HttpResponse {
    let total_tracks: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tracks")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);
    let total_albums: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM albums")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);
    let total_artists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM artists")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);
    let total_duration: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(duration_ms), 0) FROM tracks")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);
    let total_size: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(file_size), 0) FROM tracks")
        .fetch_one(&data.db)
        .await
        .unwrap_or(0);

    let top_artists = sqlx::query_as::<_, (String, i64)>(
        "SELECT artist, COUNT(*) as track_count FROM tracks GROUP BY artist ORDER BY track_count DESC LIMIT 10"
    )
    .fetch_all(&data.db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(name, track_count)| serde_json::json!({"name": name, "track_count": track_count}))
    .collect::<Vec<_>>();

    let recently_played = sqlx::query_as::<_, Track>(
        "SELECT t.* FROM tracks t JOIN listening_history lh ON t.id = lh.track_id ORDER BY lh.played_at DESC LIMIT 10"
    )
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    let most_played = sqlx::query_as::<_, Track>(
        "SELECT * FROM tracks WHERE play_count > 0 ORDER BY play_count DESC LIMIT 10"
    )
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    HttpResponse::Ok().json(serde_json::json!({
        "total_tracks": total_tracks,
        "total_albums": total_albums,
        "total_artists": total_artists,
        "total_duration_ms": total_duration,
        "total_size_bytes": total_size,
        "top_artists": top_artists,
        "recently_played": recently_played,
        "most_played": most_played,
    }))
}

pub async fn create_playlist(
    data: web::Data<AppState>,
    body: web::Json<CreatePlaylistRequest>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();

    let result = sqlx::query(
        "INSERT INTO playlists (id, name, description, is_smart, smart_filter, parent_id, library_id) VALUES (?, ?, ?, ?, ?, ?, '')"
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.is_smart.unwrap_or(false))
    .bind(&body.smart_filter)
    .bind(&body.parent_id)
    .execute(&data.db)
    .await;

    match result {
        Ok(_) => {
            let playlist = sqlx::query_as::<_, Playlist>("SELECT * FROM playlists WHERE id = ?")
                .bind(&id)
                .fetch_one(&data.db)
                .await;
            match playlist {
                Ok(p) => HttpResponse::Created().json(p),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn get_playlists(
    data: web::Data<AppState>,
) -> HttpResponse {
    let playlists = sqlx::query_as::<_, Playlist>("SELECT * FROM playlists ORDER BY sort_order, name")
        .fetch_all(&data.db)
        .await;

    match playlists {
        Ok(p) => HttpResponse::Ok().json(p),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn add_track_to_playlist(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<AddTrackToPlaylistRequest>,
) -> HttpResponse {
    let playlist_id = path.into_inner();
    let position = body.position.unwrap_or(0);

    let result = sqlx::query(
        "INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .bind(&playlist_id)
    .bind(&body.track_id)
    .bind(position)
    .execute(&data.db)
    .await;

    match result {
        Ok(_) => {
            sqlx::query("UPDATE playlists SET track_count = (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?), updated_at = datetime('now') WHERE id = ?")
                .bind(&playlist_id)
                .bind(&playlist_id)
                .execute(&data.db)
                .await
                .ok();
            HttpResponse::Ok().json(serde_json::json!({"success": true}))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

pub async fn get_playlist_tracks(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let playlist_id = path.into_inner();

    let tracks = sqlx::query_as::<_, Track>(
        "SELECT t.* FROM tracks t JOIN playlist_tracks pt ON t.id = pt.track_id WHERE pt.playlist_id = ? ORDER BY pt.position"
    )
    .bind(&playlist_id)
    .fetch_all(&data.db)
    .await
    .unwrap_or_default();

    HttpResponse::Ok().json(tracks)
}

pub async fn delete_playlist(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM playlists WHERE id = ?")
        .bind(&id)
        .execute(&data.db)
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

fn get_mime_type(format: &str) -> &str {
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
