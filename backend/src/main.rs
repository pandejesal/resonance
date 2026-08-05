mod auth;
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

use log::info;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        let data_dir = std::path::PathBuf::from(&home).join(".resonance");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir.join("resonance.db").to_string_lossy().to_string()
    });

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

    resonance_backend::start_server(&database_url, &host, port, &static_dir).await
}
