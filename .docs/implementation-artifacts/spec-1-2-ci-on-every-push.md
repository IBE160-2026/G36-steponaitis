---
title: 'Story 1.2: CI on every push'
type: 'chore'
created: '2026-11-21'
status: 'done'
baseline_revision: '97bff3c39ed85456446ae3cd0329472ca3e98826'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The two Story 1.2 entries in .logs/justas/issues.md lack the session-log link every earlier entry has, and attempt 1 stays open although attempt 2 supersedes it.
    evidence: |-
      Lines added by the orchestrator's log commits (5f4bfbd) read "- [ ] 2026-11-21 1-2-ci-on-every-push forsøk 1 — ..." with no [..](file.md) link, unlike the 1-1 entries above them. Session logs are owned by the orchestrating session (sesjonslogg), not by this build-auto run.
    location: >-
      .logs/justas/issues.md:67
    severity: low
---

<intent-contract>

## Intent

**Problem:** Nothing checks a push. A broken lint rule, layer rule, test or e2e flow can reach `main` unnoticed, and nothing proves the store works on Postgres 17 (AD-9).

**Approach:** Add `.github/workflows/ci.yml` that runs on every push (any branch) with four jobs: Python checks (ruff, import-linter, pytest on SQLite), `tests/app` against a Postgres 17 service container, frontend checks (ESLint, typecheck, Vitest) and Playwright Chromium e2e. Add psycopg so the store can talk to Postgres, and a first `tests/app` test that runs the `/api/health` `SELECT 1` against whatever database the run selects.

## Boundaries & Constraints

**Always:**
- Same commands as local (`npm run lint:py`, `lint:imports`, `lint`, `typecheck`, `test:py`, `test:web`, `e2e -- --project=chromium`); Node 24, Python 3.12, uv 0.13.8, `npm ci` (its `postinstall` needs uv, so every job running `npm ci` installs uv first).
- `psycopg[binary]==3.3.9` (spine Stack), added to `backend/pyproject.toml` + `uv.lock`; `psycopg` and `psycopg_binary` added to the `domain-pure` contract in `backend/.importlinter`.
- AD-9: a `postgresql://` URL is rewritten to `postgresql+psycopg://` in `swp/config.py`; SQLite and default behaviour unchanged.
- `tests/app` chooses its database by an explicit pytest option `--database-url`; without it, a fresh tmp SQLite file. A misspelt option fails pytest loudly.
- e2e job: `npx --workspace frontend playwright install --with-deps chromium`, then `npm run e2e -- --project=chromium` (Playwright starts the app via its `webServer`, `CI=true` so no reuse); on failure upload `frontend/playwright-report/` and `frontend/test-results/` as artifacts. Tests already exist, so no `--pass-with-no-tests`.
- Tests name an FR/NFR (SM-7). English everywhere.

**Never:**
- Never push, create remote branches or contact GitHub from this run (the orchestrating session pushes; the throwaway-violation branch check happens after push).
- No OpenAPI schema diff (Story 1.7), no deploy/Vercel/Supabase, no secrets, no `keep-alive.yml` (Epic 16), no pooler settings (`NullPool`, `prepare_threshold`).
- Never touch `data/sample/`, `data/answer-key/`, `data/private/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health on SQLite | `pytest tests/app` (no option) | `GET /api/health` 200 `{"status":"ok"}`; engine dialect `sqlite` | — |
| Health on Postgres | `pytest tests/app --database-url postgresql://…` with Postgres 17 up | 200 `{"status":"ok"}`; engine dialect `postgresql`, driver `psycopg`; migrations ran (`alembic_version` exists) | Unreachable DB → test fails |
| URL rewrite | `DATABASE_URL=postgresql://u:p@h/db` | `settings.database_url == "postgresql+psycopg://u:p@h/db"` | `postgresql+psycopg://` and `sqlite:///` left unchanged |

</intent-contract>

## Code Map

- `package.json` (root) -- scripts `lint:py`, `lint:imports`, `lint`, `typecheck`, `test:py`, `test:web`, `e2e`; `postinstall` runs `uv sync --directory backend --locked`.
- `frontend/playwright.config.ts` -- `webServer` runs root `npm run dev` with `DATABASE_URL` → `backend/var/e2e.db`; `CI` env sets `forbidOnly`, 1 retry, html reporter (`playwright-report/`), `reuseExistingServer: false`. Traces retained on failure in `test-results/`.
- `frontend/e2e/skeleton.spec.ts` -- 3 existing tests (must stay green in CI).
- `backend/swp/config.py` -- `Settings.database_url`; `get_settings()` (lru_cache) creates SQLite parent dirs. Add the Postgres URL rewrite here (field validator).
- `backend/swp/store/db.py` -- `get_engine()` (lru_cache), `ping()` `SELECT 1`, `upgrade_to_head()`; works unchanged for Postgres once psycopg is installed.
- `backend/tests/conftest.py` -- `database_path` fixture (tmp SQLite, cache clearing pattern `_clear_caches`). Root conftest: put `pytest_addoption("--database-url")` here so it is registered for any path.
- `backend/tests/api/test_health.py` -- SQLite health tests; reuse the TestClient pattern.
- `backend/tests/test_config.py` -- `fresh_settings` fixture; add the rewrite tests here.
- `backend/.importlinter` -- `domain-pure` deny-list of every installed third-party module.
- Tooling present locally: `gh` (authenticated), Docker 29 (for a local Postgres 17 and `rhysd/actionlint`); no `act`.
- Action majors (latest releases, 2026-11-21): `actions/checkout@v7`, `actions/setup-node@v7`, `astral-sh/setup-uv@v10`, `actions/upload-artifact@v7`.

## Tasks & Acceptance

**Execution:**
- `backend/pyproject.toml`, `backend/uv.lock` -- add `psycopg[binary]==3.3.9` to dependencies; `uv lock`.
- `backend/.importlinter` -- add `psycopg`, `psycopg_binary` to `domain-pure`.
- `backend/swp/config.py` -- validator rewriting a leading `postgresql://` to `postgresql+psycopg://`.
- `backend/tests/test_config.py` -- `test_nfr12_postgresql_url_uses_psycopg_driver` and that `postgresql+psycopg://` / SQLite URLs pass unchanged.
- `backend/tests/conftest.py` -- register `--database-url` option (default empty).
- `backend/tests/app/__init__.py`, `backend/tests/app/conftest.py` -- fixture `app_database` setting `DATABASE_URL` (option value, else tmp SQLite) and `APP_ENV=local`, clearing caches before/after and disposing the engine.
- `backend/tests/app/test_health_database.py` -- `test_nfr12_health_select_one_on_selected_database`: TestClient `GET /api/health` 200 `{"status":"ok"}`, and `get_engine().dialect.name` is `postgresql` (driver `psycopg`) when the option is a Postgres URL, else `sqlite`; `alembic_version` table exists (via SQLAlchemy `inspect` through `swp.store.db.get_engine` — tests may import the store).
- `.github/workflows/ci.yml` -- `on: push` (all branches) + `workflow_dispatch`; `permissions: contents: read`; `concurrency` per ref with cancel-in-progress; jobs `python`, `postgres` (service `postgres:17`, health-checked, `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:5432/swp_test`), `frontend`, `e2e` as in Boundaries; `timeout-minutes` on each job.
- `README.md` -- one line in "Run locally" saying CI runs the same checks on every push, and how to run `tests/app` against a local Postgres.

**Acceptance Criteria:**
- Given `ci.yml`, when linted with actionlint, then no errors.
- Given the workflow's commands, when each job's steps are run locally in order (Postgres via `docker run postgres:17`), then every step exits 0.
- Given a deliberate layer violation (e.g. `swp/domain` importing `sqlalchemy`) or a failing test, when the matching CI command runs, then it exits non-zero (proven locally on a temporary change that is reverted, never committed).

## Spec Change Log

### 2026-11-21 — Unblock: Postgres and actionlint checks delegated to GitHub CI
- Trigger: run 2 halted `blocked` with `matrix test audit failed` because the "Health on Postgres" row and actionlint could not run locally (Docker image pulls hang behind `http.docker.internal:3128`; local Postgres/actionlint installs not permitted).
- Amended (outside `<intent-contract>`): `## Verification` now marks the actionlint and Postgres 17 commands as **orchestrator-verified-in-CI** and lists the cheap local substitutes. Decision taken by the orchestrating session.
- Matrix audit: the "Health on Postgres" row is satisfied by CI delegation — `test_nfr12_health_select_one_on_selected_database` runs in the `postgres` job against a `postgres:17` service container. It has NOT passed locally; proof is a green `postgres` job after the orchestrator's push.
- Known-bad state avoided: re-trying Docker pulls or local installs (a 30-minute `docker pull postgres:17` produced nothing).
- KEEP: the uncommitted attempt-1 implementation (baseline `97bff3c39ed85456446ae3cd0329472ca3e98826`) is complete and verified locally; do not rewrite it.

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 29 findings — high 0, medium 6, low 15, false 8, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) The `postgres` job passes on SQLite if `--database-url` is dropped, because the test picks the expected dialect from its own input — patched: the job's pytest step sets `SWP_EXPECT_DIALECT: postgresql`, and the test asserts `engine.dialect.name` equals it when set (verified: with the variable set, the SQLite run fails).
  - `[low]` `[reject]` (verification-gap) `postgres://` scheme is not rewritten — the contract names only `postgresql://`; Supabase hands out `postgresql://`; unlikely in everyday use and the fix adds a branch.
  - `[false]` `[reject]` (verification-gap) No migration DDL is tested on Postgres — `migrations/versions/` is empty, so there is no non-portable DDL to miss; the `alembic_version` check covers the upgrade path that exists.
  - `[low]` `[reject]` (edge-case) `postgres://` or upper-case scheme not rewritten — same as the row above; outside the contract's matrix, unlikely, fix adds branches.
  - `[medium]` `[patch]` (edge-case) An empty `--database-url` silently falls back to SQLite in the `postgres` job — same root cause as the first row; fixed by the `SWP_EXPECT_DIALECT` assertion.
  - `[false]` `[reject]` (edge-case) A reused Postgres DB could let a stale `alembic_version` hide a failed migration — a failing upgrade raises in the app lifespan, so `TestClient` startup fails; it cannot pass silently. CI uses a fresh service container.
  - `[false]` `[reject]` (edge-case) No Postgres teardown, state leaks between runs — the only write is the idempotent Alembic upgrade; no leaked state can change any current test outcome.
  - `[low]` `[patch]` (edge-case) `cancel-in-progress: true` cancels the earlier `main` run on two quick pushes, so that commit gets no verdict — patched: `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`.
  - `[low]` `[patch]` (edge-case) Playwright report is not uploaded when the e2e job times out or is cancelled — patched: `if: failure() || cancelled()`.
  - `[medium]` `[reject]` (intent-alignment) The GitHub-side evidence (workflow accepted, Postgres 17 row, action tags exist) is unproven in this run — the intent's Never list forbids pushing; delegated to the orchestrating session as orchestrator-verified-in-CI (see Spec Change Log).
  - `[false]` `[reject]` (intent-alignment) Postgres coverage is only health + migrations, not the whole store — the intent's Approach names exactly the `/api/health` `SELECT 1` test; AD-9 says persistence tests run on SQLite.
  - `[low]` `[patch]` (intent-alignment) Concurrency cancel means not every push gets a verdict — same root cause as the cancel-in-progress row; same patch.
  - `[low]` `[reject]` (intent-alignment) `postgres://` and `postgresql+psycopg2://` URLs fail at engine creation — outside the contract's matrix; unlikely, fix adds branches.
  - `[medium]` `[patch]` (intent-alignment) An omitted or empty option makes tests/app silently run on SQLite — same root cause as the first row; same patch.
  - `[medium]` `[patch]` (intent-alignment) The dialect branch is chosen from the input URL, not from the database — same root cause as the first row; the env-driven assertion now checks the engine independently of the input.
  - `[false]` `[reject]` (intent-alignment) Extra changes (spec, issues.md, README, `workflow_dispatch`, `permissions`) — none touch a Never item; README line is a listed task; no harm named.
  - `[low]` `[patch]` (blind) psycopg is forbidden only in `domain-pure`, so `swp.app`/`swp.api` may import the driver (AD-9: only `swp/store` touches the database) — patched: `psycopg`, `psycopg_binary` added to `only-store-sqlalchemy` (renamed "... SQLAlchemy, Alembic or psycopg (AD-9)").
  - `[low]` `[patch]` (blind) No layer-rule test for the new psycopg entry — same root cause; patched: case `"app imports psycopg"` in `backend/tests/rules/test_layer_rules.py`.
  - `[low]` `[patch]` (blind) Concurrency cancels runs on `main` — same root cause as the cancel-in-progress row; same patch.
  - `[false]` `[reject]` (blind) No `pull_request` trigger — the intent is "every push"; every pushed branch gets CI, and the project has no fork-PR workflow.
  - `[false]` `[reject]` (blind) Postgres tests have no isolation — same as the teardown row; no current outcome changes.
  - `[low]` `[reject]` (blind) `app_database` duplicates `database_path` and imports `_clear_caches` from `tests.conftest` — both share `_clear_caches`, so cache clearing cannot diverge; only two env lines repeat; the refactor is more than a direct correction.
  - `[low]` `[reject]` (blind) URL rewrite too narrow (`postgres://`, upper case, `MIGRATION_DATABASE_URL`, untested psycopg2, missing `fresh_settings`) — outside the contract; `MIGRATION_DATABASE_URL` is not in Settings yet (deploy, Epic 16); explicit `Settings(database_url=...)` overrides env, so `fresh_settings` is not needed.
  - `[low]` `[reject]` (blind) Spec is out of date (Auto Run Result says blocked, Code Map says Docker available) — fix edits this build's spec; the Auto Run Result is rewritten at finalize anyway.
  - `[medium]` `[reject]` (blind) The actionlint acceptance criterion is weakened to "GitHub accepts the workflow" — fix edits this build's spec / the orchestrator's recorded decision; recorded as orchestrator-verified-in-CI.
  - `[false]` `[reject]` (blind) The remote red-CI check has no owner — the Design Notes and the orchestrator's instruction assign it to the orchestrating session after push.
  - `[low]` `[defer]` (blind) New issues.md entries lack the log-file link and attempt 1 is still open — written by the orchestrator's log commits, not by this story's code; deferred to the orchestrating session.
  - `[low]` `[reject]` (blind) Minor CI gaps (uv cache, Playwright browser cache, redundant `uv sync`, postgres job not using an npm script) — speed only, no wrong outcome; no npm script exists for the Postgres command and the spec prescribes that command.
  - `[low]` `[patch]` (blind) README's local Postgres steps omit readiness wait and cleanup — patched: wait until `docker exec swp-pg pg_isready` succeeds; remove with `docker rm -f swp-pg`.

## Design Notes

A pytest option instead of an env var: if the CI step misspells an env var name, pytest silently runs on SQLite and the Postgres job is green while testing nothing; a misspelt option is an "unrecognized arguments" error. The dialect assertion closes the remaining gap (option given but rewritten to SQLite by mistake).

Remote proof (green run on GitHub, throwaway branch with a violation turning CI red and then deleted) needs a push, which this run must not do; it is handed to the orchestrating session.

## Verification

**Commands:**
- actionlint on `.github/workflows/ci.yml` -- **orchestrator-verified-in-CI** (not run locally): Docker pulls hang in this environment and local installs are not permitted, so do not run `docker run … rhysd/actionlint` or install actionlint here. GitHub validates the workflow on push; the orchestrating session treats GitHub accepting and running `ci.yml` as the proof.
- `npm ci` -- exit 0.
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` -- exit 0.
- `npm test` -- pytest and Vitest pass.
- `pytest tests/app --database-url postgresql://…` against Postgres 17 -- **orchestrator-verified-in-CI** (not run locally): do not attempt `docker pull`/`docker run postgres:17` or a local Postgres install. The `postgres` job in `ci.yml` runs `backend/tests/app/test_health_database.py` against a `postgres:17` service container; the orchestrating session pushes after this run and treats a green `postgres` job (and green CI overall) as the proof for the "Health on Postgres" matrix row, and starts a CI fix if it fails.
- Local substitutes for the Postgres path (cheap, run here): `uv run --directory backend --locked pytest tests/app` (SQLite, passes); `uv run --directory backend --locked pytest tests/app --database-url postgresql://u:p@localhost:1/none` -- expected to fail with `psycopg.OperationalError` (proves rewrite + psycopg driver are wired); misspelt `--databse-url` -- pytest exits 4.
- `CI=true npm run e2e -- --project=chromium` (no dev server running) -- pass.
- Temporary violation (`import sqlalchemy` in `backend/swp/domain/__init__.py`) → `npm run lint:imports` exits non-zero; revert.

## Auto Run Result

Status: done

**Summary:** `.github/workflows/ci.yml` runs on every push (and `workflow_dispatch`) with four jobs: `python` (ruff, import-linter, pytest on SQLite), `postgres` (`tests/app` against a `postgres:17` service, `--database-url` plus `SWP_EXPECT_DIALECT=postgresql`), `frontend` (ESLint, typecheck, Vitest) and `e2e` (Playwright Chromium, artifacts uploaded on failure or cancel). psycopg 3.3.9 added; `postgresql://` rewritten to `postgresql+psycopg://` (AD-9); `tests/app` selects its database with the `--database-url` pytest option.

**Unblock (run 3):** the earlier `matrix test audit failed` block (Postgres 17 test and actionlint could not run locally: Docker pulls hang behind `http.docker.internal:3128`; local installs not permitted) is resolved by the orchestrating session's decision: both checks are **orchestrator-verified-in-CI**, not passed locally. The "Health on Postgres" matrix row is satisfied by CI delegation (`test_nfr12_health_select_one_on_selected_database` in the `postgres` job); proof is a green `postgres` job and green CI overall after the orchestrator's push, plus the throwaway-branch red-CI check. No Docker pulls or local installs were attempted in this run.

**Files changed:**
- `.github/workflows/ci.yml` -- new CI workflow (4 jobs, concurrency cancels only non-`main` runs, timeouts, read-only permissions).
- `backend/pyproject.toml`, `backend/uv.lock` -- `psycopg[binary]==3.3.9`.
- `backend/.importlinter` -- psycopg/psycopg_binary forbidden in `domain-pure` and in `only-store-sqlalchemy`.
- `backend/swp/config.py` -- `postgresql://` → `postgresql+psycopg://` validator.
- `backend/tests/conftest.py` -- `--database-url` pytest option.
- `backend/tests/app/{__init__,conftest,test_health_database}.py` -- `app_database` fixture and the health-on-selected-database test with `SWP_EXPECT_DIALECT` guard.
- `backend/tests/test_config.py` -- URL rewrite tests.
- `backend/tests/rules/test_layer_rules.py` -- "app imports psycopg" violation case.
- `README.md` -- CI note and local Postgres instructions (readiness wait, cleanup).

**Review:** 29 findings (high 0, medium 6, low 15, false 8). Patches applied: 5 entries — silent-SQLite fallback in the `postgres` job (medium, 4 member rows), cancel-in-progress on `main` (low), artifact upload on cancel/timeout (low), psycopg store-only contract + test (low), README Postgres steps (low). Deferred: 1 (issues.md entry format, orchestrator-owned). Rejected with reasons in the Review Triage Log: `postgres://`/upper-case/psycopg2 URL forms (outside contract, unlikely, adds branches); no migration DDL on Postgres (none exists); stale `alembic_version`/no teardown (upgrade failure raises; idempotent write); GitHub-side evidence unproven and actionlint AC wording (forbidden push / spec edit — delegated to CI); broad store coverage (intent names the health test); extra changes (no harm); no `pull_request` trigger (intent is push); fixture duplication (shared `_clear_caches`, refactor not direct); stale spec text (spec edit); remote red-CI owner (orchestrator owns it); CI speed gaps (no wrong outcome).

**Follow-up review recommendation:** false — first pass patched 0 high and 1 medium entry (patched counts: high 0, medium 1, low 4).

**Verification (run 3, all local, all as expected):** `npm ci` exit 0; `npm run lint:py` exit 0; `npm run lint:imports` 4 kept, 0 broken; `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` 36 pytest + 5 Vitest passed; `uv run --directory backend --locked pytest tests/app` 1 passed (SQLite); same with `--database-url postgresql://u:p@localhost:1/none` → `psycopg.OperationalError` (rewrite + driver wired); misspelt `--databse-url` → exit 4; `SWP_EXPECT_DIALECT=postgresql` on SQLite → 1 failed (guard works); temporary `import sqlalchemy` in `backend/swp/domain/__init__.py` → `lint:imports` exit 1 (reverted); temporary failing test → `npm run test:py` exit 1 (removed); `CI=true npm run e2e -- --project=chromium` 3 passed; `ci.yml` parses as YAML (triggers `push`, `workflow_dispatch`; jobs `python`, `postgres`, `frontend`, `e2e`). Not run locally (orchestrator-verified-in-CI): actionlint, `tests/app` on real Postgres 17.

**Residual risks:** action tags (`checkout@v7`, `setup-node@v7`, `setup-uv@v10`, `upload-artifact@v7`) and the workflow syntax are unvalidated until GitHub runs it; the Postgres 17 path has never executed against a real server.
