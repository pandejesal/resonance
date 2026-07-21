use log::{info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const LRCLIB_API_URL: &str = "https://lrclib.net/api/get";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LrcLine {
    pub time_ms: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResult {
    pub plain: String,
    pub synced: Option<String>,
}

pub fn parse_lrc(content: &str) -> Vec<LrcLine> {
    let mut lines = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let mut time_ms = None;
        let mut text = line.to_string();

        // Parse timestamps like [00:12.34] or [01:23.456]
        while text.starts_with('[') {
            if let Some(close_pos) = text.find(']') {
                let tag = &text[1..close_pos];
                if let Some(parsed) = parse_time_tag(tag) {
                    time_ms = Some(parsed);
                    text = text[close_pos + 1..].to_string();
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        if let Some(ms) = time_ms {
            let trimmed = text.trim();
            if !trimmed.is_empty() || lines.last().map_or(true, |l: &LrcLine| !l.text.is_empty()) {
                lines.push(LrcLine {
                    time_ms: ms,
                    text: trimmed.to_string(),
                });
            }
        } else if !lines.is_empty() {
            // Plain text line without timestamp, append to previous
            if let Some(last) = lines.last_mut() {
                if last.text.is_empty() {
                    last.text = text.trim().to_string();
                }
            }
        }
    }

    lines.sort_by_key(|l| l.time_ms);
    lines.dedup_by_key(|l| l.time_ms);
    lines
}

fn parse_time_tag(tag: &str) -> Option<u32> {
    let parts: Vec<&str> = tag.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let minutes: u32 = parts[0].parse().ok()?;
    let sec_parts: Vec<&str> = parts[1].split('.').collect();
    let seconds: u32 = sec_parts[0].parse().ok()?;
    let millis = if sec_parts.len() > 1 {
        let frac = sec_parts[1];
        match frac.len() {
            1 => format!("{}00", frac).parse::<u32>().ok()?,
            2 => format!("{}0", frac).parse::<u32>().ok()?,
            _ => frac[..3.min(frac.len())].parse::<u32>().ok()?,
        }
    } else {
        0
    };

    Some(minutes * 60 * 1000 + seconds * 1000 + millis)
}

pub fn to_lrc(lines: &[LrcLine]) -> String {
    let mut result = String::new();
    for line in lines {
        let minutes = line.time_ms / 60_000;
        let seconds = (line.time_ms % 60_000) / 1000;
        let millis = line.time_ms % 1000;
        result.push_str(&format!(
            "[{:02}:{:02}.{:03}]{}\n",
            minutes, seconds, millis, line.text
        ));
    }
    result
}

pub async fn fetch_from_lrclib(
    client: &Client,
    artist: &str,
    track: &str,
    album: &str,
    duration_ms: i64,
) -> Option<LyricsResult> {
    let duration_secs = (duration_ms / 1000) as u32;

    let url = format!(
        "{}?artist_name={}&track_name={}&album_name={}&duration={}",
        LRCLIB_API_URL,
        urlencoding::encode(artist),
        urlencoding::encode(track),
        urlencoding::encode(album),
        duration_secs,
    );

    let response = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            warn!("LRCLIB request failed: {}", e);
            return None;
        }
    };

    if !response.status().is_success() {
        info!("LRCLIB returned status {} for {} - {}", response.status(), artist, track);
        return None;
    }

    let body: serde_json::Value = match response.json().await {
        Ok(v) => v,
        Err(e) => {
            warn!("LRCLIB response parse failed: {}", e);
            return None;
        }
    };

    let synced = body.get("syncedLyrics").and_then(|v| v.as_str()).map(|s| s.to_string());
    let plain = body.get("plainLyrics").and_then(|v| v.as_str()).map(|s| s.to_string());

    if synced.is_none() && plain.is_none() {
        info!("No lyrics found on LRCLIB for {} - {}", artist, track);
        return None;
    }

    info!("Found lyrics on LRCLIB for {} - {}", artist, track);

    Some(LyricsResult {
        plain: plain.unwrap_or_default(),
        synced,
    })
}

pub fn is_lrc(content: &str) -> bool {
    content.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.starts_with('[') && trimmed.contains("]:")
    })
}

pub fn extract_plain_from_lrc(content: &str) -> String {
    let lines = parse_lrc(content);
    lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n")
}
