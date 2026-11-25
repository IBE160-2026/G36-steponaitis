---
title: 'Live on the public Vercel URL'
type: 'feature'
created: '2026-11-25'
status: 'done'
baseline_commit: '51cbac2647f3da9d8ac7bc29af6f5a2b39201339'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/.docs/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app runs only locally; https://g36steponaitis.vercel.app returns Vercel's `NOT_FOUND`. The repo has no `vercel.json`, the Postgres engine is not set up for Supabase's transaction pooler, the dev-only `/api` proxy in `next.config.ts` is unconditional, and nothing keeps the free Supabase database awake.

**Approach:** Make the repo deployable as one Vercel project with Services (Next.js `frontend/` + FastAPI `backend/` at `swp.main:app`, `/api/(.*)` → backend, only `main` deploys), make the runtime engine pooler-safe on Postgres, add a daily keep-alive workflow and the README deploy steps. Then the author creates the Supabase/Vercel setup, deploys `main`, and checks `/api/health` and a max-size Locations wall on the public URL.

## Boundaries & Constraints

**Always:** The browser keeps calling relative `/api/*`; FastAPI routes keep their `/api` prefix (Vercel passes the original path). Pooler settings (`NullPool`, `prepare_threshold=None`) apply to Postgres only; SQLite behaviour is unchanged. Env vars `APP_ENV=production`, `DATABASE_URL` (transaction pooler, 6543), `MIGRATION_DATABASE_URL` (session pooler, 5432), `JWT_SECRET` (generated, ≥32 bytes) and `DEMO_PASSWORD` are set for Production only. Schema changes go through a manual `uv run --directory backend --locked swp db upgrade` against `MIGRATION_DATABASE_URL` before deploying. Only synthetic `data/sample/` data goes on the deployment.

**Never:** No secrets in the repo, workflow or README (the public URL is not a secret). No `FEATURE_AUTH`/`FEATURE_DEMO` in this story (Story 16.2); login and the demo stay off. No preview deployments. No lifespan migration/seed in production. No second Vercel project unless Services fails (then stop and ask). No un-skipping of the `uj5` deploy placeholder (Story 16.2).

**Decisions:** The author performs the external steps (Supabase, Vercel project, env vars, first `swp db upgrade`, deploy) in the dashboards from the README runbook; nothing is installed or run against the accounts from this session. The spec is kept as one story (~2,200 tokens) because the parts only work together as one deploy. Because Story 16.0's startup check requires a strong `JWT_SECRET` and an explicit `DEMO_PASSWORD` in production, both are set in Vercel (Production only) in this story, with the feature flags still off; the startup check is not relaxed (author's decision 2026-11-25).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health | `GET https://g36steponaitis.vercel.app/api/health` | 200 `{"status":"ok"}` after `SELECT 1` on Supabase | DB down → existing 503 path |
| Page | `GET /` on the public URL | Next.js page from the same origin | N/A |
| Postgres engine | `DATABASE_URL=postgresql://…:6543/…` | engine uses `NullPool`, psycopg `prepare_threshold=None` | N/A |
| SQLite engine | default local URL | unchanged (pool + sqlite listener) | N/A |
| Max-size wall | 25,000-location import, open Locations wall | wall loads; session log records gzip vs uncompressed | 413 `FUNCTION_PAYLOAD_TOO_LARGE` → lower limit, update AD-18 |
| Keep-alive | daily cron or manual dispatch | `curl --fail` on `/api/health` | non-2xx fails the run (GitHub emails the owner) |

</frozen-after-approval>

## Code Map

- `backend/swp/store/db.py:35-40` -- `get_engine()` is plain `create_engine(database_url)`; add Postgres-only `poolclass=NullPool`, `connect_args={"prepare_threshold": None}`. `upgrade_to_head` (l.101) and `migrations/env.py:30` (already NullPool) stay.
- `backend/swp/config.py:19-23,33,51-64` -- `_psycopg_url` rewrite and `migration_url` fallback already exist; reuse, do not change.
- `backend/swp/api/app.py:54-58` -- `GZipMiddleware(minimum_size=1000)`, AD-18 comment (bodies < 4 MB).
- `backend/swp/api/routers/health.py:10-13` -- health route, `db.ping()` runs `SELECT 1`.
- `backend/pyproject.toml` -- `requires-python >=3.12,<3.13`, `psycopg[binary]`; `backend/.python-version` 3.12. Vercel reads pyproject/uv.lock; no requirements.txt needed.
- `frontend/next.config.ts:11-13` -- unconditional `/api/:path*` → `127.0.0.1:8000` rewrite; gate on `!process.env.VERCEL`.
- `backend/tests/app/test_nfr8_timing.py:109`, `test_layout_api.py:94` -- existing max-size size tests (gzip and uncompressed < 4 MB); reuse, do not duplicate.
- `README.md:9,59-101` -- public URL, env table (l.78-79), startup refusals (l.88-97), l.101 "Setting its Vercel environment variables is Story 16.2" (now partly 16.1).
- `.github/workflows/ci.yml` -- only workflow; style reference (pinned action versions, `permissions: contents: read`).
- `frontend/e2e/user-journeys.spec.ts:1523` -- `uj5` deploy placeholder `test.skip`; leave as is.

## Tasks & Acceptance

**Execution:**
- [x] `vercel.json` -- create: `$schema`, `services` `web` (`root: "frontend/"`, `framework: "nextjs"`) and `api` (`root: "backend/"`, `framework: "fastapi"`, `entrypoint: "swp.main:app"`, `functions` with `excludeFiles` for `tests/**` and `var/**`); `rewrites` `/api/(.*)` → `{service: "api"}`, `/(.*)` → `{service: "web"}`; `git.deploymentEnabled` `{"**": false, "main": true}` -- one origin, previews off.
- [x] `backend/swp/store/db.py` -- Postgres branch in `get_engine()` -- Supabase transaction pooler does not support pooled connections across invocations or prepared statements.
- [x] `backend/tests/` -- test (name with `nfr6`/`ad`-style ID) that a `postgresql://` URL builds an engine with `NullPool` and `prepare_threshold=None` in connect args, and SQLite keeps its pool -- covers both rows of the matrix without a live DB.
- [x] `backend/tests/` -- test that parses `vercel.json`: `/api/(.*)` goes to the service whose entrypoint is `swp.main:app`, and `deploymentEnabled` allows only `main` -- guards the routing contract.
- [x] `frontend/next.config.ts` -- apply the dev rewrite only when `process.env.VERCEL` is unset -- on Vercel the Services rewrite owns `/api`.
- [x] `.github/workflows/keep-alive.yml` -- `schedule` daily cron + `workflow_dispatch`, `permissions: contents: read`, one step `curl --fail --silent --show-error --max-time 30 https://g36steponaitis.vercel.app/api/health` -- keeps Supabase awake.
- [x] `README.md` -- "Deploy" section: Supabase project and the two pooler URLs, Vercel project import from GitHub with `vercel.json`, Production-only env vars, the manual `swp db upgrade` before a schema change (and the first time), keep-alive; fix l.101 wording -- AC 4.
- [ ] `.docs/planning-artifacts/.../ARCHITECTURE-SPINE.md` (pending the author's live check) AD-18 -- update only if the public-URL max-size check fails.

**Acceptance Criteria:**
- Given `main` deployed with the Production env vars, when the public URL is opened, then the Next.js page and `GET /api/health` (green) come from the same origin against Supabase Postgres (author-checked).
- Given the backend with `VERCEL` set and `APP_ENV` unset, when it starts, then it refuses (Story 16.0 test `test_nfr6_startup_checks.py` stays green).
- Given a max-size import on the public URL, when its Locations wall opens, then it loads, and the session log records whether the 4.5 MB limit counts gzip or uncompressed bytes (author-checked).
- Given `keep-alive.yml` on `main`, when it is dispatched by hand, then it passes against the public URL.

## Implementation Notes

- **Blocker for AC 1 (resolved 2026-11-25: author chose to set `JWT_SECRET` and `DEMO_PASSWORD` in Vercel now, flags off):** Story 16.0's startup check (`swp/app/startup.py::startup_problems`) refuses to start with `APP_ENV=production` unless `JWT_SECRET` (strong) and `DEMO_PASSWORD` are set. With only the three Production env vars this story allows, the deployed backend refuses every request, so `/api/health` cannot go green. Options: set `JWT_SECRET` and `DEMO_PASSWORD` in Vercel now (pulls part of 16.2 forward; flags stay off), or relax the check until 16.2. Not resolved here because both cross a Never/frozen boundary.
- `vercel.json` `api.functions` is keyed by `swp/main.py` (the entrypoint file relative to the service root); Vercel's docs do not say what the key is relative to for a service, so `excludeFiles` may be ignored. Harmless if so; check the function bundle size in the first build log.
- The README runbook's manual `swp db upgrade` sets `JWT_SECRET`/`DEMO_PASSWORD` in the shell only (the startup check needs them); nothing goes to Vercel or the repo.

- Verification (2026-11-25): lint, format, import-linter, ESLint, tsc clean; pytest 1192 passed, 2 skipped; Vitest 788 passed; trace OK; `tests/app` on Postgres 17 (NullPool engine) 429 passed, 3 skipped; `npm run e2e` (chromium, firefox, msedge) 453 passed, 0 failed, 0 flaky, 3 skipped (the `uj5` deploy placeholder). The e2e run preceded the review patches, which touched only README, the workflow, a test assertion and a comment.
- Author-checked ACs remain (public `/` and `/api/health`, max-size Locations wall and the gzip-vs-uncompressed finding, a manual keep-alive run): the story stays `review` until the author confirms them in a session log.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | verification-gap, edge, blind | README step 4 says production refuses to start without `MIGRATION_DATABASE_URL` | low | patch | `startup_problems` checks only `DATABASE_URL`, `JWT_SECRET`, `DEMO_PASSWORD`, `VERCEL`/`APP_ENV`; `migration_url` falls back to `DATABASE_URL`. |
| 2 | edge | Migrations through the transaction pooler when `MIGRATION_DATABASE_URL` is unset | low | reject | The README requires the session pooler URL; unset is an operator error the runbook already rules out; fix (port-based refusal) adds a guard for an undemonstrated state. |
| 3 | edge | Explicit `postgresql+psycopg2://`/asyncpg URL gets `prepare_threshold` | false | reject | Only psycopg 3 is installed; any other driver fails at import regardless of connect args. |
| 4 | edge | `postgres://` scheme skips the rewrite | low | reject | Supabase's connection strings use `postgresql://`; `_psycopg_url` is pre-existing code, unchanged here. |
| 5 | edge, blind | Keep-alive disabled after 60 days without activity; a paused project does not wake from HTTP | medium | patch | GitHub's documented scheduled-workflow rule; README step 6 now says to re-enable and restore. |
| 6 | edge, blind | Single curl attempt fails on a cold start or blip | low | patch | No `--retry`; direct correction. |
| 7 | blind | Keep-alive checks status only, not the body | low | reject | `/api/health` returns non-2xx when `SELECT 1` fails; a 2xx with another body cannot be shown to occur. |
| 8 | edge, blind | `VERCEL` set locally (`vercel dev`/exported env) drops the dev proxy; no Vitest for the gate | low | reject | Nobody runs the Vercel CLI locally (author decision: dashboards only); inverting the gate fails `npm run e2e`, dropping it is masked by `vercel.json`. |
| 9 | blind | README step 2 puts secrets in shell history | low | patch | One sentence (leading space / history setting); direct correction. |
| 10 | blind | Migrate-before-deploy order not enforced; push deploys at once | low | patch | README now says to run the upgrade before pushing a commit with a migration; a migration-shape lint is out of scope. |
| 11 | blind | Postgres engine test does not pin the psycopg driver | low | patch | `do_connect` runs before the DBAPI call; `assert engine.dialect.driver == "psycopg"` added. |
| 12 | blind | `excludeFiles`, `framework: fastapi` untested; `functions` key may resolve against the repo root | maybe-false | defer | Only the first Vercel build log settles whether `swp/main.py` is matched and the bundle excludes `tests/`/`var/`. |
| 13 | blind | Diff lacks the story's own files; human-checked ACs need `review` | false | reject | `.docs/` was excluded from the review diff on purpose; the spec exists, and step 5 keeps the story in `review` until the author confirms the live checks. |
| 14 | blind | Postgres branch applies to every Postgres URL, comment says Supabase only | low | patch | Intentional (CI's direct Postgres works with NullPool); comment corrected. |

## Design Notes

Vercel docs (Nov 2026): key is `services`; a service gets traffic only through a top-level rewrite; the backend receives the unstripped path; Python deps from `pyproject.toml`/`uv.lock`; Hobby Python max duration 300 s; response limit 4.5 MB except streamed responses, and the docs do not say whether it counts compressed bytes — hence the live check. If the frontend install fails because the npm workspace lockfile is at the repo root, set the `web` service's `installCommand` (e.g. `cd .. && npm ci --ignore-scripts`) rather than restructuring the repo.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports && npm run lint && npm run typecheck` -- expected: clean
- `npm test && npm run trace` -- expected: all pass
- `npm run e2e` -- expected: 0 failed, 0 flaky, only the 3 `uj5` placeholder skips (dev rewrite still active locally)

**Manual checks (author):**
- Public URL `/` and `/api/health` green; max-size Locations wall loads; keep-alive dispatched run is green.
