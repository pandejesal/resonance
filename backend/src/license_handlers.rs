use crate::handlers::{require_auth, AppState};
use crate::license::{ActivateRequest, DeactivateRequest, License};
use crate::ratelimit::check_rate_limit;
use actix_web::{web, HttpRequest, HttpResponse};

pub async fn get_license_status(data: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let status = License::get_status(&data.db, &user.id).await;
    HttpResponse::Ok().json(status)
}

fn get_client_ip(req: &HttpRequest) -> String {
    // Prefer direct connection peer address over proxy headers
    if let Some(peer) = req.peer_addr() {
        return peer.to_string();
    }
    // Fallback to X-Forwarded-For only if behind a known reverse proxy
    req.headers()
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .filter(|v| !v.trim().is_empty())
        .map(|v| v.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub async fn activate_license(
    data: web::Data<AppState>,
    body: web::Json<ActivateRequest>,
    req: HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let ip = get_client_ip(&req);
    if !check_rate_limit(&format!("license_activate:{}", ip), 10, 60) {
        return HttpResponse::TooManyRequests()
            .json(serde_json::json!({"error": "Too many requests. Try again later."}));
    }
    let key = body.license_key.trim();
    if key.is_empty() || key.len() > 64 {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "Invalid license key format"}));
    }
    match License::activate(&data.db, key, &user.id).await {
        Ok(license) => HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "tier": license.tier,
            "expires_at": license.expires_at,
            "message": "License activated successfully"
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({"error": e})),
    }
}

pub async fn deactivate_license(
    data: web::Data<AppState>,
    body: web::Json<DeactivateRequest>,
    req: HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let ip = get_client_ip(&req);
    if !check_rate_limit(&format!("license_deactivate:{}", ip), 10, 60) {
        return HttpResponse::TooManyRequests()
            .json(serde_json::json!({"error": "Too many requests. Try again later."}));
    }
    // Verify ownership before deactivation
    let license = match License::get_by_key(&data.db, &body.license_key).await {
        Some(lic) => lic,
        None => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "Invalid license key"}))
        }
    };
    if license.user_id.as_deref() != Some(&user.id) {
        return HttpResponse::Forbidden()
            .json(serde_json::json!({"error": "You can only deactivate your own license"}));
    }
    match License::deactivate(&data.db, &body.license_key).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "License deactivated"
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({"error": e})),
    }
}

pub async fn get_tier_features(data: web::Data<AppState>, path: web::Path<String>) -> HttpResponse {
    let tier = path.into_inner();
    if !matches!(tier.as_str(), "free" | "pro" | "enterprise") {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid tier"}));
    }
    let features = License::get_features(&data.db, &tier).await;
    HttpResponse::Ok().json(serde_json::json!({
        "tier": tier,
        "features": features,
    }))
}

pub async fn generate_license_key(
    data: web::Data<AppState>,
    path: web::Path<String>,
    req: actix_web::HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    if user.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": "Admin only"}));
    }
    let tier = path.into_inner();
    if !matches!(tier.as_str(), "pro" | "enterprise") {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "Invalid tier. Must be 'pro' or 'enterprise'."}));
    }
    let key = License::generate_key(&tier).await;

    let id = uuid::Uuid::new_v4().to_string();
    let result = sqlx::query(
        "INSERT INTO licenses (id, license_key, tier, max_devices) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&key)
    .bind(&tier)
    .bind(match tier.as_str() {
        "pro" => 3,
        "enterprise" => 999,
        _ => 1,
    })
    .execute(&data.db)
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "license_key": key,
            "tier": tier,
        })),
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": format!("Failed to generate license key: {}", e)})),
    }
}
