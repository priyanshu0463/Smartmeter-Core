use crate::config::MeterConfig;
use crate::models::MeterReading;
use anyhow::Result;
use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use parking_lot::RwLock;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, info};

pub struct MeterStore {
    data: RwLock<HashMap<String, VecDeque<MeterReading>>>,
    connections: RwLock<HashMap<String, broadcast::Sender<crate::models::RealtimeMessage>>>,
    config: MeterConfig,
    broadcast_buffer_size: usize,
}

impl MeterStore {
    pub fn new(config: MeterConfig) -> Arc<Self> {
        Arc::new(Self {
            data: RwLock::new(HashMap::new()),
            connections: RwLock::new(HashMap::new()),
            config,
            broadcast_buffer_size: 1000,
        })
    }

    pub fn ensure_meter(&self, meter_id: &str) {
        let mut data = self.data.write();
        if !data.contains_key(meter_id) {
            info!("Initializing meter store for {}", meter_id);
            let deque = VecDeque::with_capacity(self.config.max_points_per_meter);
            data.insert(meter_id.to_string(), deque);
        }
    }

    pub fn add_reading(&self, meter_id: &str, reading: MeterReading) {
        self.ensure_meter(meter_id);
        let mut data = self.data.write();
        if let Some(deque) = data.get_mut(meter_id) {
            if deque.len() >= self.config.max_points_per_meter {
                deque.pop_front();
            }
            deque.push_back(reading);
        }
    }

    pub fn latest(&self, meter_id: &str) -> Option<MeterReading> {
        let data = self.data.read();
        data.get(meter_id).and_then(|d| d.back().cloned())
    }

    pub fn readings_between(
        &self,
        meter_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Vec<MeterReading> {
        let data = self.data.read();
        match data.get(meter_id) {
            Some(deque) => deque
                .iter()
                .filter(|r| r.timestamp >= start && r.timestamp <= end)
                .cloned()
                .collect(),
            None => Vec::new(),
        }
    }

    pub fn approximate_energy_kwh(
        &self,
        meter_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Vec<MeterReading> {
        let mut readings = self.readings_between(meter_id, start, end);
        if readings.is_empty() {
            return Vec::new();
        }
        readings.sort_by_key(|r| r.timestamp);

        // Add synthetic endpoint at end
        if let Some(last) = readings.last() {
            if last.timestamp < end {
                let mut synthetic = last.clone();
                synthetic.timestamp = end;
                readings.push(synthetic);
            }
        }
        readings
    }

    pub fn get_or_create_sender(&self, meter_id: &str) -> broadcast::Sender<crate::models::RealtimeMessage> {
        let mut connections = self.connections.write();
        if let Some(sender) = connections.get(meter_id) {
            return sender.clone();
        }

        let (tx, _) = broadcast::channel(self.broadcast_buffer_size);
        connections.insert(meter_id.to_string(), tx.clone());
        info!("Created broadcast channel for meter {}", meter_id);
        tx
    }

    pub fn subscribe(&self, meter_id: &str) -> broadcast::Receiver<crate::models::RealtimeMessage> {
        let sender = self.get_or_create_sender(meter_id);
        sender.subscribe()
    }

    pub fn broadcast(&self, meter_id: &str, msg: crate::models::RealtimeMessage) {
        if let Some(sender) = self.connections.read().get(meter_id) {
            if let Err(e) = sender.send(msg) {
                debug!("Broadcast error (likely no receivers): {}", e);
            }
        }
    }
}

// Tariff calculation (matches Python backend)
pub fn tariff_rate(ts: DateTime<Utc>) -> f64 {
    let hour = ts.hour() as f64 + ts.minute() as f64 / 60.0;
    if (17.0..21.0).contains(&hour) {
        0.25
    } else if (7.0..17.0).contains(&hour) || (21.0..23.0).contains(&hour) {
        0.18
    } else {
        0.12
    }
}

// Solar generation curve (matches Python backend)
pub fn solar_kw(hour: f64) -> f64 {
    if hour < 6.0 || hour > 18.0 {
        return 0.0;
    }
    let x = (hour - 6.0) / 12.0;
    3.5 * (std::f64::consts::PI * x).sin().max(0.0)
}

// Seed data generation for new meters
pub fn generate_seed_readings(config: &MeterConfig, now: DateTime<Utc>) -> Vec<MeterReading> {
    let mut readings = Vec::new();
    let start = now - Duration::days(config.retention_days as i64);
    let step = Duration::minutes((config.step_minutes * 60.0) as i64);

    let mut current = start;
    while current <= now {
        let hour = current.hour() as f64 + current.minute() as f64 / 60.0;
        let usage = ensure_meter_seed_usage(current);
        let voltage = 230.0 + rand_gauss(0.0, 1.2);
        let current_a = (usage * 1000.0) / voltage.max(1.0);
        let frequency = 50.0 + rand_gauss(0.0, 0.04);
        let temp = temp_outside_c(current);
        let renewable = solar_kw(hour);
        let rate = tariff_rate(current);
        let interval_hours = config.step_minutes / 60.0;
        let energy_kwh = usage * interval_hours;
        let cost = energy_kwh * rate;

        readings.push(MeterReading {
            timestamp: current,
            usage,
            voltage,
            current: current_a,
            frequency,
            temperature: temp,
            renewable,
            cost,
        });

        current = current + step;
    }

    readings
}

fn ensure_meter_seed_usage(ts: DateTime<Utc>) -> f64 {
    let hour = ts.hour() as f64 + ts.minute() as f64 / 60.0;
    let weekend = if ts.weekday().num_days_from_monday() >= 5 { 0.85 } else { 1.0 };
    let season_factor = 1.0 + 0.12 * ((ts.month() as f64 - 1.0) / 12.0 * 2.0 * std::f64::consts::PI).sin();

    let morning = 1.1 * (-0.5 * ((hour - 7.5) / 2.2).powi(2)).exp();
    let evening = 1.6 * (-0.5 * ((hour - 19.0) / 2.8).powi(2)).exp();
    let base = 1.6;
    let noise = rand_gauss(0.0, 0.08);

    (base + morning + evening) * weekend * season_factor + noise
}

fn temp_outside_c(ts: DateTime<Utc>) -> f64 {
    let day_phase = (ts.hour() as f64 + ts.minute() as f64 / 60.0) / 24.0 * 2.0 * std::f64::consts::PI;
    let year_phase = (ts.ordinal0() as f64 / 365.0) * 2.0 * std::f64::consts::PI;
    20.0 + 6.0 * (year_phase - 1.2).sin() + 4.0 * (day_phase - 0.6).sin() + rand_gauss(0.0, 0.4)
}

fn rand_gauss(mean: f64, std: f64) -> f64 {
    // Box-Muller transform
    let u1: f64 = (rand_simple() as f64 + 1.0) / (u64::MAX as f64 + 1.0);
    let u2: f64 = (rand_simple() as f64 + 1.0) / (u64::MAX as f64 + 1.0);
    mean + std * (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
}

fn rand_simple() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64
}