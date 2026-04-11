# SmartMeter Core (Connected MVP)

## Purpose
This repository contains:
1. A Next.js frontend (dashboard UI)
2. A FastAPI backend (REST + WebSocket)
3. A simulator that acts like a “virtual smart meter” by sending readings to the backend

This is intended to support end-to-end UI testing now, and hardware integration later using the same ingestion contract.

## Architecture (high level)
1. Simulator (or hardware gateway) sends meter readings to the backend via HTTP.
2. Backend stores recent readings in memory (MVP) and broadcasts live updates over WebSocket.
3. Frontend subscribes to the WebSocket stream and renders charts for Consumer pages.

## Quick Start (local)
1. Start backend
   - `smart-meter-core-backend/main.py` (FastAPI)
2. Start simulator
   - `smart-meter-core-backend/simulator_run.py`
3. Start frontend
   - `smart-meter-core-frontend` via `npm run dev`

## Ports (MVP defaults)
- Backend REST + WebSocket: `http://localhost:8000`

## Ingestion contract (Simulator -> Backend)
Both simulator and future hardware gateway must send the same JSON payload to:
- `POST /simulator/ingest`

Required fields:
- `meterId` (string)
- `timestamp` (ISO datetime)
- `usage` (number; instantaneous kW)
- `voltage` (V)
- `current` (A)
- `frequency` (Hz)
- `temperatureOutside` (C, optional)
- `cost` (USD, optional; backend computes if omitted)

## Frontend -> Backend
The frontend uses:
- REST (dashboard, history, forecast, insights, devices)
- WebSocket:
  - `/ws/consumer/realtime/:meterId`

## Hardware integration (next)
When you connect real hardware, you should implement a “hardware ingestion gateway” that converts raw meter output to the ingestion contract above, then POSTs to the backend.

See:
- `smart-meter-core-backend/README.md`
- `smart-meter-core-backend/README_SIMULATOR.md` (if you create custom simulator adapters later)

## Running steps after setup
# Backend : METER_STEP_MINUTES=0.05 ./.venv/bin/uvicorn smart-meter-core-backend.main:app --host 0.0.0.0 --port 8000 --reload

# virtual samrtmeter : ./.venv/bin/python smart-meter-core-backend/simulator_run.py --backend-url http://localhost:8000 --meter-id MTR-8829-X1 --interval-seconds 3


---

## Dashboard Pages — Graph & Chart Reference

### Dashboard (`/dashboard/dashboard`)
<img width="1711" height="836" alt="Screenshot from 2026-03-24 17-43-04" src="https://github.com/user-attachments/assets/1d16607b-8a3f-436b-a2a0-e91e6ac51029" />


<img width="1688" height="266" alt="Screenshot from 2026-03-24 17-44-40" src="https://github.com/user-attachments/assets/255ae1cc-238c-4b76-8eed-0bef912e5d2f" />

**Live Power (last 20 readings)**
Area chart showing the most recent 20 WebSocket readings from the smart meter. X-axis shows IST time (`HH:MM:SS`), Y-axis shows instantaneous power in kW. Updates every 3 seconds as the simulator sends new readings. Useful for spotting sudden load spikes or drops in real time.

**Today's Hourly Consumption (IST)**
Area chart showing average power (kW) per hour for the last 24 hours, bucketed in 1-hour intervals with IST labels. Built from real readings stored in memory (restored from Google Sheets on restart). Hours with no data show as zero. Useful for understanding the daily consumption shape — morning peak, midday lull, evening peak.

**Weekly Comparison**
Bar chart comparing average daily energy (kWh/day) between the current 7-day window and the previous 7-day window. Two bars: "Last Week" and "This Week". A delta label below shows whether consumption went up or down. Useful for tracking week-over-week efficiency trends.

**Cost Breakdown (Last 24h)**
Bar chart splitting the last 24 hours of estimated cost into two categories: Peak hours (17:00–21:00 IST, rate ₹0.25/kWh) and Off-Peak (all other hours, rate ₹0.12–0.18/kWh). Helps consumers and retailers understand how time-of-use pricing affects the bill.

---

### Real-Time Monitoring (`/dashboard/monitoring`)

<img width="1695" height="876" alt="Screenshot from 2026-03-24 17-45-46" src="https://github.com/user-attachments/assets/1b11a80c-785f-4b64-9e12-fefd7e617c3b" />


**Voltage Fluctuations (240V Nominal)**
Step line chart of voltage (V) from the last 20 live readings. Y-axis is fixed between 220V–245V. Useful for detecting grid instability, voltage sags, or surges that could damage appliances.

**Current Load Analysis**
Line chart overlaying two series from the last 20 live readings: Current (A) and Usage (kW). Both update in real time via WebSocket. Useful for correlating current draw with power consumption and identifying high-draw appliances.

---

### Historical Analysis (`/dashboard/historical`)

<img width="1697" height="791" alt="Screenshot from 2026-03-24 17-48-28" src="https://github.com/user-attachments/assets/7fbb9118-6879-4637-8488-1f6a6d531301" />

<img width="1687" height="334" alt="Screenshot from 2026-03-24 17-48-45" src="https://github.com/user-attachments/assets/bba10f97-ad13-4f3c-ac76-a281e14de766" />


Time range selector: 24 Hours / 7 Days / 30 Days / 12 Months. All data comes from real readings stored in Google Sheets and loaded into the backend on startup.

**Energy Consumption Trend**
Composed chart with dual Y-axes. Left axis: energy consumed (kWh) per bucket shown as a filled area. Right axis: estimated cost (₹) shown as a line. X-axis labels are IST-aware: `HH:MM` for 24h view, `Day DD/MM` for weekly, `DD Mon` for monthly, `Mon` for yearly. The 24h view angles labels at -45° to prevent overlap. Useful for identifying high-consumption periods and their cost impact.

**Peak Demand vs Temperature**
Composed chart with dual Y-axes. Left axis: peak instantaneous demand (kW) per bucket shown as bars. Right axis: average ambient temperature (°C) shown as a line. Reveals the correlation between hot/cold weather and energy demand — critical for energy retailers doing demand forecasting.

---

### Load Forecast (`/dashboard/forecast`)

<img width="1687" height="703" alt="Screenshot from 2026-03-24 17-50-22" src="https://github.com/user-attachments/assets/e25f5aac-7f4b-48d5-b9d0-5bd0e63d07d5" />


<img width="1691" height="363" alt="Screenshot from 2026-03-24 17-50-52" src="https://github.com/user-attachments/assets/a940c385-45a8-4c63-88cd-92333c895fbe" />

**Hourly Load Prediction (24-Hour tab)**
Composed chart showing the next 24 hours. Three layers: a shaded confidence band (upper/lower bounds), the predicted load line (kW) in the primary colour, and a dashed line for expected solar generation (kW). X-axis shows hour offsets (0:00 = next hour). Useful for planning when to shift flexible loads like EV charging or water heating.

**Grid Price & Net Load Analysis (24-Hour tab)**
Composed chart with dual Y-axes. Left axis: net load (kW, after subtracting solar) as bars. Right axis: grid price (₹/kWh) as a step line. Highlights peak pricing windows (17:00–21:00) visually so consumers know exactly when to avoid running heavy appliances.

**7-Day Usage Forecast (Weekly tab)**
Grouped bar chart showing predicted daily usage (kWh) and renewable generation (kWh) side by side for the next 7 days, with a cost line (₹) on the right axis. Weekend days show lower consumption due to the weekend dampening factor. Useful for weekly energy budget planning.

**Load Profile Comparison (Load Profile tab)**
Radar chart with five time-of-day categories: Morning, Midday, Afternoon, Evening, Night. Three overlapping polygons: Current pattern (slightly above predicted), Predicted pattern, and Optimal pattern (8% below predicted). Shows at a glance which time slots are over-consuming relative to the optimal profile.

---

### AI Insights (`/dashboard/insights`)

<img width="1684" height="600" alt="Screenshot from 2026-03-24 17-52-13" src="https://github.com/user-attachments/assets/a4fdffd3-183c-4e2c-954a-c6c0a80b6bb0" />

<img width="1693" height="775" alt="Screenshot from 2026-03-24 17-52-44" src="https://github.com/user-attachments/assets/73076217-07ba-4ee5-ad8d-a851e8163d57" />


**Energy Efficiency Trend**
Area chart showing a 12-month rolling efficiency score (0–100) for the meter vs a fixed benchmark line (85). Higher is better. Useful for tracking whether efficiency improvements are sticking over time.

**Appliance Efficiency Analysis**
Progress bar list (not a chart) showing each appliance's share of total consumption (%), its efficiency score, and potential monthly savings. Color-coded: green ≥ 85%, yellow ≥ 75%, red below 75%.

**Weather Impact Analysis**
Composed chart with dual Y-axes. Left axis: average daily energy usage (kWh) as bars per day of the week. Right axis: average ambient temperature (°C) as a line. Demonstrates the temperature-demand correlation — useful for energy retailers to model weather-adjusted demand.

---

### AI Chat (`/dashboard/ai-chat`)

<img width="979" height="853" alt="Screenshot from 2026-03-24 17-54-23" src="https://github.com/user-attachments/assets/891c725d-c59a-471a-8ef4-10ecde3bcb41" />


Not a chart page — conversational interface. Responses include inline charts based on keywords:
- "peak" / "hours" → line chart of daily peak usage pattern by hour
- "bill" / "cost" / "forecast" → donut pie chart of bill breakdown by category
- "save" / "optimize" → bar chart of monthly savings opportunities by category
- "anomaly" / "spike" / "unusual" → bar chart comparing normal vs actual daily usage

Note: responses are currently keyword-matched with hardcoded demo data. No live AI model is connected yet.

---

### Automation (`/dashboard/automation`)
No charts — device control toggles and automation rule management UI only.
