# SeaPulse

A maritime surveillance & ecosystem command dashboard — treasure-map themed
UI (leather, gold, wax-seal accents), a live ship simulator, geofence zones,
alerts, and analytics.

This project now has a real backend. The React frontend talks to a FastAPI
service over REST + WebSocket, which runs the actual simulation
(movement, geofence/point-in-polygon detection, suspicion & ecosystem
scoring, the alert engine, and a genuine measured throughput benchmark) and
streams live ticks to every connected client. If the backend isn't running,
the frontend automatically falls back to the original in-browser simulator
so it still works standalone.

## Project structure

```
seapulse/
  backend/                  # FastAPI service - the real simulation engine
    app/
      main.py                # app entrypoint, background tick loop, /ws/stream
      config.py               # environment-driven settings
      schemas.py               # Pydantic request models
      simulation.py             # pure simulation engine (movement/geofence/scoring)
      state.py                   # shared, async-safe in-memory world state
      ws_manager.py                # WebSocket connection registry
      routers/
        zones.py, ships.py, alerts.py, simulator.py
    requirements.txt
    Dockerfile
    .env.example
    README.md               # backend-specific docs & API reference

  frontend/                 # Vite + React app (the dashboard UI)
    index.html
    vite.config.js
    package.json
    .env.example
    src/
      main.jsx               # mounts <SeaPulseApp />
      SeaPulse.jsx             # the dashboard UI + local-simulation fallback
      api/
        backendClient.js        # REST client for the FastAPI backend
        useBackendSimulation.js  # WebSocket hook: live state + actions
```

## Run it

**1. Start the backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Start the frontend, in another terminal:**

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The header's
live indicator will read `LIVE · BACKEND · TICK …` once it connects; if you
skip step 1, it instead reads `LIVE · LOCAL · TICK …` and everything still
works using the bundled client-side simulator.

## How the two are wired together

- The frontend opens a WebSocket to `VITE_API_URL` (default
  `http://localhost:8000`, see `frontend/.env.example`) via
  `src/api/useBackendSimulation.js`. On connect it receives a full snapshot
  (zones/ships/alerts/tick/stats), then a `tick` message every simulation
  step.
- Every action a user can take — pause/resume, resize the fleet, change
  tick rate, draw/delete a geofence zone, inject a synthetic event
  (illegal fishing, loitering, AIS silence, GPS jump, protected-zone entry),
  run the real throughput benchmark — calls a REST endpoint on the backend;
  the result comes back to every connected tab over the WebSocket.
- If the backend is unreachable, `useBackendSimulation` keeps retrying in
  the background every few seconds, and the app transparently uses its
  original in-memory `setInterval` simulation loop instead — nothing in the
  UI breaks, it just isn't shared across tabs/users until the backend comes
  back.

See `backend/README.md` for the full REST/WebSocket API reference.
