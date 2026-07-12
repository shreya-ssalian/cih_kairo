"""
SeaPulse backend entrypoint.

Run locally with:

    uvicorn app.main:app --reload --port 8000

Exposes:
  - REST endpoints under /api/*        (see app/routers/*)
  - A live WebSocket stream at /ws/stream that pushes a full snapshot on
    connect, then a `tick` message every simulation tick, plus `zones`,
    `status`, and `alert` messages whenever those change out of band.
"""
import asyncio
import logging
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import alerts, ships, simulator, zones
from .state import state
from .ws_manager import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seapulse")

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(zones.router)
app.include_router(ships.router)
app.include_router(alerts.router)
app.include_router(simulator.router)

_loop_task: Optional[asyncio.Task] = None


async def simulation_loop() -> None:
    """Background task: advances the world one tick at a time, at whatever
    tick rate is currently configured, and broadcasts the result to every
    connected WebSocket client."""
    while True:
        await asyncio.sleep(state.tick_rate_ms / 1000)
        if not state.running:
            continue
        try:
            new_alerts, point = await state.do_tick()
            await manager.broadcast({
                "type": "tick",
                "tick": state.tick,
                "ships": state.ships,
                "newAlerts": new_alerts,
                "liveStats": state.live_stats,
                "statsPoint": point,
            })
        except Exception:
            logger.exception("simulation tick failed")


@app.on_event("startup")
async def on_startup() -> None:
    global _loop_task
    _loop_task = asyncio.create_task(simulation_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if _loop_task:
        _loop_task.cancel()


@app.get("/api/health")
async def health():
    return {"status": "ok", "tick": state.tick, "running": state.running}


@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json(state.snapshot())
        while True:
            # The frontend doesn't need to send anything, but we still need
            # to await something so we notice a disconnect promptly.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("websocket error")
    finally:
        await manager.disconnect(websocket)
