"""Deploy contract (Story 16.1): one Vercel origin, /api to FastAPI, only `main` deploys."""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _vercel() -> dict:
    return json.loads((REPO_ROOT / "vercel.json").read_text(encoding="utf-8"))


def test_nfr5_vercel_routes_api_to_the_fastapi_service() -> None:
    config = _vercel()
    services = config["services"]
    api_rewrites = [r for r in config["rewrites"] if r["source"] == "/api/(.*)"]

    assert len(api_rewrites) == 1
    target = services[api_rewrites[0]["destination"]["service"]]
    assert target["entrypoint"] == "swp.main:app"
    assert target["root"].rstrip("/") == "backend"
    # The API rewrite comes before the catch-all to the Next.js service.
    sources = [r["source"] for r in config["rewrites"]]
    assert sources.index("/api/(.*)") < sources.index("/(.*)")
    web = services[config["rewrites"][sources.index("/(.*)")]["destination"]["service"]]
    assert web["framework"] == "nextjs"


def test_nfr5_vercel_deploys_only_main() -> None:
    enabled = _vercel()["git"]["deploymentEnabled"]

    assert enabled == {"**": False, "main": True}
