---
title: 'Story 1.9: Plan overview, settings and the milestone 1 start'
type: 'feature'
created: '2026-11-21'
baseline_revision: '0e5e7d673ca9e098940f8bea737afbcdf46841d9'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** After New Plan the planner lands on an empty placeholder: no endpoint returns a stored plan, the toolbar shows no plan plate and the flow bar has no links, there is no Settings view, `/` still shows the walking-skeleton health text, and a deleted/unknown plan is not handled (FR-7, FR-8, FR-9, FR-18, AD-3, AD-12, AD-20, UX-DR5/6/9/21/22/55).

**Approach:** Backend: add the plan summary view (`GET /api/plans/{id}`) as a pure domain view and the saved-plans list (`GET /api/plans`), both read-only. Frontend: shared plan queries + one QueryCache error hook in `lib/api`, a plan-aware toolbar (plan plate + linked flow bar) driven by the URL, `modules/overview` and `modules/settings` behind thin routes, a placeholder for steps 2–8, and `/` redirecting to the most recently edited plan or `/plans/new`.

## Boundaries & Constraints

**Always:**
- `GET /api/plans/{id}` returns `PlanSummary` (a domain view in `swp/domain/views/summary.py`, used directly as the wire model, AD-13): `id`, `name`, `import_id`, `data_as_of` (`YYYY-MM-DD`), `uploaded_at` (UTC `Z`), `created_by/at`, `last_edited_by/at`, `version`, `current_round` (highest `round` in `state.runs`, else 0), `settings` (the stored `AnalysisSettings` snapshot), `period_start`, `period_end`, `class_counts` `{fast, medium, slow, dead}` (counted from `analysis.parts`; all 0 today), and `steps`: eight `{key, checked, count}` in flow order with keys `overview, parts, locations, pick-groups, best-locations, recommendations, before-after, move-list`. Check rules: steps 1–4 `checked: true`; best-locations checked iff `state.best_marks` is non-empty; recommendations, before-after, move-list `false` in M1. Counts: parts = `len(import.data.parts)`, locations = `len(import.data.locations)`, pick-groups = `len(analysis.pick_groups)`; all other steps `null`.
- Unknown plan id → 404 `plan_not_found` "This plan does not exist."; a non-UUID id → 422 `validation_failed` (existing handler).
- `GET /api/plans` returns a list of rows `{id, name, data_as_of, uploaded_at, created_by, created_at, last_edited_by, last_edited_at}` (schema in `swp/api/schemas/plans.py`), ordered by `last_edited_at` desc, then `created_at` desc, then `id`; it reads only columns (no plan/import JSON documents). Empty database → `[]`.
- GETs never write: `version` and `last_edited_*` unchanged after any number of GETs (FR-9).
- Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`; never edit it by hand.
- `frontend/lib/api/plans.ts`: `fetchPlanSummary`, `usePlanSummary(planId)` (key `["plan", planId, "summary"]`), `fetchPlans`, `usePlans()` (key `["plans"]`); errors via `parseErrorBody`; `fetch` network failure → `internalError()`.
- `frontend/lib/api/query-errors.ts`: `handleQueryError(error, {notify, navigate})` — for an `ApiError` with code `plan_not_found` calls `notify("This plan was deleted.")` and `navigate("/plans/new")`; anything else does nothing. Wired once in `app/providers.tsx` as `new QueryCache({ onError })` using `showToast` and `router.push`.
- `frontend/lib/view-state/urls.ts`: add `planSettingsHref(planId)` → `/plans/<id>/settings` and `parsePlanPath(pathname)` → `{planId, view}` for exactly three segments `/plans/<id>/<view>` (else `null`; `/plans/new` → `null`). All plan links use these helpers or `planStepHref`.
- Toolbar (client): on a plan path it shows the plan plate (once the summary has loaded) and the flow bar with `hrefFor = (s) => planStepHref(planId, s)`, `currentStep` = the view when it is a step key (none on `settings`), `doneSteps` = summary steps with `checked`. Off plan paths it stays as in Story 1.4 (plain-text steps, no plate).
- Plan plate (`components/common/app-shell/plan-plate.tsx`): a button (Radix `DropdownMenu` trigger) showing the name and "Data as of YYYY-MM-DD · round N"; a hover/focus tooltip (`role="tooltip"`, linked by `aria-describedby`) "Uploaded YYYY-MM-DD" (`formatDate(uploaded_at)`, viewer's zone); the menu holds exactly one item, "New Plan", which goes to `/plans/new`.
- Overview (`modules/overview`, route `app/plans/[planId]/overview/page.tsx`): h1 "Overview"; facts "Data as of" `data_as_of`, "Uploaded" local date of `uploaded_at`, "Period" "`period_start` to `period_end`"; section "Parts by movement class" with four rows (ClassGlyph + "Fast-moving", "Medium-moving", "Slow-moving", "Dead stock" + count with `formatNumber`); section "Settings" rendering the shared settings list and a link "Settings" to `planSettingsHref`. Loading: text "Opening <name>…" where name comes from the cached `["plans"]` list if it holds this id, else "Opening the plan…"; no spinner. Other error: `role="alert"` with the error message.
- Settings (`modules/settings`, route `app/plans/[planId]/settings/page.tsx`): h1 "Settings", the shared settings list, and the note "Changed in the config file, not in the app."; same loading/error text as the overview.
- Shared settings list `components/common/settings-list.tsx` (used by both modules), a `<dl>`: "Period" "12 months", "Fast-moving" "24 or more picks", "Medium-moving" "6–23 picks", "Slow-moving" "1–5 picks", "Dead stock" "0 picks", "Pick group" "5 or more shared jobs" — every number from the snapshot (`medium_min..fast_min-1`, `slow_min..medium_min-1`; "1 month" singular).
- `app/plans/[planId]/[step]/page.tsx`: for a valid step key other than overview, h1 = the step name and "This step is not built yet."; unknown key → `notFound()`.
- `/` (`app/page.tsx`, client): `usePlans()`; first row → `router.replace(planStepHref(id, "overview"))`, empty → `router.replace("/plans/new")`; while loading "Opening the latest plan…"; on error a `role="alert"` with the error message. The health text is removed.
- New Plan success also invalidates `["plans"]` so `/` sees the new plan.
- Tests name FR/NFR/UJ. Copy: sentence case, English, no exclamation marks.

**Never:**
- No new migration, no write in any GET, no `last_edited_*` change; no best/empty-best/kept counts, saved-plans list screen, launcher, "New Plan from this import" (later epics).
- No server component, route handler or server action calling the backend; no module importing another module; no new npm or Python dependency.
- Never read `data/private/`; never edit `data/sample/` or `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Summary | plan from answer-key/sample files | `data_as_of` 2026-09-30, `period_start` 2025-10-01, `current_round` 0, `version` 1, class counts all 0, steps 1–4 checked | — |
| Unknown plan | random UUID | 404 `plan_not_found` | frontend: toast "This plan was deleted.", URL `/plans/new` |
| Bad id | `/api/plans/abc` | 422 `validation_failed` | overview shows alert |
| List order | plans A (edited 10:00), B (edited 11:00) | `[B, A]` | — |
| Empty list | no plans | `[]`; `/` → `/plans/new` | — |
| Repeated GETs | GET summary + list ×3 | `version`, `last_edited_at` unchanged | — |
| Settings text | `fast 24, medium 6, slow 1, period 12, pick 5` | "24 or more picks", "6–23 picks", "1–5 picks", "0 picks", "12 months", "5 or more shared jobs" | — |
| Plan path parse | `/plans/x/overview`, `/plans/new`, `/plans/x/settings`, `/` | `{x, overview}`, `null`, `{x, settings}`, `null` | — |

</intent-contract>

## Code Map

- `backend/swp/domain/analysis.py` -- `AnalysisSettings`, `Analysis{settings, period_start, period_end, parts{movement_class}, pick_groups}`, `MovementClass`.
- `backend/swp/domain/state.py` -- `PlanState.best_marks`, `runs` (untyped dicts; `round` read defensively as int).
- `backend/swp/domain/import_.py:472` -- `ImportData.locations`, `.parts` (inventory parts → description).
- `backend/swp/store/plans.py` -- `StoredPlan`, `get_plan` (loads + upcasts); add `list_plans()` returning column-only rows.
- `backend/swp/store/models.py` -- `PlanRow`, `ImportRow` columns for the list join.
- `backend/swp/app/plans.py` -- `get()`; add `summary(plan_id)` (raises `DomainError("plan_not_found", …)`) and `list_saved()`.
- `backend/swp/api/routers/plans.py` -- add the two GETs with `error_responses(404, 422)`; `swp/api/schemas/session.py` is the pattern for `schemas/plans.py`.
- `backend/swp/api/errors.py` -- `plan_not_found` → 404 already mapped.
- `backend/tests/app/test_create_plan.py` -- `empty_tables` fixture, `_small_files()`, `SAME_ORIGIN`, TestClient pattern; reuse for new `tests/app/test_plan_summary.py`.
- `backend/.importlinter` -- layer contracts; `swp/domain/views` stays pure.
- `frontend/components/common/app-shell/{toolbar,flow-bar,index}.tsx` -- `FlowBar` already supports `currentStep`, `doneSteps`, `hrefFor`; toolbar is rendered by the root layout for every page.
- `frontend/components/common/button.tsx:96-125` -- hover/focus tooltip pattern (`role="tooltip"`, group-hover) to mirror on the plate.
- `frontend/components/common/class-glyph.tsx` -- `ClassGlyph`, `MovementClass`.
- `frontend/lib/api/{errors,session,schema}.ts`, `frontend/lib/format/index.ts` (`formatDate`, `formatNumber`), `frontend/lib/view-state/{steps,urls}.ts` (`FLOW_STEPS`, `planStepHref`).
- `frontend/app/providers.tsx` -- QueryClient creation; add QueryCache `onError`.
- `frontend/modules/new-plan/new-plan-page.tsx` -- success handler: add `queryClient.invalidateQueries({queryKey: ["plans"]})`.
- `frontend/e2e/{skeleton,app-shell,new-plan}.spec.ts` -- skeleton and app-shell specs open `/` and expect "Backend: ok"; they must move to `/plans/new` or `/api/health` because `/` now redirects.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/views/__init__.py`, `backend/swp/domain/views/summary.py` -- `ClassCounts`, `StepSummary`, `PlanSummary`, `build_summary(...)` pure function from plan fields, analysis, state, location/part counts.
- `backend/swp/store/plans.py` -- `PlanListItem` dataclass + `list_plans()` (join imports, ordered as specified, columns only).
- `backend/swp/app/plans.py` -- `summary(plan_id)` and `list_saved()`.
- `backend/swp/api/schemas/plans.py`, `backend/swp/api/routers/plans.py` -- `SavedPlanRow`; `GET /plans` and `GET /plans/{plan_id}`.
- `backend/tests/domain/test_plan_summary.py` -- `test_fr7_*`/`test_fr18_*` summary fields, check rules, counts, current round from runs.
- `backend/tests/app/test_plan_summary.py` -- `test_fr9_get_never_writes`, `test_fr8_list_most_recently_edited_first`, `test_fr8_list_empty`, `test_fr9_unknown_plan_not_found`, `test_fr9_bad_id_validation_failed`, `test_fr7_summary_from_sample_files`.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/lib/api/plans.ts`, `frontend/lib/api/query-errors.ts`, `frontend/lib/view-state/urls.ts`, `frontend/app/providers.tsx` -- shared queries, error hook, URL helpers.
- `frontend/components/common/settings-list.tsx`, `frontend/components/common/app-shell/plan-plate.tsx`, `frontend/components/common/app-shell/toolbar.tsx` -- shared settings list, plate, URL-driven toolbar.
- `frontend/modules/overview/overview-page.tsx`, `frontend/modules/settings/settings-page.tsx` + routes `app/plans/[planId]/{overview,settings,[step]}/page.tsx`, `app/page.tsx` -- views and redirect.
- `frontend/modules/new-plan/new-plan-page.tsx` -- invalidate `["plans"]` on success.
- `frontend/tests/plan-views.test.tsx` -- `fr18_settings_list_*`, `fr7_overview_*` (static markup of loaded overview incl. dates/period/counts), `ad20_parse_plan_path_*`, `ad12_plan_not_found_*`, `ux_dr5_plan_plate_*` (text, tooltip, single menu item).
- `frontend/e2e/plan-overview.spec.ts` -- `uj1 opens the overview after import` (plate text, tooltip, flow bar current/done, period, counts), `uj1 opens settings from the overview`, `uj1 start page opens the latest plan`, `uj1 unknown plan shows plan was deleted`, `uj1 shows opening text while loading` (delayed summary route after `/` warmed the list cache).
- `frontend/e2e/skeleton.spec.ts`, `frontend/e2e/app-shell.spec.ts` -- open `/plans/new` instead of `/`; drop the health-text assertions except the `/api/health` rewrite test.

**Acceptance Criteria:**
- Given a stored plan, when `GET /api/plans/{id}` is called repeatedly, then it returns the summary above and the DB row's `version` and `last_edited_*` are unchanged.
- Given the sample files imported through New Plan in Chromium, when the overview opens, then it shows "Data as of 2026-09-30", the upload date, "2025-10-01 to 2026-09-30", four class rows with 0, the settings list, and the toolbar plate "Data as of 2026-09-30 · round 0" with the flow bar Overview `aria-current="step"` and steps 1–4 carrying ", done".
- Given the overview, when "Settings" is clicked, then `/plans/<id>/settings` shows "Changed in the config file, not in the app." and no step is current.
- Given at least one plan, when `/` opens, then the browser ends on `/plans/<most recently edited id>/overview`.
- Given `/plans/<random uuid>/overview`, when it loads, then the toast "This plan was deleted." shows and the URL becomes `/plans/new`.
- Given the repo, when all verification commands run, then they pass.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 34 findings — high 0, medium 7, low 20, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` (edge-case) `/` redirects on stale cached `["plans"]` data — `app/page.tsx` now redirects once (ref) only on data fetched after mount (`isFetchedAfterMount && !isFetching && isSuccess`).
  - `[low]` `[reject]` (edge-case) 2xx non-JSON body surfaces a raw SyntaxError — the local FastAPI backend always returns JSON on 2xx; a guard adds a branch for an unreachable case.
  - `[low]` `[reject]` (edge-case) `/plans/new/<x>` parsed as planId "new" — not a URL any link produces; the route 404s and the toolbar only shows plain links; unlikely in use.
  - `[low]` `[reject]` (edge-case) toolbar links a flow bar for a malformed id after a 422 — only reachable by typing a bad URL; the page shows the alert; adding an error branch is extra complexity.
  - `[false]` `[reject]` (edge-case) negative `round` gives "round -1" — nothing writes `runs` yet and the epic that does writes rounds from 1; the case is unreachable.
  - `[low]` `[reject]` (edge-case) placeholder step page gives no error for a bad id — placeholder until Epic 2 replaces it; hand-typed URL only.
  - `[medium]` `[patch]` (verification-gap) placeholder route `[step]/page.tsx` never rendered by a test — e2e `uj1 opens a step that is not built yet` (Parts heading, text, aria-current; `/nope` → 404).
  - `[medium]` `[patch]` (verification-gap) New Plan `["plans"]` invalidation untested and `/` still lands on the old plan — grouped with the stale-redirect row; e2e `uj1 start page opens the plan just created`.
  - `[low]` `[patch]` (verification-gap) `/` error state untested — e2e `uj1 start page shows the error when plans cannot load` (aborted list → alert, URL stays `/`).
  - `[medium]` `[patch]` (verification-gap, other) redirect on stale cache — grouped with the stale-redirect row; fixed there.
  - `[low]` `[patch]` (verification-gap, other) `id` tiebreak of the list untested — `test_fr8_list_ties_broken_by_id` added.
  - `[low]` `[patch]` (blind) plan_not_found redirect uses `router.push`, Back loops — `providers.tsx` now uses `router.replace`.
  - `[low]` `[patch]` (blind) "This plan does not exist." alert flashes beside the "This plan was deleted." toast — `showsLoadError` keeps the opening text for `plan_not_found`; comment corrected; two unit tests.
  - `[medium]` `[patch]` (blind) stale-cache double redirect on `/` — grouped with the stale-redirect row; fixed there.
  - `[low]` `[reject]` (blind) no retry action on load errors — not in the story; a reload recovers; adds UI and state.
  - `[medium]` `[patch]` (blind) plate tooltip cannot be dismissed with Escape (WCAG 1.4.13) — `plan-plate.tsx` mirrors Button: Escape sets `dismissed`, reset on mouse leave / blur.
  - `[low]` `[reject]` (blind) summary GET loads the whole import — ~2,000 locations parse in milliseconds locally; AD-3 already builds every view from one full read per request.
  - `[low]` `[reject]` (blind) `/plans/new` literal in two places — not a plan URL under AD-20; no named divergence.
  - `[low]` `[reject]` (blind) step-key check duplicated in toolbar and `[step]` route — two one-line lookups over the same `FLOW_STEPS`; no drift possible.
  - `[low]` `[reject]` (blind) overview/settings wrappers and `<dl>` markup duplicated — small, no named harm; a gate component adds an abstraction.
  - `[low]` `[reject]` (blind) `as StepKey` cast and backend/frontend step lists could drift — the generated schema union is the contract and CI fails on schema diff.
  - `[low]` `[patch]` (blind) list `id` tiebreak untested — grouped with the verification-gap tiebreak row; fixed there.
  - `[medium]` `[patch]` (blind) placeholder step route untested — grouped with the verification-gap placeholder row; fixed there.
  - `[low]` `[reject]` (blind) test modules import private helpers from other test modules — pre-existing pattern in `tests/app`; no failing case.
  - `[low]` `[reject]` (blind) 200 non-JSON escapes error handling — same as the edge-case row; unreachable.
  - `[low]` `[reject]` (blind) list endpoint copies fields by hand and has no limit — M1 has a handful of plans; the explicit mapping keeps api off store types.
  - `[low]` `[reject]` (intent-alignment) cold direct load shows "Opening the plan…" not the name — no source of the name exists before the summary arrives; the cached-list path shows the name.
  - `[false]` `[reject]` (intent-alignment) "never writes" checked on three columns only — the GET handlers issue only SELECTs; the transaction commits nothing.
  - `[false]` `[reject]` (intent-alignment) "earlier plans stay stored" untested — the list tests create two plans and both are returned.
  - `[false]` `[reject]` (intent-alignment) hook covers queries only, not "any request" — AD-12 scopes the hook to GETs and no M1 mutation returns `plan_not_found`.
  - `[low]` `[reject]` (intent-alignment) settings ranges formatted on the client vs AD-3 — display text of the stored snapshot, not a rule applied to plan data; tested in `settingsRows`.
  - `[false]` `[reject]` (intent-alignment) steps 1–4 hard-coded — EXPERIENCE.md's check rule says steps 1–4 are checked once the plan exists.
  - `[false]` `[reject]` (intent-alignment) AD-3's `apply_all_count`/`undo_preview` missing — the story's AC lists the summary fields for this story; those fields belong to Epics 3/5.
  - `[false]` `[reject]` (intent-alignment) FlowBar now announces a checked current step as done — matches EXPERIENCE.md "Overview, step 1, done".

## Design Notes

- The toolbar lives in the root layout, so it learns the plan from the URL (`parsePlanPath(usePathname())`, AD-20) and reads only the summary query (AD-3); overview, settings and toolbar share one cache entry, so a `plan_not_found` fires the hook once.
- Steps 5–8 counts and later check rules stay `null`/`false` until their epics; the summary shape is final so the launcher (later) needs no change.
- Settings is not a flow step, so it gets its own helper (`planSettingsHref`) rather than widening `StepKey`.

## Verification

**Commands:**
- `npm run gen:api && git diff --stat -- frontend/lib/api/schema.ts` -- expected: only the intended schema change, then clean on re-run.
- `npm run lint:py && npm run lint:imports && npm run test:py` -- expected: pass (SQLite; Postgres in CI).
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass.
- `CI=true npm run e2e -- --project=chromium` -- expected: all specs pass.

## Auto Run Result

Status: done

**Summary:** `GET /api/plans/{id}` returns the plan summary (a pure domain view in `swp/domain/views/summary.py`: name, dates, version, current round, settings snapshot, period, class counts, eight steps with check state and counts). `GET /api/plans` returns the saved plans, most recently edited first; both are read-only. The toolbar reads the plan from the URL, shows the plan plate ("Data as of YYYY-MM-DD · round 0", an upload-date tooltip, a menu with only New Plan) and a linked flow bar. `/plans/{id}/overview` shows the data-as-of date, upload date, period, counts per movement class and settings. `/plans/{id}/settings` shows the read-only settings with "Changed in the config file, not in the app.". Steps 2–8 show a placeholder. `/` redirects to the latest plan or to `/plans/new`. A shared TanStack Query error hook turns `plan_not_found` into the toast "This plan was deleted." and opens New Plan.

**Files changed:**
- `backend/swp/domain/views/{__init__,summary}.py` -- the plan summary view and its builder.
- `backend/swp/store/plans.py` -- `PlanListItem`, `list_plans()` (columns only, ordered).
- `backend/swp/app/plans.py` -- `summary()` (raises `plan_not_found`), `list_saved()`.
- `backend/swp/api/schemas/plans.py`, `backend/swp/api/routers/plans.py` -- `SavedPlanRow`; the two GET routes.
- `backend/tests/domain/test_plan_summary.py`, `backend/tests/app/test_plan_summary.py`, `backend/tests/app/conftest.py`, `backend/tests/app/test_create_plan.py` -- summary/list tests; `empty_tables` moved to conftest.
- `frontend/lib/api/{plans,query-errors,schema}.ts`, `frontend/lib/view-state/urls.ts`, `frontend/app/providers.tsx` -- plan queries, the shared error hook, URL helpers, regenerated types.
- `frontend/components/common/{settings-list,plan-status}.tsx`, `frontend/components/common/app-shell/{plan-plate,toolbar,flow-bar}.tsx` -- shared settings list, loading/error text, plate, URL-driven toolbar, a checked current step announced as done.
- `frontend/modules/{overview,settings}/*.tsx`, `frontend/app/plans/[planId]/{overview,settings,[step]}/page.tsx`, `frontend/app/page.tsx` -- views, thin routes, placeholder, `/` redirect.
- `frontend/modules/new-plan/new-plan-page.tsx` -- invalidates `["plans"]` on success.
- `frontend/tests/{plan-views,components}.test.tsx`, `frontend/e2e/{plan-overview,skeleton,app-shell}.spec.ts` -- unit and UJ-1 Chromium journeys; earlier specs moved off `/`.

**Review:** 34 findings (high 0, medium 7, low 20, false 7, maybe-false 0). Patched (7 entries: 3 medium, 4 low): the `/` redirect now waits for data fetched after mount and fires once (+ e2e for the client-side return after New Plan); e2e for the placeholder step route and 404; Escape dismisses the plate tooltip; e2e for the `/` error state; list `id` tiebreak test; `router.replace` in the `plan_not_found` hook; no alert flash for `plan_not_found`. Deferred: none. Rejected, with reasons in the Review Triage Log: non-JSON 2xx guard, `/plans/new/<x>` parse, toolbar on a malformed id, negative rounds (false), placeholder bad-id feedback, retry action, summary read cost, `/plans/new` literal, step-key lookup duplication, wrapper duplication, step-key cast, test helper imports, list field mapping/limit, cold-load name, never-writes scope (false), earlier plans stored (false), hook scope (false), client-formatted settings text, hard-coded steps 1–4 (false), AD-3 later fields (false), FlowBar done on current (false).

**Follow-up review recommendation:** true -- three medium entries were patched (patched counts: high 0, medium 3, low 4). Unverified risk: the list ordering (including the new `id` tiebreak) and the summary/list tests have run only on SQLite here; the Postgres 17 run happens only in GitHub CI after push.

**Verification (after patches):** `npm run gen:api` -- schema regenerated, re-run gives no further change; `npm run lint:py` all checks passed; `npm run lint:imports` 4 kept, 0 broken; `npm run test:py` 200 passed (SQLite); `npm run lint` clean; `npm run typecheck` clean; `npm run test:web` 96 passed; `CI=true npm run e2e -- --project=chromium` 29 passed.

**Residual risks:** Postgres behaviour of the new GETs is verified only in CI; a cold direct load of a plan URL shows "Opening the plan…" because the name is not known before the summary arrives; steps 2–8 are placeholders until their epics.
