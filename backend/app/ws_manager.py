"""
Tracks connected WebSocket clients and broadcasts messages to all of them.
"""
import asyncio
from typing import Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: Set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self.lock:
            self.active.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self.lock:
            self.active.discard(ws)

    async def broadcast(self, message: dict) -> None:
        async with self.lock:
            targets = list(self.active)
        dead = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self.lock:
                for ws in dead:
                    self.active.discard(ws)


manager = ConnectionManager()
