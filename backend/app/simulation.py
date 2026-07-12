"""
Simulation engine.

This is a direct Python port of the movement / geofence / suspicion /
ecosystem / alert logic that used to live only in the browser
(`stepShip`, `createShip`, `primeFleet`, `runRealBenchmark`, ... in
src/SeaPulse.jsx). Keeping the exact same constants and formulas means the
backend simulation behaves identically to the original client-only demo,
just now as a real, shared, server-side pipeline that many clients can
subscribe to at once.
"""
import math
import random
import time
from itertools import count
from typing import Dict, List, Tuple

W, H = 1000, 600


def clamp(v: float, mn: float, mx: float) -> float:
    return min(mx, max(mn, v))


def rand(a: float, b: float) -> float:
    return random.random() * (b - a) + a


ZONE_TYPES = {
    "mpa": {"label": "Marine Protected Area", "color": "#2fd9c4"},
    "reef": {"label": "Coral Reef Zone", "color": "#3c8f6e"},
    "nofish": {"label": "No-Fishing Zone", "color": "#ff6a5f"},
    "port": {"label": "Port Authority", "color": "#e6d3a3"},
    "military": {"label": "Military Exclusion", "color": "#d4af37"},
}

INITIAL_ZONES = [
    {"id": "z1", "type": "reef", "name": "Coral Cay Sanctuary",
     "points": [[80, 80], [220, 60], [260, 160], [150, 200], [70, 160]]},
    {"id": "z2", "type": "mpa", "name": "North Marine Reserve",
     "points": [[350, 60], [520, 50], [540, 170], [400, 190], [340, 140]]},
    {"id": "z3", "type": "nofish", "name": "Eastern No-Fishing Zone",
     "points": [[700, 220], [880, 210], [900, 340], [740, 360], [680, 300]]},
    {"id": "z4", "type": "port", "name": "Harbor Point Authority",
     "points": [[860, 430], [960, 420], [970, 500], [880, 510]]},
    {"id": "z5", "type": "military", "name": "Southern Exclusion Zone",
     "points": [[150, 420], [320, 410], [340, 540], [170, 550]]},
    {"id": "z6", "type": "reef", "name": "Turtle Bay Reef",
     "points": [[500, 380], [600, 370], [620, 460], [520, 470]]},
]


def point_in_polygon(pt: Tuple[float, float], poly: List[List[float]]) -> bool:
    x, y = pt
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


def centroid(poly: List[List[float]]) -> Dict[str, float]:
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return {"x": cx, "y": cy}


SHIP_PREFIXES = ["MV", "SS", "FV", "MT", "SV"]
SHIP_NAMES = [
    "Horizon", "Meridian", "Kraken", "Osprey", "Aurora", "Voyager", "Pelican",
    "Neptune", "Corsair", "Drift", "Tern", "Nomad", "Solace", "Mariner",
    "Halcyon", "Leviathan", "Tempest", "Compass Rose", "Windward",
    "Southern Cross", "Albatross", "Poseidon", "Sirena", "Tradewind", "Wanderer",
]


def make_ship_name(id_: int) -> str:
    prefix = SHIP_PREFIXES[id_ % len(SHIP_PREFIXES)]
    name = SHIP_NAMES[int(rand(0, len(SHIP_NAMES)))]
    return f"{prefix} {name} {100 + (id_ % 900)}"


def pick_type() -> str:
    r = random.random()
    if r < 0.28:
        return "Fishing"
    if r < 0.50:
        return "Cargo"
    if r < 0.68:
        return "Tanker"
    if r < 0.85:
        return "Container"
    return "Unknown"


def create_ship(id_: int) -> dict:
    type_ = pick_type()
    return {
        "id": f"SP-{id_}",
        "name": make_ship_name(id_),
        "type": type_,
        "x": rand(30, 970),
        "y": rand(30, 570),
        "heading": rand(0, 360),
        "speed": rand(1, 4) if type_ == "Fishing" else rand(5, 12),
        "minSpeed": 0.2 if type_ == "Fishing" else 2,
        "maxSpeed": 5 if type_ == "Fishing" else 16,
        "history": [],
        "suspicion": round(rand(2, 18)),
        "ecosystem": 0,
        "loiterTicks": 0,
        "zoneIds": [],
        "band": "Safe",
        "silentUntilTick": 0,
        "forcedLoiterTicks": 0,
        "prevHeading": None,
        "silent": False,
    }


def adjust_ship_count(ships: List[dict], target: int, id_counter: Dict[str, int]) -> List[dict]:
    if len(ships) < target:
        extra = []
        for _ in range(target - len(ships)):
            extra.append(create_ship(id_counter["value"]))
            id_counter["value"] += 1
        return ships + extra
    if len(ships) > target:
        return ships[:target]
    return ships


def suspicion_band(v: float) -> str:
    if v >= 85:
        return "Critical"
    if v >= 70:
        return "High"
    if v >= 40:
        return "Medium"
    if v >= 15:
        return "Low"
    return "Safe"


_alert_seq = count()


def make_alert(ship: dict, type_: str, emoji: str, severity: str, explanation: str) -> dict:
    return {
        "id": f"{int(time.time() * 1000)}_{next(_alert_seq)}_{random.randint(1000, 9999)}",
        "shipId": ship["id"],
        "shipName": ship["name"],
        "shipType": ship["type"],
        "type": type_,
        "emoji": emoji,
        "severity": severity,
        "explanation": explanation,
        "suspicion": ship["suspicion"],
        "ecosystem": ship["ecosystem"],
        "position": {"x": round(ship["x"]), "y": round(ship["y"])},
        "time": time.strftime("%H:%M:%S"),
    }


def step_ship(ship: dict, zones: List[dict], current_tick: int, alerts_out: List[dict]) -> dict:
    s = dict(ship)

    if s.get("silentUntilTick") and current_tick < s["silentUntilTick"]:
        s["silent"] = True
        return s
    s["silent"] = False

    if s.get("forcedLoiterTicks", 0) > 0:
        s["speed"] = max(0.2, s["speed"] * 0.25)
        s["forcedLoiterTicks"] -= 1
    else:
        s["speed"] = clamp(s["speed"] + rand(-0.3, 0.3), s["minSpeed"], s["maxSpeed"])

    prev_heading = s["heading"]
    s["heading"] = (s["heading"] + rand(-9, 9) + 360) % 360
    rad = math.radians(s["heading"])
    nx = s["x"] + math.sin(rad) * s["speed"] * 0.6
    ny = s["y"] - math.cos(rad) * s["speed"] * 0.6
    if nx < 12 or nx > 988:
        s["heading"] = (180 - s["heading"] + 360) % 360
        nx = clamp(nx, 12, 988)
    if ny < 12 or ny > 588:
        s["heading"] = (360 - s["heading"]) % 360
        ny = clamp(ny, 12, 588)
    s["x"], s["y"] = nx, ny

    hist = list(s.get("history", []))[-13:]
    hist.append({"x": nx, "y": ny})
    s["history"] = hist

    containing = [z for z in zones if point_in_polygon((nx, ny), z["points"])]
    if s["speed"] < 1.2 and containing:
        s["loiterTicks"] = s.get("loiterTicks", 0) + 1
    else:
        s["loiterTicks"] = max(0, s.get("loiterTicks", 0) - 1)

    target = 5
    rule_floor = 0
    types_here = {z["type"] for z in containing}
    if "nofish" in types_here and s["type"] == "Fishing":
        target += 60
        rule_floor = max(rule_floor, 88)
    if "military" in types_here:
        target += 70
        rule_floor = max(rule_floor, 92)
    if "mpa" in types_here:
        target += 35
        rule_floor = max(rule_floor, 72)
    if s["loiterTicks"] > 6:
        target += min(30, s["loiterTicks"] * 2)
    if abs(s["heading"] - prev_heading) > 45:
        target += 10
    s["suspicion"] = clamp(round(s["suspicion"] * 0.8 + target * 0.2 + rand(-2, 2)), 0, 100)
    if rule_floor:
        s["suspicion"] = max(s["suspicion"], rule_floor)

    eco = 0
    for z in containing:
        if z["type"] == "mpa":
            eco += 30
        if z["type"] == "reef":
            eco += 55 if s["loiterTicks"] > 4 else 25
        if z["type"] == "nofish" and s["type"] == "Fishing":
            eco += 45
    s["ecosystem"] = clamp(round(s["ecosystem"] * 0.85 + eco * 0.15), 0, 100)

    prev_ids = s.get("zoneIds", [])
    for z in containing:
        if z["id"] not in prev_ids:
            if z["type"] == "mpa":
                alerts_out.append(make_alert(s, "geofence", "🚨", "high",
                                              f"Entered {z['name']} (Marine Protected Area)"))
            if z["type"] == "military":
                alerts_out.append(make_alert(s, "geofence", "🚨", "critical",
                                              f"Unauthorized entry into {z['name']}"))
            if z["type"] == "nofish" and s["type"] == "Fishing":
                alerts_out.append(make_alert(s, "fishing", "🎣", "critical",
                                              f"Possible illegal fishing detected in {z['name']}"))
            if z["type"] == "reef":
                alerts_out.append(make_alert(s, "ecosystem", "🌿", "medium",
                                              f"Vessel entered {z['name']} — ecosystem risk elevated"))
    s["zoneIds"] = [z["id"] for z in containing]

    band = suspicion_band(s["suspicion"])
    if band != s.get("band") and band in ("High", "Critical"):
        alerts_out.append(make_alert(
            s, "behaviour", "⚠", "critical" if band == "Critical" else "high",
            f"Suspicion escalated to {band} ({s['suspicion']})",
        ))
    s["band"] = band
    return s


def prime_fleet(count_: int, zones: List[dict]) -> Tuple[List[dict], List[dict]]:
    """Create a fresh fleet AND immediately run one real detection pass
    against the current geofences, so any ship that spawns inside a
    protected zone fires its alert right away."""
    raw_ships = [create_ship(i) for i in range(count_)]
    alerts_out: List[dict] = []
    ships = [step_ship(s, zones, 0, alerts_out) for s in raw_ships]
    return ships, alerts_out


def run_real_benchmark(zones: List[dict], num_messages: int = 300000, pool_size: int = 2000) -> dict:
    """REAL, measured throughput test. Runs `num_messages` through the actual
    detection pipeline (movement + point-in-polygon geofence check +
    suspicion scoring - exactly what every ship goes through on every tick)
    in a single tight loop, then times it with a high resolution clock."""
    pool = [create_ship(i) for i in range(pool_size)]
    alerts_out: List[dict] = []
    t0 = time.perf_counter()
    for i in range(num_messages):
        idx = i % pool_size
        pool[idx] = step_ship(pool[idx], zones, i, alerts_out)
    elapsed = time.perf_counter() - t0
    return {
        "messages": num_messages,
        "elapsedSec": round(elapsed, 3),
        "messagesPerSec": round(num_messages / elapsed) if elapsed > 0 else num_messages,
        "alertsGenerated": len(alerts_out),
    }
