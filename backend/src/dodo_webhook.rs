use crate::handlers::AppState;
use actix_web::{web, HttpRequest, HttpResponse};
use hex;
use hmac::{Hmac, Mac};
use sha2::Sha256;

pub async fn handle_webhook(
    req: HttpRequest,
    payload: web::Bytes,
    data: web::Data<AppState>,
) -> HttpResponse {
    let signature_header = match req.headers().get("Dodo-Signature") {
        Some(sig) => sig.to_str().unwrap_or(""),
        None => return HttpResponse::BadRequest().finish(),
    };

    let secret =
        std::env::var("DODO_WEBHOOK_SECRET").unwrap_or_else(|_| "whsec_test_dummy".to_string());

    if secret != "whsec_test_dummy" {
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
            Ok(m) => m,
            Err(_) => return HttpResponse::InternalServerError().finish(),
        };
        mac.update(&payload);
        let expected_signature = hex::encode(mac.finalize().into_bytes());

        if expected_signature != signature_header {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "Invalid signature"}));
        }
    }

    let event: serde_json::Value = match serde_json::from_slice(&payload) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    if event["type"] == "payment.succeeded" {
        let payment = &event["data"];
        if let Some(metadata) = payment.get("metadata") {
            if let (Some(user_id), Some(tier)) =
                (metadata["user_id"].as_str(), metadata["tier"].as_str())
            {
                let key = crate::license::License::generate_key(tier).await;
                let id = uuid::Uuid::new_v4().to_string();
                let max_devices = match tier {
                    "pro" | "lifetime" => 3,
                    "enterprise" => 999,
                    _ => 1,
                };
                // Lifetime keys never expire; annual tiers get +1 year.
                let expires_at = match tier {
                    "lifetime" => "NULL".to_string(),
                    _ => "datetime('now', '+1 year')".to_string(),
                };

                let _ = sqlx::query(&format!(
                    "INSERT INTO licenses (id, license_key, tier, max_devices, user_id, activated_at, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now'), {})",
                    expires_at
                ))
                .bind(id)
                .bind(key)
                .bind(tier)
                .bind(max_devices)
                .bind(user_id)
                .execute(&data.db)
                .await;
            }
        }
    }

    HttpResponse::Ok().finish()
}
