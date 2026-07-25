use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use crate::models::UserInfo;

type HmacSha256 = Hmac<Sha256>;

const TOKEN_SECRET: &[u8] = b"resonance-hmac-secret-change-in-production";

pub fn create_token(user: &UserInfo) -> String {
    let payload = format!("{}:{}:{}", user.id, user.username, user.role);
    let mut mac = HmacSha256::new_from_slice(TOKEN_SECRET)
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

    let mut mac = HmacSha256::new_from_slice(TOKEN_SECRET)
        .expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    mac.verify_slice(&signature).ok()?;

    let parts: Vec<&str> = payload.splitn(3, ':').collect();
    if parts.len() != 3 {
        return None;
    }
    Some(UserInfo {
        id: parts[0].to_string(),
        username: parts[1].to_string(),
        role: parts[2].to_string(),
    })
}
