"""GET /api/health: runs SELECT 1 on the database (AD-2)."""

from fastapi import APIRouter

from swp.app import health

router = APIRouter()


@router.get("/health")
def get_health() -> dict[str, str]:
    health.check()
    return {"status": "ok"}
