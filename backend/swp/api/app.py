"""FastAPI application factory. Every router is mounted under /api (AD-2)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.gzip import GZipMiddleware

from swp.api.errors import install_error_handlers
from swp.api.origin_guard import OriginGuard
from swp.api.request_log import RequestLog, configure_logging
from swp.api.routers import (
    auth,
    before_after,
    commands,
    health,
    layout,
    locations,
    move_list,
    moves,
    parts,
    pick_groups,
    plans,
    recommendations,
    search,
    session,
    wall,
)
from swp.api.session_guard import current_user
from swp.api.upload_limit import UploadLimit
from swp.app.bootstrap import bootstrap
from swp.app.startup import check_startup
from swp.config import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if get_settings().app_env == "local":
        bootstrap(upgrade=True, seed=True)
    yield


def create_app(*, check_settings: bool = True) -> FastAPI:
    configure_logging()
    # AD-10/NFR-6: production refuses unsafe settings (StartupRefused) before anything is built,
    # so `uvicorn swp.main:app` exits. Only `swp openapi` skips it (it serves nothing).
    if check_settings:
        check_startup()
    app = FastAPI(title="Smart Warehouse Planner", lifespan=lifespan)
    install_error_handlers(app)
    # Added last = outermost: the request log sees every response, then the origin guard
    # rejects cross-site writes before the upload limit buffers any body. GZip is innermost:
    # a max-size plan's parts and locations views are over 4 MB as plain JSON, and AD-18
    # keeps every response body under 4 MB (Vercel's 4.5 MB function limit); compressed,
    # they are a fraction of that.
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(UploadLimit)
    app.add_middleware(OriginGuard)
    app.add_middleware(RequestLog)
    # Open without a session: health, who is logged in, and the auth routes themselves.
    app.include_router(health.router, prefix="/api")
    app.include_router(session.router, prefix="/api")
    app.include_router(auth.router, prefix="/api")
    # Every other router answers `unauthenticated` when auth is on and there is no session.
    guarded = [Depends(current_user)]
    for router in (
        plans.router,
        commands.router,
        parts.router,
        locations.router,
        layout.router,
        pick_groups.router,
        search.router,
        moves.router,
        before_after.router,
        move_list.router,
        recommendations.router,
        wall.router,
    ):
        app.include_router(router, prefix="/api", dependencies=guarded)
    return app
