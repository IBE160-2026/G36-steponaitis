---
title: 'Story 1.7: Create and store a plan from three files'
type: 'feature'
created: '2026-11-21'
baseline_revision: '65e59d48cd738b151155149ded6533a6d249af66'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 1.5/1.6 can read, check and normalize the three exports, but nothing stores them: there are no tables, no `POST /api/plans`, no AD-11 error envelope, no same-origin guard, no `GET /api/session` and no generated TypeScript API types, so Story 1.8 (New Plan screen) has nothing to call (FR-1, FR-11, FR-18, AD-4, AD-9, AD-11, AD-13, AD-18, AD-19).

**Approach:** Add the first Alembic migration (`imports`, `plans`) with store models and a repository that saves import + plan in one transaction; the kernel documents `PlanState` (with upcaster chain) and `Analysis` (settings snapshot + period); `app.plans.create` as the only creation path reading `backend/settings/analysis.toml`; the shared API pieces (errors, origin guard, request log, upload-size limit); `POST /api/plans` and `GET /api/session`; and `swp openapi` → `openapi-typescript` → `frontend/lib/api/schema.ts` with a CI diff check. No UI (Story 1.8).

## Boundaries & Constraints

**Always:**
- Migration `0001` creates only `imports` (`id` Uuid PK, `uploaded_at` UtcDateTime NOT NULL, `data_as_of` Date NOT NULL, `data` JSON NOT NULL) and `plans` (`id` Uuid PK, `name` String NOT NULL, `import_id` Uuid FK → `imports.id` `ON DELETE RESTRICT` NOT NULL, `created_by` String NOT NULL, `created_at` UtcDateTime NOT NULL, `last_edited_by` String NOT NULL, `last_edited_at` UtcDateTime NOT NULL, `version` Integer NOT NULL, `analysis` JSON NOT NULL, `state` JSON NOT NULL). Portable types only; `UtcDateTime` returns aware UTC on SQLite and Postgres. SQLite connections enable `PRAGMA foreign_keys=ON`.
- JSON columns are written only as `model_dump(mode="json")` of `ImportData`, `Analysis`, `PlanState`; the store upcasts `state`/`analysis`/`data` through `domain/state_migrations.py` on read.
- `PlanState` (`domain/state.py`): `schema_version: int = 1`, `best_marks` (list of `{kind:"aisle",aisle}` | `{kind:"level",level,aisle: str|None}` | `{kind:"location",location}`, discriminated by `kind`), `keep_marks: list[str]`, `runs: list[dict[str, object]]`, `steps: list[dict[str, object]]`, `next_move_number: int = 1`, `recent_commands: list[dict[str, object]]` — all defaulting empty; `PlanState.new()` is the only constructor used by app code.
- `AnalysisSettings` (domain): `period_months`, `fast_min_picks`, `medium_min_picks`, `slow_min_picks`, `pick_group_min_shared_jobs`, all positive ints with `fast > medium > slow`. `backend/settings/analysis.toml` holds 12, 24, 6, 1, 5 (the answer-key values). `Analysis`: `schema_version: int = 1`, `settings`, `period_start`, `period_end`, `parts: dict[str, PartAnalysis] = {}` (`picks: int`, `movement_class: fast|medium|slow|dead`), `pick_groups: list[PickGroup] = []` (`part_a`, `part_b`, `shared_jobs`) — empty until Epic 2.
- Period (glossary): `period_end = data_as_of`; `period_start` = the day after the same date `period_months` earlier (day clamped to month end). 2026-09-30 → 2025-10-01; 2024-02-29 with 12 → 2023-03-01.
- `app.plans.create(name, imported, *, now, user="planner", settings=None)` is the only creation path: settings default to `load_analysis_settings()` (reads the toml with `tomllib`), builds `Analysis`, `PlanState.new()`, new uuid4 ids, `uploaded_at = created_at = last_edited_at = now`, `created_by = last_edited_by = user`, `version = 1`, and stores import + plan in one transaction.
- `POST /api/plans`: multipart fields `name`, `locations`, `inventory`, `transactions`. Name trimmed; blank → 422 `validation_failed`, message and detail `{field:"name", message:"Give the plan a name."}`. Success → 201 `{id, name, import_id, data_as_of, uploaded_at, version}` (`uploaded_at` ISO 8601 with `Z`).
- Upload limit: for `POST /api/plans`, a `Content-Length` over `max_upload_bytes`, or a streamed body that grows past it, is answered 413 `limit_reached` before the form is parsed, message `"The files are larger than 4 MB together. One New Plan can upload at most 4 MB."` (MB = bytes / 1,000,000, formatted without trailing `.0`). Row limit keeps the 1.5 message via `row_limit_reached`.
- `GET /api/session` → `{user: null, feature_auth, feature_demo, max_upload_bytes}`; flags come from new `config.Settings` fields `feature_auth: bool = False`, `feature_demo: bool = False`.
- Errors (`swp/api/errors.py`): every error response is `{"error": {code, message, details}}`. `DomainError` → status from the AD-11 table (`import_invalid` 422, `validation_failed` 422, `plan_not_found` 404, `not_found` 404, `limit_reached` 413, `forbidden_origin` 403, `internal` 500, …). FastAPI `RequestValidationError` → `validation_failed` with details `[{field: last loc part, message}]`. Starlette HTTP 404/405 → `not_found` ("Not found."); other 4xx → `validation_failed`; any other exception → `internal` 500 ("Something went wrong. Try again.") with the traceback logged.
- Origin guard (`swp/api/origin_guard.py`, ASGI middleware): POST/PUT/PATCH/DELETE pass only if `Sec-Fetch-Site == "same-origin"`, or that header is absent and the `Origin` host:port equals the `Host` header or the first `X-Forwarded-Host`. Otherwise 403 `forbidden_origin` ("This request came from another site."). GET/HEAD/OPTIONS are never checked.
- Request log: logger `swp.request` writes one INFO line per request `"<METHOD> <path> <status> <ms>ms"`; the `swp` logger gets a stdout handler at app creation if it has none.
- `npm run gen:api` (root) regenerates `frontend/lib/api/schema.ts` from `swp openapi` with `openapi-typescript` 7.13.0 (frontend devDependency); CI's frontend job runs it and fails on `git diff --exit-code`.
- New dependency `python-multipart==0.0.34` (stack pin); add its top-level modules to the `domain-pure` contract in `backend/.importlinter`.
- Every new test name carries its FR/NFR.

**Never:**
- No frontend page, component or Playwright test (no user-visible change); existing e2e stays green.
- No `GET /api/plans` or `GET /api/plans/{id}` endpoint (Story 1.9); no classes or pick groups computed (Epic 2); no auth, CORS, deployment, Vercel or Supabase.
- Never store uploaded file bytes; nothing from a rejected request is saved.
- Domain stays stdlib + pydantic; api never imports store; only store imports SQLAlchemy/Alembic.
- Never read `data/private/`; never edit `data/sample/` or `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sample import | name `Demo`, `data/sample/*.xlsx`, `Origin: http://testserver` | 201; one import row (`data_as_of` 2026-09-30), one plan row with `created_by`=`last_edited_by`=`planner`, `last_edited_at == created_at`, analysis period 2025-10-01..2026-09-30, settings snapshot equal to the toml, state == `PlanState.new()` dump | none |
| Restart | after the sample post, dispose engine, clear caches, new app | `app.plans.get(id)` returns the same plan and import | none |
| Failing file | Inventory row at unknown location | 422 `import_invalid`, 3 details in role order | zero rows in `imports` and `plans` |
| Save fails mid-transaction | plan insert raises after import insert | exception propagates | zero rows in both tables |
| Blank name | name `"  "` | 422 `validation_failed`, detail field `name` | nothing saved |
| Missing file field | no `transactions` part | 422 `validation_failed`, detail field `transactions` | — |
| Too large | `MAX_UPLOAD_BYTES=1000`, normal files | 413 `limit_reached`, upload message with "0.001 MB"-style figure computed from the limit | nothing saved |
| Too many rows | `MAX_ROWS_PER_FILE=3`, 4-row transactions | 413 `limit_reached` "transactions.csv has more than 3 rows. One file can hold at most 3." | nothing saved |
| Cross-site | `Sec-Fetch-Site: cross-site` POST | 403 `forbidden_origin` | — |
| No headers | POST without Sec-Fetch-Site and Origin | 403 `forbidden_origin` | — |
| Origin mismatch | `Origin: http://evil.example` | 403 | — |
| Unknown route | `GET /api/nope` | 404 `not_found` envelope | — |
| Unexpected error | handler raises RuntimeError | 500 `internal` envelope, traceback logged | — |
| Session | `GET /api/session` | `{"user": null, "feature_auth": false, "feature_demo": false, "max_upload_bytes": 4000000}` | — |
| FK restrict | delete an import that a plan references | integrity error on SQLite and Postgres | — |
| Upcast | `tests/domain/fixtures/state_v1.json` | upcasts unchanged; validates equal to `PlanState.new()`; unknown future version raises | — |

</intent-contract>

## Code Map

- `backend/swp/app/imports/__init__.py` -- `UploadedFile(file_name, data)`, `read_import(files: Mapping[FileRole, UploadedFile]) -> NormalizedImport`; raises `DomainError` `import_invalid` (details already AD-8 dicts) or `limit_reached`. Reuse as-is.
- `backend/swp/domain/import_.py:451-483` -- `ImportData` (`schema_version=1`), `NormalizedImport(data_as_of, data)`; `row_limit_reached` (line 328) builds the row-limit error; `ROLES`, `FileRole`.
- `backend/swp/domain/errors.py` -- `DomainError(code, message, details)`.
- `backend/swp/domain/values.py` -- `Dec`; `backend/swp/domain/ruff.toml` bans clock/uuid4/random in domain (ids and `now` come from app).
- `backend/swp/app/limits.py` -- `max_upload_bytes()`, `max_rows_per_file()`; add the upload-too-large error builder here.
- `backend/swp/config.py` -- pydantic-settings; add `feature_auth`, `feature_demo`.
- `backend/swp/store/db.py` -- `get_engine()` (lru_cache), `upgrade_to_head()`; add SQLite FK pragma listener and a session/transaction helper.
- `backend/swp/store/migrations/env.py` -- `render_as_batch=True`, `target_metadata=None`; `versions/` is empty (only `.gitkeep`); `script.py.mako` is the revision template.
- `backend/swp/api/app.py` -- `create_app()` mounts routers under `/api`, lifespan bootstraps when `APP_ENV=local`; add middleware, handlers, routers here.
- `backend/swp/cli.py` -- `swp openapi` prints sorted JSON of `create_app().openapi()`.
- `backend/.importlinter` -- `domain-pure` forbidden list (add `multipart`, `python_multipart`); `layers` api > app > store > domain.
- `backend/tests/conftest.py` (`database_path`, `_clear_caches`), `backend/tests/app/conftest.py` (`app_database`, Postgres via `--database-url` in CI). `backend/tests/app/test_import_readers.py` has `DATA_DIR`, `_data_files(folder, ext)`, small CSV fixtures `LOC_CSV/INV_CSV/TX_CSV`.
- `backend/tests/api/test_health.py` -- TestClient pattern (`with TestClient(create_app())`).
- `data/answer-key/expected.json` -- `settings` keys and values, `period.first_day/last_day`.
- `.github/workflows/ci.yml` -- `frontend` job (npm ci also runs `uv sync`); add the schema diff step there.
- `frontend/package.json`, root `package.json` -- add `openapi-typescript` devDependency and `gen:api` script.

## Tasks & Acceptance

**Execution:**
- `backend/pyproject.toml`, `backend/uv.lock` -- add `python-multipart==0.0.34` (`uv add` / `uv lock`).
- `backend/.importlinter` -- add `multipart`, `python_multipart` to `domain-pure`.
- `backend/settings/analysis.toml` -- the five settings with comments.
- `backend/swp/domain/state.py` -- mark models, `PlanState`, `PlanState.new()`.
- `backend/swp/domain/analysis.py` -- `AnalysisSettings`, `PartAnalysis`, `PickGroup`, `Analysis`, `period_for(data_as_of, months)`, `build_analysis(data_as_of, settings)`.
- `backend/swp/domain/state_migrations.py` -- `CURRENT_VERSIONS = {"state": 1, "analysis": 1, "data": 1}`, empty append-only upcaster chains, `upcast(kind, doc) -> dict` (missing `schema_version` = 1; newer than current → `ValueError`).
- `backend/swp/store/types.py` -- `UtcDateTime` TypeDecorator.
- `backend/swp/store/models.py` -- declarative `ImportRow`, `PlanRow` matching the migration.
- `backend/swp/store/migrations/versions/0001_imports_and_plans.py` -- the two tables.
- `backend/swp/store/db.py` -- FK pragma for SQLite; `transaction()` context manager yielding a `Session`.
- `backend/swp/store/plans.py` -- `insert_plan_with_import(...)` in one transaction; `get_plan(plan_id) -> StoredPlan | None` (upcast + validated domain models) with its import.
- `backend/swp/app/plans.py` -- `load_analysis_settings()`, `CreatedPlan` response model, `create(...)`, `get(plan_id)`.
- `backend/swp/app/limits.py` -- `upload_too_large(max_bytes) -> DomainError`.
- `backend/swp/config.py` -- feature flags.
- `backend/swp/api/errors.py` -- code→status table, envelope models (`ErrorBody`, `ErrorEnvelope`), handlers, `error_response(DomainError)`.
- `backend/swp/api/origin_guard.py`, `backend/swp/api/request_log.py`, `backend/swp/api/upload_limit.py` -- ASGI middlewares (upload limit buffers at most `max_upload_bytes` and replays the body).
- `backend/swp/api/schemas/__init__.py`, `backend/swp/api/schemas/session.py` -- `Session` model.
- `backend/swp/api/routers/plans.py` (`POST /plans`, 201, `responses` documenting 403/413/422 envelopes), `backend/swp/api/routers/session.py`, `backend/swp/api/app.py` -- wire everything.
- `frontend/package.json`, `package.json`, `package-lock.json` -- `openapi-typescript@7.13.0`, `gen:api` script; `frontend/lib/api/schema.ts` generated and committed (exclude from ESLint only if it fails lint).
- `.github/workflows/ci.yml` -- frontend job: `npm run gen:api` then `git diff --exit-code -- frontend/lib/api/schema.ts`.
- Tests: `backend/tests/domain/test_plan_state.py` (`test_fr18_period_*`, `test_fr18_settings_validation`, `test_nfr12_state_v1_fixture_upcasts_to_new`, `test_nfr12_future_version_rejected`) + `backend/tests/domain/fixtures/state_v1.json`; `backend/tests/app/test_create_plan.py` (sample post, restart persistence, failing import saves nothing, mid-transaction failure saves nothing, FK restrict, tables are exactly `imports`, `plans`, `alembic_version`); `backend/tests/api/test_api_errors.py` (envelope cases, `test_nfr6_cross_site_post_rejected`, origin cases, request log line, session, limits, blank name, missing field); `backend/tests/test_cli.py` extend with `test_nfr1_openapi_lists_plans_and_session`.

**Acceptance Criteria:**
- Given a fresh database, when `swp db upgrade` runs, then the tables are exactly `alembic_version`, `imports`, `plans` with the columns above, on SQLite and on Postgres in CI.
- Given the sample files, when posted with a same-origin header, then the response is 201 and the stored plan has `analysis.settings` equal to `analysis.toml`, `analysis.period_start` 2025-10-01, `period_end` 2026-09-30, and `state` equal to `PlanState.new().model_dump(mode="json")`.
- Given any rejected request (invalid file, limit, validation, origin), when it ends, then `imports` and `plans` have the same row counts as before.
- Given `npm run gen:api`, when run on a clean tree, then `git diff --exit-code -- frontend/lib/api/schema.ts` passes and the schema contains `/api/plans` and `/api/session`.
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run test:py`, `npm run lint`, `npm run typecheck`, `npm run test:web` and `CI=true npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 34 findings — high 0, medium 3, low 24, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` (edge-case) Empty `name` form value returns "Field required" instead of "Give the plan a name." — reproduced (422 "Field required"); `name` now defaults to `""` so `plan_name` raises; added `test_fr1_empty_name_rejected`.
  - `[medium]` `[patch]` (edge-case) `async def create_plan` runs sync parsing and the DB transaction on the event loop — same root cause as the blind row below; endpoint is now a plain `def` (threadpool) reading `file.file.read()`.
  - `[low]` `[reject]` (edge-case) `schema_version: true` treated as version 1 — only this code writes the JSON (ints); fix adds a guard for an unreachable value.
  - `[false]` `[reject]` (edge-case) `get_plan` raises a generic error on a newer schema_version or invalid doc — loud failure on data this code never writes; no caller can reach it in this story.
  - `[low]` `[reject]` (edge-case) `configure_logging` stdout handler could corrupt `swp openapi` output — no `swp` log is emitted while building the app; `gen:api` reproduces the committed schema byte for byte; spec convention is stdout.
  - `[low]` `[reject]` (edge-case) `_http_error` drops `Allow`/`WWW-Authenticate` headers and maps 401/403 to `validation_failed` — nothing raises 401/403 HTTPException; the frontend branches on `code` only.
  - `[low]` `[reject]` (edge-case) Origin compare ignores default ports — browsers send `Sec-Fetch-Site`, which decides first; fix adds normalization branches for a rare path.
  - `[low]` `[reject]` (edge-case) `gen:api` pipe has no pipefail — an empty stdin makes openapi-typescript fail or produce a diff that CI's diff step catches; portable pipefail adds shell complexity.
  - `[medium]` `[patch]` (blind) Plan endpoint blocks the event loop — grouped with the edge-case row above; fixed there.
  - `[low]` `[reject]` (blind) `analysis.toml` read and validated only at request time — the file is committed and checked by `test_fr18_analysis_toml_matches_answer_key`; startup validation adds a new path.
  - `[low]` `[patch]` (blind) Model FK unnamed while migration names it `fk_plans_import_id_imports` — named the FK in `models.py`.
  - `[low]` `[reject]` (blind) Upcaster loop untested / chain length unchecked / bool version — chains are empty at v1; the story that adds v2 adds an upcaster and fixture (AD-4); extra invariant tests not needed now.
  - `[low]` `[reject]` (blind) Unknown error codes silently become 500 — every code raised today is mapped; adding logging/scan adds surface.
  - `[low]` `[reject]` (blind) `_http_error` drops `exc.detail` and maps 405 to `not_found` — 405 → `not_found` follows the spec; messages are final copy without internals (AD-11).
  - `[low]` `[reject]` (blind) Request-validation messages use raw pydantic wording — the frontend branches on `code` and the field is in `details`; Story 1.8 owns the screen copy.
  - `[low]` `[reject]` (blind) No plan-name length limit — the request is capped at 4 MB; the spec sets no length rule.
  - `[false]` `[reject]` (blind) Upload limit bypassed via `/api/plans/` or `root_path` — `/api/plans/` gets a redirect and the re-POST hits the checked path; no `root_path` is configured.
  - `[low]` `[reject]` (blind) Generated schema types file fields as `string` — multipart is sent as `FormData`, not a typed JSON body; transform adds generator config for no current consumer.
  - `[low]` `[reject]` (blind) `swp openapi` shares stdout with logging — same as the edge-case logging row.
  - `[low]` `[reject]` (blind) Tests import private helpers from other test modules — reuse rather than duplication; precedent accepted in Story 1.6.
  - `[low]` `[patch]` (blind) `test_nfr_upload_limit_message_uses_default_4_mb` takes an unused `client` fixture — fixture removed.
  - `[low]` `[reject]` (blind) Origin compare ignores scheme/default ports/IPv6 — same as the edge-case origin row.
  - `[low]` `[patch]` (verification-gap) Middleware order untested — added `test_nfr6_origin_guard_runs_before_upload_limit` and `test_nfr6_rejected_post_is_logged`.
  - `[low]` `[patch]` (verification-gap) `/api/session` tested only with defaults — added `test_fr11_session_reports_configured_flags_and_limit`.
  - `[low]` `[patch]` (verification-gap) Other-4xx branch untested — added `test_nfr_malformed_multipart_returns_validation_envelope` (400 parse error → 422 `validation_failed`).
  - `[low]` `[patch]` (intent-alignment) Restart test used small CSVs, not the demo files — restart test now posts `data/sample/*.xlsx` over HTTP and reads the plan back after a new app start.
  - `[false]` `[reject]` (intent-alignment) `tests/api` runs only on SQLite — the AC asks for `tests/app` on Postgres, which covers migration, rollback, RESTRICT and restart.
  - `[low]` `[reject]` (intent-alignment) Mid-transaction rollback tested only at the service surface — the router calls the same `plans.create`; an HTTP variant adds no new path.
  - `[false]` `[reject]` (intent-alignment) "25,000" row-limit wording not exercised — covered by `tests/app/test_import_readers.py:185`.
  - `[false]` `[reject]` (intent-alignment) Origin guard stricter than "rejects cross-site" — it is exactly AD-19's rule.
  - `[low]` `[patch]` (intent-alignment) Request log tested only on GET — grouped with the middleware-order gap; `test_nfr6_rejected_post_is_logged` added.
  - `[false]` `[reject]` (intent-alignment) OpenAPI diff only enforced in CI — also verified locally (`gen:api` reproduces the committed file).
  - `[low]` `[patch]` (intent-alignment) CLI upgrade test did not check new tables — now asserts `imports` and `plans`.
  - `[false]` `[reject]` (intent-alignment) Analysis has empty classes/pick groups — the epics assign them to Story 2.1/2.2.

## Design Notes

- The upload limit is a middleware because FastAPI parses the multipart body before any dependency runs; buffering ≤ 4 MB in memory is acceptable and lets the 413 come before parsing. The limit value and message still come from `swp.app.limits` (AD-18 "enforced in swp.app").
- `X-Forwarded-Host` is accepted in the origin guard because the local Next.js rewrite rewrites `Host`; a cross-site browser page cannot set that header without a CORS preflight, which fails (no CORS).
- `runs`, `steps`, `recent_commands` stay untyped dict lists until the epics that own them type them (with an upcaster if the stored shape changes). Marks are typed now because AD-4 fixes their shape.
- `tests/app` must not assume SQLite: count rows with SQLAlchemy `select(func.count())` on the engine, and create unique names per test; Postgres tests share one database, so each `tests/app` test that writes should start by deleting from `plans` then `imports` (or use a fixture that does).

## Verification

**Commands:**
- `npm run lint:py` -- all checks passed.
- `npm run lint:imports` -- all contracts kept.
- `npm run test:py` -- all pass (SQLite; Postgres runs in CI).
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` -- no diff.
- `npm run lint && npm run typecheck && npm run test:web` -- pass.
- `CI=true npm run e2e -- --project=chromium` -- existing specs pass.

## Auto Run Result

Status: done

**Summary:** A plan can now be created and stored from the three files. Migration 0001 creates `imports` and `plans` (portable `Uuid`/`JSON`/`UtcDateTime`, FK `ON DELETE RESTRICT`, SQLite foreign keys on). The kernel adds `PlanState` (typed best marks, defaults, `new()`), `Analysis` with the settings snapshot and period (`period_for`), and `state_migrations.upcast` with empty append-only chains and a `state_v1` fixture. `app.plans.create` reads `backend/settings/analysis.toml` and stores import + plan in one transaction with `planner` as created/last-edited by. `POST /api/plans` (multipart, 201) and `GET /api/session` are added with the AD-11 error envelope, the AD-19 same-origin guard, a one-line request log and a 4 MB upload limit middleware. `npm run gen:api` generates `frontend/lib/api/schema.ts`; CI fails on a diff.

**Files changed:**
- `backend/pyproject.toml`, `backend/uv.lock`, `backend/.importlinter` -- python-multipart 0.0.34; banned from the domain.
- `backend/settings/analysis.toml` -- analysis settings (12, 24, 6, 1, 5).
- `backend/swp/domain/state.py`, `analysis.py`, `state_migrations.py` -- plan state, analysis snapshot and period, upcasters.
- `backend/swp/store/types.py`, `models.py`, `plans.py`, `db.py`, `migrations/versions/0001_imports_and_plans.py` -- tables, one-transaction save, read with upcast.
- `backend/swp/app/plans.py`, `limits.py`; `backend/swp/config.py` -- creation service, upload-limit error, feature flags.
- `backend/swp/api/errors.py`, `origin_guard.py`, `request_log.py`, `upload_limit.py`, `schemas/session.py`, `routers/plans.py`, `routers/session.py`, `app.py` -- shared API pieces and endpoints.
- `package.json`, `frontend/package.json`, `package-lock.json`, `frontend/lib/api/schema.ts`, `.github/workflows/ci.yml` -- OpenAPI type generation and CI diff.
- `backend/tests/domain/test_plan_state.py`, `fixtures/state_v1.json`, `backend/tests/app/test_create_plan.py`, `backend/tests/api/test_api_errors.py`, `backend/tests/test_cli.py` -- tests.

**Review:** 34 findings (high 0, medium 3, low 24, false 7, maybe-false 0). Patched: empty-name message, sync endpoint (no event-loop blocking), FK name in the model, unused fixture, tests for middleware order, rejected-request logging, configured session values, malformed multipart, demo-file restart, CLI tables. Deferred: none. Rejected, with reasons in the Review Triage Log: bool schema_version, future-version read errors, logging on stdout vs `swp openapi`, dropped HTTP headers/detail, origin default ports/scheme, `gen:api` pipefail, request-time toml loading, upcaster invariant tests, unmapped codes, raw pydantic messages, name length, `/api/plans/` bypass (false), `string` file types in schema, cross-module test helpers, SQLite-only api tests, service-level rollback test, row-limit wording (covered), guard strictness (AD-19), CI-only diff (verified locally), empty classes (Epic 2).

**Follow-up review recommendation:** true -- two medium entries were patched (patched counts: high 0, medium 2, low 8). Unverified risk: the switch of `create_plan` to a sync threadpool endpoint and the reworked demo-file restart test have not yet run on Postgres 17 (CI only), and no test shows concurrent requests are served during an upload.

**Verification (after patches):** `npm run lint:py` all checks passed; `npm run lint:imports` 4 kept, 0 broken; `npm run test:py` 186 passed (SQLite); `npm run gen:api` reproduces `frontend/lib/api/schema.ts` (same SHA-1 before and after); `npm run lint` and `npm run typecheck` clean; `npm run test:web` 48 passed; `CI=true npm run e2e -- --project=chromium` 10 passed. `tests/app` on Postgres 17 runs in CI after push.

**Residual risks:** the origin guard is tested with hand-set `X-Forwarded-Host`, not through the real Next.js rewrite (browsers send `Sec-Fetch-Site: same-origin` first); the streamed-body 413 test may not exercise the no-Content-Length path; existing local `backend/var/swp.db` is migrated to 0001 on next dev start.
