---
title: 'Story 10.4: See recommendations and moves on the wall'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '21ae5bbc255c5948993c36b094f43714faf388dc'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-10-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Cross-selection scrolling (wall to drawer row, drawer to from- or to-cell) has no test.
    evidence: |-
      Verification-gap review: no unit or e2e test asserts scrollIntoView or a cell or row in the viewport after a selection; deleting either scroll effect fails nothing. Proving it needs an aisle and viewport where the target starts out of view.
    location: >-
      frontend/modules/locations/moves-drawer.tsx, frontend/components/common/wall/wall-grid.tsx (scrollTo effects)
    severity: low
  - summary: >-
      Open retro items touching files this story changed are not closed: epic-2-retro-item-15 (DataTable Enter e2e after a user sort), epic-5-retro-item-46 (split planning/recommendations/recommendations-page) and epic-7-retro-item-64 (share the allowed-location filter).
    evidence: |-
      Intent audit: this story advanced item 46 (status derivation moved to the kernel, apply flow shared in lib/commands/apply.ts) and item 64 (other-location.tsx moved to components/common) incidentally; the DataTable Enter guard already ignores handled events, and the drawer adds Apply buttons inside rows. The remaining work is the items' own, not caused by this story.
    location: >-
      frontend/components/common/data-table.tsx, frontend/components/common/other-location.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The Story 10.3 wall shows where parts are but not where they go: recommendations, applied moves, manual moves and outdated recommendations are invisible on it, there is no "Moves touching aisle" drawer, and each aisle tab's move count (Story 10.2) counts only the latest run's recommendations, so manual moves are not counted.

**Approach:** The plan's wall view gains the round and the open aisle's **moves** (one server-built entry per latest-run recommendation and per current-round manual move touching the aisle), and each aisle tab's `moves` becomes the count of exactly those entries. The frontend draws them on the wall (lifted bins, markers, dashed targets, the selected move's arrow and hover note), names them in the cells' accessible names, links the selection with `?rec=`/`?move=`, and shows them in a drawer under the Key with Apply · Other location · Keep in place.

## Boundaries & Constraints

**Always:**
- **Move entries (server, AD-3/AD-7/AD-14).** `WallView` gains `round` (`current_round`) and `moves: list[WallMove]` for the open aisle. A `WallMove` has `kind` (`recommendation` | `manual`), `recommendation_id` (rec only), `number` (the rec's server `number`; None for manual), `move_number` (the effective move's number when applied or manual, else None), `rule` (`rule_1|rule_2|rule_3|manual`; an applied rec keeps its own rule), `part`, `description`, `movement_class`, `picks`, `from_location` and `to_location` as `LocationRef`, and `status`: `open` | `kept` | `applied` | `outdated` | `manual`. Entries are: every latest-run recommendation (any status) whose from- or to-location is in the aisle, in stored order; then every effective move (replay, FR-34) of the current round with `recommendation_id` None (manual, incl. combined/swap) touching the aisle, by move number. A rec's `to_location` is the effective move's `to_location` when applied, else the applied step's (moved back), else its own. Status derivation (applied → outdated incl. `moved_back` → kept → open) moves into the kernel (`domain/planning.py`, e.g. `recommendation_status`) and both `domain/recommendations.py::_status` and the wall view use it (domain slices never import each other).
- **Tab count (decision for the 10.2 note).** Manual moves count: `AisleCounts.moves` = the number of entries the same function yields for that aisle, so the tab, the drawer header and the wall always agree (mockup: tab "7 moves" = drawer "7 moves"). `_moves_per_aisle` is replaced by that function. Before the first run, round-0 manual moves are counted and shown.
- **Drawing (UX-DR44, DESIGN.md lifted bin/marker).** In the SVG (`aria-hidden`), per entry and only for ends on this wall:
  - `open`/`kept` rec: the from-cell's bin is lifted (33 × 34 natural px, offset up-left, the only content shadow `0 6px 10px rgba(0,0,0,0.45)`), its slot shows a dashed white outline, and a 17px marker (white, ink ring, ink number) sits on it; the to-cell is a dashed white slot outline with a plus glyph and a marker with the same number. A from-cell in another aisle: only the target is drawn.
  - `applied`: an ink disc with a white check on the bin at its to-cell; no lift.
  - `manual`: an ink disc with "M" on the bin at its to-cell; no lift.
  - `outdated`: a white marker with a grey (`outdated` token) ring and the number, and a dashed grey outline, on the from-cell; no lift, no target.
  - Lift animates ≤200 ms (`transform` transition), instant under `prefers-reduced-motion`. Data hooks: `data-lifted=<n>`, `data-move-target=<n>`, `data-move-marker=<n|M|applied>` plus `data-marker-kind`, `data-vacated`, `data-move-arrow`, `data-hover-note`.
- **Selection.** `?rec=<recommendation_id>` or `?move=<move_number>` (built and parsed only in `lib/view-state/urls.ts`; `LocationParams` gains `rec` and `move`; tabs and Open as list keep them out) selects one entry; an id not among the open aisle's entries selects nothing. Only the selected entry draws the cased violet arrow (3px accent inside a 1.5px `slot-empty` casing) from its from-cell to its to-cell when both are on this wall, the lifted bin's 2px violet frame, the solid violet target frame, the selected marker (white, 2px violet ring) and the hover note (`aria-hidden`, two lines, lib/copy): line 1 "Rule 1 · 8044172 Oil filter - Toyota Corolla" ("Manual · …" for manual), line 2 "33 picks (24 or more) · A-12-04-02 → A-14-02-01" (threshold from the joined rec row's class reason; rule 3 "Partner 4410281 · 14 shared jobs · from → to"; without a joined row or for manual "33 picks · from → to"). The note's position comes from a pure function that places it beside the target, flips to the other side when it would leave the wall's box, and never overlaps the from- or to-cell rectangle.
- **Linked selection.** Clicking a marker or a lifted bin, clicking/`Enter` on a cell whose entries include a move (selects its first entry in drawer order unless one of its entries is already selected; the 10.3 pin still happens), and clicking/`Enter` on a drawer row each select the move everywhere: URL, wall, drawer. Selecting from the wall scrolls the drawer row into view (when the table is open); selecting from the drawer scrolls the from-cell (else the to-cell) into view inside the scroll box; `behavior: "smooth"` only without reduced motion. Markers are pointer targets in the overlay (`aria-hidden`, no tab stop); their keyboard and target-size equivalents are the cell and the drawer row.
- **Accessible names (UX-DR42/57).** A cell's name appends its move texts (lib/copy, never `aria-selected`): rec from "move 1[, selected], leaves here", rec to "move 2[, selected], arrives here", applied "move 3 applied[, selected], arrived here", manual "manual move[, selected], arrived here", outdated "move 4 outdated[, selected]". The tooltip (and hidden description) of a target whose from-location is in another aisle adds "From G-14-04-02 (aisle G)" and "Recommendation 2 arrives here from G-14-04-02".
- **Drawer (UX-DR46).** Under the Key: heading "Moves touching aisle A · Round 1 · 7 moves · 4 to decide" (to decide = entries with status `open`). Collapsed it shows only the selected move: marker, rule, part + description, "Class · N picks", from → to (BEST tags from the `LocationRef`s), status, and for an `open`/`kept` rec with a joined rec row (versions agree, AD-12) **Apply** (secondary) · **Other location ▾** · **Keep in place**; with nothing selected, "No move selected. Select a move on the wall or show all." **Show all 7** toggles the full shared `DataTable` (columns Rule, Part, Class · picks, From, To, Status, Action; Action = Apply for `open`, else empty; Enter/click on a row selects it; the selected row is marked) and the link "Open round 1" to the Recommendations step. No entries: "No moves touch aisle A." and no Show all.
- **Commands (reuse, no new endpoint).** Apply sends `apply`, Other location `apply_other_location`, Keep `set_keep`, all through `lib/commands`, with the same toasts as the Recommendations step (applied toast with Undo, keep toast). Shared code moves out of `modules/recommendations`: `other-location.tsx` → `components/common/other-location.tsx`; the apply-and-toast flow and `applyReason` → shared (`lib/commands` / `components/common`), used by both pages.
- Every new string in `lib/copy`; tests named `fr42`/`test_fr42_*` (and UX-DR44/46); e2e `uj1 …` importing from `frontend/e2e/support/test.ts`.

**Never:** No new write endpoint or command. No arrow for unselected moves. No `aria-selected` on cells. No crops (10.5), Whole warehouse (10.6), marking (10.7), Key buttons (Epic 11), drag (Epic 12). No code parsing in the frontend; no frontend-computed status, aisle membership or counts. No edits to `data/sample/`, `data/answer-key/`, `.docs/planning-artifacts/`; no session logs or `.logs/`; no deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No run | no runs, no steps | `round` 0, `moves` [], tabs "0 moves", drawer "No moves touch aisle A." | — |
| Cross-aisle rec | rec G-… → A-… | aisle A: target only, tooltip "From G-… (aisle G)"; counted in A and G | — |
| Applied to other location | `apply_other_location` | entry `applied`, `to_location` = chosen location, check marker there | — |
| Moved back | applied then manual move back | entry `outdated` (moved_back), grey marker on from-cell | — |
| Manual combined into applied rec | applied rec then manual move on | one entry (the rec, `applied`), not also a manual entry | — |
| Manual move round 0 | manual move before any run | entry `manual`, round 0, counted | — |
| Unknown `?rec=`/`?move=` | id not in this aisle | nothing selected, no arrow | — |
| Versions disagree | recs version ≠ wall version | drawer shows entries, no actions; hover note without threshold | — |

</intent-contract>

## Code Map

- `backend/swp/domain/views/wall.py` -- `WallView`, `AisleCounts.moves`, `_moves_per_aisle` (to replace), `build_wall_view`; add `WallMove`, `round`, `moves`.
- `backend/swp/domain/planning.py:332-358` -- `current_round`, `latest_run`, `applied_step`; `replay(...).moves` (`EffectiveMove`: `move_number`, `recommendation_id`, `rule`, `round`, `to_location`); `location_ref`. Add the shared status helper here.
- `backend/swp/domain/recommendations.py:560-596` -- `_status` (applied via replay move, `moved_back`, stored outdated, kept); refactor onto the kernel helper (behaviour unchanged). `_part_facts` pattern for description/class/picks.
- `backend/tests/domain/test_wall_view.py:156` -- `test_fr42_wall_moves_count_the_latest_run` (update for manual moves); `backend/tests/api/test_wall_api.py`.
- `frontend/lib/api/schema.ts` (regenerate with `npm run gen:api`), `frontend/lib/api/plans.ts` (`WallView`, add `WallMove` type export).
- `frontend/components/common/wall/{wall-panel.tsx,wall-grid.tsx,wall-tooltip.tsx,model.ts,bin.tsx,slot.tsx,key.tsx,index.ts}` -- 10.3 SVG + overlay grid; `cellRect`/`runTops` geometry; `Frame`/`SELECTED_FRAME` (selected look). New: a moves layer (lifted bins, markers, targets, arrow, note) and pure helpers (cell → entries, note placement, arrow path).
- `frontend/modules/locations/{locations-page.tsx,aisle-wall.tsx,aisle-tabs.tsx}` -- `WallMode` (recRows at version, `usePlanCommands`), `LocationsWall` (Key then drawer), tabs read `entry.moves` (unchanged source). New `moves-drawer.tsx` in this module.
- `frontend/modules/recommendations/recommendations-page.tsx:125,486-505,852` -- `applyReason`, `sendApply`/`apply`/`applyOther` (move shared parts out); `other-location.tsx` → `components/common`.
- `frontend/components/common/{keep-in-place.tsx,data-table.tsx,button.tsx}` -- `KeepInPlaceButton`, `sendKeep`; `DataTable` (add an optional selected-row key if needed).
- `frontend/lib/commands/undo.ts:55` `moveUndoAction`; `frontend/lib/copy/index.ts` (`appliedToast`, `outdatedText`, `keptApplyReason`, `aisleTabMoves`, `cellName`); `frontend/lib/view-state/urls.ts` (`VIEW_QUERY_KEYS` has `rec`/`move`; `parseLocationParams`, `planStepHref`, `recommendationsTabHref`).
- `frontend/app/globals.css` -- tokens (`--color-accent`, `--color-outdated`, `--color-slot-empty`).
- E2E: `frontend/e2e/locations-wall.spec.ts`, `e2e/support/sample-plan.ts`, `plan-api.ts` (mark, run, apply, manual move helpers).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/planning.py`, `domain/recommendations.py` -- kernel status helper; `_status` uses it.
- `backend/swp/domain/views/wall.py` -- `WallMove`, `round`, `moves`, per-aisle count from the same entries.
- `backend/tests/domain/test_wall_view.py`, `tests/api/test_wall_api.py` -- `test_fr42_wall_moves_*`: every matrix row, count == len(moves) for every aisle, order, statuses; recommendations view tests still pass.
- `frontend/lib/api/schema.ts`, `lib/api/plans.ts` -- regenerated types.
- `frontend/lib/copy/index.ts`, `lib/view-state/urls.ts` -- drawer/note/name/tooltip strings; `rec`/`move` params and href builder.
- `frontend/components/common/other-location.tsx` (moved), shared apply flow + `applyReason`; `modules/recommendations/*` import them.
- `frontend/components/common/wall/*` -- moves layer, markers, selection, names, tooltip lines, note placement.
- `frontend/modules/locations/{moves-drawer.tsx,locations-page.tsx,aisle-wall.tsx}` -- drawer, selection wiring, scrolling.
- `frontend/tests/wall-moves.test.tsx` (new) -- drawing per status, selected-only arrow, names, cross-aisle tooltip, note placement never overlapping, drawer header/collapsed/table, URL parse/build; existing tests updated.
- `frontend/e2e/locations-wall.spec.ts` -- see AC.

**Acceptance Criteria:**
- Given a sample plan with aisle A marked and round 1 run, when the Locations wall opens on an aisle with recommendations, then each open rec's from-bin is lifted with its number and its target shows the same number, no arrow is drawn, and the tab's "N moves" equals the drawer's "N moves".
- Given that wall, when a drawer row is selected (Show all, Enter), then the URL has `?rec=`, the wall draws exactly one arrow and the hover note, and the cell names say "move n, selected, leaves here" / "arrives here"; when a lifted bin is clicked, the drawer shows that move.
- Given the drawer's Apply on the selected move, when it is confirmed, then the marker becomes the applied check at the target and the toast offers Undo; Keep in place and Other location ▾ work from the drawer.
- Given a manual move made from the part panel, when the wall shows its aisle, then the moved bin carries "M" and the tab count includes it.
- Given an outdated recommendation (after a manual move fills its target), then its from-cell shows the grey marker with no lift.
- Given the repo, when the Verification commands run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 33 findings — high 0, medium 3, low 26, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) A cell that is a lifted from-cell and another move's target got two markers at index 0, overlapping — one per-code marker counter.
  - `[low]` `[patch]` (blind) Marks keyed by array index, so a status change reused nodes — keyed by `${key}:${kind}:${end}`.
  - `[medium]` `[patch]` (blind) Focus fell to body after Apply / Other location / Keep in place from the drawer — after a confirmed command whose control is gone, focus moves to the drawer heading (`tabIndex=-1`).
  - `[low]` `[reject]` (blind) The wall's keyboard path reaches only a cell's first move — the drawer table is the specified keyboard and target-size equivalent; cycling adds a branch.
  - `[low]` `[reject]` (blind) The lifted bin's 4–6px overhang belongs to the neighbour cell's click target — only the edge overhang; routing it needs extra pointer targets.
  - `[low]` `[patch]` (blind) Docs still described the tab count as latest-run recommendations only — plans.ts, aisle-tabs.tsx and an `AisleCounts.moves` docstring updated.
  - `[low]` `[patch]` (blind) `moveLabel` doc said "Move 3 applied" and took an unused `status` — doc matches code, `status` dropped.
  - `[low]` `[patch]` (blind) Dead code `markRect` and `DerivedStatus.moved_back` — deleted.
  - `[low]` `[patch]` (blind) No direct test of `recommendation_status` precedence, the round filter or another aisle's manual move — three `test_fr42_*` tests added.
  - `[low]` `[patch]` (blind) Outdated moves showed only "Outdated" in the drawer — "Outdated · <cause>" from the joined row via `outdatedText`.
  - `[low]` `[reject]` (blind) Linear `applied_step` scans per recommendation — tens to hundreds of steps per plan; the recommendations view already does the same; an index adds plumbing.
  - `[low]` `[reject]` (blind) Show all keeps its label when open; a deep link does not scroll to the selection — `aria-expanded` states it and the table appears; the collapsed drawer shows the selected move without scrolling.
  - `[low]` `[patch]` (blind) Import order, stray blank line and an unneeded cast in apply.ts — tidied (the placeNote part is the edge-case row below).
  - `[low]` `[patch]` (verification-gap) Round filter untested — `test_fr42_wall_moves_manual_from_earlier_round_is_not_listed`.
  - `[low]` `[patch]` (verification-gap) Marker click never exercised — e2e clicks a target marker and asserts `?rec=` and the drawer's selected move.
  - `[low]` `[patch]` (verification-gap) Drawer table Apply never clicked — e2e applies another open move from its table row and asserts the toast names that part.
  - `[low]` `[defer]` (verification-gap) Cross-selection scrolling untested — deferred as filed (frontmatter).
  - `[low]` `[patch]` (verification-gap) Global `[data-lifted]` lift rule also hit the front page hero bin — scoped to `[data-wall-moves] [data-lifted]`.
  - `[low]` `[patch]` (verification-gap) `markRect` dead — same fix as the blind dead-code row.
  - `[false]` `[reject]` (edge) `location_ref` KeyError for an end not in `copy.locations` — every inventory location is validated against the Locations file at import (`_location_errors` for non-locations files, import_.py:426), virtual locations come only from transactions and moves to them are refused, so every move end is in `copy.locations`.
  - `[low]` `[patch]` (edge) `?move=N` also selected an applied recommendation with move number N — `?move=` matches manual entries only; URL test extended.
  - `[low]` `[reject]` (edge) Three or more markers on one cell spill over neighbours — needs three moves on one cell; a collapse chip adds a new component.
  - `[low]` `[reject]` (edge) `placeNote` last resort (top-left) can overlap the ends on a wall narrower than the note — aisles are many sections wide; placing outside the wall adds a branch and clipping work.
  - `[medium]` `[patch]` (edge) A counted entry whose marked end is off this wall drew nothing — the marker goes on its other end ("left here" for applied/manual to another aisle; the to-cell for an outdated rec from another aisle); unit tests per case.
  - `[low]` `[reject]` (edge) Lifted bin overhang click — as the blind overhang row.
  - `[low]` `[reject]` (edge) placeNote "never overlaps" claim — as the placeNote row above.
  - `[low]` `[reject]` (edge) Lifted bin click near its edge — as the blind overhang row.
  - `[medium]` `[patch]` (intent) Tab count consistent with the drawer but some counted moves were not drawn on the wall — same root cause and fix as the edge off-wall row.
  - `[false]` `[reject]` (intent) "Recommendation row" read as the Recommendations page — the AC's "scrolls the other view into place" needs both views on one page; the Recommendations page shows no wall until Story 10.5's crops.
  - `[false]` `[reject]` (intent) Lift only when the from-cell is occupied narrows "every" — an open or kept recommendation's from-cell holds its part; once the part leaves, revalidate makes it outdated (`moved`), which has no lift.
  - `[low]` `[reject]` (intent) Cross-aisle tooltip, note flip, motion and target-size checked at helper level, not rendered — the pure functions are unit-tested and render paths run in e2e; timing assertions would be flaky.
  - `[false]` `[reject]` (intent) "Round 0" before any run differs from the AC's "Round 1" — the AC example is after round 1; round 0 is the stored round of pre-run manual moves (EXPERIENCE.md move list).
  - `[medium]` `[defer]` (intent) Open retro items 15/46/64 touching changed files not named or closed — pre-existing items; deferred in frontmatter.

## Auto Run Result

**Summary.** The Locations wall now shows the moves touching the open aisle (FR-42, UX-DR42/44/46/57). The wall view returns `round` and `moves`: every latest-run recommendation touching the aisle (any status, applied ones at their effective target) and every current-round manual effective move. Each aisle tab's "N moves" is the count of those same entries, so tab, drawer and wall agree. Decision for the Story 10.2 note: manual moves count. Recommendation status derivation moved to the kernel (`recommendation_status`) and the recommendations view uses it unchanged. On the wall, open/kept recommendations lift their bin (shadow, dashed vacated slot, numbered marker) with a dashed plus target. Applied moves show the ink check, manual moves "M", outdated ones the grey marker with no lift. An end in another aisle moves the marker to the visible end and adds "From G-… (aisle G)" lines. `?rec=`/`?move=` selects one move: only it draws the cased violet arrow, frames and the hover note. Selection is linked between markers, cells, drawer rows and the URL, and scrolls the other side into view. Cell names carry the move texts. The "Moves touching aisle A · Round 1 · N moves · N to decide" drawer under the Key shows the selected move with Apply · Other location ▾ · Keep in place, or the full DataTable with Show all and "Open round N". Other location moved to `components/common`, and the apply-and-toast flow to `lib/commands/apply.ts`.

**Files changed**
- `backend/swp/domain/planning.py`, `recommendations.py` -- kernel `recommendation_status`; `_status` uses it.
- `backend/swp/domain/views/wall.py` -- `WallMove`, `round`, `moves`, tab count from the same entries.
- `backend/tests/domain/test_wall_view.py`, `tests/app/test_wall_api.py` -- `test_fr42_wall_moves_*`, precedence, round filter.
- `frontend/components/common/wall/moves.ts`, `moves-layer.tsx` (new), `wall-grid.tsx`, `wall-panel.tsx`, `wall-tooltip.tsx`, `index.ts` -- moves drawing, markers, selection, names, note placement.
- `frontend/modules/locations/moves-drawer.tsx` (new), `locations-page.tsx`, `aisle-wall.tsx`, `aisle-tabs.tsx` -- drawer and selection wiring.
- `frontend/components/common/other-location.tsx` (moved), `data-table.tsx` (`selectedKey`), `frontend/lib/commands/apply.ts` (new), `modules/recommendations/recommendations-page.tsx` -- shared actions.
- `frontend/lib/copy/index.ts`, `lib/view-state/urls.ts`, `lib/api/plans.ts`, `lib/api/schema.ts`, `app/globals.css` -- strings, `rec`/`move` params, types, lift transition.
- `frontend/tests/wall-moves.test.tsx` (new), `recommendations.test.tsx`, `wall.test.tsx`; `frontend/e2e/locations-wall.spec.ts` (three new `uj1` tests).

**Review findings.** 33 findings: high 0, medium 3, low 26, false 4. Patched: 2 medium entries (drawer focus loss; counted moves not drawn on this wall, two rows) and 17 low rows. Deferred: 2 (scroll test; retro items 15/46/64). Rejected: 12, each with its reason in the Review Triage Log. False: KeyError on unknown codes, Recommendations-page row, lift-only-when-occupied, Round 0 wording. Low: one move per cell by keyboard, the lifted-bin overhang click (3 rows), linear scans, the Show all label, marker spill, the placeNote last resort (2 rows), helper-level checks.

**Follow-up review recommendation:** `true`. Two medium entries were patched (high 0, medium 2, low 17). Unverified risk: the drawer focus hand-off after a command and the off-wall marker fallback were added in the patch round. They are checked by unit tests and Chromium only (Firefox and Edge not run).

**Verification** (against baseline `21ae5bbc255c5948993c36b094f43714faf388dc`, after the patches)
- `npm run lint:py` -- All checks passed; `npm run lint:imports` -- 5 kept, 0 broken; `uv run --directory backend --locked ruff format --check .` -- 180 files already formatted.
- `npm run lint`, `npm run typecheck` -- clean; `npm run gen:api` -- schema unchanged (stable).
- `npm test` -- pytest 940 passed, 2 skipped; Vitest 527 passed (32 files).
- `pytest tests/app --database-url postgresql://…` on a local `postgres:17` container (SWP_EXPECT_DIALECT=postgresql) -- 305 passed, 3 skipped.
- `npm run e2e -- --project=chromium` -- 115 passed.
- Matrix audit: every I/O row is covered by a passing test (`test_fr42_wall_moves_no_run`, `_cross_aisle_rec`, `_applied_to_other_location`, `_moved_back_is_outdated`, `_manual_combined_into_applied_rec`, `_manual_round_0`; the URL round-trip and e2e unknown `?rec=`; `uxdr46_drawer_without_matching_rows_has_no_actions` and the hover-note lines for disagreeing versions).

**Residual risks**
- Firefox and Edge e2e not run; real screen readers not tested.
- The lift animation needs CSS `@starting-style` (older browsers show the bin already lifted).
- Clicking a lifted bin's 4–6px overhang reaches the neighbour cell; a cell with three or more markers can spill markers over neighbours (both rejected lows).

## Design Notes

Kept recommendations follow the AC's literal rule (every latest-run recommendation whose from-location is on the wall lifts its bin) and are drawn like open ones; they are not counted as "to decide", and their Apply shows the kept reason as on the Recommendations step. Server entries keep the drawer, tabs and wall one source: the frontend only joins `recommendation_id` to the version-matched rec rows for actions and the reason threshold. Story 10.5 reuses the moves layer for crops, so keep its helpers in `components/common/wall`.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports` -- expected: clean
- `npm run lint && npm run typecheck` -- expected: clean
- `npm test` -- expected: all pass
- `npm run e2e -- --project=chromium` -- expected: all pass
