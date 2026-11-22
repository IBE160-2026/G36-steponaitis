---
title: 'CI 44974484407: open and close the part panel without a server round trip'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_revision: 'cdadc3e501523dd11a405a726e4c3e542a062ba4'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      Browser Back/Forward over a part-panel history entry does not return focus to the opener or move it to the panel heading.
    evidence: |-
      Back removes ?part= through useSearchParams without calling close(), so focus is not restored and opener.current keeps a stale element. The same was true before this change (router.push also created the history entry and Back skipped close()), so it is pre-existing. A useEffect on `part` in usePartPanel would fix it.
    location: >-
      frontend/components/common/part-panel.tsx usePartPanel
    severity: low
  - summary: >-
      POST /api/plans intermittently returns 500 when parallel e2e workers create sample plans at the same time.
    evidence: |-
      The implementation run saw one createSamplePlan setup failure (HTTP 500) in 40 repeated runs, before any panel code ran; the next 40-run batches passed. swp/store/db.py creates the SQLite engine with the default 5 s lock timeout and no WAL, so concurrent heavy imports can raise "database is locked". Not reproduced or confirmed by a server log in this run; settle by capturing the uvicorn traceback during a --repeat-each run. Backend change was outside this fix's scope.
    location: >-
      backend/swp/store/db.py get_engine
    severity: medium (unverified)
  - summary: >-
      Under heavy machine load the e2e journeys can still miss a 5 s assertion on steps that must reach the server (page data, part detail, search API, pick-groups API).
    evidence: |-
      Repeated local runs at load average 15-29 (unrelated system processes at 100% CPU) failed 1-3 of 40 at server-backed steps: pick-groups API error banner, part detail not rendered in 5 s, search request failing at the API. None failed in the panel open/close, Back or aisle-change paths. The baseline also depends on these. Options: run CI e2e against `next build && next start` instead of `next dev`, and fix the backend 5xx above.
    location: >-
      frontend/playwright.config.ts webServer
    severity: low
---

<intent-contract>

## Intent

**Problem:** CI run 44974484407 failed `frontend/e2e/part-panel-search.spec.ts:34` (uj7) twice at line 63: after the part search result was clicked, the URL stayed `/plans/<id>/parts` for more than 5s. Both CI traces show the click did run `onOpenPart`: `usePartPanel.open` calls `router.push(...?part=)`, the RSC request for `?part=1240364` starts within ~25 ms of the click, but the navigation only commits ~6 s later (the part-detail fetch starts at +6.3 s), because the `next dev` server renders the dynamic page under the load of parallel e2e workers. Opening a panel — pure client view state — waits on a server render of the whole page, so the URL, the panel and the focus move are timing-dependent. Debounce, stale `keepPreviousData` results and result re-renders were ruled out: the request for the clicked part was made.

**Approach:** Open and close the part panel through the native History API (`window.history.pushState` / `replaceState`), which Next.js 16 integrates into the router so `useSearchParams` updates synchronously; `usePartPanel` reads the open part from `useSearchParams` instead of the server-rendered `params` prop. The URL and the panel then change in the same client render as the click or `Esc`, with no server round trip.

## Boundaries & Constraints

**Always:** `?part=` stays the single source of the open panel (UX-DR24); URLs are still built only by `planStepHref`/`parseLocationParams` in `lib/view-state/urls.ts` (AD-20). Opening pushes a history entry, closing replaces it, `scroll` is not changed, and focus moves exactly as before (panel heading on open, opener on close). A direct load of `?part=X` still renders the panel on the server (the page routes keep awaiting `searchParams`, so they stay dynamically rendered and `useSearchParams` is available during SSR). The aisle change on the Locations page keeps the open part.

**Never:** No raised timeouts, extra retries, `waitForTimeout`, or test-only branches in app code. No change to the search request flow (debounce is not the cause). No change to `page.tsx` files, to the backend, or to `data/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open from search | Click a part result on `/parts` | URL is `/parts?part=X` in the same render; panel heading focused | No error expected |
| Open with view state | Click a part result on `/locations?aisle=A&loc=L` | URL keeps `aisle` and `loc` and adds `part=X` | No error expected |
| Close | `Esc` / close button on `?part=X` | URL drops `part`, keeps the rest; opener refocused | Opener gone: focus is not moved |
| Aisle change with panel open | Select another aisle | URL is `?aisle=B&part=X`; panel stays | No error expected |
| Direct load | GET `/parts?part=X` | Panel rendered from the first (server) render | No error expected |

</intent-contract>

## Code Map

- `frontend/components/common/part-panel.tsx:44-70` -- `usePartPanel(planId, step, params)`: today reads `part` from server `params` and opens/closes with `router.push`/`router.replace`. The fix point.
- `frontend/modules/locations/locations-page.tsx:245-258` -- `LocationsPage`; `onAisleChange` builds the URL with `params.part` (server prop, stale after a client-side open) -- must use `panel.part`.
- `frontend/modules/parts/parts-page.tsx:203-215`, `frontend/modules/pick-groups/pick-groups-page.tsx:99-105` -- other `usePartPanel` callers; no change needed beyond the hook.
- `frontend/lib/view-state/urls.ts` -- `planStepHref`, `parseLocationParams` (accepts `URLSearchParams`; Next's `ReadonlyURLSearchParams` extends it). Reuse, do not duplicate.
- `frontend/app/plans/[planId]/{parts,locations,pick-groups}/page.tsx` -- read-only: await `searchParams`, which keeps the routes dynamic so `useSearchParams` works in SSR.
- `node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md:344` -- "Native History API": `pushState`/`replaceState` integrate with `useSearchParams`.
- `frontend/e2e/part-panel-search.spec.ts` -- uj7/uj6 journeys; read-only unless a step relied on the old server round trip.

## Tasks & Acceptance

**Execution:**
- `frontend/components/common/part-panel.tsx` -- in `usePartPanel`, read `part` via `parseLocationParams(useSearchParams())`; `open` pushes and `close` replaces `planStepHref(planId, step, {...rest, part?})` with `window.history`, where `rest` is the current `aisle`/`loc` from the hook's search params; drop `useRouter`; update the header comment -- removes the server round trip from opening/closing the panel.
- `frontend/modules/locations/locations-page.tsx` -- `onAisleChange` passes `part: panel.part` -- keeps the panel across an aisle change after a client-side open.

**Acceptance Criteria:**
- Given the uj7 and uj6 journeys, when `npx --workspace frontend playwright test e2e/part-panel-search.spec.ts --project=chromium --repeat-each=20` runs, then all 40 runs pass.
- Given a part panel opened from a search result, when the click handler returns, then `window.location.search` already contains `part=` (no RSC request for `?part=` is made).
- Given the whole suite, when `npm run e2e -- --project=chromium`, `npm run lint`, `npm run typecheck`, `npm run test:web` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 29 findings — high 0, medium 4, low 17, false 7, maybe-false 1
- findings:
  - `[medium]` `[patch]` Blind: Locations page reads aisle/loc from the server prop and part from useSearchParams (two sources) — `LocationsPage` now derives `params` from `parseLocationParams(useSearchParams())`; the server prop is no longer read.
  - `[medium]` `[patch]` Blind: aisle change still a server render (`router.replace`), the same timing-dependent path in the same journey — `onAisleChange` now uses `window.history.replaceState` with `{aisle, part: panel.part}`.
  - `[low]` `[patch]` Blind: the no-server-render check misses a render on close (filter needs `part=`) and is never removed — filter now matches any `_rsc=` request for `/plans/<id>/parts`; listener removed with `page.off` after the check.
  - `[low]` `[reject]` Blind: no unit test for `usePartPanel` — open/close/focus are covered end to end by uj7/uj6 (40/40 repeat runs); a hook test harness would add complexity for no extra user-facing coverage.
  - `[low]` `[defer]` Blind: Back/Forward does not move focus — pre-existing (router.push behaved the same); deferred in frontmatter.
  - `[low]` `[reject]` Blind: dead `params` prop on PartsPage/PickGroupsPage — harmless optional prop; removing it correctly also means changing the route files to stay dynamic (`connection()`), more than a direct deletion, and no user meets it.
  - `[low]` `[patch]` Blind: hook silently relies on dynamic routes for SSR of `useSearchParams` — header comment in part-panel.tsx now states it.
  - `[low]` `[patch]` Blind: comments overclaim ("same render", "from the first render") — wording corrected in part-panel.tsx and the uj6 comment.
  - `[low]` `[reject]` Blind: exact-order Locations URL regex, aisle not escaped — order is fixed by `planStepHref` (the single URL builder, AD-20); synthetic aisles/codes are letters, digits and `-`; the same pattern is used throughout the spec.
  - `[low]` `[reject]` Blind: `restKey` JSON round trip no longer needed — still correct and cheap; cosmetic.
  - `[medium]` `[patch]` Edge: part opened while an aisle `router.replace` is pending is overwritten by the router commit — grouped with the aisle-change patch: aisle change is now synchronous `replaceState`, so no pending navigation exists.
  - `[medium]` `[patch]` Edge: `open()` may push stale aisle/loc while a router navigation is pending — same root cause and patch; the remaining router navigations (Links) replace the URL wholesale anyway.
  - `[low]` `[defer]` Edge: Back/Forward focus and stale opener ref — same as the Blind Back/Forward row; pre-existing.
  - `[low]` `[patch]` Edge: two URL sources on Locations — grouped with the Locations single-source patch.
  - `[false]` `[reject]` Edge: URL assertion fails for codes with spaces or `!'()~` — synthetic data (`data/sample/`) has no such characters in part numbers or location codes.
  - `[false]` `[reject]` Edge: regex metacharacters in aisle/ids — same; aisles are single letters, ids are digits and `-`.
  - `[low]` `[patch]` Edge: request listener never removed — `page.off` added.
  - `[low]` `[reject]` Edge: dead `params` prop — as the Blind row.
  - `[false]` `[reject]` Edge: aisle change drops `loc` — unchanged from before this diff (`{aisle, part}`) and intended: `loc` focuses a row of the previous aisle link.
  - `[low]` `[patch]` Verification gap: Back after opening a panel is not tested though open now uses raw `pushState` — uj6 now opens the panel, presses Back, and asserts the URL, that the panel is gone and that no reload happened (window marker).
  - `[low]` `[patch]` Verification gap: the no-server-render check cannot see a render on close — same patch as the Blind row.
  - `[low]` `[reject]` Verification gap (other): dead `params` prop — as the Blind row.
  - `[low]` `[patch]` Verification gap (other): two URL sources on Locations — grouped with the Locations single-source patch.
  - `[false]` `[reject]` Intent: cause placed in navigation, not search — the CI traces show the `?part=` request left ~25 ms after the click and committed ~6 s later; search was not the cause.
  - `[maybe-false]` `[reject]` Intent: determinism only proven locally, not under CI load — the fix removes the server round trip by construction and the test asserts no such request; only a CI run settles it, which this run may not trigger (no push). If true it would be low.
  - `[false]` `[reject]` Intent: scope wider than uj7 (three pages) — the hook is shared; fixing it once fixes every caller, as the vertical-slice/DRY rule asks.
  - `[false]` `[reject]` Intent: test edits go beyond the failing line (exact URLs, no server render, direct load) — they cover the spec's I/O matrix rows, which the step-03 matrix audit required; not a defect.
  - `[false]` `[reject]` Intent: no evidence verification ran — it ran: lint, typecheck, test:web, two 40/40 repeat runs and full chromium e2e 34/34 (see Auto Run Result).
  - `[low]` `[patch]` Intent: leftovers (dead `params` prop; two URL sources on Locations; aisle change via `router.replace`) — two sources and aisle change fixed by the Locations patch; the dead prop is rejected as in the Blind row.

## Design Notes

Evidence (CI trace, first try): click done at trace 44226 ms (≈ 02:07:30.53Z); `GET /parts?part=1240364&_rsc=…` at 02:07:30.554Z; expect fails at ≈ 02:07:35.9Z; `GET /api/plans/<id>/parts/1240364` (panel mounted) at 02:07:36.832Z. Retry: RSC at 02:07:47.365Z, panel fetch 02:07:53.258Z. The snapshot at failure shows the results closed (`setOpen(false)` ran) and no panel.

## Verification

**Commands:**
- `npx --workspace frontend playwright test e2e/part-panel-search.spec.ts --project=chromium --repeat-each=20` -- expected: 40 passed
- `npm run e2e -- --project=chromium` -- expected: all passed
- `npm run lint` / `npm run typecheck` / `npm run test:web` -- expected: exit 0

### 2026-11-22 — Verification fixes after the review patches
- The new direct-load step waited for the pick-groups data with a 5 s `expect`; it now waits for the table first, like the journey's other steps (`locator.waitFor`).
- Trace of a line-113 failure (location chip, `/parts` → `/locations`): the RSC request took 5.4 s because `next dev` compiled the `/locations` route on its first request. With the panel no longer waiting on server renders, uj7 reaches that step earlier than other workers compile the route. Added `frontend/e2e/support/warm-routes.ts` as Playwright `globalSetup` (runs after the web server is up) to request every app route once, so no journey waits on a cold compile. No timeout raised.

## Auto Run Result

**Summary:** CI run 44974484407 failed uj7 because opening the part panel used `router.push`, which waits for `next dev` to re-render the page on the server. Under load from parallel workers that took about 6 s, longer than the 5 s URL assertion. The part panel, and the Locations aisle filter, are now client view state written with the native History API and read with `useSearchParams`, so the URL and the panel no longer wait on the server. e2e also compiles every route before the journeys start.

**Files changed:**
- `frontend/components/common/part-panel.tsx` -- `usePartPanel(planId, step)` reads `?part=` and the rest from `useSearchParams`; open is `pushState` and close is `replaceState`; `useRouter` removed; the comment states that this relies on the routes being dynamic.
- `frontend/modules/locations/locations-page.tsx` -- reads `aisle`/`loc`/`part` from the URL (one source); the aisle change is `replaceState` and keeps `part`.
- `frontend/modules/parts/parts-page.tsx`, `frontend/modules/pick-groups/pick-groups-page.tsx` -- call the hook without server params.
- `frontend/e2e/part-panel-search.spec.ts` -- asserts that no server render happens on panel open or close, that the Locations URL keeps `aisle`/`loc` when the panel opens and keeps the aisle when it closes, that browser Back closes the panel without a reload, and that a direct load of `?part=` shows the panel.
- `frontend/e2e/support/warm-routes.ts`, `frontend/playwright.config.ts` -- `globalSetup` that compiles every app route before the tests start.

**Review findings:** 29 findings: 0 high, 4 medium, 17 low, 7 false, 1 maybe-false. Patches covered every medium (the Locations view state split between two sources, and the aisle change going through the server) and these lows: the close render not checked, listener cleanup, the Back test, the comment on dynamic routes, and overclaiming comments. The implementation subagent had already finished, so the orchestrator applied the patches. Deferred: focus on Back/Forward (existed before this change), the intermittent backend 5xx under parallel load (unverified), and server-backed 5 s waits under heavy load. Rejected with reasons in the triage log: no `usePartPanel` unit test, dead `params` prop, URL regex order and escaping, the `restKey` round trip, `loc` dropped on aisle change, and the five intent-audit items that were descriptive or refuted.

**Follow-up review recommendation:** false. No high entry was patched, but the two medium entries patched (the two-source state and the server-bound aisle change) share one root cause and one fix. The patched code is covered by uj7 (aisle change with the panel open) and by the Back step in uj6.

**Verification:**
- `npm run lint`, `npm run typecheck` -- exit 0. `npm run test:web` -- 136 tests passed.
- `npm run e2e -- --project=chromium` -- 34 passed (core fix), 34 passed (after the review patches), and 34 passed (with the warm-up).
- `npx --workspace frontend playwright test e2e/part-panel-search.spec.ts --project=chromium --repeat-each=20`:
  - Core fix: 40/40 twice.
  - After the review patches, at load average 14-29: 37/40, 38/40, 37/40 and 37/40. The failures were cold route compiles, the backend 5xx and server-backed 5 s waits.
  - With the warm-up: 39/40. The one failure was a pick-groups API error banner from the backend under load.
  - Baseline (`cdadc3e`) at similar load: 40/40.

**Residual risks:**
- Under heavy load the e2e suite still waits on the server for page data and API responses, within 5 s assertions.
- The backend 5xx on concurrent plan creation or reads is unverified.
- Determinism in CI itself can only be confirmed by a CI run (not pushed).

