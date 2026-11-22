# Epic 4 Context: Try moves in the planning copy and compare before/after

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner moves parts by hand in the planning copy while the import never changes, and then sees, aisle by aisle and in total, which parts move in and out, how many fast-moving parts sit in best locations and how many pick groups share an aisle, before and after. The epic lays the append-only step log and `replay`, the single fold every later move, recommendation, undo, reset, wall and print feature builds on, and makes every existing view (parts, locations, pick groups, search) follow the planning copy instead of the import.

## Stories

- Story 4.1: Step log, replay and the planning copy
- Story 4.2: Make a manual move (command and preview)
- Story 4.3: Manual move dialog from the part panel
- Story 4.4: Views follow the planning copy
- Story 4.5: Before/after counts in the domain
- Story 4.6: Before/after page

## Requirements & Constraints

- **Manual move:** move a part from one of its locations to any location in the Locations file, empty or occupied (both parts are then stored there). Rule Manual, current round (0 before the first run), next move number (never reused). Moves all the part's stock at the from-location (never split), leaves its other locations alone, and adds stock together when the target already holds the part. Rejected: the from-location itself, a virtual location, a code not in the Locations file, a part with no stock at the from-location.
- **Combine / move back:** a second move of the same part in the same round, from the earlier move's to-location, where that location held none of the part before, becomes one Manual move from the first from-location to the new to-location, keeping the first move number; if it returns to the first from-location the move is removed. Every other case stays separate. Implemented in `replay` from the first story, even though the requirement is tagged M2.
- **Import never changes:** after any sequence of moves (and later undo/reset) the import's locations, inventory and transactions are identical to what was uploaded, and movement classes and pick groups (from `analysis`) never change.
- **Before/after:** per aisle and for the whole warehouse, the import ("before") next to the planning copy ("after"): parts moving in and out of each aisle; fast-moving parts in best locations (a part counts once, in its current location's aisle; a part with no current location counts nowhere); pick groups with both parts' current locations in the same aisle; occupied/empty counts. Both sides use the **current** marks. Updates after every change.
- **Answer key:** 9300 into C-01-01-01 after 1100 left it; the 9100/9200 swap through an occupied location; 0100 combined into one Manual move; before/after fast-moving in best locations 1 → 5 and pick groups in one aisle 1 → 6, plus each aisle's occupied/empty and in/out lists (from `expected.json`).
- **Tests** name their FR, e.g. `test_fr34_combine_only_through_location_without_part`, `test_fr34_move_back_removes_move`, `test_fr36_import_never_changes` (property-style, random valid move sequences on the answer-key import), `test_fr36_classes_and_groups_stable_after_moves`, `test_fr33_*`, `test_fr37_answer_key_before_after`. Domain tests call the domain directly; user-visible stories extend Playwright on `data/sample/`.
- **Accessibility / performance:** no information by colour alone; keyboard-complete (search → part panel → Manual move… must work without a mouse); a command plus the plan views under 1 s.

## Technical Decisions

- **Step log (AD-5):** a step in `domain/state.py` holds move number, part, from, to, rule (`rule_1 | rule_2 | rule_3 | manual`), round, recommendation id (or none), `swap_id` (or none); `next_move_number` starts at 1. A stored-shape change adds the next upcaster in `domain/state_migrations.py` plus a fixture `state_v<n>.json` in the same change.
- **Replay (AD-1, AD-5):** `domain.planning.replay(import, steps)` returns the planning copy (stock per part and location), the effective moves and each part's current location; none are stored. `current_location`, `is_empty`, `stock_at`, `aisle_of` take the planning copy; `planning_copy(import, state)` delegates to `replay` (still one implementation). `current_round` is derived (highest run round, or 0), never stored; `domain.apply` asserts each new step's round is the current round.
- **Command (AD-6):** add `manual_move {part, from, to}` to the closed union in `domain/commands.py` and events `move_made`, `moves_combined`, `move_removed` to the event union; handlers live in the slice. Goes through the existing endpoint and command service; no new write endpoint. Refusals raise `DomainError` → `command_rejected` (409) with a final English message (e.g. "This is the from-location. Choose another.", "FLSKRS is a virtual location, not a shelf."); version unchanged.
- **Preview (AD-3):** `GET /api/plans/{id}/moves/preview?part=&from=&to=` returns `{allowed, refusal_message?, effect: new | adds_to_stock | combines_with(n) | removes_move(n), target: empty | occupied | none, target_parts[]}` from `domain.planning`, writes nothing; the command re-checks on submit.
- **Views (AD-3):** parts, locations, pick-groups, search and before/after each run `replay` once per request and carry `version`. Client renders a set of plan queries only when versions agree (at most 2 extra refetches); import-scoped queries are left alone. The frontend never computes the planning copy, occupancy, move effects or before/after.
- **Before/after slice:** `domain/before_after.py` takes import, planning copy, analysis and current marks; imports only the kernel (`planning`, `ordering`, `values`), an allowed import-linter exception. `GET /api/plans/{id}/before-after`; frontend `modules/before-after`, route `/plans/{id}/before-after`.
- **Ordering (AD-14):** aisles and in/out lists follow `domain/ordering.py`; the to-location autocomplete uses the same order.
- **Shared component:** `ManualMoveDialog` lives in `components/common/` (reused later by the recommendation detail and the wall tooltip).

## UX & Interaction Patterns

- **Manual move dialog** (from the part panel's **Manual move…**): from-location preselected when the part has one location, otherwise a choice; to-location autocomplete over the Locations file. Driven by the server preview: refusals as input errors (red boundary, warning icon, server sentence, `aria-invalid="true"`, `aria-describedby`), confirm disabled while refused; occupied target already holding the part shows "to an occupied location: stock is added together"; `removes_move(n)` shows "This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed." with confirm **Remove move**.
- **Toasts:** "Moved 9300: B-01-03-02 → C-01-01-01 (Manual, round 0)." or for a merge "Combined into one move: G-14-04-02 → A-02-01-01 (Manual)." While unconfirmed, plan-changing controls are `aria-disabled` with "Saving the last change…".
- **No stock:** part panel shows "No current location (no stock above zero)" and Manual move… is disabled with that reason (focusable, reason on hover/focus).
- **Before/after page:** data table, a row per aisle in AD-14 order plus a total row; cells read "Before → After" with the change in body-strong; numbers right-aligned and tabular; parts moving in/out per aisle; best shown with the word "best", never colour alone. Table is a single tab stop with ↑/↓ between rows. No moves: equal values and "No moves yet: before and after are the same." The flow bar never checks Before/after.
- **Pick groups:** a row whose parts now share an aisle shows "Same aisle"; aisles shown are current aisles.

## Cross-Story Dependencies

- Builds on Epic 1 (`PlanState`, upcasters, error envelope), Epic 2 (`domain/planning.py` facts, `planning_copy`, parts/locations/pick-groups/search views, PartPanel, DataTable) and Epic 3 (command endpoint and service, `lib/commands` flow, marks and `covering_marks`/`is_best`).
- Within the epic: 4.1 (steps, `replay`) feeds 4.2 (command, preview), which 4.3 calls from the UI; 4.4 switches views to `replay`; 4.5 (domain counts) feeds 4.6 (endpoint and page).
- Later epics: Epic 5 adds run/apply steps (rules 1–3, rounds, `run_baseline`) and FR-34 "moved back" outdating; Epic 7 adds undo/reset on the step log (`undo_preview`); Epic 8 builds the move list from effective moves; Epic 10/12 reuse ManualMoveDialog and add drag commands that expand into Manual steps.
