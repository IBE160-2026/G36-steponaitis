---
title: 'Issue-triage fixes: four bugs and three accepted decisions'
type: 'bugfix'
created: '2026-11-26'
status: 'done'
baseline_commit: '15b9ae227538533343d69bb5020d8538569d41b0'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/.docs/implementation-artifacts/issue-triage-2026-11-26.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The 2026-11-26 triage confirmed four low bugs and three accepted decisions that need code or tests: (138) the Undo action of a move toast names the undone move's round, not the round of the recommendations it outdated; (220) the Categories picker compares text with `trim().toLocaleLowerCase()` while the server uses `category_key` (Cf strip, NFC, whitespace collapse, casefold); (85) a transaction code written as text "00"/"0.0" forms a pick-group job; (86) one huge job makes pair counting quadratic, a denial-of-service risk on the public URL; (102) `set_best_mark` accepts marks that cover no location and the Best locations step is ticked by any stored mark; (115) no test pins that a rule-3 partner is not moved by a weaker group in the same run; (121) no test pins that an applied recommendation stays applied when its part is moved on in the same round.

**Approach:** Small, separate fixes in their own slices, each with a test named by its FR/issue; the author accepted all triage recommendations on 2026-11-26.

**Decision (author, 2026-11-26, after review):** 115 — fix rule 3. The FR-26 loop limit ("the mover is already in the aisle of another partner it shares at least as many jobs with") is judged on aisles after this run's earlier rule-3 moves, not the pre-run aisles, so a weaker group never pulls a part away from a stronger partner that was just moved to it. If the answer-key tests change, stop and report instead of editing them.

## Boundaries & Constraints

**Always:** Server words outcomes (AD-3): the outdated round comes from the server event. Keep `swp.domain` pure (stdlib + pydantic). Name tests with their IDs (`test_fr19_…`, `it("fr45_…")`). Update the spine/epics where a rule changes (AD-4/AD-7/FR-19/FR-21/FR-45).

**Never:** No migration, no change to stored state shape, no change to how manual moves or rules choose targets. Do not change other toasts that use `recommendations_outdated`. Do not weaken existing tests; adjust only those that assert the old behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 138 toast undo after a newer run | move 2 made in round 1, recommendations run again (round 2), toast Undo on move 2 | "Undid move 2. Unapplied recommendations of round 2 are now outdated. …" | N/A |
| 85 zero codes | Issue Part lines with code "0", "00", "000", "0.0", " 0 " | none forms a job | N/A |
| 85 non-zero | codes "10", "0.5", "A0" | each forms a job as before | N/A |
| 86 huge job | a job with more than 100 distinct considered parts | the job adds no pairs; other jobs count as before | N/A |
| 102 mark hits nothing | `set_best_mark` aisle "ZZ" / level "9" in aisle "A" with no such level / unknown location | 422 `validation_failed`, state and version unchanged | toast with the server message |
| 102 step tick | marks stored but none covers a location (old plan) | Best locations step unchecked | N/A |
| 115 rule-3 partner | groups M–P (10 jobs; M moves to P's aisle) then P–X (6 jobs; P has fewer picks) in one run | P gets no rule-3 recommendation and no "no space" | N/A |
| 220 picker | aisle shows "Olje", rule category "OLJE​" or "olje  " | not offered | N/A |

</frozen-after-approval>

## Code Map

- `backend/swp/domain/commands.py:307` `RecommendationsOutdated` -- add `round: int` (round of the latest run whose recommendations were outdated).
- `backend/swp/domain/history.py:84-85` undo; `backend/swp/domain/recommendations.py:163,380` other emitters -- pass the latest run's round (`latest_run(state)`).
- `frontend/lib/commands/undo.ts:15-38,62` -- `undoToastText`/`sendUndo` take the round from the `recommendations_outdated{cause:"undo"}` event; drop the `round` parameter; callers `lib/launcher/index.ts:142`, `components/common/undo-last-move.tsx:39`. `frontend/lib/copy/index.ts:324` `undoneToast` keeps its signature.
- `npm run gen:api` -- regenerates `frontend/lib/api/schema.ts` after the event change.
- `backend/swp/domain/pick_groups.py:16-33` -- replace `!= NO_JOB_CODE` with an all-zero check (`^0+(\.0+)?$` after strip); add `MAX_JOB_PARTS = 100` and skip larger jobs in `count_shared_jobs`. Sample data max job size is 4.
- `backend/swp/domain/marks.py:14` + `backend/swp/domain/apply.py:94` -- pass `data`; reject with `DomainError("validation_failed", …)` when no `data.locations` entry is covered. Extract the per-location match from `planning.py:497 covering_marks` into `mark_covers(mark, code, loc)` and reuse it.
- `backend/swp/domain/views/summary.py:101-110,168` -- `steps()` gets `best_count`; "best-locations" checked when `best_counts(...).best > 0`.
- `frontend/modules/categories/aisle-categories-tab.tsx:33-37` -- `categoryKey()` mirroring `domain/categories.py:177 category_key` (strip `\p{Cf}`, NFC, split on `\s+`, join " ", casefold via `toUpperCase().toLowerCase()`, NFC).
- `backend/swp/domain/rules.py:150-167` -- loop limit for 115 (test only). Tests: `backend/tests/domain/test_rules*.py`, `test_recommendations*.py`, `test_pick_groups*.py`, `test_best_marks.py`; `frontend/tests/undo-last-move.test.tsx`, `categories.test.tsx`.
- Do not change: `import_.py` parsing, stored `PlanState`.

## Tasks & Acceptance

**Execution:**
- [x] backend event + emitters + `gen:api` + frontend undo/callers + tests -- fix 138.
- [x] `pick_groups.py` + tests -- fix 85 and 86.
- [x] `planning.py`, `marks.py`, `apply.py`, `views/summary.py` + tests (fix any test that sets a mark covering nothing) -- 102.
- [x] `aisle-categories-tab.tsx` + `categories.test.tsx` -- 220.
- [x] domain test pinning FR-26 partner rule (115) and view test for applied-then-moved-on (121) -- both done; 115 fixed in rule 3 after the author's decision.
- [x] `.docs/planning-artifacts` spine/epics -- record the new rules (FR-19 zero codes + job cap, FR-21 422 + step tick, AD-7 115/121 as built).

**Acceptance Criteria:**
- Given the I/O matrix, when the backend and frontend unit tests run, then each row has a passing test named with its ID.
- Given the full suite, when `npm test`, all lint commands, `npm run trace` and `npm run e2e` (chromium, firefox, msedge) run, then all pass with 0 failed, 0 flaky, 0 skipped beyond the existing uj5 deploy placeholder.

## Implementation Notes

- 138: `RecommendationsOutdated.round` is the latest run's round at every emitter (undo, revalidate, apply all). `undoToastText`/`sendUndo` take the round from the `undo` event; `UndoLastMove` lost its `round` prop. The answer-key step 15 undo now reports round 2 (it outdates run 2's recommendations), so `test_answer_key`/`test_undo` expectations moved from round 1 to 2.
- 85/86: zero code = `^0+(\.0+)?$` after strip; `MAX_JOB_PARTS = 100` applied in `count_shared_jobs`.
- 102: `mark_covers` extracted from `covering_marks`; `set_best_mark` checks an existing mark (no-op) first, then coverage. Messages: "Aisle ZZ has no locations.", "Aisle A has no level 9.", "No aisle has level 9.", "Location X does not exist.". Tests that set marks on locations missing from their import were fixed (`test_mark_commands` DATA, three `tests/app/test_commands.py` tests, `test_replay` monkeypatched handler signature). Frontend toast already comes from the command client's reject path; pinned by `fr21_issue102_…` in `commands.test.tsx`.
- 115: STOPPED, not pinned. A domain test shows the opposite of the accepted decision: with groups M–P (10 jobs, M moves to P's aisle) and P–X (6 jobs, P has fewer picks than X), rule 3 in the same run also moves P to X's aisle. `handled` only holds movers and `_blocked`'s loop limit reads pre-run aisles. No rule change made and AD-7 not amended for 115; needs the author's call.
- 121: pinned by `test_fr29_issue121_applied_then_moved_on_stays_applied_with_effective_move`; AD-7 records it.

- 115 (after the author's decision): fixed in `rules.py` (`_blocked` reads `moved_to` via `_aisle_after`); pinned by `test_fr26_issue115_weaker_group_never_moves_a_partner_just_joined`; answer-key tests unchanged. FR-26 updated in the PRD and epics, AD-7 "Rule-3 loop limit".
- Final gate 2026-11-26: npm test, all lints, typecheck, trace green; e2e 453 passed, 0 failed, 0 flaky in chromium, firefox, msedge (3 skipped = uj5 deploy placeholder).

## Spec Change Log

- Loop 1 (intent gap, review row 14): the author decided 115 (fix rule 3); decision and I/O row added to the frozen block; no code reverted because none existed for 115. KEEP: every other fix and the four review patches.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence / route |
|---|---|---|---|---|
| 1 | blind, edge | `RecommendationsOutdated.round` required; old stored results fail in `_stored_result` | medium | `app/commands.py:37` re-validates `recent_commands`; patch: default 0 + test |
| 2 | blind | PRD FR-19/FR-21 not updated | low | prd.md still says only code `0`; patch (direct doc correction) |
| 3 | blind, edge | zero codes with comma/sign (`0,0`, `-0`, `+0`) still form jobs | low | regex `0+(\.0+)?`; plausible in Norwegian exports; patch (direct regex correction) |
| 4 | edge | non-zero codes not stripped before keying | low | importer strips text identifiers (`import_.py:149`); rejected: unreachable in practice |
| 5 | blind, edge | jobs over MAX_JOB_PARTS dropped without a signal | low | sample max job is 4 parts; a signal needs new Analysis surface; rejected |
| 6 | blind | "Aisle ZZ has no level 1." when aisle ZZ is absent | low | cosmetic API wording, UI only offers real aisles; rejected |
| 7 | blind | `_covers_nothing` has no exhaustive fallback | low | patch: `assert_never` (one line, house pattern) |
| 8 | blind, edge | re-setting a stored legacy mark that covers nothing is a 200 no-op | low | harmless no-op, nothing stored changes; rejected |
| 9 | blind | no frontend test for the step tick | false | no frontend code computes steps; server summary is the source (AD-3) |
| 10 | blind, edge | `categoryKey` differs from Python casefold for U+1E9E, final sigma, U+1C–U+1F | low | rare characters in category names; rejected |
| 11 | blind | undo toast round fallback fragile | false | one `recommendations_outdated{undo}` per undo (`history.py:85`); missing-field case covered by #1 |
| 12 | blind | 121 changes docs only | false | 121 was accepted as a pinning test; test added in `test_recommendations.py` |
| 13 | blind | `apply_all_done` lacks round | false | other toasts read the current round, which is correct for them; out of the 138 defect |
| 14 | edge | AC "every row has a test" unmet for 115 | intent gap | 115 is not in the I/O matrix; the test showed rule 3 does not do what the accepted decision assumed; asked the author (no code for 115 to revert) |
| 15 | verification-gap | no gaps | — | — |

## Verification

**Commands:**
- `npm test`, `npm run lint:py`, `uv run --directory backend --locked ruff format --check`, `npm run lint:imports`, `npm run lint`, `npm run typecheck`, `npm run trace` -- all green.
- `npm run e2e` -- 0 failed, 0 flaky in all three browsers (stop the dev server first).
