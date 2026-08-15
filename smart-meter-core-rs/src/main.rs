mod auth;
mod config;
mod models;
mod store;

use crate::auth::AuthService;
use crate::config::Settings;
use crate::models::*;
use crate::store::MeterStore;
use anyhow::Result;
use axum::{
    extract::State,
    http,
    routing::{get, post},
    Json, Router,
};
use chrono::{Timelike, Datelike, Utc, FixedOffset};
use parking_lot::RwLock;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use tracing_subscriber::EnvFilter;

type SharedState = Arc<AppState>;

struct AppState {
    store: Arc<MeterStore>,
    auth: AuthService,
    config: Settings,
    python_ingest_url: RwLock<Option<String>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("smart_meter_core_rs=info".parse()?))
        .init();

    info!("Starting SmartMeter Core RS backend");

    let config = Settings::load()?;
    let store = MeterStore::new(config.meter.clone());
    let auth = AuthService::new(config.jwt.clone());

    let state = Arc::new(AppState {
        store,
        auth,
        config: config.clone(),
        python_ingest_url: RwLock::new(None),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/auth/login", post(auth_login))
        .route("/auth/logout", get(auth_logout))
        .route("/simulator/ingest", post(ingest_reading))
        .route("/health", get(health_check))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::new(
        config.server.host.parse()?,
        config.server.port,
    );
    info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// ── Auth Handlers ───────────────────────────────────────────────────────────

async fn auth_login(
    State(state): State<SharedState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, String> {
    state.auth.login(req).map_err(|e| e.to_string()).map(Json)
}

async fn auth_logout() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "message": "Logged out successfully" }))
}

// ── Ingestion Handler ───────────────────────────────────────────────────────

async fn ingest_reading(
    State(state): State<SharedState>,
    Json(req): Json<IngestRequest>,
) -> Result<Json<IngestResponse>, String> {
    let now = Utc::now();
    let ts = req.timestamp.unwrap_or(now);

    let voltage = req.voltage.unwrap_or(230.0);
    let current = req.current.unwrap_or_else(|| (req.usage * 1000.0) / voltage.max(1.0));
    let frequency = req.frequency.unwrap_or(50.0);
    let temperature = req.temperature_outside.unwrap_or_else(|| {
        let day_phase = (ts.hour() as f64 + ts.minute() as f64 / 60.0) / 24.0 * 2.0 * std::f64::consts::PI;
        let year_phase = (ts.ordinal() as f64 / 365.0) * 2.0 * std::f64::consts::PI;
        20.0 + 6.0 * (year_phase - 1.2).sin() + 4.0 * (day_phase - 0.6).sin()
    });

    let hour = ts.hour() as f64 + ts.minute() as f64 / 60.0;
    let renewable = store::solar_kw(hour);
    let interval_hours = state.config.meter.step_minutes / 60.0;
    let energy_kwh = req.usage * interval_hours;
    let rate = store::tariff_rate(ts);
    let cost = req.cost.unwrap_or(energy_kwh * rate);

    let reading = MeterReading {
        timestamp: ts,
        usage: req.usage,
        voltage,
        current,
        frequency,
        temperature,
        renewable,
        cost,
    };

    state.store.add_reading(&req.meter_id, reading);

    // Broadcast to subscribers - format IST timestamp
    let ist_offset = FixedOffset::east_opt(5 * 3600 + 30 * 60).unwrap();
    let ts_ist = ts.with_timezone(&ist_offset);
    let ts_str = ts_ist.format("%H:%M:%S").to_string();

    let msg = RealtimeMessage {
        meter_id: req.meter_id.clone(),
        timestamp: ts_str,
        usage: req.usage,
        voltage,
        current,
        frequency,
        cost,
    };
    state.store.broadcast(&req.meter_id, msg);

    // Forward to Python backend if configured
    let forward_url = state.python_ingest_url.read().clone();
    if let Some(url) = forward_url {
        let client = reqwest::Client::new();
        let _ = client
            .post(format!("{}/simulator/ingest", url))
            .json(&req)
            .send()
            .await;
    }

    Ok(Json(IngestResponse { ok: true, stored: 1 }))
}

// ── Health Check ───────────────────────────────────────────────────────────

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}