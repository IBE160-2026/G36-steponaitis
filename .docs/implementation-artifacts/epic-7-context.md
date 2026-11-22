# Epic 7 Context: Refine the plan: other location, keep in place, undo and reset

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Milestone 2 lets the planner adjust a plan without leaving the recommendations. The planner can apply a recommendation to another allowed location, decline a part for good with keep in place, undo moves one at a time with exact wording of what each undo will do, and reset the planning copy to start the rounds again while keeping all marks. The epic ends by running the whole hand-worked answer-key scenario through run 3 in both the domain and the API. That proves the refinements against known results, not only in isolated tests.

## Stories

- Story 7.1: Keep a part in place
- Story 7.2: Apply a recommendation with another location
- Story 7.3: Undo the last move
- Story 7.4: Reset the planning copy
- Story 7.5: Answer-key scenario through run 3

## Requirements & Constraints

- **Keep in place:** the planner marks or unmarks a part from a recommendation, the part panel or the roster row. In later runs a kept part gets no recommendation and no "no space" entry, and Apply all skips it. An open recommendation of the latest run for a kept part shows only under the **Kept in place** tab, not under Open or No space, and cannot be applied. A kept part can still be moved manually, and the mark stays. Kept parts are counted on the overview and on the tab.
- **Other location:** the allowed set holds locations that are empty in the planning copy now, were empty when the run was made, and fit the rule. Rule 1 needs a best location, rule 2 a location that is not best, and rule 3 a location in the partner's aisle, which must not be best for a slow-moving or dead-stock part. Virtual locations and the suggested location itself are never in the set. The move keeps the recommendation's rule, round and id, and the recommendation itself is never edited. Any other placement is a manual move. A location outside the set, or a recommendation that is outdated or not in the latest run, gets `command_rejected`.
- **Undo:** reverses only the most recent step, and can repeat back to the first. No move in the middle can be removed alone. Undo never reverses runs, best-location marks or keep-in-place marks. Undoing the second step of a combined move splits it back into the first move. Undoing a move-back restores the removed move, and its recommendation shows as applied again instead of `moved_back`. After any undo, every open recommendation of the latest run and the undone step's recommendation become `outdated(undo)`, sticky until the next run. Steps that share a `swap_id` are undone one at a time, latest first.
- **Reset:** deletes every step and every run, with their recommendations and "no space" entries. `next_move_number` goes back to 1, the current round becomes 0, and all marks are kept. The import never changes after any mix of moves, undos and resets, and the classes and pick groups stay the same.
- **Tests** name their FR (`test_fr31_*`, `test_fr32_kept_part_skipped_in_run_2`, `test_fr35_undo_after_later_run`, `test_fr35_reset_keeps_marks`, `test_sm1_answer_key_scenario`). FR-31 and reset use their own small fixtures. The answer key (`data/answer-key/expected.json` → `steps`) is read-only. The final state must give exactly the 14 effective moves of the answer key and its before/after counts. One extra run must then give no recommendations and only 6600 as "no space". The milestone 2 gate needs all answer-key tests, including FR-29 to FR-35.

## Technical Decisions

- **Commands** go through `POST /api/plans/{id}/commands` with `{command_id, base_version, type, …}` and are idempotent per `command_id`. This epic adds `set_keep`/`remove_keep` (part number), `apply_other_location` (recommendation `id` + location), `undo` (`expected_move_number`) and `reset`. Their events are `keep_set`, `keep_removed`, `step_undone`, `plan_reset{moves_removed}` and `recommendations_outdated{count, cause}`. A no-op, such as setting an existing keep mark or removing an absent one, returns 200 with no events and does not bump `version` or `last_edited_*`.
- **State:** keep marks are a set of part numbers in `PlanState`. They are not steps, so they never get a move number. "Kept in place" is worked out from the marks when a view is built and is never stored as a recommendation status. Only `open` and `outdated(cause)` are stored. `applied` and `moved_back` are worked out from the step log.
- **Step log is the only truth:** the planning copy, the effective moves and current locations always come from `domain.planning.replay(import, steps)`. Undo deletes the last step and replays. A mismatched `expected_move_number`, or an undo with no steps, gets `command_rejected`. `run_baseline(k)` is a replay of the steps with round < k, and it defines "empty when the run was made".
- **One implementation:** `domain.recommendations.other_locations(state, rec_id)` is the only code for the allowed set, returned in location-code order from `domain/ordering.py`. Both the listbox and `apply_other_location` use it.
- **`undo_preview`** is in the plan summary: `{move_number, part, from, to, effect: reverts_move(n) | splits_combined_move(n) | restores_removed_move(n)}`, built from the last step, or null when there are no steps. Every Undo surface renders it, worded once in `lib/copy`, and nothing else.
- **Server-authoritative:** the frontend never computes allowed sets, outdated status or undo effects. After each command, `lib/commands` refetches the `['plan', planId]` queries.
- **Answer-key helpers** map part-based phrases such as "apply 1200" to recommendation ids inside the tests only. There is no part-based command.
- After a backend change, regenerate `frontend/lib/api/schema.ts`, because CI fails on a diff.

## UX & Interaction Patterns

- **Recommendation detail action bar:** **Apply** (primary), **Other location ▾**, **Keep in place** and **Manual move…**, with `Alt+A` / `Alt+O` / `Alt+K` (`⌥` on Mac). The `Alt` shortcuts never fire while a text field has focus.
- **Other location ▾:** a listbox of the server's allowed set, with aisle, level and best / not best for each location. Arrow keys and typing only move the highlight, and `Enter` or a click applies. There is no free text. When the set is empty it says "No other location fits rule 1 right now." After an apply, the row reads "Applied · move N, round R", and the toast names the move with its from- and to-location.
- **Keep in place link:** sets the mark at once. The row moves to the Kept in place tab, and the toast says "<part> is kept in place. Remove the mark from the part or the Kept in place tab." The link then reads "Remove keep in place". The roster and tooltip show a pin glyph with "kept in place". An empty tab says "Nothing kept in place." A mark toast never offers Undo.
- **Undo last move** (tertiary) sits in the Recommendations header and the part panel, and there is also a launcher action. They show the preview wording: "Undo move 3: 9723950 A-03-04-02 → A-05-01-03", "Undo splits move 3: 9723950 returns to A-05-01-03" or "Undo restores move 4: 4410281 G-14-04-02 → A-02-01-01". With no moves, the control is `aria-disabled` with "No moves to undo". After an undo, the toast says "Undid move 3. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue." For the other effects, its first sentence is "Split move 3." or "Restored move 4." instead.
- **Toast Undo:** a toast about a move (apply, manual move, combined move) offers **Undo** only when Undo last move would reverse exactly that move. It sends `undo` with that move number.
- **Reset…** is an item in the "⋯" menu of the Recommendations header and in the launcher's Recommendations column. Its confirm dialog says "Reset removes all 18 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1." **Reset plan** is destructive (styled like primary, never red), and **Cancel** comes first with default focus. Cancel or `Esc` returns focus to "⋯". After a reset, the toast says "Plan reset. 18 moves removed; marks kept. The next run is round 1." The round chip then shows "Round 0", the "No run yet" state shows, and before/after shows "No moves yet: before and after are the same."
- Use the glossary verb "keep in place", never "reject", "dismiss" or "ignore".

## Cross-Story Dependencies

- Builds on Epic 4 (`replay`, the step log, FR-34 combining and move-back), Epic 5 (runs, `revalidate`, Apply all, the Recommendations page and its tabs) and Epic 6 (the reopen fixture, which already holds keep marks, and the launcher action registry). Undo and Reset are registered as launcher actions without changing the launcher's code.
- 7.1 must land before 7.5, because the answer key keeps 0500 in place before run 2. 7.3 also comes before 7.5, because the scenario undoes 1200 and then 0100's round 1 move. 7.5 also depends on 7.2 and 7.4 being in the command union.
- 7.3 tests `swap_id` undo with fixture state, since the drag and swap commands only arrive in Epic 12. Epic 8 checks the printed order of the final moves from 7.5.
