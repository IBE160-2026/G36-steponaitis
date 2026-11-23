"""The AD-11 error envelope: every API error is `{"error": {code, message, details}}`.

Only this module maps error codes to HTTP statuses.
"""

import logging
from collections.abc import Mapping
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from swp.domain.errors import DomainError

logger = logging.getLogger("swp.error")

STATUS_BY_CODE: Mapping[str, int] = {
    "import_invalid": 422,
    "validation_failed": 422,
    "command_rejected": 409,
    "plan_not_found": 404,
    "not_found": 404,
    "unauthenticated": 401,
    "forbidden_origin": 403,
    "login_locked": 429,
    "limit_reached": 413,  # upload size and rows; the demo plan/account limits are 409
    "internal": 500,
    "unavailable": 503,
}

NOT_FOUND = "Not found."
INVALID_REQUEST = "The request is not valid."
INTERNAL = "Something went wrong. Try again."


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]]


class ErrorEnvelope(BaseModel):
    error: ErrorBody


# `limit_reached` for a demo count limit (AD-18) is a conflict, not a too-large request.
COUNT_LIMITS = frozenset({"max_plans", "max_accounts"})


def status_for(error: DomainError) -> int:
    if error.code == "limit_reached" and any(
        detail.get("limit") in COUNT_LIMITS for detail in error.details
    ):
        return 409
    return STATUS_BY_CODE.get(error.code, 500)


def error_response(error: DomainError) -> JSONResponse:
    status = status_for(error)
    body = ErrorEnvelope(
        error=ErrorBody(code=error.code, message=error.message, details=error.details)
    )
    return JSONResponse(body.model_dump(mode="json"), status_code=status)


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """OpenAPI `responses` documenting the envelope for each status."""
    return {status: {"model": ErrorEnvelope, "description": "Error"} for status in statuses}


async def _domain_error(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    return error_response(exc)


async def _request_validation(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details: list[dict[str, object]] = []
    for item in exc.errors():
        loc = item.get("loc") or ()
        field = str(loc[-1]) if loc else ""
        details.append({"field": field, "message": str(item.get("msg", INVALID_REQUEST))})
    message = details[0]["message"] if len(details) == 1 else INVALID_REQUEST
    return error_response(DomainError("validation_failed", str(message), details))


async def _http_error(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    if exc.status_code in (404, 405):
        return error_response(DomainError("not_found", NOT_FOUND))
    if 400 <= exc.status_code < 500:
        return error_response(DomainError("validation_failed", INVALID_REQUEST))
    return error_response(DomainError("internal", INTERNAL))


async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(DomainError("internal", INTERNAL))


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _domain_error)
    app.add_exception_handler(RequestValidationError, _request_validation)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected)
