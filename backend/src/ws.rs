use actix_web::{web, HttpRequest, HttpResponse};
use dashmap::DashMap;
use futures::StreamExt;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

use crate::models::{Track, WSMessage};

pub type WsClients = DashMap<String, actix_ws::Session>;

#[allow(dead_code)]
pub struct WsSession {
    client_id: String,
    subscriptions: HashSet<String>,
}

#[allow(dead_code)]
pub async fn ws_handler(
    req: HttpRequest,
    body: web::Payload,
    clients: web::Data<Arc<WsClients>>,
) -> Result<HttpResponse, actix_web::Error> {
    // Authenticate WebSocket connection
    let token = req.cookie("auth_token")
        .map(|c| c.value().to_string())
        .or_else(|| {
            req.headers().get("Authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(|v| v.to_string())
        });
    if token.is_none() || crate::auth::validate_token(&token.unwrap()).is_none() {
        return Ok(HttpResponse::Unauthorized().finish());
    }

    let (response, mut session, mut msg_stream) = actix_ws::handle(&req, body)?;

    let client_id = Uuid::new_v4().to_string();
    let session_id = client_id.clone();
    let clients_inner = clients.get_ref().clone();

    let welcome = WSMessage {
        msg_type: "welcome".to_string(),
        data: serde_json::json!({
            "client_id": client_id,
            "message": "Connected to Resonance WebSocket",
        }),
    };
    if let Ok(welcome_text) = serde_json::to_string(&welcome) {
        let _ = session.text(welcome_text).await;
    }

    let clients_clone = clients_inner.clone();
    clients_inner.insert(client_id.clone(), session.clone());

    let mut ws_session = WsSession {
        client_id: client_id.clone(),
        subscriptions: HashSet::new(),
    };

    actix_web::rt::spawn(async move {
        let mut last_pong = std::time::Instant::now();
        let heartbeat_timeout = Duration::from_secs(60);

        loop {
            tokio::select! {
                msg_result = msg_stream.next() => {
                    match msg_result {
                        Some(Ok(actix_ws::Message::Text(text))) => {
                            let text_str = text.to_string();
                            if text_str.starts_with("subscribe:") {
                                let topic = text_str.trim_start_matches("subscribe:");
                                ws_session.subscriptions.insert(topic.to_string());
                                let ack = WSMessage {
                                    msg_type: "welcome".to_string(),
                                    data: serde_json::json!({
                                        "subscribed": topic,
                                    }),
                                };
                                if let Ok(ack_text) = serde_json::to_string(&ack) {
                                    let _ = session.text(ack_text).await;
                                }
                            } else if text_str == "ping" {
                                last_pong = std::time::Instant::now();
                                let pong = WSMessage {
                                    msg_type: "welcome".to_string(),
                                    data: serde_json::json!({"pong": true}),
                                };
                                if let Ok(pong_text) = serde_json::to_string(&pong) {
                                    let _ = session.text(pong_text).await;
                                }
                            }
                        }
                        Some(Ok(actix_ws::Message::Ping(bytes))) => {
                            last_pong = std::time::Instant::now();
                            let _ = session.pong(&bytes).await;
                        }
                        Some(Ok(actix_ws::Message::Pong(_))) => {
                            last_pong = std::time::Instant::now();
                        }
                        Some(Ok(actix_ws::Message::Close(_))) => {
                            log::info!("WebSocket closed: {}", ws_session.client_id);
                            break;
                        }
                        None => {
                            log::info!("WebSocket stream ended: {}", ws_session.client_id);
                            break;
                        }
                        _ => {}
                    }
                }
                _ = tokio::time::sleep(Duration::from_secs(15)) => {
                    // Check for stale sessions
                    if last_pong.elapsed() > heartbeat_timeout {
                        log::info!("WebSocket stale session removed: {}", ws_session.client_id);
                        break;
                    }
                    // Send ping to check if client is still alive
                    if session.ping(b"keepalive").await.is_err() {
                        log::info!("WebSocket ping failed: {}", ws_session.client_id);
                        break;
                    }
                }
            }
        }

        clients_clone.remove(&session_id);
        log::info!("WebSocket session ended: {}", session_id);
    });

    Ok(response)
}

pub async fn broadcast_scan_progress(
    clients: &WsClients,
    library_id: &str,
    files_found: i32,
    files_processed: i32,
    is_complete: bool,
) {
    let msg = WSMessage {
        msg_type: "scan_progress".to_string(),
        data: serde_json::json!({
            "library_id": library_id,
            "files_found": files_found,
            "files_processed": files_processed,
            "is_complete": is_complete,
        }),
    };

    let text = match serde_json::to_string(&msg) {
        Ok(t) => t,
        Err(_) => return,
    };

    for entry in clients.iter() {
        let mut session = entry.value().clone();
        let _ = session.text(text.clone()).await;
    }
}

pub async fn broadcast_now_playing(clients: &WsClients, track: &Track) {
    let msg = WSMessage {
        msg_type: "now_playing".to_string(),
        data: serde_json::json!({
            "id": track.id,
            "title": track.title,
            "artist": track.artist,
            "album": track.album,
            "duration_ms": track.duration_ms,
            "format": track.format,
            "sample_rate": track.sample_rate,
            "bit_depth": track.bit_depth,
            "bitrate": track.bitrate,
            "channels": track.channels,
        }),
    };

    let text = match serde_json::to_string(&msg) {
        Ok(t) => t,
        Err(_) => return,
    };

    for entry in clients.iter() {
        let mut session = entry.value().clone();
        let _ = session.text(text.clone()).await;
    }
}
