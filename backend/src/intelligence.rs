use crate::handlers::{require_auth, AppState};
use crate::license::License;
use crate::models::Track;
use actix_web::{web, HttpRequest, HttpResponse};
use sqlx::SqlitePool;
use std::collections::{BTreeMap, HashMap, HashSet};

const FEATURE_KEY: &str = "intelligence";

type DecadeMixRow = (i64, String, String, Option<i32>, i64, i64, bool, String);
type TrackAudioProfile = (Option<String>, Option<String>, Option<String>, Option<f64>);

struct IntelligenceGateError {
    tier: String,
    trial_remaining_days: Option<i64>,
}

fn gate_http_error(err: &IntelligenceGateError) -> HttpResponse {
    HttpResponse::Forbidden().json(serde_json::json!({
        "error": "This feature requires a Pro license",
        "feature": FEATURE_KEY,
        "tier": err.tier,
        "trial_remaining_days": err.trial_remaining_days,
    }))
}

async fn require_intelligence(db: &SqlitePool, user_id: &str) -> Result<(), IntelligenceGateError> {
    let status = License::get_status(db, user_id).await;
    if status.features.iter().any(|f| f == FEATURE_KEY) {
        Ok(())
    } else {
        Err(IntelligenceGateError {
            tier: status.tier,
            trial_remaining_days: status.trial_remaining_days,
        })
    }
}

fn parse_limit(query: &web::Query<HashMap<String, String>>) -> i64 {
    query
        .get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(50)
        .clamp(1, 100)
}

fn db_error(context: &str, err: &sqlx::Error) -> HttpResponse {
    log::error!("intelligence {} failed: {:?}", context, err);
    HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
}

async fn forgotten_gems_query(db: &SqlitePool, limit: i64) -> Result<Vec<Track>, sqlx::Error> {
    sqlx::query_as::<_, Track>(
        "SELECT * FROM tracks WHERE rating >= 4 AND (last_played IS NULL OR last_played < datetime('now', '-60 days')) ORDER BY rating DESC, last_played ASC, play_count DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(db)
    .await
}

async fn decade_mixes_query(
    db: &SqlitePool,
    per_decade: i64,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows: Vec<DecadeMixRow> = sqlx::query_as(
        "SELECT (t.year / 10) * 10 AS decade, t.album, t.artist, MAX(t.year) AS year, COUNT(*) AS track_count, SUM(t.play_count) AS plays, MAX(t.has_artwork) AS has_artwork, MAX(t.id) AS artwork_track_id FROM tracks t WHERE t.year IS NOT NULL GROUP BY decade, t.album, t.artist",
    )
    .fetch_all(db)
    .await?;

    let mut by_decade: BTreeMap<i64, Vec<serde_json::Value>> = BTreeMap::new();
    for (decade, album, artist, year, track_count, plays, has_artwork, artwork_track_id) in rows {
        by_decade
            .entry(decade)
            .or_default()
            .push(serde_json::json!({
                "album": album,
                "artist": artist,
                "year": year,
                "track_count": track_count,
                "plays": plays,
                "has_artwork": has_artwork,
                "artwork_track_id": artwork_track_id,
            }));
    }

    let mut mixes = Vec::new();
    for (decade, mut albums) in by_decade {
        albums.sort_by(|a, b| {
            let pa = a["plays"].as_i64().unwrap_or(0);
            let pb = b["plays"].as_i64().unwrap_or(0);
            pb.cmp(&pa)
        });
        albums.truncate(per_decade as usize);
        mixes.push(serde_json::json!({
            "decade": format!("{}s", decade),
            "albums": albums,
        }));
    }
    Ok(mixes)
}

async fn suggested_artists(db: &SqlitePool, limit: i64) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        "SELECT artist FROM tracks WHERE artist != '' GROUP BY artist ORDER BY SUM(play_count) DESC, COUNT(*) DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(db)
    .await
}

fn profile_of(
    rows: &[TrackAudioProfile],
) -> (
    HashSet<String>,
    HashSet<String>,
    HashSet<String>,
    Option<f64>,
) {
    let genres: HashSet<String> = rows.iter().filter_map(|(g, _, _, _)| g.clone()).collect();
    let moods: HashSet<String> = rows.iter().filter_map(|(_, m, _, _)| m.clone()).collect();
    let keys: HashSet<String> = rows.iter().filter_map(|(_, _, k, _)| k.clone()).collect();
    let bpm: Option<f64> = {
        let sum: f64 = rows.iter().filter_map(|(_, _, _, b)| *b).sum();
        let count = rows.iter().filter(|(_, _, _, b)| b.is_some()).count();
        if count > 0 {
            Some(sum / count as f64)
        } else {
            None
        }
    };
    (genres, moods, keys, bpm)
}

async fn sound_alikes_query(
    db: &SqlitePool,
    artist: &str,
    limit: i64,
) -> Result<serde_json::Value, sqlx::Error> {
    let target_rows: Vec<TrackAudioProfile> =
        sqlx::query_as("SELECT genre, mood, musical_key, bpm FROM tracks WHERE artist = ?")
            .bind(artist)
            .fetch_all(db)
            .await?;

    if target_rows.is_empty() {
        return Ok(serde_json::json!({ "artist": artist, "matches": [] }));
    }

    let (target_genres, target_moods, target_keys, target_bpm) = profile_of(&target_rows);

    let candidates: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT t2.artist FROM tracks t1 JOIN tracks t2 ON t2.artist != '' AND t2.artist != t1.artist AND ((t2.genre IS NOT NULL AND t2.genre = t1.genre) OR (t2.mood IS NOT NULL AND t2.mood = t1.mood) OR (t2.musical_key IS NOT NULL AND t2.musical_key = t1.musical_key)) WHERE t1.artist = ? LIMIT 100",
    )
    .bind(artist)
    .fetch_all(db)
    .await?;

    let mut matches = Vec::new();
    for candidate in candidates {
        let rows: Vec<TrackAudioProfile> =
            sqlx::query_as("SELECT genre, mood, musical_key, bpm FROM tracks WHERE artist = ?")
                .bind(&candidate)
                .fetch_all(db)
                .await?;
        let (c_genres, c_moods, c_keys, c_bpm) = profile_of(&rows);

        let mut shared_genres: Vec<String> =
            target_genres.intersection(&c_genres).cloned().collect();
        let mut shared_moods: Vec<String> = target_moods.intersection(&c_moods).cloned().collect();
        let mut shared_keys: Vec<String> = target_keys.intersection(&c_keys).cloned().collect();
        shared_genres.sort();
        shared_moods.sort();
        shared_keys.sort();

        let bpm_match = match (target_bpm, c_bpm) {
            (Some(t), Some(c)) => (t - c).abs() <= t * 0.10,
            _ => false,
        };
        let score = shared_genres.len() * 3
            + shared_moods.len() * 2
            + shared_keys.len() * 2
            + if bpm_match { 2 } else { 0 };

        matches.push(serde_json::json!({
            "artist": candidate,
            "score": score,
            "shared_genres": shared_genres,
            "shared_moods": shared_moods,
            "shared_keys": shared_keys,
            "bpm_match": bpm_match,
        }));
    }

    matches.sort_by(|a, b| {
        b["score"]
            .as_i64()
            .unwrap_or(0)
            .cmp(&a["score"].as_i64().unwrap_or(0))
    });
    matches.truncate(limit as usize);

    Ok(serde_json::json!({ "artist": artist, "matches": matches }))
}

async fn rediscover_query(
    db: &SqlitePool,
    per_mix: i64,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let tracks: Vec<Track> = sqlx::query_as::<_, Track>(
        "SELECT * FROM tracks WHERE play_count > 0 AND last_played >= datetime('now', '-365 days') AND last_played < datetime('now', '-30 days')",
    )
    .fetch_all(db)
    .await?;

    let mut buckets: BTreeMap<String, Vec<Track>> = BTreeMap::new();
    for t in tracks {
        let key = t.genre.clone().unwrap_or_else(|| "Other".to_string());
        buckets.entry(key).or_default().push(t);
    }

    let mut bucket_names: Vec<String> = buckets.keys().cloned().collect();
    bucket_names.sort_by(|a, b| buckets[b].len().cmp(&buckets[a].len()));
    bucket_names.truncate(3);

    let mut mixes = Vec::new();
    for name in bucket_names {
        let mut tracks = buckets.remove(&name).unwrap_or_default();
        tracks.sort_by(|a, b| {
            b.rating
                .unwrap_or(0)
                .cmp(&a.rating.unwrap_or(0))
                .then_with(|| a.last_played.cmp(&b.last_played))
        });
        tracks.truncate(per_mix as usize);
        mixes.push(serde_json::json!({
            "name": format!("Rediscover — {}", name),
            "tracks": tracks,
        }));
    }
    Ok(mixes)
}

pub async fn forgotten_gems(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
    req: HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    if let Err(gate) = require_intelligence(&data.db, &user.id).await {
        return gate_http_error(&gate);
    }
    let limit = parse_limit(&query);
    match forgotten_gems_query(&data.db, limit).await {
        Ok(tracks) => HttpResponse::Ok().json(serde_json::json!({ "tracks": tracks })),
        Err(e) => db_error("forgotten_gems", &e),
    }
}

pub async fn decade_mixes(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
    req: HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    if let Err(gate) = require_intelligence(&data.db, &user.id).await {
        return gate_http_error(&gate);
    }
    let per_decade = parse_limit(&query).min(20);
    match decade_mixes_query(&data.db, per_decade).await {
        Ok(mixes) => HttpResponse::Ok().json(serde_json::json!({ "decades": mixes })),
        Err(e) => db_error("decade_mixes", &e),
    }
}

pub async fn sound_alikes(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
    req: HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    if let Err(gate) = require_intelligence(&data.db, &user.id).await {
        return gate_http_error(&gate);
    }
    let limit = parse_limit(&query).min(25);
    match query.get("artist") {
        Some(artist) if !artist.trim().is_empty() => {
            match sound_alikes_query(&data.db, artist.trim(), limit).await {
                Ok(result) => HttpResponse::Ok().json(result),
                Err(e) => db_error("sound_alikes", &e),
            }
        }
        _ => match suggested_artists(&data.db, 12).await {
            Ok(artists) => HttpResponse::Ok().json(serde_json::json!({ "artists": artists })),
            Err(e) => db_error("sound_alikes", &e),
        },
    }
}

pub async fn rediscover(
    data: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
    req: HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    if let Err(gate) = require_intelligence(&data.db, &user.id).await {
        return gate_http_error(&gate);
    }
    let per_mix = parse_limit(&query).min(15);
    match rediscover_query(&data.db, per_mix).await {
        Ok(mixes) => HttpResponse::Ok().json(serde_json::json!({ "mixes": mixes })),
        Err(e) => db_error("rediscover", &e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        seed(&pool).await;
        pool
    }

    async fn seed(pool: &SqlitePool) {
        sqlx::query("INSERT INTO libraries (id, name, path) VALUES ('lib1', 'Test', '/music')")
            .execute(pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role) VALUES ('u_free', 'freeuser', 'x', 'user'), ('u_pro', 'prouser', 'x', 'user')",
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO licenses (id, license_key, tier, user_id, max_devices) VALUES ('lic1', 'RES-PRO-TEST', 'pro', 'u_pro', 3)",
        )
        .execute(pool)
        .await
        .unwrap();

        insert_track(
            &pool,
            "g1",
            "Gem One",
            "Artist A",
            "Album One",
            Some("Rock"),
            Some(1984),
            Some(120.0),
            Some(5),
            10,
            Some(90),
        )
        .await;
        insert_track(
            &pool,
            "g2",
            "Gem Two",
            "Artist B",
            "Album Two",
            Some("Rock"),
            Some(1985),
            Some(121.0),
            Some(4),
            2,
            None,
        )
        .await;
        insert_track(
            &pool,
            "g3",
            "Not Gem",
            "Artist C",
            "Album Three",
            Some("Jazz"),
            Some(1992),
            Some(90.0),
            Some(3),
            5,
            Some(10),
        )
        .await;
        insert_track(
            &pool,
            "g4",
            "Played Now",
            "Artist A",
            "Album One",
            Some("Rock"),
            Some(1984),
            Some(120.0),
            Some(5),
            20,
            Some(5),
        )
        .await;
        insert_track(
            &pool,
            "r1",
            "Rediscover Me",
            "Artist B",
            "Album Two",
            Some("Rock"),
            Some(1985),
            Some(121.0),
            Some(4),
            3,
            Some(100),
        )
        .await;
        insert_track(
            &pool,
            "r2",
            "Too Recent",
            "Artist A",
            "Album Four",
            Some("Pop"),
            Some(2001),
            Some(110.0),
            Some(4),
            2,
            Some(20),
        )
        .await;
        insert_track(
            &pool,
            "r3",
            "Too Old",
            "Artist C",
            "Album Three",
            Some("Jazz"),
            Some(1992),
            Some(90.0),
            Some(4),
            1,
            Some(400),
        )
        .await;
        insert_track(
            &pool,
            "p1",
            "Jazz Played",
            "Artist C",
            "Album Five",
            Some("Jazz"),
            Some(1992),
            Some(92.0),
            Some(5),
            8,
            Some(200),
        )
        .await;
    }

    async fn insert_track(
        pool: &SqlitePool,
        id: &str,
        title: &str,
        artist: &str,
        album: &str,
        genre: Option<&str>,
        year: Option<i32>,
        bpm: Option<f64>,
        rating: Option<i32>,
        play_count: i32,
        last_played_days_ago: Option<i64>,
    ) {
        let mood = if genre == Some("Rock") {
            Some("Energetic")
        } else {
            None
        };
        let key = if genre == Some("Rock") {
            Some("A")
        } else {
            None
        };
        sqlx::query(
            "INSERT INTO tracks (id, title, artist, album, genre, year, mood, musical_key, bpm, rating, play_count, last_played, duration_ms, file_path, file_name, format, folder, library_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', '-' || ? || ' days') END, 200000, ?, ?, 'FLAC', '/music', 'lib1')",
        )
        .bind(id)
        .bind(title)
        .bind(artist)
        .bind(album)
        .bind(genre)
        .bind(year)
        .bind(mood)
        .bind(key)
        .bind(bpm)
        .bind(rating)
        .bind(play_count)
        .bind(last_played_days_ago)
        .bind(last_played_days_ago)
        .bind(format!("/music/{}.flac", id))
        .bind(format!("{}.flac", id))
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn forgotten_gems_returns_highly_rated_unplayed_tracks_only() {
        let pool = test_pool().await;
        let gems = forgotten_gems_query(&pool, 50).await.unwrap();
        let ids: Vec<&str> = gems.iter().map(|t| t.id.as_str()).collect();
        assert!(
            ids.contains(&"g1"),
            "5-star 90-day-old track should qualify: {:?}",
            ids
        );
        assert!(
            ids.contains(&"g2"),
            "4-star never-played track should qualify: {:?}",
            ids
        );
        assert!(!ids.contains(&"g3"), "3-star track must not qualify");
        assert!(
            !ids.contains(&"g4"),
            "5-star track played 5 days ago must not qualify"
        );
        let pos = |id: &str| ids.iter().position(|&i| i == id).unwrap();
        assert!(pos("g1") < pos("g2"), "5-star gem before 4-star gem");
        assert!(pos("p1") < pos("g2"), "5-star gem before 4-star gem");
    }

    #[tokio::test]
    async fn decade_mixes_groups_albums_by_decade_and_ranks_by_plays() {
        let pool = test_pool().await;
        let mixes = decade_mixes_query(&pool, 20).await.unwrap();
        let decades: Vec<&str> = mixes
            .iter()
            .map(|m| m["decade"].as_str().unwrap())
            .collect();
        assert!(decades.contains(&"1980s"));
        assert!(decades.contains(&"1990s"));
        assert!(decades.contains(&"2000s"));
        let eighties = mixes.iter().find(|m| m["decade"] == "1980s").unwrap();
        let albums = eighties["albums"].as_array().unwrap();
        let first = &albums[0];
        assert!(first["plays"].as_i64().unwrap() >= albums[1]["plays"].as_i64().unwrap());
    }

    #[tokio::test]
    async fn sound_alikes_matches_shared_signals_and_skips_unrelated() {
        let pool = test_pool().await;
        let result = sound_alikes_query(&pool, "Artist A", 25).await.unwrap();
        let matches = result["matches"].as_array().unwrap();
        let artist_b = matches.iter().find(|m| m["artist"] == "Artist B");
        let artist_c = matches.iter().find(|m| m["artist"] == "Artist C");
        assert!(
            artist_b.is_some(),
            "Artist B shares genre/mood/key/bpm: {:?}",
            matches
        );
        assert_eq!(artist_b.unwrap()["score"].as_i64().unwrap(), 9);
        assert!(
            artist_c.is_none(),
            "Artist C (Jazz) must not match Rock artist"
        );
    }

    #[tokio::test]
    async fn rediscover_only_includes_30_to_365_day_window() {
        let pool = test_pool().await;
        let mixes = rediscover_query(&pool, 15).await.unwrap();
        let all_ids: Vec<&str> = mixes
            .iter()
            .flat_map(|m| m["tracks"].as_array().unwrap())
            .filter_map(|t| t["id"].as_str())
            .collect();
        assert!(
            all_ids.contains(&"r1"),
            "100-day-old played track should qualify"
        );
        assert!(
            !all_ids.contains(&"r2"),
            "20-day-old track must not qualify"
        );
        assert!(
            !all_ids.contains(&"r3"),
            "400-day-old track must not qualify"
        );
        assert!(!all_ids.contains(&"g4"), "5-day-old track must not qualify");
        let rock = mixes
            .iter()
            .find(|m| m["name"].as_str().unwrap_or("").contains("Rock"));
        assert!(rock.is_some());
    }

    #[tokio::test]
    async fn sound_alikes_unknown_artist_returns_empty_matches() {
        let pool = test_pool().await;
        let result = sound_alikes_query(&pool, "Nobody", 25).await.unwrap();
        assert_eq!(result["artist"], "Nobody");
        assert_eq!(result["matches"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn gate_allows_pro_and_blocks_free_with_feature_key() {
        let pool = test_pool().await;
        assert!(require_intelligence(&pool, "u_pro").await.is_ok());
        let err = require_intelligence(&pool, "u_free").await.unwrap_err();
        assert_eq!(err.tier, "free");
        let resp = gate_http_error(&err);
        assert_eq!(resp.status(), actix_web::http::StatusCode::FORBIDDEN);
    }
}
