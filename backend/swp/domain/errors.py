"""Kernel error type: the domain raises DomainError; only swp.api maps it to HTTP (AD-11)."""


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
