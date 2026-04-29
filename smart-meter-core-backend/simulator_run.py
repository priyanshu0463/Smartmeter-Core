import argparse
import json
import math
import random
import time
import datetime as dt
import urllib.request


def utcnow_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def tariff_rate(hour: int) -> float:
    # Must match backend's rough tariff.
    if 17 <= hour < 21:
        return 0.25
    if 7 <= hour < 17 or 21 <= hour < 23:
        return 0.18
    return 0.12


def solar_kw(hour: float) -> float:
    if hour < 6 or hour > 18:
        return 0.0
    x = (hour - 6) / 12.0
    return max(0.0, 3.5 * math.sin(math.pi * x))


def make_usage_kw(ts: dt.datetime) -> float:
    hour = ts.hour + ts.minute / 60.0
    dow = ts.weekday()
    weekend = 0.85 if dow >= 5 else 1.0

    morning = 1.1 * math.exp(-0.5 * ((hour - 7.5) / 2.2) ** 2)
    evening = 1.6 * math.exp(-0.5 * ((hour - 19.0) / 2.8) ** 2)
    base = 1.6
    season_factor = 1.0 + 0.12 * math.sin((ts.month - 1) / 12.0 * 2 * math.pi)
    noise = random.gauss(0, 0.12)

    return max(0.1, (base + morning + evening) * weekend * season_factor + noise)


def post_json(url: str, payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        _ = resp.read()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend-url", default="http://localhost:8000", help="FastAPI backend base URL")
    parser.add_argument("--meter-id", default="MTR-8829-X1")
    parser.add_argument("--interval-seconds", type=float, default=3.0)
    args = parser.parse_args()

    ingest_url = f"{args.backend_url}/simulator/ingest/v2"
    print(f"[simulator] Posting to: {ingest_url}")
    print(f"[simulator] meterId={args.meter_id}")

    while True:
        ts = dt.datetime.now(dt.timezone.utc)
        hour = ts.hour + ts.minute / 60.0

        usage_kw = make_usage_kw(ts)
        voltage = 230.0 + random.gauss(0, 1.2)
        current_a = (usage_kw * 1000.0) / max(1.0, voltage)
        frequency = 50.0 + random.gauss(0, 0.04)
        temperature = 20.0 + 6.0 * math.sin((ts.timetuple().tm_yday / 365.0) * 2 * math.pi - 1.2) + random.gauss(0, 0.6)

        # cost in MVP is computed from usage * intervalHours; backend uses its own default interval.
        # We still send cost=None to let backend compute consistently.
        payload = {
            "meterId": args.meter_id,
            "timestamp": ts.isoformat(),
            "usage": round(usage_kw, 3),
            "voltage": round(voltage, 2),
            "current": round(current_a, 3),
            "frequency": round(frequency, 3),
            "temperatureOutside": round(temperature, 2),
            "cost": None,
        }

        try:
            post_json(ingest_url, payload)
        except Exception as e:
            print(f"[simulator] ingest error: {e}")

        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    main()

