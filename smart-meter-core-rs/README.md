# SmartMeter Core RS (Rust Backend)

High-performance Rust backend for the SmartMeter Core system. Provides fast data ingestion and JWT authentication as the first step in migrating performance-critical components from Python.

## Quick Start

```bash
# Run the binary
./target/release/smart-meter-core-rs

# Or with custom config
./target/release/smart-meter-core-rs --config config.yaml
```

Default: runs on `http://0.0.0.0:8001`

## Configuration (config.yaml)

```yaml
server:
  host: "0.0.0.0"
  port: 8001

jwt:
  secret: "dev-secret"
  algorithm: "HS256"

meter:
  retention_days: 30
  step_minutes: 0.05
  max_points_per_meter: 100000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Returns JWT token |
| POST | `/auth/logout` | Stateless logout |
| POST | `/simulator/ingest` | Ingest meter reading |
| GET | `/health` | Health check |

### Authentication

```bash
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@smartmeter.io", "role": "CONSUMER", "meterId": "MTR-8829-X1"}'
```

### Ingestion

```bash
curl -X POST http://localhost:8001/simulator/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "meterId": "MTR-8829-X1",
    "usage": 1.5,
    "voltage": 230.0,
    "current": 6.5,
    "frequency": 50.0,
    "temperatureOutside": 25.0
  }'
```

## Migration Path

This Rust backend is designed to work alongside your existing Python backend:

1. **Phase 1**: Run Rust on port 8001, Python on 8000. Direct simulator to Rust.
2. **Phase 2**: Add WebSocket support to Rust
3. **Phase 3**: Migrate remaining REST APIs to Rust

## Build

```bash
cargo build --release
```

Binary size: ~6MB (statically linked)