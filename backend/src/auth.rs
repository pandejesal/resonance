use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use crate::models::UserInfo;

type HmacSha256 = Hmac<Sha256>;

fn get_token_secret() -> &'static [u8] {
    use std::sync::OnceLock;
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| {
        std::env::var("HMAC_SECRET")
            .unwrap_or_else(|_| "resonance-hmac-secret-change-in-production".to_string())
            .into_bytes()
    })
}

pub fn create_token(user: &UserInfo) -> String {
    let exp = chrono::Utc::now().timestamp() + 7 * 24 * 3600; // 7 days
    let payload = format!("{}:{}:{}:{}", user.id, user.username, user.role, exp);
    let mut mac = HmacSha256::new_from_slice(get_token_secret())
        .expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let signature = mac.finalize().into_bytes();
    let encoded_payload = STANDARD.encode(payload.as_bytes());
    let encoded_sig = STANDARD.encode(signature);
    format!("{}.{}", encoded_payload, encoded_sig)
}

pub fn validate_token(token: &str) -> Option<UserInfo> {
    let (encoded_payload, encoded_sig) = token.split_once('.')?;

    let signature = STANDARD.decode(encoded_sig).ok()?;
    let payload_bytes = STANDARD.decode(encoded_payload).ok()?;
    let payload = String::from_utf8(payload_bytes).ok()?;

    let mut mac = HmacSha256::new_from_slice(get_token_secret())
        .expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    mac.verify_slice(&signature).ok()?;

    let parts: Vec<&str> = payload.splitn(4, ':').collect();
    if parts.len() != 4 {
        return None;
    }

    let exp: i64 = parts[3].parse().ok()?;
    let now = chrono::Utc::now().timestamp();
    if now >= exp {
        return None; // token expired
    }

    Some(UserInfo {
        id: parts[0].to_string(),
        username: parts[1].to_string(),
        role: parts[2].to_string(),
    })
}

pub fn validate_token_optional(token: &str) -> Option<UserInfo> {
    validate_token(token)
}
