"""
Central configuration for the SeaPulse backend.

Everything is overridable via environment variables so the service behaves
the same whether it's run locally, in Docker, or in CI.
"""
import os


def _split_origins(raw: str):
    return [o.strip() for o in raw.split(",") if o.strip()]


class Settings:
    APP_NAME: str = "SeaPulse Backend"
    APP_VERSION: str = "1.0.0"

    # Comma-separated list of allowed CORS origins, "*" allows any origin.
    CORS_ORIGINS = _split_origins(os.environ.get("SEAPULSE_CORS_ORIGINS", "*"))

    # Simulation defaults - mirrors the original in-browser simulator.
    DEFAULT_TICK_RATE_MS: int = int(os.environ.get("SEAPULSE_TICK_RATE_MS", "800"))
    DEFAULT_SHIP_TARGET: int = int(os.environ.get("SEAPULSE_SHIP_TARGET", "1000"))
    MIN_TICK_RATE_MS: int = 100
    MAX_TICK_RATE_MS: int = 5000

    MAX_ALERTS: int = 250
    MAX_STATS_HISTORY: int = 40
    BENCHMARK_POOL_SIZE: int = 2000
    BENCHMARK_MAX_MESSAGES: int = 2_000_000

    VALID_EVENT_TYPES = {
        "illegal_fishing",
        "loitering",
        "ais_silence",
        "gps_jump",
        "protected_entry",
    }


settings = Settings()
