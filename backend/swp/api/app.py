"""FastAPI application factory. Every router is mounted under /api (AD-2)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from swp.api.routers import health
from swp.app.bootstrap import bootstrap
from swp.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if get_settings().app_env == "local":
        bootstrap(upgrade=True, seed=False)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Smart Warehouse Planner", lifespan=lifespan)
    app.include_router(health.router, prefix="/api")
    return app
