---
title: 'Import dates outside the allowed range are cell errors'
type: 'bugfix'
created: '2026-11-28'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A transactions file whose newest date is in year 1 makes `period_for` (`backend/swp/domain/analysis.py`) raise `ValueError`, so New Plan answers 500 instead of an import error; a date typed far in the future becomes the data-as-of date and empties the analysis period (Epic 1 retro R2, action item 2).

**Approach:** `_parse_date` (`backend/swp/domain/import_.py`) accepts only dates from 1900-01-01 up to the day after the upload day, as the retro proposed, and reports any other date as a cell error in the existing import-error format. The upload day comes from the caller's `now`; the domain stays pure.

</frozen-after-approval>

## Implementation Notes

- `backend/swp/domain/import_.py`: the old body of `_parse_date` is `_read_date`; `_parse_date(cell, latest_date)` then refuses a date before `EARLIEST_DATE` (1900-01-01) with "is before 1900-01-01" and a date after `latest_date` with "is in the future". `check_file` takes the keyword `latest_date` (default None: no upper limit) and passes it through `_parse`.
- `backend/swp/app/imports/__init__.py`: `check_files` and `read_import` take the keyword `uploaded_on` (the upload day, UTC) and set `latest_date` to the day after it, so a warehouse in a time zone ahead of UTC is not refused. `backend/swp/api/routers/plans.py` passes `now.date()`.
- The bounds follow the retro's proposal ("1900-01-01 up to upload day + 1"). The messages use the existing import-error format, so the New Plan screen needs no change.
- Tests (`test_fr4_…`): the range in the domain (`test_import_checks.py`), the upload day in `check_files` (`test_import_readers.py`), and `POST /api/plans` answering 422 `import_invalid` for a year-1 date and a far-future date, plus the UTC-day wiring (`test_create_plan.py`).
- `ARCHITECTURE-SPINE.md` AD-8 "Dates" and the Story 1.5 criterion in `epics.md` state the range. `sprint-status.yaml`: Epic 1 retro item 2 is `done`.
- Known limits:
  - `uploaded_on` and `latest_date` are optional; only the New Plan route passes a value. A new caller of `read_import` must pass the upload day to get the upper limit.
  - `period_for` still raises for a `period_months` above 22,788 with a date at the lower limit. `period_months` comes from `backend/settings/analysis.toml`, not from a user.
  - A mistyped date up to the day after the upload day still passes and becomes the data-as-of date.
  - Reusing a stored import (FR-2) does not re-check its dates. A year-1 import was never stored (the 500 came before the save); an import with a far-future date stored before this change can still be reused.
- Verification on SQLite: `npm run test:py` 1264 passed, 2 skipped and 1 failed (`test_nfr8_apply_all_on_sample_within_budget`, a timing budget, while the e2e run used the CPU; it passes alone, 5 of 5 in its file) before the review patches; the five import and plan test files 108 passed after them. `npm run lint:py`, `ruff format --check`, `npm run lint:imports` and `npm run trace` are clean; `npm run e2e -- --project=chromium` 152 passed. No frontend source changed.

## Review Triage Log

- The upper limit is opt-in (`None` default) — low, rejected: one production caller, which passes it and is pinned by `test_fr4_upload_day_limit_follows_the_utc_clock`; making it required changes 44 test calls. Recorded as a known limit.
- `period_for` can still raise for a very large `period_months` — low, rejected as a fix: the setting is a developer file, not user input. Recorded as a known limit.
- `test_fr4_earliest_date_passes_and_gives_a_period` asserted a tautology — low, patched: it now asserts the whole period, `(1800-01-02, 1900-01-01)`.
- "is in the future" does not name the limit — low, rejected: the message is true and says what to fix; naming tomorrow's date as the limit would need the UTC explanation on screen.
- The reuse path is not covered — low, rejected as a fix, recorded as a known limit: only a far-future import stored before this change is affected.
- The router wiring was tested only with year 2999 — medium, patched: `test_fr4_upload_day_limit_follows_the_utc_clock` (tomorrow passes, three days ahead is refused). A reader-level `.xlsx` date cell beyond the limit — rejected: the domain test covers `datetime` cells, which is what the reader produces.
- A typo inside the allowed range still becomes data-as-of — low, rejected as a fix (no rule can tell it from a real date), recorded as a known limit.
- Planning documents partly updated — low, patched in part: the AD-8 sentence now states the rule only, and the Story 1.5 criterion names the range. Rejected: the spine's `updated:` frontmatter (not maintained by the earlier edits of 2026-11-26 and 2026-11-28 either) and new examples in `EXPERIENCE.md` (its rows are examples, not a list of every reason).
- Close-out bookkeeping missing — false: the review ran before the spec was finalized. The helper nit — low, patched: `_transactions_dated` sits beside `_good_files` and uses `TX_CSV_HEADER`.
