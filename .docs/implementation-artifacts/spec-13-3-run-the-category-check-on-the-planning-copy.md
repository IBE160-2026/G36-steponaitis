---
title: 'Story 13.3: Run the category check on the planning copy'
type: 'feature'
created: '2026-11-24'
baseline_revision: '998977db5f2a510b982065cdbffc9558f9498aca'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-13-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Keyword rules (13.1) and aisle categories (13.2) exist, but nothing compares them with where parts are: the planner cannot see parts put away in aisles meant for other kinds of parts (FR-46), and the UJ-1 journey still declares the category check step as a skipped test.

**Approach:** Add a pure `domain.categories.check` and a read-only `GET /api/plans/{plan_id}/category-check` (one `replay` per request) returning every part whose category is not among the categories of its current location's aisle, with counts and the plan `version`. Add the Category check page at `/plans/{id}/categories/check` (in `modules/categories`), reached from a link on the Categories page, with a DataTable, count line, empty message and the PartPanel, refetched after every command like other plan views. Turn the skipped UJ-1 e2e step into a real journey.

## Boundaries & Constraints

**Always:**
- Layers and slices (AD-1): check logic in the existing slice `swp/domain/categories.py`, which may import only the kernel (`planning`, `ordering`, `import_data`, `analysis`, `state`); no new slice. App service in `swp/app/categories.py`; route in `swp/api/routers/categories.py` (already in the `guarded` list). `swp.api` never imports `swp.store`. Frontend `modules/categories` imports no other module; strings in `lib/copy`.
- Checked parts: `planning.listed_parts(data, analysis)` (the parts the panel can open). Category from `part_categories`/`category_of` on the description with the stored rules in rule order. Current location = `planning.current_location` of the replayed copy; aisle = that location's Aisle. A part is **not checked** when it has no category, no current location, or its aisle has no categories. It is **listed** when `category_key(category)` is not in `{category_key(c)}` of the aisle's categories. Aisle categories are looked up by exact Aisle text (FR-45).
- Response `CategoryCheck {version, rows: [CategoryCheckRow], outside_count, aisles_without_categories}`; row `{part, description, category, current_location: LocationRef (via planning.location_ref, best marks of the state), aisle_categories: [str]}` — the aisle is `current_location.aisle`; `aisle_categories` sorted by `category_key`, then text. `outside_count = len(rows)`; `aisles_without_categories` = number of distinct Aisle values of the import's locations with no stored category.
- Row order (AD-14) comes from a new `ordering.py` function: by the current location's position in `location_order(locations)`, then part number (`str`). Frontend shows server order, no sorts.
- One `replay` per request (`planning.planning_copy` or `replay`), no cache, never writes the plan or the category tables. Unknown/malformed plan id → `plan_not_found` 404 (`parse_plan_id` + `require`), `error_responses(401, 404, 422)`. Recommendations stay category-blind (no change to `domain/rules` or `recommendations`).
- UI page title "Category check"; note "Parts whose category is not one of the categories of the aisle they are in now. Parts without a category, parts with no stock and aisles without categories are not checked."; a "Categories" link back (keyword rules) and on the Categories page a "Category check" link to the new page. Count line from `lib/copy`: "12 parts outside their aisle's categories · 4 aisles without categories" (singular "1 part outside its aisle's categories", "1 aisle without categories"; `formatNumber`). Rows → `DataTable` label "Category check", columns Part (button opening the PartPanel, `data-open-part`), Description, Category, Current location (code; `LocationChip`), Aisle, Aisle categories (joined ", "); `onOpen` (Enter) opens the panel too. No rows → "Every checked part is in an aisle meant for its category." instead of the table (count line still shown).
- Query key under `planRootKey(planId)` (e.g. `[...planRootKey(id), "category-check"]`) so the command client refetches it after every move, undo and reset; page uses `usePanelPlanData` + `WithPartPanel` like `pick-groups-page.tsx`. `usePartPanel` is generalised to accept a non-step href builder (keep existing step callers unchanged). `parsePlanPath` also accepts exactly `/plans/<id>/categories/check` (view `"categories/check"`) so the toolbar, plate (data-as-of), save status and launcher appear; other 4-segment paths stay null.
- Tests carry IDs: backend `test_fr46_*`; Vitest `it("fr46_…")`; e2e titles start `uj1 `. Regenerate `frontend/lib/api/schema.ts` with `npm run gen:api`.
- E2E: rules and aisle categories are global and browsers run in parallel. The UJ-1 test uses one aisle per project (`chromium: "C", firefox: "D", msedge: "E"`, fallback `"B"`; 13.2's spec uses F–I), a keyword equal to the whole description of one randomly chosen lone part in that aisle (sample descriptions are unique and no description is a word run inside another), unique categories with a run id, asserts only its own row, and in a `finally` deletes its rules and clears its aisle via the API (`Sec-Fetch-Site: same-origin`).

**Never:** no starter seed/TOML or README step (13.4), no change to `keyword_rules`/`aisle_categories` schemas or the 13.1/13.2 endpoint contracts, no categories in plan `state`, recommendations or rules, no client-side computing of the check, no new launcher plate or LBL change, no planning-artifact edits, no edits under `data/sample/`, `data/answer-key/`, `.logs/`, no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Listed | rule oil→Oils; part "Engine oil" at A-01; aisle A = [Filters] | one row: part, Oils, A-01, `["Filters"]` | — |
| In its aisle | aisle A = [" oils"] (any case) | no row | — |
| No category | description matches no rule | not checked | — |
| No stock | part has no stock above zero | not checked | — |
| Aisle without categories | part's aisle has none | not checked; counted in `aisles_without_categories` | — |
| After a move | manual move of a listed part into an aisle without categories; then undo | row gone at the new version; back after undo | — |
| Recommendation applied | apply moves an Oils part into aisle B = [Filters] | row appears for that part at B | — |
| Twice | same state, rules, aisle categories | identical JSON | — |
| Order | rows in aisles B and A | A rows first, by `location_order`, then part | — |
| Unknown plan | GET with unknown or non-UUID id | — | 404 `plan_not_found` |
| Auth on, no session | GET | — | 401 |

</intent-contract>

## Code Map

- `backend/swp/domain/categories.py` -- 13.1/13.2 slice: `category_of`, `part_categories`, `category_key`, `aisle_category_list`; add `CategoryCheckRow`, `CategoryCheck`, `check(...)`.
- `backend/swp/domain/planning.py:310,327,466,492,561` -- `replay`, `planning_copy`, `current_location`, `listed_parts`, `location_ref`, `LocationRef` (line 550).
- `backend/swp/domain/ordering.py:72` -- `location_order`; add the check row order here.
- `backend/swp/app/categories.py` -- `_domain_rules()`, `aisle_store.list_all()` (Mapping aisle → categories), `plan_aisle_categories` pattern (`require(plan_id)`); add `category_check(plan_id)` using `plan.imported.data`, `plan.analysis`, `plan.state`, `plan.version`.
- `backend/swp/api/routers/categories.py` -- add `GET /plans/{plan_id}/category-check` like `get_plan_aisle_categories`.
- `backend/tests/domain/test_categories.py`, `backend/tests/app/test_fr45_aisle_categories_api.py` (fixtures `client`, `_plan`, `LOC_CSV`, `tests.app.test_import_readers.INV_CSV/TX_CSV`), `backend/tests/app/conftest.py` (`empty_tables`) -- patterns; commands via `swp.app.commands` or `POST /api/plans/{id}/commands` for the move/undo and recommendation cases (see existing `tests/app` command tests).
- `frontend/lib/api/plans.ts:113` -- `planRootKey`, `getJson`; `frontend/lib/commands/client.ts:229` refetches every active `planRootKey` query after a command.
- `frontend/modules/categories/{api.ts,categories-page.tsx}` -- add the check query/type to `api.ts`; add the "Category check" link in `CategoriesView`; new `category-check-page.tsx`.
- `frontend/modules/pick-groups/pick-groups-page.tsx` -- page pattern: `usePartPanel`, `usePanelPlanData`, `WithPartPanel`, `PlanLoadError`/`PlanOpening`, `DataTable`, part button cell.
- `frontend/components/common/part-panel.tsx:74` -- `usePartPanel(planId, step)` uses `planStepHref`; generalise.
- `frontend/lib/view-state/urls.ts:206-245` -- `planCategoriesHref`, `parsePlanPath`; add `planCategoryCheckHref(planId, params?)`.
- `frontend/app/plans/[planId]/categories/page.tsx` -- route pattern for new `app/plans/[planId]/categories/check/page.tsx` (await `searchParams`).
- `frontend/lib/copy/index.ts:1077-1130` -- Categories copy; add check copy.
- `frontend/components/common/location-chip.tsx`, `frontend/lib/format` (`formatNumber`).
- `frontend/tests/categories.test.tsx`, `frontend/tests/plan-views.test.tsx:170-183` -- Vitest patterns; parsePlanPath tests.
- `frontend/e2e/user-journeys.spec.ts:148-165,1218-1220` -- `lonePart`, `partDetail`, `locationRows`, `moveFromPanel` (support/plan-api.ts), the skipped `uj1 fr46` declaration; `frontend/e2e/categories.spec.ts` -- UI helpers for adding rules and aisle categories (aisles F–I in use).

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add `category_check_order` (location order, then part) -- AD-14.
- `backend/swp/domain/categories.py` -- `check(data, analysis, state, version, rules, aisle_categories) -> CategoryCheck` with one replay -- FR-46.
- `backend/swp/app/categories.py`, `backend/swp/api/routers/categories.py` -- service and route -- FR-46, AD-3, AD-11.
- `backend/tests/domain/test_categories.py` -- `test_fr46_*` for every matrix row that is pure (listed, case-insensitive match, no category, no stock, aisle without categories, count, order, determinism).
- `backend/tests/app/test_fr46_category_check_api.py` -- endpoint shape and version, move then undo, applied recommendation into another category's aisle, 404 unknown/malformed id, 401 with auth on, reads only (plan version unchanged).
- `frontend/lib/api/schema.ts` -- `npm run gen:api`.
- `frontend/lib/view-state/urls.ts`, `frontend/components/common/part-panel.tsx` -- `planCategoryCheckHref`, `parsePlanPath` for the check path, `usePartPanel` with an href builder.
- `frontend/lib/copy/index.ts`, `frontend/modules/categories/{api.ts,categories-page.tsx,category-check-page.tsx}`, `frontend/app/plans/[planId]/categories/check/page.tsx` -- the page and link -- FR-46, UX-DR18, UX-DR24, UX-DR56.
- `frontend/tests/categories.test.tsx` (or new `category-check.test.tsx`), `frontend/tests/plan-views.test.tsx` -- Vitest: count line plural/singular with thousands separators, rows in server order with columns, empty message, part button opens with its part, `parsePlanPath` accepts `/categories/check` and still rejects other 4-segment paths, `planCategoryCheckHref`.
- `frontend/e2e/user-journeys.spec.ts` -- replace the skipped `uj1 fr46 …` with a real test `uj1 fr46 the category check lists a part outside its aisle's categories`: create a sample plan, pick a lone part in the project's aisle, open Categories (CAT), add rule (whole description → `Checked <run>`) and rule (`kwz<run>` → `Aisle <run>`), give the aisle `Aisle <run>` on the Aisle categories tab, follow "Category check", see the count line and the part's row (category, location, aisle categories), open the part panel from the row, Manual move… to an empty location in aisle A → row gone, Undo last move → row back; cleanup in `finally`.

**Acceptance Criteria:**
- Given a plan with rules and aisle categories, when `GET /api/plans/{id}/category-check` is called, then it returns the rows, counts and `version` per the matrix, from one replay, without writing anything (FR-46, AD-3).
- Given the same plan state, rules and aisle categories, when the check runs twice, then the results are equal; and given a recommendation applied into an aisle of another category, then that part is listed (FR-46).
- Given the Categories page, when the planner follows "Category check", then `/plans/{id}/categories/check` shows the toolbar with the plan plate, the count line, the table (or the empty message), and a part button or Enter on a row opens the PartPanel (UX-DR18, UX-DR24, UX-DR56).
- Given the check page open, when a move, undo or reset is made (panel or elsewhere), then the table follows the new plan version without a reload.
- Given `npm run e2e` with the three browsers, when the UJ-1 category check test runs, then it passes in chromium, firefox and msedge and the declared skip for it is gone.

## Spec Change Log

## Review Triage Log

### 2026-11-24 — Review pass
- verdicts: 28 findings — high 0, medium 0, low 21, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) category writes invalidate only `CATEGORIES_KEY`, so a cached check shows pre-edit rows when reopened — `useCategoriesWrite` now also invalidates every category-check query.
  - `[low]` `[patch]` (blind) `CategoryCheckPage` takes a `params` prop it never uses — prop dropped; the route still awaits `searchParams` to stay dynamic.
  - `[low]` `[reject]` (blind) the `check` loop rebuilds a key set per part and keeps two dicts — a few thousand parts per request; no measurable cost, and the fix is a rewrite.
  - `[low]` `[reject]` (blind) `check` passes stored category text through without strip/dedupe — `set_aisle_categories` strips and rejects key duplicates before storing, so stored values are already normalised.
  - `[low]` `[reject]` (blind) no test of a part held in several locations — the check uses the kernel's `current_location` (most stock, then code), which has its own tests; the spec checks only the current location.
  - `[low]` `[reject]` (blind) no launcher entry opens the check directly — the spec makes it a Categories sub-page with a link; a launcher entry adds public surface the ACs do not ask for.
  - `[low]` `[patch]` (blind) the e2e part choice is random and not reproducible — the chosen part and description are recorded as a test annotation.
  - `[low]` `[reject]` (blind) the e2e rule may lose first-match to an earlier global rule (13.4 starter rules, parallel specs) — today no stored rule can match a whole sample description (13.2 keywords are random; descriptions are not word runs of each other); 13.4 changes the seed and must adapt this test. The aborted-run part is patched with the edge row below.
  - `[low]` `[patch]` (blind) e2e assumes aisle A has no categories, and `.find(...)!` hides the `toBeDefined` check — no spec writes aisle A today (13.2 uses F–I, this test C–E), so the assumption holds until 13.4; the `!` is removed and the expect narrows the value.
  - `[low]` `[patch]` (blind) `removeCategories` ignores the DELETE/PUT statuses — each response is now expected ok. Restoring the previous aisle list is rejected: the aisle is owned by the test project.
  - `[low]` `[patch]` (blind) the href-builder close path of `usePartPanel` is untested on the check page — the e2e now closes the panel with Escape and asserts the URL without `?part=`.
  - `[low]` `[reject]` (blind) duplicated copy ("Aisle categories") and link class string — two short strings; merging couples the tab label to the column head for no user-visible gain.
  - `[low]` `[reject]` (blind) the back link is not in a nav/breadcrumb landmark — same plain-link pattern as the Categories page's own link; a breadcrumb pattern is a UX decision outside this story.
  - `[false]` `[reject]` (blind) `epic-13-context.md` carries unrelated seeding changes — it is the workflow's recompiled epic context (the spine was newer), not a story code change.
  - `[low]` `[patch]` (edge) check query not invalidated on category writes — same root cause as the first blind row; fixed there.
  - `[low]` `[reject]` (edge) add a categories revision to `CategoryCheck` so version-consistency sees category edits — adds public surface; the invalidation patch covers the in-app path.
  - `[low]` `[patch]` (edge) a rule left by an aborted run on a reused server breaks `addRule` — `removeCategories` now runs before the test as a pre-cleanup too.
  - `[low]` `[reject]` (edge) an unknown project falls back to shared aisle B — only the three configured projects run; same fallback pattern as 13.2's spec.
  - `[false]` `[reject]` (edge) another project's description keyword can be a word run in this part's description — sample descriptions are "<type> - <vehicle> <engine>"; a containment needs one part type to be a word suffix of another, and none is (checked over `PART_TYPES`).
  - `[low]` `[patch]` (edge) unused `params` prop — same as the blind row; fixed there.
  - `[low]` `[patch]` (verification-gap) Enter on a focused check row (DataTable `onOpen`) has no test — the e2e now focuses the part's row, presses Enter and asserts `?part=` and the focused panel heading.
  - `[low]` `[reject]` (intent) reset is covered only by the query key under `planRootKey` — reset refetches through the same command-client invalidation that the move and undo e2e steps exercise.
  - `[false]` `[reject]` (intent) "one replay" is not asserted — `check` calls `planning_copy` once; the claim is about code shape, which the diff shows directly.
  - `[low]` `[reject]` (intent) "recommendations never use categories" has no test — `domain/rules` and `recommendations` are untouched and do not import `categories` (import-linter's slice independence contract forbids it).
  - `[false]` `[reject]` (intent) no top-level `aisle` field — the aisle is returned as `current_location.aisle` (LocationRef) and shown as its own column, as the spec defines.
  - `[false]` `[reject]` (intent) the UJ test is standalone, not a step inside UJ-1's flow — the declared skip it replaces was itself a standalone test.
  - `[false]` `[reject]` (intent) no retro item addressed — the intent asks only when an item concerns this code; none of the open items does.
  - `[false]` `[reject]` (intent) epic context scope — same as the blind context row.

## Design Notes

AD-14 names no order for the check, so the domain picks the walk order of the warehouse: rows by their current location's `location_order` position (aisle, level, Walk Path, code), then part number — a planner walks aisle by aisle to fix them. `aisles_without_categories` counts the import's aisles (not only aisles holding categorised parts), because those are the aisles the planner can still give categories on the Aisle categories tab; this matches "4 aisles without categories" as a to-do count.

The check page is a sub-route of Categories, not a flow step, so `usePartPanel` gets the page's href builder:

```ts
const panel = usePartPanel(planId, (params) => planCategoryCheckHref(planId, params));
```

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://...` against a local `postgres:17` container -- expected: all pass.
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` (after commit) -- expected: no diff; `npm run typecheck`, `npm run lint`, `npm run test:web` -- expected: pass.
- `npm run trace` -- expected: OK, FR-46 listed with tests.
- `npm run e2e -- --project=chromium` -- expected: 0 failed; `npm run e2e -- e2e/user-journeys.spec.ts e2e/categories.spec.ts --project=firefox --project=msedge` -- expected: 0 failed.

## Auto Run Result

Status: done

**Summary.** The category check is built (FR-46). `GET /api/plans/{id}/category-check` runs one replay and `domain.categories.check`. It lists every listed part whose keyword-rule category is not among the categories of its current location's aisle. Parts without a category, parts with no stock and aisles without categories are skipped. Each row has the part, description, category, current location (`LocationRef`, aisle included) and the aisle's categories, in location order and then part number (new `ordering.category_check_order`). The response also carries `outside_count`, `aisles_without_categories` and the plan `version`. The new page `/plans/{id}/categories/check` is linked from the Categories page. It shows the count line, a DataTable (or "Every checked part is in an aisle meant for its category.") and the PartPanel. Its query sits under `planRootKey`, so moves, undo and reset refetch it, and category writes invalidate it too. `parsePlanPath` accepts the check path, so the toolbar, plan plate and launcher appear there. `usePartPanel` takes an href builder for non-step pages. The UJ-1 e2e skip `uj1 fr46` is now a real test.

**Files changed.**
- `backend/swp/domain/categories.py`, `backend/swp/domain/ordering.py` -- `check`, `CategoryCheck`/`CategoryCheckRow`, `category_check_order`.
- `backend/swp/app/categories.py`, `backend/swp/api/routers/categories.py` -- service and route.
- `backend/tests/domain/test_categories.py`, `backend/tests/app/test_fr46_category_check_api.py` (new) -- `test_fr46_*`.
- `frontend/lib/api/schema.ts` -- regenerated.
- `frontend/lib/view-state/urls.ts`, `frontend/components/common/part-panel.tsx` -- check href, `parsePlanPath`, href-builder panel.
- `frontend/lib/copy/index.ts`, `frontend/modules/categories/{api.ts,categories-page.tsx,category-check-page.tsx}`, `frontend/app/plans/[planId]/categories/check/page.tsx` -- page, link, query and invalidation.
- `frontend/tests/category-check.test.tsx` (new), `frontend/tests/plan-views.test.tsx` -- Vitest `fr46_*`.
- `frontend/e2e/user-journeys.spec.ts`, `frontend/e2e/support/categories.ts` (new), `frontend/e2e/categories.spec.ts` -- the UJ-1 category check journey and shared helpers.
- `.docs/implementation-artifacts/epic-13-context.md` -- recompiled (the spine was newer).

**Review.** 28 findings. 10 low rows were patched (7 distinct fixes): invalidating the check on category writes, removing the unused `params` prop, the e2e pre-cleanup, recording the chosen part as an annotation, dropping the `!`, checking cleanup statuses, and covering Enter on a row plus panel close in the e2e. Nothing was deferred. 11 low rows were rejected:
- the loop cost;
- store-normalised category text;
- parts in several locations;
- the launcher entry;
- first-match against 13.4 seeds;
- duplicated copy and link class;
- the back-link landmark;
- a categories revision field;
- the unknown-project fallback;
- reset covered through the shared refetch;
- recommendations being category-blind by import contract.

7 rows were rejected as false. Each reason is in the triage log.

**Follow-up review recommended: false.** Patched: 0 high, 0 medium, 10 low.

**Verification.**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` (5 kept), `npm run lint`, `npm run typecheck` -- clean.
- `npm test`: pytest 1119 passed, 2 skipped; Vitest 743 passed. After the review patches, `npm run test:web` -- 744 passed. Those patches did not touch the backend.
- `pytest tests/app --database-url postgresql+psycopg://...` on a local `postgres:17` container -- 384 passed, 3 skipped.
- `npm run gen:api` -- no change to `schema.ts`.
- `npm run trace` -- OK; FR-46 has 26 tests.
- `npm run e2e -- --project=chromium` (after the patches) -- 141 passed, 3 skipped (declared Epic 14-16 skips), 0 failed.
- `npm run e2e -- e2e/user-journeys.spec.ts e2e/categories.spec.ts --project=firefox --project=msedge` (after the patches) -- 20 passed, 6 skipped (the same declared skips), 0 failed.

**Residual risks.**
- The UJ-1 check e2e relies on no other global rule matching a whole sample description, and on aisle A having no categories. Story 13.4's starter rules and aisle categories will break both, so that story must adapt the test.
- The check counts every import aisle without categories, not only aisles that hold categorised parts.

