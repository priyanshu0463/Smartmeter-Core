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

