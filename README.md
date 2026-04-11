# SmartMeter Core

> A full-stack real-time energy monitoring and analytics platform for consumers, energy retailers, and grid operators.

---

## Overview

SmartMeter Core is an end-to-end smart metering system that bridges physical energy meters (or a software simulator) with a cloud-backed analytics dashboard. It ingests live electrical readings every few seconds, persists them to Google Sheets, and serves them through a role-based web dashboard with real-time charts, load forecasting, AI-powered insights, and device automation.

The system is designed to be hardware-agnostic — the same ingestion contract works with the included Python simulator today and with a Raspberry Pi + PZEM-004T hardware gateway tomorrow.

---

## Use Cases

**For Consumers**
- Monitor live power, voltage, and current from any browser
- Understand daily and monthly energy costs broken down by time-of-use tariff
- Get AI-generated recommendations to reduce bills
- Control smart appliances and set automation rules

**For Energy Retailers**
- Analyse per-meter demand patterns and peak load windows
- Correlate weather with consumption for demand forecasting
- View grid-level aggregated metrics across consumer segments
- Run demand response programs

**For System Administrators**
- Monitor backend infrastructure health, SLA compliance, and audit logs
- Manage users and system configuration

---

## Scope

| In Scope (current) | Future / Extensible |
|---|---|
| Single-meter consumer dashboard | Multi-meter fleet management |
| Software simulator (virtual meter) | Raspberry Pi + PZEM-004T hardware gateway |
| Google Sheets persistence | TimescaleDB / InfluxDB for scale |
| Heuristic load forecasting | ML model (`smartmeter_optimised_model.pkl`) |
| Keyword-based AI chat | OpenAI / Gemini / Ollama LLM integration |
| Mock JWT authentication | Production auth with refresh tokens |
| In-memory data store | Persistent database with indexing |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/ui, Radix UI |
| Charts | Recharts 2.15 |
| State Management | Zustand 5 |
| Backend | FastAPI 0.115, Python 3.12, Uvicorn |
| Real-time | WebSocket (FastAPI native) |
| Auth | JWT (PyJWT) |
| Persistence | Google Sheets API v4 via gspread |
| Simulator | Pure Python (no dependencies beyond stdlib) |

---

## Repository Structure

```
smartmetercore/
├── smart-meter-core-backend/
│   ├── main.py                        # FastAPI app — all REST + WebSocket endpoints
│   ├── simulator_run.py               # Virtual smart meter — POSTs readings every N seconds
│   ├── requirements.txt               # Python dependencies
│   ├── README.md                      # Backend-specific docs + Google Sheets setup
│   └── forcasting model/
│       ├── smartmeter_optimised_model.pkl   # Trained ML forecasting model (future use)
│       ├── export_model.py            # Model export script
│       └── load_and_predict.py        # Model inference script
│
├── smart-meter-core-frontend/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout + theme provider
│   │   ├── page.tsx                   # Root redirect
│   │   ├── globals.css                # Global styles
│   │   ├── login/                     # Login page
│   │   └── (dashboard)/               # Protected dashboard routes
│   │       ├── dashboard/             # Consumer main dashboard
│   │       ├── monitoring/            # Real-time voltage / current / power
│   │       ├── historical/            # Historical analysis (24h / 7d / 30d / 1y)
│   │       ├── forecast/              # 24h + 7-day load forecast
│   │       ├── insights/              # AI efficiency insights
│   │       ├── ai-chat/               # Conversational AI assistant
│   │       ├── automation/            # Device control + automation rules
│   │       ├── utility/dashboard/     # Utility grid command centre
│   │       └── admin/health/          # System health + audit logs
│   ├── components/
│   │   ├── layout/                    # Sidebar, navbar, dashboard layout wrapper
│   │   └── ui/                        # shadcn/ui component library
│   ├── hooks/
│   │   ├── use-realtime-energy.ts     # WebSocket connection hook
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── api/client.ts              # API base client
│   │   └── store/
│   │       ├── use-auth-store.ts      # Auth state (Zustand + localStorage)
│   │       └── use-energy-store.ts    # Energy data state
│   └── public/                        # Static assets
│
├── .venv/                             # Python virtual environment (not committed)
├── .gitignore
├── README.md                          # This file
├── ppt.md                             # PPT content — methodology, hardware specs, sample data
└── script.md                          # Presentation script — page-by-page walkthrough
```

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+ and npm
- A Google Cloud service account with Sheets API enabled (see backend README)

### 1 — Install Python dependencies

```bash
python -m venv .venv
./.venv/bin/pip install -r smart-meter-core-backend/requirements.txt
```

### 2 — Start the backend

```bash
METER_STEP_MINUTES=0.05 ./.venv/bin/uvicorn smart-meter-core-backend.main:app \
  --host 0.0.0.0 --port 8000 --reload
```

Backend runs at `http://localhost:8000`. On startup it connects to Google Sheets and restores historical readings into memory.

### 3 — Start the virtual smart meter (simulator)

In a second terminal:

```bash
./.venv/bin/python smart-meter-core-backend/simulator_run.py \
  --backend-url http://localhost:8000 \
  --meter-id MTR-8829-X1 \
  --interval-seconds 3
```

This sends a new reading every 3 seconds. Each reading is ingested by the backend, broadcast over WebSocket to the frontend, and appended to Google Sheets.

### 4 — Start the frontend

In a third terminal:

```bash
cd smart-meter-core-frontend
npm install        # first time only
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 5 — Log in

| Field | Value |
|---|---|
| Email | `demo@smartmeter.io` |
| Password | `password123` |
| Role | `CONSUMER` |
| Meter ID | `MTR-8829-X1` |

---

## Environment Variables (Backend)

| Variable | Default | Description |
|---|---|---|
| `METER_STEP_MINUTES` | `30` | Interval between readings for kWh integration. Set to `N/60` where N = simulator interval in seconds. For 3s intervals use `0.05` |
| `METER_RETENTION_DAYS` | `30` | How many days of readings to keep in memory |
| `JWT_SECRET` | `dev-secret` | JWT signing key — change in production |
| `AUTH_REQUIRED` | `false` | Set to `true` to require JWT token on WebSocket connections |

---

## Ingestion Contract

Any hardware gateway or simulator must POST to `/simulator/ingest`:

```json
{
  "meterId": "MTR-8829-X1",
  "timestamp": "2026-03-22T18:45:10+05:30",
  "usage": 1.742,
  "voltage": 230.09,
  "current": 7.571,
  "frequency": 50.121,
  "temperatureOutside": 20.69,
  "cost": null
}
```

`cost` is optional — the backend computes it from the TOU tariff if omitted.

---

## Time-of-Use Tariff

| Period | Hours (IST) | Rate |
|---|---|---|
| Peak | 17:00 – 21:00 | ₹0.25 / kWh |
| Shoulder | 07:00 – 17:00, 21:00 – 23:00 | ₹0.18 / kWh |
| Off-Peak | 23:00 – 07:00 | ₹0.12 / kWh |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Returns JWT token |
| POST | `/auth/logout` | Stateless logout |

### Simulator
| Method | Endpoint | Description |
|---|---|---|
| POST | `/simulator/ingest` | Ingest a meter reading |

### Consumer
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/consumer/dashboard?meterId=` | Live stats + hourly timeline + weekly comparison |
| GET | `/api/consumer/history?meterId=&range=day\|week\|month\|year` | Bucketed historical data |
| GET | `/api/consumer/forecast/hourly?meterId=` | 24-hour load forecast with confidence intervals |
| GET | `/api/consumer/forecast/weekly?meterId=` | 7-day forecast |
| GET | `/api/consumer/insights/efficiency?meterId=` | 12-month efficiency trend |
| GET | `/api/consumer/insights/appliances?meterId=` | Appliance breakdown |
| GET | `/api/consumer/insights/weather?meterId=` | Weather-demand correlation |
| GET | `/api/consumer/devices?meterId=` | Connected devices |

### WebSocket
| Endpoint | Description |
|---|---|
| `ws://localhost:8000/ws/consumer/realtime/:meterId` | Live readings stream |

---

## Google Sheets Persistence

Every reading is appended to a Google Sheet in real time. On backend restart, readings are restored from the sheet — no data loss.

Sheet columns: `timestamp | meterId | usage_kw | voltage_v | current_a | frequency_hz | temperature_c | cost_usd`

Timestamps are stored as `YYYY-MM-DD HH:MM:SS IST`.

See `smart-meter-core-backend/README.md` for full setup instructions.

---

## Dashboard Pages — Chart Reference

### Dashboard (`/dashboard/dashboard`)

<img width="1711" height="836" alt="Dashboard main view" src="https://github.com/user-attachments/assets/1d16607b-8a3f-436b-a2a0-e91e6ac51029" />

<img width="1688" height="266" alt="Dashboard weekly and cost breakdown" src="https://github.com/user-attachments/assets/255ae1cc-238c-4b76-8eed-0bef912e5d2f" />

**Live Power (last 20 readings)**
Area chart of the most recent 20 WebSocket readings. X-axis: IST time (`HH:MM:SS`). Y-axis: kW. Updates every 3 seconds.

**Today's Hourly Consumption**
Area chart of average kW per hour over the last 24 hours in IST. Built from real persisted readings.

**Weekly Comparison**
Bar chart: average kWh/day this week vs last week.

**Cost Breakdown (Last 24h)**
### Real-Time Monitoring (`/dashboard/monitoring`)

<img width="1695" height="876" alt="Real-time monitoring" src="https://github.com/user-attachments/assets/1b11a80c-785f-4b64-9e12-fefd7e617c3b" />

**Voltage Fluctuations**
Step line chart of live voltage (V). Y-axis fixed 220–245V. Detects grid instability and surges.

**Current Load Analysis**
Dual line chart: current (A) and power (kW) from the last 20 live readings.
Step line chart of live voltage (V). Y-axis fixed 220–245V. Detects grid instability and surges.
### Historical Analysis (`/dashboard/historical`)

<img width="1697" height="791" alt="Historical analysis trend" src="https://github.com/user-attachments/assets/7fbb9118-6879-4637-8488-1f6a6d531301" />

<img width="1687" height="334" alt="Peak demand vs temperature" src="https://github.com/user-attachments/assets/bba10f97-ad13-4f3c-ac76-a281e14de766" />

Time range: 24h / 7d / 30d / 12m. All data from Google Sheets.ive readings.

---

### Historical Analysis (`/dashboard/historical`)

### Load Forecast (`/dashboard/forecast`)

<img width="1687" height="703" alt="Load forecast hourly" src="https://github.com/user-attachments/assets/e25f5aac-7f4b-48d5-b9d0-5bd0e63d07d5" />

<img width="1691" height="363" alt="Grid price and net load" src="https://github.com/user-attachments/assets/a940c385-45a8-4c63-88cd-92333c895fbe" />

**Hourly Load Prediction****
Dual-axis composed chart. Left: kWh (area). Right: cost ₹ (line). IST-aware X-axis labels.

**Peak Demand vs Temperature**
Dual-axis composed chart. Left: peak kW (bars). Right: temperature °C (line). Shows weather-demand correlation.

---

### Load Forecast (`/dashboard/forecast`)

### AI Insights (`/dashboard/insights`)

<img width="1684" height="600" alt="AI insights overview" src="https://github.com/user-attachments/assets/a4fdffd3-183c-4e2c-954a-c6c0a80b6bb0" />

<img width="1693" height="775" alt="Appliance and weather analysis" src="https://github.com/user-attachments/assets/73076217-07ba-4ee5-ad8d-a851e8163d57" />

**Efficiency Trend** — 12-month score vs benchmark (area + line).
**Grid Price & Net Load**
Dual-axis: net load bars (kW) + grid price step line (₹/kWh). Highlights peak pricing windows.

### AI Chat (`/dashboard/ai-chat`)

<img width="979" height="853" alt="AI chat interface" src="https://github.com/user-attachments/assets/891c725d-c59a-471a-8ef4-10ecde3bcb41" />

Conversational interface with inline charts.
**Load Profile Radar**
Radar chart: Current vs Predicted vs Optimal across Morning / Midday / Afternoon / Evening / Night.

---

### AI Insights (`/dashboard/insights`)

**Efficiency Trend** — 12-month score vs benchmark (area + line).

**Appliance Breakdown** — Progress bars per appliance: usage %, efficiency score, savings potential.

**Weather Impact** — Dual-axis: daily usage bars + temperature line per day of week.

---

### AI Chat (`/dashboard/ai-chat`)

Conversational interface with inline charts. Keyword triggers:
- `peak` / `hours` → line chart of hourly usage pattern
- `bill` / `cost` → donut chart of bill breakdown
- `save` / `optimize` → bar chart of savings opportunities
- `anomaly` / `spike` → bar chart of normal vs actual usage

> No live AI model connected yet. Ready for OpenAI / Gemini / Ollama integration.

---

### Automation (`/dashboard/automation`)

Device on/off toggles and automation rule builder. No charts.

---

### Utility Dashboard (`/dashboard/utility/dashboard`)

Grid-level metrics: total load (MW), peak demand, renewable %, frequency, active consumers. Consumer segmentation by residential / commercial / industrial.

---

### Admin Health (`/dashboard/admin/health`)

Infrastructure status, SLA metrics, system resource usage, and audit log viewer.

---

## Hardware Integration (Next Step)

To connect a real meter, implement a gateway script on a Raspberry Pi that reads from a PZEM-004T energy metering IC and POSTs to `/simulator/ingest` using the same JSON contract. No backend changes required.

Recommended hardware:
- Raspberry Pi 4 Model B
- PZEM-004T v3.0 (voltage, current, frequency, power factor)
- SCT-013-100 split-core current transformer
- DS18B20 temperature sensor

See `ppt.md` for full hardware specifications and cost breakdown.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request

---


