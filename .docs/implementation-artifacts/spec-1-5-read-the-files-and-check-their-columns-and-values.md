---
title: 'Story 1.5: Read the files and check their columns and values'
type: 'feature'
created: '2026-11-21'
baseline_revision: 'c09081730f0e01be1cf8dfa192e940b6633a29cb'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** There is no way yet to turn an uploaded Locations, Inventory or Transactions export into data the app can trust: nothing reads `.xlsx`/`.csv` files, and nothing stops a file with a missing column or a bad value. A bad export must be stopped with the exact file, row and column (FR-3, FR-4).

**Approach:** Add the shell readers (`swp/app/imports/readers.py`, bytes → `RawSheet` of typed cells, AD-8) and the pure domain check (`swp/domain/import_.py`: header, required columns, value checks, per-file error reports in the `import_invalid` details shape), joined by one app function `check_files` that reads three files, checks each, and raises `DomainError("import_invalid", …)` with every file's report when any file fails. No API endpoint, storage or UI in this story (1.7 and 1.8).

## Boundaries & Constraints

**Always:**
- Pinned deps: `openpyxl==3.1.5`, `defusedxml==0.7.1` added to `backend/pyproject.toml` `dependencies`, `uv.lock` updated with `uv lock --directory backend`. openpyxl uses defusedxml automatically when installed (`openpyxl.xml.DEFUSEDXML is True`).
- `swp.domain` stays pure (stdlib + pydantic); add `openpyxl`, `defusedxml`, `et_xmlfile` to the `domain-pure` forbidden list in `backend/.importlinter`.
- Required columns exactly as FR-3: Locations: Location, Walk Path, Aisle, Level · Inventory: Part, Part Description, Quantity, Location · Transactions: Transaction Type, Part, Location, Transaction Code, Date. Header names match after `strip()` and `casefold()`. Optional known columns (Section, Position, Warehouse in Locations; Warehouse in Inventory and Transactions) are parsed as identifiers when present, blank allowed; any other column is ignored. A duplicated optional column uses its first occurrence.
- Column kinds: identifier = Location, Aisle, Level, Section, Position, Warehouse, Part, Transaction Code; number = Walk Path, Quantity; date = Date; text = Part Description, Transaction Type.
- Row numbers: the header is the first non-blank row and is row 1; a data row's number is its sheet row index minus the header's sheet row index plus 1 (blank rows still count); fully blank rows are skipped.
- Error message is final English copy (AD-11), no date/time of today, row numbers with thousands separators (`f"{row:,}"`), values in curly quotes: value errors `"<file> · row <n> · column <Column>: “<value>” <reason>."`; blank cell `"<file> · row <n> · column <Column> is blank."`; missing column `"<file> is missing the column <Column>. Required: <comma-joined required list>."`; duplicate column `"<file> has the column <Column> more than once."`; no data rows `"<file> has no data rows."`; unreadable `"<file> can't be read as .xlsx or .csv."`. `<Column>` is the canonical name from the required/optional list.
- Every error in every file is checked; a file's report keeps the first 20 errors in row order and `more_count` = the rest. Values of the present required columns are still checked when another required column is missing.
- Reports always come in the order locations, inventory, transactions, one per file.
- Every new test name carries its FR/NFR (`test_fr3_…`, `test_fr4_…`, `test_fr1_…`, `test_nfr…`).

**Never:**
- No endpoint, database table, migration, frontend change or Playwright test (no user-visible change; existing e2e must stay green).
- No location-reference checks, Warehouse-count check, inventory merging, Transaction Type name matching or data-as-of (Story 1.6).
- Never read `data/private/`; never edit `data/sample/` or `data/answer-key/`.
- No pandas, no new dependency beyond the two pinned above.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sample files | `data/sample/*.xlsx` via `check_files` | three passing reports, rows returned (2,000 / 1,625 / 20,000) | none |
| Answer-key CSVs | `data/answer-key/*.csv` via `check_files` | three passing reports | none |
| xlsx float | cell `2.5` (float) | `Decimal("2.5")`; integral float `3.0` as identifier → `"3"` | — |
| CSV BOM / `;` | `﻿Location;Walk Path;…` | BOM stripped, delimiter `;` | — |
| CSV not UTF-8 | cp1252 bytes `\xe6` | failed report | unreadable message naming the file |
| Wrong extension / corrupt xlsx | `Inventory.pdf`, random bytes as `.xlsx` | failed report | unreadable message |
| xlsx > 50 MB unpacked | zip entries' `file_size` sum > 50,000,000 | failed report, workbook never opened | unreadable message |
| Too many rows | more than `MAX_ROWS_PER_FILE + 1` non-blank rows | reading stops | `DomainError("limit_reached", "<file> has more than 25,000 rows. One file can hold at most 25,000.")` (number from the setting, with separators) |
| Wide / long cell | 105 columns; 1,500-char text | columns after 100 dropped; text cut to 1,000 chars | — |
| Missing / duplicate column | Inventory without Quantity; Locations with two `location ` headers | file failed | missing / duplicate message, `row: null`, `column` set |
| Blank required cell | Part `"  "` or `None` | error | blank message |
| Quantity | `"abc"`, `-1`, `"1,234.5"`, `"1 234"` | errors: `is not a number`, `is negative`, `uses a thousands separator` (both) | — |
| Numbers OK | `"2,5"`, `"-3"`, `"10"`, `Decimal("2.5")` | `Decimal("2.5")`, `-3` (Walk Path only; Quantity rejects negative), `10` | — |
| Walk Path | `"ten"` | error `is not a number` | — |
| Date | `datetime` cell, `"2026-09-30 13:00"`, `"30.09.2026"`, `"2026-09-30T13:00+02:00"` | `date(2026,9,30)` each | — |
| Bad date | `"09/30/2026"`, `"2026-13-02"`, `45000` | error `is not a valid date` | — |
| Identifier | `Decimal("1.5")` / `datetime` in Part | error `is not a whole number` / `is not a valid code` | — |
| Duplicate location | `A-01-01-01` in rows 2 and 5 | error on row 5: `appears more than once in the Locations file (first in row 2)` | — |
| Empty file | no non-blank row; header only | failed | `has no data rows.` |
| One file fails | inventory bad, others good | `DomainError("import_invalid", "Import stopped: nothing was saved.", details)` with 3 reports: passed, failed, passed | — |
| >20 errors | 25 blank Parts | 20 errors, `more_count: 5` | — |

</intent-contract>

## Code Map

- `backend/pyproject.toml`, `backend/uv.lock` -- add the two pinned deps; PyPI resolves `et-xmlfile==2.0.0` transitively.
- `backend/.importlinter` -- `domain-pure` contract lists every third-party top-level module; add the three new ones (comment there says so).
- `backend/swp/config.py` -- `Settings` (pydantic-settings, `extra="ignore"`); add `max_upload_bytes: int = 4_000_000` and `max_rows_per_file: int = 25_000` (env `MAX_UPLOAD_BYTES`, `MAX_ROWS_PER_FILE`, AD-12). `get_settings()` is `lru_cache`d; tests clear it via `tests/conftest.py::_clear_caches`.
- `backend/swp/domain/ruff.toml` -- domain bans `date.today`, `datetime.now`; the domain must not use them.
- `backend/swp/domain/__init__.py` -- only a docstring; no existing kernel modules (`errors.py` does not exist yet).
- `backend/tests/rules/test_layer_rules.py` -- AST scan: domain files may import only stdlib, pydantic and `swp.domain.*`; keep it green.
- `backend/tests/conftest.py` -- `_clear_caches()`; use `monkeypatch.setenv("MAX_ROWS_PER_FILE", "3")` + `_clear_caches()` for the limit test.
- `backend/tests/app/conftest.py` -- `app_database` fixture only needed for DB tests; reader tests do not use it.
- `data/sample/{Locations,Inventory,transactions}.xlsx` -- columns in `data/README.md`; Location codes like `A-01-02-03`, Date as datetime cells.
- `data/answer-key/{Locations,Inventory,transactions}.csv` -- UTF-8, comma; Part `0100`, `1008614-00`; Date `2025-09-30 09:00`; Issue Part lines at `FLSKRS`.
- openpyxl read-only fact to verify while implementing: `ws.iter_rows(values_only=True)` in read-only mode may skip leading empty rows or pad; RawSheet row index must equal sheet row − 1, so use each row's real index (e.g. iterate `ws.iter_rows()` without `values_only` and read `row[0].row`, or pad gaps) — test it with a workbook whose header is on row 3.

## Tasks & Acceptance

**Execution:**
- `backend/pyproject.toml`, `backend/uv.lock`, `backend/.importlinter` -- add deps, relock, extend `domain-pure`.
- `backend/swp/config.py` -- the two limit settings.
- `backend/swp/app/limits.py` -- `max_rows_per_file() -> int` and `max_upload_bytes() -> int` reading `get_settings()` (the single place `swp.app` takes limits from).
- `backend/swp/domain/errors.py` -- kernel `DomainError(Exception)` with `code: str`, `message: str`, `details: list[dict[str, object]]` (default empty); `str(err)` is the message.
- `backend/swp/domain/import_.py` -- `Cell` type alias; `FileRole = Literal["locations", "inventory", "transactions"]`; frozen dataclass `RawSheet(rows: tuple[tuple[Cell, ...], ...])` (row i = sheet row i+1); pydantic `CellError(row: int | None, column: str | None, message: str)` and `FileCheck(file_role, file_name, status: Literal["passed","failed","not_checked"], errors: list[CellError], more_count: int)`; frozen dataclasses `CheckedRow(row: int, values: Mapping[str, str | Decimal | date | None])` keyed by canonical column name, and `CheckedFile(check: FileCheck, rows: tuple[CheckedRow, ...])` (rows empty when failed); `REQUIRED_COLUMNS: Mapping[FileRole, tuple[str, ...]]`; `check_file(role, file_name, sheet) -> CheckedFile`; `unreadable_file(role, file_name) -> CheckedFile`; `check_import(files: Sequence[CheckedFile]) -> tuple[CheckedFile, CheckedFile, CheckedFile]` ordering by role and raising `DomainError("import_invalid", "Import stopped: nothing was saved.", [f.check.model_dump(mode="json") ...])` if any status is not `passed`. `not_checked` is part of the details contract and is first produced by Story 1.6. Parsed values: identifier → trimmed text, integral number → integer text without `.0`; number → `Decimal` (comma decimal becomes `.`); date → `date`; text → trimmed text (a numeric cell becomes its text).
- `backend/swp/app/imports/__init__.py` -- `UploadedFile` (frozen dataclass `file_name: str`, `data: bytes`) and `check_files(files: Mapping[FileRole, UploadedFile]) -> tuple[CheckedFile, CheckedFile, CheckedFile]`: reads each with `max_rows_per_file()`, turns `UnreadableFile` into `unreadable_file(...)`, lets `limit_reached` propagate, then `check_import`.
- `backend/swp/app/imports/readers.py` -- `class UnreadableFile(Exception)`; `read_sheet(file_name, data, *, max_rows) -> RawSheet` dispatching on the lower-cased extension (`.xlsx`, `.csv`, else `UnreadableFile`). xlsx: zip size pre-check (50,000,000), `load_workbook(BytesIO, read_only=True, data_only=True)`, first worksheet, workbook closed in `finally`, any openpyxl/zip exception → `UnreadableFile`. csv: `data.decode("utf-8-sig")` strict, delimiter from the first non-blank line, `csv.reader`, `""` → `None`. Both: first 100 columns, trailing `None`s trimmed, text cut to 1,000 chars, float → `Decimal(repr(f))`, bool → `"TRUE"`/`"FALSE"`, `time` → `isoformat()`, `limit_reached` once non-blank rows exceed `max_rows + 1`.
- `backend/tests/domain/__init__.py`, `backend/tests/domain/test_import_checks.py` -- one test per matrix row on the domain side, small inline `RawSheet` fixtures (`test_fr3_missing_column_names_file_and_column`, `test_fr3_duplicated_required_column_fails`, `test_fr3_header_matches_trimmed_and_ignoring_case`, `test_fr3_header_is_first_non_blank_row`, `test_fr4_blank_required_cell`, `test_fr4_quantity_not_a_number_or_negative`, `test_fr4_thousands_separator_rejected`, `test_fr4_walk_path_not_a_number`, `test_fr4_date_formats`, `test_fr4_unreadable_date`, `test_fr4_non_integral_identifier`, `test_fr4_duplicate_location_code`, `test_fr4_empty_file_rejected`, `test_fr4_reports_every_error_capped_at_20`, `test_fr4_import_invalid_details_for_every_file`, …).
- `backend/tests/app/test_import_readers.py` -- reader matrix rows with workbooks built in memory by openpyxl (write mode) and CSV bytes; `test_nfr…`/`test_fr4_…` names; plus `test_fr1_sample_files_pass_column_and_value_checks` and `test_fr4_answer_key_files_pass_column_and_value_checks` through `check_files`.

**Acceptance Criteria:**
- Given the three files in `data/sample/`, when `check_files` runs, then it returns three `passed` checks with 2,000, 1,625 and 20,000 rows, and no exception.
- Given any one file failing, when `check_files` runs, then `DomainError.code == "import_invalid"` and `details` holds exactly three dicts with keys `file_role, file_name, status, errors, more_count`, each error with `row, column, message`.
- Given `MAX_ROWS_PER_FILE=3` in the environment and a file with 5 data rows, when `check_files` runs, then it raises `DomainError("limit_reached")` whose message names the file and says "more than 3 rows".
- Given the backend, when `npm run lint:py`, `npm run lint:imports` and `npm run test:py` run, then all pass, including the existing layer-rule tests.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 36 findings — high 0, medium 2, low 20, false 14, maybe-false 0
- findings:
  - `[low]` `[reject]` (intent-alignment) Columns after 100 and text after 1,000 characters are cut silently, against the "not silently changing the results" goal — real only for absurd cells; AD-8 and the AC set the cut; a per-cell error adds a branch for a case not met in exports.
  - `[false]` `[reject]` (intent-alignment) Row limit raises request-level `limit_reached` instead of a per-file detail — AD-11/AD-12 make the row limit `limit_reached` 413, not `import_invalid`.
  - `[low]` `[reject]` (intent-alignment) Unreadable, over-size and non-UTF-8 files share one generic message — EXPERIENCE.md gives exactly this copy and it names the file (FR-4); reason-specific copy adds branches.
  - `[low]` `[reject]` (intent-alignment) defusedxml is proven only by the `DEFUSEDXML` flag — that flag is what openpyxl switches its parser on; a hostile-XML test adds little.
  - `[false]` `[reject]` (intent-alignment) `not_checked` is never produced — it is part of the AD-8 details type; Story 1.6's cross-file location check is its first producer.
  - `[false]` `[reject]` (intent-alignment) Warehouse-count rejection missing — Story 1.6 AC owns it (FR-6).
  - `[low]` `[reject]` (intent-alignment) Extra rules (negative Walk Path accepted, bool/time cells as text) — no AC broken and no wrong result named.
  - `[false]` `[reject]` (intent-alignment) App tests use repo data files instead of small fixtures — the domain tests use inline fixtures as the AC asks; `data/sample` and `data/answer-key` are synthetic by policy (NFR-4).
  - `[low]` `[patch]` (verification-gap) `data_only=True` untested: no formula cell anywhere — patched: `test_fr4_xlsx_formula_cells_read_as_cached_values` hand-writes `<f>1+1</f><v>2</v>` and asserts `2`.
  - `[low]` `[patch]` (blind) `MAX_ROWS_PER_FILE`/`MAX_UPLOAD_BYTES` accept 0 or negative; `max_upload_bytes` unused — patched: both `PositiveInt`, `test_nfr_max_rows_per_file_must_be_positive`; the unused accessor is the AD-12 single source Story 1.7 calls.
  - `[medium]` `[patch]` (blind) Blank rows never count toward the limit; a tiny xlsx with a far row index makes openpyxl pad millions of rows — patched: `_collect` also counts scanned rows and raises `limit_reached` past `max_rows + 1 + MAX_BLANK_ROWS` (10,000); `test_nfr_xlsx_with_far_away_row_stops_quickly` uses `r="2000000000"`.
  - `[low]` `[reject]` (blind) Cells cut short silently; a required column after column 100 reported as missing — same root cause as the intent-alignment cut row; rejected for the same reason.
  - `[low]` `[reject]` (blind) Formula cells without a cached result read as blank — exports from the main system hold values; detecting uncached formulas needs a second, non-data-only parse.
  - `[false]` `[reject]` (blind) Leading zeros lost when an xlsx stores an identifier as a number — AD-8 states this explicitly ("leading zeros already lost in a numeric .xlsx cell can't be recovered").
  - `[low]` `[reject]` (blind) Missing role in `check_files` raises `KeyError` — the parameter is typed `Mapping[FileRole, …]` and the only caller (1.7 multipart) always passes three; guard adds a branch.
  - `[false]` `[reject]` (blind) Duplicate locations compared case-sensitively — FR-6 keeps codes exactly as in the file; `A-01` and `a-01` are different codes by design.
  - `[low]` `[reject]` (blind) Naive delimiter guess (quoted `;` in header, tab files) — AD-8 fixes the rule as "more frequent of `,`/`;` in the header row"; FR-1 accepts only `,`/`;`; quoted delimiters in headers are rare.
  - `[false]` `[reject]` (blind) Dotted dates need two-digit day/month — AD-8 allows only `DD.MM.YYYY` and rejects other formats as ambiguous.
  - `[false]` `[reject]` (blind) Hidden first sheet still read — AD-8 and the AC say "first worksheet only".
  - `[low]` `[reject]` (blind) `except Exception` also turns `MemoryError` into "unreadable" — unlikely on a 4 MB upload capped at 50 MB unpacked; fix adds a branch.
  - `[low]` `[reject]` (blind) Test/type cleanup (manual delenv, `details` typing, `.XLSX` and whitespace-row tests) — cosmetic; the extension is lower-cased in `read_sheet` and whitespace rows are covered by `test_fr4_empty_file_rejected`.
  - `[medium]` `[patch]` (edge-case) Huge row index DoS — same root cause as the blind blank-row row; same patch.
  - `[low]` `[reject]` (edge-case) Identifier over 1,000 characters truncated — same root cause as the intent-alignment cut row.
  - `[false]` `[reject]` (edge-case) First worksheet hidden — same as the blind hidden-sheet row.
  - `[low]` `[reject]` (edge-case) Uncached formula cells read as blank — same as the blind formula row.
  - `[low]` `[reject]` (edge-case) Excel error strings like `#N/A` accepted as codes — `data_only` gives the text; an unknown Location is caught by Story 1.6's reference check; not met in system exports; fix adds a branch.
  - `[false]` `[reject]` (edge-case) `"1,234"` becomes 1.234 instead of 1234 — AD-8 accepts `,` as the decimal mark and only this reading; changing it edits the spec.
  - `[low]` `[reject]` (edge-case) Impossible time suffix `99:99` accepted — AD-8 discards the time; the date is still valid; fix adds validation for a value that is thrown away.
  - `[false]` `[reject]` (edge-case) Single-digit day/month dates rejected — same as the blind dotted-date row; AD-8 allows only `YYYY-MM-DD` and `DD.MM.YYYY`.
  - `[false]` `[reject]` (edge-case) Header-relative row numbers differ from sheet rows — the AC defines "spreadsheet rows with the header as row 1".
  - `[low]` `[patch]` (edge-case) Limits accept 0/negative — same root cause as the blind settings row; same patch.
  - `[low]` `[reject]` (edge-case) Missing role `KeyError` — same as the blind row.
  - `[false]` `[reject]` (edge-case) No upload-size guard in `check_files` — `MAX_UPLOAD_BYTES` is checked per request in Story 1.7 (`POST /api/plans`), not per file; the 1.5 AC does not include it.
  - `[low]` `[reject]` (edge-case) Equal `;`/`,` counts or tab-delimited CSV — same as the blind delimiter row.
  - `[low]` `[reject]` (edge-case) CSV field over 131,072 characters reported as unreadable — no real export has such a cell; the message still names the file.
  - `[false]` `[reject]` (intent-alignment) Reading B: no planner-facing HTTP surface — Stories 1.7/1.8 own the endpoint and UI per the epics file.

## Design Notes

- Readers raise `UnreadableFile` instead of returning a report so the shell knows nothing of the details shape; the domain owns `FileCheck` and the copy. `limit_reached` is a request-level error (413 in 1.7), not a per-file detail, so it is raised, not reported.
- Parsing to typed values happens here because the value check and the conversion are the same code; Story 1.6 adds location, warehouse and merge rules on `CheckedFile.rows`.
- Thousands-separator detection: text matching `^-?\d{1,3}([ ,. ']\d{3})+([.,]\d+)?$` that is not a plain number (`^-?\d+([.,]\d+)?$`) gets `uses a thousands separator`; so `"1,234"` stays the decimal 1.234 (comma is a decimal mark, AD-8) while `"1,234.5"`, `"1.234,5"` and `"1 234"` are rejected.

## Verification

**Commands:**
- `uv lock --directory backend && uv sync --directory backend --locked` -- exit 0.
- `npm run lint:py` -- exit 0.
- `npm run lint:imports` -- all contracts kept.
- `npm run test:py` -- all pass (existing + new).
- `CI=true npm run e2e -- --project=chromium` -- existing specs still pass.

## Auto Run Result

Status: done

**Summary:** The import can now read and check the three exports. `swp/app/imports/readers.py` turns `.xlsx` (openpyxl read-only + defusedxml, first sheet, 50 MB unpacked pre-check, 100 columns, 1,000 characters, `Decimal(repr(f))`) and UTF-8 `.csv` (BOM stripped, `,`/`;` from the header line) into a `RawSheet`; `swp/domain/import_.py` finds the header, checks required columns (missing or duplicated) and every value (blank, number, negative Quantity, thousands separators, dates, non-integral identifiers, duplicate location codes, empty file) and builds the `import_invalid` details per file (max 20 errors + `more_count`); `swp/app/imports.check_files` joins them and raises `DomainError("import_invalid")` with all three reports, or `limit_reached` for a file over `MAX_ROWS_PER_FILE`.

**Files changed:**
- `backend/pyproject.toml`, `backend/uv.lock` -- `openpyxl==3.1.5`, `defusedxml==0.7.1` (+ `et-xmlfile==2.0.0`).
- `backend/.importlinter` -- domain-pure forbids `openpyxl`, `defusedxml`, `et_xmlfile`.
- `backend/swp/config.py` -- `max_upload_bytes`, `max_rows_per_file` (`PositiveInt`).
- `backend/swp/app/limits.py` -- limit accessors.
- `backend/swp/domain/errors.py` -- kernel `DomainError`.
- `backend/swp/domain/import_.py` -- header, column and value checks; details models.
- `backend/swp/app/imports/__init__.py`, `backend/swp/app/imports/readers.py` -- `check_files`, readers.
- `backend/tests/domain/test_import_checks.py`, `backend/tests/app/test_import_readers.py`, `backend/tests/test_config.py` -- FR-1/FR-3/FR-4/NFR tests.

**Review:** 36 findings (high 0, medium 2, low 20, false 14, maybe-false 0). Patched: far-away-row DoS (scan cap `MAX_BLANK_ROWS`), formula cached-value test, positive limit settings. Deferred: none. Rejected, with reasons in the Review Triage Log: silent column/character cut, generic unreadable copy, defusedxml flag test, `not_checked` unused, warehouse check (1.6), extra value rules, repo data in app tests, uncached formulas, leading zeros in numeric xlsx cells, missing-role `KeyError`, case-sensitive codes, delimiter guess, single-digit dotted dates, hidden first sheet, broad `except`, test cleanup, Excel error strings, `"1,234"` as decimal, impossible time suffix, header-relative row numbers, upload-size guard (1.7), long CSV fields, no HTTP surface (1.7/1.8).

**Follow-up review recommendation:** false -- one medium entry patched (patched counts: high 0, medium 1, low 2).

**Verification (after patches):** `uv lock --directory backend --check` and `uv sync --directory backend --locked` exit 0; `npm run lint:py` all checks passed; `npm run lint:imports` 4 kept, 0 broken; `npm run test:py` 102 passed; `CI=true npm run e2e -- --project=chromium` 10 passed. `tests/app` was run on SQLite only here; the Postgres 17 run happens in CI.

**Residual risks:** a file with more than 10,000 blank rows in total gets the "more than N rows" message even when its data rows are under the limit. Formula cells saved without cached values read as blank. Text cells over 1,000 characters and columns after 100 are cut without an error.
