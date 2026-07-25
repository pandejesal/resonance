// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Start the backend server in a background thread
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    // Resolve app data directory for database
                    let app_data = handle
                        .path()
                        .app_data_dir()
                        .expect("Failed to resolve app data dir");
                    std::fs::create_dir_all(&app_data).ok();

                    let db_path = app_data.join("resonance.db");
                    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

                    // Static dir: use bundled frontend assets
                    let static_dir = handle.path().resource_dir()
                        .expect("Failed to resolve resource dir");

                    // Copy bundled frontend to app data if not present
                    let app_static = app_data.join("static");
                    if !app_static.exists() {
                        // In dev mode, frontendDist is used; in production, assets are bundled
                        let _ = std::fs::create_dir_all(&app_static);
                    }

                    let host = "127.0.0.1";
                    let port: u16 = 8080;

                    info!("Starting Resonance backend for Tauri...");
                    info!("Database: {}", db_url);
                    info!("Static dir: {}", static_dir.display());

                    if let Err(e) = resonance_backend::start_server(
                        &db_url,
                        host,
                        port,
                        static_dir.to_str().unwrap_or("./static"),
                    ).await {
                        eprintln!("Backend server error: {}", e);
                    }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
