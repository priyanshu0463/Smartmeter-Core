# SmartMeter Core Backend (MVP) - Ingestion & APIs

## Status
MVP connected backend for end-to-end frontend testing:
- REST API for Consumer dashboards, history, forecasts, and insights
- WebSocket stream for live meter data
- In-memory meter store + simulator ingestion endpoint

## Local Run
### 1) Start backend
From repo root:
```bash
./.venv/bin/uvicorn smart-meter-core-backend.main:app --host 0.0.0.0 --port 8000
```

### 2) Start simulator
In another terminal:
```bash
cd smart-meter-core-backend
./../.venv/bin/python simulator_run.py --backend-url http://localhost:8000 --meter-id MTR-8829-X1 --interval-seconds 3
```

## Environment Variables (MVP)
- `JWT_SECRET`: JWT signing key (default: `dev-secret`)
- `AUTH_REQUIRED`: if `true`, WS requires `token=...` query param (default: `false`)
- `METER_RETENTION_DAYS`: how far back to keep readings (default: `30`)
- `METER_STEP_MINUTES`: assumed interval between readings for kWh integration (default: `30`)
- `MAX_POINTS_PER_METER`: override internal retention cap (optional)

Important for simulator accuracy:
If your simulator posts every `N` seconds, set:
`METER_STEP_MINUTES = N / 60`
For example, `interval-seconds=3` => `METER_STEP_MINUTES=0.05`

## Ingestion Contract (Hardware and Simulator)
The ingestion endpoint defines the contract that future hardware gateways should use.

### Endpoint
`POST /simulator/ingest`

### Request JSON
```json
{
  "meterId": "MTR-8829-X1",
  "timestamp": "2026-03-20T12:34:56.000Z",
  "usage": 1.23,
  "voltage": 230.0,
  "current": 12.3,
  "frequency": 50.0,
  "temperatureOutside": 20.5,
  "cost": 0.45
}
```

Notes:
- `usage` is instantaneous power in `kW` (used by backend to approximate energy/cost).
- If `cost` is omitted or null, backend computes it from tariff + approximate energy.

### How to integrate hardware later
1. Read raw meter output (MQTT/serial/HTTP/etc.) in your “hardware gateway”.
2. Convert raw values to the ingestion fields above.
3. POST to `/simulator/ingest`.
4. Keep meter timestamps accurate; the backend uses `timestamp` for lookback queries and ordering.

## API: Authentication (Mock JWT)
### Login
`POST /auth/login`

Request:
```json
{ "email": "demo@smartmeter.io", "password": "password123", "role": "CONSUMER", "meterId": "MTR-8829-X1" }
```

Response:
```json
{ "token": "jwt...", "user": { "id": "usr_...", "role": "CONSUMER", "meterId": "MTR-8829-X1" }, "expiresIn": 86400 }
```

WS clients can use `token=...` if `AUTH_REQUIRED=true`.

## API: Live Data (WebSocket)
### WebSocket Endpoint
`/ws/consumer/realtime/:meterId`

Backend sends JSON like:
```json
{
  "meterId": "MTR-8829-X1",
  "timestamp": "2026-03-20T12:34:56.000Z",
  "usage": 1.23,
  "voltage": 230.1,
  "current": 12.3,
  "frequency": 50.0,
  "cost": 0.45
}
```

## API: Consumer REST Endpoints (used by the frontend)
Base path: `/api/consumer`

1. `GET /dashboard?meterId=...`
2. `GET /history?meterId=...&range=day|week|month|year`
3. `GET /forecast/hourly?meterId=...`
4. `GET /forecast/weekly?meterId=...`
5. `GET /insights/efficiency?meterId=...`
6. `GET /insights/appliances?meterId=...`
7. `GET /insights/weather?meterId=...`
8. `GET /devices?meterId=...`

## Forecasting note (future ML integration)
The MVP currently generates forecast outputs from heuristics computed on recent readings.
To replace with ML:
1. Use `smartmeter_optimised_model.pkl`
2. Build the required long-format dataset per the training pipeline (including `quarter` and `season`)
3. Implement iterative prediction for future timesteps (because lags depend on prior `Usage`).

