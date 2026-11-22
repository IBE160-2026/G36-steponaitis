"""Kernel value types (AD-9): quantities and Walk Path as normalized decimal strings."""

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

CODE_MAX_LENGTH = 200
"""The longest part number or location code a command or query accepts."""


def dec_text(value: Decimal) -> str:
    """The normalized plain string of a decimal: no exponent, no trailing zeros, no `-0`."""
    if value == 0:
        return "0"
    return format(value.normalize(), "f")


Dec = Annotated[Decimal, PlainSerializer(dec_text, return_type=str, when_used="json")]
"""A Decimal that validates from str/int/Decimal and serializes in JSON mode via `dec_text`."""
