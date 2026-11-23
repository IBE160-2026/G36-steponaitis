---
title: 'Playwright coverage of user journeys UJ-1–UJ-8 (e2e-user-journeys)'
type: 'chore'
created: '2026-11-23'
status: 'done'
baseline_revision: 'ce068ca43ed15b8e0e7f2b8f72cc1dfa45c22198'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/EXPERIENCE.md'
warnings: [oversized]
deferred:
  - summary: >-
      A local command() poster is still copied in about nine existing e2e specs although support/plan-api.ts exports postCommand.
    evidence: |-
      Pre-existing duplication (launcher, other-location, recommendations-page, undo, reset, ...); not introduced by this change.
    location: >-
      frontend/e2e/*.spec.ts
    severity: low
  - summary: >-
      plan-overview.spec.ts and new-plan.spec.ts still choose the three sample files inline instead of the new chooseSampleFiles helper.
    evidence: |-
      Pre-existing duplication; the shared helper now exists in support/sample-plan.ts.
    location: >-
      frontend/e2e/plan-overview.spec.ts:40, frontend/e2e/new-plan.spec.ts:52
    severity: low
  - summary: >-
      selectRecommendation counts listbox options once, which might race a re-render after a run or apply.
    evidence: |-
      Unverified; passed in chromium, firefox and msedge. Repeated full-suite runs under load would settle whether it flakes.
    location: >-
      frontend/e2e/support/recommendations.ts
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** UJ-1–UJ-8 (EXPERIENCE.md "Key Flows") are covered only in pieces: about 35 specs in `frontend/e2e/` each test one step, mostly on a plan built through the API, so no test walks a whole journey through the UI. Nothing proves that the site's wanted functions (sign up, log in, log out, session expiry, demo, saved plans, import, every planning step, wall, drag, colours, move list, print) work together end to end.

**Approach:** Add one spec, `frontend/e2e/user-journeys.spec.ts`, with one end-to-end test per journey (`uj1 …` to `uj8 …`) that walks the journey's numbered steps, climax, resolution and failure path through the real UI and asserts what the user sees at each step. Steps that need Epics 13–16 are declared as skipped tests with the epic named. Existing specs stay as the per-step detail tests.

## Boundaries & Constraints

**Always:**
- Import `test`, `expect`, `toasts` (and types) only from `frontend/e2e/support/test.ts`; reuse `support/sample-plan.ts` and `support/plan-api.ts` helpers. A helper needed by two or more specs goes into `e2e/support/` (DRY), not copied.
- Every journey action (log in, upload, mark, run, apply, move, drag, keep, undo, print, colour, launcher) goes through the UI. The API (`request` / `page.request`) is allowed only to (a) create the journey's starting state that the journey text takes as given (e.g. "a plan saved last week", "another plan Spring re-slot"), and (b) read view JSON to pick data-dependent values (which part, which location) instead of hard-coding the example values in EXPERIENCE.md, which are illustrative and may not match `data/sample/`.
- Each test asserts the visible result of each step (text, state, URL, toast, focus, wall marker), not only that a page loads. Test names name the journey and the FRs they cover (SM-7), e.g. `uj1 fr1 fr23 fr28 builds a re-slotting plan from a fresh export`.
- Only synthetic data from `data/sample/`; unique plan names per test (`randomUUID().slice(0, 8)`) so tests run in parallel and in all three browsers against one database.
- Failures are fixed at their root cause (test or app code). Per-test `test.setTimeout` for a long walk is allowed, as existing specs do; no raised `expect` timeouts beyond those existing specs already use (30 s for an import), no retries, no browser-specific skips or branches.

**Never:**
- No change to `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, `.logs/`, Playwright config retries/timeouts, or CI.
- No deploy, Vercel or Supabase. No turning `FEATURE_DEMO` on in the e2e server: the demo flag is rewritten in the browser only, as `front-page.spec.ts` does.
- No implementing Epics 13–16 features. No deleting or weakening existing specs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| UJ-1 | Logged out; Log in page; sample files | Log in → Saved plans → New Plan → Overview (data as of, counts) → Locations wall keyboard + tooltip → Best locations aisle A + level 1 in all aisles → run: round 1 with rule 1/2/3 rows and No space count → apply #1 rule 1 (detail lifts bin, toast) → Other location ▾ apply → Keep in place (Kept in place tab) → Manual move from part panel shows "M" on wall → Before/after lists moves in/out → run round 2 | Failure path: Inventory without Quantity → "Import stopped: nothing was saved." naming Quantity, Inventory tile failed, other two passed; re-choose Inventory.xlsx → import passes |
| UJ-2 | Plan with two applied rounds | Move list: header plan name, Data as of, generated time; "ROUND 1" and "Round 2" bands; each line part/from/to/tick box/Note space; any line into a location comes after the line emptying it; Print calls window.print; print media hides app chrome | — |
| UJ-3 | Plan saved earlier with marks, a run, applied moves, an outdated recommendation; session expired | Opening the app → Log in → back on Saved plans with the plan at top and its edited time → open: plate data-as-of and round unchanged, marks/moves/outdated as left → Undo last move: toast names the move, open recs outdated → run again, apply two → Print: generated time differs from the first print → New Plan from this import: new plan with same data-as-of, no marks or moves | Failure path FR-41 (Epic 15): declared skipped |
| UJ-4 | Plan open on Locations wall | Key "Slow-moving" popover, eight shades, current ringed; arrowing previews on the wall; Done announces "Slow-moving colour changed", focus back on Key entry; reload keeps the colour; Move list print stays black and white | Failure path: hex close to selection violet shows the ΔE warning; Esc restores the colour from when the popover opened |
| UJ-5 | Logged out, demo flag rewritten in browser | Front page headline and four panels → Demo version → Saved plans as demo → New Plan with sample files → Overview → Locations wall → mark → run → #1 reason in numbers and lifted bin on the wall → Log out → front page; Log in with demo/demo works; Create account works | Failure path: taken username → "That username is taken. Try another." with focus on Username; another name succeeds. Step 1 on the public deployment (Epic 16): declared skipped |
| UJ-6 | Plan from sample | Pick groups sorted by shared jobs desc, row with both parts, aisles and Same/Different aisles → part panel shows groups and location chip; chip opens wall at that bin → run, apply a rule 3 recommendation (reason names partner and shared jobs) → its pick-group row says "Same aisle" and Before/after same-aisle count rises by one | Empty case text checked if reachable from the UI, else covered by existing tests (note it in a comment) |
| UJ-7 | Plan from sample | Parts ranked by picks with why-line → Fast-moving chip filters → Keep in place toast and pin in roster → Ctrl+/ focuses search, results list parts and locations apart, choosing opens panel → Manual move… → wall shows "M" → run: kept part gets no recommendation | Failure path: no-stock part shows "No current location (no stock above zero)" and Manual move… disabled |
| UJ-8 | Plan on Recommendations; another plan named with "Spring" | Ctrl+K opens drawer with focus in search and one column per step → "mov" groups Steps/Actions/Saved plans, Enter opens Move list → Tab to Recommendations column, arrow to run action, Enter runs the round → "spring" + Enter opens the other plan | Failure path: "xyz" shows no-match text; Esc closes and focuses the grid button; stage-2 plates read "Coming in stage 2" and do not open |
| Out of scope | Epics 13–16 | `test.skip` entries: category check (Epic 13), location labels with QR codes (Epic 14), concurrent-edit warning in UJ-3 (Epic 15), UJ-5 on the public deployment (Epic 16) | Reported as skipped, never failing |

</intent-contract>

## Code Map

- `frontend/e2e/support/test.ts` -- shared `test` (worker session as `E2E_USER`, `request` with cookie), `expect` with element waits, `toasts(page)`. Logged-out describe: `test.use({ storageState: { cookies: [], origins: [] } })`; then the `request` fixture has no cookie, so use `page.request` after logging in through the UI.
- `frontend/e2e/support/sample-plan.ts` -- `SAMPLE`, `SAMPLE_FILES`, `createSamplePlan(request, name)`.
- `frontend/e2e/support/plan-api.ts` -- `getJson`, `postCommand`, `locationRows`, `partDetail`, `moveFromPanel`, `enterTarget`, `occupancyLine`.
- `frontend/e2e/sm2-flow.spec.ts` -- closest model: New Plan upload selectors, flow-bar nav (`navigation "Plan steps"`, link regexes), Best locations list mode marking, Run, apply toast text, Before/after table, Move list lines `[data-move-line]`, print media checks.
- `frontend/e2e/new-plan.spec.ts:73` -- import failure: inventory CSV without Quantity, `[data-role=…]` tile states, alert panel.
- `frontend/e2e/login.spec.ts`, `signup.spec.ts:94` (taken username), `session-expiry.spec.ts:157` (page opened after expiry returns after Log in), `demo-version.spec.ts`, `front-page.spec.ts` (`turnDemoOn`: rewrite `/api/session` and `/api/auth/demo`) -- auth selectors and the demo-flag rewrite.
- `frontend/e2e/locations-wall.spec.ts:258` (keyboard + tooltip), `:607` (lifted bins), `:733` ("M" marker); `best-locations-wall.spec.ts:93` (marking on wall, BEST tags) -- wall selectors.
- `frontend/e2e/recommendations-page.spec.ts` (run, tabs, No space count, detail with wall crops), `other-location.spec.ts`, `keep-in-place.spec.ts`, `undo.spec.ts`, `recommendations-outdated.spec.ts`, `apply-all.spec.ts` -- recommendation selectors and toast texts.
- `frontend/e2e/drag.spec.ts:106` -- drag a bin on the wall to an empty location (use in UJ-1 or UJ-3 so drag is walked in a journey).
- `frontend/e2e/move-list.spec.ts` (`stubPrint`, generated line `[data-move-list-generated]`), `move-list-print.spec.ts` -- move list and print checks.
- `frontend/e2e/saved-plans.spec.ts`, `reopen-plan.spec.ts`, `reuse-import.spec.ts:42` (plate menu New Plan from this import), `delete-plan.spec.ts` -- saved-plan selectors.
- `frontend/e2e/key-colours.spec.ts:172` -- Key popover, shades, Done, Esc, ΔE warning.
- `frontend/e2e/pick-groups.spec.ts`, `views-follow-planning-copy.spec.ts:66`, `part-panel-search.spec.ts:159` -- pick groups and partner move.
- `frontend/e2e/parts-roster.spec.ts`, `part-panel-search.spec.ts:32`, `manual-move.spec.ts:204` (no-stock part) -- parts roster, search, no-stock failure path.
- `frontend/e2e/launcher.spec.ts` -- launcher helpers (`launcher`, `searchField`, `gridButton`, `planReady`), CAT stage-2 plate.
- `frontend/playwright.config.ts` -- three projects; reuses a running server on :3000 outside CI.

## Tasks & Acceptance

**Execution:**
- `frontend/e2e/user-journeys.spec.ts` -- new: header comment mapping each test to its journey and to the existing detail specs; one test per UJ-1–UJ-8 per the I/O matrix (logged-out describe for UJ-1, UJ-3, UJ-5); four `test.skip(title, …)` entries for Epics 13–16 -- one walk per journey through the UI.
- `frontend/e2e/support/*.ts` -- move any helper the new spec shares with an existing spec (e.g. `stubPrint`, `turnDemoOn`, UI log-in, launcher locators) into support and import it from both -- DRY.
- App code under `frontend/` or `backend/` -- only if a journey step exposes a real defect; fix at root cause with a unit test naming its FR.

**Acceptance Criteria:**
- Given the e2e server, when `user-journeys.spec.ts` runs in chromium, firefox and msedge, then the eight journey tests pass and the four out-of-scope entries are reported as skipped.
- Given the whole e2e suite, when it runs in chromium, firefox and msedge, then every test passes (no new flakiness in existing specs).
- Given the spec file, when read, then each journey test's comments map its steps to EXPERIENCE.md step numbers so a reader sees which step each block covers.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 53 findings — high 0, medium 10, low 23, false 17, maybe-false 3
- findings:
  - blind-hunter
    - `[medium]` `[patch]` uj1 step 10 assumes `first` targets aisle A — patched: explicit assertion that the first rule 1 target is in aisle A.
    - `[low]` `[patch]` uj1 step 3 comment claims empty cells are read; only occupied asserted — patched: comment matches assertion.
    - `[low]` `[patch]` uj1 step 3 poll compares with `[...seen].at(-1)` — patched: `previous` variable.
    - `[low]` `[reject]` non-null `!` on unchecked `find()` results — a miss still fails the test loudly (TypeError); data is fixed sample data; adding guards everywhere is extra code for a message only.
    - `[false]` `[reject]` uj6 exact +1 same-aisle assertion flaky — sample data and the plan are per-test and deterministic; passed in all three browsers.
    - `[medium]` `[patch]` uj2 ordering check can pass vacuously — patched: positive assertion that an emptying line precedes a line into the same location.
    - `[medium]` `[patch]` uj4 step 3 per-shade preview poll cannot fail — patched: poll for a change from the previous shade's value.
    - `[medium]` `[patch]` uj3 does not expire a live session — patched: logs in through the UI, ends the session, Log in opens, logs in again and returns.
    - `[low]` `[reject]` uj3 step 2 checks counts, not every mark/marker — counts plus tabs show the plan as left; full detail is covered by reopen-plan.spec.ts.
    - `[low]` `[reject]` uj5 writes plans into the shared demo account — e2e.db is deleted on every server start (`e2e:reset-db`), FEATURE_DEMO is off in e2e.
    - `[low]` `[reject]` only uj1 collects pageerror — adds a fixture surface; not part of the intent.
    - `[low]` `[reject]` no `test.step()` — style; step comments map to EXPERIENCE.md as the spec asks.
    - `[low]` `[reject]` local `RosterRow` differs from plan-api's — different shape (more fields); not a duplicate source of truth.
    - `[low]` `[reject]` uj6 uses `getJson` instead of `partDetail` — needs fields `partDetail`'s type lacks; cosmetic.
    - `[low]` `[reject]` uj1/uj3 repeat overview URL lines — those flows include an import failure / plate menu, not `newPlanThroughUi`'s flow.
    - `[low]` `[defer]` local `command()` copied in 9 existing specs — pre-existing, not caused by this change.
    - `[low]` `[reject]` recommendations-page keeps `Row`/`View` aliases — cosmetic.
    - `[low]` `[patch]` `uniqueUsername` lost its length-budget comment — patched: comment restored.
    - `[low]` `[reject]` uj7 perf comment vs `main.getByRole` — tests pass in Firefox; cosmetic.
    - `[low]` `[patch]` uj1 step 7 does not check `is_best` — patched: picks the first best location.
    - `[low]` `[reject]` uj8 types the full unique name, not "spring" — parallel runs create many "spring" plans; a unique name is required so Enter opens this test's plan (Design Notes).
  - edge-case-hunter
    - `[medium]` `[patch]` first.to_location outside aisle A (wall) — same patch as above.
    - `[medium]` `[patch]` Before/after In column for aisle A — same patch as above.
    - `[false]` `[reject]` drag may fill a freed rule 2 location — deterministic data; step 11 passed in all browsers, and the drag uses aisle A empties outside move ends.
    - `[low]` `[reject]` rule 2 `next` undefined — same as the non-null finding.
    - `[low]` `[reject]` `keep` undefined — same as the non-null finding.
    - `[low]` `[reject]` `emptyA[0]` undefined — same as the non-null finding.
    - `[low]` `[patch]` step 3 stale `at(-1)` — same patch as above.
    - `[false]` `[reject]` later moves split a pick group so the total does not rise — deterministic data; passed.
    - `[false]` `[reject]` uj3 setup with fewer than two open rows — run on sample data gives many rows.
    - `[false]` `[reject]` uj3 round 2 has no open rows — passed in all three browsers on fixed data.
    - `[false]` `[reject]` uj5 top recommendation reason null — rule rows always carry a reason.
    - `[false]` `[reject]` uj2 setup applying an outdated rule 2 row — the setup applies rows that the server accepted (200 asserted); passed.
    - `[medium]` `[patch]` uj4 per-shade poll — same patch as above.
    - `[false]` `[reject]` uj6 +1 breaks when the move splits another group — deterministic data; passed.
    - `[false]` `[reject]` uj7 no unoccupied location — sample data has empty locations.
    - `[false]` `[reject]` uj7 no no-stock part — sample data has one (manual-move.spec.ts relies on it too).
    - `[false]` `[reject]` uj8 tab loop bound — passed in all three browsers; the launcher has one column per step.
    - `[maybe-false]` `[defer]` support/recommendations.ts counts options while the listbox re-renders — would need repeated runs under load to settle; passed in all browsers.
    - `[false]` `[reject]` regex metacharacters in part/location codes — codes are digits, letters and dashes.
    - `[maybe-false]` `[reject]` `newPlanThroughUi` skips navigation on `/plans/new?from=` — no caller is on that URL when it is called; would only be low.
    - `[medium]` `[patch]` uj3 session expiry not walked — same patch as above.
    - `[low]` `[patch]` HEADLINE/PANELS copied from front-page.spec — patched: moved to support and imported in both.
  - verification-gap
    - `[medium]` `[patch]` uj7 step 6 loop vacuous — patched: non-vacuous planning-copy check of the moved part's location.
    - `[medium]` `[patch]` uj4 step 3 — same patch as above.
    - `[low]` `[patch]` uj1 step 3 comment — same patch as above.
    - `[low]` `[defer]` plan-overview/new-plan pick sample files inline — pre-existing duplication.
  - intent-alignment
    - `[false]` `[reject]` setup seeded through the API for UJ-2/3/4/6/7/8 — the intent asks for journey steps through the UI; starting state the journey takes as given is allowed (spec Always).
    - `[false]` `[reject]` oracles read from API JSON — UI assertions are made against those values; API is only the source of expected data.
    - `[maybe-false]` `[reject]` UJ-3 printed time compared through the network response — the UI shows minutes only; the printed header is asserted to show the new time; would only be low.
    - `[false]` `[reject]` print stubbed / print media emulated — a real print dialog cannot be driven by Playwright; move-list-print.spec.ts covers the paper.
    - `[false]` `[reject]` demo mocked at the network layer — required by the host rule (FEATURE_DEMO stays off); the real flag runs in `npm run e2e:production`, green.
    - `[false]` `[reject]` existing specs not extended — the missing whole-journey walks were written as new tests; existing specs stay the step detail tests (approach in the intent contract).

## Design Notes

Journeys run in parallel against one shared database, so a test never asserts global state another test can change (e.g. "my plan is the top row" only right after editing it, matched by its unique name; counts read from the API at the time of the assertion). Data-dependent picks (a rule 1 row with an Other location, a rule 3 row naming a partner, a no-stock part, a slot freed for round 2) are found from the API views first; if the sample data cannot produce one, assert the nearest observable equivalent and say so in a comment rather than skip.

## Verification

**Commands:**
- `npm run lint` and `npm run typecheck` (repo root) -- expected: no errors.
- `npm run e2e -- e2e/user-journeys.spec.ts --project=chromium --project=firefox --project=msedge` (repo root) -- expected: 24 passed, 12 skipped.
- `npm run e2e -- --project=chromium --project=firefox --project=msedge` (repo root) -- expected: all passed, only the declared skips skipped.

## Auto Run Result

Status: done

**Summary:** Added `frontend/e2e/user-journeys.spec.ts`, which walks each of UJ-1 to UJ-8 from start to end through the UI. Each walk covers the journey's numbered steps, climax, resolution and failure path, with comments mapping each block to its EXPERIENCE.md step. Four `test.skip` entries cover the steps that need Epics 13–16: the category check, location labels with QR codes, the FR-41 concurrent-edit warning and the public deployment. Helpers that several specs had copied now live in `frontend/e2e/support/`, and the existing specs import them from there. No app code changed.

**Files changed:**
- `frontend/e2e/user-journeys.spec.ts`: new. Eight journey tests and the four skipped entries.
- `frontend/e2e/support/auth.ts`: new. Unique usernames, sign-up, log-in, the browser-only demo flag, and the front page headline and panels.
- `frontend/e2e/support/before-after.ts`, `colours.ts`, `drag.ts`, `launcher.ts`, `move-list.ts`, `recommendations.ts`: new shared helpers, moved out of the specs that used them.
- `frontend/e2e/support/sample-plan.ts`: adds `chooseSampleFiles` and `newPlanThroughUi`.
- `frontend/e2e/support/plan-api.ts`: `moveFromPanel` now waits for the to-location option list before pressing Esc. This fixes a root-cause race: Esc on an empty field cleared it.
- 13 existing specs (`before-after`, `demo-version`, `drag`, `front-page`, `key-colours`, `launcher`, `login`, `move-list`, `other-location`, `recommendations-page`, `session-expiry`, `signup`, `sm2-flow`): import the shared helpers instead of their own copies.

**Review findings:** 53 findings in total (high 0, medium 10, low 23, false 17, maybe-false 3).
- Patched, in one pass:
  - the UJ-1 rule 1 target asserted in aisle A;
  - a stale keyboard-poll comparison in UJ-1;
  - the "best" location in UJ-1's Other location step;
  - a real same-round emptying pair in UJ-2;
  - the per-shade live preview in UJ-4;
  - real session expiry in UJ-3;
  - a non-vacuous planning-copy check in UJ-7;
  - HEADLINE and PANELS shared through support;
  - the username length comment restored.
- Deferred, 3 items (see frontmatter): the old `command()` copies, inline sample-file choosing in two specs, and an unconfirmed listbox-count race.
- Rejected: every other finding, each with its reason in the Review Triage Log.

**Follow-up review recommendation:** false. 5 medium entries and 5 low entries were patched, and none was high. Every patched change was checked again in the full three-browser run below, so no unverified risk is left to name.

**Verification:**
- `npm run lint`, `npm run typecheck`: clean.
- `npm test`: 1016 passed and 2 skipped (pytest), 713 passed (Vitest).
- `npm run lint:py`, `npm run lint:imports`: clean.
- Full `npm run e2e -- --project=chromium --project=firefox --project=msedge`, after the patches: 417 passed, 0 failed, 0 flaky, 12 skipped (4 per browser, the declared Epic 13–16 entries).
- `npm run e2e:production`: 2 passed.

**Residual risks:**
- UJ-3 checks the reprint's generated time through the response, because the header shows minutes only.
- UJ-6's empty case can't be reached on the sample data.
- UJ-1 and UJ-6 assert before/after increases that depend on the fixed sample data.
