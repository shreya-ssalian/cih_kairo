import time

from fastapi import APIRouter, HTTPException

from ..schemas import ZoneCreate
from ..simulation import ZONE_TYPES
from ..state import state
from ..ws_manager import manager

router = APIRouter(prefix="/api/zones", tags=["zones"])


@router.get("")
async def list_zones():
    return state.zones


@router.get("/types")
async def list_zone_types():
    return ZONE_TYPES


@router.post("")
async def create_zone(body: ZoneCreate):
    if body.type not in ZONE_TYPES:
        raise HTTPException(400, f"Unknown zone type: {body.type}")
    zone = {
        "id": f"z{int(time.time() * 1000)}",
        "type": body.type,
        "name": body.name or "Unnamed Zone",
        "points": body.points,
    }
    await state.add_zone(zone)
    await manager.broadcast({"type": "zones", "zones": state.zones})
    return zone


@router.delete("/{zone_id}")
async def delete_zone(zone_id: str):
    if not any(z["id"] == zone_id for z in state.zones):
        raise HTTPException(404, "Zone not found")
    await state.delete_zone(zone_id)
    await manager.broadcast({"type": "zones", "zones": state.zones})
    return {"deleted": zone_id}
