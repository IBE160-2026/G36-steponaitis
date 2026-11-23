---
title: 'Story 12.1: Drag commands expand into manual moves on the server'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'c78757c6be38a4c1016193db0bef140732c1a58b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-12-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A drop on the wall (Epic 12) must be saved as one command, but the closed command list (AD-6) only has the single-part `manual_move`. Without server-side drag commands a swap could be saved as half its moves.

**Approach:** Add `move_parts`, `put_together` and `swap` to the command union. A new drag slice validates the whole command against the plan as it is, then expands it into ordinary Manual steps through the same check and fold `manual_move` uses, in one `domain.apply` (one transaction, one version bump, idempotent by `command_id`). The existing move preview already returns `target` and `target_parts`; this story pins that with FR-51 tests.

## Boundaries & Constraints

**Always:**
- Each expanded step is exactly a manual move: rule `manual`, current round (0 before the first run), next move number, all of the part's stock at its from-location, stock added when the target already holds the part (FR-33), FR-34 combining per step through `planning.replay` / `check_manual_move` unchanged.
- Order: chosen parts from → to in listed order, then (swap only) back-parts to → from in listed order. All swap steps carry `swap_id = str(uuid.uuid5(command.command_id, "swap:1"))`; `move_parts`/`put_together` steps have no `swap_id`.
- Validate the whole command against the state before it; on any rejection raise `DomainError("command_rejected", <sentence>)` and change nothing.
- Keep marks are untouched: a kept part may be moved by any drag command and stays kept (FR-32).
- `drag.py` imports only the domain kernel. The shared "append a checked manual step and its event" code moves into a new kernel module used by both `moves.py` and `drag.py` (DRY), so `manual_move` behaves exactly as before.
- Tests name FR-51 (or FR-33/FR-34/AD-6 where they pin those) in their names.

**Never:**
- No frontend UI, no drag interaction, no Playwright spec (Stories 12.2/12.3); only `schema.ts` regeneration and any type fix-up it forces.
- Do not change the FR-34 fold, `_refusal`, `check_manual_move`'s results, `move_list.py` or undo; in particular do not change the same-part rule (A→B then B→C where B already held the part is not combined; spec-8-1 deferral, epic-8 retro item 68) — drag steps go through the same fold, no new special case.
- No new endpoint (AD-6); no swap size/membership storage (that is Story 12.4, epic-8 retro item 72).
- Do not refuse `manual_move` for unlisted parts here (epic-4 retro item 30 stays open).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| move_parts to empty | F holds A,B; T empty; parts [B,A] | steps B F→T, A F→T with consecutive numbers; events `move_made` ×2 in that order | — |
| put_together | T holds C (and maybe A) | one step per part; A's stock adds at T; per-step event (`move_made`, or `moves_combined`/`move_removed` when FR-34 applies) | — |
| swap | F holds A,X; T holds C; parts [A], back [C] | steps A F→T then C T→F, same `swap_id`; events: `swap_made` first, then the per-step events in step order; X stays at F | — |
| retried swap | same `command_id` again | stored result, no new steps, version unchanged | — |
| no part | parts [] | — | `Choose at least one part to move.` |
| swap without back | back_parts [] | — | `Choose at least one part to move back.` |
| part on both sides | A in parts and back_parts | — | `{A} cannot move both ways.` |
| part listed twice | parts [A,A] (or back twice) | — | `{A} is chosen twice.` |
| from == to | F == T | — | `This is the from-location. Choose another.` (`IS_FROM_LOCATION`) |
| virtual / unknown code | from or to virtual / not in Locations | — | `{code} is a virtual location, not a shelf.` / `{code} is not in the Locations file.` |
| part not at its location | A has no stock at F (or back-part none at T, or unknown part) | — | `{A} has no stock at {F}.` |
| move_parts onto occupied | T occupied | — | `{T} is occupied. Choose Swap or Put together.` |
| put_together onto empty | T empty | — | `{T} is empty. Move the parts there instead.` |
| too many parts | > 100 entries in parts or back_parts, or a code over `CODE_MAX_LENGTH` | — | 422 `validation_failed` from pydantic |

Check order: no part → (swap) no back-part → from == to → from code → to code → twice/both ways → stock at from/to → occupancy rule (move_parts/put_together). Codes are checked with the same virtual-then-unknown order as `_refusal`.

</intent-contract>

## Code Map

- `backend/swp/domain/commands.py` -- closed `Command` and `Event` unions. Add `MoveParts`, `PutTogether`, `Swap` (wire fields `from`/`to` via aliases like `ManualMove`, `populate_by_name=True`; `parts`/`back_parts: list[Annotated[str, Field(max_length=CODE_MAX_LENGTH)]]` with `max_length=100`, no `min_length` so an empty list is a `command_rejected`, not 422). Add `SwapMade {type: "swap_made", swap_id, from_location, to_location, move_numbers: list[int], round}` (12.3's toast needs from, to, count and round).
- `backend/swp/domain/moves.py` -- `manual_move` builds `MoveMade`/`MovesCombined`/`MoveRemoved` from a `ManualMoveCheck` (lines 36-67). Move that into the new kernel helper and call it; behaviour identical.
- New kernel `backend/swp/domain/manual_steps.py` -- e.g. `append_manual_step(data, state, part, from_location, to_location, *, swap_id=None) -> tuple[PlanState, Event]`: runs `planning.check_manual_move`, raises `command_rejected` with its message, `append_step(..., rule="manual", swap_id=swap_id)`, returns the per-step event. Not a slice (imports `commands` + `planning`); add it to `KERNEL_MODULES` in `backend/tests/rules/test_layer_rules.py:164`.
- New slice `backend/swp/domain/drag.py` -- `move_parts`, `put_together`, `swap` handlers: validate (matrix), then fold the steps one by one through `append_manual_step` on the evolving state. Uses `planning.replay`/`planning_copy`, `stock_at`, `is_empty`, `ENTER_TO_LOCATION`-style constants where they exist (`IS_FROM_LOCATION`).
- `backend/swp/domain/apply.py` -- `_dispatch` match: add the three cases → `drag.*` (signature `(state, command, ctx, data)` like `moves.manual_move`). `check_step_invariants` already enforces round and increasing numbers for multi-step commands.
- `backend/.importlinter` -- add `swp.domain.drag` to the `domain-slices` independence contract.
- `backend/swp/app/commands.py` -- unchanged: one transaction, revalidate after apply, `recent_commands` idempotency already cover AC "one version bump" and retry.
- `backend/swp/domain/views/move_preview.py` -- already returns `target: empty|occupied|none` and `target_parts` (part, description, movement_class, picks, stock, kept_in_place) and writes nothing; no code change expected.
- `backend/swp/domain/history.py` -- undo drops only the last step; a swap's last step is the last back-part move.
- `backend/tests/domain/test_manual_move.py` -- fixture/helper patterns (`answer_key_import`, `empty_analysis`, `CTX`, `apply`). `backend/tests/domain/answer_key.py` -- answer-key loaders. `backend/tests/app/test_manual_move_api.py` -- HTTP helpers (`_sample_plan`, `SAME_ORIGIN`, `_row`).
- `data/answer-key/Inventory.csv` -- read-only. No location starts with two different parts; D-01-02-02 holds 9100, D-01-02-03 holds 9200, D-01-01-01 holds 8300 (all round-0 movable).
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`; `frontend/lib/commands/undo.ts:42` and `frontend/components/common/manual-move-dialog.tsx:108` switch on event types (must still typecheck with `swap_made`).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/commands.py` -- add the three commands to `Command` and `SwapMade` to `Event` -- AD-6 closed list, AD-13 wire types.
- `backend/swp/domain/manual_steps.py` -- new kernel helper; `backend/swp/domain/moves.py` -- use it -- one place that turns a checked manual step into state + event (DRY).
- `backend/swp/domain/drag.py` -- validation per matrix and expansion -- FR-51, AD-16.
- `backend/swp/domain/apply.py`, `backend/.importlinter`, `backend/tests/rules/test_layer_rules.py` -- dispatch, slice contract, kernel list.
- `backend/tests/domain/test_drag.py` -- `test_fr51_*`: move_parts order/numbers/round 0 and round after a run; put_together adds stock of the same part; each matrix rejection leaves state unchanged; kept part accepted and still kept; swap steps share `uuid5(command_id, "swap:1")`, `swap_made` lists both move numbers; FR-34 per step (a drag step that returns a part to its first from-location gives `move_removed`); answer-key case: setup `put_together` 8300 D-01-01-01 → D-01-02-03 (now 9200 + 8300), then `swap` from D-01-02-03 parts [9200] to D-01-02-02 back [9100]: 9200 at D-01-02-02, 9100 at D-01-02-03, 8300 stays, both new steps share one `swap_id`, `Undo` of the last step removes only 9100's move (9200 stays at D-01-02-02). Existing `test_manual_move.py` stays green unchanged.
- `backend/tests/app/test_drag_api.py` -- `test_fr51_*` over HTTP on the sample plan: a `swap` returns version+1 with `swap_made` + per-step events and the plan version rises by exactly 1; the same body posted again returns the identical result and no new steps; a rejected drag returns 409 `command_rejected` with the version unchanged; the move preview to an occupied location returns `target: "occupied"` with the stored parts (incl. `kept_in_place` true for a kept part) and to an empty location `target: "empty"`, `target_parts: []`, and the plan version is unchanged.
- `frontend/lib/api/schema.ts` -- `npm run gen:api`; fix any type error it causes without changing UI behaviour.

**Acceptance Criteria:**
- Given the command endpoint, when any of the three drag commands is posted, then it is parsed by the closed union (unknown fields/types still 422) and `schema.ts` contains `MoveParts`, `PutTogether`, `Swap` and `SwapMade`.
- Given a valid drag command, when it is applied, then the plan gets exactly one version bump and its steps are ordinary Manual steps as in the matrix, and recommendations are revalidated as for a manual move.
- Given an existing `manual_move` caller, when it runs, then its events and refusals are unchanged (existing tests green).

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 18, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `SwapMade` docstring calls `move_numbers` "the manual moves", but they are step move numbers and an FR-34-folded leg has no effective move of its own — docstring reworded to say they are the swap's step move numbers.
  - `[low]` `[patch]` (blind) no test of a swap whose leg is folded by FR-34 — added a test asserting the folded leg's event, both step numbers in `swap_made` and the shared `swap_id` on both steps.
  - `[low]` `[reject]` (blind) drag refusal sentences repeat `planning._refusal`'s wording instead of sharing it — both sides pin their exact sentences in tests (`test_drag.py` rejection matrix, `test_manual_move.py`), so drift fails a test; sharing needs a new kernel function for a cosmetic gain.
  - `[low]` `[reject]` (blind) blank or whitespace `from`/`to` gives " is not in the Locations file." — the drag UI (12.2/12.3) always sends codes taken from the wall, so only a hand-made request meets it; the fix adds a branch and a new sentence.
  - `[low]` `[reject]` (blind) up to 200 parts means ~400 replays in one request (NFR-8) — real drags hold a handful of parts; only a deliberate 100+100 request is slow, and the fix (one incremental fold) is a redesign, not a correction.
  - `[low]` `[reject]` (blind) unknown fields are not refused with 422 on the new commands — every existing command model (`ManualMove` etc.) ignores extra fields the same way; the spec's "unknown fields still 422" line is the inaccuracy, and fixing it means editing this build's spec.
  - `[low]` `[patch]` (blind) no test that a drag outdates recommendations like a manual move — added a test where a drag after a run makes `revalidate` report the open recommendation outdated.
  - `[low]` `[reject]` (blind) no test of a refusal in the middle of expansion — unreachable after the up-front check (distinct parts, stock checked), and `apply` is pure so a raise cannot leave a half state; a monkeypatch test adds complexity for no reachable case.
  - `[low]` `[reject]` (blind) `MoveParts`/`PutTogether`/`Swap` repeat the field block — matches every other command model's style; a base class changes the generated schema shape for no behaviour gain.
  - `[low]` `[patch]` (blind) `_refusal` rebuilds `set(back)` for each part — set built once.
  - `[low]` `[reject]` (blind) test helpers raise bare `IndexError`/`StopIteration`, and `_swap_body` has an unused `base_version` keyword — test-only, the fixed sample data satisfies them; a failure would still point at the helper line.
  - `[low]` `[patch]` (verification-gap) `swap_made.round` is only checked in round 0 — added a swap-after-a-run test asserting round 1 on the event and both steps.
  - `[low]` `[patch]` (edge) `swap_made` lists step numbers when a leg is folded by FR-34 — same root cause as the docstring row; patched with it (docstring + folded-leg test). 12.4 owns how the move list treats a folded swap (epic-8 retro item 72).
  - `[low]` `[reject]` (edge) blank/whitespace `from`/`to` refusal sentence — same as the blank-code row above; rejected with it.
  - `[low]` `[reject]` (edge) empty string in `parts` gives " has no stock at X." — same hand-made-request-only path as the blank-code row; rejected with it.
  - `[low]` `[reject]` (edge) 100+100 parts → ~400 replays — same as the performance row above; rejected with it.
  - `[low]` `[reject]` (edge) `_occupied_pair` raises `IndexError` if the sample changes — same as the test-helper row; rejected with it.
  - `[false]` `[reject]` (edge, claim) codes not checked "in the same order as `_refusal`" — the virtual-then-unknown order the spec names is kept; the blank check is the separate rejected row above.
  - `[false]` `[reject]` (intent) the answer-key case is built in-test, not in `data/answer-key/`, and lacks the move-list lines — the dataset may not be edited by hand (AGENTS policy) and holds no location with two parts; the move-list lines are Story 12.4's AC (`tests/app/test_fr51_swap_move_list.py`).
  - `[false]` `[reject]` (intent) retry and one version bump checked only over HTTP — idempotency and versioning live in `swp/app/commands.py`, not the domain; the HTTP test is the only surface where they exist.
  - `[false]` `[reject]` (intent) strict "use only the kernel" — `drag.py` imports only kernel modules (`planning`, `commands`, `manual_steps`, `errors`); import-linter's domain-slices contract is kept.
  - `[false]` `[reject]` (intent) preview has no production change — it already returned `target`/`target_parts` since Story 4.2; this story pins it with `test_fr51_move_preview_target_occupied_and_empty_is_read_only`.
  - `[low]` `[patch]` (intent) a kept *chosen* part is untested (only a kept back-part) — added a test that `move_parts` accepts a kept chosen part and the mark stays.
  - `[false]` `[reject]` (intent) `SwapMade` has fields beyond move numbers and `manual_move` was refactored — both are in the spec's Code Map/Design Notes; `test_manual_move.py` passes unchanged.
  - `[false]` `[reject]` (intent) frontend typecheck with `swap_made` not visible from the diff — `npm run typecheck` and `npm run lint` pass.

## Design Notes

- Event order for `swap`: `[SwapMade, *per_step_events]`, then the service appends `recommendations_outdated` as today. `move_parts`/`put_together` return only the per-step events.
- Validation runs once up front against `replay(data, state.steps).copy`; the per-step `check_manual_move` during expansion then cannot refuse (stock moves never remove a later part from its location because a part cannot be on both sides or twice). If it ever does, its `command_rejected` still leaves the input state untouched (pure apply).
- The 100-entry cap is a defensive request bound (epic-4 retro item 36's "max_length on inputs"), far above any real location's part count.

## Verification

**Commands:**
- `uv run --directory backend --locked pytest` -- expected: all pass, incl. new `test_fr51_*`.
- `npm run lint:py` and `uv run --directory backend --locked ruff format --check .` -- expected: clean.
- `npm run lint:imports` -- expected: all contracts kept.
- `npm run gen:api` then `git diff --stat frontend/lib/api/schema.ts` -- expected: only the new types.
- `npm run typecheck`, `npm run lint`, `npm run test:web` -- expected: pass.
- `npm run e2e -- --project=chromium` -- expected: existing specs green (no user-visible change, no new spec).

## Auto Run Result

**Summary:** The closed command union now has `move_parts`, `put_together` and `swap` (FR-51, AD-16). A new drag slice checks the whole command up front against the planning copy, then expands it into ordinary Manual steps through a shared kernel helper. That helper is the same check, FR-34 fold and event building that `manual_move` uses. Swap steps share `uuid5(command_id, "swap:1")`, and a swap returns `swap_made` followed by one `move_made`/`moves_combined`/`move_removed` event per step. Idempotency, the single version bump and revalidation come from the existing command service. The move preview already returned `target`/`target_parts` and is now pinned by an FR-51 test. The same-part FR-34/FR-38 rule (spec-8-1 deferral, epic-8 item 68) is unchanged, because drag steps go through the same fold with no special case. Epic-8 item 72 is left to Story 12.4.

**Files changed:**
- `backend/swp/domain/commands.py`: the three drag commands (100-entry cap, codes capped at `CODE_MAX_LENGTH`) and the `SwapMade` event.
- `backend/swp/domain/manual_steps.py` (new kernel module): `append_manual_step`, shared by the manual move and drag commands.
- `backend/swp/domain/moves.py`: `manual_move` now uses the kernel helper, with unchanged behaviour.
- `backend/swp/domain/drag.py` (new slice): validation in the spec's order and the step expansion.
- `backend/swp/domain/apply.py`: dispatches the three new commands.
- `backend/.importlinter`: `swp.domain.drag` added to the domain-slices contract.
- `backend/tests/rules/test_layer_rules.py`: `manual_steps` listed as a kernel module.
- `backend/tests/domain/test_mark_commands.py`: the closed-union test lists the new types.
- `backend/tests/domain/test_drag.py`: 35+ `test_fr51_*` domain tests covering the matrix, FR-33/FR-34 per step, swap id and round, keep marks, revalidation, and the answer-key swap with undo.
- `backend/tests/app/test_drag_api.py`: HTTP tests for one version bump, retry, 409 and 422, and the read-only preview.
- `frontend/lib/api/schema.ts`: regenerated.

**Review:** 25 findings: 0 high, 0 medium, 18 low, 7 false.
- **Patched (6 entries, all low):** the `SwapMade` docstring, a folded-swap-leg test, a swap-after-a-run round test, a kept-chosen-part test, a test that a drag outdates recommendations, and building `set(back)` once.
- **Deferred:** none.
- **Rejected, with reasons in the triage log:**
  - shared refusal sentences
  - blank codes and empty part strings
  - replay cost of 100+100 parts
  - extra fields not forbidden, the same as every existing command
  - mid-expansion failure test
  - repeated field block
  - test-helper error messages
  - seven false intent and edge claims

**Follow-up review:** not recommended (`false`). The patched entries were 0 high, 0 medium and 6 low.

**Verification:**
- `npm run lint:py`: clean.
- `ruff format --check`: 184 files formatted.
- `npm run lint:imports`: 5 contracts kept.
- `npm run typecheck` and `npm run lint`: clean.
- `npm run test:web`: 687 passed.
- `npm run gen:api`: stable across two runs; the diff adds only the new types.
- Full backend pytest: 996 passed, 2 skipped (after the patches).
- `tests/app` on a local postgres:17 container with `SWP_EXPECT_DIALECT=postgresql`: 314 passed, 3 skipped (before the patches; the patches touched only domain tests, a docstring and a set build).
- `npm run e2e -- --project=chromium`: 125 passed (before the patches; the only frontend change since then is a schema.ts doc comment).

**Residual risks:**
- When FR-34 folds a swap leg, `swap_made.move_numbers` still lists that step's number. Story 12.4 decides how the move list and swap marks treat a partly folded swap (epic-8 item 72).
- A hand-made request with a blank code or an empty part string gets an awkward refusal sentence.
- A very large drag command replays the log once per step.
