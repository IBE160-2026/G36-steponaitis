---
title: 'CI 44979957249: run e2e against a production build and keep the backend responsive under parallel workers'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_revision: '2910a5e34bdd35cbcd3df23dc269180c6421248e'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [multiple-goals, oversized]
deferred:
  - summary: >-
      Under heavy overload (8 Playwright workers on 8 cores) a plan create can still take about 20 s, so a test that creates two plans can pass its 30 s test budget.
    evidence: |-
      After the fix, `--repeat-each=3 --workers=8` failed 1 of 102 (uj1 "start page opens the plan just created": first POST /api/plans took 19.8 s). Baseline at the same load failed 3 of 102 with POSTs at 22-25 s. Profiling shows ~90 % of a 1.1 s create is openpyxl parsing. The default worker count (4 locally, 2 in CI) passed every run. A faster import parser or a shared sample plan per worker would settle it.
    location: >-
      backend/swp/app/imports/readers.py _read_xlsx
    severity: low
  - summary: >-
      The local e2e database `backend/var/e2e.db` is never reset and had grown to 1.8 GB, which made GET /api/plans take 2-4 s locally.
    evidence: |-
      Seen in the local baseline traces. CI always starts from a fresh database, so CI is not affected. This run moved the old file out of the way; nothing resets it between runs.
    location: >-
      package.json e2e:backend
    severity: low
---

<intent-contract>

## Intent

**Problem:** CI run 44979957249 failed uj7 (`frontend/e2e/part-panel-search.spec.ts`) twice: after a part is opened (URL already `?part=`), the panel heading did not appear within 5 s. Both CI traces show no slow or failed request: the part-detail fetch starts 4.5–5 s *after* the URL change and returns 200 in ~100 ms. The delay is the client render: opening the panel re-renders `PartsPage`, which re-renders the 1,545-row Parts table in development-mode React (`next dev`) on a CPU-starved runner. Separately, locally `POST /api/plans` takes 22–25 s with 8 workers (1.1 s alone; profiling shows ~90 % is openpyxl parsing, CPU-bound in one Python process), and the Next.js rewrite proxy answers 500 when a proxied request exceeds its 30 s `proxyTimeout` — the likely source of the earlier "intermittent 500". A stress run of 20 concurrent creates + 80 reads on SQLite produced no lock error, so SQLite locking is not the observed cause, but a multi-process backend needs WAL to read and write concurrently.

**Approach:** (1) Playwright's web server (CI and default) runs a production frontend (`next build` then `next start`) and a backend with several uvicorn worker processes (migrated once before start), so neither React dev mode nor a single GIL-bound process gates the journeys. (2) The Parts page stops re-rendering its table when only the panel changes. (3) SQLite connections use WAL so readers and a writer in different processes do not block each other, with a store-layer test.

## Boundaries & Constraints

**Always:** `/api/*` stays same-origin through the existing `next.config.ts` rewrite (AD-2). `npm run dev` is unchanged (dev servers, `--reload`). `reuseExistingServer` outside CI stays. Postgres behaviour is unchanged (WAL pragma only on SQLite). Tests name their FR/NFR.

**Never:** No raised assertion timeouts, retries, `waitForTimeout`, or test-only branches in app code. No change to `data/`. No new dependencies. Do not change the import parser or API contracts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Read during a write | A SQLite reader holds an open read transaction while a plan is saved | The save commits at once; the reader still sees its snapshot | No `database is locked` |
| Fresh e2e DB, several workers | `backend/var/e2e.db` absent, server starts | Migrations run once before uvicorn workers start | No migration race |
| Non-SQLite URL | Postgres engine | No pragma issued | No error expected |
| Panel open on Parts | Click a roster row or search result | Table rows are not re-rendered; panel renders | No error expected |

</intent-contract>

## Code Map

- `frontend/playwright.config.ts` -- `webServer.command: "npm run dev"`, `timeout: 120_000`, env `DATABASE_URL` to `backend/var/e2e.db`. Switch the command; startup timeout must cover a build.
- `package.json` (root) -- scripts `dev`, `dev:backend` (`uvicorn ... --reload`), `dev:frontend`; add e2e serving scripts next to them (use `concurrently`, already a devDependency).
- `frontend/package.json` -- has `dev`, `build`; no `start`.
- `frontend/next.config.ts` -- rewrite `/api/:path*` → `http://127.0.0.1:8000`; applies to `next start` too. `.next/dev` (dev) and `.next/` (build) coexist.
- `frontend/e2e/support/warm-routes.ts` -- globalSetup that compiles routes for `next dev`; harmless with `next start` (still useful when a reused dev server runs); update its comment only.
- `.github/workflows/ci.yml` `e2e` job -- runs `npm run e2e -- --project=chromium`; config change covers it, update the comment.
- `frontend/modules/parts/parts-page.tsx:149-215` -- `PartsView` and `PartsPage`; `search` element and `onOpen` closure are recreated every render, so the 1,545-row `DataTable` re-renders on panel open. `panel.open` is stable across part changes (`usePartPanel` deps exclude `part`).
- `frontend/components/common/part-panel.tsx:52-76` -- `usePartPanel`; read-only.
- `backend/swp/store/db.py` -- `get_engine` registers `_enable_sqlite_foreign_keys` on `connect`; add WAL there. pysqlite default busy timeout is 5 s.
- `backend/swp/cli.py` -- `swp db upgrade` runs migrations; use it before multi-worker start. `swp/api/app.py` lifespan also upgrades (no-op once at head).
- `backend/swp/store/plans.py` -- `insert_plan_with_import`, `get_plan` via `transaction()`; the test uses these.
- `backend/tests/conftest.py` -- `database_path` fixture (fresh SQLite file, cache clearing); `backend/tests/app/conftest.py` -- `app_database`/`empty_tables` (may be Postgres).
- Evidence: `node_modules/next/dist/server/lib/router-utils/proxy-request.js:37,80-85` -- `proxyTimeout || 30000`; on error logs `Failed to proxy` and responds 500.

## Tasks & Acceptance

**Execution:**
- `frontend/package.json` -- add `"start": "NEXT_TELEMETRY_DISABLED=1 next start -p 3000"`.
- `package.json` -- add `e2e:serve` (build the frontend, then run backend and frontend with `concurrently --kill-others`), `e2e:backend` (`swp db upgrade` then uvicorn `swp.main:app` on 127.0.0.1:8000 with `--workers 4`, no reload), `e2e:frontend` (`npm run start --workspace frontend`).
- `frontend/playwright.config.ts` -- `webServer.command: "npm run e2e:serve"`; startup `timeout` large enough for a build (e.g. 300 s); comment why.
- `frontend/e2e/support/warm-routes.ts` -- comment: only needed when a reused `next dev` server runs.
- `.github/workflows/ci.yml` -- e2e step comment: Playwright builds and starts the production app.
- `frontend/modules/parts/parts-page.tsx` -- `memo` `PartsView`; in `PartsPage` give it a stable `onOpen` (`useCallback`) and `search` (`useMemo`) so opening or closing the panel does not re-render the table.
- `backend/swp/store/db.py` -- on SQLite `connect`, also `PRAGMA journal_mode=WAL`; docstring says why (concurrent processes).
- `backend/tests/test_store_db.py` (new) -- `test_nfr7_plan_saves_while_a_reader_holds_a_read_transaction` (raw sqlite3 connection with an open `BEGIN` + `SELECT` on the same file; `insert_plan_with_import` succeeds quickly and `get_plan` returns it) and `test_nfr7_sqlite_uses_wal` (`PRAGMA journal_mode` is `wal`). Build a `StoredPlan` the way existing tests do (reuse helpers; do not read `data/private/`).
- `AGENTS.md` -- "Running and verifying" E2E line: Playwright builds and starts the production app (`npm run e2e:serve`).

**Acceptance Criteria:**
- Given CI or a local run with no server on :3000, when `npm run e2e -- --project=chromium` runs, then the web server is `next start` from a fresh build with a multi-worker backend, `/api/*` works through the rewrite, and all tests pass (twice).
- Given the uj7/uj6 spec, when `npx --workspace frontend playwright test e2e/part-panel-search.spec.ts --project=chromium --repeat-each=20` runs, then 40/40 pass.
- Given the change, when `npm run lint`, `npm run typecheck`, `npm run test:web`, `npm run test:py`, `npm run lint:py`, `npm run lint:imports` run, then all exit 0.

## Spec Change Log

- 2026-11-22 (implementation): `PRAGMA journal_mode=WAL` needs an exclusive lock the first time it switches a file from the rollback journal, so a process whose first connection opens beside a reader got `database is locked` in the connect hook (seen in the new reader test). `upgrade_to_head` now connects once through the app engine (`ping()`) before migrating, so `swp db upgrade` (and the app lifespan) switches the file to WAL before any worker opens it; WAL is stored in the file, so later connects are a no-op. The pragma stays in the connect hook as well.

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 15, false 10, maybe-false 0
- findings:
  - `[low]` `[reject]` Intent: the memo test is a structural check and does not prove the table skips re-rendering at the e2e surface — a render-count test needs mocked `useSearchParams`/`usePlanParts` (new harness); uj7/uj6 cover the panel end to end (34/34 twice, 40/40 repeat).
  - `[low]` `[reject]` Intent: the concurrency test is at the store layer, not HTTP with several processes and the proxy — the HTTP surface is exercised by every e2e run against the 4-worker backend; a multi-process HTTP test would add a new harness.
  - `[false]` `[reject]` Intent: changes beyond the three items (workers, WAL for dev too, memo) — the intent asks to resolve root causes; the trace and profiling pointed at these, and WAL in every SQLite run is what makes several processes safe.
  - `[false]` `[reject]` Intent: "ideally the default" only partly met because a running dev server is reused locally — the default command is the production build; reuse outside CI is unchanged and documented in AGENTS.md.
  - `[false]` `[reject]` Intent: the webServer startup timeout was raised (120 → 300 s) — it covers the new `next build` step at startup; no assertion timeout or retry changed.
  - `[low]` `[patch]` Verification gap: removing the `ping()` WAL pre-switch fails no test — `test_nfr7_sqlite_uses_wal` now disposes the engine and checks the mode on a raw `sqlite3` connection; verified it fails with `ping()` removed.
  - `[low]` `[reject]` Verification gap: memo regression not caught by the unit test — same as the first Intent row.
  - `[low]` `[patch]` Blind: four workers each run the lifespan upgrade; the `upgrade_to_head` comment overstates the ordering — comment now says a multi-worker start must run `swp db upgrade` first (as `e2e:backend` does) and the workers' upgrades are no-ops.
  - `[low]` `[patch]` Blind: WAL test passes without `ping()` — grouped with the verification-gap patch.
  - `[low]` `[reject]` Blind: no multi-process test — as the second Intent row.
  - `[low]` `[reject]` Blind: memo test only checks React internals — as the first Intent row.
  - `[low]` `[patch]` Blind: `< 2` s wall-clock assertion is weak and can flake — removed; without WAL the save raises `database is locked`, which still fails the test.
  - `[low]` `[reject]` Blind: CI does not cache `.next/cache` — the build takes about 30 s; adding a cache step is extra workflow surface for a small saving.
  - `[false]` `[reject]` Blind: docs do not say local runs may reuse a dev server — AGENTS.md's E2E line says it reuses a running server on :3000 outside CI.
  - `[false]` `[reject]` Blind: `e2e:serve` can overwrite a running dev server's `.next` — Next 16 dev writes to `.next/dev`, build to `.next`; both coexisted in this run.
  - `[low]` `[reject]` Blind: warm-up still runs against the production build — a few cheap requests; it still helps when a reused dev server runs.
  - `[low]` `[reject]` Blind: hard-coded "1,545-row" and `--workers 4` — comments state the measured case; package.json cannot hold a comment and AGENTS.md names the worker count.
  - `[false]` `[reject]` Blind: WAL pragma on every connection is wasteful — it is a no-op once the file is WAL and covers databases that were never bootstrapped; `:memory:` just returns `memory`.
  - `[false]` `[reject]` Blind: spec left out of the diff — deliberate; the workflow gives the spec only to the edge-case layer.
  - `[low]` `[reject]` Edge: WAL silently unavailable (read-only or shm-less filesystem) — SQLite is local-only (production is Postgres); a warning branch is complexity for a case nobody meets.
  - `[false]` `[reject]` Edge: connect hook raises `database is locked` when no upgrade ran first — every SQLite start path runs `upgrade_to_head` first (lifespan in local, `swp db upgrade` in e2e); non-local deployments use Postgres.
  - `[false]` `[reject]` Edge: non-local multi-worker start without `swp db upgrade` — same as the row above; documented in the `upgrade_to_head` comment.
  - `[low]` `[patch]` Edge: timing assertion flakes on a slow runner — grouped with the Blind timing patch.
  - `[low]` `[patch]` Edge: four concurrent lifespan alembic runs — grouped with the Blind comment patch; migrations are at head before the workers start, so their upgrades are read-only no-ops (two clean e2e runs on a fresh database).
  - `[false]` `[reject]` Edge: local runs silently keep dev-mode slowness when a dev server is reused — documented reuse, as the Blind docs row.

## Design Notes

CI trace (first try, row-click step): URL matched `?part=2770303` at +0.3 s; `GET /api/plans/<id>/parts/2770303` started at +4.5 s, took 100 ms; expect failed at +5.1 s. Search-result step: URL at +0.6 s, detail fetch at +5.6 s. Page snapshot shows 1,546 table rows. CI used 2 Playwright workers; no 500 in that run.

Why workers + WAL together: one uvicorn process serializes CPU-bound imports (GIL), so N parallel creates take ~N × 1.1 s plus contention and can pass the proxy's 30 s. Several processes parallelize them, but separate processes share the SQLite file, where the rollback journal blocks a commit while any reader holds a read lock; WAL removes that.

## Verification

**Commands:**
- `npm run e2e -- --project=chromium` (twice) -- expected: all passed
- `npx --workspace frontend playwright test e2e/part-panel-search.spec.ts --project=chromium --repeat-each=20` -- expected: 40 passed
- `npm run lint`, `npm run typecheck`, `npm run test:web`, `npm run test:py`, `npm run lint:py`, `npm run lint:imports` -- expected: exit 0

## Auto Run Result

**Summary:** The CI traces of run 44979957249 showed no failed or slow request. The URL changed to `?part=` at once, but the part-detail fetch started 4.5-5 s later and returned 200 in about 100 ms. The cause was the client render: opening the panel re-rendered the 1,545-row Parts table in development-mode React on a busy runner. The earlier "intermittent 500" was not reproduced as a SQLite lock: a stress run of 20 concurrent creates and 80 reads gave no lock error. It matches the Next.js rewrite proxy, which answers 500 when a proxied request passes its 30 s `proxyTimeout`. Plan creates are CPU-bound (about 1.1 s alone, about 90 % openpyxl) and queue in one GIL-bound uvicorn process, so locally with 8 workers they took 20-25 s. The fix has three parts. Playwright now runs a production build (`next build` + `next start`) and a backend with 4 uvicorn workers, migrated once before they start. The Parts view is memoized, so a panel change does not re-render the table. SQLite uses WAL, so the worker processes can read and write the file at the same time; store-layer tests cover this.

**Files changed:**
- `package.json` -- `e2e:serve`, `e2e:backend` (`swp db upgrade`, then uvicorn `--workers 4`), `e2e:frontend`.
- `frontend/package.json` -- `start` script (`next start -p 3000`).
- `frontend/playwright.config.ts` -- webServer `npm run e2e:serve`, startup timeout 300 s for the build.
- `frontend/e2e/support/warm-routes.ts`, `.github/workflows/ci.yml`, `AGENTS.md` -- comments and docs for the production e2e server.
- `frontend/modules/parts/parts-page.tsx` -- `PartsView` memoized; stable `onOpen` and `search` props.
- `frontend/tests/parts.test.tsx` -- checks that `PartsView` is a memo component.
- `backend/swp/store/db.py` -- SQLite connect hook adds `PRAGMA journal_mode=WAL`; `upgrade_to_head` connects (`ping()`) first so the file is switched before workers open it.
- `backend/tests/test_store_db.py` -- `test_nfr7_sqlite_uses_wal` (raw connection after bootstrap) and `test_nfr7_plan_saves_while_a_reader_holds_a_read_transaction`.

**Review findings:** 25 findings: 0 high, 0 medium, 15 low, 10 false. Three patches covered five findings: the WAL test now reads the mode on a raw connection, so it fails without `ping()`; the wall-clock assertion was removed; and the `upgrade_to_head` comment was corrected about the multi-worker start order. Two items were deferred: slow creates under 8-worker overload, and the local e2e database that never resets. The rejected findings and their reasons are in the triage log.

**Follow-up review recommendation:** false. Only `low` entries were patched (0 high, 0 medium).

**Verification:**
- `npm run e2e -- --project=chromium`: 34 passed in each of 4 runs. Runs 1, 3 and 4 used `CI=true`, and run 1 started from a fresh database. Each run did a fresh `next build` and needed no retries.
- `npx --workspace frontend playwright test e2e/part-panel-search.spec.ts --project=chromium --repeat-each=20`: 40/40 passed, both before and after the review patches.
- `npm run lint`, `npm run typecheck`, `npm run lint:py`, `npm run lint:imports`: exit 0.
- `npm run test:web`: 137 passed. `npm run test:py`: 289 passed.
- Extra stress run, `--repeat-each=3 --workers=8`: 101/102 passed, against 99/102 at baseline (deferred).

**Residual risks:** The new e2e server has not yet run on GitHub Actions. That includes the `next build` within the 300 s startup limit. Under heavy overload, plan creates are still slow because import parsing is CPU-bound.
