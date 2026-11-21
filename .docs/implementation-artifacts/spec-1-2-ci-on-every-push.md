---
title: 'Story 1.2: CI on every push'
type: 'chore'
created: '2026-11-21'
status: 'blocked'
baseline_revision: '97bff3c39ed85456446ae3cd0329472ca3e98826'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md'
warnings: ['oversized']
deferred: []
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

## Review Triage Log

## Design Notes

A pytest option instead of an env var: if the CI step misspells an env var name, pytest silently runs on SQLite and the Postgres job is green while testing nothing; a misspelt option is an "unrecognized arguments" error. The dialect assertion closes the remaining gap (option given but rewritten to SQLite by mistake).

Remote proof (green run on GitHub, throwaway branch with a violation turning CI red and then deleted) needs a push, which this run must not do; it is handed to the orchestrating session.

## Verification

**Commands:**
- `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color` -- expected: exit 0.
- `npm ci` -- exit 0.
- `npm run lint:py && npm run lint:imports && npm run lint && npm run typecheck` -- exit 0.
- `npm test` -- pytest and Vitest pass.
- `docker run -d --name swp-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=swp_test -p 55432:5432 postgres:17` then `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:55432/swp_test` -- pass; remove container after.
- `CI=true npm run e2e -- --project=chromium` (no dev server running) -- pass.
- Temporary violation (`import sqlalchemy` in `backend/swp/domain/__init__.py`) → `npm run lint:imports` exits non-zero; revert.

## Auto Run Result

Status: blocked
Blocking condition: matrix test audit failed — the "Health on Postgres" row is covered by `backend/tests/app/test_health_database.py::test_nfr12_health_select_one_on_selected_database` run with `--database-url postgresql://…`, but that test could not be run against a real Postgres 17. Docker Desktop hangs on every image pull (`postgres:17`, `rhysd/actionlint:latest`; no output after 120 s; daemon behind `http.docker.internal:3128`), and installing Postgres 17 or actionlint outside Docker was denied by the permission classifier. For the same reason the actionlint check in Verification did not run.

Run 2 (resume of attempt 1, baseline `97bff3c39ed85456446ae3cd0329472ca3e98826`): the implementation subagent checked the uncommitted attempt-1 changes against this spec and found them complete; no code changed in run 2. Verified locally, all passing: `npm ci`; `npm run lint:py`; `npm run lint:imports` (4 kept); `npm run lint`; `npm run typecheck`; `npm test` (35 pytest + 5 Vitest); `uv run --directory backend --locked pytest tests/app` on SQLite (1 passed); `CI=true npm run e2e -- --project=chromium` (3 passed); temporary `import sqlalchemy` in `swp/domain/__init__.py` → `lint:imports` exit 1 (reverted); misspelt `--databse-url` → pytest exit 4; `--database-url postgresql://u:p@localhost:1/none` → `psycopg.OperationalError` (rewrite and psycopg driver are wired). `ci.yml` parses as YAML with triggers `push`, `workflow_dispatch` and jobs `python`, `postgres`, `frontend`, `e2e`.

To unblock: make Docker pulls work (or allow a local Postgres 17 + actionlint), then run the two Docker commands in Verification; or push and treat a green `postgres` job on GitHub (plus GitHub accepting the workflow) as the proof, then resume at the review step. Hung `docker run` clients from attempt 1 (PIDs 56502, 57417) were killed. Review has not run.
