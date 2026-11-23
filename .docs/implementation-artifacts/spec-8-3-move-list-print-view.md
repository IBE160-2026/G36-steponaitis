---
title: 'Story 8.3: Move list print view'
type: 'feature'
created: '2026-11-23'
baseline_revision: '434c8167746d2e297af710fd086e0c22989e4999'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The server builds the move list (`GET /api/plans/{id}/move-list`, Stories 8.1/8.2), but flow step 8 "Move list" is still the "This step is not built yet." placeholder, so the planner cannot check the list on screen or print it.

**Approach:** Add the print route `app/plans/[planId]/print` rendering a new `modules/move-list` page: a paper preview of the server view (header, ROUND bands, lines, footnotes) with **Print** (primary) and "Back to Recommendations". The flow step `move-list` links to `/plans/{id}/print`.

## Boundaries & Constraints

**Always:**
- Server-authoritative (AD-3, AD-17): render rounds and lines exactly in response order; never sort, filter, count or compute swap marks in the client. The round count is `header.rounds`.
- Fetch on mount: the query (key under `planRootKey`, e.g. `[...planRootKey(id), "move-list"]`) uses `refetchOnMount: "always"`, and the page renders the paper only once a response fetched after mount has arrived (`isFetchedAfterMount`); before that it shows `PlanOpening` / `PlanLoadError` like other plan pages.
- Print: pressing Print refetches the view; only after the refetch succeeded and the new data has been rendered (committed) does it call `window.print()`. A failed refetch shows the error and does not print. Print is disabled (busy) while the print refetch runs.
- Header: "Move list · <name>"; "Data as of YYYY-MM-DD · uploaded YYYY-MM-DD · N rounds" ("1 round" singular); "Generated YYYY-MM-DD HH:MM · Smart Warehouse Planner" — all through `lib/format` (`formatDate`, `formatDateTime`; `generated_at` and `uploaded_at` in the viewer's zone).
- Layout: one `<table>`; the header block and the column heads sit in its `<thead>` (so they repeat on paper in 8.4). Each round is a `<tbody>` whose first row is the band: "ROUND N" (bold, boxed) then "one walk · from-location before to-location", or for round 0 "ROUND 0" then the server `label` ("before the first run"). Columns: tick box (an empty visual box, `aria-hidden`; column head visually "✓"/sr "Done"), Round, Part, Description, From, To, Rule, Note (blank). Every line shows its Round value.
- Rule cell: rule label "Rule 1" / "Rule 2" / "Rule 3" / "Manual"; with `swap` it reads "Manual · Swap {index}/{size}" with "{a} ↔ {b}" (`swap.locations`) under it in the code font.
- Footnotes under the table: "Lines follow Walk Path; moves out of a location come before moves into it, except in a swap." and, only when some line has `swap`, "Swap: set one bin aside, move the other into its place, then put the first one in."
- Empty (no rounds): "There are no moves to print.", Print has `disabledReason` = that sentence (aria-disabled, reason on hover/focus via `Button`), and a link to Recommendations; no table.
- Flow bar: on `/plans/{id}/print` the Move list step is `aria-current="step"` and never checked (summary already sends `checked: false` for `move-list`; the client must not add a check).
- New user-facing strings live in `lib/copy` (retro epic-6 #54); rule labels move from `components/common/manual-move-dialog.tsx` into `lib/copy` and both use them (DRY).
- Tests name their FR (`fr38`, `fr7`, `uxdr6` style as in existing Vitest names); the e2e names UJ-2.

**Never:**
- No `@media print` paper stylesheet, A4 page rules, page numbers, hidden shell in print, or the cross-browser print check (Story 8.4). No backend change, no `schema.ts` change, no PDF/CSV export.
- No plan lock or write when printing (the view is a GET).
- Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`. No new dependency. No session logs or `.logs/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Lines in two rounds | view with rounds 0 (label) and 2, header.rounds 2 | bands "ROUND 0 · before the first run", "ROUND 2 · one walk · …" (gap kept), lines in response order, "2 rounds" | No error expected |
| Swap present | two lines with `swap {1,2,[A,B]}`, `{2,2,[A,B]}` | Rule "Manual · Swap 1/2" + "A ↔ B", "Manual · Swap 2/2" + "A ↔ B"; swap footnote shown | No error expected |
| No swap | no line has `swap` | only the Walk Path footnote | No error expected |
| No moves | `rounds: []` | "There are no moves to print."; Print aria-disabled with that reason; link to Recommendations | No error expected |
| Print pressed | lines shown | second GET of move-list, re-render with new `generated_at`, then `window.print()` once | refetch error → error shown, no print |
| Cached data on return | view in cache from a previous visit | page waits for the mount fetch before showing the paper | load error → `PlanLoadError` |

</intent-contract>

## Code Map

- `frontend/lib/view-state/steps.ts` -- `FLOW_STEPS`; give `move-list` a route segment `print` (e.g. `path` field, others default to their key) so every step link and the toolbar's current-step match use it.
- `frontend/lib/view-state/urls.ts` -- `planStepHref` (build path from the step's route segment), `asStepKey` (match by route segment so `rememberPlanView` records `/print` as step `move-list`); `storedPlanViewHref` then opens `/print`.
- `frontend/components/common/app-shell/toolbar.tsx:22` -- local `asStepKey(view)`; must map `print` → `move-list` (reuse a helper exported from `steps.ts`/`urls.ts`, do not duplicate).
- `frontend/app/plans/[planId]/[step]/page.tsx` -- placeholder for unbuilt steps; after this story none are left: `move-list` → `redirect` to the print route (old links), anything else `notFound()`.
- `frontend/app/plans/[planId]/before-after/page.tsx` -- pattern for the new `app/plans/[planId]/print/page.tsx`.
- `frontend/modules/before-after/before-after-page.tsx` -- pattern for a module page (`PlanOpening`, `PlanLoadError`, `showsLoadError` from `components/common/plan-status.tsx`).
- `frontend/lib/api/plans.ts` -- add `MoveListView`/`MoveListRound`/`MoveListLine`/`MoveListSwap` types (schema.ts already has them), `planMoveListKey`, `fetchPlanMoveList`, `usePlanMoveList` (mount refetch as above).
- `frontend/lib/format/index.ts` -- `formatDate`, `formatDateTime`, `formatNumber`.
- `frontend/lib/copy/index.ts` -- add move-list copy and `RULE_LABELS`; `frontend/components/common/manual-move-dialog.tsx:45` currently owns `RULE_LABELS`.
- `frontend/components/common/button.tsx` -- `Button` with `variant`, `disabledReason`; `buttonClassName` for the link-styled "Back to Recommendations" (`planStepHref(id, "recommendations")`).
- `frontend/lib/launcher/index.ts:42,246,275` -- launcher "MOV" opens via `planStepHref`; check it needs no change beyond the URL.
- Tests to update for the URL: `frontend/tests/components.test.tsx:165` (`href="/plans/p1/move-list"`), `frontend/tests/view-state.test.ts` (step hrefs/remember), `frontend/e2e/launcher.spec.ts:107`, `frontend/e2e/plan-overview.spec.ts:183-199` ("opens a step that is not built yet" → becomes: Move list link opens `/print` and an unknown step is 404), `frontend/e2e/support/warm-routes.ts` (`print` instead of `move-list`).
- `frontend/e2e/support/plan-api.ts`, `sample-plan.ts`, `test.ts` -- e2e helpers; nine specs each define their own command poster (retro epic-7 #64): add one shared `postCommand` to `e2e/support/plan-api.ts` and use it in the new spec only (migrating the old specs stays with #64).
- `frontend/e2e/apply-all.spec.ts` -- pattern: sample plan, `set_best_mark` aisle A, `run`, `apply_all` via the command API.
- Retro items: epic-7 #59 (Recommendations check after undo) is in the summary check rule, not touched here; epic-6 #54 (copy into `lib/copy`) and epic-7 #64 (shared e2e command poster) are followed for the new code only. No other open item concerns this code.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/view-state/steps.ts`, `frontend/lib/view-state/urls.ts`, `frontend/components/common/app-shell/toolbar.tsx` -- route segment `print` for `move-list`, shared step-from-segment helper.
- `frontend/app/plans/[planId]/[step]/page.tsx` -- redirect `move-list` to the print route, else 404.
- `frontend/app/plans/[planId]/print/page.tsx` -- new route rendering `MoveListPage`.
- `frontend/lib/api/plans.ts` -- move-list types, key, fetch, hook.
- `frontend/lib/copy/index.ts`, `frontend/components/common/manual-move-dialog.tsx` -- move-list strings, header line builders, rule-cell text; shared `RULE_LABELS`.
- `frontend/modules/move-list/move-list-page.tsx` -- `MoveListPage` (query, loading/error, print flow) and a pure `MoveListView` (preview, empty state) per Always.
- `frontend/tests/move-list.test.tsx` -- Vitest (TZ Europe/Oslo): header lines and singular round; bands incl. round 0 label and a round gap; lines in response order with Round on every line; rule cells incl. swap and "A ↔ B"; footnotes with/without swap; empty state with aria-disabled Print and Recommendations link; print flow (refetch then `window.print` after re-render; no print on refetch error) with a mocked fetch; step href `/plans/p1/print` and `print` → `move-list` mapping.
- Existing tests listed in the Code Map -- update for the `/print` URL.
- `frontend/e2e/support/plan-api.ts` -- shared `postCommand(request, planId, body)`.
- `frontend/e2e/move-list.spec.ts` -- import `test`/`expect` from `./support/test`. `uj2 prints the move list`: sample plan, best mark aisle A, run, apply all (API); open Overview, click the flow-bar Move list link → URL `/print`, Move list `aria-current="step"` without ", done"; header shows the plan name, "Data as of", "N rounds" and "Generated"; a "ROUND 1" band; line count equals summary `move_count`; stub `window.print` (`page.evaluate`), press Print → a second GET `/move-list` response is observed and the stub was called once. `uj2 shows no moves to print`: fresh plan → message, Print `aria-disabled="true"`, Recommendations link navigates.

**Acceptance Criteria:**
- Given a plan with effective moves, when the planner opens Move list from the flow bar, then `/plans/{id}/print` shows the header, a band per round and exactly the server's lines in server order, with Print as the only primary button and a "Back to Recommendations" link.
- Given the print view, when Print is pressed, then the move list is fetched again, the new response is rendered, and only then `window.print()` is called.
- Given the old URL `/plans/{id}/move-list`, when it opens, then it redirects to `/plans/{id}/print`; an unknown step is still 404.
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm run lint:py`, `npm run lint:imports`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 15, false 9, maybe-false 1
- findings:
  - `[low]` `[patch]` (verification-gap) the launcher's "You are here" on `/print` is not tested — `e2e/launcher.spec.ts` `mov` test now reopens the launcher on `/print` and asserts the Move list group shows "You are here".
  - `[low]` `[patch]` (verification-gap) a failed Print refetch is tested only on the pure view — `e2e/move-list.spec.ts` now routes the Print GET to a 503 and asserts the alert, Print not busy and zero prints.
  - `[low]` `[patch]` (verification-gap) the e2e cannot tell printing after the new render from printing old data — the Print GET is fulfilled with `generated_at` 2030-01-02T12:00:00Z and the print stub records the rendered "Generated" line, asserted to contain 2030-01-02.
  - `[false]` `[reject]` (blind) a fast double press prints twice — click is a discrete event: React flushes `setBusy(true)` before the next click is dispatched, and the re-rendered `Button` with `disabledReason` ignores clicks.
  - `[low]` `[patch]` (blind) a cached error from an earlier visit is shown instead of `PlanOpening` while the mount fetch runs — the page records `errorUpdatedAt` at mount and shows `PlanLoadError` only for an error after mount.
  - `[low]` `[patch]` (blind) inline user-facing fallback "The move list could not be loaded." — moved to `lib/copy` as `MOVE_LIST_LOAD_FAILED`.
  - `[false]` `[reject]` (blind) the `<h1>` header sits in a `<thead>` cell — the spec puts the header block in `<thead>` so it repeats on every printed page (UX: "Header (every page)"); changing it would mean editing the spec.
  - `[low]` `[reject]` (blind) the paper title uses `text-[14pt]` instead of a `type-print-*` token — cosmetic; the paper styling is Story 8.4, which owns the print tokens.
  - `[low]` `[reject]` (blind) the empty state drops the plan name and data line — the story's empty state is only the sentence, disabled Print and a Recommendations link; the plan plate in the toolbar already names the plan.
  - `[low]` `[reject]` (blind) the old-URL redirect drops the query — the Move list step has no view query; nobody meets this in normal use, and passing it through adds code.
  - `[false]` `[reject]` (blind) `stepSegment` silently falls back to Overview — every `FLOW_STEPS` entry has a `segment` and the type forbids a missing key, so the fallback is unreachable.
  - `[low]` `[patch]` (blind) the React wiring of the print flow has no test — same root cause as the verification-gap render-before-print row; covered by the same e2e patch.
  - `[low]` `[patch]` (blind) no test of the launcher on `/print` — same as the first row; same patch.
  - `[low]` `[patch]` (blind) the e2e does not check the rendered `generated_at` came from the second response — same as the render-before-print row; same patch.
  - `[low]` `[patch]` (intent) re-render before print is asserted only at controller level — same root cause as the render-before-print row; same patch.
  - `[low]` `[patch]` (intent) failed print refetch and busy Print tested only as static markup — same as the failed-refetch row; same patch (busy state asserted cleared in the browser).
  - `[low]` `[reject]` (intent) the header's viewer-zone formatting is checked only in Vitest — Vitest pins exact strings under TZ=Europe/Oslo through the shared `lib/format`; a browser-zone e2e adds little.
  - `[low]` `[reject]` (intent) the empty state's hover/focus reason is checked only in markup — the reason comes from the shared `Button`, whose hover/focus tip is covered by existing tests.
  - `[false]` `[reject]` (intent) paper-facing wording ("prints its Round", tick box) is not checked on paper — Epic 8 assigns the print stylesheet and the print check to Story 8.4; 8.3 renders the view.
  - `[false]` `[reject]` (intent) "Move list never checked" rests on the server — the summary rule sends `checked: false` for `move-list`, and the e2e asserts the step's accessible name has no ", done" after apply all.
  - `[false]` `[reject]` (intent) the step URL changing to `/print` is a reading the story does not state — the story's AC names "the Move list step and the print route `/plans/{id}/print`" and the architecture maps Move list to `app/plans/[id]/print`; the old URL redirects.
  - `[false]` `[reject]` (intent) the retro clause read narrowly — items #27/#32 (dialog details), #51 (launcher hand-offs) and #59 (Recommendations check) concern behaviour this story does not change; it only moved `RULE_LABELS` and the current-step mapping.
  - `[false]` `[reject]` (edge) a Print refetch returning no rounds prints the empty state — `committed` runs only when `renderedAt` is a fresh view; an empty view is a legitimate print of "There are no moves to print." only if the plan was reset between press and response, and nothing is lost; no harm named beyond a blank page. (Reclassified: not a defect of this story's contract.)
  - `[false]` `[reject]` (edge) a rejecting `flow.request` leaves Print busy — TanStack `refetch()` resolves with the error result unless `throwOnError` is set, and this query does not set it.
  - `[maybe-false]` `[reject]` (edge) a fetch in flight from before mount is deduped onto the mount fetch, so the paper could show a pre-visit `generated_at` — would need a leave-and-return within one request's time to check; if true only `low` (seconds-old data), so rejected with this note.


## Design Notes

**Why `/print` and step key `move-list`:** the story and the architecture (AD-17, source tree) name the route `plans/[id]/print`, while the flow step key, the launcher entry ("MOV") and the stored last view use `move-list`. Keeping the key and giving the step its own route segment honours both; the old `/move-list` URL redirects so bookmarks and earlier stored links still work.

**Print after re-render:** e.g. keep a `printPending` flag; Print sets it and calls `refetch()`; an effect that depends on `dataUpdatedAt` (or on the refetch promise resolving followed by a `requestAnimationFrame`/effect after commit) calls `window.print()` once and clears the flag. The effect must not fire on ordinary refetches (command refetch, focus).

## Verification

**Commands:**
- `npm run lint` -- expected: no ESLint errors
- `npm run typecheck` -- expected: no errors
- `npm run lint:py` and `npm run lint:imports` -- expected: pass (no backend change)
- `npm test` -- expected: pytest and Vitest pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including `e2e/move-list.spec.ts`

## Auto Run Result

Status: done

**Summary:** Flow step 8 Move list is now built (FR-38, UX-DR52, UX-DR6, AD-17). The step links to `/plans/{id}/print`, which renders `modules/move-list`. The page fetches the server view on mount and shows the paper only after that response arrives. The paper has a header ("Move list · name", "Data as of · uploaded · N rounds", "Generated YYYY-MM-DD HH:MM · Smart Warehouse Planner") and column heads in `<thead>`, a ROUND band per round (round 0 "before the first run"), and lines in server order with a tick box, Round, Part, Description, From, To, Rule (swap lines "Manual · Swap i/n" with "A ↔ B") and a blank Note. The footnotes include the swap note only when a swap is present. Print refetches the view, waits for the new data to render, then calls `window.print()`. A failed refetch shows the error and does not print. With no moves, the page says "There are no moves to print." and Print is aria-disabled with that reason. The old `/move-list` URL redirects to `/print`. Retro items: epic-6 #54 (copy in `lib/copy`, including the shared `RULE_LABELS`) and epic-7 #64 (shared e2e `postCommand`) were followed for the new code only. No other open item concerns this code. epic-7 #59 is a summary check rule and is untouched.

**Files changed:**
- `frontend/lib/view-state/steps.ts` -- route `segment` per step (`print` for Move list), plus `stepSegment`/`stepFromSegment`/`stepFromKey`.
- `frontend/lib/view-state/urls.ts` -- step hrefs and remembered views use the segment.
- `frontend/components/common/app-shell/toolbar.tsx`, `frontend/modules/launcher/launcher.tsx` -- current step from the URL segment.
- `frontend/app/plans/[planId]/[step]/page.tsx` -- `move-list` redirects to `/print`; anything else is 404.
- `frontend/app/plans/[planId]/print/page.tsx` -- new route.
- `frontend/modules/move-list/move-list-page.tsx` -- print view, `createPrintFlow` and the print-after-render hook.
- `frontend/lib/api/plans.ts` -- move-list types, key, fetch and hook.
- `frontend/lib/copy/index.ts`, `frontend/components/common/manual-move-dialog.tsx` -- move-list copy; shared `RULE_LABELS`.
- `frontend/tests/move-list.test.tsx`, `frontend/tests/view-state.test.ts`, `frontend/tests/components.test.tsx` -- Vitest.
- `frontend/e2e/move-list.spec.ts`, `frontend/e2e/support/plan-api.ts` -- UJ-2 journeys and the shared `postCommand`.
- `frontend/e2e/launcher.spec.ts`, `frontend/e2e/plan-overview.spec.ts`, `frontend/e2e/support/warm-routes.ts` -- updated for `/print`.

**Review findings:** 25 findings: high 0, medium 0, low 15, false 9, maybe-false 1.
- **Patched (5 entries, all low):**
  - a check that printing happens after the new data renders, as an e2e with a routed `generated_at`;
  - a failed Print refetch in the browser;
  - the launcher's "You are here" on `/print`;
  - no stale cached error on return;
  - the fallback string moved to `lib/copy`.
- **Deferred:** none.
- **Rejected:** the rest, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): the patched entries were 0 high, 0 medium and 5 low.

**Verification:**
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm run lint:py`: all checks passed.
- `npm run lint:imports`: 5 contracts kept.
- `npm test`: pytest 694 passed, 2 skipped (Postgres-only); Vitest 392 passed.
- `npm run e2e -- --project=chromium`: 81 passed, both before and after the review patches.

**Residual risks:**
- The page was not checked by eye.
- Firefox and Edge were not run; the paper stylesheet and the cross-browser print check are Story 8.4.
- The empty state's link to Recommendations is the always-visible "Back to Recommendations" link.
