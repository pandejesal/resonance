use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::sync::OnceLock;
use crate::models::UserInfo;

type HmacSha256 = Hmac<Sha256>;

static HMAC_SECRET: OnceLock<String> = OnceLock::new();

fn get_secret() -> &'static str {
    HMAC_SECRET.get_or_init(|| {
        if let Ok(secret) = std::env::var("HMAC_SECRET") {
            return secret;
        }
        if let Some(secret) = load_persisted_secret() {
            return secret;
        }
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let secret: String = (0..64)
            .map(|_| format!("{:02x}", rng.gen::<u8>()))
            .collect();
        persist_secret(&secret);
        eprintln!("[auth] No HMAC_SECRET env var set. Generated random secret and persisted it.");
        secret
    })
}

fn secret_file_path() -> Option<std::path::PathBuf> {
    let db_url = std::env::var("DATABASE_URL").ok()?;
    let db_path = db_url
        .strip_prefix("sqlite:")
        .unwrap_or(&db_url)
        .split('?')
        .next()
        .unwrap_or(&db_url);
    let path = std::path::Path::new(db_path);
    Some(path.parent()?.join(".hmac_secret"))
}

fn load_persisted_secret() -> Option<String> {
    let path = secret_file_path()?;
    let secret = std::fs::read_to_string(path).ok()?.trim().to_string();
    if secret.len() >= 32 {
        Some(secret)
    } else {
        None
    }
}

#[cfg(unix)]
fn set_restrictive_perms(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn set_restrictive_perms(_path: &std::path::Path) {}

fn persist_secret(secret: &str) {
    if let Some(path) = secret_file_path() {
        if let Some(dir) = path.parent() {
            if std::fs::create_dir_all(dir).is_ok() {
                use std::io::Write;
                if std::fs::File::create(&path)
                    .and_then(|mut f| f.write_all(secret.as_bytes()))
                    .is_ok()
                {
                    set_restrictive_perms(&path);
                    eprintln!("[auth] Persisted HMAC secret to {}", path.display());
                }
            }
        }
    }
}

pub fn create_token(user: &UserInfo) -> String {
    let exp = chrono::Utc::now().timestamp() + 7 * 24 * 3600;
    let payload = format!("{}:{}:{}:{}", user.id, user.username, user.role, exp);

    let mut mac = HmacSha256::new_from_slice(get_secret().as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let signature = mac.finalize().into_bytes();

    use base64::Engine;
    let encoded_payload = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(payload.as_bytes());
    let encoded_sig = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(signature);

    format!("{}.{}", encoded_payload, encoded_sig)
}

pub fn create_guest_token() -> String {
    let exp = chrono::Utc::now().timestamp() + 24 * 3600;
    let payload = format!("guest:guest:guest:{}", exp);

    let mut mac = HmacSha256::new_from_slice(get_secret().as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let signature = mac.finalize().into_bytes();

    use base64::Engine;
    let encoded_payload = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(payload.as_bytes());
    let encoded_sig = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(signature);

    format!("{}.{}", encoded_payload, encoded_sig)
}

pub fn validate_token(token: &str) -> Option<UserInfo> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return None;
    }

    use base64::Engine;
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(parts[0]).ok()?;
    let signature = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(parts[1]).ok()?;

    let mut mac = HmacSha256::new_from_slice(get_secret().as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(&payload_bytes);
    mac.verify_slice(&signature).ok()?;

    let payload = String::from_utf8(payload_bytes).ok()?;
    let parts: Vec<&str> = payload.splitn(4, ':').collect();
    if parts.len() != 4 {
        return None;
    }

    let exp: i64 = parts[3].parse().ok()?;
    let now = chrono::Utc::now().timestamp();
    if now >= exp {
        return None;
    }

    Some(UserInfo {
        id: parts[0].to_string(),
        username: parts[1].to_string(),
        role: parts[2].to_string(),
    })
}
