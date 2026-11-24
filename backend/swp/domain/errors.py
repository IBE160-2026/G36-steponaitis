"""Kernel error types: the domain raises DomainError; only swp.api maps it to HTTP (AD-11)."""

from typing import TypedDict


class FieldError(TypedDict):
    """One failing form field, as a `validation_failed` detail (AD-11)."""

    field: str
    message: str


class DomainError(Exception):
    """A closed error `code`, final English `message` and structured `details`."""

    def __init__(
        self, code: str, message: str, details: list[dict[str, object]] | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details: list[dict[str, object]] = list(details) if details else []

    def __str__(self) -> str:
        return self.message
