import asyncio
import math
import os
import random
import datetime as dt
from collections import defaultdict, deque
from typing import Any, Deque, Dict, List, Optional, Set
from concurrent.futures import ThreadPoolExecutor

import jwt
import gspread
from google.oauth2.service_account import Credentials
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


APP_PREFIX = "/api"
WS_PREFIX = "/ws"

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"

# In this MVP, we keep meter data in memory.
METER_RETENTION_DAYS = int(os.getenv("METER_RETENTION_DAYS", "30"))
METER_STEP_MINUTES = float(os.getenv("METER_STEP_MINUTES", "30"))
MAX_POINTS_PER_METER = int(
    os.getenv("MAX_POINTS_PER_METER", str(int((METER_RETENTION_DAYS * 24 * 60) / max(METER_STEP_MINUTES, 1e-9))))
)


# ── Google Sheets integration ──────────────────────────────────────────────
_SHEET_ID = "14rcrXzf1D7fFEXaJxYelihAcnZyedj4YqXS5Df2qzdw"
_SA_FILE = os.path.join(os.path.dirname(__file__), "rebooktraboda-27b44cc07e68.json")
_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
_SHEET_HEADERS = ["timestamp", "meterId", "usage_kw", "voltage_v", "current_a", "frequency_hz", "temperature_c", "cost_usd"]
_sheets_executor = ThreadPoolExecutor(max_workers=1)

def _init_sheet() -> Optional[gspread.Worksheet]:
    try:
        creds = Credentials.from_service_account_file(_SA_FILE, scopes=_SCOPES)
        gc = gspread.authorize(creds)
        ws = gc.open_by_key(_SHEET_ID).sheet1
        # Clear any empty junk rows and ensure header is row 1
        all_vals = ws.get_all_values()
        # Find first non-empty row
        first_content = next((i for i, row in enumerate(all_vals) if any(c.strip() for c in row)), None)
        if first_content is None or all_vals[first_content][0] != "timestamp":
            # Sheet is empty or has no valid header — clear and write header
            ws.clear()
            ws.insert_row(_SHEET_HEADERS, index=1)
            print("[sheets] Initialized sheet with header row")
        print("[sheets] Connected to Google Sheet successfully")
        return ws
    except Exception as e:
        print(f"[sheets] Failed to connect: {e}")
        return None

_worksheet: Optional[gspread.Worksheet] = _init_sheet()


def _load_history_from_sheet(meter_id: str) -> List[Dict[str, Any]]:
    """Read all rows for a given meterId from the sheet and return as reading dicts."""
    if _worksheet is None:
        return []
    try:
        all_vals = _worksheet.get_all_values()
        if not all_vals:
            return []
        # Find header row
        header_idx = next((i for i, row in enumerate(all_vals) if row and row[0] == "timestamp"), None)
        if header_idx is None:
            return []
        headers = all_vals[header_idx]
        cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=METER_RETENTION_DAYS)
        readings: List[Dict[str, Any]] = []
        for row in all_vals[header_idx + 1:]:
            if not any(c.strip() for c in row):
                continue  # skip empty rows
            try:
                row_dict = dict(zip(headers, row))
                if str(row_dict.get("meterId", "")) != meter_id:
                    continue
                ts_str = str(row_dict["timestamp"]).replace(" IST", "+05:30")
                ts = dt.datetime.fromisoformat(ts_str)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=dt.timezone.utc)
                if ts < cutoff:
                    continue
                readings.append({
                    "timestamp": ts,
                    "usage": float(row_dict["usage_kw"]),
                    "voltage": float(row_dict["voltage_v"]),
                    "current": float(row_dict["current_a"]),
                    "frequency": float(row_dict["frequency_hz"]),
                    "temperatureOutside": float(row_dict["temperature_c"]),
                    "renewable": float(solar_kw(ts.hour + ts.minute / 60.0)),
                    "cost": float(row_dict["cost_usd"]),
                })
            except Exception:
                continue
        readings.sort(key=lambda r: r["timestamp"])
        print(f"[sheets] Loaded {len(readings)} historical readings for {meter_id}")
        return readings
    except Exception as e:
        print(f"[sheets] load history error: {e}")
        return []


def _append_to_sheet(reading: Dict[str, Any], meter_id: str) -> None:
    """Blocking call — always run in the thread executor."""
    if _worksheet is None:
        return
    try:
        ts_ist = reading["timestamp"].astimezone(IST)
        row = [
            ts_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
            meter_id,
            round(reading["usage"], 3),
            round(reading["voltage"], 2),
            round(reading["current"], 3),
            round(reading["frequency"], 3),
            round(reading["temperatureOutside"], 2),
            round(reading["cost"], 6),
        ]
        _worksheet.append_row(row, value_input_option="USER_ENTERED")
    except Exception as e:
        print(f"[sheets] append error: {e}")

# ───────────────────────────────────────────────────────────────────────────

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))

def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def tariff_rate(ts: dt.datetime) -> float:
    # Simple TOU pricing: peak 17:00-21:00, shoulder, off-peak.
    h = ts.hour + ts.minute / 60.0
    if 17 <= h < 21:
        return 0.25
    if 7 <= h < 17 or 21 <= h < 23:
        return 0.18
    return 0.12


def solar_kw(hour: float) -> float:
    # Rough solar curve: zero outside 6-18, peak around noon.
    if hour < 6 or hour > 18:
        return 0.0
    x = (hour - 6) / 12.0  # 0..1
    return max(0.0, 3.5 * math.sin(math.pi * x))


def ensure_meter_seed_usage(ts: dt.datetime) -> float:
    # Usage profile (kW) that changes by hour and weekday.
    hour = ts.hour + ts.minute / 60.0
    dow = ts.weekday()  # 0=Mon
    weekend = 0.85 if dow >= 5 else 1.0
    month = ts.month
    seasonal = 1.0 + 0.12 * math.sin((month - 1) / 12.0 * 2 * math.pi)

    # Two humps: morning and evening.
    morning = 1.1 * math.exp(-0.5 * ((hour - 7.5) / 2.2) ** 2)
    evening = 1.6 * math.exp(-0.5 * ((hour - 19.0) / 2.8) ** 2)
    base = 1.6

    noise = random.gauss(0, 0.08)
    return max(0.1, (base + morning + evening) * weekend * seasonal + noise)


def temp_outside_c(ts: dt.datetime) -> float:
    # Synthetic temperature in C with daily + seasonal components.
    day_phase = (ts.hour + ts.minute / 60.0) / 24.0 * 2 * math.pi
    year_phase = (ts.timetuple().tm_yday / 365.0) * 2 * math.pi
    return 20.0 + 6.0 * math.sin(year_phase - 1.2) + 4.0 * math.sin(day_phase - 0.6) + random.gauss(0, 0.4)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(default="password123")
    role: str = Field(default="CONSUMER")
    meterId: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    user: Dict[str, Any]
    expiresIn: int = 86400


class IngestReadingRequest(BaseModel):
    meterId: str
    timestamp: Optional[dt.datetime] = None
    usage: float = Field(..., description="Instant usage in kW")
    voltage: float = Field(default=230.0, description="Voltage in V")
    current: float = Field(..., description="Current in A")
    frequency: float = Field(default=50.0, description="Grid frequency in Hz")
    temperatureOutside: Optional[float] = None
    cost: Optional[float] = None


class MeterStore:
    def __init__(self) -> None:
        self._data: Dict[str, Deque[Dict[str, Any]]] = {}
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    def ensure_meter(self, meter_id: str) -> None:
        if meter_id in self._data and len(self._data[meter_id]) > 10:
            return

        # Try to restore real history from Google Sheets first
        sheet_readings = _load_history_from_sheet(meter_id)
        if sheet_readings:
            dq: Deque[Dict[str, Any]] = deque(maxlen=MAX_POINTS_PER_METER)
            for r in sheet_readings[-MAX_POINTS_PER_METER:]:
                dq.append(r)
            self._data[meter_id] = dq
            print(f"[store] Restored {len(dq)} readings for {meter_id} from Google Sheets")
            return

        # No sheet data — fall back to synthetic seed so the UI isn't empty
        print(f"[store] No sheet history found for {meter_id}, seeding with synthetic data")
        now = utcnow()
        start = now - dt.timedelta(days=METER_RETENTION_DAYS)
        step = dt.timedelta(minutes=METER_STEP_MINUTES)
        points = int((now - start) / step)

        dq = deque(maxlen=MAX_POINTS_PER_METER)
        for i in range(points):
            ts = start + i * step
            hour = ts.hour + ts.minute / 60.0
            usage_kw = ensure_meter_seed_usage(ts)
            voltage = 230.0 + random.gauss(0, 1.2)
            current_a = (usage_kw * 1000.0) / max(1.0, voltage)
            frequency = 50.0 + random.gauss(0, 0.04)
            temp_c = temp_outside_c(ts)
            solar = solar_kw(hour)
            rate = tariff_rate(ts)
            interval_hours = METER_STEP_MINUTES / 60.0
            energy_kwh = usage_kw * interval_hours
            cost = energy_kwh * rate

            dq.append({
                "timestamp": ts,
                "usage": float(usage_kw),
                "voltage": float(voltage),
                "current": float(current_a),
                "frequency": float(frequency),
                "temperatureOutside": float(temp_c),
                "renewable": float(solar),
                "cost": float(cost),
            })

        self._data[meter_id] = dq

    def add_reading(self, meter_id: str, reading: Dict[str, Any]) -> None:
        self.ensure_meter(meter_id)
        dq = self._data[meter_id]
        dq.append(reading)

    def latest(self, meter_id: str) -> Optional[Dict[str, Any]]:
        dq = self._data.get(meter_id)
        if not dq:
            return None
        return dq[-1]

    def readings_between(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> List[Dict[str, Any]]:
        dq = self._data.get(meter_id)
        if not dq:
            return []
        # dq is already ordered by timestamp.
        out = [r for r in dq if start <= r["timestamp"] <= end]
        return out

    def approximate_energy_kwh(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> List[Dict[str, Any]]:
        """
        Return readings + enough timing context to integrate usage (kWh) over intervals.
        We use piecewise-constant integration with each reading's usage over the next delta.
        """
        rs = self.readings_between(meter_id, start, end)
        if not rs:
            return []
        rs = sorted(rs, key=lambda x: x["timestamp"])
        # Add a synthetic endpoint at end using last known usage so integration covers up to end.
        if rs[-1]["timestamp"] < end:
            rs2 = rs + [
                {**rs[-1], "timestamp": end},
            ]
        else:
            rs2 = rs
        return rs2


store = MeterStore()

app = FastAPI(title="SmartMeter Core Backend (MVP)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sign_token(user: Dict[str, Any]) -> str:
    exp = utcnow() + dt.timedelta(days=1)
    payload = {"sub": user["id"], "role": user["role"], "meterId": user.get("meterId"), "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None


def get_auth_user(authorization: Optional[str] = Header(default=None)) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    decoded = decode_token(parts[1])
    return decoded


@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    role = body.role.upper()
    if role not in {"CONSUMER", "UTILITY", "ADMIN"}:
        raise HTTPException(status_code=400, detail="Invalid role")

    # Password verification is skipped for MVP.
    user_id = "usr_" + str(abs(hash(body.email)) % 1000000)
    user: Dict[str, Any] = {
        "id": user_id,
        "email": body.email,
        "name": body.email.split("@")[0],
        "role": role,
    }
    if role == "CONSUMER":
        user["meterId"] = body.meterId or "MTR-8829-X1"

    token = sign_token(user)
    return LoginResponse(token=token, user=user, expiresIn=86400)


@app.post("/auth/logout")
def logout():
    # MVP: stateless JWT, so nothing to revoke.
    return {"message": "Logged out successfully"}


@app.websocket(f"{WS_PREFIX}/consumer/realtime/{{meter_id}}")
async def consumer_realtime_ws(ws: WebSocket, meter_id: str, token: Optional[str] = Query(default=None)):
    # MVP: allow unauthenticated WS if AUTH_REQUIRED is false.
    if AUTH_REQUIRED:
        if not token:
            await ws.close(code=1008)
            return
        decoded = decode_token(token)
        if not decoded:
            await ws.close(code=1008)
            return

    await ws.accept()
    store.ensure_meter(meter_id)
    store._connections[meter_id].add(ws)

    try:
        # Keep connection open. We don't expect messages from the client,
        # but receiving keeps FastAPI aware of disconnects.
        while True:
            _ = await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        store._connections[meter_id].discard(ws)


@app.post("/simulator/ingest")
async def simulator_ingest(body: IngestReadingRequest):
    ts = body.timestamp or utcnow()
    store.ensure_meter(body.meterId)

    rate = tariff_rate(ts)
    interval_hours = METER_STEP_MINUTES / 60.0
    energy_kwh = body.usage * interval_hours
    cost = body.cost if body.cost is not None else energy_kwh * rate
    voltage = body.voltage
    current_a = body.current if body.current is not None else (body.usage * 1000.0) / max(1.0, voltage)

    reading = {
        "timestamp": ts,
        "usage": float(body.usage),
        "voltage": float(voltage),
        "current": float(current_a),
        "frequency": float(body.frequency),
        "temperatureOutside": float(body.temperatureOutside if body.temperatureOutside is not None else temp_outside_c(ts)),
        "renewable": float(solar_kw(ts.hour + ts.minute / 60.0)),
        "cost": float(cost),
    }

    store.add_reading(body.meterId, reading)

    # Persist to Google Sheets (non-blocking)
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_sheets_executor, _append_to_sheet, reading, body.meterId)

    # Broadcast to websocket subscribers.
    conns = list(store._connections.get(body.meterId, set()))
    if conns:
        msg = {
            "meterId": body.meterId,
            "timestamp": ts.astimezone(IST).strftime("%H:%M:%S"),
            "usage": reading["usage"],
            "voltage": reading["voltage"],
            "current": reading["current"],
            "frequency": reading["frequency"],
            "cost": reading["cost"],
        }
        # Send concurrently so ingestion stays responsive.
        send_tasks = []
        for ws in conns:
            try:
                send_tasks.append(ws.send_json(msg))
            except Exception:
                pass
        if send_tasks:
            await asyncio.gather(*send_tasks, return_exceptions=True)

    return {"ok": True, "stored": 1}


@app.get(f"{APP_PREFIX}/consumer/realtime")
def consumer_realtime(meterId: str = Query(...)):
    store.ensure_meter(meterId)
    latest = store.latest(meterId)
    if not latest:
        raise HTTPException(status_code=404, detail="No data for meter")
    return {
        "meterId": meterId,
        "timestamp": latest["timestamp"].astimezone(IST).strftime("%H:%M:%S"),
        "usage": latest["usage"],
        "voltage": latest["voltage"],
        "current": latest["current"],
        "frequency": latest["frequency"],
        "cost": latest["cost"],
    }


def bucket_label(range_name: str, idx: int) -> str:
    if range_name == "day":
        return f"{idx}:00"
    if range_name == "week":
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][idx]
    if range_name == "month":
        return f"Day {idx + 1}"
    if range_name == "year":
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][idx]
    return str(idx)


@app.get(f"{APP_PREFIX}/consumer/dashboard")
def consumer_dashboard(
    meterId: str = Query(...),
):
    store.ensure_meter(meterId)
    latest = store.latest(meterId)
    if not latest:
        raise HTTPException(status_code=404, detail="No data for meter")

    now = utcnow()
    start_24h = now - dt.timedelta(hours=24)
    # Integrate kWh from readings over time.
    rs = store.approximate_energy_kwh(meterId, start_24h, now)
    if not rs:
        raise HTTPException(status_code=404, detail="No data for meter")

    # energy_kwh and average rate estimate
    energy_kwh = 0.0
    total_cost = 0.0
    t0 = start_24h
    for i in range(len(rs) - 1):
        r = rs[i]
        t_start = r["timestamp"]
        t_end = rs[i + 1]["timestamp"]
        dt_hours = max(0.0, (t_end - t_start).total_seconds() / 3600.0)
        energy_kwh += float(r["usage"]) * dt_hours
        total_cost += float(r["usage"]) * dt_hours * tariff_rate(t_start)

    avg_usage_kw = float(latest["usage"])
    # Timeline: hourly buckets over last 24h (avg kW) — labels in IST
    timeline: List[Dict[str, Any]] = []
    for i in range(24):
        b_start = now - dt.timedelta(hours=(23 - i))
        b_end = b_start + dt.timedelta(hours=1)
        bucket = [r for r in store.readings_between(meterId, b_start, b_end)]
        if not bucket:
            continue
        avg_kw = sum(r["usage"] for r in bucket) / len(bucket)
        timeline.append({"time": b_start.astimezone(IST).strftime("%H:%M"), "usage": round(avg_kw, 3)})

    # Weekly comparison: energy per day for last 7 days vs previous 7 days.
    start_this = now - dt.timedelta(days=7)
    start_prev = now - dt.timedelta(days=14)

    def energy_for_day(day_start: dt.datetime) -> float:
        day_end = day_start + dt.timedelta(days=1)
        r2 = store.approximate_energy_kwh(meterId, day_start, day_end)
        if not r2:
            return 0.0
        e = 0.0
        for j in range(len(r2) - 1):
            dt_hours = max(0.0, (r2[j + 1]["timestamp"] - r2[j]["timestamp"]).total_seconds() / 3600.0)
            e += float(r2[j]["usage"]) * dt_hours
        return e

    this_days: List[float] = []
    prev_days: List[float] = []
    for i in range(7):
        d_this = (start_this + dt.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        d_prev = (start_prev + dt.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        this_days.append(energy_for_day(d_this))
        prev_days.append(energy_for_day(d_prev))

    this_avg = sum(this_days) / len(this_days) if this_days else 0.0
    prev_avg = sum(prev_days) / len(prev_days) if prev_days else 0.0
    weekly_comparison = {
        "thisWeek": round(this_avg, 3),
        "lastWeek": round(prev_avg, 3),
        "change": round(this_avg - prev_avg, 3),
    }

    # Very simple savings estimate: pretend optimal would be 3% lower.
    optimal_energy = energy_kwh * 0.97
    estimated_bill = total_cost
    cost_savings = max(0.0, total_cost - optimal_energy * (total_cost / max(energy_kwh, 1e-6)))

    # Cost breakdown: peak/off-peak split.
    # Use buckets and tariff rules.
    peak_cost = 0.0
    offpeak_cost = 0.0
    rs2 = store.approximate_energy_kwh(meterId, start_24h, now)
    for i in range(len(rs2) - 1):
        r = rs2[i]
        dt_hours = max(0.0, (rs2[i + 1]["timestamp"] - r["timestamp"]).total_seconds() / 3600.0)
        rate = tariff_rate(r["timestamp"])
        c = float(r["usage"]) * dt_hours * rate
        h = r["timestamp"].hour + r["timestamp"].minute / 60.0
        if 17 <= h < 21:
            peak_cost += c
        else:
            offpeak_cost += c

    cost_breakdown = {"peak": round(peak_cost, 2), "offPeak": round(offpeak_cost, 2)}

    return {
        "currentUsage": round(avg_usage_kw, 3),
        "dailyUsage": round(energy_kwh, 3),
        "estimatedBill": round(estimated_bill, 2),
        "costSavings": round(cost_savings, 2),
        "timeline": timeline,
        "weeklyComparison": weekly_comparison,
        "costBreakdown": cost_breakdown,
    }


@app.get(f"{APP_PREFIX}/consumer/history")
def consumer_history(
    meterId: str = Query(...),
    history_range: str = Query("day", alias="range", pattern="^(day|week|month|year)$"),
):
    store.ensure_meter(meterId)
    now_utc = utcnow()
    now_ist = now_utc.astimezone(IST)

    if history_range == "day":
        count = 24
        # Align to the start of the current hour in IST
        start_ist = (now_ist - dt.timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
        start = start_ist.astimezone(dt.timezone.utc)
        bucket_span = dt.timedelta(hours=1)
    elif history_range == "week":
        count = 7
        start = now_utc - dt.timedelta(days=7)
        bucket_span = dt.timedelta(days=1)
    elif history_range == "month":
        count = 30
        start = now_utc - dt.timedelta(days=30)
        bucket_span = dt.timedelta(days=1)
    else:
        count = 12
        start = now_utc - dt.timedelta(days=365)
        bucket_span = dt.timedelta(days=365 / 12)

    day_names_short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    data: List[Dict[str, Any]] = []
    for idx in range(count):
        b_start = start + idx * bucket_span
        b_end = b_start + bucket_span

        # Human-readable IST label
        b_start_ist = b_start.astimezone(IST)
        if history_range == "day":
            label = b_start_ist.strftime("%H:%M")
        elif history_range == "week":
            label = f"{day_names_short[b_start_ist.weekday()]} {b_start_ist.strftime('%d/%m')}"
        elif history_range == "month":
            label = b_start_ist.strftime("%d %b")
        else:
            label = month_names[b_start_ist.month - 1]

        rs = store.approximate_energy_kwh(meterId, b_start, b_end)
        if not rs:
            usage_kwh = 0.0
            peak_kw = 0.0
            avg_temp = 0.0
            cost = 0.0
        else:
            usage_kwh = 0.0
            cost = 0.0
            peak_kw = 0.0
            temps: List[float] = []
            for i in range(len(rs) - 1):
                r = rs[i]
                dt_hours = max(0.0, (rs[i + 1]["timestamp"] - r["timestamp"]).total_seconds() / 3600.0)
                usage_kwh += float(r["usage"]) * dt_hours
                cost += float(r["usage"]) * dt_hours * tariff_rate(r["timestamp"])
                peak_kw = max(peak_kw, float(r["usage"]))
                temps.append(float(r["temperatureOutside"]))
            avg_temp = sum(temps) / len(temps) if temps else 0.0

        data.append(
            {
                "label": label,
                "usage": round(usage_kwh, 3),
                "cost": round(cost, 4),
                "temperature": round(avg_temp, 2),
                "peakDemand": round(peak_kw, 3),
            }
        )

    return {"range": history_range, "data": data}


@app.get(f"{APP_PREFIX}/consumer/forecast/hourly")
def consumer_forecast_hourly(meterId: str = Query(...)):
    store.ensure_meter(meterId)
    now = utcnow()

    # Baseline: average usage by hour-of-day over last 7 days.
    start_hist = now - dt.timedelta(days=7)
    readings = store.readings_between(meterId, start_hist, now)
    by_hour_sum = [0.0] * 24
    by_hour_cnt = [0] * 24
    for r in readings:
        h = r["timestamp"].hour
        by_hour_sum[h] += float(r["usage"])
        by_hour_cnt[h] += 1
    baseline = [by_hour_sum[h] / max(1, by_hour_cnt[h]) for h in range(24)]

    # Trend: compare last 6h vs previous 6h average usage.
    last_6h_start = now - dt.timedelta(hours=6)
    prev_6h_start = now - dt.timedelta(hours=12)
    rs_last = store.readings_between(meterId, last_6h_start, now)
    rs_prev = store.readings_between(meterId, prev_6h_start, last_6h_start)
    avg_last = sum(r["usage"] for r in rs_last) / max(1, len(rs_last))
    avg_prev = sum(r["usage"] for r in rs_prev) / max(1, len(rs_prev))
    trend_ratio = (avg_last - avg_prev) / max(0.1, avg_prev)

    forecast: List[Dict[str, Any]] = []
    for i in range(24):
        future_ts = now + dt.timedelta(hours=i + 1)  # start from next hour
        h = future_ts.hour
        hour_of_day = h
        predicted = baseline[hour_of_day] * (1.0 + 0.08 * trend_ratio)
        # Light noise for variability.
        predicted += random.gauss(0, 0.12)
        predicted = max(0.05, predicted)

        renewable = solar_kw(hour_of_day + 0.5) + max(0.0, random.gauss(0, 0.08))
        renewable = max(0.0, renewable)

        net_load = max(0.0, predicted - renewable)
        rate = tariff_rate(future_ts)

        # Confidence interval ~ +- 15% scaled by renewable availability.
        width = 0.15 * predicted + 0.05 * renewable
        confidence_lower = max(0.0, predicted - width + random.gauss(0, 0.08))
        confidence_upper = predicted + width + random.gauss(0, 0.08)

        forecast.append(
            {
                "time": f"{i}:00",
                "hour": i,
                "predicted": round(predicted, 3),
                "confidenceUpper": round(confidence_upper, 3),
                "confidenceLower": round(confidence_lower, 3),
                "renewable": round(renewable, 3),
                "gridPrice": round(rate, 3),
                "netLoad": round(net_load, 3),
            }
        )

    # Simple model metrics (MVP).
    model_metrics = {"accuracy": round(0.75 + 0.15 * random.random(), 3), "lastUpdated": now.isoformat()}
    return {"generatedAt": now.isoformat(), "forecast": forecast, "modelMetrics": model_metrics}


@app.get(f"{APP_PREFIX}/consumer/forecast/weekly")
def consumer_forecast_weekly(meterId: str = Query(...)):
    store.ensure_meter(meterId)
    now = utcnow()

    # Use hourly forecast baseline as proxy for daily energy.
    hourly = consumer_forecast_hourly(meterId=meterId)["forecast"]
    # Total predicted renewable energy in the next 24h.
    hourly_renew_total = sum(p["renewable"] for p in hourly) / 24.0

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly: List[Dict[str, Any]] = []
    insights: List[str] = []

    # Determine next 7 days starting tomorrow.
    for di in range(7):
        dts = now + dt.timedelta(days=di + 1)
        day_name = day_names[dts.weekday()]

        # Weekend dampening.
        weekend_factor = 0.9 if dts.weekday() >= 5 else 1.0
        # Daily usage proxy from the hourly forecast average.
        avg_hour_pred = sum(p["predicted"] for p in hourly) / 24.0
        avg_hour_net = sum(p["netLoad"] for p in hourly) / 24.0
        daily_usage_kwh = (avg_hour_net * 24.0) * weekend_factor + random.gauss(0, 4.0)
        daily_usage_kwh = max(0.1, daily_usage_kwh)

        avg_rate = sum(tariff_rate(now + dt.timedelta(hours=h)) for h in range(24)) / 24.0
        daily_cost = daily_usage_kwh * avg_rate + random.gauss(0, 2.0)
        daily_cost = max(0.01, daily_cost)

        daily_renew = max(0.0, hourly_renew_total * 0.95 + random.gauss(0, 0.2)) * weekend_factor
        weekly.append(
            {
                "day": day_name,
                "usage": round(daily_usage_kwh, 2),
                "cost": round(daily_cost, 2),
                "renewable": round(daily_renew, 2),
            }
        )

    best = max(weekly, key=lambda x: x["renewable"])
    insights.append(f"Best renewable generation is expected on {best['day']}.")
    offpeak_tip = "Shift discretionary usage to off-peak hours for cost savings."
    insights.append(offpeak_tip)

    return {"weeklyPattern": weekly, "insights": insights, "generatedAt": now.isoformat()}


@app.get(f"{APP_PREFIX}/consumer/pricing/forecast")
def consumer_pricing_forecast(meterId: str = Query(...)):
    # Optional extra endpoint used by the broader README; frontend currently uses hourly+weekly.
    hourly = consumer_forecast_hourly(meterId=meterId)["forecast"]
    return {
        "forecast": [
            {
                "time": p["time"],
                "rate": p["gridPrice"],
                "period": "peak" if p["gridPrice"] >= 0.2 else "offPeak",
                "expectedLoad": round(p["netLoad"] * 1000, 2),
            }
            for p in hourly
        ],
        "recommendation": "Run EV/Water Heater during low-price windows.",
    }


@app.get(f"{APP_PREFIX}/consumer/recommendations")
def consumer_recommendations(meterId: str = Query(...)):
    return {"recommendations": ["Shift EV charging to off-peak hours.", "Pre-cool during off-peak if hot weather is forecast."]}


@app.get(f"{APP_PREFIX}/consumer/insights/efficiency")
def consumer_insights_efficiency(meterId: str = Query(...)):
    # 12-month trend: values around 75-95 with a fixed benchmark.
    now = utcnow()
    efficiency: List[Dict[str, Any]] = []
    benchmark = 85.0
    for i in range(12):
        month_idx = (now.month - 1 - (11 - i)) % 12
        month_name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month_idx]
        val = benchmark - 10 + 20 * random.random()
        efficiency.append({"month": month_name, "efficiency": round(val, 1), "benchmark": benchmark})
    return {"efficiencyTrend": efficiency}


@app.get(f"{APP_PREFIX}/consumer/insights/appliances")
def consumer_insights_appliances(meterId: str = Query(...)):
    store.ensure_meter(meterId)
    now = utcnow()
    start = now - dt.timedelta(hours=24)
    rs = store.readings_between(meterId, start, now)
    avg_usage = sum(r["usage"] for r in rs) / max(1, len(rs))

    # Appliance shares (rough)
    shares = {
        "HVAC": 0.42,
        "Water Heater": 0.22,
        "Refrigerator": 0.10,
        "Washer/Dryer": 0.08,
        "Lighting": 0.06,
        "Other": 0.12,
    }

    appliance_list: List[Dict[str, Any]] = []
    for name, share in shares.items():
        usage_percent = round(100.0 * share * (1.0 + random.gauss(0, 0.03)), 1)
        efficiency = round(65 + 25 * random.random(), 0)
        # Cost and potential are just presentation-level estimates for now.
        cost = round(20.0 * share * (avg_usage / 2.0) + random.gauss(0, 1.5), 1)
        potential = round(max(0.5, 6 * (100 - efficiency) / 40 + random.random() * 3), 1)
        appliance_list.append(
            {
                "appliance": name,
                "usage": max(1, usage_percent),
                "efficiency": efficiency,
                "cost": max(0.1, cost),
                "potential": potential,
            }
        )

    # Ensure stability ordering.
    appliance_list.sort(key=lambda x: x["appliance"])
    return {"appliances": appliance_list}


@app.get(f"{APP_PREFIX}/consumer/insights/weather")
def consumer_insights_weather(meterId: str = Query(...)):
    store.ensure_meter(meterId)
    now = utcnow()
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    rs = store.readings_between(meterId, now - dt.timedelta(days=7), now)

    # Aggregate by weekday for last 7 days.
    tmp_by_day = defaultdict(list)
    usage_by_day = defaultdict(list)
    for r in rs:
        d = day_names[r["timestamp"].weekday()]
        tmp_by_day[d].append(float(r["temperatureOutside"]))
        usage_by_day[d].append(float(r["usage"]))

    out: List[Dict[str, Any]] = []
    for i, dname in enumerate(day_names):
        temps = tmp_by_day.get(dname, [])
        usages = usage_by_day.get(dname, [])
        avg_temp = sum(temps) / len(temps) if temps else 28 + random.random() * 2
        avg_usage = sum(usages) / len(usages) if usages else 40 + random.random() * 10
        out.append({"day": dname, "temp": round(avg_temp, 1), "usage": round(avg_usage, 1)})

    return {"weatherCorrelation": out}


@app.get(f"{APP_PREFIX}/consumer/devices")
def consumer_devices(meterId: str = Query(...)):
    # Frontend currently shows a fixed set of appliance cards.
    # Return a device list in a way the UI can map to those cards.
    devices = [
        {"id": "dev_hvac", "name": "Main HVAC", "room": "Living Room", "type": "hvac", "status": True, "currentUsageKw": 1.2, "controllable": True, "priority": "High"},
        {"id": "dev_wh", "name": "Water Heater", "room": "Utility Room", "type": "water_heater", "status": False, "currentUsageKw": 2.4, "controllable": True, "priority": "Medium"},
        {"id": "dev_ev", "name": "EV Charger", "room": "Garage", "type": "ev_charger", "status": True, "currentUsageKw": 3.6, "controllable": True, "priority": "Low"},
        {"id": "dev_dw", "name": "Dishwasher", "room": "Kitchen", "type": "washer", "status": False, "currentUsageKw": 0.8, "controllable": True, "priority": "Low"},
    ]
    # Add display-friendly load labels.
    for d in devices:
        d["load"] = f"{d['currentUsageKw']:.1f} kW"
    return {"devices": devices}


# ── Alert & Automation Engine ──────────────────────────────────────────────

import uuid

# ── Virtual Load definitions (represent physical bulbs/appliances for demo) ──
# Each load has a rated_kw (simulated wattage) and a controllable flag.
# For the hardware demo: load_id maps to a GPIO pin or relay channel.
VIRTUAL_LOADS: List[Dict[str, Any]] = [
    {
        "id": "load_geyser",
        "name": "Geyser",
        "type": "water_heater",
        "rated_kw": 2.0,
        "priority": "Medium",
        "gpio_pin": 17,          # placeholder – wire to relay when hardware is ready
        "status": True,
        "auto_controlled": False,
        "room": "Bathroom",
    },
    {
        "id": "load_ac",
        "name": "Air Conditioner",
        "type": "hvac",
        "rated_kw": 1.5,
        "priority": "High",
        "gpio_pin": 27,
        "status": True,
        "auto_controlled": False,
        "room": "Bedroom",
    },
    {
        "id": "load_fridge",
        "name": "Refrigerator",
        "type": "refrigerator",
        "rated_kw": 0.15,
        "priority": "High",
        "gpio_pin": 22,
        "status": True,
        "auto_controlled": False,
        "room": "Kitchen",
    },
    {
        "id": "load_bulb_demo",
        "name": "Demo Bulb",
        "type": "light",
        "rated_kw": 0.06,
        "priority": "Low",
        "gpio_pin": 23,
        "status": True,
        "auto_controlled": False,
        "room": "Demo",
    },
]

# In-memory mutable state for loads (status can be toggled)
_load_state: Dict[str, Dict[str, Any]] = {l["id"]: dict(l) for l in VIRTUAL_LOADS}

# ── Alert thresholds ──────────────────────────────────────────────────────
ALERT_THRESHOLDS = {
    "high_usage":       {"field": "usage",     "op": ">",  "value": 4.5,   "severity": "warning",  "message": "High power consumption detected ({val:.2f} kW). Consider shifting non-essential loads."},
    "critical_usage":   {"field": "usage",     "op": ">",  "value": 6.0,   "severity": "critical", "message": "Critical overload: {val:.2f} kW. Auto load-shedding triggered."},
    "low_voltage":      {"field": "voltage",   "op": "<",  "value": 210.0, "severity": "warning",  "message": "Low voltage detected: {val:.1f} V. Grid instability possible."},
    "high_voltage":     {"field": "voltage",   "op": ">",  "value": 250.0, "severity": "warning",  "message": "High voltage: {val:.1f} V. Risk of appliance damage."},
    "freq_low":         {"field": "frequency", "op": "<",  "value": 49.5,  "severity": "warning",  "message": "Grid frequency low: {val:.2f} Hz. Grid under stress."},
    "freq_high":        {"field": "frequency", "op": ">",  "value": 50.5,  "severity": "warning",  "message": "Grid frequency high: {val:.2f} Hz."},
    "peak_pricing":     {"field": "_tariff",   "op": "==", "value": 0.25,  "severity": "info",     "message": "Peak pricing active (₹0.25/kWh). Shift deferrable loads to off-peak."},
    "off_peak_window":  {"field": "_tariff",   "op": "==", "value": 0.12,  "severity": "info",     "message": "Off-peak window active (₹0.12/kWh). Good time to run heavy loads."},
}

# ── Alert store ───────────────────────────────────────────────────────────
class AlertStore:
    def __init__(self) -> None:
        self._alerts: Dict[str, Dict[str, Any]] = {}          # id -> alert
        self._active_keys: Dict[str, str] = {}                # threshold_key -> alert_id (dedup)
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)  # meterId -> ws set

    def _make_alert(self, meter_id: str, key: str, severity: str, message: str) -> Dict[str, Any]:
        alert_id = str(uuid.uuid4())
        alert = {
            "id": alert_id,
            "meterId": meter_id,
            "key": key,
            "severity": severity,
            "message": message,
            "timestamp": utcnow().astimezone(IST).isoformat(),
            "dismissed": False,
            "acknowledged": False,
        }
        self._alerts[alert_id] = alert
        self._active_keys[f"{meter_id}:{key}"] = alert_id
        return alert

    def evaluate(self, meter_id: str, reading: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check reading against thresholds; return list of new alerts fired."""
        new_alerts: List[Dict[str, Any]] = []
        rate = tariff_rate(reading["timestamp"])

        for key, cfg in ALERT_THRESHOLDS.items():
            field = cfg["field"]
            op = cfg["op"]
            threshold = cfg["value"]

            if field == "_tariff":
                val = rate
            else:
                val = reading.get(field)
                if val is None:
                    continue

            triggered = False
            if op == ">" and val > threshold:
                triggered = True
            elif op == "<" and val < threshold:
                triggered = True
            elif op == "==" and abs(val - threshold) < 1e-9:
                triggered = True

            dedup_key = f"{meter_id}:{key}"
            if triggered:
                # Only fire a new alert if there isn't already an active (non-dismissed) one for this key
                existing_id = self._active_keys.get(dedup_key)
                if existing_id and not self._alerts.get(existing_id, {}).get("dismissed", True):
                    continue  # already active
                msg = cfg["message"].format(val=val)
                alert = self._make_alert(meter_id, key, cfg["severity"], msg)
                new_alerts.append(alert)
            else:
                # Condition cleared — auto-dismiss the active alert for this key
                existing_id = self._active_keys.get(dedup_key)
                if existing_id and existing_id in self._alerts:
                    self._alerts[existing_id]["dismissed"] = True
                    self._active_keys.pop(dedup_key, None)

        return new_alerts

    def get_alerts(self, meter_id: str, include_dismissed: bool = False) -> List[Dict[str, Any]]:
        out = [a for a in self._alerts.values() if a["meterId"] == meter_id]
        if not include_dismissed:
            out = [a for a in out if not a["dismissed"]]
        return sorted(out, key=lambda x: x["timestamp"], reverse=True)

    def dismiss(self, alert_id: str) -> bool:
        if alert_id in self._alerts:
            self._alerts[alert_id]["dismissed"] = True
            # Remove from active keys
            a = self._alerts[alert_id]
            self._active_keys.pop(f"{a['meterId']}:{a['key']}", None)
            return True
        return False

    def acknowledge(self, alert_id: str) -> bool:
        if alert_id in self._alerts:
            self._alerts[alert_id]["acknowledged"] = True
            return True
        return False


alert_store = AlertStore()

# ── Automation Rules store ────────────────────────────────────────────────
# Rules: if alert_key matches, perform action on load(s)
DEFAULT_RULES: List[Dict[str, Any]] = [
    {
        "id": "rule_peak_shed",
        "name": "Peak Load Shedding",
        "description": "Turn off Low-priority loads when usage exceeds 4.5 kW or peak pricing is active.",
        "enabled": True,
        "trigger_keys": ["high_usage", "critical_usage", "peak_pricing"],
        "action": "turn_off",
        "target_priorities": ["Low"],
        "target_load_ids": [],   # empty = use priority filter
        "created_at": utcnow().astimezone(IST).isoformat(),
    },
    {
        "id": "rule_critical_shed",
        "name": "Emergency Load Shedding",
        "description": "Turn off Medium and Low priority loads on critical overload.",
        "enabled": True,
        "trigger_keys": ["critical_usage"],
        "action": "turn_off",
        "target_priorities": ["Low", "Medium"],
        "target_load_ids": [],
        "created_at": utcnow().astimezone(IST).isoformat(),
    },
    {
        "id": "rule_offpeak_restore",
        "name": "Off-Peak Load Restore",
        "description": "Restore deferred loads during off-peak window.",
        "enabled": True,
        "trigger_keys": ["off_peak_window"],
        "action": "turn_on",
        "target_priorities": ["Low", "Medium"],
        "target_load_ids": [],
        "created_at": utcnow().astimezone(IST).isoformat(),
    },
]

_rules_store: Dict[str, Dict[str, Any]] = {r["id"]: dict(r) for r in DEFAULT_RULES}

# Track which loads were auto-shed so we can restore them
_auto_shed_loads: Set[str] = set()


def _apply_automation_rules(meter_id: str, new_alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Evaluate active rules against new alerts; return list of actions taken."""
    actions_taken: List[Dict[str, Any]] = []
    fired_keys = {a["key"] for a in new_alerts}

    for rule in _rules_store.values():
        if not rule["enabled"]:
            continue
        if not any(k in fired_keys for k in rule["trigger_keys"]):
            continue

        action = rule["action"]
        target_ids = rule.get("target_load_ids") or []
        target_priorities = rule.get("target_priorities") or []

        # Determine which loads to act on
        loads_to_act = []
        for load_id, load in _load_state.items():
            if target_ids and load_id not in target_ids:
                continue
            if target_priorities and load["priority"] not in target_priorities:
                continue
            loads_to_act.append(load_id)

        for load_id in loads_to_act:
            load = _load_state[load_id]
            if action == "turn_off" and load["status"]:
                load["status"] = False
                load["auto_controlled"] = True
                _auto_shed_loads.add(load_id)
                actions_taken.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "load_id": load_id,
                    "load_name": load["name"],
                    "action": "turned_off",
                    "reason": rule["description"],
                    "timestamp": utcnow().astimezone(IST).isoformat(),
                })
            elif action == "turn_on" and not load["status"] and load_id in _auto_shed_loads:
                load["status"] = True
                load["auto_controlled"] = False
                _auto_shed_loads.discard(load_id)
                actions_taken.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "load_id": load_id,
                    "load_name": load["name"],
                    "action": "turned_on",
                    "reason": rule["description"],
                    "timestamp": utcnow().astimezone(IST).isoformat(),
                })

    return actions_taken


# ── Alert WebSocket connections ───────────────────────────────────────────
_alert_connections: Dict[str, Set[WebSocket]] = defaultdict(set)


@app.websocket(f"{WS_PREFIX}/consumer/alerts/{{meter_id}}")
async def alerts_ws(ws: WebSocket, meter_id: str, token: Optional[str] = Query(default=None)):
    if AUTH_REQUIRED:
        if not token or not decode_token(token):
            await ws.close(code=1008)
            return
    await ws.accept()
    _alert_connections[meter_id].add(ws)
    # Send current active alerts on connect
    try:
        await ws.send_json({
            "type": "snapshot",
            "alerts": alert_store.get_alerts(meter_id),
            "loads": [dict(l) for l in _load_state.values()],
        })
        while True:
            _ = await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _alert_connections[meter_id].discard(ws)


async def _broadcast_alerts(meter_id: str, new_alerts: List[Dict[str, Any]], actions: List[Dict[str, Any]]) -> None:
    conns = list(_alert_connections.get(meter_id, set()))
    if not conns:
        return
    msg = {
        "type": "update",
        "new_alerts": new_alerts,
        "actions": actions,
        "loads": [dict(l) for l in _load_state.values()],
        "active_alerts": alert_store.get_alerts(meter_id),
    }
    tasks = []
    for ws in conns:
        try:
            tasks.append(ws.send_json(msg))
        except Exception:
            pass
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


# ── Patch simulator_ingest to also evaluate alerts ────────────────────────
# We override the existing endpoint by re-registering it after the original.
# FastAPI uses the last registered route for a given path+method.

@app.post("/simulator/ingest/v2")
async def simulator_ingest_v2(body: IngestReadingRequest):
    """Extended ingest that also evaluates alerts and automation rules."""
    ts = body.timestamp or utcnow()
    store.ensure_meter(body.meterId)

    rate = tariff_rate(ts)
    interval_hours = METER_STEP_MINUTES / 60.0
    energy_kwh = body.usage * interval_hours
    cost = body.cost if body.cost is not None else energy_kwh * rate
    voltage = body.voltage
    current_a = body.current if body.current is not None else (body.usage * 1000.0) / max(1.0, voltage)

    reading = {
        "timestamp": ts,
        "usage": float(body.usage),
        "voltage": float(voltage),
        "current": float(current_a),
        "frequency": float(body.frequency),
        "temperatureOutside": float(body.temperatureOutside if body.temperatureOutside is not None else temp_outside_c(ts)),
        "renewable": float(solar_kw(ts.hour + ts.minute / 60.0)),
        "cost": float(cost),
    }

    store.add_reading(body.meterId, reading)

    # Persist to Google Sheets (non-blocking)
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_sheets_executor, _append_to_sheet, reading, body.meterId)

    # Evaluate alert thresholds
    new_alerts = alert_store.evaluate(body.meterId, reading)

    # Run automation rules
    actions = _apply_automation_rules(body.meterId, new_alerts) if new_alerts else []

    # Broadcast live reading to energy WS subscribers
    conns = list(store._connections.get(body.meterId, set()))
    if conns:
        msg = {
            "meterId": body.meterId,
            "timestamp": ts.astimezone(IST).strftime("%H:%M:%S"),
            "usage": reading["usage"],
            "voltage": reading["voltage"],
            "current": reading["current"],
            "frequency": reading["frequency"],
            "cost": reading["cost"],
        }
        send_tasks = [ws.send_json(msg) for ws in conns]
        await asyncio.gather(*send_tasks, return_exceptions=True)

    # Broadcast alerts + actions to alert WS subscribers
    if new_alerts or actions:
        await _broadcast_alerts(body.meterId, new_alerts, actions)

    return {"ok": True, "stored": 1, "alerts_fired": len(new_alerts), "actions_taken": len(actions)}


# ── REST endpoints for alerts & loads ────────────────────────────────────

@app.get(f"{APP_PREFIX}/consumer/alerts")
def get_alerts(meterId: str = Query(...), include_dismissed: bool = Query(default=False)):
    return {"alerts": alert_store.get_alerts(meterId, include_dismissed)}


@app.post(f"{APP_PREFIX}/consumer/alerts/{{alert_id}}/dismiss")
def dismiss_alert(alert_id: str):
    ok = alert_store.dismiss(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


@app.post(f"{APP_PREFIX}/consumer/alerts/{{alert_id}}/acknowledge")
def acknowledge_alert(alert_id: str):
    ok = alert_store.acknowledge(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


@app.get(f"{APP_PREFIX}/consumer/loads")
def get_loads(meterId: str = Query(...)):
    loads = [dict(l) for l in _load_state.values()]
    # Compute active power (only ON loads contribute)
    total_kw = sum(l["rated_kw"] for l in loads if l["status"])
    return {"loads": loads, "total_active_kw": round(total_kw, 3)}


class LoadControlRequest(BaseModel):
    status: bool
    manual: bool = True  # True = manual override, False = auto


@app.post(f"{APP_PREFIX}/consumer/loads/{{load_id}}/control")
async def control_load(load_id: str, body: LoadControlRequest, meterId: str = Query(...)):
    if load_id not in _load_state:
        raise HTTPException(status_code=404, detail="Load not found")
    _load_state[load_id]["status"] = body.status
    if body.manual:
        _load_state[load_id]["auto_controlled"] = False
        _auto_shed_loads.discard(load_id)
    # Broadcast updated load state
    await _broadcast_alerts(meterId, [], [])
    return {"ok": True, "load": _load_state[load_id]}


# ── Automation Rules REST ─────────────────────────────────────────────────

class AutomationRuleRequest(BaseModel):
    name: str
    description: str = ""
    enabled: bool = True
    trigger_keys: List[str]
    action: str  # "turn_off" | "turn_on"
    target_priorities: List[str] = []
    target_load_ids: List[str] = []


@app.get(f"{APP_PREFIX}/consumer/automation/rules")
def get_automation_rules(meterId: str = Query(...)):
    return {"rules": list(_rules_store.values())}


@app.post(f"{APP_PREFIX}/consumer/automation/rules")
def create_automation_rule(body: AutomationRuleRequest, meterId: str = Query(...)):
    rule_id = f"rule_{uuid.uuid4().hex[:8]}"
    rule = {
        "id": rule_id,
        "name": body.name,
        "description": body.description,
        "enabled": body.enabled,
        "trigger_keys": body.trigger_keys,
        "action": body.action,
        "target_priorities": body.target_priorities,
        "target_load_ids": body.target_load_ids,
        "created_at": utcnow().astimezone(IST).isoformat(),
    }
    _rules_store[rule_id] = rule
    return {"ok": True, "rule": rule}


@app.patch(f"{APP_PREFIX}/consumer/automation/rules/{{rule_id}}")
def update_automation_rule(rule_id: str, body: dict, meterId: str = Query(...)):
    if rule_id not in _rules_store:
        raise HTTPException(status_code=404, detail="Rule not found")
    _rules_store[rule_id].update(body)
    return {"ok": True, "rule": _rules_store[rule_id]}


@app.delete(f"{APP_PREFIX}/consumer/automation/rules/{{rule_id}}")
def delete_automation_rule(rule_id: str, meterId: str = Query(...)):
    if rule_id not in _rules_store:
        raise HTTPException(status_code=404, detail="Rule not found")
    del _rules_store[rule_id]
    return {"ok": True}


# ── Periodic alert injection for demo (simulates threshold crossings) ─────
# The simulator_run.py posts to /simulator/ingest (original).
# We also add a background task that periodically injects a spike reading
# to demonstrate alert triggering without needing real hardware.

_demo_spike_counter = 0

@app.on_event("startup")
async def start_demo_alert_loop():
    asyncio.create_task(_demo_alert_loop())


async def _demo_alert_loop():
    """Every 30s inject a synthetic spike reading to trigger alerts for demo."""
    global _demo_spike_counter
    await asyncio.sleep(15)  # initial delay
    while True:
        await asyncio.sleep(30)
        _demo_spike_counter += 1
        # Cycle through different alert scenarios
        scenario = _demo_spike_counter % 6
        for meter_id in list(store._data.keys()):
            latest = store.latest(meter_id)
            if not latest:
                continue
            if scenario == 0:
                # High usage spike
                spike = dict(latest)
                spike["usage"] = 5.2
                spike["timestamp"] = utcnow()
                new_alerts = alert_store.evaluate(meter_id, spike)
                actions = _apply_automation_rules(meter_id, new_alerts)
                if new_alerts or actions:
                    await _broadcast_alerts(meter_id, new_alerts, actions)
            elif scenario == 1:
                # Critical overload
                spike = dict(latest)
                spike["usage"] = 6.5
                spike["timestamp"] = utcnow()
                new_alerts = alert_store.evaluate(meter_id, spike)
                actions = _apply_automation_rules(meter_id, new_alerts)
                if new_alerts or actions:
                    await _broadcast_alerts(meter_id, new_alerts, actions)
            elif scenario == 2:
                # Low voltage
                spike = dict(latest)
                spike["voltage"] = 205.0
                spike["timestamp"] = utcnow()
                new_alerts = alert_store.evaluate(meter_id, spike)
                actions = _apply_automation_rules(meter_id, new_alerts)
                if new_alerts or actions:
                    await _broadcast_alerts(meter_id, new_alerts, actions)
            elif scenario == 3:
                # Frequency anomaly
                spike = dict(latest)
                spike["frequency"] = 49.3
                spike["timestamp"] = utcnow()
                new_alerts = alert_store.evaluate(meter_id, spike)
                actions = _apply_automation_rules(meter_id, new_alerts)
                if new_alerts or actions:
                    await _broadcast_alerts(meter_id, new_alerts, actions)
            elif scenario == 4:
                # Back to normal — clears alerts
                spike = dict(latest)
                spike["usage"] = 2.0
                spike["voltage"] = 230.0
                spike["frequency"] = 50.0
                spike["timestamp"] = utcnow()
                new_alerts = alert_store.evaluate(meter_id, spike)
                actions = _apply_automation_rules(meter_id, new_alerts)
                await _broadcast_alerts(meter_id, new_alerts, actions)
            # scenario 5 = off-peak pricing check (uses real time, no spike needed)
