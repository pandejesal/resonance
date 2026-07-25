use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use crate::models::UserInfo;

pub fn create_token(user: &UserInfo) -> String {
    let payload = format!("{}:{}:{}", user.id, user.username, user.role);
    STANDARD.encode(payload.as_bytes())
}

pub fn validate_token(token: &str) -> Option<UserInfo> {
    let decoded = STANDARD.decode(token).ok()?;
    let payload = String::from_utf8(decoded).ok()?;
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
