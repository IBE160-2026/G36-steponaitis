---
review: rubric walk
target: ../ARCHITECTURE-SPINE.md (status draft, updated 2026-11-16)
inputs: ../.memlog.md, prds/prd-Project-2026-11-01/prd.md (§4.0, §4.1–4.2, §5, §7, §8)
date: 2026-11-16
---

# Rubric review: Architecture Spine, Smart Warehouse Planner

## Verdict

The spine is strong and close to buildable. The core divergence points are fixed: the pure domain, the plan aggregate, the command path, recommendation status, the import parser, errors, ordering, the wall and the move list. PRD coverage is complete for the bound FRs. Two ADs contradict or undercut themselves, though. AD-8 puts openpyxl in the pure domain, which AD-1 forbids. AD-6's SQLite "lock" does not serialize read-modify-write, so it can lose steps and reuse move numbers. Security is silent on CSRF. Several rules have no mechanical enforcement, and a few operational facts are wrong or missing (Supabase pausing, migrations, Vercel response size). Fix the two high items and the CSRF stance before you create epics. The mediums can go in as one revision pass.

**Counts:** critical 0 · high 3 · medium 12 · low 14

## Checklist walk

| Checklist item | Result | Notes |
| --- | --- | --- |
| Fixes the real divergence points for epics/stories | Mostly | Strong on domain/state/commands. Gaps: `/api` prefix ownership, `ctx`/ID generation in the domain, state-schema evolution, client auth gate and 401 handling, view payload size (H-1, M-2, M-3, M-4, M-6, M-9). |
| Every AD's Rule is enforceable and prevents its divergence | Partly | AD-1 is contradicted by AD-8 (H-1). AD-6's SQLite half doesn't prevent lost updates (H-2). AD-1, AD-9 and AD-13 rules have no automated check (M-5). AD-9's portability goal has no test on Postgres (M-7). |
| Nothing under Deferred lets two units diverge | Mostly | "View payloads" deferral hides a cross-cutting size/pagination choice (M-9). Two Deferred bullets are upstream doc fixes, not deferrals (L-8). |
| Named tech is verified-current | Yes, one stale | npm/PyPI checked 2026-11-16: all match latest except uv (0.12.7 pinned, 0.13.8 current) and TypeScript (5.9.3 chosen over 7.0.2, which is deliberate). Vercel Services confirmed Beta. bcrypt 5.0.0 behaviour change not accounted for (M-8). |
| Covers the PRD's capabilities | Yes | FR-1–FR-40, FR-42, FR-50, FR-51 all mapped. FR-41 and FR-43–FR-48 deferred with hooks. NFR-9/NFR-10 bound in frontmatter but no AD (L-5). |
| Deployment and environments | Decided, with gaps | Local + production + previews/CI covered. Supabase free-tier pausing is not handled (M-10). The preview-off mechanism is undefined under Services (L-9). Migration mechanics are under-specified (M-11). |
| Infra/provider strategy | Decided | Vercel Services with a two-project fallback; Supabase `[ASSUMPTION]`. |
| Operations | Partly silent | Backups and monitoring deliberately deferred (fine). Logging, a health check and keep-alive are silent (M-10, L-10). |
| Security basics | Gap | Secrets (NFR-6) and production secret refusal are good. **CSRF is not addressed** (H-3). Upload parsing is not hardened (M-12). bcrypt input length (M-8). |
| Testing strategy | Decided, with gaps | Tests are well laid out per layer, with FR naming. Missing: Postgres test path (M-7) and CI checks that enforce the ADs (M-5). |
| Local dev | Decided | `npm run dev`, uv, Node 24, SQLite, auto-migrate. The relative SQLite path depends on CWD (L-11). |
| Rationale/bloat | Mostly terse | AD-8 is long but load-bearing. Upstream doc notes sit in Deferred (L-8). |
| Template comments/placeholders | Clean | No TODO/TBD/template comments. `{id}`, `<aisle>…`, `<id>`, `<step>` are intentional. Frontmatter `altitude` disagrees with the memlog (L-1). |

---

## High

### H-1. AD-8 puts openpyxl in the pure domain, which AD-1 forbids

AD-1 says `swp/domain` imports only the stdlib and pydantic and does no file work. AD-8 says `domain.import_` parses `.xlsx` "with openpyxl in read-only, values-only mode". The two units that build these will diverge: either the domain imports openpyxl (and any import-linter contract for AD-1 fails), or someone moves parsing out ad hoc. Then the "one parser" guarantee of AD-8 splits across layers. The answer-key tests also call the domain "directly against `data/answer-key/`", which are CSV files, so the test path never exercises the xlsx path anyway.

**Fix:** split AD-8 into two named pieces and say so in both ADs:
- `swp/app/imports/readers.py` (shell): bytes → `RawSheet` = header row plus rows of typed cells (`str | int | float | Decimal | datetime | date | None`), one reader for xlsx (openpyxl) and one for CSV (encoding, BOM, delimiter). The format bullet of AD-8 lives here.
- `swp/domain/import_.py` (pure): `RawSheet` ×3 → `ParsedImport | list[ImportError]`. The header, text, identifier, number, date, empty/mixed-file bullets live here, keyed on the cell's Python type.
- Add a reader test for each sample format in `backend/tests/app` (xlsx from `data/sample/`, CSV from `data/answer-key/`).

### H-2. AD-6's SQLite "lock" doesn't serialize read-modify-write: lost steps and reused move numbers

"Postgres `SELECT … FOR UPDATE`; SQLite serializes writes." SQLite serializes *writes*, not the read that precedes them. With pysqlite's default deferred transactions, two requests (two tabs, or a retry racing a slow original) both read `state` at version N, each folds its command, and the second commit silently overwrites the first. That drops a step and lets `next_move_number` repeat, which breaks AD-5 ("never reused"). "Last write wins" for `base_version` is a product rule about *intent*. It doesn't excuse the storage layer losing a committed command. The local install is the examiner path (NFR-2), so this is the environment that matters most.

**Fix:** replace the locking clause with one portable rule that both engines honour and the SQLite tests can exercise:
- The save is `UPDATE plan SET state=:s, version=version+1, … WHERE id=:id AND version=:read_version`.
- If 0 rows are affected, the service reloads and re-applies the command, up to 3 times, then returns `internal`.
- Keep `FOR UPDATE` on Postgres as an optimisation only. Optionally also emit `BEGIN IMMEDIATE` for SQLite through a SQLAlchemy `begin` event.
- Add the test `test_fr10_concurrent_commands_both_saved` in `tests/app`.

### H-3. CSRF stance is missing for a cookie-session API

AD-10 uses an httpOnly `SameSite=Lax` cookie, but nothing says what protects state-changing requests, and nothing forbids the easy mistakes: adding CORS middleware "for local dev", a GET logout, or an endpoint that accepts form posts. `POST /api/plans` is multipart, which is a CORS-simple request. With auth off (milestone 1, or any local install with `FEATURE_AUTH` off) there is no cookie at all, so any web page the user visits can create plans on `localhost:3000`. Lax alone doesn't cover that case.

**Fix:** add a rule to AD-10 (or a new AD) under "Security":
- No CORS middleware in any environment. Same origin only (AD-2).
- `swp/api` middleware rejects `POST`/`PUT`/`PATCH`/`DELETE` unless `Sec-Fetch-Site` is `same-origin`, or (when that header is absent) `Origin` matches the request host. The rejection is `403 forbidden_origin`, added to AD-11.
- JSON bodies require `Content-Type: application/json`. Only `POST /api/plans` accepts multipart.
- Logout is `POST /api/auth/logout`. No GET writes (AD-6 already says this; restate it for auth).
- Add the test `test_nfr6_cross_site_post_rejected` in `tests/api`.

---

## Medium

### M-1. The idempotency record is undefined: window size and "stored result"

AD-6 says "a `command_id` already in `state` returns the stored result", and AD-4 keeps "the most recent `command_id`s". It doesn't say how many are kept or what the result is. One story will keep 1 and another will keep all of them, so `state` grows forever. Since AD-3 refetches after every command, the result can be trivial.

**Fix:** the command response is `{"version": int}`. `state.recent_commands` holds the last 50 `(command_id, version)` pairs. A repeat returns 200 with the stored version. Also say New Plan is not idempotent: the client disables the submit while it is in flight and does not auto-retry it (AD-12 covers commands only).

### M-2. `ctx` and ID generation in the domain are unspecified

AD-1 says time, settings and IDs "come in as arguments". AD-6 calls `domain.apply(state, command, ctx)`. Runs and swaps need fresh IDs (`run` id, `swap_id`), and runs record created at/by. Without a defined `ctx`, one story will call `uuid4()` inside the domain, which breaks AD-1 purity and the determinism SM-1 depends on.

**Fix:** define `ctx = CommandContext(now: datetime, user: str, settings: AnalysisSettings)` in `domain/state.py`. The domain derives IDs deterministically as `uuid5(command_id, f"{kind}:{n}")`, which also makes retries reproduce identical state. Ban `uuid4`/`datetime.now`/`random` in `swp/domain` with ruff `flake8-tidy-imports` banned-api, or with the M-5 check.

### M-3. There is no rule for evolving the `PlanState` schema

`schema_version` exists, but nobody owns upgrades. Milestone 1 stores plans "the same way as in milestone 2", yet milestone 2 adds keep marks, combine/undo data and `swap_id` to the state. Alembic doesn't see inside the JSON. Stories will either break reopen (FR-9) or invent ad-hoc migrations.

**Fix:** add a rule to AD-4:
- State changes are additive with defaults on the pydantic model.
- A non-additive change bumps `schema_version` and adds a pure upcaster `upgrade_vN_to_vN+1` in `domain/state.py`.
- `store` upcasts on read, and the next command writes the new version.
- Every version has a fixture in `tests/domain/state_fixtures/` that must still load.
- Apply the same rule to `plan.analysis` (validate it with a pydantic `PlanAnalysis` model, too).

### M-4. Nobody owns the `/api` prefix (local rewrite vs Vercel Services)

AD-2 says Next rewrites `/api/*` to `http://127.0.0.1:8000`, and Vercel rewrites `/api/(.*)` to the backend service. It doesn't say whether FastAPI's routes include `/api`, or whether the local rewrite keeps or strips the prefix. A mismatch works in one environment and 404s in the other.

**Fix:** state that FastAPI mounts every router under `/api` (`APIRouter(prefix="/api")`) and that both rewrites preserve the full path (`/api/:path*` → `http://127.0.0.1:8000/api/:path*`). Add a smoke test that `GET /api/health` returns 200, run locally and against the deployed URL in the first story (the "walking skeleton").

### M-5. AD-1, AD-9 and AD-13 rules have no automated enforcement

"Domain imports only stdlib and pydantic", "only `swp/store` imports SQLAlchemy", the layer table, and "`schema.ts` is never edited by hand" are all honour-system rules. CI (ruff, pytest, typecheck, Vitest) checks none of them.

**Fix:**
- Add `import-linter` (2.16, current) to the stack, with contracts for the layer table: domain is forbidden from importing sqlalchemy, openpyxl, fastapi, `swp.store`, `swp.app` and `swp.api`; only `swp.store` may import sqlalchemy; api → app → domain/store.
- Add a CI step: `uv run swp openapi > /tmp/openapi.json && npx openapi-typescript /tmp/openapi.json -o frontend/lib/api/schema.ts && git diff --exit-code frontend/lib/api/schema.ts`.
- Add `swp openapi` to `cli.py` in the Structural Seed.

### M-6. Client auth gate, flag pairs and 401 handling are undecided

AD-2 forbids server components calling the backend, so how the frontend knows who is logged in, and where it redirects, is open: Next `proxy.ts`/middleware cookie sniffing vs a client-side `/api/auth/me` check. AD-12 treats every 4xx as "drop the command and show the message", so a session that expires mid-plan silently discards the user's change. The `FEATURE_*`/`NEXT_PUBLIC_FEATURE_*` pairs can also disagree, because `NEXT_PUBLIC_*` values are inlined at build time.

**Fix:**
- Add `GET /api/config` → `{feature_auth, feature_demo, max_upload_bytes}` and `GET /api/auth/me`. The frontend reads flags only from `/api/config` (drop the `NEXT_PUBLIC_FEATURE_*` vars).
- The auth gate is client-side: 401 from `/me` → `/login`. No Next middleware/proxy.
- In AD-12, `unauthenticated` pauses the queue (it does not drop the command), sends the user to login, and resumes after login.
- Also decide what happens to queued commands after a 4xx drop: clear the rest of the queue, because they were built on unconfirmed state, then refetch.

### M-7. Postgres is never exercised by tests

AD-9 exists to prevent "works on SQLite, fails on Postgres", but all persistence tests run on SQLite only. The `FOR UPDATE` path, psycopg pooler settings and JSON round-trips first meet Postgres in production.

**Fix:** add a GitHub Actions job with a `postgres:17` service container that runs `tests/app` with `DATABASE_URL=postgresql+psycopg://…`. This is CI only, so NFR-2 is unaffected. The local default stays SQLite.

### M-8. bcrypt 5.0.0 raises on passwords over 72 bytes, but AD-10 allows 64 characters

bcrypt 5.0.0 (pinned) changed `hashpw` to raise `ValueError` for inputs longer than 72 bytes. AD-10 allows 4–64 *characters*. A Norwegian passphrase of 64 characters with æ/ø/å (2 bytes each in UTF-8) can exceed 72 bytes, so signup returns `internal` 500 instead of a validation message.

**Fix:** the password rule becomes "4–64 characters and at most 72 bytes in UTF-8". Violations return `validation_failed` with final copy. Add `test_fr39_password_over_72_bytes_rejected`.

### M-9. Vercel's 4.5 MB limit applies to responses too, and view size is unbounded

AD-18 handles the request limit, but views are deferred "to stories". With `MAX_ROWS_PER_FILE = 50,000`, a parts or locations view can exceed 4.5 MB of JSON and fail only on Vercel (`FUNCTION_PAYLOAD_TOO_LARGE`). This is a cross-cutting decision (whole list vs paginated) that every list story will otherwise make differently. The sample data is far below the limit (Locations 2,000 rows, Inventory 1,625, Transactions 20,000), so the cheap answer is to lower the cap.

**Fix:** pick one rule and write it in AD-18: "Views return whole lists. `MAX_ROWS_PER_FILE` is 25,000, so the largest view stays under 4 MB, which is checked by a test on a generated max-size import." The alternative is "lists over N rows use `?offset=&limit=`", but whole lists are simpler and fit NFR-7. Also make the frontend check total file size against `max_upload_bytes` (from `/api/config`) before upload, because Vercel's own 413 is not an AD-11 body.

### M-10. Supabase free tier pauses, and the memlog's "wake-up" assumption is wrong

The memlog says the demo "must allow for a wake-up". Paused Supabase free projects (after about a week without activity) don't wake on connection. They must be restored by hand from the dashboard. An examiner opening the README link after a quiet week gets 500s. The spine itself is silent on this, and there's no health endpoint.

**Fix:** pick one and record it in the Environments table:
- (a) A GitHub Actions cron (daily) calls `GET /api/health`, which runs `SELECT 1`. Add the health endpoint to the seed.
- (b) Use Neon through the Vercel Marketplace instead (its autosuspend wakes on connect). The pooler settings stay the same pattern.

Either way, make the README demo check part of the pre-submission list.

### M-11. Migration mechanics are under-specified

The gaps:
- "Migrations … run on start" locally doesn't say that `main.py` must *not* migrate on Vercel cold starts. The env table implies it but doesn't state it.
- Alembic on SQLite needs batch mode, or `ALTER` migrations fail locally and pass on Postgres.
- Running DDL through the transaction pooler (6543) is discouraged. Migrations should use the direct or session connection (5432).

**Fix:** add to AD-9:
- Auto-upgrade and seed run in the FastAPI lifespan only when `APP_ENV=local`.
- `context.configure(render_as_batch=True)` in `env.py`.
- `swp db upgrade` uses `MIGRATION_DATABASE_URL` when set (Supabase session/direct URL), else `DATABASE_URL`.
- Migrations are expand-only while the demo runs, so a Vercel instant rollback stays compatible.

### M-12. Uploaded files aren't hardened against hostile input (public demo)

The public demo accepts arbitrary `.xlsx` files. `MAX_UPLOAD_BYTES` caps the *compressed* size only. An xlsx is a zip of XML, so a small file can expand hugely, and openpyxl only guards against XML entity attacks when `defusedxml` is installed.

**Fix:**
- Add `defusedxml` (0.7.1) to the stack.
- Readers (H-1) stop with `limit_reached` as soon as row `MAX_ROWS_PER_FILE + 1` is read (read-only mode streams).
- Cap the number of columns read (e.g. 100) and the length of a cell (e.g. 1,000 chars).
- Reject a zip whose uncompressed total is over 50 MB before opening it (`zipfile.ZipFile.infolist`).

---

## Low

### L-1. Frontmatter `altitude` disagrees with the memlog

The spine says `altitude: feature`. The memlog says `initiative (keeps epics)`, and the scope is the whole app. **Fix:** set `altitude: initiative`.

### L-2. The command `type` union is "closed" but written with "e.g."

AD-6 says the union is closed and then lists examples. **Fix:** remove "e.g." and make the list the closed union. A story that needs a new type updates AD-6.

### L-3. AD-11's closed list is incomplete or ambiguous

- `limit_reached` is "413 or 409" with no rule for which.
- The AD-18 login lock has no code.
- FastAPI's default 422 (`RequestValidationError`) and 404 (unknown route) bodies are not in AD-11 shape.

**Fix:**
- `limit_reached` is 413 for `MAX_UPLOAD_BYTES`/`MAX_ROWS_PER_FILE` and 409 for `MAX_PLANS`/`MAX_ACCOUNTS`.
- Add `login_locked` 429 and `forbidden_origin` 403 (H-3).
- State that `swp/api/errors.py` registers handlers mapping `RequestValidationError` → `validation_failed` and `HTTPException(404)` → `not_found`.

### L-4. zod's role is unstated

zod overlaps with AD-13's "Pydantic is the only definition of shapes". **Fix:** add a line to the Conventions: "zod validates form input only. It never mirrors API request/response shapes."

### L-5. NFR-9 and NFR-10 are in `binds` but no AD or convention mentions them

**Fix:** either drop them from `binds`, or add a Conventions row "Browsers/accessibility: UX-owned (DESIGN.md, EXPERIENCE.md). Architecture only guarantees every drag command (AD-16) has a keyboard equivalent via `manual_move`."

### L-6. The Capability Map path `app/plans/[id]/print` is ambiguous

`app/` collides with `backend/swp/app/`. **Fix:** write `frontend/app/plans/[id]/print`.

### L-7. The JSON persistence details that bite every story are unstated

`Decimal` isn't JSON-serializable by the SQLAlchemy JSON type, and in-place mutation isn't tracked. SQLite also returns naive datetimes for `DateTime(timezone=True)`, which breaks the "ISO 8601 with `Z`" convention locally but not on Postgres. **Fix:** add to AD-9:
- The store writes `state` and `analysis` only as `Model.model_dump(mode="json")`, replacing the whole value.
- Timestamps use a `UTCDateTime` TypeDecorator that stores UTC and returns aware UTC on both engines.

### L-8. Upstream doc fixes are filed under Deferred

The last two Deferred bullets (the PRD UJ-2/FR-29 wording and the EXPERIENCE.md "Save failed" copy) are hand-offs to the PRD and UX, not deferred architecture. **Fix:** move them to an "Open questions / upstream updates" section, which the memlog already tags as `(question)`.

### L-9. "Backend preview deployments are off" has no mechanism under Services

`ignoreCommand` is not valid at the top level in services mode, and previews are project-wide. **Fix:**
- Scope `DATABASE_URL`/`JWT_SECRET` to the Production environment only, and disable preview deployments in the project's Git settings.
- The backend refuses to start when `VERCEL=1` and `APP_ENV` is unset. This also stops a preview from falling back to SQLite on a read-only filesystem.

### L-10. Logging is silent

**Fix:** add a Conventions row: "Backend logs to stdout with the stdlib `logging`, one line per request (method, path, status, ms) and full tracebacks for `internal`. Vercel captures stdout. No external log service (NFR-2)."

### L-11. The relative SQLite path depends on CWD

`sqlite:///./var/swp.db` resolves against the current directory. `npm run dev` from the root and `uv run swp …` or pytest from `backend/` can open different databases. **Fix:** `config.py` resolves the default to `backend/var/swp.db` from `Path(__file__)` and creates `var/` if it's missing.

### L-12. No FK/delete rule ties plans to imports

FR-12 says the import is deleted with the last plan that uses it, but a concurrent FR-2 New Plan could reference an import that is being deleted. **Fix:** `plan.import_id` is an FK with `ON DELETE RESTRICT`. The delete service removes the import only when `NOT EXISTS` another plan referencing it, inside the same transaction.

### L-13. Demo-specific abuse edges are unstated

- Does the login throttle apply to `POST /api/auth/demo`?
- Can `MAX_ACCOUNTS` be exhausted by drive-by signups so examiners can't create accounts?

**Fix:** state that `/api/auth/demo` bypasses the throttle, and that hitting `MAX_ACCOUNTS` is an accepted risk mitigated by the Demo version button. Alternatively, signups are throttled per hour.

### L-14. Stack version drift and the milestone-1 deploy state

- uv is pinned at 0.12.7, but 0.13.8 is current (0.13.0 released 2026-10-09). **Fix:** bump to 0.13.x, or say why 0.12 is kept.
- The production env row sets `FEATURE_AUTH=true`, but auth isn't built until milestone 2, and the spine doesn't say whether the public demo exists during milestone 1. **Fix:** add "The public demo is first deployed at the milestone 2 gate", or list the milestone-1 production flags.

---

## Verified technology (2026-11-16, npm/PyPI registries)

These all match the current latest: next 16.4.6, react 19.3.1, @tanstack/react-query 5.107.1, zod 4.6.7, @dnd-kit/core 6.3.1, vitest 5.1.0, @playwright/test 1.65.1, openapi-typescript 7.13.0, tailwindcss 4.3.5, shadcn 4.23.0, sonner 2.0.8, lucide-react 1.73.0, concurrently 10.0.7, fastapi 0.163.1, uvicorn 0.54.0, sqlalchemy 2.1.8, alembic 1.20.1, pydantic 2.14.3, pydantic-settings 2.16.3, openpyxl 3.1.5, psycopg 3.3.9, pyjwt 2.15.1, bcrypt 5.0.0, pytest 9.2.0, httpx 0.28.1, ruff 0.17.5.

The exceptions:
- uv: 0.13.8 is current, the spine pins 0.12.7 (L-14).
- typescript: 7.0.2 is latest, and 5.9.3 is deliberately chosen. That's acceptable, but a one-word reason in the Stack row would help.

Vercel Services is confirmed "available in Beta on all plans" (vercel.com/docs/services), and its routing uses top-level `rewrites` with `destination: {service}`, as AD-2 assumes.
