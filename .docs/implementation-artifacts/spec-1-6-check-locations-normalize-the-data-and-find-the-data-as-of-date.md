---
title: 'Story 1.6: Check locations, normalize the data and find the data-as-of date'
type: 'feature'
created: '2026-11-21'
baseline_revision: 'dda83f143fc19fa4ad91cfd8d3413e10fba5ddb0'
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

**Problem:** After Story 1.5 the import checks columns and values per file, but nothing checks that inventory rows and shelf lines point to a real location, that the import holds one warehouse, or turns the three checked files into the normalized import (merged inventory, parts, reduced transactions, data-as-of) that Story 1.7 stores (FR-5, FR-6, FR-7, AD-4, AD-8).

**Approach:** Extend `swp.domain.import_.check_import` with the cross-file checks (Warehouse within/across files, location references, `not_checked`), add a pure `normalize_import` that builds a pydantic `NormalizedImport` (`data_as_of` + `data`), add the kernel `swp/domain/values.py` (`Dec`), and an app entry `read_import` = `check_files` + `normalize_import`. No endpoint, storage or UI (Stories 1.7/1.8).

## Boundaries & Constraints

**Always:**
- Cross-file checks run inside `check_import` after the per-file checks, and every error in every file is still reported in one `import_invalid` (max 20 per file + `more_count`, errors in the order: warehouse errors, then row errors in row order).
- Transaction Type matches `Move to Repair`, `Issue Part`, `Return to Stock`, `Receipt` after trim and `casefold()`. Shelf lines = Move to Repair, Return to Stock, Receipt: their Location must be a code in the Locations file. Issue Part lines are accepted at any location. Other types are accepted, never location-checked, and left out of the reduced transactions.
- Every Inventory row's Location must be a code in the Locations file. Codes compare as exact text (case-sensitive, as normalized in 1.5).
- Unknown-location copy (EXPERIENCE.md): `"<file> · row <n> · column Location: “<code>” is not in the Locations file."`, `row` = row number, `column` = `"Location"`.
- Warehouse: distinct non-blank values per file in file order. More than one in a file → that file fails: `"<file> holds more than one warehouse. One import holds one warehouse."` (row `null`, column `"Warehouse"`). Across files: the first file in role order with exactly one value is the reference; a later file whose single value differs fails: `"<file> holds a different warehouse than <reference file>. One import holds one warehouse."`. A file without a Warehouse column or with only blanks has no value and never fails this check.
- Location references are checked only when the Locations file passed its per-file checks; otherwise an Inventory/Transactions file that passed its own checks and has no warehouse error gets status `not_checked` (empty errors).
- `NormalizedImport` (pydantic): `data_as_of: date`, `data: ImportData`. `ImportData`: `schema_version: int = 1`; `locations: dict[str, LocationData]` keyed by code in file order, `LocationData(walk_path: Dec, aisle: str, level: str, section: str | None, position: str | None)`; `inventory: list[InventoryLine(part, location, quantity: Dec)]` merged by `(part, location)` in first-occurrence order with quantities added, zero-stock rows kept; `parts: dict[str, str]` part → first non-blank Part Description in Inventory file order; `transactions: list[TransactionLine(type, part, transaction_code, date)]` for the four known types only, file order, `type` one of `move_to_repair | issue_part | return_to_stock | receipt`.
- `data_as_of` = the newest Date over every data row of the Transactions file, all types included (unknown types too).
- `Dec` = `Annotated[Decimal, …]` serializing in JSON mode as a normalized plain string (`Decimal("5.00")` → `"5"`, `Decimal("2.50")` → `"2.5"`, `Decimal("100")` → `"100"`, `-0` → `"0"`); validating from str/int/Decimal.
- Every new test name carries its FR (`test_fr5_…`, `test_fr6_…`, `test_fr7_…`).

**Never:**
- No endpoint, table, migration, frontend change or Playwright test (no user-visible change; existing e2e stays green).
- No new dependency. `swp.domain` stays stdlib + pydantic.
- Never read `data/private/`; never edit `data/sample/` or `data/answer-key/`.
- Do not change the 1.5 per-file check behaviour or copy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Answer key | `data/answer-key/*.csv` via `read_import` | `data_as_of == date(2026, 9, 30)`; 39 locations; inventory row for 9300 at `B-01-03-02` merged to quantity `"5"`; `A-01-01-03` row for `1008614-00` kept with `"0"`; parts keys include `0100`, `1008614-00` | none |
| Sample | `data/sample/*.xlsx` via `read_import` | passes; 2,000 locations; `data_as_of` 2026-09-30 | none |
| Unknown inventory location | Inventory row 3 at `K-01` | inventory failed | `Inventory.xlsx · row 3 · column Location: “K-01” is not in the Locations file.` |
| Unknown shelf line | `move to REPAIR` / `Return to Stock` / `Receipt` at `K-01` | transactions failed, one error per line | same copy with the transactions file name |
| Issue Part at virtual | `Issue Part` at `FLSKRS` | accepted, kept as `issue_part` | — |
| Other type | `Count` at `ZZZ` | accepted, not in `transactions`, its Date still counts for `data_as_of` | — |
| Locations failed | Locations has a blank Walk Path; others fine | details `failed`, `not_checked`, `not_checked` | `import_invalid` |
| Two warehouses in a file | Locations Warehouse `NO`, `SE` | locations failed | within-file copy |
| Different across files | Locations `NO`, Inventory `SE`, Transactions `NO` | inventory failed | `Inventory.xlsx holds a different warehouse than Locations.xlsx. …` |
| No Warehouse column | Inventory without it | no warehouse error | — |
| NBSP / case | Part `" Ab-01 "`, description `" Brake Pad "` | `"Ab-01"`, `"Brake Pad"` | — |
| Duplicate part+location | `P1@A-01` 2 and 3; `P2@A-01` 0 | `P1@A-01` `"5"` at first position; `P2` `"0"` kept | — |
| Description order | P1 rows `"Bolt"` then `"Screw"` | `parts["P1"] == "Bolt"` | — |
| Dec JSON | `Decimal("2.50")`, `Decimal("5.00")`, `Decimal("-0")` | `"2.5"`, `"5"`, `"0"` | — |

</intent-contract>

## Code Map

- `backend/swp/domain/import_.py` -- 1.5 module. `check_file` returns `CheckedFile(check, rows)`; `rows` empty when failed; `CheckedRow.values` keyed by canonical column (`"Warehouse"` key present, `None` when absent/blank). `_failed(role, name, errors)` builds a capped failed report — reuse it. `check_import(files)` orders by role and raises `import_invalid` — extend it here. `IMPORT_STOPPED`, `ROLES` reuse.
- `backend/swp/domain/errors.py` -- `DomainError(code, message, details)`.
- `backend/swp/domain/` -- no `values.py` yet; architecture lists it as kernel (`Dec`, AD-9 "normalized plain string").
- `backend/swp/app/imports/__init__.py` -- `UploadedFile`, `check_files(files) -> tuple[CheckedFile×3]`; add `read_import`.
- `backend/tests/domain/test_import_checks.py` -- helpers `_locations/_inventory/_transactions` with inline `RawSheet`; existing `check_import` tests use location `A-01`, inventory at `A-01`, Issue Part at `FLSKRS` — still pass with the new checks.
- `backend/tests/app/test_import_readers.py` -- `_data_files(folder, ext)`, `_good_files()`; CSV fixtures already consistent (`A-01`, `FLSKRS`).
- `data/answer-key/README.md` -- 9300 duplicate rows merged to 5 at `B-01-03-02`; `A-01-01-03` zero-stock row; newest date 2026-09-30; `expected.json` has `data_as_of` and `merged_inventory` = `[{"part": "9300", "location": "B-01-03-02", "quantity": 5}]` (the merged rows only).
- `data/README.md` -- sample: one warehouse `NO`; shelf lines (Move to Repair, Return to Stock, Receipt) at shelf codes, Issue Part at `FLSKRS`. If the sample fails the reference check, report it as a finding; never change the rule or the data.
- `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- domain purity; `values.py` imports only `decimal`, `typing`, `pydantic`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/values.py` -- `Dec` type and a `dec_text(Decimal) -> str` helper (normalized plain string).
- `backend/swp/domain/import_.py` -- `TRANSACTION_TYPES` mapping casefolded name → `TransactionType` literal; `SHELF_TYPES`; extend `check_import` with warehouse and location-reference checks and `not_checked`; add models `LocationData`, `InventoryLine`, `TransactionLine`, `ImportData`, `NormalizedImport` and `normalize_import(files: tuple[CheckedFile, CheckedFile, CheckedFile]) -> NormalizedImport` (expects passed files, ordered by role).
- `backend/swp/app/imports/__init__.py` -- `read_import(files) -> NormalizedImport` = `normalize_import(check_files(files))`.
- `backend/tests/domain/test_import_normalize.py` -- one test per matrix row on inline sheets (`test_fr5_unknown_inventory_location_names_file_row_location`, `test_fr5_shelf_lines_checked_ignoring_case`, `test_fr5_issue_part_at_virtual_location_accepted`, `test_fr5_other_types_accepted_and_ignored`, `test_fr5_locations_failed_marks_others_not_checked`, `test_fr6_more_than_one_warehouse_in_a_file`, `test_fr6_different_warehouse_across_files`, `test_fr6_missing_warehouse_column_ok`, `test_fr6_text_trimmed_including_nbsp_keeps_case`, `test_fr6_codes_kept_as_exact_text`, `test_fr6_duplicate_inventory_rows_merged_zero_kept`, `test_fr6_parts_take_first_description`, `test_fr7_data_as_of_is_newest_date_over_every_row`, `test_fr6_dec_serializes_normalized`, plus a test that `model_dump(mode="json")` has keys `schema_version, locations, inventory, parts, transactions`).
- `backend/tests/app/test_import_readers.py` (or new `backend/tests/app/test_read_import.py`) -- `test_fr7_answer_key_data_as_of_and_merged_inventory` (reads `data/answer-key/expected.json`) and `test_fr1_sample_files_normalize`.

**Acceptance Criteria:**
- Given the answer-key files, when `read_import` runs, then `data_as_of` equals `expected.json` `data_as_of` (2026-09-30) and every `merged_inventory` entry appears once in `inventory` with that quantity.
- Given the three sample files, when `read_import` runs, then no exception is raised and `data.locations` has 2,000 entries.
- Given any cross-file failure, when `check_import` runs, then `DomainError("import_invalid")` carries three details in role order with statuses from `passed | failed | not_checked`.
- Given the backend, when `npm run lint:py`, `npm run lint:imports` and `npm run test:py` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 28 findings — high 0, medium 0, low 16, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` (edge-case) Locations that fails the warehouse check is still used for location references — the spec says references are checked when Locations passed its per-file checks; its codes are valid, so more errors are reported, not wrong ones.
  - `[false]` `[reject]` (edge-case) A file that failed the warehouse check is used as the reference — a file with two values never sets the reference (`len(values) > 1` branch), and a file that differs never replaces it.
  - `[low]` `[reject]` (edge-case) Warehouse `NO` vs `no` counted as two warehouses — the spec compares identifiers as exact text (FR-6); the three exports come from one system.
  - `[low]` `[reject]` (edge-case) Transaction Type with inner double space is ignored — not met in system exports; the matching rule (trim + casefold, AD-8) is the spec's.
  - `[false]` `[reject]` (edge-case) `normalize_import` on failed files hits `max()` of an empty sequence — its only callers pass `check_import`'s result, which raises before; a loud failure on an unreachable input is correct.
  - `[low]` `[reject]` (edge-case) Decimals over 28 significant digits rounded by `normalize()` — no export has such quantities; fix adds context handling.
  - `[false]` `[reject]` (edge-case) NaN/Infinity reach `dec_text` — `_parse_number` rejects non-finite values in 1.5.
  - `[low]` `[reject]` (edge-case) Summed quantities rounded past 28 digits — at most 25,000 rows of realistic quantities; fix adds context handling.
  - `[false]` `[reject]` (edge-case) NBSP test uses only ASCII spaces — line 209 of `test_import_normalize.py` holds `"\xa0Ab-01 "` and `" Brake Pad\xa0"` (checked with `repr`).
  - `[false]` `[reject]` (verification-gap) NBSP test never uses a non-breaking space — same refutation as above.
  - `[low]` `[patch]` (verification-gap) No test for a warehouse error when Locations failed — added `test_fr6_warehouse_checked_when_locations_failed` (statuses failed / not_checked / failed).
  - `[false]` `[reject]` (intent-alignment) NBSP clause claimed but not exercised — same refutation as above.
  - `[low]` `[reject]` (intent-alignment) Warehouse rejection tested only in the domain, not through `read_import` — `read_import` is a one-line composition of the tested `check_files` and `normalize_import`.
  - `[false]` `[reject]` (intent-alignment) No planner-facing surface — the epics file gives the endpoint and UI to Stories 1.7/1.8.
  - `[low]` `[patch]` (intent-alignment) AC example `06-01-30-D1` not in a test — added to `test_fr6_codes_kept_as_exact_text`.
  - `[false]` `[reject]` (blind) NBSP test doesn't test NBSP or case — NBSP present (see above); `"Ab-01"` keeps its mixed case in the assertion.
  - `[low]` `[reject]` (blind) Typos in Transaction Type drop rows silently — FR-5 says other types are accepted and ignored; spacing part rejected as above.
  - `[false]` `[reject]` (blind) `normalize_import` doesn't validate input — same as the edge-case row; unreachable.
  - `[false]` `[reject]` (blind) asserts vanish under `python -O` — they narrow types guaranteed by `check_file`; no reachable bad value.
  - `[low]` `[reject]` (blind) `Dec` accepts float/NaN on validation — every Dec in this story comes from `_parse_number` (finite Decimal); 1.7 reads only JSON this code writes.
  - `[low]` `[patch]` (blind) Untested warehouse paths (Locations failed; blank-only cells) — same root cause as the verification-gap row; added `test_fr6_warehouse_checked_when_locations_failed` and `test_fr6_blank_warehouse_cells_never_fail`.
  - `[low]` `[reject]` (blind) Warehouse compared by case — same as the edge-case row.
  - `[low]` `[reject]` (blind) 20-error cap untested for new checks — new errors go through 1.5's `_failed`, covered by `test_fr4_reports_every_error_capped_at_20`.
  - `[low]` `[reject]` (blind) No `read_import` failure test — same as the intent-alignment row.
  - `[low]` `[reject]` (blind) `test_read_import.py` imports `_data_files` from another test module — reuse, not duplication; cosmetic.
  - `[low]` `[reject]` (blind) Hard-coded expected values in data tests — `data/sample` and `data/answer-key` are fixed by policy and never edited by hand.
  - `[false]` `[reject]` (blind) Normalized import drops warehouse and transaction location — the spec's design notes keep only what the analysis needs; nothing in Epics 1–2 reads them.
  - `[low]` `[patch]` (blind) Small cleanups — patched `kind not in SHELF_TYPES` and `dec_text` direct return; `codes` built when unused and `schema_version: Literal[1]` rejected (negligible / would block upcasting).

## Design Notes

- Cross checks live in `check_import` so one call reports per-file and cross-file errors together; `normalize_import` only builds from passed files and never raises `import_invalid`.
- The reduced transactions keep only what Epic 2 needs: picks (Move to Repair by part and date) and jobs (Issue Part by transaction code). Location and description are dropped; Return to Stock and Receipt are kept typed so later rules can tell them apart without a schema bump.

## Verification

**Commands:**
- `npm run lint:py` -- exit 0.
- `npm run lint:imports` -- all contracts kept.
- `npm run test:py` -- all pass.
- `CI=true npm run e2e -- --project=chromium` -- existing specs pass.

## Auto Run Result

Status: done

**Summary:** The import now checks locations, holds one warehouse and builds the normalized import. `check_import` adds the cross-file checks (Warehouse within and across files, Inventory rows and shelf lines against the Locations file, Transaction Type matched ignoring case, `not_checked` when Locations failed) and still reports every error in one `import_invalid`. `normalize_import` builds `NormalizedImport` (`data_as_of` = newest Date over every Transactions row; `data` with `schema_version`, locations keyed by code, merged inventory with zero-stock rows, parts with the first description, transactions reduced to type/part/code/date for the four known types). `read_import` joins reading, checking and normalizing. New kernel `domain/values.py` (`Dec`).

**Files changed:**
- `backend/swp/domain/values.py` -- `Dec` and `dec_text` (normalized decimal string).
- `backend/swp/domain/import_.py` -- transaction types, cross-file checks in `check_import`, normalized-import models and `normalize_import`.
- `backend/swp/app/imports/__init__.py` -- `read_import`.
- `backend/tests/domain/test_import_normalize.py` -- FR-5/FR-6/FR-7 domain tests.
- `backend/tests/app/test_read_import.py` -- answer-key (`expected.json`) and sample normalization.

**Review:** 28 findings (high 0, medium 0, low 16, false 12, maybe-false 0). Patched: warehouse-when-Locations-failed and blank-warehouse tests, `06-01-30-D1` example, two small cleanups. Deferred: none. Rejected, with reasons in the Review Triage Log: case-sensitive warehouse, inner-space Transaction Type, >28-digit decimals, unreachable `normalize_import`/NaN/assert paths, NBSP claims (test does use U+00A0), no `read_import` failure test, no planner surface (1.7/1.8), 20-cap reuse, test helper import, hard-coded data values, dropped warehouse/location fields.

**Follow-up review recommendation:** false -- only low entries patched (patched counts: high 0, medium 0, low 4).

**Verification (after patches):** `npm run lint:py` all checks passed; `npm run lint:imports` 4 kept, 0 broken; `npm run test:py` 131 passed; `CI=true npm run e2e -- --project=chromium` 10 passed. `tests/app` ran on SQLite only here; Postgres 17 runs in CI.

**Residual risks:** Warehouse values compare case-sensitively; a Transaction Type with an inner double space is treated as an unknown type and its location is not checked; unknown-location messages show row numbers with thousands separators like the 1.5 messages.
