---
title: 'Story 7.1: Keep a part in place'
type: 'feature'
created: '2026-11-22'
baseline_revision: '4427070cc6188dfae814e7bd6e9b6bc97d76c0b9'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Keep in place links lose keyboard focus while a command saves, because Button remounts into its disabled wrapper.
    evidence: |-
      components/common/button.tsx renders a bare <button> when enabled and a <span><button aria-disabled> when disabledReason is set; the element remounts, so focus on the roster or part-panel keep link drops to body during the save. Apply and Manual move… share the same behaviour (pre-existing).
    location: >-
      frontend/components/common/button.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `PlanState.keep_marks` exists and the rules, Apply and Apply all already honour it, but nothing can set it: there is no command, and no screen shows or changes a keep-in-place mark (FR-32, UX-DR37). The answer-key tests set the mark by hand in the state.

**Approach:** Add the `set_keep` / `remove_keep` commands in a new domain slice `swp.domain.keep`, with `keep_set` / `keep_removed` events. Expose the mark in the views: the roster flag, the part detail, the summary count, and the recommendations view (a derived `kept` status and a list of kept parts). Then add one shared "Keep in place" / "Remove keep in place" link to the recommendation detail (`Alt+K`), the part panel and the roster row, and a **Kept in place** tab.

## Boundaries & Constraints

**Always:**
- Commands (kernel `domain/commands.py`): `SetKeep {type:"set_keep", command_id, base_version, part}` and `RemoveKeep {type:"remove_keep", …, part}`. `part` is `Field(min_length=1, max_length=CODE_MAX_LENGTH)`. Events: `KeepSet {type:"keep_set", part}` and `KeepRemoved {type:"keep_removed", part}`. Add all four to the closed unions, and dispatch them in `domain/apply.py`.
- Handlers live in the new `backend/swp/domain/keep.py`: `set_keep(state, command, ctx, data, analysis)` and `remove_keep(…)`.
  - `set_keep` on a part that `planning.listed_parts(data, analysis)` does not list raises `DomainError("command_rejected", "No part <part> in this plan.")`.
  - A part that is already kept, or a remove of an absent mark, returns `Applied(state=state)` with no events. The command service then returns 200 with the same version and does not write.
  - Otherwise `keep_marks` gains the part (appended) or loses it. Steps, `next_move_number`, runs and best marks stay untouched.
- Add `swp.domain.keep` to the `domain-slices` independence contract in `backend/.importlinter`.
- A kept part may still be moved manually. `manual_move` is not changed, and the mark stays after the move.
- Views stay server-computed (AD-3). Every list below that names parts uses `ordering.part_number_order`.
  - `PartRow.kept_in_place = part in state.keep_marks` in `views/parts.py`.
  - `PartDetail` gains `kept_in_place: bool`.
  - `PlanSummary` gains `kept_in_place: int`, the number of keep marks.
  - `RecommendationRow.status` becomes `open | applied | kept | outdated`. The order of precedence is applied, then outdated, then kept, then open, so `kept` = an open, unapplied, not-outdated recommendation whose part is kept. Nothing new is stored (AD-7).
  - `NoSpaceRow` gains `kept_in_place: bool`.
  - `RecommendationsView` gains `kept_parts: list[KeptPartRow]`. These are the kept parts that have neither a `kept` recommendation row nor a kept "no space" row in the latest run, in part-number order. Each row has `part`, `description`, `movement_class`, `picks`, `from_location` (the current location in the replayed copy, or None) and `from_best`. The list is filled even when there is no run yet.
  - Invariant: kept recommendation rows + kept "no space" rows + `kept_parts` = exactly one entry per keep mark.
- Run `npm run gen:api` and commit `frontend/lib/api/schema.ts`.
- Frontend:
  - Add a shared `components/common/keep-in-place.tsx`, used by all three surfaces. It holds the hook `useKeepInPlace(planId)` → `toggle(part, kept)`, which sends `set_keep` or `remove_keep` through `usePlanCommands`. On a confirmed outcome with a `keep_set` event, it toasts `keptToast(part)` = "<part> is kept in place. Remove the mark from the part or the Kept in place tab.". On `keep_removed`, it toasts `keepRemovedToast(part)` = "<part> is no longer kept in place.". A mark toast has no Undo action.
  - The same file holds the button `KeepInPlaceButton({kept, savingReason, onClick, keyShortcut?})`: Button `variant="link"`, label "Keep in place" or "Remove keep in place", disabled with the saving reason.
  - The copy lives in `lib/copy`.
- Recommendations page:
  - Tabs in this order: Open · Applied · Kept in place · Outdated · No space. `RecommendationsTab` gains `"kept"`, and the URL value is `?tab=kept`.
  - The Kept tab lists the `kept` recommendation rows and the kept "no space" rows under their rule bands. After them comes a band for `kept_parts` (tag "Kept", name "No open recommendation in this run", note "Part-number order").
  - The No space tab lists only "no space" rows that are not kept.
  - Tab count: open, applied and outdated count their rows. Kept counts all three sources; it always equals the number of kept parts. Its accessible name is "Kept in place, N parts" ("part" when N is 1). The empty text is "Nothing kept in place.".
- A kept row's line shows "Kept in place". Its detail shows "Kept in place" with a pin icon. **Apply** is disabled with the reason "<part> is kept in place.". The link reads "Remove keep in place".
  - The detail of an open recommendation shows the "Keep in place" link between Apply and Manual move…. So does a no-space detail (before Manual move…) and a kept-part detail. Applied and outdated details have no keep link.
  - `Alt+K` / `⌥K` (by `event.code === "KeyK"`) toggles the mark of the selected item in the list or detail region, but only when that item shows the link. It never fires from a text field (`isTextEntry`). The link has `aria-keyshortcuts="Alt+K"`.
  - After a keep from the Open or No space tab, focus follows the same pending-focus rule as Apply (the row leaves the tab).
- Part panel: under the facts, show `KeepInPlaceButton` from `detail.kept_in_place`, before Manual move…. When the part is kept, a pin icon and "kept in place" show beside it.
- Roster "Kept in place" column: a kept row shows the pin icon, "kept in place" and a "Remove keep in place" link. A row that is not kept shows a "Keep in place" link. A click on a link does not open the part panel (DataTable already skips buttons).
- Overview: a fact "Parts kept in place" with `summary.kept_in_place`.
- Answer-key tests: answer-key step 6 sends `SetKeep` through `domain.apply`. Remove the "keep is Epic 7" workarounds in `tests/domain/answer_key.py` (helper `keep_step`), `test_answer_key.py`, `test_rules.py::test_fr25_answer_key_rounds` and `test_apply_all.py`. Add `test_fr32_kept_part_skipped_in_run_2`.
- Every test names its FR/UX-DR (SM-7). The new e2e spec `frontend/e2e/keep-in-place.spec.ts` imports `test`/`expect` from `./support/test` and names its journeys `uj7 …` / `uj1 …`.
- Retro items: the Apply all toast stays as it is (epic-5 item 42 is not in scope). Add new strings to `lib/copy`, not to the page, and do not split the page further (epic-5 item 46 stays open). Do not change `action_items` statuses in `sprint-status.yaml`.

**Never:**
- No stored `kept` status and no step or move number for a keep mark. Undo is Story 7.3 and is not built here.
- No change to rules, `apply_all`, the apply-rejection text or `manual_move`. No wall tooltip (Epic 10). No other location (7.2). No new dependency and no DB migration (keep_marks is already in schema v2).
- No edits under `.docs/planning-artifacts/`, `data/`, or `.logs/`. No session logs, no push.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set | `set_keep 0500`, not kept | `keep_marks` gains 0500; events `[keep_set]`; version +1 | — |
| Repeat set | 0500 already kept | 200, events `[]`, version unchanged, `last_edited_*` unchanged | — |
| Remove | `remove_keep 0500`, kept | mark gone; `[keep_removed]` | — |
| Remove absent | not kept | 200, no events, no bump | — |
| Unknown part | `set_keep NOPE` | 409 `command_rejected` | state unchanged |
| Kept open rec | run 1, then keep 0500 | rec #5 status `kept`; Apply → 409; `apply_all` skips (cause `kept`); summary `apply_all_count` −1 | — |
| Kept no-space part | keep 1200 after run 1 | its no-space row `kept_in_place: true`; shown in Kept tab, not No space | — |
| Next run | 0500 kept, run 2 | 0500 has no rec and no no-space; listed in `kept_parts` | — |
| Manual move of kept part | kept 9100, manual move | step made; 9100 still kept | — |
| Unkeep | remove 0500 while rec #5 still holds | rec #5 back to `open` | — |

</intent-contract>

## Code Map

- `backend/swp/domain/state.py:128` `keep_marks: list[str]` -- already stored (schema v2); no change.
- `backend/swp/domain/commands.py` -- Command/Event unions (add 2+2); `CODE_MAX_LENGTH` from `values.py`.
- `backend/swp/domain/marks.py` -- pattern for no-op handlers; new `domain/keep.py` mirrors it.
- `backend/swp/domain/apply.py:_dispatch` -- add the two cases (`data`, `analysis` passed for the listed-part check).
- `backend/swp/domain/planning.py` `listed_parts`, `replay`, `current_location`, `is_best`, `latest_run`; `ordering.part_number_order`.
- `backend/swp/domain/rules.py:84,120,155`, `recommendations.py:174,239`, `views/summary.py:apply_all_count` -- already skip/reject kept parts; read-only.
- `backend/swp/domain/recommendations.py` `_status` (:414), `_no_space_row` (:459), `build_recommendations_view` (:485), `RecommendationRow`/`NoSpaceRow`/`RecommendationsView` -- add `kept`, `kept_in_place`, `kept_parts`.
- `backend/swp/domain/views/parts.py:83` hardcoded `kept_in_place=False`; `PartDetail` (:~105).
- `backend/swp/domain/views/summary.py` `PlanSummary`, `build_summary` -- add `kept_in_place`.
- `backend/swp/app/commands.py` -- no-op path already returns without a write; no change expected.
- `backend/.importlinter` `domain-slices` contract.
- `backend/tests/domain/answer_key.py:84-87` keep workaround comment; `test_answer_key.py:5,131-133`; `test_rules.py:296`; `test_apply_all.py:46,105`; `test_mark_commands.py` (pattern for command tests); `tests/app/test_commands.py` (API no-op/version pattern); `tests/app/test_recommendations_api.py`, `test_parts_api.py`, `test_plan_summary.py`.
- `frontend/lib/api/schema.ts` (generated), `frontend/lib/api/plans.ts` (add `KeptPartRow` type alias).
- `frontend/lib/copy/index.ts` -- add keep strings/toasts.
- `frontend/lib/view-state/urls.ts:103-117` `RecommendationsTab`, `RECOMMENDATIONS_TABS`.
- `frontend/modules/recommendations/list.ts` -- `TABS`, `EMPTY_TAB`, `tabItems`, `tabCounts`, `tabName`, `groupByRule`, `ListItem`, `itemId`, `optionName`, `isApplyShortcut` (add `isKeepShortcut`).
- `frontend/modules/recommendations/recommendations-page.tsx` -- `RowLine`, `Detail` (:187), `apply`/`requestFocus` pattern (:441-451), `onRegionKeyDown` (:460).
- `frontend/components/common/part-panel.tsx` `PartPanel`/`PartMoveAction`; `components/common/button.tsx` (`variant="link"`); `components/common/icons.tsx` (`pin`); `components/common/toast.tsx` `showToast`.
- `frontend/modules/parts/parts-page.tsx` `COLUMNS` kept_in_place column; `modules/overview/overview-page.tsx` facts.
- `frontend/tests/recommendations.test.tsx`, `parts.test.tsx`, `part-panel.test.tsx`, `copy.test.ts`, `view-state.test.ts` -- extend; fixtures need the new fields.
- `frontend/e2e/support/{test,sample-plan,plan-api}.ts`; `e2e/recommendations-page.spec.ts` (command helper pattern).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/commands.py`, `backend/swp/domain/keep.py`, `backend/swp/domain/apply.py`, `backend/.importlinter` -- commands, events, handlers, dispatch, contract.
- `backend/swp/domain/recommendations.py`, `views/parts.py`, `views/summary.py` -- kept fields in the views.
- `backend/tests/domain/test_keep.py` -- set/remove/no-op/unknown part/manual move keeps the mark/no step or move number (FR-32, FR-35 note).
- `backend/tests/domain/*answer_key*`, `test_rules.py`, `test_apply_all.py` -- send `SetKeep`; add `test_fr32_kept_part_skipped_in_run_2` (run 2 result equals expected step 13 with 0500 absent from recommendations and no_space).
- `backend/tests/domain/test_recommendations.py` (or a new view test) -- `kept` status, `kept_in_place`, `kept_parts`, the one-entry-per-mark invariant, unkeep returns `open`.
- `backend/tests/app/` -- API: set_keep 200 + version bump, repeat 200 same version and `last_edited_at` unchanged, unknown part 409, apply on a kept rec 409, parts/part/summary/recommendations fields.
- `frontend/lib/copy`, `lib/view-state/urls.ts`, `lib/api/plans.ts`, `components/common/keep-in-place.tsx`, `components/common/part-panel.tsx`, `modules/parts`, `modules/overview`, `modules/recommendations/*` -- UI as above.
- `frontend/tests/*` -- Vitest for tab items/counts/names (FR-32, UX-DR32/35), shortcut guard (UX-DR8), keep button labels, roster column, overview count, part panel link.
- `frontend/e2e/keep-in-place.spec.ts` -- `uj7 keeps a part in place from the part panel` (Parts → open panel → Keep in place → toast text → roster row shows "kept in place" → overview count 1 → Remove keep in place) and `uj1 keeps a recommendation in place` (mark aisle A, run via API, select the first open row, `Alt+K` → row on Kept tab with count, Apply disabled, Apply all count drops by one, Remove keep in place → back on Open).

**Acceptance Criteria:**
- Given a plan, when `set_keep`/`remove_keep` are posted, then the matrix outcomes hold through `POST /api/plans/{id}/commands`.
- Given the answer key with step 6 sent as `set_keep 0500`, when run 2 is made, then it equals the expected run 2 with 0500 left alone.
- Given a kept part with an open recommendation, when the Recommendations page renders, then the row is under Kept in place (not Open, not No space), Apply is disabled with "<part> is kept in place.", and Apply all excludes it.
- Given the recommendation detail, the part panel or the roster row, when Keep in place is activated (or `Alt+K` in the recommendations region), then the toast reads "<part> is kept in place. Remove the mark from the part or the Kept in place tab." and the link reads "Remove keep in place"; `Alt+K` in a text field does nothing.
- Given kept parts, when the roster, overview and Kept tab render, then the roster row shows the pin with "kept in place", the overview shows the count, and the tab count equals the number of kept parts, or the tab says "Nothing kept in place." when there are none.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 28 findings — high 0, medium 9, low 12, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) Outdated-over-kept precedence in `_status` untested — added `test_fr32_outdated_wins_over_kept` (kept 1100, target filled by a manual move, revalidated: `outdated`, listed once in `kept_parts`).
  - `[medium]` `[patch]` (verification-gap) Kept-part and kept "no space" detail branches never rendered — added Vitest cases asserting the `Alt+K` "Remove keep in place" link, the pin line and no Apply.
  - `[low]` `[patch]` (verification-gap) `emptyRun` change untested — grouped with the blind-hunter emptyRun finding; tested after the fix below.
  - `[medium]` `[patch]` (verification-gap, other) Kept parts before the first run are not reachable on the Recommendations step — grouped with the no-run entry below; fixed there.
  - `[medium]` `[patch]` (blind) Outdated over kept never tested — same root cause as the verification-gap row; same test added.
  - `[false]` `[reject]` (blind) `test_fr32_kept_part_skipped_in_run_2` does not prove the keep caused the skip — run 2 is compared with the expected run, which leaves 0500 out although its rule-2 condition still holds (slow part in best A-01-03-01); without the keep the equality fails, as the original `test_fr25` needed the keep to pass.
  - `[low]` `[patch]` (blind) `emptyRun` now hides the empty-run sentence when parts are kept — `emptyRun` restored to its original meaning; tabs render below the sentence when `kept_parts` is non-empty; Vitest case added.
  - `[medium]` `[patch]` (blind) Before any run the toast points to a Kept tab that does not exist — the page now shows the "No run yet" text and the tabs when kept parts exist; Vitest case added.
  - `[low]` `[patch]` (blind) `KeptLine` duplicates `KeptInPlaceMark` — `KeptInPlaceMark` takes optional label/size/className and replaces `KeptLine`.
  - `[low]` `[reject]` (blind) The e2e `command` helper is copied again — the existing pattern across five specs; moving it is open epic-6 retro item 54.
  - `[false]` `[reject]` (blind) The roster now has two tab stops without a decision — the link is tabbable only in the active row, the same as the saved-plans row menu (Story 6.x); `parts-roster.spec.ts` pins it.
  - `[low]` `[reject]` (blind) The `Alt+K` handler is untested through the page — the e2e `uj1` presses `Alt+K` and checks that the row moves tab and the link flips; the pure guard is unit-tested.
  - `[false]` `[reject]` (blind) `remove_keep` accepts unknown parts — by design: the matrix row "Remove absent" is a no-op, and an unknown part is never kept.
  - `[low]` `[patch]` (blind) The remove-absent API check does not cover `last_edited_*` — the test now compares `_row` before and after.
  - `[false]` `[reject]` (blind) `test_keep_api.py` imports private helpers from other test modules — the established pattern (`test_apply_all_command.py` does the same); no named harm.
  - `[low]` `[reject]` (blind) `groupByRule`/`BandView.rule` naming and the `bandMeta` fallback — cosmetic; keys are typed and the fallback is unreachable.
  - `[low]` `[reject]` (blind) `keptApplyReason` repeats the server text — the spec requires this disabled reason on the client, as `applyReason` does for outdated rows.
  - `[medium]` `[patch]` (edge) Kept parts before any run are never shown — same root cause as the no-run entry; fixed there.
  - `[low]` `[reject]` (edge) The run line's "N no space" differs from the No space tab count when a no-space part is kept — the run line reports what the run produced; the tab reports the current state.
  - `[medium]` `[defer]` (edge) Roster keep link: focus drops to body while saving, because `Button` swaps to its disabled wrapper and remounts the element — a pre-existing `Button` behaviour that also affects Apply and Manual move….
  - `[medium]` `[defer]` (edge) Part panel keep link loses focus the same way — same pre-existing `Button` remount.
  - `[medium]` `[patch]` (edge) The toast names a Kept tab that is not rendered before the first run — same as the no-run entry; fixed there.
  - `[false]` `[reject]` (intent) AC5 tooltip pin not implemented — no part tooltip exists in the product yet (the wall tooltip is Epic 10), so no surface shows a part without the pin.
  - `[low]` `[reject]` (intent) The row shows "Kept in place" with no inline Remove — EXPERIENCE.md puts actions in the detail action bar, and the listbox options hold no buttons.
  - `[false]` `[reject]` (intent) Retro items 41/44/45 are not addressed — 41 and 44 are Justas decisions; 45 concerns `_marks_fail`, which this diff does not change.
  - `[low]` `[reject]` (intent) The `Alt+K` text-field guard is only unit-tested — the guard is the shared pure predicate the handler calls.
  - `[low]` `[reject]` (intent) A manual move of a kept part is tested only in the domain — `manual_move` is unchanged and the mark lives in state; the domain test is the authority.
  - `[false]` `[reject]` (intent) The Kept tab is wider than the literal AC2 — chosen on purpose in Design Notes from AC5's "Nothing kept in place." and FR-32's "listed with their count".

## Design Notes

**Why the Kept tab lists every kept part.** The AC says that the Kept in place tab shows "Nothing kept in place." when it is empty, and the toast says the mark can be removed from that tab. If the tab showed only kept *open recommendations*, it would say "Nothing kept in place." after run 2 even though 0500 is still kept (rules skip kept parts, so they have no recommendation). The tab would then be wrong, and the mark could no longer be removed from it. So the tab shows each kept part exactly once:
- as its kept recommendation, when the latest run has an open one;
- otherwise as its kept "no space" row;
- otherwise in the trailing "Kept" band from `kept_parts`.

This also fits FR-32: "Kept parts are listed with their count".

**`kept` is a view status.** It is never stored, so removing the mark makes a still-valid recommendation `open` again without a new run. AD-7's stored statuses stay `open` / `outdated`.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` and `uv run --directory backend --locked ruff format --check .` -- expected: all pass.
- `npm run gen:api` then `git diff --exit-code frontend/lib/api/schema.ts` (after staging) -- expected: no diff.
- `npm test` -- expected: pytest and Vitest pass.
- `npm run e2e -- --project=chromium` -- expected: all pass, including `keep-in-place.spec.ts`.

## Auto Run Result

Status: done

**Summary.** A planner can keep a part in place, and remove the mark again (FR-32, UX-DR37).
- `set_keep` / `remove_keep` commands go through `domain.apply`. They emit `keep_set` / `keep_removed`; repeats are no-ops, and unknown parts are rejected.
- Views carry the kept state:
  - a derived `kept` recommendation status;
  - `kept_in_place` on "no space" rows, roster rows and the part detail;
  - `kept_parts` on the recommendations view;
  - `kept_in_place` (a count) on the summary.
- The UI has one shared Keep in place / Remove keep in place link. It is on the recommendation detail (with `Alt+K`), the part panel and the roster row.
- A Kept in place tab lists every kept part once. The overview shows the count.
- Answer-key step 6 now uses the real command, and `test_fr32_kept_part_skipped_in_run_2` covers it.

**Files changed**
- `backend/swp/domain/keep.py` (new): the keep handlers.
- `backend/swp/domain/commands.py`, `apply.py`, `backend/.importlinter`: commands, events, dispatch, the slice contract.
- `backend/swp/domain/recommendations.py`, `views/parts.py`, `views/summary.py`: the kept fields in the views.
- `backend/tests/domain/test_keep.py`, `backend/tests/app/test_keep_api.py` (new): domain and HTTP tests. The answer-key helpers and tests use `keep_step`.
- `frontend/components/common/keep-in-place.tsx` (new): the hook, link, mark and toasts.
- `frontend/components/common/part-panel.tsx`, `modules/parts`, `modules/overview`, `modules/recommendations/*`: the UI surfaces.
- `frontend/lib/copy`, `lib/view-state/urls.ts`, `lib/api/plans.ts`, `lib/api/schema.ts`: copy, the `?tab=kept` value and the types.
- `frontend/tests/*`: Vitest. `frontend/e2e/keep-in-place.spec.ts` (new): `uj7`, `uj1`. `frontend/e2e/parts-roster.spec.ts`: the Tab order with the keep link.

**Review findings.** 28 findings: 6 patch entries (3 medium, 3 low), 1 defer entry (2 medium rows), 21 rejected or false. Every row and its reason is in the Review Triage Log.

**Follow-up review: recommended (true).** Three medium entries were patched after the main review:
- the no-run and empty-run tab rendering;
- the kept-part and kept no-space detail tests;
- the outdated-over-kept test.

The page rendering change was not re-reviewed. Focus during a keep save is a known deferred issue.

**Verification.** All passed on the final tree:
- `npm run lint:py`, `npm run lint:imports`, `ruff format --check`, `npm run lint`, `npm run typecheck`.
- `npm run gen:api` gives no schema diff.
- `npm test`: 598 pytest passed (12 skipped), 326 Vitest passed.
- `npm run e2e -- --project=chromium`: 76 passed.

**Residual risks**
- Keep links lose focus while saving (deferred, `Button` remount).
- The wall tooltip pin is left to Epic 10.
- Retro items 42, 45 and 46 stay open.
