"""SM-7 traceability: map every core FR and every NFR to the test names that carry its ID.

Scans pytest (`def test_...` in backend/tests), Vitest (frontend/tests/**/*.test.ts(x)) and
Playwright (frontend/e2e/**/*.spec.ts) for test names, reads the FR/NFR IDs in each name
(`test_fr51_fr34_...`, `it("fr21_...")`, `test("uj1 fr50 ...")`), prints one table for the
core FRs, one for the stage 2 FRs and one for the NFRs, and exits 1 when a core FR has no
test. A stage 2 FR or an NFR without a test is reported but does not fail the check.

Run from the repo root: `npm run trace` (stdlib only).
"""

from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
# Core FRs: epics.md Story 12.5 AC (FR-1–FR-40, FR-42, FR-50, FR-51); NFRs: PRD NFR-1–NFR-12.
CORE_FRS = [*(f"FR-{n}" for n in range(1, 41)), "FR-42", "FR-50", "FR-51"]
# Stage 2 (spine: concurrent-edit warning FR-41, category check and labels FR-43–FR-48):
# listed, never a failure.
STAGE2_FRS = ["FR-41", *(f"FR-{n}" for n in range(43, 49))]
NFRS = [f"NFR-{n}" for n in range(1, 13)]

# An ID token: `fr`/`nfr` + digits, not preceded by a letter (so `nfr8` is never `fr8`) and
# not followed by a digit (so `fr1` is never `fr10`).
ID_TOKEN = re.compile(r"(?<![a-z])(n?fr)(\d+)(?!\d)")
PYTEST_NAME = re.compile(r"^\s*(?:async\s+)?def\s+(test_\w+)\s*\(", re.MULTILINE)
# First string argument of it(/test(/describe(/test.describe( (any quote style).
JS_NAME = re.compile(
    r"(?<![\w.])(?:it|test|describe|test\.describe)\s*\(\s*(?P<q>[\"'`])(?P<name>.*?)(?P=q)",
    re.DOTALL,
)


def ids_in(name: str) -> list[str]:
    """The FR/NFR IDs in one test name, each once, in order (`FR-1`, `NFR-8`)."""
    found: list[str] = []
    for prefix, number in ID_TOKEN.findall(name.lower()):
        test_id = f"{prefix.upper()}-{int(number)}"
        if test_id not in found:
            found.append(test_id)
    return found


def _files(root: Path, base: str, patterns: Iterable[str]) -> list[Path]:
    folder = root / base
    if not folder.is_dir():
        return []
    found = {path for pattern in patterns for path in folder.rglob(pattern)}
    return sorted(path for path in found if "node_modules" not in path.parts)


def collect(root: Path) -> list[tuple[str, str]]:
    """Every (file, test name) in the repo's three test suites."""
    names: list[tuple[str, str]] = []
    for path in _files(root, "backend/tests", ["*.py"]):
        text = path.read_text(encoding="utf-8")
        names += [(path.relative_to(root).as_posix(), n) for n in PYTEST_NAME.findall(text)]
    js = _files(root, "frontend/tests", ["*.test.ts", "*.test.tsx"])
    js += _files(root, "frontend/e2e", ["*.spec.ts"])
    for path in js:
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(root).as_posix()
        names += [(rel, match["name"]) for match in JS_NAME.finditer(text)]
    return names


def trace(names: Iterable[tuple[str, str]]) -> dict[str, list[str]]:
    """Test names per ID (`file::name`), for every ID found."""
    by_id: dict[str, list[str]] = {}
    for file, name in names:
        for test_id in ids_in(name):
            by_id.setdefault(test_id, []).append(f"{file}::{name}")
    return by_id


def _table(title: str, ids: Sequence[str], by_id: dict[str, list[str]]) -> list[str]:
    lines = [title, "-" * len(title)]
    for test_id in ids:
        tests = by_id.get(test_id, [])
        lines.append(f"{test_id:<7} {len(tests):>4} test(s)" if tests else f"{test_id:<7} no test")
        lines += [f"          {test}" for test in tests]
    return [*lines, ""]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="repo root to scan")
    parser.add_argument("--summary", action="store_true", help="counts only, no test names")
    args = parser.parse_args(argv)

    by_id = trace(collect(args.root))
    lines = (
        _table("Core FRs (SM-7)", CORE_FRS, by_id)
        + _table("Stage 2 FRs", STAGE2_FRS, by_id)
        + _table("NFRs", NFRS, by_id)
    )
    if args.summary:
        lines = [line for line in lines if not line.startswith("          ")]
    print("\n".join(lines))

    missing = [fr for fr in CORE_FRS if fr not in by_id]
    no_nfr = [nfr for nfr in NFRS if nfr not in by_id]
    if no_nfr:
        print(f"NFRs without a test (reported, not a failure): {', '.join(no_nfr)}")
    if missing:
        print(f"FAIL: core FRs without a test: {', '.join(missing)}", file=sys.stderr)
        return 1
    print(f"OK: all {len(CORE_FRS)} core FRs have at least one test.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
