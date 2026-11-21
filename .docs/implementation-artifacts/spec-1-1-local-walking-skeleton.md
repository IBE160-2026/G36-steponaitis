---
title: 'Story 1.1: Local walking skeleton'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_revision: '32a6df2927b7f3c58ada15e8b85d0adf6809ef93'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      `swp openapi` (backend/swp/cli.py) has no test; nothing consumes it until OpenAPI type generation lands.
    evidence: |-
      Verification-gap review: no test imports swp.cli for the openapi subcommand; dropping json.dump or swapping branches passes the suite. The story that first generates frontend/lib/api/schema.ts (Story 1.7) should add a test that `main(["openapi"])` emits JSON containing paths["/api/health"].
    location: >-
      backend/swp/cli.py:22-25
    severity: low
---

<intent-contract>

## Intent

**Problem:** The repo has no application code. Every later story needs a backend and frontend that start with one command, talk over one origin, and have the layer and slice rules checked from the first commit.

**Approach:** Scaffold `backend/` (uv, FastAPI, package `swp` with `domain/ app/ store/ api/`) and `frontend/` (Next.js 16 App Router) per the spine's Structural Seed and pinned Stack, a root `package.json` whose `npm install` installs both and whose `npm run dev` starts both with concurrently, a `GET /api/health` that runs `SELECT 1` on local SQLite, one page that shows the backend status, and the rule checks (ruff, import-linter, ESLint) with automated tests proving each rule rejects a violation.

## Boundaries & Constraints

**Always:**
- Exact versions from the spine's Stack table (Python 3.12, FastAPI 0.163.1, Uvicorn 0.54.0, Pydantic 2.14.3, pydantic-settings 2.16.3, SQLAlchemy 2.1.8, Alembic 1.20.1, pytest 9.2.0, httpx2 2.16.2, ruff 0.17.5, import-linter 2.16; Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.5, shadcn CLI 4.23.0 with `init -b radix`, TanStack Query 5.107.1, Vitest 5.1.0, Playwright 1.65.1, concurrently 10.0.7). Tools not in the table (eslint, eslint-config-next, @types/*) are pinned exact to versions compatible with these.
- Zero env vars locally: `DATABASE_URL` defaults to `<backend>/var/swp.db`, resolved from `config.py`'s location, `var/` created if missing. `APP_ENV` defaults to `local`; the FastAPI lifespan calls `swp.app.bootstrap.bootstrap(upgrade=True, seed=False)` only when `APP_ENV=local`.
- Only `swp.store` imports SQLAlchemy or Alembic. `swp.domain` imports only stdlib and pydantic. `swp.api` may import `swp.app` and `swp.domain`, never `swp.store`. Every router mounted under `/api`.
- Browser calls relative `/api/*` only; Next.js rewrites `/api/:path*` to `http://127.0.0.1:8000/api/:path*`. Client-side fetch with TanStack Query only. `NEXT_TELEMETRY_DISABLED=1` in dev scripts.
- Tests name an FR/NFR (SM-7). Code, UI, comments and docs in English.

**Never:**
- No `vercel.json`, no deploy, no Vercel/Supabase, no `.github/workflows` (CI is Story 1.2), no psycopg/Postgres code (Story 1.2).
- No `next/font/google`, no CDN, no runtime network calls, no AI/LLM dependency.
- No tables/migrations yet (first migration is Story 1.7), no error envelope, origin guard or `/api/session` (Story 1.7), no design tokens or app shell (Story 1.4).
- Never touch `data/sample/`, `data/answer-key/`, `data/private/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health, fresh checkout | `GET /api/health`, no `backend/var/` | `var/swp.db` created; 200 `{"status":"ok"}` | No error expected |
| Health via frontend | `GET http://localhost:3000/api/health` | Rewritten to backend; same 200 body | No error expected |
| Page, backend up | open `http://localhost:3000/` | Shows "Smart Warehouse Planner" and "Backend: ok" | No error expected |
| Page, backend down | backend not running | Shows "Backend: unreachable" | Query error rendered as text, no crash |
| Domain imports sqlalchemy / swp.store / fastapi | violating module in `swp/domain` | `lint-imports` exits non-zero | Contract names the import |
| api imports store; app/api imports sqlalchemy | violating module | `lint-imports` exits non-zero | — |
| `uuid4`, `datetime.now`, `random` used in `swp/domain` | violating code | `ruff check` exits non-zero (TID251); same code outside `swp/domain` passes | — |
| Module imports another module | `modules/a/x.ts` imports `@/modules/b/...` or `../b/...` | ESLint error `no-restricted-imports` | Own-module `@/modules/a/...` and `./` allowed |

</intent-contract>

## Code Map

Greenfield: no `backend/`, `frontend/`, root `package.json` exist (verified with `git ls-files`). Existing relevant files:

- `.gitignore` -- already ignores `node_modules/`, `.next/`, `.venv/`, `test-results/`, `playwright-report/`, `.env`/`.env.*` with `!.env.example`/`!.env.*.example`, `*.db`, `data/private/*`; lacks `backend/var/`, SQLite `-wal`/`-shm`/`-journal`, `blob-report/`, `playwright/.cache/`.
- `README.md` -- Norwegian project intro; append an English "Run locally" section, keep the rest.
- `.claude/scripts/preflight-autonom.sh` -- read-only; confirms uv, Python 3.12, Node 24 locally.
- `data/` -- read-only; not used by this story.
- `.docs/implementation-artifacts/epic-1-context.md` -- distilled epic rules (slices, layering, stack).

## Tasks & Acceptance

**Execution:**
- `backend/pyproject.toml`, `backend/.python-version`, `backend/uv.lock` -- uv project `swp`, `requires-python >=3.12,<3.13`, pinned runtime deps (fastapi, uvicorn, pydantic, pydantic-settings, sqlalchemy, alembic) and dev group (pytest, httpx2, ruff, import-linter); `[project.scripts] swp = "swp.cli:main"`; ruff config (py312, select incl. `E,F,I,B,UP,TID`); pytest config (`testpaths = ["tests"]`) -- one locked backend env.
- `backend/swp/domain/ruff.toml` -- `extend` the project config and set `flake8-tidy-imports.banned-api` for `uuid.uuid4`, `datetime.datetime.now`, `datetime.datetime.utcnow`, `datetime.date.today`, `random` -- bans scoped to the domain only (AD-1).
- `backend/.importlinter` -- contracts: layers `swp.api : swp.app : swp.store : swp.domain`; forbidden `swp.api → swp.store`; forbidden `swp.domain → swp.config|swp.cli|swp.main` and every installed third-party package except pydantic (`include_external_packages = True`); forbidden `swp.domain|swp.app|swp.api|swp.config|swp.cli|swp.main → sqlalchemy|alembic` -- AD-1/AD-9 layer rules.
- `backend/swp/__init__.py`, `swp/domain/__init__.py`, `swp/app/__init__.py`, `swp/store/__init__.py`, `swp/api/__init__.py`, `swp/api/routers/__init__.py` -- packages.
- `backend/swp/config.py` -- pydantic-settings `Settings(app_env="local", database_url=<default sqlite under backend/var>)`, cached `get_settings()`, creates `var/` when the default is used.
- `backend/swp/store/db.py` -- cached engine from settings; `ping()` runs `SELECT 1`; `backend/swp/store/migrations/` (`env.py` with `render_as_batch=True`, `script.py.mako`, empty `versions/`) and `upgrade_to_head()` running Alembic programmatically; `backend/alembic.ini` pointing at it.
- `backend/swp/app/bootstrap.py` -- `bootstrap(upgrade: bool, seed: bool)`; upgrade calls the store; seed is a no-op for now. `backend/swp/app/health.py` -- `check()` calls `store.ping()`.
- `backend/swp/api/routers/health.py`, `backend/swp/api/app.py` -- `GET /health` router included with prefix `/api`; `create_app()` with lifespan calling bootstrap when `app_env == "local"`.
- `backend/swp/main.py` -- `app = create_app()`. `backend/swp/cli.py` -- argparse: `swp db upgrade` (bootstrap upgrade) and `swp openapi` (print OpenAPI JSON).
- `backend/tests/api/test_health.py`, `backend/tests/conftest.py` -- fixture pointing `DATABASE_URL` at a tmp SQLite file and clearing caches; `test_nfr2_health_returns_ok_and_creates_sqlite_file`.
- `backend/tests/rules/test_layer_rules.py` -- `test_nfr1_domain_imports_only_stdlib_and_pydantic` (AST scan of `swp/domain` against `sys.stdlib_module_names`); `test_nfr1_ruff_bans_clock_uuid4_random_in_domain` (ruff via stdin with `--stdin-filename` inside and outside domain); `test_nfr1_import_linter_rejects_layer_violations` (copy `swp` + `.importlinter` to tmp, add each violation, assert `lint-imports` fails; clean copy passes).
- `frontend/package.json`, `tsconfig.json` (`@/*` alias), `next.config.ts` (rewrite), `postcss.config.mjs`, `app/globals.css` (Tailwind 4 + shadcn base), `components.json`, `lib/utils.ts` (from `shadcn init -b radix`), `components/ui/`, empty `components/common/`, `modules/`, `lib/` dirs kept with `.gitkeep` -- Next.js 16 scaffold. Scripts: `dev` (`NEXT_TELEMETRY_DISABLED=1 next dev -p 3000`), `build`, `lint`, `typecheck`, `test` (vitest run), `e2e`.
- `frontend/app/layout.tsx`, `app/providers.tsx` (QueryClientProvider, client), `app/page.tsx` (client; `useQuery(['health'])` on `/api/health`; renders the heading and "Backend: ok" / "Backend: unreachable" / "Checking backend…") -- the one page.
- `frontend/eslint.config.mjs` -- eslint-config-next flat config; for each directory under `modules/`, `no-restricted-imports` forbids `@/modules/*` except itself, and forbids `../*` parent-relative imports inside modules.
- `frontend/tests/module-boundaries.test.ts`, `frontend/vitest.config.ts` -- `nfr1 module may not import another module` via ESLint `lintText` with module file paths (violation → error; own module, `@/lib`, `@/components` → no error).
- `frontend/playwright.config.ts`, `frontend/e2e/skeleton.spec.ts` -- projects chromium, firefox, msedge; webServer runs the root `npm run dev` with `DATABASE_URL` pointing at `backend/var/e2e.db`, reuse when not CI; test `nfr2 walking skeleton page shows backend ok` asserts visible "Backend: ok" (no UJ covers the skeleton page); `nfr2 walking skeleton page shows backend unreachable` aborts `/api/health` with `page.route` and asserts "Backend: unreachable". Every I/O matrix row must have a passing test (health rows in pytest; the frontend rewrite row is covered by the Playwright test hitting `/api/health` through :3000 via `request.get`).
- `package.json` (root), `package-lock.json` -- npm workspace `frontend`; `engines.node` `24.x`; devDep concurrently; `postinstall`: `uv sync --directory backend --locked`; scripts `dev` (concurrently backend uvicorn `swp.main:app` on 127.0.0.1:8000 + frontend dev), `lint:py`, `lint:imports`, `lint`, `typecheck`, `test:py`, `test:web`, `test`, `e2e`.
- `.gitignore` -- add `backend/var/`, `*.db-wal`, `*.db-shm`, `*.db-journal`, `blob-report/`, `playwright/.cache/`.
- `README.md` -- English "Run locally" section: prerequisites (Node 24, uv, Python 3.12), `npm install`, `npm run dev`, URLs, and one command each for ruff, import-linter, ESLint, typecheck, tests, e2e.

**Acceptance Criteria:**
- Given a clean checkout with Node 24, uv and Python 3.12, when `npm install` then `npm run dev` run in the repo root with no env vars, then uvicorn serves :8000, Next.js serves :3000, and `curl localhost:3000/api/health` returns 200 `{"status":"ok"}` with `backend/var/swp.db` created.
- Given the browser on `http://localhost:3000/`, when the page loads, then it shows "Backend: ok" (Playwright chromium).
- Given each layer/slice rule, when a deliberate violation is introduced, then its check (ruff, `lint-imports`, ESLint) fails, proven by the automated tests above.
- Given the scaffold, when `git status --ignored` is checked after running the app and tests, then `backend/var/`, `.next/`, `node_modules/`, `.venv/`, test and Playwright outputs are ignored.
- Given the installed dependency trees, when searched for `openai|anthropic|langchain|google-generativeai|cohere|ollama`, then nothing matches (NFR-3).

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 51 findings — high 0, medium 6, low 32, false 13, maybe-false 0
- findings:
  - `[false]` `[reject]` (blind) Lockfiles `uv.lock`/`package-lock.json` missing — both exist on disk and are committed with the change; the review diff only excluded them for size.
  - `[low]` `[reject]` (blind) No CI workflow — the intent is Story 1.1; CI is Story 1.2 in the epics file, so the intent itself excludes it.
  - `[low]` `[reject]` (blind) Bare `npm run e2e` fails without Firefox/Edge — the spine mandates the three projects; README documents `--project=chromium`; gating projects adds config branches.
  - `[low]` `[reject]` (blind) `reuseExistingServer` ignores the e2e DATABASE_URL and e2e.db is never reset — no data is written yet; isolation belongs with the first story that writes plans (recorded as residual risk).
  - `[false]` `[reject]` (blind) Health has no 503 failure contract — an unhandled DB error loudly fails as 500; the error envelope is Story 1.7.
  - `[false]` `[reject]` (blind) `cn` helper from `cn@0.2.6` looks wrong — npm shows it is shadcn's own package (repo shadcn-ui/cn, "drop-in replacement for clsx + tailwind-merge") written by `shadcn init`.
  - `[low]` `[reject]` (blind) POSIX inline env in scripts breaks on Windows — development and CI target macOS/Linux; fix adds a dependency.
  - `[false]` `[reject]` (blind) README section in English / CLI not documented — project rule says docs are English; CLI is internal until later stories.
  - `[low]` `[reject]` (blind) Hard-coded third-party deny-list in `.importlinter` goes stale — the AST allow-list test fails closed on any non-stdlib/pydantic import, so a stale list cannot let a violation through.
  - `[low]` `[reject]` (blind) Relative/driver-suffixed SQLite URLs not handled in config — unlikely in everyday use; default and absolute URLs are covered.
  - `[medium]` `[patch]` (blind) `test_config.py` asserts on the real `backend/var` — grouped with verification-gap findings 2–3; rewritten to use a monkeypatched, not-yet-existing tmp dir.
  - `[false]` `[reject]` (blind) Module-boundary test mutating `modules/` breaks lint/tsc if killed — leftover dirs are empty (no files to lint or typecheck) and untracked by git.
  - `[false]` `[reject]` (blind) `../*` ban too broad — intended and recorded in Design Notes.
  - `[low]` `[patch]` (blind) `_lint_imports` drops the environment — now `{**os.environ, PYTHONPATH, PATH}`.
  - `[low]` `[patch]` (blind) `--kill-others-on-fail` leaves a half-up dev setup — switched to `--kill-others`.
  - `[low]` `[patch]` (blind) Unpinned hatchling / no `.nvmrc` — hatchling pinned to 1.33.0; `.nvmrc` rejected (engines field already states 24.x).
  - `[low]` `[reject]` (blind) `globals.css` indentation/newline — shadcn-generated, cosmetic.
  - `[low]` `[reject]` (intent) Zero-env default path not exercised end to end by tests — verified manually (`npm run dev`, curl 200, `backend/var/swp.db` created) and now unit-tested by the config patch.
  - `[low]` `[reject]` (intent) Clean `npm install` not tested — verified manually in Verify.
  - `[low]` `[reject]` (intent) Rule tests call tools directly, not via npm scripts — same configs, same binaries; scripts themselves run green in verification.
  - `[low]` `[reject]` (intent) Domain allow-list enforced by deny-list in import-linter — same as blind deny-list finding; AST test enforces the positive rule.
  - `[false]` `[reject]` (intent) `lib/` not empty, `components/ui` has only `.gitkeep` — `lib/utils.ts` is what `shadcn init -b radix` writes; init adds no UI component.
  - `[false]` `[reject]` (intent) `uv.lock` missing from patch — present and committed.
  - `[low]` `[reject]` (intent) NFR-3 asserted only by absence — verified by the grep in Verification.
  - `[false]` `[reject]` (intent) Additions beyond the AC (CLI subcommands, extra browsers, `frontend/AGENTS.md`, unreachable state) — the auditor notes none conflict; CLI and browser projects come from the spine.
  - `[medium]` `[patch]` (verification-gap) Startup migration untested — added `test_nfr2_local_startup_runs_migrations` and `test_nfr2_production_startup_does_not_migrate` (alembic_version table present/absent).
  - `[medium]` `[patch]` (verification-gap) Directory creation for SQLite never tested — added `test_nfr2_default_var_dir_is_created_when_missing` and `test_nfr2_custom_sqlite_parent_dir_is_created`.
  - `[medium]` `[patch]` (verification-gap) `test_config` satisfied in advance by real `backend/var` — same rewrite as above.
  - `[low]` `[patch]`/`[defer]` (verification-gap) CLI untested — `db upgrade` patched with `tests/test_cli.py`; `openapi` deferred to the story that generates `schema.ts`.
  - `[low]` `[patch]` (edge) `%` in DATABASE_URL breaks Alembic ConfigParser interpolation in `store/db.py` — escaped with `%%`.
  - `[low]` `[patch]` (edge) Same in `migrations/env.py` — escaped with `%%`.
  - `[low]` `[reject]` (edge) `sqlite+pysqlite:///` parent not created — unlikely; fix adds URL parsing.
  - `[false]` `[reject]` (edge) Query string / `:memory:` treated as path — `Path(...).parent` of `x.db?mode=ro` or `:memory:` is the existing directory, so nothing spurious is created.
  - `[low]` `[reject]` (edge) Unknown APP_ENV skips migrations — matches AD-9 ("only when APP_ENV=local"); a Literal would be new surface.
  - `[false]` `[reject]` (edge) Health 500 instead of 503 — same as blind finding; error contract is Story 1.7.
  - `[low]` `[reject]` (edge) AST test ignores relative imports leaving the domain — import-linter's layers contract resolves relative imports and fails on them, so the rule still holds.
  - `[low]` `[patch]` (edge) More clock/ID/randomness APIs unbanned — added `datetime.datetime.today`, `time.time`, `uuid.uuid1`, `secrets` with test snippets.
  - `[low]` `[patch]` (edge) `_lint_imports` minimal env — same patch as blind finding.
  - `[medium]` `[patch]` (edge) `./../other/x` bypasses the module-boundary rule (verified) — regex `(^|/)\.\.(/|$)` replaces the group pattern; Vitest case added.
  - `[low]` `[patch]` (edge) `.mjs/.cjs/.cts` module files not covered — glob extended.
  - `[low]` `[reject]` (edge) `modules/` absent makes ESLint config throw — `.gitkeep` is committed; guard adds a branch for an unlikely state.
  - `[false]` `[reject]` (edge) Killed test leaves fixture dirs — same as blind finding; empty dirs, no harm.
  - `[low]` `[reject]` (edge) Page shows "Backend: undefined" on odd 200 body — backend owns the body; unlikely.
  - `[low]` `[reject]` (edge) Windows inline env — same as blind finding.
  - `[low]` `[reject]` (edge) e2e.db reused between runs — same as blind finding; no data yet.
  - `[low]` `[reject]` (edge) Existing dev server reused by Playwright — same as blind finding.
  - `[low]` `[reject]` (edge) msedge project fails without Edge — same as blind finding.
  - `[low]` `[reject]` (edge) Opaque error when uv is missing — README lists uv as a prerequisite; extra check script is new surface.
  - `[low]` `[patch]` (edge) `--kill-others-on-fail` — same patch as blind finding.
  - `[false]` `[reject]` (edge, claim) Spec says `vitest.config.ts`, file is `.mts` — fix would edit this build's spec; behaviour identical.
  - `[medium]` `[patch]` (edge, claim) Spec claims parent-relative escapes are blocked but `./../` passed — same patch as the bypass finding.

## Design Notes

The module-boundary ESLint rule is built from the directory list at config load, so a new module gets the rule without editing the config. Parent-relative imports are banned inside modules so a cross-module import can only be written as `@/modules/<name>`, which the rule can see.

## Verification

**Commands:**
- `npm install` (repo root) -- expected: installs frontend workspace and runs `uv sync`; exit 0.
- `npm run lint:py` -- expected: ruff clean.
- `npm run lint:imports` -- expected: all contracts kept.
- `npm run lint` -- expected: ESLint clean.
- `npm run typecheck` -- expected: exit 0.
- `npm test` -- expected: pytest and Vitest pass.
- `npm run e2e -- --project=chromium` (equivalently `cd frontend && npx playwright test --project=chromium`) -- expected: pass.
- `npm run dev` then `curl -s -w '%{http_code}' localhost:3000/api/health` -- expected: `{"status":"ok"}200`.
- `npm ls --all | grep -Ei 'openai|anthropic|langchain|cohere|ollama'; grep -Ei 'openai|anthropic|langchain|cohere|ollama' backend/uv.lock` -- expected: no output.

## Auto Run Result

Status: done

**Summary:** Walking skeleton built: uv/FastAPI backend (`swp` with `domain/ app/ store/ api/`, `config.py`, `cli.py`, `main.py`, Alembic with no revisions), Next.js 16 frontend (shadcn radix init, TanStack Query, one page showing backend status), root npm workspace whose `npm install` also runs `uv sync` and whose `npm run dev` starts uvicorn :8000 and next :3000 via concurrently. `GET /api/health` runs `SELECT 1` on `backend/var/swp.db`. Layer and slice rules enforced by ruff (domain-scoped banned-api), import-linter (4 contracts) and ESLint `no-restricted-imports`, each proven by automated negative tests.

**Files changed:**
- `package.json`, `package-lock.json` -- root workspace, scripts, concurrently, postinstall `uv sync`.
- `.gitignore` -- `backend/var/`, SQLite `-wal/-shm/-journal`, `blob-report/`, `playwright/.cache/`.
- `README.md` -- English "Run locally" section with install, start and one command per check.
- `backend/pyproject.toml`, `uv.lock`, `.python-version`, `alembic.ini`, `.importlinter` -- pinned backend project, Alembic and layer contracts.
- `backend/swp/**` -- config, store (engine, ping, Alembic upgrade, migrations env), app (bootstrap, health), api (factory, health router), cli, main; `domain/ruff.toml` bans.
- `backend/tests/**` -- health, startup migration, config, CLI and layer-rule tests (31).
- `frontend/**` -- Next.js scaffold, page/providers/layout, rewrite, ESLint module boundaries, Vitest boundary tests (5), Playwright config and skeleton e2e (3); `frontend/AGENTS.md` is written by `next dev` itself.

**Review findings:** 51 findings. Patched 16 rows (13 distinct fixes; medium 6, low 10): config/dir-creation tests, startup-migration tests, CLI db-upgrade test, `%` escaping in Alembic config (2 places), extra domain bans, lint-imports env, ESLint `./../` bypass and extensions, `--kill-others`, hatchling pin. Deferred 1: `swp openapi` test (to the story that generates `schema.ts`). Rejected 35 with reasons in the triage log (13 false, 22 low not worth the added complexity or excluded by the intent — notably CI, which is Story 1.2).

**Follow-up review recommendation:** true. Patched by verdict: medium 6, low 10, high 0. Unverified risk: the rewritten config tests monkeypatch module globals (`VAR_DIR`, `DEFAULT_DATABASE_URL`) while `Settings`' field default was bound at import, so whether they truly exercise the default-URL branch has only been checked by the implementer, not by a reviewer.

**Verification (after patches):**
- `npm install` -- exit 0 (frontend workspace + `uv sync --locked`).
- `npm run lint:py` -- "All checks passed!".
- `npm run lint:imports` -- "Contracts: 4 kept, 0 broken.".
- `npm run lint` -- exit 0. `npm run typecheck` -- exit 0 (also with `next-env.d.ts` absent).
- `npm test` -- pytest 31 passed, Vitest 5 passed.
- `npm run e2e -- --project=chromium` -- 3 passed.
- `rm -rf backend/var; npm run dev` + `curl localhost:3000/api/health` -- `{"status":"ok"}200`, `backend/var/swp.db` created, no env vars set.
- NFR-3 grep over `npm ls --all` and `backend/uv.lock` -- no matches.
- `git status --ignored` -- `backend/var/`, `.venv/`, caches, `node_modules/`, `.next/`, test outputs ignored.

**Residual risks:**
- Firefox and msedge Playwright projects are configured but were not run (only Chromium installed; Edge is needed from Story 5.8).
- Playwright reuses an already running dev server locally (then the e2e DB setting is ignored) and never resets `backend/var/e2e.db`; harmless until a story writes plans.
- `npm install` reports 4 moderate audit advisories, not investigated.
- No `.github/workflows` yet; CI including the e2e job is Story 1.2.
