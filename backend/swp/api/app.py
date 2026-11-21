"""FastAPI application factory. Every router is mounted under /api (AD-2)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from swp.api.errors import install_error_handlers
from swp.api.origin_guard import OriginGuard
from swp.api.request_log import RequestLog, configure_logging
from swp.api.routers import health, parts, plans, session
from swp.api.upload_limit import UploadLimit
from swp.app.bootstrap import bootstrap
from swp.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if get_settings().app_env == "local":
        bootstrap(upgrade=True, seed=False)
    yield


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Smart Warehouse Planner", lifespan=lifespan)
    install_error_handlers(app)
    # Added last = outermost: the request log sees every response, then the origin guard
    # rejects cross-site writes before the upload limit buffers any body.
    app.add_middleware(UploadLimit)
    app.add_middleware(OriginGuard)
    app.add_middleware(RequestLog)
    app.include_router(health.router, prefix="/api")
    app.include_router(plans.router, prefix="/api")
    app.include_router(parts.router, prefix="/api")
    app.include_router(session.router, prefix="/api")
    return app
