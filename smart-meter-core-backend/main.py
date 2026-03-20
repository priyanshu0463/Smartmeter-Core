import asyncio
import math
import os
import random
import datetime as dt
from collections import defaultdict, deque
from typing import Any, Deque, Dict, List, Optional, Set

import jwt
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

        now = utcnow()
        start = now - dt.timedelta(days=METER_RETENTION_DAYS)
        step = dt.timedelta(minutes=METER_STEP_MINUTES)
        points = int((now - start) / step)

        dq: Deque[Dict[str, Any]] = deque(maxlen=MAX_POINTS_PER_METER)
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
            # Approximate kWh over this interval.
            interval_hours = METER_STEP_MINUTES / 60.0
            energy_kwh = usage_kw * interval_hours
            cost = energy_kwh * rate

            dq.append(
                {
                    "timestamp": ts,
                    "usage": float(usage_kw),
                    "voltage": float(voltage),
                    "current": float(current_a),
                    "frequency": float(frequency),
                    "temperatureOutside": float(temp_c),
                    "renewable": float(solar),
                    "cost": float(cost),
                }
            )

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

    # Broadcast to websocket subscribers.
    conns = list(store._connections.get(body.meterId, set()))
    if conns:
        msg = {
            "meterId": body.meterId,
            "timestamp": ts.isoformat(),
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
        "timestamp": latest["timestamp"].isoformat(),
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
    # Timeline: hourly buckets over last 24h (avg kW).
    timeline: List[Dict[str, Any]] = []
    for i in range(24):
        b_start = now - dt.timedelta(hours=(23 - i))
        b_end = b_start + dt.timedelta(hours=1)
        bucket = [r for r in store.readings_between(meterId, b_start, b_end)]
        if not bucket:
            continue
        avg_kw = sum(r["usage"] for r in bucket) / len(bucket)
        timeline.append({"time": b_start.strftime("%H:%M"), "usage": round(avg_kw, 3)})

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
    now = utcnow()

    if history_range == "day":
        count = 24
        start = now - dt.timedelta(hours=24)
        bucket_span = dt.timedelta(hours=1)
    elif history_range == "week":
        count = 7
        start = now - dt.timedelta(days=7)
        bucket_span = dt.timedelta(days=1)
    elif history_range == "month":
        count = 30
        start = now - dt.timedelta(days=30)
        bucket_span = dt.timedelta(days=1)
    else:
        count = 12
        start = now - dt.timedelta(days=365)
        bucket_span = dt.timedelta(days=365 / 12)

    data: List[Dict[str, Any]] = []
    for idx in range(count):
        b_start = start + idx * bucket_span
        b_end = b_start + bucket_span
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
                "label": bucket_label(history_range, idx),
                "usage": round(usage_kwh, 3),
                "cost": round(cost, 3),
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

