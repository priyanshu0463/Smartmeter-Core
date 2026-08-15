use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeterReading {
    pub timestamp: DateTime<Utc>,
    pub usage: f64,           // kW
    pub voltage: f64,         // V
    pub current: f64,         // A
    pub frequency: f64,       // Hz
    pub temperature: f64,     // Celsius
    pub renewable: f64,       // kW
    pub cost: f64,            // USD
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestRequest {
    pub meter_id: String,
    pub timestamp: Option<DateTime<Utc>>,
    pub usage: f64,
    pub voltage: Option<f64>,
    pub current: Option<f64>,
    pub frequency: Option<f64>,
    pub temperature_outside: Option<f64>,
    pub cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub ok: bool,
    pub stored: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeMessage {
    pub meter_id: String,
    pub timestamp: String,
    pub usage: f64,
    pub voltage: f64,
    pub current: f64,
    pub frequency: f64,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: Option<String>,
    pub role: Option<String>,
    pub meter_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
    pub expires_in: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meter_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meter_id: Option<String>,
    pub exp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeQuery {
    pub meter_id: String,
    #[serde(default)]
    pub token: Option<String>,
}