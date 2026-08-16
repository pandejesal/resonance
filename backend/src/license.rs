use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
#[allow(dead_code, unused_variables)]
pub struct License {
    pub id: String,
    pub license_key: String,
    pub tier: String,
    pub user_id: Option<String>,
    pub activated_at: Option<String>,
    pub expires_at: Option<String>,
    pub device_count: i32,
    pub max_devices: i32,
    pub features: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code, unused_variables)]
pub struct LicenseStatus {
    pub tier: String,
    pub active: bool,
    pub features: Vec<String>,
    pub trial_remaining_days: Option<i64>,
    pub expires_at: Option<String>,
    pub max_devices: i32,
    pub device_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code, unused_variables)]
pub struct ActivateRequest {
    pub license_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code, unused_variables)]
pub struct DeactivateRequest {
    pub license_key: String,
}

impl License {
    pub async fn generate_key(tier: &str) -> String {
        let prefix = match tier {
            "pro" => "RES-PRO",
            "lifetime" => "RES-LIF",
            "enterprise" => "RES-ENT",
            _ => "RES-FREE",
        };
        let uuid = Uuid::new_v4().to_string().replace("-", "")[..16].to_string();
        format!("{}-{}", prefix, uuid.to_uppercase())
    }

    pub async fn get_by_key(db: &SqlitePool, key: &str) -> Option<Self> {
        sqlx::query_as::<_, Self>("SELECT * FROM licenses WHERE license_key = ?")
            .bind(key)
            .fetch_optional(db)
            .await
            .ok()
            .flatten()
    }

    pub async fn get_by_user(db: &SqlitePool, user_id: &str) -> Option<Self> {
        sqlx::query_as::<_, Self>("SELECT * FROM licenses WHERE user_id = ? AND tier != 'free' ORDER BY activated_at DESC LIMIT 1")
            .bind(user_id)
            .fetch_optional(db)
            .await
            .ok()
            .flatten()
    }

    pub async fn activate(
        db: &SqlitePool,
        license_key: &str,
        user_id: &str,
    ) -> Result<Self, String> {
        let license = Self::get_by_key(db, license_key)
            .await
            .ok_or("Invalid license key")?;

        if license.user_id.is_some() && license.user_id.as_deref() != Some(user_id) {
            return Err("License is already activated by another user".to_string());
        }

        // If same user re-activating same key, just return current license
        if license.user_id.as_deref() == Some(user_id) {
            return Ok(license);
        }

        let max_devices = match license.tier.as_str() {
            "pro" | "lifetime" => 3,
            "enterprise" => 999,
            _ => 1,
        };

        let expires_at: Option<String> = match license.tier.as_str() {
            "pro" | "enterprise" => {
                let exp = chrono::Utc::now() + chrono::Duration::days(365);
                Some(exp.format("%Y-%m-%d %H:%M:%S").to_string())
            }
            // Lifetime and free tiers never expire
            _ => None,
        };

        // Atomic: only increment if device_count < max_devices
        let result = sqlx::query(
            "UPDATE licenses SET user_id = ?, activated_at = datetime('now'), expires_at = ?, device_count = device_count + 1 WHERE license_key = ? AND device_count < ?"
        )
        .bind(user_id)
        .bind(&expires_at)
        .bind(license_key)
        .bind(max_devices)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

        if result.rows_affected() == 0 {
            return Err(format!(
                "Device limit reached ({}/{}). Deactivate on another device first.",
                license.device_count, max_devices
            ));
        }

        Self::get_by_key(db, license_key)
            .await
            .ok_or("Failed to fetch updated license".to_string())
    }

    pub async fn deactivate(db: &SqlitePool, license_key: &str) -> Result<(), String> {
        sqlx::query(
            "UPDATE licenses SET device_count = MAX(0, device_count - 1), user_id = CASE WHEN device_count <= 1 THEN NULL ELSE user_id END, activated_at = CASE WHEN device_count <= 1 THEN NULL ELSE activated_at END, expires_at = CASE WHEN device_count <= 1 THEN NULL ELSE expires_at END WHERE license_key = ?"
        )
        .bind(license_key)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_features(db: &SqlitePool, tier: &str) -> Vec<String> {
        sqlx::query_scalar::<_, String>(
            "SELECT feature_key FROM tier_features WHERE tier = ? AND enabled = 1",
        )
        .bind(tier)
        .fetch_all(db)
        .await
        .unwrap_or_default()
    }

    pub async fn get_status(db: &SqlitePool, user_id: &str) -> LicenseStatus {
        let license = Self::get_by_user(db, user_id).await;

        match license {
            Some(lic) => {
                let features = Self::get_features(db, &lic.tier).await;
                let active = lic.expires_at.as_ref().is_none_or(|exp| {
                    if exp.is_empty() {
                        return true; // Empty means no expiry (free tier)
                    }
                    chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%d %H:%M:%S")
                        .is_ok_and(|d| d > chrono::Utc::now().naive_utc())
                });
                LicenseStatus {
                    tier: lic.tier,
                    active,
                    features,
                    trial_remaining_days: None,
                    expires_at: lic.expires_at,
                    max_devices: lic.max_devices,
                    device_count: lic.device_count,
                }
            }
            None => {
                let trial_end = Self::get_trial_end(db, user_id).await;
                let trial_remaining = trial_end.map(|end| {
                    let remaining = (end - chrono::Utc::now().naive_utc()).num_days();
                    remaining.max(0)
                });
                let features = Self::get_features(db, "free").await;
                LicenseStatus {
                    tier: "free".to_string(),
                    active: true,
                    features,
                    trial_remaining_days: trial_remaining,
                    expires_at: trial_end.map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string()),
                    max_devices: 1,
                    device_count: 1,
                }
            }
        }
    }

    pub async fn get_trial_end(db: &SqlitePool, user_id: &str) -> Option<chrono::NaiveDateTime> {
        sqlx::query_scalar::<_, String>("SELECT created_at FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(db)
            .await
            .ok()
            .flatten()
            .and_then(|created| {
                chrono::NaiveDateTime::parse_from_str(&created, "%Y-%m-%d %H:%M:%S").ok()
            })
            .map(|created| created + chrono::Duration::days(14))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role) VALUES ('u_lif', 'lifetime', 'x', 'user')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn generate_key_lifetime_uses_res_lif_prefix() {
        let key = License::generate_key("lifetime").await;
        assert!(
            key.starts_with("RES-LIF-"),
            "lifetime keys must use RES-LIF prefix"
        );
        assert_eq!(key.len(), 24, "RES-LIF- (8) + 16 uppercase hex chars");
    }

    #[tokio::test]
    async fn lifetime_license_activates_without_expiry_and_gets_pro_features() {
        let pool = test_pool().await;
        // Simulate the webhook: key created with tier lifetime, no expiry.
        let key = License::generate_key("lifetime").await;
        sqlx::query(
            "INSERT INTO licenses (id, license_key, tier, max_devices, user_id, activated_at, expires_at) VALUES ('lic_lif', ?, 'lifetime', 3, NULL, datetime('now'), NULL)",
        )
        .bind(&key)
        .execute(&pool)
        .await
        .unwrap();

        let license = License::activate(&pool, &key, "u_lif").await.unwrap();
        assert_eq!(license.tier, "lifetime");
        assert!(license.expires_at.is_none(), "lifetime keys never expire");

        let status = License::get_status(&pool, "u_lif").await;
        assert_eq!(status.tier, "lifetime");
        assert!(status.active, "no expiry means always active");
        assert!(status.expires_at.is_none());
        // Lifetime gets the full Pro feature set (migration 013 copies pro rows).
        assert!(
            status.features.contains(&"intelligence".to_string()),
            "lifetime must inherit pro features, got {:?}",
            status.features
        );
    }

    #[tokio::test]
    async fn annual_pro_license_still_expires_after_a_year() {
        let pool = test_pool().await;
        let key = License::generate_key("pro").await;
        sqlx::query(
            "INSERT INTO licenses (id, license_key, tier, max_devices, user_id, activated_at, expires_at) VALUES ('lic_pro', ?, 'pro', 3, NULL, datetime('now'), datetime('now', '+1 year'))",
        )
        .bind(&key)
        .execute(&pool)
        .await
        .unwrap();

        let license = License::activate(&pool, &key, "u_lif").await.unwrap();
        assert!(license.expires_at.is_some(), "annual pro keys must expire");
        assert!(
            license.expires_at.unwrap().starts_with("2027-"),
            "activation rewrites expiry to +1 year"
        );
    }
}
