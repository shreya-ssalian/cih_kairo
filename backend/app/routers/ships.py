from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..state import state

router = APIRouter(prefix="/api/ships", tags=["ships"])


@router.get("")
async def list_ships(limit: Optional[int] = Query(None, ge=1)):
    ships = state.ships
    if limit:
        ships = ships[:limit]
    return ships


@router.get("/{ship_id}")
async def get_ship(ship_id: str):
    for s in state.ships:
        if s["id"] == ship_id:
            return s
    raise HTTPException(404, "Ship not found")
