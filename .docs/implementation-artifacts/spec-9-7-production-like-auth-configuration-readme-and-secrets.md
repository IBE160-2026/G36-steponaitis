---
title: 'Story 9.7: Production-like auth configuration, README and secrets'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '7436bbed2bff13e561aa4aa138bd6b447208c38f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      An invalid setting (e.g. a DEMO_PASSWORD the Log in form would refuse, MAX_PLANS<=0) raises a pydantic ValidationError traceback instead of a "Refusing to start" line, and the traceback echoes the input value.
    evidence: |-
      swp/config.py's demo_password validator (Story 9.5) raises ValueError inside Settings(); check_startup() calls get_settings() without catching ValidationError, so uvicorn and `swp db upgrade` print pydantic's error with input_value. Pre-existing since 9.5; only the presentation is affected (the process still refuses to start).
    location: >-
      backend/swp/app/startup.py:63; backend/swp/config.py (demo_password validator)
    severity: low
  - summary: >-
      AGENTS.md "Running and verifying" does not mention `npm run e2e:production` (open retro items epic-5 47 / epic-8 73 about the documented e2e gate).
    evidence: |-
      The diff adds e2e:production to package.json, README and CI but leaves AGENTS.md unchanged; editing agent-context files is deferred by the review rules.
    location: >-
      AGENTS.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** With `APP_ENV=production` the backend still starts on the committed default `JWT_SECRET` (forgeable sessions, deferred from 9.1), `swp db upgrade` silently seeds `demo`/`demo` wherever `DEMO_PASSWORD` is unset (deferred from 9.5), there is no `.env.example`, the English README does not explain accounts, secrets or the public demo, and the demo front page has only been e2e-tested with `feature_demo` faked in the browser (deferred from 9.6) (AD-10, NFR-2, NFR-4, NFR-5, NFR-6, FR-40, FR-50).

**Approach:** One startup check in `swp.app` that `create_app()` and `swp db upgrade` run before anything else, refusing production misconfiguration with one clear log line per problem; `MIGRATION_DATABASE_URL` support for `swp db upgrade` (AD-9); `backend/.env.example` with placeholders only plus a test that it lists every setting; a README section in English; and a second Playwright config that builds and starts the app production-like (`APP_ENV=production`, both flags on, throwaway secrets) and walks UJ-5 with the real `FEATURE_DEMO` flag, also run in CI.

## Boundaries & Constraints

**Always:**
- `swp/app/startup.py` (new): `startup_problems(settings: Settings, environ: Mapping[str, str]) -> list[str]` (pure, order fixed) and `check_startup(environ=os.environ) -> None`, which logs each problem on logger `swp.startup` at ERROR as `Refusing to start: <problem>` and raises `StartupRefused(RuntimeError)` (message = problems joined by `; `). "Set" means the field is in `settings.model_fields_set` (pydantic-settings puts env-sourced fields there; verified). Problems:
  1. `VERCEL` non-empty in `environ` and `app_env` not set → "VERCEL is set but APP_ENV is not. Set APP_ENV=production."
  2. `app_env` not in `{"local", "production"}` → "APP_ENV must be local or production."
  3. production and `jwt_secret` empty, equal to `DEFAULT_JWT_SECRET`, equal to `JWT_SECRET_PLACEHOLDER` (the `.env.example` value, a constant in `swp/config.py`), or shorter than 32 UTF-8 bytes → "JWT_SECRET is empty, a committed default or shorter than 32 bytes. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\"". The message never contains the secret.
  4. production and `demo_password` not set → "DEMO_PASSWORD is not set. Choose the demo account's password explicitly."
  5. production and `database_url` not set → "DATABASE_URL is not set. Production needs its own database."
- `swp/api/app.py` `create_app()`: `configure_logging()` then `check_startup()` before building the app (uvicorn import of `swp.main` fails, so the process exits). `swp/cli.py` `db upgrade`: `check_startup()` first; on `StartupRefused` print each problem to stderr as `swp: refusing to start: <problem>` and return exit code 2 without migrating or seeding. `swp openapi` runs no check.
- `swp/config.py`: `migration_database_url: str | None = None` (env `MIGRATION_DATABASE_URL`) with the same `postgresql://` → `postgresql+psycopg://` rewrite; `swp/store/db.py` `upgrade_to_head()` gives Alembic `migration_database_url or database_url`. The app engine still uses `database_url`. Add `JWT_SECRET_PLACEHOLDER`. Update the `jwt_secret` comment (the check now exists).
- `backend/.env.example` (new): a header comment (placeholders only, never commit a real value, copy to `backend/.env` which git ignores, export before starting; `VERCEL` is set by the platform). Active lines safe for a local auth run: `APP_ENV=local`, `FEATURE_AUTH=true`, `FEATURE_DEMO=false`, `DEMO_PASSWORD=demo`. Commented lines with placeholders for the rest: `# DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres`, `# MIGRATION_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres`, `# JWT_SECRET=<JWT_SECRET_PLACEHOLDER>`, `# MAX_UPLOAD_BYTES=4000000`, `# MAX_ROWS_PER_FILE=25000`, `# MAX_PLANS=50`, `# MAX_ACCOUNTS=200`, each with a one-line comment. The frontend reads no env var (flags come from `GET /api/session`), so no frontend example file; the README says so.
- README (`README.md`): a new English section "Accounts, secrets and the public demo" after *Run locally* (keep the Norwegian sections and the existing paragraph's meaning; move or reword it there): a local run with `FEATURE_AUTH` on (`FEATURE_AUTH=true npm run dev`, or copy `backend/.env.example` to `backend/.env`, then `set -a; . backend/.env; set +a; npm run dev`); the demo account `demo`/`demo`; a table of every variable from `.env.example` with purpose and default; the production checks (the five problems) and how to generate `JWT_SECRET`; that `swp db upgrade` uses `MIGRATION_DATABASE_URL` when set; the production-like local run `npm run e2e:production`; that the public deployment https://g36steponaitis.vercel.app holds synthetic data only (from `data/sample/`) and setting the Vercel variables is Story 16.2. Add `npm run e2e:production` to the Checks table.
- Production-like e2e: `frontend/playwright.production.config.ts` (new): `testDir: "./e2e/production"`, chromium project only, same `use`/reporter/retries as the main config, no `globalSetup`, `webServer` = `npm run e2e:serve` (cwd repo root, URL `http://localhost:3000/api/health`, `reuseExistingServer: false` so a running non-demo server is never reused, same timeout) with env `DATABASE_URL` (the same `backend/var/e2e.db`, reset by `e2e:backend`), `NEXT_TELEMETRY_DISABLED=1`, `APP_ENV=production`, `FEATURE_AUTH=true`, `FEATURE_DEMO=true`, `JWT_SECRET` = `randomBytes(48).toString("base64url")` and `DEMO_PASSWORD` = a random hex string, both generated per run in the config (throwaway, never written to disk). `frontend/playwright.config.ts`: `testIgnore: "production/**"`. Root `package.json`: `"e2e:production": "npm run e2e --workspace frontend -- --config=playwright.production.config.ts"`. `.github/workflows/ci.yml` e2e job: a step `npm run e2e:production` after the chromium run (the existing failure upload already covers its reports).
- `frontend/e2e/production/demo-front-page.spec.ts` (new): imports `test`/`expect` from `../support/test`, logged out (`test.use({ storageState: { cookies: [], origins: [] } })`), no `page.route` at all. `fr50 nfr5 uj5 the production-like build shows the front page, Demo version opens the saved-plans list as demo, and Log out returns to the front page`: `GET /api/session` (via `page.request`) has `feature_auth` and `feature_demo` true; `/` shows the h1 "Every move comes with a reason."; hero Demo version → `/plans`, "Saved plans" h1, avatar "DE"; avatar menu Log out → `/` with the h1 and no avatar. A second test `nfr6 uj5 the session cookie is Secure in the production-like build`: after Demo version, the `swp_session` cookie in `context.cookies()` has `secure: true` and `httpOnly: true`.
- Tests name their FR/NFR: backend `tests/app/test_nfr6_startup_checks.py` (new) and additions to `tests/test_cli.py` and `tests/test_config.py`.

**Never:** no deployment, Vercel CLI, Vercel/Supabase contact or external account; no real secret anywhere (tests and Playwright generate throwaway values); no `NEXT_PUBLIC_*` vars or frontend env reading; no change to how auth, the guard, the front page or the seed behave when the checks pass; no `FEATURE_DEMO` in the main Playwright config; no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs or `.logs/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Local default | no env vars | starts, migrates, seeds `demo`/`demo` | — |
| Production, all set | `APP_ENV=production`, 48-byte `JWT_SECRET`, `DEMO_PASSWORD`, `DATABASE_URL` | starts; lifespan does not migrate | — |
| Default secret | production, `JWT_SECRET` unset | refuses | log `Refusing to start: JWT_SECRET ...`, `StartupRefused` |
| Empty / placeholder / short secret | production, `JWT_SECRET=""`, the example placeholder, or 31 bytes | refuses | same line, secret not printed |
| Vercel without APP_ENV | `VERCEL=1`, `APP_ENV` unset | refuses | `VERCEL is set but APP_ENV is not ...` |
| Vercel with APP_ENV | `VERCEL=1`, `APP_ENV=production`, rest set | starts | — |
| Unknown APP_ENV | `APP_ENV=prod` | refuses | `APP_ENV must be local or production.` |
| Demo password unset | production, `DEMO_PASSWORD` unset | refuses; `swp db upgrade` exits 2 and creates no `demo` row | stderr line |
| Database URL unset | production, `DATABASE_URL` unset | refuses | log line |
| Several problems | production, nothing set | one log line per problem | `StartupRefused` lists all |
| Migration URL | `MIGRATION_DATABASE_URL` set | `swp db upgrade` migrates that database; the app engine uses `DATABASE_URL` | — |

</intent-contract>

## Code Map

- `backend/swp/config.py` -- `Settings` (`app_env`, `database_url`, `jwt_secret` = `DEFAULT_JWT_SECRET`, `demo_password` default `"demo"` with a validator, limits, flags); `_use_psycopg_driver` validator to reuse for the migration URL; `get_settings()` lru_cache (tests call `get_settings.cache_clear()`).
- `backend/swp/api/app.py:31-48` -- `lifespan` bootstraps only when `app_env == "local"`; `create_app()` calls `configure_logging()` (from `swp/api/request_log.py`, `swp` logger → stdout) — the check goes right after it.
- `backend/swp/cli.py` -- `main(argv)`; `db upgrade` → `bootstrap(upgrade=True, seed=True)`.
- `backend/swp/app/bootstrap.py` -- only migrate/seed path; unchanged.
- `backend/swp/app/auth/__init__.py:55,150-167` -- `cookie_secure()` (production), `seed_demo_account` (reads `demo_password`); unchanged.
- `backend/swp/store/db.py:73-83` -- `upgrade_to_head()` sets `sqlalchemy.url` from `database_url` (escape `%`).
- `backend/.importlinter` -- `swp.app.startup` sits in the `app` layer; it may import `swp.config` (already used by app). No new third-party dependency.
- Tests to keep green that now meet the check: `tests/app/test_login.py:88-96,232-241`, `tests/app/test_signup.py:126-135`, `tests/api/test_health.py:38-46`, `tests/app/test_fr50_demo_account.py:150-158` set `APP_ENV=production` with no secret — they must also set a throwaway `JWT_SECRET` (e.g. `secrets.token_urlsafe(48)`), `DEMO_PASSWORD` and `DATABASE_URL` (already set by fixtures via env, so in `model_fields_set`). Offer one shared helper (e.g. `production_env(monkeypatch)` in `tests/conftest.py`) and use it in all five.
- `backend/tests/conftest.py` -- `database_path` fixture, `_clear_caches()`; `backend/tests/app/conftest.py` -- `app_database`, `empty_tables`; `backend/tests/test_cli.py`, `backend/tests/test_config.py` (`fresh_settings`).
- `frontend/playwright.config.ts` -- main config (webServer `npm run e2e:serve`, `FEATURE_AUTH=true`, `reuseExistingServer: !CI`); `frontend/e2e/support/test.ts` -- shared `test`/`expect`, logged-out opt-out; `frontend/e2e/front-page.spec.ts` -- locators to mirror (hero `getByRole("main")`, avatar `banner` → button "User menu", menu item "Log out").
- `package.json` (root) -- `e2e:serve`, `e2e:backend` (`e2e:reset-db`, `swp db upgrade`, uvicorn 4 workers), `e2e`.
- `.github/workflows/ci.yml` -- `e2e` job.
- `README.md` -- Norwegian intro sections, English *Run locally* with the `FEATURE_AUTH=true` paragraph, Checks table, *Milestone 1 demo*.
- `.gitignore` -- already ignores `.env`/`.env.*` and keeps `.env.example`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/config.py` -- `JWT_SECRET_PLACEHOLDER`, `migration_database_url` with the psycopg rewrite, comment update.
- `backend/swp/store/db.py` -- migrations use `migration_database_url or database_url`.
- `backend/swp/app/startup.py` (new) -- `startup_problems`, `check_startup`, `StartupRefused`.
- `backend/swp/api/app.py`, `backend/swp/cli.py` -- run the check as above.
- `backend/tests/conftest.py` + the five production tests -- shared throwaway production env helper.
- `backend/tests/app/test_nfr6_startup_checks.py` (new) -- one test per matrix row: `startup_problems` cases; `create_app()` raising `StartupRefused` with the `Refusing to start:` record in `caplog` and the secret absent from the log; production with everything set starts (`TestClient(create_app())` health 200). Names: `test_nfr6_production_refuses_default_jwt_secret`, `..._empty_jwt_secret`, `..._placeholder_jwt_secret`, `..._short_jwt_secret`, `test_nfr6_vercel_without_app_env_refuses`, `test_nfr6_vercel_with_production_app_env_starts`, `test_nfr6_unknown_app_env_refuses`, `test_nfr6_production_refuses_unset_demo_password`, `test_nfr6_production_refuses_unset_database_url`, `test_nfr6_every_problem_logged`, `test_nfr6_local_needs_no_env`.
- `backend/tests/test_cli.py` -- `test_fr50_cli_db_upgrade_refuses_production_without_demo_password` (exit 2, stderr line, no tables or no `demo` row); `test_nfr6_cli_db_upgrade_uses_migration_database_url` (two SQLite files: migration file gets the tables).
- `backend/tests/test_config.py` -- `test_nfr6_env_example_lists_every_setting` (every `Settings` field name upper-cased appears as `NAME=` or `# NAME=` in `backend/.env.example`, and nothing else), `test_nfr6_env_example_holds_no_secret` (its JWT_SECRET is `JWT_SECRET_PLACEHOLDER`, and production with the example's values set is refused), `test_nfr6_migration_database_url_uses_psycopg`.
- `backend/.env.example` (new), `README.md` -- as above.
- `frontend/playwright.production.config.ts` (new), `frontend/playwright.config.ts`, `package.json`, `.github/workflows/ci.yml` -- production-like run.
- `frontend/e2e/production/demo-front-page.spec.ts` (new) -- UJ-5 with the real flag.
- `frontend/eslint.config.mjs` / `frontend/tsconfig.json` -- only if the new config or folder is not already covered.

**Acceptance Criteria:**
- Given `APP_ENV=production`, when the backend starts with an empty or default `JWT_SECRET`, or with `VERCEL` set and `APP_ENV` unset, then it refuses to start with a clear log line, and a test covers each case.
- Given the repo, then `backend/.env.example` lists every setting with placeholder values only, a test enforces it, and no real secret is committed.
- Given the README, when an examiner reads it, then it explains the env vars for a local run with `FEATURE_AUTH` on, lists `demo`/`demo`, states that the public deployment holds synthetic data only, and links https://g36steponaitis.vercel.app.
- Given `npm run e2e:production` (next build plus the backend, `APP_ENV=production`, both flags on, throwaway `JWT_SECRET`), when Playwright opens `/`, then the front page shows, Demo version opens the saved-plans list as `demo`, the avatar reads "DE", and Log out returns to the front page — with no browser-side flag rewrite.
- Given the full suites, then ruff (check and format), import-linter, pytest (SQLite, and `tests/app` on Postgres 17), ESLint, typecheck, Vitest, `npm run e2e -- --project=chromium` and `npm run e2e:production` pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 29 findings — high 0, medium 5, low 20, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` Verification: Alembic `env.py` fallback to `MIGRATION_DATABASE_URL` has no test — grouped with Blind "rule written twice": patched with one `Settings.migration_url` property used by `db.py` and `env.py`, so the untested branch shares the tested rule; a plain `alembic` CLI test stays out (undocumented path).
  - `[low]` `[patch]` Verification (other): with `MIGRATION_DATABASE_URL` set, ping and the demo seed use `DATABASE_URL` while Alembic migrates the other URL — patched: README table, README paragraph and `.env.example` say both must name the same database (only the connection differs).
  - `[medium]` `[patch]` Blind: `DEMO_PASSWORD=demo` from `.env.example` passes the production "set" check — patched: `APP_ENV`, `FEATURE_DEMO`, `DEMO_PASSWORD` commented out in `.env.example` (only `FEATURE_AUTH=true` active); `test_nfr6_env_example_holds_no_secret` exports only active lines and asserts `WEAK_JWT_SECRET` and `DEMO_PASSWORD_UNSET`.
  - `[medium]` `[patch]` Blind: active example lines make `APP_ENV` "set" (silencing the VERCEL check) and `FEATURE_AUTH=true` contradicts "(default false)" — same root cause and patch as the row above.
  - `[low]` `[reject]` Blind: `VERCEL` with an explicit `APP_ENV=local` passes — AD-10 pins the rule as "VERCEL set and APP_ENV not"; after the patch the example no longer exports `APP_ENV`, so only a deliberate `local` on Vercel reaches it.
  - `[low]` `[reject]` Blind: `DATABASE_URL=""` or a SQLite URL counts as a production database — an empty URL fails loudly at engine creation; SQLite in production is what the local production-like e2e uses on purpose.
  - `[low]` `[reject]` Blind: a refused `swp db upgrade` prints each problem twice (logger last-resort handler plus the CLI line) — only on a misconfigured production upgrade; removing it means configuring logging in the CLI.
  - `[low]` `[patch]` Blind: `MIGRATION_DATABASE_URL` splits ping/seed and migration across two URLs — same root cause and patch as the Verification (other) row.
  - `[low]` `[patch]` Blind: `migration_database_url or database_url` written twice — patched with `Settings.migration_url`.
  - `[low]` `[reject]` Blind: missing tests for `swp openapi` under refused settings, multi-problem CLI refusal and direct `alembic` — `swp openapi` runs in CI with no env; `check_startup` multi-problem output is tested through `create_app`; the CLI shares the same function.
  - `[low]` `[patch]` Blind: README lead-in "With APP_ENV=production … refuses when" contradicts checks 1–2 — patched: "The backend (and `swp db upgrade`) refuses to start … when:", checks 3–5 marked "in production".
  - `[false]` `[reject]` Blind: production e2e specs flaky because one logs out the shared `demo` account in parallel — sessions are stateless JWT cookies per browser context; logout only clears that context's cookie, and `demo_login` never touches `login_attempts`.
  - `[low]` `[patch]` Blind: the Secure-cookie test relies on Chromium treating localhost as secure, uncommented — patched: comment in the spec naming why the config is Chromium only.
  - `[false]` `[reject]` Blind: the story spec is not in the diff — by design, the spec goes only to the edge-case layer.
  - `[medium]` `[patch]` Edge: `DEMO_PASSWORD=demo` from the example starts production — same root cause and patch as the Blind `.env.example` rows.
  - `[low]` `[reject]` Edge: `DATABASE_URL` empty or explicitly the default SQLite path passes — same as the Blind `DATABASE_URL` row.
  - `[low]` `[reject]` Edge: `VERCEL` with `APP_ENV=local` or `VERCEL=""` — same as the Blind VERCEL row; the platform sets `VERCEL=1`.
  - `[low]` `[defer]` Edge: a pydantic `ValidationError` (bad `DEMO_PASSWORD`, `MAX_PLANS<=0`) gives a traceback echoing the input, not a "Refusing to start" line — pre-existing since 9.5's validator; deferred.
  - `[low]` `[patch]` Edge: `MIGRATION_DATABASE_URL` naming a different database — same root cause and patch as the Verification (other) row.
  - `[low]` `[reject]` Edge: a 32-byte whitespace or one-character `JWT_SECRET` passes — needs an operator to choose a deliberately silly secret; an entropy rule adds branches.
  - `[medium]` `[patch]` Edge (claim): operator following README/.env.example still gets `demo`/`demo` in production — same patch as the Blind `.env.example` rows.
  - `[medium]` `[patch]` Edge (claim): `.env.example` active lines are working values, not placeholders — same patch.
  - `[false]` `[reject]` Intent: "refuses to start" is only tested in-process — `swp/main.py` calls `create_app()` at import, so `StartupRefused` aborts the uvicorn import; the production-like e2e also runs the passing path through the real `swp db upgrade` and uvicorn.
  - `[low]` `[reject]` Intent: five checks instead of the two the AC names — the spec chose the broad reading (AD-10 plus review T2-3/T3-4); each has its own test and no local default changes.
  - `[low]` `[reject]` Intent: the 9.5 deferral is closed only for `APP_ENV=production` — a local install must keep seeding `demo`/`demo` (FR-50, README); production is the only place the deferral named a risk.
  - `[false]` `[reject]` Intent: the earlier faked front-page specs stay faked — the real flag runs in `e2e:production` (and CI); the faked specs keep the main suite off the 50-plan demo cap.
  - `[low]` `[reject]` Intent: `MIGRATION_DATABASE_URL` behaviour is an addition — AD-9 binds it and the AC lists it among the variables Story 16.2 sets; listing it in `.env.example` without honouring it would mislead.
  - `[low]` `[reject]` Intent: README `demo`/`demo` vs required `DEMO_PASSWORD` in production — the README's `demo`/`demo` is for a local install; Story 16.2 chooses the public value; Demo version needs no password.
  - `[low]` `[defer]` Intent: AGENTS.md does not document `e2e:production` (retro items epic-5 47 / epic-8 73) — agent-context file; deferred.

## Design Notes

"Set" via `model_fields_set` keeps `Settings` defaults (local runs need zero env vars, NFR-2) while production must choose each value deliberately. Requiring `DEMO_PASSWORD` in production closes 9.5's deferral without changing the local `demo`/`demo` seed: on the public demo the operator may still choose `demo`, but never by accident on some other database. Refusing `DATABASE_URL` unset in production follows review T2-3 (a production backend must never fall back to a local SQLite file). The production-like e2e reuses `e2e:serve` and `backend/var/e2e.db` (reset on start) because both configs bind ports 3000/8000 and never run at once; `reuseExistingServer: false` stops a running local-install server from faking the result. Secure cookies work on `http://localhost` in Chromium (localhost is a secure context).

Retro items checked: none of the open items names `config.py`, `cli.py`, `create_app`, the README's auth section or the Playwright configs. Epic-5 item 47 / epic-8 item 73 (AGENTS.md three-browser gate) stay open: this story adds `e2e:production` to the README but does not decide the milestone gate.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass.
- `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:55432/swp_test` (local `postgres:17` container, as in the README) -- expected: all pass.
- `npm run lint && npm run typecheck && npm run test:web` -- expected: clean, all pass.
- `npm run e2e -- --project=chromium` -- expected: all pass (production folder ignored).
- `npm run e2e:production` -- expected: both tests pass.
- `git grep -nE "JWT_SECRET=|DEMO_PASSWORD=" -- ':!*.md'` -- expected: only placeholders, `demo`, and test-generated values.

## Auto Run Result

Status: done

**Summary:** Production-like auth configuration (AD-10, NFR-2, NFR-4, NFR-5, NFR-6, FR-40, FR-50). A startup check (`swp/app/startup.py`) runs in `create_app()` and `swp db upgrade` and refuses, with one `Refusing to start: …` log line per problem: `VERCEL` set without `APP_ENV`, an unknown `APP_ENV`, and in production an empty/default/placeholder/short `JWT_SECRET`, an unset `DEMO_PASSWORD` or an unset `DATABASE_URL` (closes the 9.1 and 9.5 deferrals). `swp db upgrade` migrates `MIGRATION_DATABASE_URL` when set (AD-9). `backend/.env.example` lists every setting with placeholders only (test-enforced). The README has a new English section "Accounts, secrets and the public demo". `npm run e2e:production` (new Playwright config, also in CI) builds and starts the app with `APP_ENV=production`, both flags on and throwaway secrets, and walks UJ-5 with the real `FEATURE_DEMO` flag (closes the 9.6 deferral).

**Files changed:**
- `backend/swp/app/startup.py` (new) -- `startup_problems`, `check_startup`, `StartupRefused`.
- `backend/swp/api/app.py`, `backend/swp/cli.py` -- run the check (`swp openapi` skips it via `create_app(check_settings=False)`; refused `db upgrade` exits 2).
- `backend/swp/config.py`, `backend/swp/store/db.py`, `backend/swp/store/migrations/env.py` -- `JWT_SECRET_PLACEHOLDER`, `migration_database_url`, `Settings.migration_url`.
- `backend/.env.example` (new), `README.md` -- variables, local auth run, `demo`/`demo`, production checks, synthetic-data-only public URL.
- `backend/tests/conftest.py`, `tests/app/test_nfr6_startup_checks.py` (new), `tests/test_cli.py`, `tests/test_config.py`, and five production tests -- coverage and a throwaway `production_env` helper.
- `frontend/playwright.production.config.ts`, `frontend/e2e/production/demo-front-page.spec.ts` (new), `frontend/playwright.config.ts`, `package.json`, `.github/workflows/ci.yml` -- production-like e2e.

**Review findings:** 29 (high 0, medium 5, low 20, false 4). Patches applied: 5 entries (1 medium: `.env.example` exported `APP_ENV`/`DEMO_PASSWORD=demo` as "set"; 4 low: shared `migration_url`, same-database note, README lead-in, Chromium-localhost comment). Deferred: 2 (pydantic ValidationError traceback instead of a refusal line, pre-existing; AGENTS.md lacks `e2e:production`). Rejected: 15 -- see the Review Triage Log (VERCEL with explicit `local` per AD-10 wording; empty/SQLite `DATABASE_URL`; duplicate CLI stderr line; extra CLI tests; weak-but-long secrets; intent-audit scope readings; 4 false).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 1, low 4.

**Verification (after the review patches):**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` -- 887 passed, 2 skipped.
- `pytest tests/app --database-url postgresql://…@localhost:55432/swp_test` (local `postgres:17` container, removed afterwards) -- 295 passed, 3 skipped.
- `npm run lint`, `npm run typecheck` -- clean; `npm run test:web` -- 458 passed.
- `npm run e2e -- --project=chromium` -- 102 passed.
- `npm run e2e:production` -- 2 passed (fresh `next build` + `next start`, `swp db upgrade` and uvicorn under `APP_ENV=production`, confirmed with `DEBUG=pw:webserver`).
- `git grep -nE "JWT_SECRET=|DEMO_PASSWORD="` -- only commented placeholders/defaults and test-generated or existing dummy values.

**Residual risks:** a refused `swp db upgrade` prints each problem twice on stderr; `VERCEL` with an explicit `APP_ENV=local` is not refused (AD-10 wording); migration and seed must target the same database (documented, not enforced); the production-like run is Chromium only; Vercel/Supabase variables remain Story 16.2.
