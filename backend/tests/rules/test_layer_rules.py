"""NFR-1 maintainability: the layer rules of AD-1/AD-9 reject violations."""

import ast
import configparser
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


SLICE_IMPORTS = {
    "classify imports import_": ("domain/classify.py", "import swp.domain.import_\n"),
    "import_ imports classify": ("domain/import_.py", "import swp.domain.classify\n"),
    "pick_groups imports classify": ("domain/pick_groups.py", "import swp.domain.classify\n"),
    "views.parts imports classify": ("domain/views/parts.py", "import swp.domain.classify\n"),
    "views.locations imports classify": (
        "domain/views/locations.py",
        "import swp.domain.classify\n",
    ),
    "views.pick_groups imports pick_groups": (
        "domain/views/pick_groups.py",
        "import swp.domain.pick_groups\n",
    ),
}
DOMAIN_SLICES_CONTRACT = "Domain slices never import each other"


@pytest.mark.parametrize("case", sorted(SLICE_IMPORTS))
def test_nfr1_import_linter_rejects_slice_imports(tmp_path: Path, case: str) -> None:
    workdir = _copy_package(tmp_path)
    relative, code = SLICE_IMPORTS[case]
    target = workdir / "swp" / relative
    target.write_text(target.read_text(encoding="utf-8") + code, encoding="utf-8")

    result = _lint_imports(workdir)

    assert result.returncode != 0, result.stdout
    assert "BROKEN" in result.stdout
    assert f"{DOMAIN_SLICES_CONTRACT} (AD-1) BROKEN" in result.stdout


KERNEL_MODULES = {
    "swp.domain",
    "swp.domain.views",
    "swp.domain.analysis",
    "swp.domain.errors",
    "swp.domain.import_data",
    "swp.domain.ordering",
    "swp.domain.planning",
    "swp.domain.state",
    "swp.domain.state_migrations",
    "swp.domain.values",
}


def test_nfr1_every_domain_module_is_kernel_or_independent_slice() -> None:
    config = configparser.ConfigParser()
    config.read(BACKEND_DIR / ".importlinter", encoding="utf-8")
    slices = set(config["importlinter:contract:domain-slices"]["modules"].split())
    modules = {
        ".".join(file.relative_to(SWP_DIR.parent).with_suffix("").parts).removesuffix(".__init__")
        for file in DOMAIN_DIR.rglob("*.py")
    }

    unlisted = sorted(modules - KERNEL_MODULES - slices)

    assert unlisted == [], "add each new domain slice to the domain-slices contract"
    assert not KERNEL_MODULES & slices
