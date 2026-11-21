"""Upload size limit for POST /api/plans (AD-12, AD-18).

FastAPI parses the multipart body before any dependency runs, so the limit is checked
here: a `Content-Length` over the limit, or a streamed body that grows past it, is
answered 413 `limit_reached` before the form is parsed. The body (at most the limit) is
buffered in memory and replayed to the app. The value and message come from swp.app.limits.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from swp.api.errors import error_response
from swp.app.limits import max_upload_bytes, upload_too_large

LIMITED = frozenset({("POST", "/api/plans")})


class UploadLimit:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or (scope["method"].upper(), scope["path"]) not in LIMITED:
            await self.app(scope, receive, send)
            return
        limit = max_upload_bytes()
        too_large = error_response(upload_too_large(limit))
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = 0
                if declared > limit:
                    await too_large(scope, receive, send)
                    return
                break

        messages: list[Message] = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > limit:
                await too_large(scope, receive, send)
                return
            messages.append(message)
            if not message.get("more_body", False):
                break

        async def replay() -> Message:
            if messages:
                return messages.pop(0)
            return await receive()

        await self.app(scope, replay, send)
