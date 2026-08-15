// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use std::net::TcpStream;
use std::time::{Duration, Instant};
use tauri::Manager;

fn main() {
    env_logger::init();

    // Local single-user desktop app: the backend binds 127.0.0.1 only, and the
    // frontend is served from the same origin, so guest access and registration
    // are safe to enable by default. Operators can override via env vars.
    if std::env::var_os("RESONANCE_ALLOW_GUEST").is_none() {
        std::env::set_var("RESONANCE_ALLOW_GUEST", "true");
    }
    if std::env::var_os("RESONANCE_ALLOW_REGISTRATION").is_none() {
        std::env::set_var("RESONANCE_ALLOW_REGISTRATION", "true");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Persist the HMAC secret (and any other data) in the app data dir
            // instead of the process working directory.
            let app_data = handle
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_data).ok();
            if std::env::var_os("RESONANCE_DATA_DIR").is_none() {
                std::env::set_var("RESONANCE_DATA_DIR", &app_data);
            }

            let host = "127.0.0.1";
            let port: u16 = std::env::var("RESONANCE_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080);

            // Start the backend server in a background thread
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    // Resolve app data directory for database
                    let db_path = app_data.join("resonance.db");
                    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

                    // Static dir: use bundled frontend assets
                    let static_dir = handle
                        .path()
                        .resource_dir()
                        .expect("Failed to resolve resource dir");

                    // Copy bundled frontend to app data if not present
                    let app_static = app_data.join("static");
                    if !app_static.exists() {
                        let _ = std::fs::create_dir_all(&app_static);
                    }

                    info!("Starting Resonance backend for Tauri...");
                    info!("Database: {}", db_url);
                    info!("Static dir: {}", static_dir.display());

                    if let Err(e) = resonance_backend::start_server(
                        &db_url,
                        host,
                        port,
                        static_dir.to_str().unwrap_or("./static"),
                    )
                    .await
                    {
                        eprintln!("Backend server error: {}", e);
                    }
                });
            });

            // Wait until the backend actually accepts connections, then load the
            // SPA from the same origin (mirrors the Android/Capacitor setup, so
            // relative /api calls, cookies, and streaming all work without CORS).
            let deadline = Instant::now() + Duration::from_secs(30);
            loop {
                if TcpStream::connect((host, port)).is_ok() {
                    break;
                }
                if Instant::now() > deadline {
                    eprintln!("Backend did not come up within 30s; continuing anyway");
                    break;
                }
                std::thread::sleep(Duration::from_millis(200));
            }

            let url = format!("http://{}:{}/", host, port);
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(url.parse().expect("valid backend URL")),
            )
            .title("Resonance")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .center()
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
