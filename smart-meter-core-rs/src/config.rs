use anyhow::Result;
use config::{Config, File};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    pub server: ServerConfig,
    pub jwt: JwtConfig,
    pub meter: MeterConfig,
    pub ingestion: IngestionConfig,
    pub cors: CorsConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JwtConfig {
    pub secret: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MeterConfig {
    pub retention_days: i32,
    pub step_minutes: f64,
    pub max_points_per_meter: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct IngestionConfig {
    pub broadcast_buffer_size: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CorsConfig {
    pub allow_origins: Vec<String>,
    pub allow_credentials: bool,
}

impl Settings {
    pub fn load() -> Result<Self> {
        let config = Config::builder()
            .add_source(File::with_name("config"))
            .build()?;
        Ok(config.try_deserialize()?)
    }
}