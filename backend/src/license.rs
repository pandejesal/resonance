use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
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
pub struct ActivateRequest {
    pub license_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeactivateRequest {
    pub license_key: String,
}

impl License {
    pub async fn generate_key(tier: &str) -> String {
        let prefix = match tier {
            "pro" => "RES-PRO",
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

    pub async fn activate(db: &SqlitePool, license_key: &str, user_id: &str) -> Result<Self, String> {
        let license = Self::get_by_key(db, license_key).await
            .ok_or("Invalid license key")?;

        if license.user_id.is_some() && license.user_id.as_deref() != Some(user_id) {
            return Err("License is already activated by another user".to_string());
        }

        let max_devices = match license.tier.as_str() {
            "pro" => 3,
            "enterprise" => 999,
            _ => 1,
        };

        let expires_at = match license.tier.as_str() {
            "pro" => {
                let exp = chrono::Utc::now() + chrono::Duration::days(365);
                exp.format("%Y-%m-%d %H:%M:%S").to_string()
            }
            "enterprise" => {
                let exp = chrono::Utc::now() + chrono::Duration::days(365);
                exp.format("%Y-%m-%d %H:%M:%S").to_string()
            }
            _ => "".to_string(),
        };

        sqlx::query(
            "UPDATE licenses SET user_id = ?, activated_at = datetime('now'), expires_at = ?, device_count = device_count + 1, max_devices = ? WHERE license_key = ?"
        )
        .bind(user_id)
        .bind(&expires_at)
        .bind(max_devices)
        .bind(license_key)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

        Self::get_by_key(db, license_key).await.ok_or("Failed to fetch updated license".to_string())
    }

    pub async fn deactivate(db: &SqlitePool, license_key: &str) -> Result<(), String> {
        sqlx::query(
            "UPDATE licenses SET user_id = NULL, activated_at = NULL, expires_at = NULL, device_count = 0 WHERE license_key = ?"
        )
        .bind(license_key)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn check_feature(db: &SqlitePool, tier: &str, feature: &str) -> bool {
        let result = sqlx::query_scalar::<_, i32>(
            "SELECT enabled FROM tier_features WHERE tier = ? AND feature_key = ?"
        )
        .bind(tier)
        .bind(feature)
        .fetch_optional(db)
        .await;

        matches!(result, Ok(Some(1)))
    }

    pub async fn get_features(db: &SqlitePool, tier: &str) -> Vec<String> {
        sqlx::query_scalar::<_, String>(
            "SELECT feature_key FROM tier_features WHERE tier = ? AND enabled = 1"
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
                let active = lic.expires_at.as_ref().map_or(true, |exp| {
                    chrono::NaiveDateTime::parse_from_str(exp, "%Y-%m-%d %H:%M:%S")
                        .map_or(false, |d| d > chrono::Utc::now().naive_utc())
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
        sqlx::query_scalar::<_, String>(
            "SELECT created_at FROM users WHERE id = ?"
        )
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
