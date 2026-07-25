pub mod auth;
pub mod db;
pub mod handlers;
pub mod importer;
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
use log::info;
use parking_lot::Mutex;
use scanner::Scanner;
use std::collections::HashMap;
use std::sync::Arc;

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
        let static_files = actix_files::Files::new("/", &static_dir_owned)
            .index_file("index.html")
            .default_handler(
                actix_files::NamedFile::open(&index_path).expect("index.html not found"),
            );

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .configure(subsonic::configure)
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
            .route("/api/ws", web::get().to(ws::ws_handler))
            .app_data(web::Data::new(ws_clients.clone()))
            .service(static_files)
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
                });

                let db_for_updater = database.pool.clone();
                tokio::spawn(async move {
                    updater::start_background_check(db_for_updater).await;
                });

                log::info!("Starting server on {}:{}", host2, port_u16);

                let static_dir_owned = static_dir2.clone();
                let server = HttpServer::new(move || {
                    let cors = Cors::default()
                        .allow_any_origin()
                        .allow_any_method()
                        .allow_any_header()
                        .supports_credentials()
                        .max_age(3600);

                    let index_path = format!("{}/index.html", static_dir_owned);
                    let static_files = actix_files::Files::new("/", &static_dir_owned)
                        .index_file("index.html")
                        .default_handler(
                            actix_files::NamedFile::open(&index_path)
                                .expect("index.html not found"),
                        );

                    App::new()
                        .wrap(cors)
                        .wrap(middleware::Logger::default())
                        .app_data(state.clone())
                        .configure(subsonic::configure)
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
                        .route("/api/ws", web::get().to(ws::ws_handler))
                        .app_data(web::Data::new(ws_clients.clone()))
                        .service(static_files)
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

#[no_mangle]
pub extern "C" fn resonance_start(
    database_url: *const std::os::raw::c_char,
    host: *const std::os::raw::c_char,
    port: u16,
    static_dir: *const std::os::raw::c_char,
) {
    unsafe {
        let db_url = std::ffi::CStr::from_ptr(database_url)
            .to_str()
            .unwrap_or("/data/resonance.db");
        let host_str = std::ffi::CStr::from_ptr(host)
            .to_str()
            .unwrap_or("127.0.0.1");
        let static_str = std::ffi::CStr::from_ptr(static_dir)
            .to_str()
            .unwrap_or("./static");

        std::env::set_var("DATABASE_URL", db_url);
        std::env::set_var("HOST", host_str);
        std::env::set_var("PORT", port.to_string());
        std::env::set_var("STATIC_DIR", static_str);
    }

    let rt = actix_rt::System::new();
    rt.block_on(async {
        let db_url = unsafe {
            std::ffi::CStr::from_ptr(database_url)
                .to_str()
                .unwrap_or("/data/resonance.db")
                .to_string()
        };
        let host_str = unsafe {
            std::ffi::CStr::from_ptr(host)
                .to_str()
                .unwrap_or("127.0.0.1")
                .to_string()
        };
        let static_str = unsafe {
            std::ffi::CStr::from_ptr(static_dir)
                .to_str()
                .unwrap_or("./static")
                .to_string()
        };

        if let Err(e) = start_server(&db_url, &host_str, port, &static_str).await {
            eprintln!("Server error: {}", e);
        }
    });
}
