---
title: 'Story 3.3: Client command flow and autosave'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_revision: '04f59ba73746720109d11113d3c52676c47d1a96'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-3-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The server can apply commands (`POST /api/plans/{id}/commands`, Story 3.2), but the client has no way to send one. Every later plan change (marks in 3.4, keep, run, apply, moves, undo, reset) needs one shared client flow that sends one command at a time, shows a change only once it is saved, retries transient failures and tells the planner clearly when saving fails.

**Approach:** Add the shared `frontend/lib/commands` flow: a framework-free `CommandClient` (one in-flight command per plan, retry schedule, error handling, version-consistent refetch, observable per-plan save state) plus React bindings (provider, `usePlanCommands`, `useConsistentPlanData`). Wire it into the app: a save-status region with the `GlobalNotice` under the toolbar, and "Saved automatically" in the plan plate tooltip. No control sends a command yet; Story 3.4 is the first caller.

## Boundaries & Constraints

**Always:** One command at a time per plan: a `send` while that plan has a command unconfirmed sends nothing and returns `"busy"`. Each command gets a new `command_id` (`crypto.randomUUID()`) and `base_version` = the highest `version` among the cached `['plan', planId]` query data (0 when none is cached). Retries reuse the same body and `command_id`. Retry delays are exactly 1000, 2000, 4000, 8000 ms (4 retries, 5 attempts). The client never edits query data optimistically: the plan changes on screen only through refetched server data. The per-plan state stays `pending` (controls disabled, reason `"Saving the last change…"`) until the post-response handling (including refetches) has finished. Messages verbatim: `"Saving the last change…"`, `"Saved automatically"`, `"The last change was not saved yet. Trying again."`, `"The change was not saved. Try again."`. `plan_not_found` reuses `handleQueryError` from `lib/api/query-errors.ts` (toast "This plan was deleted." + New Plan). Effects (toast, navigate) are injected, so `lib/` never imports `components/`. Modules import only `components/*` and `lib/*`. Tests name the FR/NFR/AD they cover (e.g. `fr10_…`, `ad12_…`).

**Never:** No control that sends a command, no mark UI, no "Best-location marks changed." toast (Story 3.4). No `unauthenticated`/login handling (accounts arrive with FR-39/40; until then 401 is an "other 4xx"). No `run`-specific "Run failed" state. No Save button. No optimistic updates or `setQueryData` on plan queries. No refetch or invalidation of `['import', importId]` or `['plans']` queries. No backend change and no new Playwright test (nothing user-triggerable sends a command yet; existing e2e must stay green; 3.4 adds the journey). No new dependencies (no jsdom/testing-library: Vitest runs in `node`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Confirmed | idle plan, cached summary v4; `send({type:"set_best_mark", mark})` | one POST body `{type, mark, command_id:<uuid>, base_version:4}`; while in flight `pending=true`; on 200 `{version:5}` active `['plan', planId]` queries refetched; then `pending=false`, `saved=true`, `notice=null`; returns `"confirmed"` | none |
| Busy | a command in flight for plan P | second `send` for P → `"busy"`, no request; a send for another plan Q goes out | none |
| Stale refetch | after confirm v5, a refetched view still returns v4 | that query refetched again, at most 2 extra times; then stop | stays as server returned |
| Transient then ok | fetch throws, then 503, then 200 | retries after 1000 then 2000 ms with the same `command_id`; `notice="retrying"` during retries, cleared on success | — |
| Transient exhausted | network error/502/503/504 on all 5 attempts | waits 1000, 2000, 4000, 8000 ms; then drop, refetch plan, `notice="failed"`; returns `"dropped"` | — |
| 500 | first response 500 | no retry; drop, refetch, `notice="failed"` | — |
| Plan deleted | 404 `plan_not_found` | drop, `notice=null`; `handleQueryError` → toast "This plan was deleted." + navigate `/plans/new` | no refetch |
| Other 4xx | 422 `validation_failed` `message:"X"` | drop; toast "X"; refetch plan; `notice=null` | — |
| Non-envelope 4xx | 400 with HTML body | parsed as `internal` → toast `INTERNAL_MESSAGE`; refetch | — |
| Next send after failure | `notice="failed"` | new `send` clears the notice when it starts | — |
| Versions disagree | `useConsistentPlanData([summary v5, locations v4])` | returns the last set whose versions all agreed (or `undefined` if none yet) | — |

</intent-contract>

## Code Map

- `frontend/lib/api/errors.ts` -- `ApiError(status, code, message)`, `parseErrorBody(status, text)` (non-envelope → `internal`), `internalError()`, `INTERNAL_MESSAGE`. Reuse for command responses.
- `frontend/lib/api/plans.ts` -- `getJson` pattern; key builders `planSummaryKey` etc. are all `['plan', planId, …]`; every plan view type has `version: number`. Export new `Command`/`CommandResult` types next to the others (from `components["schemas"]` / `operations["post_command_api_plans__plan_id__commands_post"]["requestBody"]["content"]["application/json"]`).
- `frontend/lib/api/query-errors.ts` -- `handleQueryError(error, {notify, navigate})`, `QueryErrorEffects`, `PLAN_DELETED`, `NEW_PLAN_HREF`. Reuse as the command effects type.
- `frontend/app/providers.tsx` -- creates the `QueryClient` (retry false) and wires `handleQueryError` with `showToast` + `router.replace`. Add the commands provider here with the same effects.
- `frontend/components/common/global-notice.tsx` -- unused so far; `role="status"` strip with warning icon. Needs an opt-out of its own live role when nested in the save-status live region.
- `frontend/components/common/app-shell/index.tsx` -- `AppShell` renders `<Toolbar />` then `<main>`; the save notice goes between them.
- `frontend/components/common/app-shell/toolbar.tsx` -- `PlanToolbarParts` reads `usePlanSummary`, renders `PlanPlate`; `parsePlanPath(usePathname())` gives `planId`.
- `frontend/components/common/app-shell/plan-plate.tsx` -- tooltip span (`role="tooltip"`) currently holds `uploadedText(uploadedAt)`; add the saved line.
- `frontend/components/common/button.tsx` -- `disabledReason` prop already renders `aria-disabled="true"` + reason tooltip; callers pass `SAVING_REASON` while pending.
- `frontend/components/common/toast.tsx` -- `showToast(message)`.
- `frontend/tests/plan-views.test.tsx` -- test style: `renderToStaticMarkup`, `vi.stubGlobal("fetch", …)`, `vi.unstubAllGlobals()` in `afterEach`.
- `frontend/vitest.config.mts` -- `environment: "node"`, includes `tests/**/*.test.{ts,tsx}`.
- `frontend/eslint.config.mjs` -- module boundary rule (lib/components unrestricted, but keep `lib` free of `components` imports by convention).

## Tasks & Acceptance

**Execution:**
- `frontend/lib/api/plans.ts` -- export `Command` (request body union), `CommandResult` types, `planRootKey(planId)` = `['plan', planId]` -- one place for the prefix.
- `frontend/lib/commands/client.ts` (new) -- `CommandClient(queryClient, effects: QueryErrorEffects, options?: {sleep?, randomId?})`: `send(planId, body: CommandBody) => Promise<"confirmed"|"dropped"|"busy">` (`CommandBody` = `Command` without `command_id`/`base_version`, distributive); `getState(planId) => {pending, notice: null|"retrying"|"failed", saved}` (stable object per change), `subscribe(listener)`. Constants `RETRY_DELAYS_MS = [1000,2000,4000,8000]`, `SAVING_REASON`, `SAVED_TEXT`, `RETRYING_TEXT`, `FAILED_TEXT`, `noticeText(notice)`. POST `/api/plans/{id}/commands` JSON; retry on fetch throw or 502/503/504; 500/exhausted → refetch + `failed`; `plan_not_found` → `handleQueryError`; other non-2xx → `notify(message)` + refetch. After confirm: `invalidateQueries({queryKey: planRootKey(planId), refetchType: "active"})`, then refetch each active query whose `data.version` < confirmed version, up to 2 rounds. Exported pure `baseVersion(queryClient, planId)` and `isConsistent(datas)`.
- `frontend/lib/commands/react.tsx` (new) -- `CommandsProvider({effects, children})` builds one `CommandClient` from `useQueryClient()`; `usePlanCommands(planId)` → `{send, pending, notice, saved, disabledReason: SAVING_REASON | undefined}` via `useSyncExternalStore`; `useConsistentPlanData(datas)` returns the latest array whose items are all defined with equal `version`, else the previous such array (ref), else `undefined`.
- `frontend/lib/commands/index.ts` (new) -- re-exports.
- `frontend/app/providers.tsx` -- wrap children in `CommandsProvider` with the same `notify`/`navigate` effects as the query cache.
- `frontend/components/common/global-notice.tsx` -- add `live?: boolean` (default `true`); `live={false}` drops `role="status"`.
- `frontend/components/common/app-shell/save-status.tsx` (new) -- `SaveStatusView({notice, saved})`: an always-rendered `aria-live="polite"` wrapper containing `GlobalNotice live={false}` with `noticeText(notice)` when a notice exists, else an `sr-only` "Saved automatically" when `saved`, else nothing; `PlanSaveStatus` reads `planId` from the path and `usePlanCommands`; renders the empty wrapper off plan paths.
- `frontend/components/common/app-shell/index.tsx` -- render `<PlanSaveStatus />` right after `<Toolbar />`.
- `frontend/components/common/app-shell/plan-plate.tsx` + `toolbar.tsx` -- `PlanPlate` gets `saved?: boolean`; tooltip shows `uploadedText` and, when saved, a second line "Saved automatically"; the toolbar passes `usePlanCommands(planId).saved`.
- `frontend/tests/commands.test.tsx` (new) -- every matrix row with mocked `fetch`, a real `QueryClient` with seeded/observed plan queries, injected `sleep` recording delays (or fake timers); disabled-while-saving (`pending` and `disabledReason` during the in-flight request, cleared after); `useConsistentPlanData`/`isConsistent`; `SaveStatusView` and `PlanPlate` markup (live wrapper, notice texts, saved line, no Save button).

**Acceptance Criteria:**
- Given a plan with an in-flight command, when a plan-changing `Button` uses `usePlanCommands(planId).disabledReason`, then it renders `aria-disabled="true"` with the reason "Saving the last change…", and after the response handling finishes it renders enabled.
- Given a confirmed command, when the plan plate tooltip renders, then it contains "Saved automatically", and no Save button exists anywhere in the shell.
- Given a confirmed command, when the refetch runs, then only `['plan', planId]` queries are fetched (an observed `['import', id]` query is not), and no plan query data changes before the POST resolves.
- Given the save status changes, when it renders, then it is inside a persistent `aria-live="polite"` region.
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 39 findings — high 0, medium 5, low 24, false 10, maybe-false 0
- findings:
  - `[low]` `[patch]` (edge) 2xx with non-JSON body or failing body read makes `send` reject with no notice or refetch — body reads wrapped; a read failure counts as a 500 (drop, refetch, `failed`); test added.
  - `[low]` `[reject]` (edge) `crypto.randomUUID` is missing outside secure contexts — the app runs on localhost and HTTPS only; a fallback generator adds code for a setup nobody uses.
  - `[low]` `[reject]` (edge) POST has no timeout, so a hung socket keeps `pending` forever — browsers end stalled connections; AD-12 sets no timeout and adding abort handling is new branching for a rare case.
  - `[low]` `[patch]` (edge) every 5xx (501, 505) goes to the failed notice instead of only 500 — condition changed to `status === 500`; other non-2xx toast and refetch; test added.
  - `[false]` `[reject]` (edge) `send` with an empty plan id posts to `/api/plans//commands` — no caller sends off plan paths; `PlanSaveStatus` only reads state.
  - `[low]` `[reject]` (edge) per-plan states are never cleared, so an old `failed` notice reappears on reopening the plan — the failed change really was not saved; clearing on navigation adds lifecycle code for a rare in-session case.
  - `[low]` `[reject]` (edge) switching to a plan saved earlier in the session announces "Saved automatically" — rare in M1 (one plan at a time); fixing needs per-view tracking.
  - `[low]` `[reject]` (edge) `useConsistentPlanData` can return the previous plan's set after a plan switch — no caller yet; plan routes remount their views; Story 3.4 is the first consumer.
  - `[false]` `[reject]` (edge) a changed `client`/QueryClient after first render goes stale — `client` is passed only in tests and the QueryClient is held in `useState`, so neither changes.
  - `[medium]` `[patch]` (edge) `saved` stays true while the next change is unsaved or retrying — `send` now resets `saved: false` at start; test added.
  - `[false]` `[reject]` (edge) a confirm without numeric `version` is reported as saved — the server's `CommandResult` model always carries an int `version`.
  - `[low]` `[patch]` (edge, claim) code routes all 5xx to `fail`, spec says 500 — same patch as the 5xx row.
  - `[low]` `[reject]` (edge, claim) `useConsistentPlanData` uses `useState` not a ref — the project lint rule `react-hooks/refs` forbids ref access during render; behaviour matches the spec.
  - `[medium]` `[patch]` (blind) old "Saved automatically" visible during the next unsaved change — same patch as the edge `saved` row.
  - `[low]` `[patch]` (blind) body-read errors escape `send` as rejections — same patch as the edge body-read row.
  - `[low]` `[reject]` (blind) `crypto.randomUUID` in insecure contexts — same reason as the edge row.
  - `[low]` `[reject]` (blind) no POST timeout — same reason as the edge row.
  - `[low]` `[reject]` (blind) 408/429 not retried — AD-12 names exactly 502/503/504 and the backend sends neither 408 nor 429.
  - `[low]` `[reject]` (blind) `useConsistentPlanData` keeps another plan's data — same reason as the edge row.
  - `[low]` `[patch]` (blind) `useConsistentPlanData` returns a fresh array every render — now returns the remembered set when the items match.
  - `[medium]` `[patch]` (blind) the keep-previous-set path of the hook is untested — added a render-phase stepping test (`[v4,v4]` then `[v5,v4]` → "4,4").
  - `[low]` `[patch]` (blind) `PlanSaveStatus` and toolbar wiring untested — added an `AppShell` test on a plan path (mocked `next/navigation`) for the saved line and the failed notice.
  - `[medium]` `[patch]` (blind) repeated saves are announced once — same root as the `saved` row: resetting `saved` at send start changes the live region content each time.
  - `[false]` `[reject]` (blind) the two error hooks in `providers.tsx` can use different `router.replace` — the app-router `useRouter()` instance is stable, so both call the same function.
  - `[low]` `[reject]` (blind) per-plan state never cleaned up — same reason as the edge row; a few entries per session.
  - `[false]` `[reject]` (blind) spec missing from the reviewed diff — intentional: the spec is the claims file given separately; it is committed with the change.
  - `[low]` `[patch]` (verification-gap) shell wiring from command state to plate and save region never exercised on a plan path — same patch as the blind wiring row.
  - `[low]` `[patch]` (verification-gap) hook retention not observable by its test — same patch as the blind hook-test row (done here instead of deferring: SSR re-renders on render-phase updates, no new harness needed).
  - `[low]` `[patch]` (verification-gap other) `send` rejects on non-JSON 200 — same patch as the edge body-read row.
  - `[false]` `[reject]` (intent) no production control consumes `disabledReason` — no plan-changing control exists yet; the story AC is phrased "when a slice sends a command" and Story 3.4 is the first caller.
  - `[false]` `[reject]` (intent) no view uses `useConsistentPlanData` — no current view renders two plan queries together; 3.4's marks list plus counts is the first set.
  - `[low]` `[reject]` (intent) stale-refetch trigger is "below confirmed version" rather than "disagreeing within a set" — they differ only when another writer is ahead, which M1 (single user) does not have; the hook still keeps the last agreeing set.
  - `[medium]` `[patch]` (intent) "Saved automatically" is a sticky flag — same patch as the edge `saved` row.
  - `[low]` `[reject]` (intent) "Saving the last change…" is not in the live region — EXPERIENCE.md puts that text on the controls; the live region carries the save status and failures.
  - `[low]` `[patch]` (intent) toolbar path not tested with a real send — same patch as the blind wiring row.
  - `[low]` `[patch]` (intent) GlobalNotice strip tested only with props — same patch as the blind wiring row.
  - `[false]` `[reject]` (intent) refused sends drop edits silently — `send` returns `"busy"` and controls are disabled while pending.
  - `[false]` `[reject]` (intent) "nothing shown before confirmation" verified only at cache level — every plan view renders only from the query cache, so an untouched cache means an unchanged screen.
  - `[false]` `[reject]` (intent) no DOM/browser test — the story AC asks for Vitest with a mocked API; 3.4 adds the Playwright journey.

## Design Notes

Retry loop shape (sleep injected so tests can assert `[1000, 2000, 4000, 8000]` without real time):

```ts
for (let attempt = 0; ; attempt++) {
  const outcome = await post(planId, body);          // "ok" | "transient" | ApiError
  if (outcome !== "transient") break;
  if (attempt === RETRY_DELAYS_MS.length) return fail(planId);  // drop + refetch + "failed"
  this.update(planId, { notice: "retrying" });
  await this.sleep(RETRY_DELAYS_MS[attempt]);
}
```

The live region must exist before its content changes, or screen readers skip the first announcement; that is why `SaveStatusView` always renders its wrapper and the nested `GlobalNotice` drops its own `role="status"` (no double announcement).

## Verification

**Commands:**
- `npm run lint` and `npm run typecheck` -- expected: no errors
- `npm run test:web` -- expected: all pass, including `tests/commands.test.tsx`
- `npm run test:py`, `npm run lint:py`, `npm run lint:imports` -- expected: unchanged, pass
- `npm run e2e -- --project=chromium` -- expected: existing tests stay green

## Auto Run Result

Status: done

**Summary:** The client now has one shared way to change a plan: `frontend/lib/commands`. `CommandClient.send(planId, body)` sends one command at a time per plan with a new `command_id` and the highest cached `base_version`. It retries network errors and 502/503/504 after 1, 2, 4 and 8 s with the same body. A 500, exhausted retries or an unreadable 2xx body drops the command, refetches and shows "The change was not saved. Try again.". `plan_not_found` uses the shared Story 1.9 handling, and any other non-2xx toasts its `message` and refetches. After a confirm it refetches the active `['plan', planId]` queries, plus at most 2 extra rounds for views older than the confirmed version; import queries are left alone. Controls are disabled with "Saving the last change…" until that finishes. React bindings: `CommandsProvider`, `usePlanCommands` (with `disabledReason`) and `useConsistentPlanData`. The shell has a persistent `aria-live="polite"` save-status region under the toolbar that wraps `GlobalNotice`, and the plan plate tooltip says "Saved automatically" after a confirmed change.

**Files changed:**
- `frontend/lib/commands/client.ts` (new) -- `CommandClient`, retry schedule, error routing, version-consistent refetch, messages, `baseVersion`, `isConsistent`.
- `frontend/lib/commands/react.tsx` (new), `frontend/lib/commands/index.ts` (new) -- provider, `usePlanCommands`, `useConsistentPlanData`, `latestConsistent`.
- `frontend/lib/api/plans.ts` -- `Command`/`CommandResult` types, `planRootKey`; key builders use it.
- `frontend/app/providers.tsx` -- `CommandsProvider` with the same toast/navigate effects as the GET error hook.
- `frontend/components/common/global-notice.tsx` -- `live` prop.
- `frontend/components/common/app-shell/save-status.tsx` (new), `index.tsx` -- save-status live region under the toolbar.
- `frontend/components/common/app-shell/plan-plate.tsx`, `toolbar.tsx` -- "Saved automatically" in the plate tooltip.
- `frontend/tests/commands.test.tsx` (new) -- 28 FR-10/AD-12 tests covering every matrix row, the ACs and the shell wiring on a plan path.

**Review:** 39 findings (high 0, medium 5, low 24, false 10). Patched 6 entries:
- 2 medium: `saved` is reset when a send starts, so the tooltip stays accurate and saves are re-announced; a render-phase test now covers the hook keeping the previous set.
- 4 low: an unreadable 2xx body takes the 500 path; only 500 shows the failed notice; the hook keeps the same array for the same items; a shell test runs on a plan path.

Deferred: 0. Rejected: 14 low and 10 false findings, each with its reason in the triage log (no `randomUUID` fallback, no POST timeout, no 408/429 retry, per-plan state not cleared, hook not keyed by plan, and others).

**Follow-up review recommended:** true (patched entries: high 0, medium 2, low 4). The named unverified risk is that the flow has only been exercised with mocked fetch in Vitest's node environment. No browser has re-rendered through `useSyncExternalStore` or the render-phase `setLast`, and no real confirmed command has updated the toolbar, until Story 3.4 adds the first caller and its Playwright journey.

**Verification:**
- `npm run lint`, `npm run typecheck`: pass.
- `npm run test:web`: 166 passed (12 files).
- `npm run lint:py`: pass. `npm run lint:imports`: 5 kept, 0 broken. `npm run test:py`: 338 passed.
- `npm run e2e -- --project=chromium`: 34 passed (no new e2e; nothing in the UI sends a command yet).

**Residual risks:**
- No production control uses `disabledReason` or `useConsistentPlanData` yet; Story 3.4 is the first consumer.
- A POST that hangs without erroring keeps the plan pending until the browser gives up (no client timeout).
- Per-plan save state lives for the browser session; a `failed` notice stays until the next send.

