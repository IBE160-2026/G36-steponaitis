# Epic 3 Context: Mark best locations

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner marks whole aisles, levels (in one aisle or in all aisles) and single locations as best from the Locations table, removes marks again, and sees the best and empty-best counts everywhere the plan shows locations. This is the first change a planner makes to a plan, so the epic also builds the one command pipeline that every later change uses: the single command endpoint with idempotency, versioning and optimistic retries on the server, and the one-command-at-a-time client flow with autosave, retry and save-status notices. Rules 1 and 2 (Epic 5) depend on these marks, and the tool never guesses best locations.

## Stories

- Story 3.1: Best-location marks in the domain
- Story 3.2: The command endpoint with best-location mark commands
- Story 3.3: Client command flow and autosave
- Story 3.4: Best locations step: mark and unmark from the table

## Requirements & Constraints

- **Marks:** the planner can mark and unmark a whole aisle, a level in all aisles, a level in one aisle, or a single location. A location is best when any mark covers it; removing one mark leaves it best while another mark still covers it. No other location is best. Marks are stored in the plan, never in the import. In M1 marks are set only from the Locations table (the wall comes in Epic 10).
- **Counts:** the plan shows the number of best locations and of empty best locations; the Locations list shows which locations are best and can filter on it. Answer key: marking the whole aisle A makes its 9 locations best, 1 of them empty (`A-01-01-03`), and nothing else best.
- **Autosave:** every change is saved automatically with no Save button, and a reload shows it. Each change applies exactly once, even on a network retry or reload. `last_edited_by` is the fixed value `planner` in M1. Opening or viewing a plan never writes and never updates last edited.
- **No-ops:** setting a mark that already exists or removing one that doesn't returns 200 with no events and changes neither `version` nor `last_edited_*`.
- **Accessibility:** no information by colour alone (best is always shown with text/tag); all controls keyboard-usable; targets at least 24 × 24px; save status, toasts announced `aria-live="polite"`.
- **Performance:** a command plus the plan views takes under 1 s on the demo data.
- **Tests** name their FR (e.g. `test_fr21_overlapping_marks`, `test_fr22_answer_key_best_counts`, `test_fr10_repeated_command_id_applies_once`, `test_fr21_noop_mark_does_not_bump_version`). Domain tests call the domain directly; `tests/app` runs on SQLite and Postgres 17 in CI; user-visible stories extend Playwright in `frontend/e2e/` on `data/sample/`.

## Technical Decisions

- **Slices:** `domain/marks` (mark command handlers) and `modules/best-locations` (route `/plans/{id}/best-locations`). Shared pieces introduced here and reused by every later slice: `swp/app/commands.py` (command service), `api/routers/commands.py` (the endpoint), `frontend/lib/commands` (client flow). Domain slices import only the kernel; frontend modules import only `components/*` and `lib/*`; anything a second module needs moves to `components/common` or `lib` in the story that needs it.
- **Mark storage (AD-4):** `PlanState` holds marks as a set of values, never indexes: `{kind:"aisle", aisle}`, `{kind:"level", level, aisle | null}` (null = all aisles), `{kind:"location", location}`. Commands refer to marks by value. If the stored state shape changes, bump `schema_version` and add a pure upcaster in `domain/state_migrations.py` with a fixture; GET never saves.
- **Shared facts (AD-1):** `covering_marks(location, marks)` and `is_best(location, marks)` live only in `domain/planning.py`; every view and later rule imports them. The domain stays pure (stdlib + pydantic, no clock, no randomness); time and user arrive as `CommandContext(now, user)`; new IDs are `uuid5(command_id, "<kind>:<n>")`.
- **Command endpoint (AD-6):** `POST /api/plans/{id}/commands` with `{command_id, base_version, type, …}`. The service reads the plan, runs `domain.apply(state, command, ctx)`, and saves with `UPDATE … SET state=…, version=version+1, last_edited_by=…, last_edited_at=… WHERE id=:id AND version=:read_version`. On 0 rows changed it re-reads and re-applies up to 3 times; SQLite transactions use `BEGIN IMMEDIATE`. `base_version` is recorded but not enforced. Response `{version, events[]}`. `recent_commands` keeps the last 50 `(command_id, result)` pairs; a repeated `command_id` returns the stored result unchanged.
- **Closed unions (AD-6, AD-13):** after this epic `domain/commands.py` holds only `set_best_mark` and `remove_best_mark`, and the event union only `mark_set` and `mark_removed`. Later slices add their types to these files and handlers to their own modules; no new write endpoints. Command and view models are the wire types; regenerate `frontend/lib/api/schema.ts` (CI diffs it). snake_case JSON.
- **Errors (AD-11):** envelope `{"error": {code, message, details}}`; unknown plan → `plan_not_found` (404); invalid command → `validation_failed` (422). Domain raises `DomainError`; only `swp/api` maps it to HTTP. Frontend branches only on `code`.
- **Same-origin guard (AD-19):** the command POST passes the existing origin middleware; JSON bodies only.
- **Views (AD-3, AD-15):** server-authoritative. The plan summary (`GET /api/plans/{id}`) and overview gain best and empty-best counts; the locations view sets `is_best` on every `LocationRef` from `covering_marks` and lists, for each best location, the marks covering it. The frontend never computes best status or counts. One fold per request.
- **Client command flow (AD-12):** one command at a time per plan, new `command_id`, current `base_version`. While unconfirmed, every plan-changing control is `aria-disabled` with reason "Saving the last change…". Network error or 502/503/504: retry with the same `command_id` after 1, 2, 4, 8 s with the notice "The last change was not saved yet. Trying again."; then (or on 500) drop, refetch, "The change was not saved. Try again." Other 4xx: drop, toast the `message`, refetch; `plan_not_found` uses the shared handling from Story 1.9. After a confirmed command, refetch every `['plan', planId]` query and render only version-consistent sets (at most 2 extra refetches); leave `['import', importId]` alone. Nothing shows as changed before the server confirms.
- **Ordering (AD-14):** aisles, levels and lists of marks follow `domain/ordering.py` (code-point text order, all-digit Level numeric).

## UX & Interaction Patterns

- **Best locations step (M1):** the Locations table in marking mode. A segmented control **Whole aisle | Level | Single location** behaves as a radio group with arrow keys and remembers its selection per plan in the browser (via `lib/view-state`, localStorage wrapped in try/catch).
  - Whole aisle marks the aisle chosen in the aisle filter.
  - Level offers a level picker with "in this aisle | in all aisles".
  - Single location adds a **Mark** / **Unmark** button to each row.
- **Beside the table:** the list of current marks, each with a remove button (at least 24 × 24px, × icon, labelled e.g. "Remove mark Level 1 in aisle A"), and live counts like "174 best · 7 empty".
- **Toast after a confirmed mark change:** "Best-location marks changed." with no Undo (undo never reverses marks). Epic 5 later adds the outdated-recommendation count and a **View** action.
- **Empty state:** "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations."
- **Save status:** "Saved automatically" in the plan plate tooltip after each confirmed change; failures in the `GlobalNotice` strip under the toolbar (warning triangle, body-strong text); status announced `aria-live="polite"`.
- **Flow bar:** the Best locations step is checked once at least one mark exists (with visually hidden "done" text).
- **Best indication:** shown with text/BEST tag, never colour alone; the Locations table's best column and best filter work from server data.
- **Copy:** glossary terms verbatim ("best location"), sentence case, thousands separators, no emoji.

## Cross-Story Dependencies

- Builds on Epic 1 (stored plan with `state`/`version`, `PlanState`, error envelope, origin guard, `lib/view-state`, GlobalNotice, Toast, flow bar, plan plate, `plan_not_found` handling) and Epic 2 (`domain/planning.py` shared facts, locations view with `LocationRef.is_best` stubbed false, Locations table with best column/filter, `DataTable`).
- Within the epic: 3.1 (marks in state, `covering_marks`, counts in views) feeds 3.2 (commands apply the marks), which 3.3 calls from the client; 3.4 uses all three.
- Later epics reuse this: every later change (keep in place, run, apply, manual move, undo, reset) adds its command type to the same union and endpoint and goes through `lib/commands`. Epic 5 adds `domain.recommendations.revalidate` to the command service and the `marks` outdated cause plus the toast's outdated count and **View**. Epic 4's undo and reset keep marks. Epic 10 adds marking on the wall.
