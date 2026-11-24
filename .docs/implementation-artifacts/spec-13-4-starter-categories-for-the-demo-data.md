---
title: 'Story 13.4: Starter categories for the demo data'
type: 'feature'
created: '2026-11-24'
baseline_revision: '565d58a119d3be76bc6fdb3c1ac9c9f65b36fed9'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-13-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      categories.spec.ts removes its run's aisle chip only at the end of the test, with no finally, so a failing run leaves a `Cata <run>` chip on aisle G, H or I.
    evidence: |-
      Pre-existing since Story 13.2: the chip is removed by the last UI step, not in a finally/API cleanup. On a reused local e2e server the chip stays until the server restarts (e2e:reset-db).
    location: >-
      frontend/e2e/categories.spec.ts:118-125
    severity: low
---

<intent-contract>

## Intent

**Problem:** After importing `data/sample/`, the category check (13.3) lists nothing until the planner types keyword rules and gives aisles categories by hand, so an examiner following the README cannot see it work (FR-47).

**Approach:** Ship a starter list `backend/settings/starter_categories.toml` (ordered keyword rules + categories per aisle A–I), drafted by AI (Claude Code) only from the synthetic part descriptions and aisles in `data/sample/`. `swp.app.bootstrap(seed=True)` loads it idempotently, only when both category tables are empty. Add the README step, update the spine's seed convention, and adapt the e2e specs that assumed no global rules or aisle categories.

**Author check pending:** this run is unattended. The starter list was drafted by AI (Claude Code) from `data/sample/` only and **still awaits the author's check** before it can be counted as "checked by the author" (Story 13.4 AC 1). The orchestrating session records both facts in the session log.

## Boundaries & Constraints

**Always:**
- Starter list (drafted from `data/sample/` part types and aisles A–I; every sample part gets a category, every sample aisle gets categories, every aisle category is given by a rule). TOML shape: `[[rules]]` tables with `keyword`/`category` in rule order, then `[aisles]` mapping aisle text → list of categories. Content (order matters, first match wins, whole words):
  - rules: filter→Filters; brake, handbrake→Brakes; exhaust, muffler, catalytic→Exhaust; sensor, switch→Sensors; gasket→Engine; oil, coolant→Fluids; spark, glow, ignition→Ignition; headlight, light→Lighting; tailgate, door, window, bumper, wiper→Body; drain→Engine; washer→Body; alternator, starter, horn, fuse→Electrical; radiator, thermostat, water, expansion, heater, ac→Cooling; intercooler→Engine; clutch, gearbox, cv, drive→Drivetrain; shock, spring, strut, stabilizer, arm, ball, rod, steering→Suspension and steering; wheel→Wheels; timing, belt, turbocharger, egr, fuel, throttle, mount→Engine.
  - aisles: A=[Filters, Fluids], B=[Brakes], C=[Engine], D=[Ignition, Sensors, Electrical], E=[Cooling], F=[Exhaust, Drivetrain], G=[Suspension and steering], H=[Wheels, Lighting], I=[Body].
- Loader in `swp/app` (tomllib + pydantic, like `load_analysis_settings`): validates every rule with `domain.categories.rule_errors` (taken keys accumulate in file order) and every aisle with `aisle_category_errors`; an invalid file raises `ValueError` naming the entry (a shipped-file bug, never silently skipped).
- Store: one new function writes the seed in one `write_transaction`; on Postgres it takes `LOCK TABLE keyword_rules IN EXCLUSIVE MODE` then `LOCK TABLE aisle_categories IN EXCLUSIVE MODE`, inserts only when **both** tables have no rows (positions 0..n-1, uuid4 ids, `updated_at = now`), and returns whether it wrote. Safe for 4 uvicorn workers starting at once; a busy lock is treated as "someone else is writing" and skips (logged), never crashes startup.
- `bootstrap(upgrade, seed)`: with `seed`, seeds `demo` then the starter categories; `seed=False` seeds nothing. Layers unchanged (`api > app > store > domain`; only `swp.store` imports SQLAlchemy).
- Spine (`ARCHITECTURE-SPINE.md`): the Data convention row names two seeds (demo account, starter categories loaded only when both category tables are empty); the AD-9 migrate-and-seed bullet mentions it; the stage 2 Deferred note drops the 13.4 item. README: the milestone demo gains a "Category check" step after the Move list (CAT → Categories with the starter rules → Category check lists parts), the account section says the starter categories are seeded with `demo`.
- Tests carry `fr47`: backend `test_fr47_*` on SQLite and Postgres; e2e titles start `uj1 fr47`/`uj1 fr46`. New e2e code imports `test`/`expect` from `frontend/e2e/support/test.ts`.
- E2E adaptation: `uj1 fr46` no longer adds a whole-description rule (starter rules come first and win). It saves aisle X's (C/D/E) current list, clears X, adds rule `kwz<run>`→`Aisle <run>` and gives X that category in the UI, then reads `GET /api/plans/{id}/category-check` to pick a lone part in X whose category is one of aisle A's categories; the row shows that category and `Aisle <run>`; a manual move to an empty location in A (meant for that category) clears the row; undo brings it back. `finally` deletes its rule and restores X's saved list (leftover `Aisle <8 hex>` entries dropped). `removeCategories` takes the list to restore. A new `uj1 fr47` test opens CAT, sees the starter rule `filter`→`Filters` and aisle A's chips Filters and Fluids, follows Category check, and sees the count line and at least one row in aisle A with aisle categories "Filters, Fluids" (no test writes aisle A).

**Never:** no edits to `data/sample/`, `data/answer-key/`, `data/private/`, `.logs/`; no schema/migration change and no change to the 13.1–13.3 endpoint contracts; no overwrite or merge into a non-empty category table; no seeding from the FastAPI request path or the frontend; no categories in recommendations; no other planning-artifact edits than the spine; no deployment, push, Vercel or Supabase.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh database | both tables empty, `bootstrap(seed=True)` | all starter rules in file order, aisles A–I with their categories | — |
| Run twice | seed already loaded | nothing changes (same ids, positions, `updated_at`) | — |
| Planner has rules | ≥1 keyword rule, no aisle categories | nothing seeded | — |
| Planner has aisle categories only | ≥1 aisle row, no rules | nothing seeded | — |
| `seed=False` | empty tables | nothing seeded | — |
| Sample plan after seed | import `data/sample/` | check lists parts (`outside_count > 0`), `aisles_without_categories == 0` | — |
| Invalid file | duplicate keyword / empty category / duplicate aisle category | — | `ValueError` naming the entry |
| Concurrent start | 4 workers bootstrap at once | exactly one seed | busy lock → skip, no crash |

</intent-contract>

## Code Map

- `backend/swp/app/bootstrap.py` -- only migrate/seed path; add the starter seed after `auth.seed_demo_account`.
- `backend/swp/app/plans.py:23,42` -- `ANALYSIS_SETTINGS_PATH`/`load_analysis_settings` pattern (`BACKEND_DIR / "settings"`, tomllib).
- `backend/swp/app/categories.py` -- category service; home for `STARTER_CATEGORIES_PATH`, `load_starter_categories(path)` and `seed_starter_categories(*, now, path=...) -> bool`.
- `backend/swp/domain/categories.py:122,234` -- `rule_errors(keyword, category, taken_keys)`, `aisle_category_errors(aisle, categories)`, `keyword_key`, `category_of`, `KeywordRule`, `aisle_categories_view` (no-rule flag).
- `backend/swp/store/keyword_rules.py`, `backend/swp/store/aisle_categories.py` -- write/lock patterns, `RuleDraft`, `is_busy`; `backend/swp/store/models.py` -- `KeywordRuleRow`, `AisleCategoryRow`. New store function (e.g. `swp/store/category_seed.py`).
- `backend/swp/api/app.py:37-41`, `backend/swp/cli.py:28` -- callers of `bootstrap(upgrade=True, seed=True)` (lifespan only when `APP_ENV=local`; `e2e:backend` runs `swp db upgrade` before 4 workers).
- `backend/tests/app/conftest.py` -- `empty_tables` (bootstrap seed=False, clears both tables); `backend/tests/app/test_fr50_demo_account.py` -- bootstrap(seed=True) tests; `backend/tests/app/test_parts_api.py:14` `_sample_plan`; `backend/tests/app/test_import_readers.py:238` `_data_files`, `check_files` rows (`values["Part Description"]`, `values["Aisle"]`).
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md:182,334,475` -- seed lines to update.
- `README.md:68,94,100-132` -- account seed text and milestone demo steps.
- `frontend/e2e/support/categories.ts` -- `ruleRow`, `addRule`, `addAisleCategory`, `removeCategories`.
- `frontend/e2e/user-journeys.spec.ts:151,1226-1320` -- `lonePart`, `wallOf`, `CHECK_AISLE_BY_PROJECT`, `uj1 fr46`; `frontend/e2e/support/plan-api.ts` -- `getJson`, `locationRows`, `moveFromPanel`.
- `frontend/e2e/categories.spec.ts` -- aisles G/H/I add then remove their own chip; works on top of the seeded list (comment update only).

## Tasks & Acceptance

**Execution:**
- `backend/settings/starter_categories.toml` -- the starter list above, with a header comment (FR-47, synthetic data only, AI-drafted from `data/sample/`, awaiting the author's check).
- `backend/swp/store/category_seed.py` -- `seed_if_empty(rules, aisles, *, now) -> bool` with both locks; `CategorySeedBusy` on busy.
- `backend/swp/app/categories.py` -- loader + `seed_starter_categories`; `backend/swp/app/bootstrap.py` -- call it under `seed`.
- `backend/tests/app/test_fr47_starter_categories.py` -- `test_fr47_starter_categories_check_runs` (seed, import sample, check lists parts, 0 aisles without categories) and the matrix rows (idempotent, never overwrites either table, seed=False, invalid file, file order); `test_fr47_starter_rules_cover_every_sample_part` (every sample description gets a category, every sample aisle has categories, every aisle category is given by a rule).
- `.docs/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`, `README.md` -- seed convention and README step.
- `frontend/e2e/support/categories.ts`, `frontend/e2e/user-journeys.spec.ts`, `frontend/e2e/categories.spec.ts` -- restore-aware cleanup, adapted `uj1 fr46`, new `uj1 fr47`.

**Acceptance Criteria:**
- Given a clean database, when `swp db upgrade` (or the local lifespan) runs, then the keyword rules and aisle categories of `starter_categories.toml` are stored; when it runs again or either table already has rows, then nothing is written (FR-47, AD-9).
- Given the README followed from a clean checkout and `data/sample/` imported, when the planner opens CAT → Category check, then the check lists parts with no manual setup (FR-47, `test_fr47_starter_categories_check_runs`, e2e `uj1 fr47`).
- Given `npm run e2e` in chromium, firefox and msedge on a server seeded with the starter list, when the category specs run, then they pass (0 failed, 0 flaky) and leave the seeded aisles as they found them.
- Given the spine, then it names the starter categories as the second seed beside the demo account.

## Spec Change Log

## Review Triage Log

### 2026-11-24 — Review pass
- verdicts: 26 findings — high 0, medium 0, low 15, false 11, maybe-false 0
- findings:
  - `[false]` `[reject]` (intent) AC 1's author check is unmet — the intent says this unattended run cannot do it; the toml header and this spec say the list awaits the author's check, and the orchestrator logs it.
  - `[low]` `[reject]` (intent) no test runs the README path or the production `swp db upgrade` seed — `e2e:backend` runs `swp db upgrade` on a fresh `e2e.db` before the workers start, so `uj1 fr47` already sees a seed written by the CLI path; a production-mode test adds a run for the same `bootstrap` call.
  - `[low]` `[reject]` (intent) the check lists about 90% of sample parts — the sample places parts at random, so any aisle layout gives a long list; the Design Notes record this as the demo.
  - `[false]` `[reject]` (intent) `uj1 fr46` now proves the check through the seed — the spec defines this scenario; FR-46's move/undo behaviour is still asserted in the UI.
  - `[false]` `[reject]` (intent) the spine edits go beyond the one convention — the epic context (AD-9 seeding) names the stage 2 Deferred note and the seed line as this story's updates.
  - `[false]` `[reject]` (intent) retro items handled only in the spec — the Design Notes record that the open seeding items concern the demo seed; the README sentence names both seeds.
  - `[low]` `[reject]` (edge) a missing or invalid starter file breaks startup even when the tables are full — the spec asks a shipped-file bug to fail loudly; the shipped file is checked by `test_fr47_starter_rules_cover_every_sample_part`.
  - `[low]` `[patch]` (edge) emptying both lists brings the starter list back on the next start — the behaviour is the story's rule (seed when both tables are empty); README now says so.
  - `[false]` `[reject]` (edge) a busy lock held by a planner write leaves the tables empty with exit 0 — a planner write that holds the lock leaves at least one table non-empty after commit, which blocks the seed anyway.
  - `[low]` `[reject]` (edge) an aisle with `[]` or an empty file seeds nothing but returns True — not in the shipped file; the coverage test asserts every sample aisle has categories.
  - `[low]` `[reject]` (edge) a killed `uj1 fr46` run after the pre-clear leaves its aisle empty on a reused server — only on a reused local server; `e2e:reset-db` restores the starter list on every server start, and the fix needs a starter fixture in the e2e support.
  - `[low]` `[defer]` (edge) `categories.spec.ts` has no `finally`, so a failing run leaves its chip on G/H/I — pre-existing since 13.2; not caused by this story.
  - `[low]` `[reject]` (edge) claim "leave the seeded aisles as they found them" fails for killed/failed runs — same root cause as the killed-run row; holds for every completed run.
  - `[low]` `[patch]` (edge) claim "never overwritten" vs re-seed of emptied lists — same root cause as the re-seed row; README sentence added.
  - `[low]` `[reject]` (blind) 90% of parts outside their aisle — same as the intent row.
  - `[false]` `[reject]` (blind) the toml still says it awaits the author's check — required by the intent.
  - `[low]` `[patch]` (blind) emptied lists come back — same root cause as the edge re-seed row; README sentence added.
  - `[low]` `[reject]` (blind) a broken file stops startup even when nothing would be seeded — same as the edge row.
  - `[low]` `[patch]` (blind) the busy-lock docstring says "another worker is seeding" though any writer can hold it — docstring reworded; the log line was already accurate and INFO is kept (the skip is normal on a multi-worker start).
  - `[false]` `[reject]` (blind) generic keywords mis-categorise other imports — the story's list is for the demo data; the planner edits rules for other data (FR-43).
  - `[low]` `[reject]` (blind) no test that every rule is reachable — all rules are reachable today; a new test for a hypothetical reorder is not worth the extra code.
  - `[low]` `[reject]` (blind) e2e cleanup can lose an aisle's starter list; `Cata` leftovers not filtered — same root cause as the killed-run row; `Cata` chips come from the pre-existing categories.spec gap (deferred).
  - `[false]` `[reject]` (blind) the e2e does not check "0 aisles without categories" — parallel specs temporarily change aisles C–I, so the number is not stable in e2e; `test_fr47_starter_categories_check_runs` asserts it.
  - `[low]` `[patch]` (blind) `uj1 fr47` never checks the row's category is outside aisle A's — the test now asserts the category cell is neither Filters nor Fluids.
  - `[low]` `[patch]` (blind) the busy-lock test checks little — it now also asserts the aisles stay empty.
  - `[false]` `[reject]` (blind) the diff leaves out the spec and sprint status — the spec is the claims file, kept out of the review diff on purpose; sprint status belongs to the orchestrator.

## Design Notes

Every sample part type is covered so the check is meaningful; each category sits on exactly one aisle, so the randomly placed sample parts give many rows (that is the demo). Rule order is the disambiguation: `filter` before `oil`/`fuel` ("Oil filter", "Fuel filter"), `brake` before `sensor` ("Brake wear sensor"), `exhaust` before `gasket`, `sensor`/`switch`/`gasket` before `oil` ("Oil pressure switch", "Oil sump gasket"), `tailgate` before `strut`, `drain` before `washer`, `gearbox`/`strut` before `mount`. `handbrake` is one word, so it needs its own rule.

Open retro items on seeding (epic-9 R4/R15/R16: demo seed with `FEATURE_DEMO` off, seed target with `MIGRATION_DATABASE_URL`) concern the demo seed; the starter seed follows the same path (`DATABASE_URL`) and the README sentence names both seeds. No other open action item concerns this code.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass; `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://...` on a local `postgres:17` container -- expected: all pass.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass. `npm run trace` -- expected: OK, FR-47 listed.
- `npm run e2e -- --project=chromium` -- expected: 0 failed; `npm run e2e -- e2e/user-journeys.spec.ts e2e/categories.spec.ts --project=firefox --project=msedge` -- expected: 0 failed.

## Auto Run Result

Status: done

**Summary.** The demo setup now ships starter categories (FR-47). `backend/settings/starter_categories.toml` holds 54 ordered keyword rules and categories for aisles A–I. Claude Code drafted it from the synthetic `data/sample/` descriptions and aisles only. **It still awaits the author's check (Story 13.4 AC 1)**; the orchestrating session records that in the session log. `bootstrap(seed=True)` seeds `demo` and then the starter list, in one write transaction, only when both `keyword_rules` and `aisle_categories` are empty. On Postgres it locks both tables, and a busy lock is logged and skipped. An invalid file raises a `ValueError` that names the entry. After importing `data/sample/`, the category check lists parts with no setup. The spine names the starter categories as the second seed, and the README has a Category check step.

**Files changed.**
- `backend/settings/starter_categories.toml` (new) -- the starter list.
- `backend/swp/store/category_seed.py` (new) -- `seed_if_empty` with both locks and `CategorySeedBusy`.
- `backend/swp/app/categories.py`, `backend/swp/app/bootstrap.py`, `backend/swp/app/auth/__init__.py` -- loader, `seed_starter_categories`, bootstrap call, docstrings.
- `backend/tests/app/test_fr47_starter_categories.py` (new) -- `test_fr47_*`, every matrix row plus sample coverage.
- `backend/tests/app/conftest.py`, `test_fr43_…`, `test_fr45_…`, `test_fr46_…` -- `without_starter_categories` fixture for tests that start from empty tables.
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md` -- two seeds (Data row, AD-9 bullet, Deferred note).
- `README.md` -- starter seed text and milestone demo step 12 "Category check".
- `frontend/e2e/support/categories.ts`, `frontend/e2e/user-journeys.spec.ts`, `frontend/e2e/categories.spec.ts` -- restore-aware cleanup, adapted `uj1 fr46`, new `uj1 fr47`, comments.

**Review.** 26 findings: 15 low and 11 false.
- **Patched:** 8 low rows, 4 distinct fixes:
  - the README says emptying both lists re-seeds;
  - the busy-lock docstring is corrected;
  - `uj1 fr47` asserts the row's category is outside aisle A's;
  - the busy-lock test asserts the aisles stay empty.
- **Deferred:** 1 row. The pre-existing `categories.spec.ts` has no `finally` around its chip cleanup.
- **Rejected:** 6 low rows:
  - no production-mode or README-path test;
  - the long check list on randomly placed sample data (counted twice);
  - a broken file failing startup loudly (counted twice);
  - an empty aisle entry in a hypothetical file;
  - a killed e2e run on a reused server (counted three times);
  - no rule-reachability test.
- **False:** 11 rows. Each reason is in the triage log.

**Follow-up review recommended: false.** Patched 0 high, 0 medium, 8 low.

**Verification.**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` (5 kept), `npm run lint`, `npm run typecheck` -- clean, before and after the patches.
- `npm test` -- pytest 1134 passed, 2 skipped; Vitest 744 passed. After the patches, `npm run test:py` -- 1134 passed, 2 skipped.
- `pytest tests/app --database-url postgresql+psycopg://...` on a local `postgres:17` container -- 399 passed, 3 skipped.
- `npm run trace` -- OK; FR-47 has 13 tests.
- `npm run e2e -- --project=chromium` -- 142 passed, 3 skipped (the declared Epic 14–16 placeholders), 0 failed.
- `npm run e2e -- e2e/user-journeys.spec.ts e2e/categories.spec.ts --project=firefox --project=msedge` -- 22 passed, 6 skipped, 0 failed.
- After the patches, the same two specs in chromium, firefox and msedge -- 33 passed, 9 skipped, 0 failed.

**Residual risks.**
- AC 1 is open until the author has checked the AI-drafted list.
- With random sample placement, the check lists most parts (about 90%).
- Emptying both category lists brings the starter list back on the next start; the README says so.
- A killed `uj1 fr46` run on a reused local e2e server can leave its aisle empty until the server restarts.
- The implementer saw one firefox failure of `uj3 … continues a saved plan a week later`, which does not touch categories. It passed on re-run and in this run.
