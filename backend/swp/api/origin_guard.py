"""Same-origin guard (AD-19, NFR-6): state-changing requests must come from this site."""

from urllib.parse import urlsplit

from starlette.types import ASGIApp, Receive, Scope, Send

from swp.api.errors import error_response
from swp.domain.errors import DomainError

CHECKED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
FORBIDDEN_ORIGIN = "This request came from another site."


def _headers(scope: Scope) -> dict[str, str]:
    # First value wins for repeated headers.
    headers: dict[str, str] = {}
    for key, value in scope.get("headers", []):
        headers.setdefault(key.decode("latin-1").lower(), value.decode("latin-1"))
    return headers


def is_same_origin(headers: dict[str, str]) -> bool:
    fetch_site = headers.get("sec-fetch-site")
    if fetch_site is not None:
        return fetch_site.strip().lower() == "same-origin"
    origin = headers.get("origin", "").strip()
    if not origin or origin == "null":
        return False
    parts = urlsplit(origin)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return False
    origin_host = parts.netloc.lower()
    hosts = {headers.get("host", "").strip().lower()}
    forwarded = headers.get("x-forwarded-host")
    if forwarded:
        hosts.add(forwarded.split(",")[0].strip().lower())
    hosts.discard("")
    return origin_host in hosts


class OriginGuard:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"].upper() in CHECKED_METHODS
            and not is_same_origin(_headers(scope))
        ):
            response = error_response(DomainError("forbidden_origin", FORBIDDEN_ORIGIN))
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
