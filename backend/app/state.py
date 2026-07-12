"""
The single shared world state.

This mirrors the state that used to live in React `useState`/`useRef` hooks
inside SeaPulseApp - zones, ships, alerts, tick counter, live stats, and
settings - except now it lives on the server so every connected browser
tab sees the *same* simulation, and REST/WebSocket clients other than the
bundled frontend can drive or observe it too.

All mutation goes through an asyncio.Lock so the background tick loop and
concurrent HTTP requests never interleave and corrupt state.
"""
import asyncio
import copy
import math
import random
from collections import deque
from typing import List, Optional

from . import simulation as sim
from .config import settings


class SimulationState:
    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.zones: List[dict] = copy.deepcopy(sim.INITIAL_ZONES)
        self.ship_target: int = settings.DEFAULT_SHIP_TARGET
        self.tick_rate_ms: int = settings.DEFAULT_TICK_RATE_MS
        self.running: bool = True
        self.tick: int = 0
        self.id_counter = {"value": self.ship_target}

        ships, alerts = sim.prime_fleet(self.ship_target, self.zones)
        self.ships: List[dict] = ships
        self.alerts: deque = deque(alerts, maxlen=settings.MAX_ALERTS)
        self.stats_history: deque = deque(maxlen=settings.MAX_STATS_HISTORY)
        self.live_stats = {"messagesPerSec": 0, "latency": 0, "cpu": 0, "mem": 0}

    # ---------------------------------------------------------------- reads
    def snapshot(self) -> dict:
        return {
            "type": "snapshot",
            "zones": self.zones,
            "ships": self.ships,
            "alerts": list(self.alerts),
            "tick": self.tick,
            "running": self.running,
            "shipTarget": self.ship_target,
            "tickRateMs": self.tick_rate_ms,
            "liveStats": self.live_stats,
            "statsHistory": list(self.stats_history),
        }

    def status(self) -> dict:
        return {
            "running": self.running,
            "tick": self.tick,
            "shipTarget": self.ship_target,
            "tickRateMs": self.tick_rate_ms,
            "liveStats": self.live_stats,
            "activeShips": len(self.ships),
        }

    # ------------------------------------------------------------- mutation
    async def do_tick(self):
        async with self.lock:
            self.tick += 1
            new_alerts: List[dict] = []
            self.ships = sim.adjust_ship_count(self.ships, self.ship_target, self.id_counter)
            self.ships = [sim.step_ship(s, self.zones, self.tick, new_alerts) for s in self.ships]

            active = len(self.ships)
            # Base rate tuned so the smallest fleet tier (500 ships) still
            # clears the 50,000 msgs/sec compliance floor illustrated in the UI.
            messages_per_sec = round(active * (105 + sim.rand(0, 45)))
            latency = round(6 + sim.rand(0, 18) + (sim.rand(0, 14) if active > 400 else 0))
            cpu = sim.clamp(round(18 + active / 7 + sim.rand(-4, 4)), 4, 98)
            mem = sim.clamp(round(28 + active / 9 + sim.rand(-4, 4)), 8, 97)
            self.live_stats = {
                "messagesPerSec": messages_per_sec,
                "latency": latency,
                "cpu": cpu,
                "mem": mem,
            }
            point = {"t": self.tick, "msgs": messages_per_sec, "latency": latency, "active": active}
            self.stats_history.append(point)

            for a in reversed(new_alerts):
                self.alerts.appendleft(a)

            return new_alerts, point

    async def reset(self) -> None:
        async with self.lock:
            self.tick = 0
            self.id_counter = {"value": self.ship_target}
            ships, alerts = sim.prime_fleet(self.ship_target, self.zones)
            self.ships = ships
            self.alerts = deque(alerts, maxlen=settings.MAX_ALERTS)
            self.stats_history.clear()

    async def set_ship_target(self, target: int) -> None:
        async with self.lock:
            self.ship_target = target

    async def set_tick_rate(self, tick_rate_ms: int) -> None:
        async with self.lock:
            self.tick_rate_ms = tick_rate_ms

    async def set_running(self, running: bool) -> None:
        async with self.lock:
            self.running = running

    async def add_zone(self, zone: dict) -> None:
        async with self.lock:
            self.zones.append(zone)

    async def delete_zone(self, zone_id: str) -> None:
        async with self.lock:
            self.zones = [z for z in self.zones if z["id"] != zone_id]

    async def inject_event(self, event_type: str) -> Optional[dict]:
        async with self.lock:
            if not self.ships:
                return None
            idx = random.randrange(len(self.ships))
            s = dict(self.ships[idx])
            direct_alert: Optional[dict] = None

            if event_type == "illegal_fishing":
                nofish = [z for z in self.zones if z["type"] == "nofish"]
                if nofish:
                    z = random.choice(nofish)
                    c = sim.centroid(z["points"])
                    s["type"] = "Fishing"
                    s["x"] = c["x"] + sim.rand(-20, 20)
                    s["y"] = c["y"] + sim.rand(-20, 20)
                    s["speed"] = 0.5
                    s["forcedLoiterTicks"] = 12
            elif event_type == "loitering":
                s["forcedLoiterTicks"] = 14
                s["speed"] = 0.3
            elif event_type == "ais_silence":
                s["silentUntilTick"] = self.tick + 6
                direct_alert = sim.make_alert(s, "silence", "⚓", "medium",
                                               f"AIS signal lost for {s['name']}")
            elif event_type == "gps_jump":
                ox, oy = s["x"], s["y"]
                s["x"] = sim.rand(30, 970)
                s["y"] = sim.rand(30, 570)
                dist = round(math.hypot(s["x"] - ox, s["y"] - oy))
                direct_alert = sim.make_alert(s, "route", "🧭", "high",
                                               f"Sudden position jump detected ({dist} units)")
            elif event_type == "protected_entry":
                pz = [z for z in self.zones if z["type"] in ("mpa", "reef")]
                if pz:
                    z = random.choice(pz)
                    c = sim.centroid(z["points"])
                    s["x"] = c["x"] + sim.rand(-15, 15)
                    s["y"] = c["y"] + sim.rand(-15, 15)
                    s["heading"] = sim.rand(0, 360)

            self.ships[idx] = s
            if direct_alert:
                self.alerts.appendleft(direct_alert)
            return direct_alert


# Single shared world - imported by every router / the websocket endpoint.
state = SimulationState()
