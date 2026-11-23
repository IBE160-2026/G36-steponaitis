"""FastAPI application factory. Every router is mounted under /api (AD-2)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from swp.api.errors import install_error_handlers
from swp.api.origin_guard import OriginGuard
from swp.api.request_log import RequestLog, configure_logging
from swp.api.routers import (
    auth,
    before_after,
    commands,
    health,
    locations,
    move_list,
    moves,
    parts,
    pick_groups,
    plans,
    recommendations,
    search,
    session,
)
from swp.api.session_guard import require_session
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
    # Open without a session: health, who is logged in, and the auth routes themselves.
    app.include_router(health.router, prefix="/api")
    app.include_router(session.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    # Every other router answers `unauthenticated` when auth is on and there is no session.
    guarded = [Depends(require_session)]
    for router in (
        plans.router,
        commands.router,
        parts.router,
        locations.router,
        pick_groups.router,
        search.router,
        moves.router,
        before_after.router,
        move_list.router,
        recommendations.router,
    ):
        app.include_router(router, prefix="/api", dependencies=guarded)
    return app
