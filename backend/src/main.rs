use log::info;

fn default_data_dir() -> std::path::PathBuf {
    if let Some(rd) = std::env::var_os("RESONANCE_DATA_DIR") {
        return std::path::PathBuf::from(rd);
    }
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    #[cfg(target_os = "windows")]
    let data_dir = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from(&home).join(".resonance"))
        .join("Resonance");
    #[cfg(target_os = "macos")]
    let data_dir = std::path::PathBuf::from(&home).join("Library/Application Support/Resonance");
    #[cfg(all(unix, not(target_os = "macos")))]
    let data_dir = std::env::var("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from(&home).join(".local/share"))
        .join("resonance");
    data_dir
}

fn exe_dir() -> std::path::PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."))
}

fn default_static_dir() -> String {
    std::env::var("STATIC_DIR").unwrap_or_else(|_| {
        let exe = exe_dir();
        let rel = exe.join("static");
        if rel.is_dir() {
            rel.to_string_lossy().to_string()
        } else {
            "./static".to_string()
        }
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        let data_dir = default_data_dir();
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

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a number");
    let static_dir = default_static_dir();

    info!(
        "Starting Resonance server on {}:{} (static: {})",
        host, port, static_dir
    );

    resonance_backend::start_server(&database_url, &host, port, &static_dir).await
}
