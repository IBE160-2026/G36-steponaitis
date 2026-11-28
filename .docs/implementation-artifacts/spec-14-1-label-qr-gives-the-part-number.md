---
title: 'Location labels: the QR code gives the part number (change to Story 14.1, FR-48)'
type: 'feature'
created: '2026-11-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ce00ee94a17eeaa9c5e3ee1797417bc2eadc0f00'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A location label's QR code gives the location code. After the hand check on 2026-11-28 (the print scans fine) Justas decided it must give the part number instead: the part the plan puts in that location.

**Approach:** Make the labels plan-scoped. The server lists, per aisle, one label per part stocked in a location in the plan as it is now (After). Each label shows the location code in large text, the part number in small text and a QR code that encodes exactly that part number. Update FR-48, Story 14.1 and the spine to match.

## Boundaries & Constraints

**Always:**
- One label per (location, part) with stock above 0 in the planning copy. A location with several parts gets one label per part; an empty location gets none.
- Order comes from the server only: aisles in aisle order, locations in Walk Path order, parts within a location in part-number order. The client never sorts, filters or parses codes (AD-3).
- The QR code encodes the part number and nothing else. The large text stays the location code.
- The labels follow the plan: after a confirmed command the page shows the new stock without a reload.
- Print stays as built: A4, 3 labels per row, 36 mm label height, black on white, no label split across pages, nothing clipped in a label (NFR-9).
- Virtual locations never get a label.

**Never:**
- No import-scoped labels endpoint left behind: `GET /api/imports/{import_id}/labels` and its client code are removed, not kept beside the new one.
- No new dependency, no migration, no change to the launcher slot, the route `/plans/{id}/labels?aisle=` or the aisle picker.
- No part description, class or quantity on the label.
- Sub-agents start no server on ports 3000 or 8000; the orchestrating session runs the e2e gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Plan with no moves | sample import, aisle A | one label per stocked (location, part) of aisle A in Walk Path order; QR decodes to the part number | N/A |
| Part moved | part P moved from L1 (then empty) to L2 | no label for L1; a label (L2, P) | N/A |
| Several parts | L holds P2 and P1 | two labels for L: P1 then P2 | N/A |
| Zero stock row | L has a row for P with stock 0 | no label for (L, P) | N/A |
| Aisle without stock | every location of aisle C empty | C is in the picker; the paper is empty; the count line reads "0 labels" and a line says no parts are stocked in the aisle | N/A |
| Unknown plan | `GET /api/plans/{id}/labels`, unknown or malformed id | 404 `plan_not_found` | as other plan views |
| Unknown aisle in URL | `?aisle=ZZ` | the first server aisle is shown and the URL is replaced | unchanged |

</frozen-after-approval>

## Code Map

- `backend/swp/domain/labels.py` -- `build_labels(data)`: import-scoped today; `AisleLabels.locations: list[LocationRef]`. Rework to the plan: take the planning copy (`planning.planning_copy(data, state)`, `PlanningCopy.contents_of(code)` gives stock per part, zero rows included). Reuse `aisle_order`, `walk_path_order`, `part_number_order` from `domain/ordering.py`. `domain/views/locations.py:71` shows a plan view reading `contents_of`.
- `backend/swp/app/labels.py`, `backend/swp/api/routers/labels.py` -- service and route. Pattern to copy: `app/locations.py` (`require(plan_id)`, `plan.imported.data`, `plan.state`, `plan.version`) and `routers/locations.py` (`GET /plans/{plan_id}/locations`, `error_responses(404, 422)`). Drop the `IMMUTABLE` cache header: a plan changes.
- `backend/.importlinter:120` -- `swp.domain.labels` is in the independent-slices list; keep the contracts at 5 kept.
- `backend/tests/domain/test_labels.py`, `backend/tests/app/test_labels_api.py` -- `test_fr48_*` tests to rework.
- `frontend/lib/api/imports.ts:48-72` -- `LabelsView`, `AisleLabels`, `importLabelsKey`, `useImportLabels`: remove. `frontend/lib/api/plans.ts:125-206` -- `planLocationsKey` / `usePlanLocations` are the pattern for `planLabelsKey` / `usePlanLabels` (under `['plan', planId]`, so a confirmed command refetches).
- `frontend/modules/labels/labels-page.tsx` -- `LabelsView`, `LabelsForImport` (uses `usePlanSummary` only to get `import_id`), `rows()`, the label card at `:108-117` (`data-label`, 20pt code, `QrCode` at `size-[24mm]`, card `h-[36mm]`). `frontend/modules/labels/qr-code.tsx` -- unchanged.
- `frontend/lib/copy/index.ts:1178-1190` -- labels copy; add the empty-aisle line here. `frontend/lib/launcher/index.ts:226-233` -- `LABELS_ENTRY.description` says "for every location".
- `frontend/tests/labels.test.tsx` -- `test_fr48_qr_encodes_exact_code` decodes every rendered QR with jsQR; keep the name. `frontend/tests/launcher.test.tsx` may assert the description.
- `frontend/e2e/labels-print.spec.ts`, `frontend/e2e/user-journeys.spec.ts:1369-1420` -- both read `/api/imports/{id}/labels` and compare `data-label` values with location codes.
- `frontend/lib/api/schema.ts` -- generated; regenerate with `npm run gen:api`.
- `.docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md:677-688` (FR-48) -- consequences say "encodes exactly that location code" and "returns the location code".
- `.docs/planning-artifacts/epics/epics-Project-2026-11-17/epics.md:126` (FR list), `:2617-2647` (Epic 14 intro and Story 14.1 criteria: one label per location, "encodes exactly that code", `test_fr48_qr_encodes_exact_code`, the hand check).
- `ARCHITECTURE-SPINE.md:490` (`.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/`) -- the stage 2 labels row.

## Tasks & Acceptance

**Execution:**
- [x] `backend/swp/domain/labels.py` -- build the plan's labels: per aisle a list of `{location: LocationRef, part: str}` in the order above; every aisle of the import is listed, also one without stock; the view carries the plan `version` like the other plan views.
- [x] `backend/swp/app/labels.py`, `backend/swp/api/routers/labels.py` -- serve `GET /api/plans/{plan_id}/labels`; remove the import route.
- [x] `backend/tests/domain/test_labels.py`, `backend/tests/app/test_labels_api.py` -- one `test_fr48_*` per matrix row (the moved-part row through a real `manual_move` command over HTTP).
- [x] `frontend/lib/api/plans.ts`, `frontend/lib/api/imports.ts`, `frontend/lib/api/schema.ts` -- plan-scoped key, fetch and hook; remove the import ones; regenerate the schema.
- [x] `frontend/modules/labels/labels-page.tsx`, `frontend/lib/copy/index.ts` -- one card per label: location code large, QR of the part number, part number in small code text; fit all three in 36 mm with a QR of at least 20 mm; `data-label` keeps the location code and `data-label-part` carries the part; the empty-aisle line on screen.
- [x] `frontend/lib/launcher/index.ts` -- description: a label with the part's QR code for every stocked location in an aisle.
- [x] `frontend/tests/labels.test.tsx`, `frontend/tests/launcher.test.tsx` -- `test_fr48_qr_encodes_exact_code` decodes every QR and compares it with its part number (and never with the location code); order, several parts, empty aisle.
- [x] `frontend/e2e/labels-print.spec.ts`, `frontend/e2e/user-journeys.spec.ts` -- read `/api/plans/{id}/labels`; check cards against (location, part) pairs; no label overflows its card; after a move made in the journey the label follows the part.
- [x] `prd.md`, `epics.md`, `ARCHITECTURE-SPINE.md` -- reword FR-48, the FR list line, Epic 14's intro, Story 14.1's criteria and the spine row as built, marked "decided 2026-11-28"; the hand check becomes "scans to its part number".

**Acceptance Criteria:**
- Given the sample plan, when the label view opens for an aisle, then every QR code decodes to the part number printed in small text on the same label.
- Given the built tree, when `npm run gen:api` runs again, then `frontend/lib/api/schema.ts` is unchanged and holds no `/api/imports/{import_id}/labels` path.
- Given the change, when `npm test`, the linters, `npm run trace` and `npm run e2e` (three browsers) run, then all pass with 0 failed, 0 flaky, 0 skipped.
- A QR code printed from Chrome scans to its part number with a phone camera: checked by hand by Justas, not by the build.

## Implementation Notes

- **Wire shape.** `LabelsView {version, aisles: [{aisle, labels: [{location: LocationRef, part}]}]}`. `is_best` on the ref follows the plan's marks, like the other plan views.
- **Malformed plan id.** The route takes the id as a string and uses `parse_plan_id`, so a malformed id is 404 `plan_not_found` as the matrix says (like `GET /api/plans/{id}`); the uuid-typed plan views such as `/locations` answer 422 there.
- **Card.** 20 pt code line, 22 mm QR code (`shrink-0`), 9 pt part line, 1 mm gaps. The part line is `max-w-full truncate` with `leading-tight`: a part number wider than the card ends with an ellipsis (the QR code holds all of it) and descenders are not cut. Measured in Chromium and Firefox with a static copy of the card's CSS: about 1.9 px free above and below.
- **Load states.** The page reads only the plan's labels (no summary fetch). `plan_not_found` is left to the shared query hook, as on the other plan views. Print is disabled with a reason while the labels are being fetched, after a failed refetch (the error shows above the stale paper, screen only) and on an aisle without labels. No refetch-before-print.
- **Print after the moves.** A screen-only line next to the count says the labels show each part where the plan puts it and are printed after the moves are carried out; FR-48 and Story 14.1 say the same.
- **Launcher.** Description: "Print a QR label for every part stocked in an aisle".
- **Also reworded.** The PRD glossary entry "Location label" and the §10 labels bullet, so the PRD does not contradict FR-48; one `(change)` entry appended to the PRD memlog.
- **Not run by the build.** `npm run e2e`: the label specs were rewritten and typecheck, but they have not run in a browser. The journey makes its move from the part panel on Parts, then undoes it from the launcher on the label page to check the labels follow without a reload.

- Gate, run by the orchestrating session on 2026-11-28 on the final tree (after the review fixes): `npm run e2e` 456 passed in chromium, firefox and msedge (0 failed, 0 flaky, 0 skipped); `npm test` 1244 passed, 2 skipped (pytest) and 796 passed (Vitest); ruff, ruff format, import-linter (5 kept), ESLint, tsc and `npm run trace` clean.
- Story 14.1 is set to `review` and Epic 14 to `in-progress` in `sprint-status.yaml`: the hand check (a label printed from Chrome scans to its part number) waits for Justas.

## Spec Change Log

- 2026-11-28, review pass 1 (findings B2, E1, E2): the Design Note "Print shows what the page shows" is narrowed. Print is disabled while the labels query fetches and after a failed refetch; a refetch before printing is still not added. Known-bad state avoided: labels printed from a stale or failed query. Keep: the plan-scoped query under `['plan', planId]` and the unchanged move-list module.

## Review Triage Log

Review pass 1, 2026-11-28 (blind hunter B1–B13, edge-case hunter E1–E6, verification gap V1–V3). Route: P = patched, D = deferred, R = rejected.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| B1 | Story 14.1 is still `done` although its hand-check criterion changed | medium | AGENTS.md: a story with a human-only criterion stays in `review` until the author confirms it. `sprint-status.yaml` sets `14-1-…` to `review` in this commit; the open point moves to the new scan (part number). | P |
| B2 | Print can print labels that are out of date | medium | `LabelsView` called `window.print()` regardless of the query state. Print is now disabled while the labels query fetches and after a failed refetch, which shows the load error above the paper. A refetch before printing (as the move list does) is not added: `usePrintAfterRender` is private to the move-list module. | P, rest D |
| B3 | Print stays enabled on an aisle without stock | low | Printed a blank sheet; Print is disabled with "There are no labels to print." | P |
| B4 | Nothing says which stock the labels show | low | The labels follow the planning copy, so they include moves not yet carried out. A screen-only line, FR-48 and the Story 14.1 criterion now say so. | P |
| B5 | "Nothing is clipped" holds only for short part numbers | low | The part line was `whitespace-nowrap` in an `overflow-hidden` card; it is now `max-w-full truncate`, so an over-long number ends with an ellipsis and the QR code holds the whole number. No lower bound on module size is added: sample part numbers are 7 digits, and a very long part number is not everyday data. | P (text), R (module size) |
| B6 | `labelKey` comment claims an invariant nothing enforces | low | The key is now `JSON.stringify([code, part])`. | P |
| B7 | One label per part is never exercised over HTTP or in a browser | low | No sample location holds two parts. `test_fr48_labels_two_parts_in_one_location_over_http` moves a part into an occupied location with a real command. The browser render of two cards is covered by Vitest. | P |
| B8 | The API test hard-codes `1_584` | low | Removed; the line above compares with `/locations`. | P |
| B9 | Wording drifts between "per stocked location" and "per part" | low | Launcher description, Epic 14 summary and the user-story sentence now say "every part stocked in an aisle". | P |
| B10 | Decision trail incomplete (PRD memlog, old spec not marked superseded, no `followup_review_recommended`) | low / false | The PRD `.memlog.md` got a `(change) 2026-11-28` entry. The old spec is history and this spec names it in its title; `followup_review_recommended` is not a field of this workflow's template. | P (memlog), R (rest) |
| B11 | The route declares a 422 it cannot return | false | `GET /api/plans/{plan_id}` does the same on purpose (`routers/plans.py:101-105`, epic-1 retro item 4): a malformed id is `plan_not_found`, and `error_responses(404, 422)` is the shared declaration. The frozen matrix asks for 404. | R |
| B12 | `test_labels_api.py` imports private helpers from four test modules | false | The suite's convention: `test_fr50_demo_account.py` and others import `_`-helpers across test modules the same way. | R |
| B13 | The journey finds its part with up to 186 requests and a 180 s timeout | low | Now one read of `/api/plans/{id}/parts`; timeout back to 120 s. | P |
| E1 | Print clicked while cached labels are older than the plan | medium | Same as B2. | P |
| E2 | A failed refetch leaves the stale paper with no message | medium | Same as B2: the error shows above the paper and Print is disabled. | P |
| E3 | Print on an aisle with 0 labels | low | Same as B3. | P |
| E4 | A part number wider than the card is cut on both sides | low | Same as B5. | P |
| E5 | A part number over the QR capacity (about 2,331 bytes at ECC M) makes `uqr` throw and the page fail | low | True only for a part number of more than 2,331 bytes; the import caps a cell at 1,000 characters, so it needs about 800 non-ASCII characters in one part number. Not met in everyday use, and the fix adds a guard. | R |
| E6 | Several parts in one location never run through HTTP or a browser | low | Same as B7. | P |
| V1 | The label page's load-state branch has no test that renders it | medium | Filed gap. `uj2 fr48 location labels show a load error when the labels request fails` routes the labels request to 500 and expects the alert and no paper. | P |
| V2 | `/labels` is missing from the size-checked plan views | low | Added to `test_ad18_nfr8_max_size_plan_views_under_4_mb` (measured by the reviewer: 3.03 MB plain for 25,000 labels). | P |
| V3 | `sprint-status.yaml` still says Story 14.1 is `done` | medium | Same as B1. | P |

## Design Notes

- **Why plan-scoped.** Labels are printed after the move list is carried out, so they must show the stock the plan ends with. A plan without moves gives the imported stock.
- **Print shows what the page shows.** The page follows the plan like every plan view (refetched after a confirmed command). No refetch-before-print is added.
- **Card fit.** 36 mm holds a 20 pt code line (about 7 mm), a QR of 20–22 mm and a 9 pt part line. A sample part number is a version 1 or 2 QR code, so modules stay above 0.6 mm.

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports && npm run lint && npm run typecheck && npm run trace` -- expected: clean
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` -- expected: clean after the regenerated file is in the tree
- `npm run e2e` -- run by the orchestrating session, not the build agent

**Manual checks (if no CLI):**
- Justas prints one aisle from Chrome and scans a QR code with a phone camera: it gives the part number.
