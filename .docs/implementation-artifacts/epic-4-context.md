# Epic 4 Context: Try moves in the planning copy and compare before/after

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner moves parts by hand in the planning copy while the import never changes. Then the planner sees, aisle by aisle and in total, before and after: which parts move in and out, how many fast-moving parts sit in best locations, and how many pick groups share an aisle. The epic builds the append-only step log and `replay`. Every later feature folds over it: moves, recommendations, undo, reset, the wall and print. The epic also makes every existing view (parts, locations, pick groups, search) show the planning copy instead of the import.

## Stories

- Story 4.1: Step log, replay and the planning copy
- Story 4.2: Make a manual move (command and preview)
- Story 4.3: Manual move dialog from the part panel
- Story 4.4: Views follow the planning copy
- Story 4.5: Before/after counts in the domain
- Story 4.6: Before/after page

## Requirements & Constraints

- **Manual move:** moves a part from one of its locations to any location in the Locations file, empty or occupied. If the target is occupied, both parts are then stored there. The step gets rule Manual, the current round (0 before the first run) and the next move number, which is never reused. It moves all of the part's stock at the from-location (never a split) and leaves the part's other locations alone. If the target already holds the part, the stock is added together. The move is rejected when:
  - the target is the from-location itself;
  - the target is a virtual location;
  - the target code is not in the Locations file;
  - the part has no stock at the from-location.
- **Combine / move back:** the same part moved again in the same round, from the earlier move's to-location, combines into one move when that location held none of the part before. The result is one Manual move from the first from-location to the new to-location, and it keeps the first move number. If the second move returns to the first from-location, the move is removed. Every other case stays separate. This lives in `replay` from the first story.
- **Import never changes:** after any sequence of moves, the import's locations, inventory and transactions equal what was uploaded. Movement classes and pick groups come from `analysis` and never change.
- **Before/after:** each aisle and the whole warehouse show the import ("before") next to the planning copy ("after"), with these counts:
  - the parts moving in and out of each aisle;
  - fast-moving parts in best locations: a part counts once, in the aisle of its current location, and a part with no current location counts nowhere;
  - pick groups whose two parts' current locations are in the same aisle;
  - occupied and empty locations.

  Both sides use the **current** marks. The counts update after every change.
- **Answer key:**
  - 9300 moves into C-01-01-01 after 1100 has left it;
  - the 9100/9200 swap goes through an occupied location;
  - 0100 combines into one Manual move;
  - before/after: fast-moving parts in best locations go 1 → 5, and pick groups in one aisle go 1 → 6;
  - each aisle's occupied/empty counts and in/out lists match `expected.json`.
- **Tests** name their FR, for example:
  - `test_fr34_combine_only_through_location_without_part`
  - `test_fr34_move_back_removes_move`
  - `test_fr36_import_never_changes`: property-style, with random valid move sequences on the answer-key import
  - `test_fr36_classes_and_groups_stable_after_moves`
  - `test_fr33_*`
  - `test_fr37_answer_key_before_after`

  Domain tests call the domain directly. Stories the user can see extend the Playwright tests on `data/sample/`.
- **Accessibility and performance:** no information is shown by colour alone. Everything works from the keyboard, including search → part panel → Manual move…. A command plus the plan views take under 1 s.

## Technical Decisions

- **Step log:** a step holds the move number, part, from-location, to-location, rule (`rule_1 | rule_2 | rule_3 | manual`), round, recommendation id (or none) and `swap_id` (or none). `next_move_number` starts at 1. A change to a stored shape (state or import `data`) adds the next upcaster in `domain/state_migrations.py` and a fixture `<doc>_v<n>.json` in the same change.
- **Replay:** `domain.planning.replay(import, steps)` returns the planning copy (stock per part and location), the effective moves and each part's current location. None of these are stored.
  - `current_location`, `is_empty`, `stock_at` and `aisle_of` take the planning copy.
  - `planning_copy` delegates to `replay`, so there is still one implementation.
  - `current_round` is derived (the highest run round, or 0) and never stored. `domain.apply` asserts that each new step's round is the current round.
- **Command:** `manual_move {part, from, to}` is in the closed command union. The events `move_made`, `moves_combined` and `move_removed` are in the event union.
  - It goes through `POST /api/plans/{id}/commands` with `{command_id, base_version, …}`. The command is idempotent per `command_id`, and the response is `{version, events}`. There is no new write endpoint.
  - A refusal raises `DomainError`, which becomes `command_rejected` (409) with a final English message, for example "This is the from-location. Choose another." or "FLSKRS is a virtual location, not a shelf.". The version stays unchanged.
  - A busy database returns `unavailable` (503). The client retries it like a network error: the same `command_id` after 1, 2, 4 and 8 s, with "The last change was not saved yet. Trying again." After that it drops the command, refetches and shows "The change was not saved. Try again."
- **Preview:** `GET /api/plans/{id}/moves/preview?part=&from=&to=` writes nothing and returns `{allowed, refusal_message?, effect: new | adds_to_stock | combines_with(n) | removes_move(n), target: empty | occupied | none, target_parts[]}`.
  - `target_parts` lists the parts stored at `to`: number, description, class, picks, stock and kept in place. The client never computes these.
  - The command checks the same rules again on submit.
- **Views:** the parts, locations, pick-groups, search and before/after views each run `replay` once per request, build the whole response from that one fold, and carry `version`. The backend has no cross-request cache of plan state.
  - After a confirmed command, the client refetches every `['plan', planId]` query. It renders a set of plan queries together only when their versions agree, refetching stale ones at most twice.
  - Queries scoped to the import are left alone.
  - The frontend never computes the planning copy, occupancy, the effect of a move, or before/after counts.
- **Before/after slice:** `domain/before_after.py` takes the import, the planning copy, the analysis and the current marks.
  - It imports only the kernel (`planning`, `ordering`, `values`). This is an allowed import-linter exception.
  - The endpoint is `GET /api/plans/{id}/before-after`. The frontend module is `modules/before-after`, at route `/plans/{id}/before-after`.
- **Ordering:** aisles, in/out lists and the to-location autocomplete follow the text order in `domain/ordering.py`.
- **Shared component:** `ManualMoveDialog` lives in `components/common/`. The recommendation detail and the wall tooltip reuse it later. A frontend module never imports another module.

## UX & Interaction Patterns

- **Manual move dialog**, opened from the part panel's **Manual move…**:
  - The from-location is preselected when the part has one location. Otherwise the planner chooses one.
  - The to-location field autocompletes over the Locations file.
  - The server preview drives the dialog. A refusal shows as an input error: red boundary, warning icon, the server's sentence, `aria-invalid="true"` and `aria-describedby`. Confirm stays disabled while the preview refuses.
  - When the occupied target already holds the part, the dialog says "to an occupied location: stock is added together".
  - For `removes_move(n)`, the dialog says "This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed." and the confirm button reads **Remove move**.
- **Toasts:**
  - a move: "Moved 9300: B-01-03-02 → C-01-01-01 (Manual, round 0)."
  - a merge: "Combined into one move: G-14-04-02 → A-02-01-01 (Manual)."

  While a command is unconfirmed, every plan-changing control is `aria-disabled` with "Saving the last change…".
- **No stock:** the part panel shows "No current location (no stock above zero)". Manual move… is disabled with that reason, stays focusable, and shows the reason on hover and focus.
- **Before/after page:**
  - A data table has a row per aisle in text order plus a total row.
  - Cells read "Before → After" with the change in body-strong. Numbers are right-aligned and tabular.
  - Each aisle lists the parts moving in and out.
  - Best is shown with the word "best", never by colour alone.
  - The table is a single tab stop, with ↑/↓ between rows.
  - With no moves: the values are equal and the page says "No moves yet: before and after are the same."
  - The flow bar never checks Before/after.
- **Pick groups:** a row whose parts now share an aisle shows "Same aisle". The aisles shown are the current aisles.

## Cross-Story Dependencies

- **Earlier epics:**
  - Epic 1: `PlanState`, upcasters and the error envelope.
  - Epic 2: the `domain/planning.py` facts, the parts/locations/pick-groups/search views, PartPanel and DataTable.
  - Epic 3: the command endpoint and service, the `lib/commands` flow, and marks with `covering_marks`/`is_best`.
- **Within the epic:**
  - 4.1 (steps, `replay`) feeds 4.2 (command, preview).
  - 4.3 calls 4.2 from the UI.
  - 4.4 switches the views to `replay`.
  - 4.5 (domain counts) feeds 4.6 (endpoint and page).
- **Later epics:**
  - Epic 5 adds run/apply steps (rules 1–3, rounds, `run_baseline`) and marks recommendations outdated when a part is moved back.
  - Epic 7 adds undo and reset on the step log (`undo_preview`).
  - Epic 8 builds the move list from the effective moves.
  - Epics 10 and 12 reuse ManualMoveDialog and the preview's `target`/`target_parts`, and add drag commands.
