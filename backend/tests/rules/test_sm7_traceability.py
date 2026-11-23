"""SM-7: every core FR is named by at least one test (scripts/traceability.py)."""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts" / "traceability.py"


@pytest.fixture(scope="module")
def trace() -> ModuleType:
    spec = importlib.util.spec_from_file_location("traceability", SCRIPT)
    assert spec and spec.loader, SCRIPT
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_sm7_every_core_fr_has_a_test(
    trace: ModuleType, capsys: pytest.CaptureFixture[str]
) -> None:
    exit_code = trace.main([])

    out, err = capsys.readouterr()
    assert exit_code == 0, err
    for fr in trace.CORE_FRS:
        assert f"{fr:<7} no test" not in out, fr
    assert "NFR-8   no test" not in out
    assert "\nNFR-8 " in out


@pytest.mark.parametrize(
    ("name", "ids"),
    [
        ("test_fr51_fr34_swap_combines", ["FR-51", "FR-34"]),
        ("test_fr1_upload", ["FR-1"]),
        ("test_fr10_saving", ["FR-10"]),
        ("test_nfr8_import_under_10_s", ["NFR-8"]),
        ("test_ad18_nfr8_max_size_plan_views_under_4_mb", ["NFR-8"]),
        ("uj1 fr50 demo login", ["FR-50"]),
        ("test_fr21_fr21_twice", ["FR-21"]),
        ("uxdr47_preview_texts", []),
        ("test_pfr1_not_an_id_fr", []),
    ],
)
def test_sm7_id_tokens_match_exactly(trace: ModuleType, name: str, ids: list[str]) -> None:
    assert trace.ids_in(name) == ids


def test_sm7_fails_and_names_uncovered_frs(
    trace: ModuleType, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    covered = [fr for fr in trace.CORE_FRS if fr not in {"FR-10", "FR-42"}]
    tests = tmp_path / "backend" / "tests"
    tests.mkdir(parents=True)
    body = "".join(f"def test_{fr.lower().replace('-', '')}_x() -> None: ...\n" for fr in covered)
    (tests / "test_some.py").write_text(body + "def test_fr1_fr100_nfr10_x() -> None: ...\n")
    e2e = tmp_path / "frontend" / "e2e"
    e2e.mkdir(parents=True)
    (e2e / "a.spec.ts").write_text('test("uj1 nfr3 no ai", async () => {});\n')

    exit_code = trace.main(["--root", str(tmp_path)])

    out, err = capsys.readouterr()
    assert exit_code == 1
    assert "FR-10, FR-42" in err
    assert "NFR-3      1 test(s)" in out
    assert "NFR-4   no test" in out
    assert "NFR-10     1 test(s)" in out
    assert "FR-100" not in out
