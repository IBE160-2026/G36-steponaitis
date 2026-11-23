"""Kernel: small figures shared by the plan views (AD-1). Not a slice: any view may import it."""

from decimal import ROUND_HALF_UP, Decimal


def occupied_percent(occupied: int, total: int) -> str:
    """`occupied / total * 100` with one decimal, rounded half-up ("0.0" when total is 0)."""
    if total == 0:
        return "0.0"
    pct = (Decimal(occupied) * 100 / Decimal(total)).quantize(Decimal("0.1"), ROUND_HALF_UP)
    return f"{pct:.1f}"
