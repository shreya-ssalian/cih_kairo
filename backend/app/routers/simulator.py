import asyncio

from fastapi import APIRouter, HTTPException

from .. import simulation as sim
from ..config import settings
from ..schemas import BenchmarkBody, InjectEventBody, ShipTargetBody, TickRateBody
from ..state import state
from ..ws_manager import manager

router = APIRouter(prefix="/api/simulator", tags=["simulator"])


@router.get("/status")
async def get_status():
    return state.status()


@router.post("/start")
async def start():
    await state.set_running(True)
    await manager.broadcast({"type": "status", **state.status()})
    return state.status()


@router.post("/pause")
async def pause():
    await state.set_running(False)
    await manager.broadcast({"type": "status", **state.status()})
    return state.status()


@router.post("/reset")
async def reset():
    await state.reset()
    await manager.broadcast(state.snapshot())
    return state.status()


@router.post("/ship-target")
async def set_ship_target(body: ShipTargetBody):
    await state.set_ship_target(body.target)
    await manager.broadcast({"type": "status", **state.status()})
    return state.status()


@router.post("/tick-rate")
async def set_tick_rate(body: TickRateBody):
    await state.set_tick_rate(body.tickRateMs)
    await manager.broadcast({"type": "status", **state.status()})
    return state.status()


@router.post("/inject-event")
async def inject_event(body: InjectEventBody):
    if body.type not in settings.VALID_EVENT_TYPES:
        raise HTTPException(400, f"Unknown event type: {body.type}")
    alert = await state.inject_event(body.type)
    if alert:
        await manager.broadcast({"type": "alert", "alert": alert})
    return {"ok": True, "alert": alert}


@router.post("/benchmark")
async def benchmark(body: BenchmarkBody):
    """Fires a burst of AIS messages directly at the real detection pipeline
    (movement + geofence point-in-polygon checks + suspicion scoring - the
    exact same code every ship runs each tick) in one tight loop, timed with
    a high resolution clock. This is a genuine measurement, not a formula."""
    pool_size = body.poolSize or settings.BENCHMARK_POOL_SIZE
    loop = asyncio.get_event_loop()
    zones_copy = list(state.zones)
    result = await loop.run_in_executor(
        None, sim.run_real_benchmark, zones_copy, body.numMessages, pool_size
    )
    return result
