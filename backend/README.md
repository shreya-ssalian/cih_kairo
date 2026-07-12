# SeaPulse Backend

A real FastAPI service that runs the SeaPulse maritime-surveillance
simulation server-side: ship movement, geofence (point-in-polygon)
detection, suspicion/ecosystem scoring, and the alert engine — the exact
same logic that used to run only inside the browser — now shared over
REST + WebSocket so every connected client sees one consistent world.

## Run it

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # optional, defaults work fine
uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`, docs at
`http://localhost:8000/docs`, and the live feed at `ws://localhost:8000/ws/stream`.

## Project structure

```
backend/
  app/
    main.py         # FastAPI app, CORS, background tick loop, /ws/stream
    config.py       # env-driven settings
    schemas.py      # Pydantic request models
    simulation.py   # pure simulation engine (ported from SeaPulse.jsx)
    state.py        # shared in-memory world state (thread/async-safe)
    ws_manager.py    # WebSocket connection registry + broadcast
    routers/
      zones.py       # GET/POST/DELETE /api/zones
      ships.py       # GET /api/ships, /api/ships/{id}
      alerts.py      # GET /api/alerts
      simulator.py   # start/pause/reset/ship-target/tick-rate/inject-event/benchmark
  requirements.txt
  Dockerfile
  .env.example
```

## REST API

| Method | Path                              | Description                                   |
|--------|------------------------------------|------------------------------------------------|
| GET    | `/api/health`                      | Liveness check                                  |
| GET    | `/api/zones`                       | List geofence zones                             |
| GET    | `/api/zones/types`                 | Zone type metadata (labels/colors)              |
| POST   | `/api/zones`                       | Create a zone `{name, type, points: [[x,y],…]}` |
| DELETE | `/api/zones/{zone_id}`             | Remove a zone                                   |
| GET    | `/api/ships?limit=`                | List current fleet                              |
| GET    | `/api/ships/{ship_id}`             | Single ship                                     |
| GET    | `/api/alerts?severity=&type=&limit=` | Recent alerts, most-recent first              |
| GET    | `/api/simulator/status`            | Running state, tick, ship target, tick rate     |
| POST   | `/api/simulator/start`             | Resume the simulation                           |
| POST   | `/api/simulator/pause`             | Pause the simulation                            |
| POST   | `/api/simulator/reset`             | Re-prime the fleet from tick 0                  |
| POST   | `/api/simulator/ship-target`       | `{target: number}` — resize the fleet           |
| POST   | `/api/simulator/tick-rate`         | `{tickRateMs: number}` (100–5000)               |
| POST   | `/api/simulator/inject-event`      | `{type: "illegal_fishing"\|"loitering"\|"ais_silence"\|"gps_jump"\|"protected_entry"}` |
| POST   | `/api/simulator/benchmark`         | `{numMessages, poolSize?}` — real, measured throughput test |

## WebSocket `/ws/stream`

On connect you immediately receive one `{"type": "snapshot", ...}` message
with the full current world (zones, ships, alerts, tick, liveStats,
statsHistory). After that, every simulation tick pushes:

```json
{
  "type": "tick",
  "tick": 123,
  "ships": [...],
  "newAlerts": [...],
  "liveStats": { "messagesPerSec": 0, "latency": 0, "cpu": 0, "mem": 0 },
  "statsPoint": { "t": 123, "msgs": 0, "latency": 0, "active": 1000 }
}
```

Zone changes broadcast `{"type": "zones", "zones": [...]}`, simulator
setting changes broadcast `{"type": "status", ...}`, and one-off injected
alerts (e.g. AIS silence, GPS jump) broadcast `{"type": "alert", "alert": {...}}`.

## Notes

- State is in-memory and single-process by design — this mirrors the
  original browser simulation exactly, just relocated to a server so it
  can be shared. Swap `app/state.py` for a Redis/DB-backed store if you
  need persistence or multi-process scaling.
- All simulation math (movement, suspicion, ecosystem scoring, alert
  rules) lives in `app/simulation.py` and is a straight line-for-line port
  of the original `stepShip`/`createShip`/`runRealBenchmark` functions from
  `src/SeaPulse.jsx`, so behavior matches the original demo exactly.
