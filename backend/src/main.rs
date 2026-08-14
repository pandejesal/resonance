mod auth;
mod compute_gain;
mod db;
mod handlers;
mod importer;
mod license;
mod license_handlers;
mod lyrics;
mod models;
mod ratelimit;
mod scanner;
mod scrobble;
mod subsonic;
mod updater;
mod watcher;
mod ws;

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use handlers::AppState;
use include_dir::{include_dir, Dir};
use log::info;
use parking_lot::Mutex;
use scanner::Scanner;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

static FRONTEND_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../frontend/dist");

async fn spa_fallback(
    req: actix_web::HttpRequest,
    index_path: actix_web::web::Data<String>,
) -> actix_web::HttpResponse {
    let path = req.path();
    if path.starts_with("/api/") || path.starts_with("/rest/") {
        return actix_web::HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"}));
    }

    let sanitized = path.trim_start_matches('/').replace('\\', "");
    if sanitized.is_empty() || sanitized.contains("..") {
        return serve_index_from_embedded()
            .or_else(|| serve_index_from_fs(index_path.get_ref()))
            .unwrap_or_else(|| actix_web::HttpResponse::NotFound().finish());
    }

    if let Some(file) = FRONTEND_DIR.get_file(&sanitized) {
        let ct = mime_from_path(&sanitized);
        return actix_web::HttpResponse::Ok()
            .content_type(ct)
            .body(file.contents().to_vec());
    }

    serve_index_from_embedded()
        .or_else(|| serve_index_from_fs(index_path.get_ref()))
        .unwrap_or_else(|| actix_web::HttpResponse::NotFound().finish())
}

fn mime_from_path(path: &str) -> &'static str {
    if path.ends_with(".js") || path.ends_with(".mjs") {
        "application/javascript; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".html") || path.ends_with(".htm") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".json") {
        "application/json; charset=utf-8"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".woff2") {
        "font/woff2"
    } else if path.ends_with(".woff") {
        "font/woff"
    } else if path.ends_with(".ttf") {
        "font/ttf"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else if path.ends_with(".wasm") {
        "application/wasm"
    } else if path.ends_with(".map") {
        "application/json"
    } else {
        "application/octet-stream"
    }
}

fn serve_index_from_embedded() -> Option<actix_web::HttpResponse> {
    let file = FRONTEND_DIR.get_file("index.html")?;
    Some(
        actix_web::HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(file.contents().to_vec()),
    )
}

fn serve_index_from_fs(index_path: &str) -> Option<actix_web::HttpResponse> {
    use std::io::Read;
    let mut file = std::fs::File::open(index_path).ok()?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).ok()?;
    Some(
        actix_web::HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(buf),
    )
}

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

    let db_for_watcher = database.pool.clone();
    let scanner_for_watcher = scanner.clone();
    let mut watcher_service = watcher::WatcherService::new(db_for_watcher, scanner_for_watcher);
    match watcher_service.start_watching() {
        Ok(()) => log::info!("Filesystem watcher started"),
        Err(e) => log::warn!("Filesystem watcher failed to start: {}", e),
    }
    let watcher_service = Arc::new(Mutex::new(watcher_service));
    tokio::spawn(async move {
        watcher::start_watching_task(watcher_service).await;
    });

    let state = web::Data::new(AppState {
        db: database.pool.clone(),
        scanner,
        ws_clients: ws_clients.clone(),
        cast_targets: Arc::new(parking_lot::Mutex::new(HashMap::new())),
        fts_ready: Arc::new(AtomicBool::new(false)),
    });

    let db_for_fts = database.pool.clone();
    let fts_ready = state.fts_ready.clone();
    tokio::spawn(async move {
        handlers::fts_backfill(db_for_fts, fts_ready).await;
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
            .allowed_origin("http://localhost:5173")
            .allowed_origin("http://127.0.0.1:5173")
            .allowed_origin("http://127.0.0.1:8080")
            .allowed_origin("http://localhost:8080")
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);

        let index_path = format!("{}/index.html", static_dir_for_server);
        let static_dir_data = web::Data::new(static_dir_for_server.clone());
        let index_path_data = web::Data::new(index_path);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .app_data(static_dir_data)
            .app_data(index_path_data)
            .configure(handlers::register_routes)
            .app_data(web::Data::new(ws_clients.clone()))
            .default_service(web::to(spa_fallback))
    })
    .bind((host.as_str(), port))?
    .run()
    .await
}
