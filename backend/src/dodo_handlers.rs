use actix_web::{web, HttpRequest, HttpResponse};
use std::env;
use crate::handlers::{AppState, require_auth};

pub async fn create_checkout_session(
    _data: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };

    let tier = path.into_inner();
    let product_id = match tier.as_str() {
        "pro" => "pdt_123_pro",
        "enterprise" => "pdt_456_ent",
        _ => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid tier"})),
    };

    let secret_key = env::var("DODO_API_KEY").unwrap_or_else(|_| "test_dummy_dodo_key".to_string());

    // Determine the host dynamically or from env var
    let host = env::var("FRONTEND_URL").unwrap_or_else(|_| {
        req.headers()
            .get("Origin")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "http://localhost:5173".to_string())
    });

    let client = reqwest::Client::new();
    let res = client.post("https://api.dodopayments.com/payments")
        .header("Authorization", format!("Bearer {}", secret_key))
        .json(&serde_json::json!({
            "billing": {
                "city": "",
                "country": "IN",
                "state": "",
                "street": "",
                "zipcode": ""
            },
            "customer": {
                "email": format!("{}@example.com", user.username), // Dummy email since we don't store it
                "name": user.username
            },
            "product_cart": [
                {
                    "product_id": product_id,
                    "quantity": 1
                }
            ],
            "return_url": format!("{}/upgrade?success=true&session_id={}&tier={}", host, user.id, tier),
            "metadata": {
                "tier": tier,
                "user_id": user.id
            }
        }))
        .send()
        .await;

    match res {
        Ok(r) => {
            if r.status().is_success() {
                let json: serde_json::Value = r.json().await.unwrap();
                HttpResponse::Ok().json(serde_json::json!({
                    "id": json["payment_id"],
                    "url": json["payment_link"]
                }))
            } else {
                let err = r.text().await.unwrap_or_default();
                HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Dodo Payments error: {}", err)}))
            }
        },
        Err(e) => {
            HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Failed to create Dodo session: {}", e)}))
        }
    }
}
