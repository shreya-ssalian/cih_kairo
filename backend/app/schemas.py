"""
Pydantic request/response models.

Field names intentionally use the same camelCase spelling as the React
frontend (e.g. `shipId`, `zoneIds`, `messagesPerSec`) so payloads can be
passed straight through without a translation layer.
"""
from typing import List, Optional

from pydantic import BaseModel, Field

Point = List[float]


class ZoneCreate(BaseModel):
    name: str = Field(default="Unnamed Zone")
    type: str
    points: List[Point] = Field(..., min_items=3)


class ShipTargetBody(BaseModel):
    target: int = Field(..., gt=0, le=20000)


class TickRateBody(BaseModel):
    tickRateMs: int = Field(..., ge=100, le=5000)


class InjectEventBody(BaseModel):
    type: str


class BenchmarkBody(BaseModel):
    numMessages: int = Field(default=300000, gt=0, le=2_000_000)
    poolSize: Optional[int] = Field(default=None, gt=0, le=20000)
