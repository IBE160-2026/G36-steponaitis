"""One INFO line per request on the `swp.request` logger: "<METHOD> <path> <status> <ms>ms"."""

import logging
import sys
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("swp.request")


def configure_logging() -> None:
    """Give the `swp` logger a stdout handler at INFO unless it already has one."""
    root = logging.getLogger("swp")
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(levelname)s [%(name)s] %(message)s"))
        root.addHandler(handler)
    if root.level == logging.NOTSET:
        root.setLevel(logging.INFO)


class RequestLog:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed = round((time.perf_counter() - start) * 1000)
            logger.info("%s %s %s %sms", scope["method"], scope["path"], status, elapsed)
