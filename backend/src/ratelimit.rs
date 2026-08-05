use std::collections::HashMap;
use std::sync::OnceLock;
use std::sync::RwLock;
use std::time::Instant;

struct RateEntry {
    count: u32,
    window_start: Instant,
}

static RATE_LIMITS: OnceLock<RwLock<HashMap<String, RateEntry>>> = OnceLock::new();

fn get_map() -> &'static RwLock<HashMap<String, RateEntry>> {
    RATE_LIMITS.get_or_init(|| RwLock::new(HashMap::new()))
}

pub fn check_rate_limit(ip: &str, max_requests: u32, window_secs: u64) -> bool {
    let now = Instant::now();
    let window = std::time::Duration::from_secs(window_secs);

    // Fast path: read-only check
    if let Ok(map) = get_map().read() {
        if let Some(entry) = map.get(ip) {
            if now.duration_since(entry.window_start) >= window {
                // Window expired, need write lock to reset
            } else if entry.count >= max_requests {
                return false;
            } else {
                return true;
            }
        }
    }

    // Slow path: write lock to insert/update
    if let Ok(mut map) = get_map().write() {
        map.retain(|_, entry| now.duration_since(entry.window_start) < window);

        if let Some(entry) = map.get_mut(ip) {
            if now.duration_since(entry.window_start) >= window {
                entry.count = 1;
                entry.window_start = now;
                return true;
            }
            if entry.count >= max_requests {
                return false;
            }
            entry.count += 1;
            return true;
        }

        map.insert(
            ip.to_string(),
            RateEntry {
                count: 1,
                window_start: now,
            },
        );
        true
    } else {
        // If the lock is poisoned, recreate it or deny to fail closed.
        // Failing open on poison could lead to bypass. Let's deny for security.
        false
    }
}
