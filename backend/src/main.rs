mod models;
mod db;
mod scanner;
mod handlers;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpRequest, HttpResponse, middleware};
use actix_web::dev::Service;
use handlers::AppState;
use scanner::Scanner;
use std::sync::Arc;
use parking_lot::Mutex;
use log::info;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "/app/data/resonance.db".to_string());

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

    database.run_migrations().await.expect("Failed to run migrations");

    let scanner = Arc::new(Mutex::new(Scanner::new()));

    let state = web::Data::new(AppState {
        db: database.pool.clone(),
        scanner,
    });

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a number");

    info!("Starting Resonance server on {}:{}", host, port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        let static_files = actix_files::Files::new("/", "./static")
            .index_file("index.html")
            .default_handler(actix_files::NamedFile::open("./static/index.html")
                .expect("index.html not found"));

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .route("/api/libraries", web::get().to(handlers::get_libraries))
            .route("/api/libraries", web::post().to(handlers::create_library))
            .route("/api/libraries/{id}", web::delete().to(handlers::delete_library))
            .route("/api/libraries/{id}/scan", web::post().to(handlers::scan_library))
            .route("/api/libraries/{id}/scan/progress", web::get().to(handlers::get_scan_progress))
            .route("/api/tracks", web::get().to(handlers::get_tracks))
            .route("/api/tracks/{id}", web::get().to(handlers::get_track))
            .route("/api/tracks/{id}", web::put().to(handlers::update_track))
            .route("/api/tracks/{id}/play", web::post().to(handlers::play_track))
            .route("/api/tracks/{id}/stream", web::get().to(handlers::stream_track))
            .route("/api/tracks/{id}/artwork", web::get().to(handlers::get_artwork))
            .route("/api/albums", web::get().to(handlers::get_albums))
            .route("/api/artists", web::get().to(handlers::get_artists))
            .route("/api/genres", web::get().to(handlers::get_genres))
            .route("/api/folders", web::get().to(handlers::get_folders))
            .route("/api/search", web::get().to(handlers::search))
            .route("/api/stats", web::get().to(handlers::get_stats))
            .route("/api/playlists", web::get().to(handlers::get_playlists))
            .route("/api/playlists", web::post().to(handlers::create_playlist))
            .route("/api/playlists/{id}", web::delete().to(handlers::delete_playlist))
            .route("/api/playlists/{id}/tracks", web::get().to(handlers::get_playlist_tracks))
            .route("/api/playlists/{id}/tracks", web::post().to(handlers::add_track_to_playlist))
            .route("/api/browse", web::get().to(handlers::browse_directory))
            .service(static_files)
    })
    .bind((host.as_str(), port))?
    .run()
    .await
}
