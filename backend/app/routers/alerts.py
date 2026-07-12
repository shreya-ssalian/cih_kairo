from typing import Optional

from fastapi import APIRouter, Query

from ..state import state

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    severity: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = Query(250, ge=1, le=250),
):
    items = list(state.alerts)
    if severity and severity != "all":
        items = [a for a in items if a["severity"] == severity]
    if type and type != "all":
        items = [a for a in items if a["type"] == type]
    return items[:limit]
