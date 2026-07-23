pub mod models;
pub mod db;
pub mod scanner;
pub mod handlers;
pub mod scrobble;
pub mod lyrics;
pub mod updater;
pub mod importer;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware};
use handlers::AppState;
use scanner::Scanner;
use std::sync::Arc;
use parking_lot::Mutex;
use log::info;

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

    database.run_migrations().await.expect("Failed to run migrations");

    let scanner = Arc::new(Mutex::new(Scanner::new()));

    let state = web::Data::new(AppState {
        db: database.pool.clone(),
        scanner,
    });

    let db_for_updater = database.pool.clone();
    tokio::spawn(async move {
        updater::start_background_check(db_for_updater).await;
    });

    let static_dir_owned = static_dir.to_string();

    info!("Starting Resonance server on {}:{} (static: {})", host, port, static_dir);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        let index_path = format!("{}/index.html", static_dir_owned);
        let static_files = actix_files::Files::new("/", &static_dir_owned)
            .index_file("index.html")
            .default_handler(actix_files::NamedFile::open(&index_path)
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
            .route("/api/playlists/{id}/shuffle", web::post().to(handlers::shuffle_playlist))
            .route("/api/playlists/{id}/sort", web::post().to(handlers::sort_playlist))
            .route("/api/playlists/{id}/dedupe", web::post().to(handlers::dedupe_playlist))
            .route("/api/playlists/{id}/stats", web::get().to(handlers::playlist_stats))
            .route("/api/playlists/{id}/share", web::post().to(handlers::share_playlist))
            .route("/api/playlists/generate", web::post().to(handlers::generate_playlist))
            .route("/api/browse", web::get().to(handlers::browse_directory))
            .route("/api/settings/scrobbling", web::get().to(handlers::get_scrobbling_settings))
            .route("/api/settings/scrobbling", web::put().to(handlers::update_scrobbling_settings))
            .route("/api/settings/scrobbling/test", web::post().to(handlers::test_scrobbling))
            .route("/api/tracks/{id}/lyrics", web::get().to(handlers::get_lyrics))
            .route("/api/tracks/{id}/lyrics", web::put().to(handlers::update_lyrics))
            .route("/api/tracks/{id}/lyrics/fetch", web::post().to(handlers::fetch_lyrics))
            .route("/api/updater/status", web::get().to(handlers::get_updater_status))
            .route("/api/updater/check", web::post().to(handlers::check_for_updates))
            .route("/api/updater/update", web::post().to(handlers::apply_update))
            .route("/api/updater/config", web::get().to(handlers::get_updater_config))
            .route("/api/updater/config", web::put().to(handlers::update_updater_config))
            .route("/api/import/preview", web::post().to(handlers::preview_import))
            .route("/api/import/confirm", web::post().to(handlers::confirm_import))
            .route("/api/import/formats", web::get().to(handlers::get_import_formats))
            .service(static_files)
    })
    .bind((host, port))?
    .run()
    .await
}

#[cfg(target_os = "android")]
pub mod android {
    use super::*;
    use jni::JNIEnv;
    use jni::objects::{JClass, JString};
    use jni::sys::jboolean;

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
                let state = web::Data::new(AppState {
                    db: database.pool.clone(),
                    scanner,
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
                        .route("/api/playlists/{id}/shuffle", web::post().to(handlers::shuffle_playlist))
                        .route("/api/playlists/{id}/sort", web::post().to(handlers::sort_playlist))
                        .route("/api/playlists/{id}/dedupe", web::post().to(handlers::dedupe_playlist))
                        .route("/api/playlists/{id}/stats", web::get().to(handlers::playlist_stats))
                        .route("/api/playlists/{id}/share", web::post().to(handlers::share_playlist))
                        .route("/api/playlists/generate", web::post().to(handlers::generate_playlist))
                        .route("/api/browse", web::get().to(handlers::browse_directory))
                        .route("/api/settings/scrobbling", web::get().to(handlers::get_scrobbling_settings))
                        .route("/api/settings/scrobbling", web::put().to(handlers::update_scrobbling_settings))
                        .route("/api/settings/scrobbling/test", web::post().to(handlers::test_scrobbling))
                        .route("/api/tracks/{id}/lyrics", web::get().to(handlers::get_lyrics))
                        .route("/api/tracks/{id}/lyrics", web::put().to(handlers::update_lyrics))
                        .route("/api/tracks/{id}/lyrics/fetch", web::post().to(handlers::fetch_lyrics))
                        .route("/api/updater/status", web::get().to(handlers::get_updater_status))
                        .route("/api/updater/check", web::post().to(handlers::check_for_updates))
                        .route("/api/updater/update", web::post().to(handlers::apply_update))
                        .route("/api/updater/config", web::get().to(handlers::get_updater_config))
                        .route("/api/updater/config", web::put().to(handlers::update_updater_config))
                        .route("/api/import/preview", web::post().to(handlers::preview_import))
                        .route("/api/import/confirm", web::post().to(handlers::confirm_import))
                        .route("/api/import/formats", web::get().to(handlers::get_import_formats))
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
