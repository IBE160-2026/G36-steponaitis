"""NFR-1 maintainability: the layer rules of AD-1/AD-9 reject violations."""

import ast
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
SWP_DIR = BACKEND_DIR / "swp"
DOMAIN_DIR = SWP_DIR / "domain"
VENV_BIN = Path(sys.executable).parent


def _tool(name: str) -> str:
    path = shutil.which(name, path=str(VENV_BIN)) or shutil.which(name)
    assert path, f"{name} is not installed"
    return path


def test_nfr1_domain_imports_only_stdlib_and_pydantic() -> None:
    allowed = set(sys.stdlib_module_names) | {"pydantic", "swp"}
    offenders: list[str] = []
    for file in DOMAIN_DIR.rglob("*.py"):
        tree = ast.parse(file.read_text(encoding="utf-8"), filename=str(file))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names = [node.module]
            else:
                continue
            for name in names:
                top = name.split(".")[0]
                inside_domain = name == "swp.domain" or name.startswith("swp.domain.")
                if top not in allowed or (top == "swp" and not inside_domain):
                    offenders.append(f"{file.relative_to(BACKEND_DIR)}: {name}")
    assert offenders == []


BANNED_SNIPPETS = [
    "import uuid\n\nX = uuid.uuid4()\n",
    "from uuid import uuid4\n\nX = uuid4()\n",
    "import datetime\n\nX = datetime.datetime.now()\n",
    "from datetime import datetime\n\nX = datetime.now()\n",
    "from datetime import datetime\n\nX = datetime.utcnow()\n",
    "from datetime import date\n\nX = date.today()\n",
    "import random\n\nX = random.random()\n",
    "from random import choice\n\nX = choice([1, 2])\n",
    "from datetime import datetime\n\nX = datetime.today()\n",
    "import time\n\nX = time.time()\n",
    "import uuid\n\nX = uuid.uuid1()\n",
    "import secrets\n\nX = secrets.token_hex()\n",
]


def _ruff(code: str, filename: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [_tool("ruff"), "check", "--no-cache", "--stdin-filename", str(filename), "-"],
        input=code,
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
    )


@pytest.mark.parametrize("code", BANNED_SNIPPETS)
def test_nfr1_ruff_bans_clock_uuid4_random_in_domain(code: str) -> None:
    inside = _ruff(code, DOMAIN_DIR / "violation.py")
    assert inside.returncode != 0, inside.stdout
    assert "TID251" in inside.stdout

    outside = _ruff(code, SWP_DIR / "app" / "allowed.py")
    assert outside.returncode == 0, outside.stdout


LAYER_VIOLATIONS = {
    "domain imports sqlalchemy": ("domain/violation.py", "import sqlalchemy\n"),
    "domain imports swp.store": ("domain/violation.py", "import swp.store.db\n"),
    "domain imports fastapi": ("domain/violation.py", "import fastapi\n"),
    "domain imports swp.config": ("domain/violation.py", "import swp.config\n"),
    "api imports swp.store": ("api/violation.py", "from swp.store import db\n"),
    "app imports sqlalchemy": ("app/violation.py", "import sqlalchemy\n"),
    "api imports sqlalchemy": ("api/violation.py", "from sqlalchemy import text\n"),
    "app imports alembic": ("app/violation.py", "import alembic\n"),
    "app imports psycopg": ("app/violation.py", "import psycopg\n"),
    "store imports swp.app": ("store/violation.py", "import swp.app.health\n"),
}


def _lint_imports(workdir: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [_tool("lint-imports"), "--no-cache"],
        capture_output=True,
        text=True,
        cwd=workdir,
        env={**os.environ, "PYTHONPATH": str(workdir), "PATH": str(VENV_BIN)},
    )


def _copy_package(tmp_path: Path) -> Path:
    shutil.copytree(SWP_DIR, tmp_path / "swp", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy(BACKEND_DIR / ".importlinter", tmp_path / ".importlinter")
    return tmp_path


def test_nfr1_import_linter_passes_on_clean_copy(tmp_path: Path) -> None:
    result = _lint_imports(_copy_package(tmp_path))
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("case", sorted(LAYER_VIOLATIONS))
def test_nfr1_import_linter_rejects_layer_violations(tmp_path: Path, case: str) -> None:
    workdir = _copy_package(tmp_path)
    relative, code = LAYER_VIOLATIONS[case]
    (workdir / "swp" / relative).write_text(code, encoding="utf-8")

    result = _lint_imports(workdir)

    assert result.returncode != 0, result.stdout
    assert "BROKEN" in result.stdout
    assert f"swp.{relative.removesuffix('.py').replace('/', '.')}" in result.stdout
