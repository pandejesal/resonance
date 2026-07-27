use actix_web::{web, HttpResponse};
use crate::license::{License, ActivateRequest, DeactivateRequest};
use crate::handlers::{AppState, require_auth};

pub async fn get_license_status(
    data: web::Data<AppState>,
    req: actix_web::HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let status = License::get_status(&data.db, &user.id).await;
    HttpResponse::Ok().json(status)
}

pub async fn activate_license(
    data: web::Data<AppState>,
    body: web::Json<ActivateRequest>,
    req: actix_web::HttpRequest,
) -> HttpResponse {
    let user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    match License::activate(&data.db, &body.license_key, &user.id).await {
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
    req: actix_web::HttpRequest,
) -> HttpResponse {
    let _user = match require_auth(&req) {
        Ok(u) => u,
        Err(r) => return r,
    };
    match License::deactivate(&data.db, &body.license_key).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "License deactivated"
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({"error": e})),
    }
}

pub async fn get_tier_features(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let tier = path.into_inner();
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
    let key = License::generate_key(&tier).await;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO licenses (id, license_key, tier, max_devices) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&key)
    .bind(&tier)
    .bind(match tier.as_str() { "pro" => 3, "enterprise" => 999, _ => 1 })
    .execute(&data.db)
    .await
    .ok();

    HttpResponse::Ok().json(serde_json::json!({
        "license_key": key,
        "tier": tier,
    }))
}
