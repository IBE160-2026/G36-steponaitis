---
title: 'Story 6.1: Saved-plans list as the start page'
type: 'feature'
created: '2026-11-22'
baseline_revision: '1992e3d1d6132af0e7e513deea8a0100d7704ec7'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Milestone 1 `/` redirects to the most recently edited plan, so a planner cannot see or pick any other saved plan, and a deleted plan sends them to New Plan (FR-8, AD-20).

**Approach:** Add the saved-plans route `/plans` (`modules/plans`) that shows every plan from the existing `GET /api/plans` in the shared DataTable, make `/` open it, and point the shared `plan_not_found` hook at `/plans`. Also close epic-1 retro item 5: when `GET /api/plans` fails, the list offers a retry and a New Plan link.

## Boundaries & Constraints

**Always:**
- `GET /api/plans` keeps its current contract (API-own `SavedPlanRow` in `swp/api/schemas/plans.py`, columns-only query, order `last_edited_at` desc → `created_at` desc → `id`); it never loads import `data` or plan `state` and never writes.
- The list shows rows in server order (no user sorts). Columns: Name, Data as of, Uploaded (local date of `uploaded_at`), Created by, Created (local `YYYY-MM-DD HH:MM`), Last edited by, Last edited (local `YYYY-MM-DD HH:MM`), plus a last column holding the row's menu button. Dates via `lib/format` only.
- One primary button on the page: **New Plan** (link to `/plans/new`), in the page header and in the empty state (empty state shows the list's only New Plan).
- Table is one tab stop: `↑`/`↓` move rows, `Enter` or a click opens the plan; `Tab` from the active row reaches that row's menu button only — menu buttons in other rows have `tabIndex=-1`.
- Opening a plan goes through one helper in `frontend/lib/view-state/urls.ts` (e.g. `planOpenHref(planId)`) that returns the overview URL today; Story 6.2 makes it read the stored last view. All URLs are built in `lib/view-state`.
- `modules/plans` imports only `components/*` and `lib/*`. UI strings in English. Every new test names its FR/NFR/AD (SM-7); the Playwright test names UJ-3 (`uj3 …`) and imports `test`/`expect` from `frontend/e2e/support/test.ts`.
- Name epic-1 retro item 5 in the commit message; do not change any `action_items` status in `sprint-status.yaml` (retro item 38).

**Never:**
- No Delete…, no "New Plan from this import", no plan plate menu changes, no launcher, no localStorage last view (Stories 6.2–6.5).
- No change to `GET /api/plans/{id}` validation (epic-1 retro item 4 stays open: this story does not touch that route).
- No backend schema/migration change; no new dependency; no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List | ≥1 stored plan, open `/plans` | Heading "Saved plans", table rows in server order with the seven columns, New Plan primary | — |
| Start page | open `/` | URL becomes `/plans` and the list shows | — |
| Empty | no plans | "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions." + "Demo files: data/sample/" + New Plan; no table | — |
| Loading | list not yet fetched | Plain text status (no spinner), e.g. "Loading saved plans…" | — |
| Open | click a row, or `Enter` on the focused row | Navigates to `planOpenHref(id)` (`/plans/<id>/overview`) | Click/Enter on the menu button never opens the row |
| Row menu | `Tab` from active row, then `Enter`/click | Focus lands on that row's menu button "Actions for <name>"; menu shows one item **Open** that opens the plan; `Esc` closes and returns focus to the button | — |
| List fails | `GET /api/plans` network error or 5xx | Alert with the error message, a **Try again** button that refetches, and a New Plan link (retro item 5) | Stays on `/plans` |
| Plan deleted | any GET/command returns `plan_not_found` | Toast "This plan was deleted." once, navigate (replace) to `/plans` | — |
| Edit order | plan A older, a command changes A; B only opened/GET | List: A above B; B's `last_edited_*` unchanged | — |

</intent-contract>

## Code Map

- `backend/swp/api/routers/plans.py:48` `list_plans` -- existing endpoint; maps `PlanListItem` → `SavedPlanRow`. Read-only for this story.
- `backend/swp/store/plans.py:235` `list_plans` -- columns-only join query with the order; read-only.
- `backend/tests/app/test_plan_summary.py` -- existing FR-8/FR-9 list tests and helpers `_create(name, now)`, `_row(plan_id)`, `NOW`; add the new API test here.
- `backend/tests/app/test_commands.py`, `test_apply_command.py:57` -- examples of a `set_best_mark` command body (`command_id`, `base_version`, `SAME_ORIGIN` header from `tests/app/test_create_plan.py`).
- `frontend/app/page.tsx` -- milestone 1 redirect client component; replace with a redirect to `/plans`.
- `frontend/app/plans/new/page.tsx` -- pattern for a thin route file that renders a module page; add `frontend/app/plans/page.tsx` the same way.
- `frontend/lib/api/plans.ts:71,227-233` -- `PLANS_KEY`, `fetchPlans`, `usePlans()`, `SavedPlanRow` type (already generated in `lib/api/schema.ts`).
- `frontend/lib/api/query-errors.ts` -- shared hook `handleQueryError` (used for GETs in `app/providers.tsx` and for commands in `lib/commands/client.ts:210`); `NEW_PLAN_HREF`, `PLAN_DELETED`.
- `frontend/lib/view-state/urls.ts` -- the only URL builder (`planStepHref`, `parsePlanPath`); add `SAVED_PLANS_HREF`/`planOpenHref` here.
- `frontend/components/common/data-table.tsx` -- shared DataTable: roving tabindex rows, `onOpen`, `enterOpensRow` guard (retro item 15, already done), click ignores `a, button…`. Cells do not know whether their row is active: extend so a cell can render a menu button tabbable only in the active row, without changing existing tables.
- `frontend/components/common/app-shell/plan-plate.tsx` -- radix `DropdownMenu` usage and menu item styles to reuse for the row menu.
- `frontend/components/common/button.tsx` -- `Button` variants (primary, link…); `frontend/lib/format/index.ts` -- `formatDate`, `formatTime`; `frontend/lib/api/errors.ts` -- `INTERNAL_MESSAGE`.
- `frontend/modules/pick-groups/pick-groups-page.tsx` -- example module page using DataTable, empty sentence, load error.
- `frontend/components/common/plan-status.tsx` -- comment says `plan_not_found` moves on to New Plan; update the comment.
- `frontend/tests/plan-views.test.tsx:174-190`, `frontend/tests/commands.test.tsx:414-420` -- unit tests that assert the hook navigates to `/plans/new`; update to `/plans`.
- `frontend/e2e/plan-overview.spec.ts:110-230` -- e2e tests that rely on `/` redirecting to the latest plan / New Plan, the deleted-plan → `/plans/new` URL, and the `/` load-error alert; rewrite them for the list. `frontend/e2e/support/sample-plan.ts` `createSamplePlan`; `frontend/e2e/support/warm-routes.ts:29` route warm-up list.

## Tasks & Acceptance

**Execution:**
- `backend/tests/app/test_plan_summary.py` -- add `test_fr8_saved_plans_sorted_by_last_edit`: create A (older) and B (newer); GET B's summary and list several times → B first and both rows' `last_edited_*` unchanged; then POST a plan-changing command (`set_best_mark`) on A → A first with a later `last_edited_at`, B unchanged -- AC5 API part.
- `frontend/lib/view-state/urls.ts` -- add `SAVED_PLANS_HREF = "/plans"`, `NEW_PLAN_HREF` (move it here, re-export or update importers) and `planOpenHref(planId)` returning the overview URL -- single URL builder.
- `frontend/lib/api/query-errors.ts` -- `plan_not_found` navigates to `SAVED_PLANS_HREF`; update header comment -- AC4.
- `frontend/components/common/data-table.tsx` -- let cells know whether their row is active (e.g. a second `cell` argument or a row-actions slot) so only the active row's menu button is tabbable; keep memoization correct and existing tables unchanged -- UX-DR18 Tab into row menu.
- `frontend/modules/plans/saved-plans-page.tsx` (+ small helpers in the module if needed) -- the list page per the I/O matrix: heading, New Plan primary, DataTable columns, row menu (radix DropdownMenu, trigger `aria-label="Actions for <name>"`, item Open), empty state, loading text, error with Try again + New Plan -- AC2, AC3, retro item 5.
- `frontend/app/plans/page.tsx` -- thin route rendering the module page.
- `frontend/app/page.tsx` -- server redirect to `/plans` (read `frontend/AGENTS.md` and the bundled Next.js docs for `redirect`) -- AC4.
- `frontend/components/common/plan-status.tsx` -- comment update only.
- `frontend/tests/` -- update the two hook tests to `/plans`; add `frontend/tests/saved-plans.test.tsx` (Vitest + Testing Library) covering columns/formatting, empty state copy, error state with Try again calling refetch and the New Plan link, only the active row's menu button has `tabIndex=0`, and `planOpenHref` -- FR-7, FR-8, UX-DR18, UX-DR30.
- `frontend/e2e/saved-plans.spec.ts` -- new UJ-3 spec: two plans via `createSamplePlan`, a `set_best_mark` command on the older one through the API, `/` lands on `/plans`, the edited plan is above the other (compare their row positions; other specs add plans in parallel), `↓`/`Enter` and a click open the plan's overview, `Tab` from the active row focuses its menu button and its Open item opens the plan; empty state via `page.route` returning `[]`; failed list via `route.abort()` shows the alert, Try again refetches to rows, New Plan link opens `/plans/new`.
- `frontend/e2e/plan-overview.spec.ts` -- rewrite the `/`-redirect tests: deleted plan → toast + `/plans`; "Opening <name>…" reached by opening the plan from the list; the plan-plate New Plan flow ends by going to `/` and seeing the new plan in the list; drop tests superseded by `saved-plans.spec.ts`.
- `frontend/e2e/support/warm-routes.ts` -- add `/plans`.

**Acceptance Criteria:**
- Given stored plans, when `GET /api/plans` is called, then the rows carry the eight fields in `last_edited_at` desc order from `SavedPlanRow`, and the request writes nothing (existing tests plus the new one stay green).
- Given `/` or `/plans`, when it renders, then the saved-plans list shows as in the I/O matrix with New Plan as the only primary button.
- Given any request answers `plan_not_found`, when the shared hook runs, then the toast "This plan was deleted." shows and `/plans` opens.
- Given a plan is opened or looked at, when the list is fetched again, then its `last_edited_*` are unchanged and only a command moves it to the top; `test_fr8_saved_plans_sorted_by_last_edit` and the `uj3` Playwright test cover the order and the open action.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 29 findings — high 0, medium 3, low 18, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` (intent) No test proves `GET /api/plans` never loads import `data`/plan `state` — the store query is unchanged and selects explicit columns only; a guard test adds surface for a pre-existing property.
  - `[false]` `[reject]` (intent) `/` redirects to `/plans` instead of rendering the list itself — the AC says `/` "opens the saved-plans list"; the e2e asserts `/` lands on the list.
  - `[false]` `[reject]` (intent) Open goes to the overview, not the stored last view — the last-view storage is Story 6.2's AC (epics.md 6.2, `swp:plan:<id>:view`); `planOpenHref` is the single seam.
  - `[medium]` `[patch]` (intent) New DataTable guards are not exercised by any test — grouped with the verification-gap finding below; e2e steps added for keys inside the row menu.
  - `[false]` `[reject]` (intent) e2e checks relative order, not "first" — parallel specs share the e2e database; the API test asserts the exact order on an isolated database.
  - `[false]` `[reject]` (intent) Retro item 4 (non-UUID id → `plan_not_found`) not addressed — that backend route is not changed by this story; the item stays open.
  - `[low]` `[reject]` (intent) Empty state only tested against a mocked empty list — the e2e database is shared and never empty; the mock returns the real schema shape.
  - `[false]` `[reject]` (intent) e2e tests removed — their behaviour moved to `saved-plans.spec.ts` (start page, empty, failed list) and the rewritten plate test.
  - `[medium]` `[patch]` (verification-gap) DataTable's defaultPrevented/portaled-content guards for the row menu are untested — added e2e steps: ArrowDown on the menu button opens the menu without moving rows, arrows inside the menu keep it open on `/plans`, Open chosen by keyboard.
  - `[low]` `[patch]` (verification-gap) `PLAN_MENU` hard-codes `/plans/new` although URLs are built only in `urls.ts` — switched to `NEW_PLAN_HREF`.
  - `[false]` `[reject]` (verification-gap) New Plan success still uses `planStepHref(..., "overview")` — a new plan opens its overview by design (UX: success opens the overview); `planOpenHref` is for reopening a saved plan.
  - `[low]` `[reject]` (blind) Cached list hides a failed background refetch — the list stays usable and the next mount refetches; the fix adds a combined error-plus-table branch for a rare case.
  - `[low]` `[reject]` (blind) Cached order shows briefly before the mount refetch reorders — staleTime is 0, so the refetch starts on mount; the flicker is cosmetic and a fix touches the shared command client.
  - `[low]` `[patch]` (blind) Brand link points to `/` and takes a redirect hop — now links to `SAVED_PLANS_HREF` ("no way back from a plan" half is false: the brand link is that way; the plate menu items are Story 6.3).
  - `[low]` `[patch]` (blind) `PLAN_MENU` hard-codes `/plans/new` — same root cause as the verification-gap row; same fix.
  - `[medium]` `[patch]` (blind) RowMenu copies the plan plate's menu class strings, against the AGENTS.md DRY rule; 6.3/6.4 add items to both menus — class strings moved to one shared place in `components/common` and used by both.
  - `[low]` `[patch]` (blind) `formatDateTime` lives in the feature module instead of `lib/format` — moved to `lib/format` with its unit test.
  - `[low]` `[reject]` (blind) ArrowUp/Home/End on the row's menu button move the active row — same keys move rows from any control in existing tables (pick-groups part buttons); changing it alters shared behaviour for a rare path.
  - `[low]` `[reject]` (blind) e2e `setBestMark` hard-codes aisle "A" — the same pattern is used in `recommendations-page.spec.ts` and `recommendations-outdated.spec.ts`; the sample data is generated deterministically.
  - `[low]` `[patch]` (blind) Choosing Open from the menu by keyboard is not covered — folded into the e2e patch above (Open chosen with Enter).
  - `[low]` `[patch]` (blind) Backend test never checks A's `last_edited_by` or A's list row — asserts added.
  - `[low]` `[reject]` (blind) `/plans` has no page title — no route sets its own metadata; the layout title applies to every page.
  - `[low]` `[reject]` (edge) Cached data hides a refetch error — duplicate of the blind finding; same reason.
  - `[low]` `[reject]` (edge) A deleted plan's cached row stays clickable until the refetch lands — the click ends in the shared toast and `/plans`, which the AC specifies; window is one request long.
  - `[low]` `[reject]` (edge) Offline (paused query) shows the loading text forever — same for every view in the app; not introduced here.
  - `[low]` `[reject]` (edge) Try again gives no feedback while refetching — the request is short; a busy state adds branches for a cosmetic gap.
  - `[false]` `[reject]` (edge) A malformed date crashes the page — `SavedPlanRow` dates are validated by the API schema (`date`, `AwareDatetime`), so the client never receives one.
  - `[low]` `[reject]` (edge) ArrowUp/Home/End on the menu trigger move focus to another row — duplicate of the blind finding; same reason.
  - `[false]` `[reject]` (edge) `SavedPlansPage` retry wiring is untested — `e2e/saved-plans.spec.ts` "uj3 failed list offers try again and new plan" clicks Try again and sees the rows load.

## Auto Run Result

Status: done

**Summary.** The saved-plans list is the start page. `/` server-redirects to the new `/plans` route (`modules/plans`), which shows every plan from the unchanged `GET /api/plans` in the shared DataTable, in server order, with New Plan as the one primary button. It has an empty state, a plain-text loading state and a failed-list state with Try again and New Plan (epic-1 retro item 5). Each row has a menu button reachable by Tab only from the active row, with one item, Open. The shared `plan_not_found` hook now opens `/plans`. Opening a plan goes through `planOpenHref` (overview until Story 6.2).

**Files changed**
- `backend/tests/app/test_plan_summary.py` -- new `test_fr8_saved_plans_sorted_by_last_edit`.
- `frontend/app/page.tsx` -- `/` redirects to `/plans`.
- `frontend/app/plans/page.tsx` -- new route for the list.
- `frontend/modules/plans/saved-plans-page.tsx` -- the saved-plans page, row menu, empty/loading/error states.
- `frontend/components/common/data-table.tsx` -- `cell(row, { isActive })`; rows ignore keys already handled by an inner control and events from portaled content.
- `frontend/components/common/button.tsx` -- `buttonClassName()` shared by `Button` and button-styled links.
- `frontend/components/common/menu-styles.ts` -- shared dropdown menu classes (plan plate and row menu).
- `frontend/components/common/app-shell/plan-plate.tsx`, `toolbar.tsx` -- use `NEW_PLAN_HREF` / `SAVED_PLANS_HREF` and the shared menu classes.
- `frontend/lib/view-state/urls.ts` -- `SAVED_PLANS_HREF`, `NEW_PLAN_HREF`, `planOpenHref`.
- `frontend/lib/api/query-errors.ts` -- `plan_not_found` opens `/plans`.
- `frontend/lib/format/index.ts` -- `formatDateTime`.
- `frontend/app/providers.tsx`, `frontend/components/common/plan-status.tsx` -- comments.
- `frontend/tests/saved-plans.test.tsx` (new), `format.test.ts`, `plan-views.test.tsx`, `commands.test.tsx` -- unit tests.
- `frontend/e2e/saved-plans.spec.ts` (new, UJ-3), `plan-overview.spec.ts` (start-page tests rewritten), `support/warm-routes.ts` (`/plans`).

**Review findings.** 29 findings: 3 medium, 18 low, 8 false.
- **Patched:** 2 medium entries, which are the untested DataTable guards for the row menu with its keyboard-Open gap, and the duplicated menu styles. 4 low entries: the hard-coded `/plans/new`, the brand link going to `/`, `formatDateTime` living in the module, and the missing backend test asserts.
- **Deferred:** none.
- **Rejected:** 8 false and 12 low. Each reason is recorded in the Review Triage Log above.

**Follow-up review recommended: true.** Two medium entries were patched on this first pass. The open risk is that the row menu works with keyboard and mouse only because DataTable ignores keys a control already handled and events from portaled content. That depends on Radix calling `preventDefault` on its keyboard events. It is verified in Chromium only (e2e), not in Firefox or Edge.

**Verification**
- `npm run lint:py`, `npm run lint:imports`, `npm run lint`, `npm run typecheck` and `ruff format --check` all pass.
- `npm test`: pytest 545 passed, 10 skipped. Vitest 259 passed.
- `pytest tests/app --database-url postgresql://…/swp_test` against a local `postgres:17` container: 122 passed, 1 skipped.
- `npm run e2e -- --project=chromium`: 53 passed.

**Residual risks**
- Firefox and Edge e2e were not run.
- Retro item 4 stays open: a non-UUID plan id still shows an in-page error.
- A failed background refetch over a cached list shows the cached list without an alert (rejected low).

## Design Notes

- **Row menu in 6.1.** UX-DR18 needs `Tab` into the row's menu, but its real items (Delete…, New Plan from this import) belong to 6.3/6.4. The menu ships now with one item, **Open**, so the keyboard model is complete and 6.3/6.4 only add items.
- **"Last view".** The stored last view is Story 6.2. `planOpenHref` is the seam: today it returns `/plans/<id>/overview`; 6.2 changes only that helper.
- **`/` redirect.** A server-side redirect keeps `/` out of the client bundle and lets the browser Back button skip it.

## Verification

**Commands:**
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` -- expected: all pass.
- `npm test` -- expected: pytest and Vitest pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5432/swp_test` (local `postgres:17` container) -- expected: pass.
- `npm run e2e -- --project=chromium` -- expected: all specs pass, including `saved-plans.spec.ts`.
