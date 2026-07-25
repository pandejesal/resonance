mod auth;
mod db;
mod handlers;
mod importer;
mod lyrics;
mod models;
mod scanner;
mod scrobble;
mod updater;
mod ws;

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use handlers::AppState;
use log::info;
use parking_lot::Mutex;
use scanner::Scanner;
use std::collections::HashMap;
use std::sync::Arc;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "/app/data/resonance.db".to_string());

    let file_path = database_url
        .strip_prefix("sqlite:")
        .unwrap_or(&database_url)
        .split('?')
        .next()
        .unwrap_or(&database_url);

    let db_path = std::path::Path::new(file_path);
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    let sqlite_url = if database_url.starts_with("sqlite:") {
        if database_url.contains("mode=") {
            database_url.clone()
        } else {
            format!("{}?mode=rwc", database_url)
        }
    } else {
        format!("sqlite:{}?mode=rwc", database_url)
    };

    info!("Connecting to database: {}", sqlite_url);

    let database = db::db::Database::new(&sqlite_url)
        .await
        .expect("Failed to connect to database");

    database
        .run_migrations()
        .await
        .expect("Failed to run migrations");

    let scanner = Arc::new(Mutex::new(Scanner::new()));
    let ws_clients = Arc::new(ws::WsClients::new());

    let state = web::Data::new(AppState {
        db: database.pool.clone(),
        scanner,
        ws_clients: ws_clients.clone(),
        cast_targets: Arc::new(parking_lot::Mutex::new(HashMap::new())),
    });

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a number");
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "./static".to_string());

    info!(
        "Starting Resonance server on {}:{} (static: {})",
        host, port, static_dir
    );

    let db_for_updater = database.pool.clone();
    tokio::spawn(async move {
        updater::start_background_check(db_for_updater).await;
    });

    let static_dir_for_server = static_dir.clone();

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);

        let index_path = format!("{}/index.html", static_dir_for_server);
        let static_files = actix_files::Files::new("/", &static_dir_for_server)
            .index_file("index.html")
            .default_handler(
                actix_files::NamedFile::open(&index_path).expect("index.html not found"),
            );

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .route("/api/auth/login", web::post().to(handlers::login_handler))
            .route("/api/auth/logout", web::post().to(handlers::logout_handler))
            .route("/api/auth/me", web::get().to(handlers::get_current_user))
            .route("/api/auth/users", web::get().to(handlers::list_users))
            .route("/api/auth/users", web::post().to(handlers::create_user))
            .route("/api/auth/users/{id}", web::delete().to(handlers::delete_user))
            .route("/api/libraries", web::get().to(handlers::get_libraries))
            .route("/api/libraries", web::post().to(handlers::create_library))
            .route(
                "/api/libraries/{id}",
                web::delete().to(handlers::delete_library),
            )
            .route(
                "/api/libraries/{id}/scan",
                web::post().to(handlers::scan_library),
            )
            .route(
                "/api/libraries/{id}/scan/progress",
                web::get().to(handlers::get_scan_progress),
            )
            .route("/api/tracks", web::get().to(handlers::get_tracks))
            .route("/api/tracks/{id}", web::get().to(handlers::get_track))
            .route("/api/tracks/{id}", web::put().to(handlers::update_track))
            .route(
                "/api/tracks/{id}/play",
                web::post().to(handlers::play_track),
            )
            .route(
                "/api/tracks/{id}/stream",
                web::get().to(handlers::stream_track),
            )
            .route(
                "/api/tracks/{id}/artwork",
                web::get().to(handlers::get_artwork),
            )
            .route(
                "/api/tracks/{id}/waveform",
                web::get().to(handlers::get_waveform),
            )
            .route("/api/albums", web::get().to(handlers::get_albums))
            .route("/api/artists", web::get().to(handlers::get_artists))
            .route("/api/genres", web::get().to(handlers::get_genres))
            .route("/api/folders", web::get().to(handlers::get_folders))
            .route("/api/search", web::get().to(handlers::search))
            .route("/api/stats", web::get().to(handlers::get_stats))
            .route("/api/playlists", web::get().to(handlers::get_playlists))
            .route("/api/playlists", web::post().to(handlers::create_playlist))
            .route(
                "/api/playlists/{id}",
                web::delete().to(handlers::delete_playlist),
            )
            .route(
                "/api/playlists/{id}/tracks",
                web::get().to(handlers::get_playlist_tracks),
            )
            .route(
                "/api/playlists/{id}/tracks",
                web::post().to(handlers::add_track_to_playlist),
            )
            .route(
                "/api/playlists/{id}/shuffle",
                web::post().to(handlers::shuffle_playlist),
            )
            .route(
                "/api/playlists/{id}/sort",
                web::post().to(handlers::sort_playlist),
            )
            .route(
                "/api/playlists/{id}/dedupe",
                web::post().to(handlers::dedupe_playlist),
            )
            .route(
                "/api/playlists/{id}/stats",
                web::get().to(handlers::playlist_stats),
            )
            .route(
                "/api/playlists/{id}/share",
                web::post().to(handlers::share_playlist),
            )
            .route(
                "/api/playlists/generate",
                web::post().to(handlers::generate_playlist),
            )
            .route(
                "/api/settings/transcode",
                web::get().to(handlers::get_transcode_settings),
            )
            .route(
                "/api/settings/transcode",
                web::put().to(handlers::update_transcode_settings),
            )
            .route(
                "/api/tracks/{id}/stream/transcoded",
                web::get().to(handlers::stream_track_transcoded),
            )
            .route("/api/browse", web::get().to(handlers::browse_directory))
            .route(
                "/api/settings/scrobbling",
                web::get().to(handlers::get_scrobbling_settings),
            )
            .route(
                "/api/settings/scrobbling",
                web::put().to(handlers::update_scrobbling_settings),
            )
            .route(
                "/api/settings/scrobbling/test",
                web::post().to(handlers::test_scrobbling),
            )
            .route(
                "/api/tracks/{id}/lyrics",
                web::get().to(handlers::get_lyrics),
            )
            .route(
                "/api/tracks/{id}/lyrics",
                web::put().to(handlers::update_lyrics),
            )
            .route(
                "/api/tracks/{id}/lyrics/fetch",
                web::post().to(handlers::fetch_lyrics),
            )
            .route(
                "/api/updater/status",
                web::get().to(handlers::get_updater_status),
            )
            .route(
                "/api/updater/check",
                web::post().to(handlers::check_for_updates),
            )
            .route(
                "/api/updater/update",
                web::post().to(handlers::apply_update),
            )
            .route(
                "/api/updater/config",
                web::get().to(handlers::get_updater_config),
            )
            .route(
                "/api/updater/config",
                web::put().to(handlers::update_updater_config),
            )
            .route(
                "/api/import/preview",
                web::post().to(handlers::preview_import),
            )
            .route(
                "/api/import/confirm",
                web::post().to(handlers::confirm_import),
            )
            .route(
                "/api/import/formats",
                web::get().to(handlers::get_import_formats),
            )
            .route(
                "/api/import/device",
                web::post().to(handlers::import_device_music),
            )
            .route(
                "/api/transfer/export",
                web::post().to(handlers::export_playlist),
            )
            .route(
                "/api/transfer/platforms",
                web::get().to(handlers::get_transfer_platforms),
            )
            .route(
                "/api/tracks/{id}/rating",
                web::put().to(handlers::update_track_rating),
            )
            .route(
                "/api/playlists/{id}/smart/evaluate",
                web::get().to(handlers::evaluate_smart_playlist),
            )
            .route(
                "/api/playlists/{id}/smart/rules",
                web::put().to(handlers::update_smart_playlist_rules),
            )
            .route(
                "/api/tracks/duplicates",
                web::get().to(handlers::find_duplicates),
            )
            .route(
                "/api/tracks/similar",
                web::get().to(handlers::find_similar_tracks),
            )
            .route(
                "/api/tracks/duplicates/delete",
                web::post().to(handlers::delete_duplicates_batch),
            )
            .route("/api/cast/targets", web::get().to(handlers::list_cast_targets))
            .route("/api/cast/targets", web::post().to(handlers::register_cast_target))
            .route(
                "/api/cast/targets/{id}",
                web::delete().to(handlers::unregister_cast_target),
            )
            .route("/api/cast/play", web::post().to(handlers::cast_play))
            .route("/api/cast/control", web::post().to(handlers::cast_control))
            .route("/api/health", web::get().to(handlers::health_check))
            .service(static_files)
    })
    .bind((host.as_str(), port))?
    .run()
    .await
}
