"""Deploy contract (Story 16.1): one Vercel origin, /api to FastAPI, only `main` deploys."""

import json
from fnmatch import fnmatch
from pathlib import Path, PurePosixPath

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


def _brace_alternatives(glob: str) -> list[str]:
    """The patterns of a one-level `{a,b}` brace list; a glob without braces is itself."""
    if glob.startswith("{") and glob.endswith("}"):
        return [pattern.strip() for pattern in glob[1:-1].split(",")]
    return [glob]


def _excluded(name: str, patterns: list[str]) -> bool:
    """True when a pattern excludes `name`, a posix path relative to the service root.

    An approximation of Vercel's glob that errs towards "excluded": fnmatch's `*` also crosses
    `/`; `"/" + name` is matched too, so a leading `**/` can stand for zero directories; and a
    pattern that names one of the path's leading directories (`settings`, `swp/store`) excludes
    everything under it.
    """
    folders = {parent.as_posix() for parent in PurePosixPath(name).parents} - {"."}
    return any(
        fnmatch(name, pattern) or fnmatch("/" + name, pattern) or pattern.rstrip("/") in folders
        for pattern in patterns
    )


def test_nfr5_vercel_bundle_keeps_settings_and_swp() -> None:
    # Epic 16 retro F10: New Plan reads backend/settings/analysis.toml at runtime, so an
    # `excludeFiles` glob that drops `settings/` or `swp/` breaks the public URL only.
    api = _vercel()["services"]["api"]
    backend = REPO_ROOT / api["root"]
    patterns = _brace_alternatives(api["functions"]["swp/main.py"]["excludeFiles"])
    # Nested or partial braces are not expanded here: they would match nothing and pass.
    assert not any("{" in pattern or "}" in pattern for pattern in patterns), patterns
    shipped = [
        path.relative_to(backend).as_posix()
        for folder in ("settings", "swp")
        for path in (backend / folder).rglob("*")
        # Byte-code caches are not source: excluding them is harmless.
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
    ]

    assert {"settings/analysis.toml", "swp/main.py"} <= set(shipped)
    # The matcher catches what it is there for.
    assert _excluded("tests/test_deploy.py", patterns)
    for dropping in ("settings/**", "**/settings/**", "settings", "settings/", "**/*.toml"):
        assert _excluded("settings/analysis.toml", [dropping]), dropping
    for dropping in ("swp/**", "**/swp/**", "swp", "swp/store", "**/store/**"):
        assert _excluded("swp/store/db.py", [dropping]), dropping
    assert not _excluded("swp/main.py", ["tests/**", "var/**", "**/__pycache__/**", "settings"])

    assert [name for name in shipped if _excluded(name, patterns)] == []
