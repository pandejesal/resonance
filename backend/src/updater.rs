use log::{info, warn, error};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

const GITHUB_REPO: &str = "pandejesal/resonance";
const GITHUB_API_URL: &str = "https://api.github.com/repos";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub current_version: String,
    pub current_commit: String,
    pub latest_version: String,
    pub latest_commit: String,
    pub update_available: bool,
    pub last_checked: String,
    pub docker_socket: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterConfig {
    pub auto_check: bool,
    pub check_interval_hours: u32,
    pub docker_socket: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubCommit {
    sha: String,
    commit: CommitInfo,
}

#[derive(Debug, Deserialize)]
struct CommitInfo {
    message: String,
}

#[derive(Debug, Deserialize)]
struct GitHubCompare {
    ahead_by: i32,
    status: String,
}

pub async fn get_updater_status(db: &SqlitePool) -> UpdateStatus {
    let current_version = get_state(db, "current_version").await.unwrap_or_else(|| "0.1.0".to_string());
    let current_commit = get_state(db, "current_commit").await.unwrap_or_default();
    let latest_version = get_state(db, "latest_version").await.unwrap_or_default();
    let latest_commit = get_state(db, "latest_commit").await.unwrap_or_default();
    let last_checked = get_state(db, "last_checked").await.unwrap_or_default();
    let docker_socket = get_state(db, "docker_socket").await == Some("true".to_string());

    let update_available = !latest_commit.is_empty()
        && !current_commit.is_empty()
        && latest_commit != current_commit;

    UpdateStatus {
        current_version,
        current_commit,
        latest_version,
        latest_commit,
        update_available,
        last_checked,
        docker_socket,
    }
}

pub async fn check_for_updates(db: &SqlitePool) -> Result<UpdateStatus, String> {
    let client = Client::new();

    let current_commit = get_state(db, "current_commit").await.unwrap_or_default();

    let url = format!("{}/{}/commits/main", GITHUB_API_URL, GITHUB_REPO);
    let response = client
        .get(&url)
        .header("User-Agent", "resonance-updater")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to GitHub: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned status {}", response.status()));
    }

    let commit: GitHubCommit = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    let latest_commit = commit.sha;
    let latest_version = extract_version_from_message(&commit.commit.message);

    set_state(db, "latest_commit", &latest_commit).await;
    set_state(db, "latest_version", &latest_version).await;
    set_state(db, "last_checked", &chrono::Utc::now().to_rfc3339()).await;

    if current_commit.is_empty() {
        set_state(db, "current_commit", &latest_commit).await;
    }

    info!("Update check: current={}, latest={}, available={}", current_commit, latest_commit, latest_commit != current_commit);

    Ok(get_updater_status(db).await)
}

pub async fn apply_update(db: &SqlitePool) -> Result<String, String> {
    let docker_socket = get_state(db, "docker_socket").await == Some("true".to_string());

    if !docker_socket {
        return Err("Docker socket not mounted. Cannot auto-update. Please run: git pull && docker compose up -d --build".to_string());
    }

    info!("Applying update: pulling latest changes...");

    let output = std::process::Command::new("git")
        .arg("pull")
        .current_dir("/app")
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git pull failed: {}", stderr));
    }

    let pull_result = String::from_utf8_lossy(&output.stdout).to_string();
    info!("Git pull result: {}", pull_result);

    if pull_result.contains("Already up to date") {
        return Ok("Already up to date".to_string());
    }

    info!("Rebuilding Docker container...");

    let output = std::process::Command::new("docker")
        .args(["compose", "-f", "/app/docker/docker-compose.yml", "up", "-d", "--build"])
        .current_dir("/app")
        .output()
        .map_err(|e| format!("Failed to execute docker compose: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("docker compose failed: {}", stderr));
    }

    let new_commit = get_latest_commit_hash(db).await.unwrap_or_default();
    set_state(db, "current_commit", &new_commit).await;

    info!("Update applied successfully");
    Ok("Update applied. Container restarting...".to_string())
}

pub async fn get_updater_config(db: &SqlitePool) -> UpdaterConfig {
    let auto_check = get_state(db, "auto_check").await == Some("true".to_string());
    let check_interval_hours = get_state(db, "check_interval_hours")
        .await
        .and_then(|s| s.parse().ok())
        .unwrap_or(6);
    let docker_socket = get_state(db, "docker_socket").await == Some("true".to_string());

    UpdaterConfig {
        auto_check,
        check_interval_hours,
        docker_socket,
    }
}

pub async fn save_updater_config(db: &SqlitePool, config: &UpdaterConfig) {
    set_state(db, "auto_check", &config.auto_check.to_string()).await;
    set_state(db, "check_interval_hours", &config.check_interval_hours.to_string()).await;
    set_state(db, "docker_socket", &config.docker_socket.to_string()).await;
}

async fn get_state(db: &SqlitePool, key: &str) -> Option<String> {
    sqlx::query_as::<_, (String,)>("SELECT value FROM updater_state WHERE key = ?")
        .bind(key)
        .fetch_optional(db)
        .await
        .ok()
        .flatten()
        .map(|row| row.0)
}

async fn set_state(db: &SqlitePool, key: &str, value: &str) {
    sqlx::query("INSERT OR REPLACE INTO updater_state (key, value, updated_at) VALUES (?, ?, datetime('now'))")
        .bind(key)
        .bind(value)
        .execute(db)
        .await
        .ok();
}

fn extract_version_from_message(message: &str) -> String {
    let first_line = message.lines().next().unwrap_or("");
    if let Some(version) = first_line.strip_prefix("release:") {
        return version.trim().to_string();
    }
    if let Some(version) = first_line.strip_prefix("v") {
        return version.trim().to_string();
    }
    "0.1.0".to_string()
}

async fn get_latest_commit_hash(db: &SqlitePool) -> Option<String> {
    let client = Client::new();
    let url = format!("{}/{}/commits/main?per_page=1", GITHUB_API_URL, GITHUB_REPO);

    let response = client
        .get(&url)
        .header("User-Agent", "resonance-updater")
        .send()
        .await
        .ok()?;

    let commit: GitHubCommit = response.json().await.ok()?;
    Some(commit.sha)
}

pub async fn start_background_check(db: SqlitePool) {
    let config = get_updater_config(&db).await;
    if !config.auto_check {
        info!("Auto-update check is disabled");
        return;
    }

    let interval_hours = config.check_interval_hours;
    info!("Starting background update check every {} hours", interval_hours);

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(interval_hours as u64 * 3600)).await;

        match check_for_updates(&db).await {
            Ok(status) => {
                if status.update_available {
                    info!("Update available: {} -> {}", status.current_version, status.latest_version);
                }
            }
            Err(e) => {
                warn!("Background update check failed: {}", e);
            }
        }
    }
}
