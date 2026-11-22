# Epic 5 Context: Get explained recommendations and apply them

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner runs the recommendations in rounds on the planning copy: rule 1, then rule 2, then rule 3, each with fixed limits and "no space" entries. Every recommendation gives its reason in numbers. The planner sees which recommendations are outdated and why, and applies them one at a time or all at once. Rule 1 is built first, as the teacher advised. The epic closes milestone 1 with a gate: the answer-key tests, the timing test, an end-to-end flow and a README demo on `data/sample/`. No milestone 2 work starts before the gate passes.

## Stories

- Story 5.1: Run rule 1 and store the run
- Story 5.2: Apply a recommendation
- Story 5.3: Rule 2 and rounds
- Story 5.4: Rule 3 with its limits
- Story 5.5: Reasons and outdated recommendations
- Story 5.6: Apply all
- Story 5.7: Recommendations page
- Story 5.8: Milestone 1 gate

## Requirements & Constraints

- **Run:** the planner can run at any time. Each run is a new round: 1 first, then the previous highest + 1. A run uses the current planning copy, the current best marks and the keep-in-place marks. Classes and pick groups come from the analysis. The same state always gives the same recommendations in the same order.
- **Shared limits (all rules, applied in order 1 → 2 → 3):**
  - only empty planning-copy locations are suggested, never virtual ones;
  - parts with no current location and kept-in-place parts are skipped;
  - each empty location goes to at most one part per run, and each part gets at most one recommendation;
  - a part that has a recommendation or a "no space" entry is skipped by later rules, silently: no block and no "no space".
- **Rule 1:** fast-moving parts outside best locations, taken by most picks first, ties in part-number text order. Each gets the first free empty best location in location-code order, or one "no space" entry.
- **Rule 2:** slow-moving and dead parts in best locations, taken by fewest picks first, then part number. Each gets the first free empty non-best location, or "no space". A best location that rule 2 frees goes to rule 1 only in a later run, after the move is applied.
- **Rule 3:** pick groups whose two parts sit in different aisles.
  - Order: most shared jobs first, ties by the lower part number and then the higher.
  - The mover is the part with fewer picks; on a tie, the later part number. The partner is never moved instead.
  - The mover gets the first free empty location in the partner's aisle. A slow or dead mover is never offered a best location; if only best locations are free there, it is "no space".
  - The group is blocked (no recommendation, no "no space") when the mover is in a best location, the mover already shares an aisle with another partner it has at least as many jobs with, the partner already has a recommendation this run, either part has no current location, or the mover is kept in place.
- **Reasons:**
  - rules 1 and 2: the class, the picks and the threshold from the plan's analysis;
  - rule 3: the partner, the partner's aisle and the shared jobs;
  - "no space": the rule and its plain cause.
- **Outdated:** an open recommendation of run *k* becomes outdated by the first true cause, in this order:
  1. `moved`: a round-*k* step of its part doesn't reference it;
  2. `filled`: the target is not empty (records the location and the move number that filled it);
  3. `marks`: a mark condition of its rule fails;
  4. `partner_aisle` (rule 3 only).

  Outdated is sticky until the next run and can't be applied. An applied recommendation whose move FR-34 removed shows the derived cause `moved_back`. Nothing else outdates a recommendation. Undo is Epic 7.
- **Apply:** applying creates a move with the recommendation's rule and its run's round. Apply all applies every open, not-kept recommendation of the latest run; "no space" entries are skipped.
- **Answer key:** run 1 gives rule 1 1100 → A-01-01-03, with 1200, 10240 and 2400 "no space". Rule 2 sends 4400, 9000, 0100 and 0500 to aisle B. Rule 3 gives:
  - round 1: 8100 → C-01-03-01, 8500 → D-01-03-01, 3050 → D-01-03-02 and 6600 "no space", plus the listed blocks and silent skips;
  - round 2: 1200/10240/2400 into aisle A and 8400 → D-01-03-03.

  Apply all after run 2 applies four steps in round 2. The details are in `data/answer-key/expected.json`. 0500's keep mark is set in a state fixture after run 1 (answer-key step 6, before run 2), because the keep command comes in Epic 7; run 1 still recommends 0500 under rule 2.
- **Tests** name their FR, for example `test_fr24_answer_key_round1`, `test_fr23_run_is_deterministic`, `test_fr27_kept_part_skipped`, `test_fr29_*` and `test_fr30_apply_all`. Rule modules are tested directly, with no DB, file, network or UI.
- **Performance:** a run takes under 5 s on `data/sample/`. One command plus the plan views take under 1 s. The import takes under 10 s (`tests/app/test_nfr8_timing.py`).

## Technical Decisions

- **Slices:** `domain/rules.py`, `domain/recommendations.py` and `modules/recommendations`. Allowed import-linter exceptions: `rules` may read the `classify`/`pick_groups` result types, and `recommendations` may use `rules`. Everything else imports only the kernel. The domain never imports `swp.store` or `swp.app`.
- **Run storage:** a run lives in `state.runs`. Its id is `uuid5(command_id, "run:<n>")`. It stores the round, `created_at`/`by` from `CommandContext`, its recommendations and its "no space" entries.
  - Recommendation `id = "<run_id>:<n>"` and `number = n`, assigned in rule order and then processing order (AD-14). They are never renumbered.
  - "No space" entries are keyed by `(run_id, part)` and have no number.
  - A new run deletes every earlier recommendation and "no space" entry that no step references, and keeps the earlier runs' metadata.
  - `current_round` is derived and never stored. A change to a stored shape needs an upcaster and a fixture.
- **Status:** only `open` and `outdated(cause)` are stored. "Applied" is derived from a step that references the recommendation. "Kept in place" is derived from the keep marks.
- **Run baseline:** `run_baseline(import, steps, k)` = `replay` of the steps with round < *k*. Steps after run *k* carry round *k*, and `domain.apply` asserts this.
- **Commands:** `run`, `apply {recommendation_id}` and `apply_all` go through the one `POST /api/plans/{id}/commands`.
  - Events: `run_done{round, recommendations, no_space}`, `move_made`, `apply_all_done{applied[], skipped[{number, cause}]}` and `recommendations_outdated{count, cause}`.
  - `apply` is rejected with `command_rejected` (409, plan unchanged) when the recommendation is outside the latest run, already applied or outdated.
  - Commands name recommendations by `id`, never by number or part.
- **Revalidate:** the service runs `domain.recommendations.revalidate` after every command. Apply all folds over the latest run in `number` order and revalidates after each apply. The whole fold is one transaction and one version bump.
- **Views:** `GET /api/plans/{id}/recommendations` returns the latest run's metadata, plus recommendations with status, number, reason data and, for applied ones, the move number and round. It also returns the "no space" entries, in server order, with `version`, all from one `replay`. The plan summary adds `apply_all_count`: open recommendations of the latest run minus kept ones.
- **Copy:** reasons and outdated causes go over the wire as structured data. Only `frontend/lib/copy` words them. The frontend never computes rules, outdated status or ordering.

## UX & Interaction Patterns

- **Header:**
  - a round chip ("Round 0" before the first run);
  - the run line: "Run … by planner · N recommendations · M no space";
  - the next-run line;
  - **Run recommendations** (secondary). While a run is in flight it reads "Running…", the button is disabled and the list is dimmed and inert. Afterwards focus moves to the first row and the page announces "Recommendations, round 1, …".
  - **Apply all (n)** opens a confirm popover and is disabled at n = 0.
- **Tabs:** Open · Applied · Outdated · No space, with the count in the tab name, including 0. Rows are grouped under rule bands, 5 per rule, then "Show N more under rule X". Identical "no space" lines collapse into "N more like this".
- **List:** a single-select `listbox` with `aria-controls` pointing at the detail panel; ↑/↓ select a row.
  - Applied rows show "Applied · move N, round R".
  - Outdated rows are hatched, with a struck-through target, a clock, "Outdated" and the cause.
  - "No space" rows show the NO SPACE chip.
  - BEST is shown as a tag, never by colour alone.
- **Detail:**
  - the eyebrow "SELECTED · #1 · RULE 1";
  - the reason as sentences with the numbers in bold;
  - from → to with BEST;
  - **Apply** (primary, `Alt/⌥+A`, never fires in text fields) and **Manual move…** (the shared ManualMoveDialog).

  On an outdated row, Apply is disabled and shows the cause as the reason.
- **Toasts:** applying shows "Applied · move 16, round 1 · …" without Undo. A mark change shows "Best-location marks changed · N recommendations are now outdated" with **View**, which opens Outdated.
- **Empty and edge states:** no best locations, no run yet, a run with no results, and a failed run ("Nothing changed: still round 1", with the button refocused).
- **Flow bar:** Recommendations is checked when the latest run has no open recommendation left.

## Cross-Story Dependencies

- **Earlier epics:**
  - Epic 2: classes and pick groups.
  - Epic 3: marks, `is_best` and the command pipeline.
  - Epic 4: the step log, `replay`, `manual_move`, FR-34 combine/remove, ManualMoveDialog and before/after.
- **Within the epic:**
  - 5.1 (run storage, rule 1) is the base.
  - 5.2 needs 5.1.
  - 5.3 and 5.4 extend `rules` and use `run_baseline`.
  - 5.5's `revalidate` gates 5.2's and 5.6's apply.
  - 5.7 consumes everything.
  - 5.8 needs all of them.
- **Later epics:** 5.8 marks answer-key steps 15–20 as skipped, deferred to Epic 7 (undo, reset, keep, other location) and Epic 8 (move list). The skip reason names the story.
