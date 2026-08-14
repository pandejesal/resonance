pub mod auth;

pub mod compute_gain;
pub mod db;
pub mod ratelimit;
pub mod handlers;
pub mod importer;
pub mod license;
pub mod license_handlers;
pub mod lyrics;
pub mod models;
pub mod scanner;
pub mod scrobble;
pub mod subsonic;
pub mod updater;
pub mod watcher;
pub mod ws;

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

pub async fn start_server(
    database_url: &str,
    host: &str,
    port: u16,
    static_dir: &str,
) -> std::io::Result<()> {
    let sqlite_url = if database_url.starts_with("sqlite:") {
        if database_url.contains("mode=") {
            database_url.to_string()
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
        scanner: scanner.clone(),
        ws_clients: ws_clients.clone(),
        cast_targets: Arc::new(parking_lot::Mutex::new(HashMap::new())),
        fts_ready: Arc::new(AtomicBool::new(false)),
    });

    let db_for_fts = database.pool.clone();
    let fts_ready = state.fts_ready.clone();
    tokio::spawn(async move {
        handlers::fts_backfill(db_for_fts, fts_ready).await;
    });

    let db_for_updater = database.pool.clone();
    tokio::spawn(async move {
        updater::start_background_check(db_for_updater).await;
    });

    let db_for_watcher = database.pool.clone();
    let scanner_for_watcher = scanner.clone();
    let mut watcher_service = watcher::WatcherService::new(db_for_watcher, scanner_for_watcher);
    match watcher_service.start_watching() {
        Ok(()) => info!("Filesystem watcher started"),
        Err(e) => log::warn!("Filesystem watcher failed to start: {}", e),
    }
    let watcher_service = Arc::new(Mutex::new(watcher_service));
    tokio::spawn(async move {
        watcher::start_watching_task(watcher_service).await;
    });

    let static_dir_owned = static_dir.to_string();

    info!(
        "Starting Resonance server on {}:{} (static: {})",
        host, port, static_dir
    );

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

        let index_path = format!("{}/index.html", static_dir_owned);
        let static_dir_data = web::Data::new(static_dir_owned.clone());
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
    .bind((host, port))?
    .run()
    .await
}

#[cfg(target_os = "android")]
pub mod android {
    use super::*;
    use jni::objects::{JClass, JString};
    use jni::sys::jboolean;
    use jni::JNIEnv;

    #[no_mangle]
    pub extern "system" fn Java_com_pandejesal_resonance_BackendPlugin_startNative(
        mut env: JNIEnv,
        _class: JClass,
        db_path: JString,
        static_dir: JString,
        host: JString,
        port: jni::sys::jint,
    ) -> jboolean {
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

        let db_path: String = match env.get_string(&db_path) {
            Ok(s) => s.into(),
            Err(_) => return false as jboolean,
        };
        let static_dir: String = match env.get_string(&static_dir) {
            Ok(s) => s.into(),
            Err(_) => return false as jboolean,
        };
        let host: String = match env.get_string(&host) {
            Ok(s) => s.into(),
            Err(_) => return false as jboolean,
        };

        let sqlite_url = format!("sqlite:{}?mode=rwc", db_path);
        let port_u16 = port as u16;
        let host2 = host.clone();
        let static_dir2 = static_dir.clone();

        std::thread::spawn(move || {
            let rt = actix_rt::System::new();

            rt.block_on(async move {
                let database = match db::db::Database::new(&sqlite_url).await {
                    Ok(db) => db,
                    Err(e) => {
                        log::error!("Database error: {}", e);
                        return;
                    }
                };

                if let Err(e) = database.run_migrations().await {
                    log::error!("Migration error: {}", e);
                    return;
                }

                let scanner = Arc::new(Mutex::new(Scanner::new()));
                let ws_clients = Arc::new(ws::WsClients::new());
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

                let db_for_updater = database.pool.clone();
                tokio::spawn(async move {
                    updater::start_background_check(db_for_updater).await;
                });

                log::info!("Starting server on {}:{}", host2, port_u16);

                let static_dir_owned = static_dir2.clone();
                let server = HttpServer::new(move || {
                    let cors = Cors::default()
                        .allowed_origin("http://127.0.0.1:8080")
                        .allowed_origin("http://localhost:8080")
                        .allow_any_method()
                        .allow_any_header()
                        .supports_credentials()
                        .max_age(3600);

                    let index_path = format!("{}/index.html", static_dir_owned);
                    let static_dir_data = web::Data::new(static_dir_owned.clone());
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
                .bind((host.as_str(), port_u16));

                match server {
                    Ok(srv) => {
                        if let Err(e) = srv.run().await {
                            log::error!("Server error: {}", e);
                        }
                    }
                    Err(e) => {
                        log::error!("Bind error: {}", e);
                    }
                }
            });
        });

        true as jboolean
    }
}

/// # Safety
///
/// The caller must pass valid, non-null, null-terminated C strings for
/// `database_url`, `host`, and `static_dir`.
#[no_mangle]
pub unsafe extern "C" fn resonance_start(
    database_url: *const std::os::raw::c_char,
    host: *const std::os::raw::c_char,
    port: u16,
    static_dir: *const std::os::raw::c_char,
) {
    let db_url = std::ffi::CStr::from_ptr(database_url)
        .to_str()
        .unwrap_or("/data/resonance.db")
        .to_string();
    let host_str = std::ffi::CStr::from_ptr(host)
        .to_str()
        .unwrap_or("127.0.0.1")
        .to_string();
    let static_str = std::ffi::CStr::from_ptr(static_dir)
        .to_str()
        .unwrap_or("./static")
        .to_string();

    std::env::set_var("DATABASE_URL", &db_url);
    std::env::set_var("HOST", &host_str);
    std::env::set_var("PORT", port.to_string());
    std::env::set_var("STATIC_DIR", &static_str);

    let rt = actix_rt::System::new();
    rt.block_on(async move {
        if let Err(e) = start_server(&db_url, &host_str, port, &static_str).await {
            eprintln!("Server error: {}", e);
        }
    });
}
