---
review: tech-currency
target: ../ARCHITECTURE-SPINE.md (with ../.memlog.md)
lens: "Every committed decision web-researched or reality-checked, not asserted from training data: current versions, each technology still exists and fits, live defaults of any starter."
date: 2026-11-16
method: npm view / PyPI JSON API / endoflife.date on 2026-11-16; vendor docs fetched live (Vercel, Supabase, Neon, psycopg, SQLAlchemy, FastAPI, Next.js, shadcn, PyJWT, bcrypt, uv); create-next-app@16.4.6 and starlette@1.10.0 packages inspected directly.
---

# Tech-currency review: Smart Warehouse Planner architecture spine

## Verdict

The stack mostly holds up. 26 of the 28 pinned versions match the registries today, and the main bet, Vercel Services running Next.js and FastAPI behind one `/api/*` rewrite, is confirmed by Vercel's current docs. Three decisions are still not ready to build on, because they would break at runtime in ways the spine doesn't predict:

- The stack has no `python-multipart`, which FastAPI needs to receive uploads (FR-1).
- SQLite returns `DateTime(timezone=True)` values without a time zone, which breaks AD-9's portability promise.
- bcrypt 5 raises an error for passwords over 72 bytes, and the 64-character rule allows longer ones once a password has non-ASCII characters.

Several facts in the memlog's "verified" line are wrong or out of date: uv is 0.13.8, not 0.12.7; Vercel's default Node is now 26.x; shadcn now defaults to Base UI; and httpx is deprecated for the TestClient. Some fit claims (backend-only previews, Supabase "wake-up", "SQLite serializes writes") don't hold as written.

## Tier 1 — fix before stories are written

### T1-1 FastAPI file upload needs `python-multipart`, which is missing from the stack

- **Spine:** AD-8 / AD-18 / FR-1: `POST /api/plans` receives three files. The Stack table lists FastAPI, but not `python-multipart`.
- **Reality:** FastAPI's docs say: "To receive uploaded files, first install `python-multipart` … because uploaded files are sent as form data." It is not a core dependency of `fastapi==0.163.1`. Its `requires_dist` without extras is starlette, anyio, pydantic, typing-extensions, typing-inspection, annotated-doc and opentelemetry-api. `python-multipart` comes only with the `[standard]` extra. Without it, FastAPI fails when the upload route is defined, and on Vercel the whole backend fails at import.
- **Fix:** add `python-multipart 0.0.34` (PyPI latest, 2026-11-16, requires Python >= 3.11) to the Stack table as a runtime dependency. Don't pull in `fastapi[standard]` instead, because it adds fastapi-cli, jinja2, email-validator, OpenTelemetry SDK and more to the 500 MB bundle.
- **Sources:** https://fastapi.tiangolo.com/tutorial/request-files/ · https://pypi.org/pypi/fastapi/0.163.1/json · https://pypi.org/project/python-multipart/

### T1-2 "Timezone-aware UTC timestamps" are not portable to SQLite

- **Spine:** AD-9 ("Types must be portable: … timezone-aware UTC timestamps"). The convention says they are "sent as ISO 8601 with `Z`". Persistence tests run on SQLite only.
- **Reality:** SQLite has no datetime type. SQLAlchemy's SQLite `DATETIME` storage format is `YYYY-MM-DD HH:MM:SS.ffffff` with no offset, and the `timezone=True` flag is ignored. An aware datetime goes in and a naive one comes back. On Postgres, `timestamptz` comes back aware. So:
  - Locally, Pydantic serializes `last_edited_at` without `Z`, and the browser reads it as local time. In Norway that is off by 1–2 h, which hits FR-11 "who edited when".
  - Comparing aware and naive values raises `TypeError` (for example in the 60 s login lock in AD-18, or in comparisons with `generated_at`).
  - The tests pass on SQLite while production behaves differently. That is the exact failure class AD-9 says it prevents.
- **Fix:** add a `UtcDateTime` `TypeDecorator` to AD-9 (in `swp/store`). On bind it rejects naive values and converts to UTC. On result it attaches `timezone.utc` when the value is naive. All timestamp columns use it. Add one test that round-trips a timestamp on SQLite and checks the `Z` in the API output.
- **Sources:** https://docs.sqlalchemy.org/en/21/dialects/sqlite.html (Date and Time Types: storage format has no offset) · https://docs.sqlalchemy.org/en/21/core/custom_types.html (TypeDecorator) · https://bitbucket.org/zzzeek/sqlalchemy_old/issues/2326/clarify-timezone-flag-on-datetime

### T1-3 bcrypt 5.0.0 raises `ValueError` above 72 bytes, and "4–64 characters" can exceed that

- **Spine:** AD-10: "A password is 4–64 characters, hashed with bcrypt", with bcrypt 5.0.0.
- **Reality:** bcrypt's README says: "Passing `hashpw` a password longer than 72 bytes now raises a `ValueError`. Previously the password was silently truncated." The limit counts UTF-8 bytes, not characters. 37 × `æ`/`ø`/`å` is 74 bytes, and 18 emoji are 72 bytes or more. So a valid 64-character password can give an unhandled 500 (`internal`) at signup or login, not a `validation_failed` message. The two sides also count characters differently: Python's `len()` counts code points, while zod `.max(64)` in the frontend counts UTF-16 code units, so they disagree for emoji.
- **Fix (pick one and write it into AD-10):**
  - (a) Pre-hash: `bcrypt(base64(sha256(password)))`. bcrypt's README recommends this. It removes the byte limit and keeps the 64-character UX rule.
  - (b) Keep plain bcrypt, but validate `len(password.encode("utf-8")) <= 72` on the server and return `validation_failed` with final copy.

  In both cases, define "character" as a Unicode code point. The frontend should count with `[...pw].length`, not `.length`.
- **Sources:** https://github.com/pyca/bcrypt/blob/main/README.rst (Maximum Password Length) · https://pypi.org/project/bcrypt/5.0.0/

## Tier 2 — wrong or unverified facts; correct them in the spine or the first stories

### T2-1 uv is 0.13.8, not 0.12.7, and uv 0.13 downloads Python 3.15 by default

- **Spine / memlog:** "uv 0.12.7 … Verified 2026-11-16". Local dev assumption: "uv installs Python 3.12".
- **Reality:**
  - PyPI latest is **uv 0.13.8** (2026-11-12). 0.12.7 is from 2026-08-27, and 0.13.0 came out on 2026-10-09, so the memlog check was wrong.
  - The uv 0.13.0 breaking changes include "Use Python 3.15 as the default stable version". Without a pin, uv uses or downloads 3.15 locally. Vercel supports only 3.12 (the default), 3.13 and 3.14.
  - Vercel's docs show `requires-python = ">=3.12"` as the way to set the version, but don't say how a range resolves.

  The result is that local runs on 3.15 and Vercel runs on 3.12, without anyone noticing. Wheels for psycopg-binary, pydantic-core and bcrypt exist for cp315, so nothing breaks at once. That makes the drift easy to miss.
- **Fix:** set Stack uv to `0.13.x`. Add `backend/.python-version` = `3.12` (`uv python pin 3.12`) and `requires-python = ">=3.12,<3.13"`, so local, CI and Vercel all use the same interpreter. Optionally add `[tool.uv] required-version = ">=0.13"`.
- **Sources:** https://pypi.org/project/uv/ · https://github.com/astral-sh/uv/releases/tag/0.13.0 · https://vercel.com/docs/functions/runtimes/python/python-version

### T2-2 Node 24 is no longer Vercel's default (26.x is)

- **Spine:** "Node.js 24 LTS".
- **Reality:** Vercel's Node page lists **26.x (default)**, 24.x and 22.x. Node 26 became LTS on 2026-10-28, and Node 24's active LTS ended on 2026-10-20 (it is now in maintenance until 2028-04-30). Without an `engines` pin, Vercel builds the frontend on 26 while developers run 24. Next 16.4.6 (`>=20.9.0`), Vitest 5.1 (`^22.12 || ^24 || >=26`) and concurrently 10 (`>=22`) all accept both.
- **Fix:** pick one major and pin it. Either keep 24 with `"engines": {"node": "24.x"}` in `frontend/package.json` and the root, plus `.nvmrc`, or move to 26 LTS (Vercel's default). Say which in the Stack table.
- **Sources:** https://vercel.com/docs/functions/runtimes/node-js/node-js-versions · https://endoflife.date/nodejs

### T2-3 Vercel Services: confirmed fit, but three details the spine gets wrong or leaves out

The current model is confirmed:

- Services are "available in Beta on all plans".
- The `services` key replaces the earlier `experimentalServices`.
- Vercel's own quick-start is a frontend service plus a backend with `"entrypoint": "main:app"`, and top-level rewrites `{"source": "/api/(.*)", "destination": {"service": "my_backend"}}` before a catch-all to the frontend.
- The Python runtime installs with uv and accepts `pyproject.toml` with or without `uv.lock`.
- Python 3.12 is still the default.
- The body limit is 4.5 MB (`413 FUNCTION_PAYLOAD_TOO_LARGE`).

What the spine gets wrong or leaves out:

1. **The entrypoint must be declared.** Vercel auto-detects only `app.py`/`index.py`/`server.py`/`main.py`/`wsgi.py`/`asgi.py` at the root, or in `src/` or `app/`. `backend/swp/main.py` isn't in any of those places. The Structural Seed should state `"backend": {"root": "backend/", "entrypoint": "swp.main:app"}` (or `[tool.vercel] entrypoint = "swp.main:app"` in `pyproject.toml`).
2. **The backend sees the full path.** "The service receives the original request path. `GET /api/users` reaches `my_backend` as `/api/users`." All FastAPI routers must therefore be mounted under `/api`, and the local Next rewrite must keep the prefix (`/api/:path*` → `http://127.0.0.1:8000/api/:path*`). Write this into AD-2 so nobody strips the prefix in one environment and not the other.
3. **"Backend preview deployments are off" can't be set per service.** Vercel "builds each service independently and creates one preview deployment for the commit". Env vars are scoped per environment (Production/Preview), not per service. There is no per-service preview switch. If `DATABASE_URL` is production-only, a preview backend falls back to `sqlite:///./var/swp.db` on a read-only function filesystem and crashes or fails strangely.

   Fix: scope `DATABASE_URL` and `JWT_SECRET` to Production only. Make the backend refuse to start when `VERCEL_ENV` is set and `DATABASE_URL` is unset (an extension of the existing refuse-to-start rule). Either accept that previews show a startup error, or turn off preview deployments for the whole project (or skip them with a per-service `ignoreCommand`).
- **Sources:** https://vercel.com/docs/services · https://vercel.com/docs/services/routing · https://vercel.com/docs/services/config-reference · https://vercel.com/docs/functions/runtimes/python · https://vercel.com/kb/guide/full-stack-preview-deployments-on-vercel · https://vercel.com/changelog/python-package-manager-uv-is-now-available-for-builds-with-zero

### T2-4 A paused Supabase free project doesn't wake up on its own; someone has to resume it

- **Spine / memlog:** "free projects pause after inactivity, so the README/demo check must allow for a wake-up".
- **Reality:** Supabase pauses a Free project with too little database activity over 7 days. Restoring it is manual ("Click **Resume project**" in the Dashboard), and it can be restored for up to 1 year. Until someone does that, the public demo (NFR-5) returns DB errors. Free also caps you at 2 active projects and 500 MB per database. Neon Free suspends compute after 5 min, but "reactivates automatically within a few hundred milliseconds" on the next query.
- **Fix:** change the assumption. Either switch the demo DB to Neon (Vercel Marketplace, auto-resume, same psycopg/NullPool setup), or keep Supabase and add a keep-alive: a daily Vercel cron (Hobby allows daily) calling a read-only `/api/health` that runs `SELECT 1`, plus a README step "if the demo shows a database error, resume the project in Supabase". If you choose Neon, AD-9's Supabase-specific pooler wording becomes "provider's pooled connection string".
- **Sources:** https://supabase.com/docs/guides/platform/free-project-pausing · https://supabase.com/docs/guides/platform/billing-on-supabase · https://neon.com/docs/introduction/scale-to-zero

### T2-5 AD-18 can't enforce the 4.5 MB limit on the server

- **Spine:** AD-18 says it "Prevents the Vercel 4.5 MB body limit surfacing as an unexplained 413". `MAX_UPLOAD_BYTES` is enforced "in app services".
- **Reality:** Vercel rejects bodies over 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE` before FastAPI runs, and that response is not in the AD-11 JSON shape. The server check only catches the 4.0–4.5 MB band.
- **Fix:** add a frontend pre-check of the summed file sizes against the same limit (exposed from a config endpoint or a `NEXT_PUBLIC_` value) before upload. Also make the API client map any non-JSON 413 to the `limit_reached` copy.
- **Source:** https://vercel.com/docs/functions/limitations#request-body-size

### T2-6 "SQLite serializes writes" doesn't protect read-modify-write

- **Spine:** AD-6: "lock the plan row (Postgres `SELECT … FOR UPDATE`; SQLite serializes writes)".
- **Reality:**
  - The SQLite dialect drops `with_for_update()`.
  - Python's `sqlite3` driver uses legacy transaction control by default (until Python 3.16). It emits no `BEGIN` before a `SELECT`, and SQLAlchemy's docs list "SERIALIZABLE behavior not fully functional" as a consequence.
  - Two concurrent commands on the same plan (two tabs, or the retry path in AD-12 overlapping a slow first attempt) can both read version N and both write. One appended step then disappears from the log, which breaks AD-5's append-only promise. That is worse than the "last write wins" AD-6 accepts.
- **Fix:** in `swp/store`, for SQLite use the documented recipe: set `isolation_level=None` on connect, and emit `BEGIN IMMEDIATE` from the `begin` event. On Python 3.12 an alternative is `connect_args={"autocommit": False}` plus an explicit `BEGIN IMMEDIATE`. Add a `busy_timeout`. Add one concurrency test in `tests/app`.
- **Source:** https://docs.sqlalchemy.org/en/21/dialects/sqlite.html#transactions-with-sqlite-and-the-sqlite3-driver

### T2-7 shadcn CLI 4 now defaults to Base UI, not Radix

- **Spine:** "shadcn/ui CLI (Radix) 4.23.0".
- **Reality:** the shadcn changelog (July 2026) says: "New projects now use Base UI by default. Radix is still fully supported." Running plain `shadcn init` (or `-d` in CI or by an agent) scaffolds Base UI components.
- **Fix:** write the exact command into the scaffold story: `npx shadcn@4.23.0 init -b radix`. Or switch to Base UI deliberately and drop "(Radix)". Either works with Tailwind 4.3.
- **Source:** https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default

### T2-8 httpx 0.28.1 is deprecated for FastAPI's TestClient; use httpx2

- **Spine:** "pytest / httpx (TestClient) 9.2.0 / 0.28.1".
- **Reality:** `starlette==1.10.0` (pulled in by FastAPI 0.163.1) `starlette/testclient.py` tries `import httpx2 as httpx` first. When it falls back, it warns: "Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead." (`StarletteDeprecationWarning`). httpx 0.28.1 is from 2024-12. If pytest runs with `filterwarnings = error`, every API test fails.
- **Fix:** replace httpx with **httpx2 2.16.2** (PyPI latest) in the dev dependency group.
- **Sources:** inspected `starlette-1.10.0-py3-none-any.whl` (`starlette/testclient.py` lines 21–42) · https://pypi.org/project/httpx2/ · https://httpx2.pydantic.dev/migration/

### T2-9 Postgres URL scheme and psycopg 3

- **Spine:** psycopg 3.3.9 "(binary; Postgres only)", `DATABASE_URL` from Supabase.
- **Reality:** Supabase and Neon hand out `postgresql://…`. In SQLAlchemy that selects the **psycopg2** driver, which isn't installed, so it raises `ModuleNotFoundError: psycopg2`. Psycopg 3 needs `postgresql+psycopg://`. "Postgres only" also suggests an optional extra, but Vercel installs only the project's main dependencies.
- **Fix:** have `swp/config.py` rewrite a `postgresql://` or `postgres://` prefix to `postgresql+psycopg://`. List `psycopg[binary]` as a main runtime dependency. On SQLite it's never imported, so it costs nothing locally. Keep `connect_args={"prepare_threshold": None}` and `poolclass=NullPool`. This is confirmed: psycopg's docs say to set `prepare_threshold=None` behind transaction poolers, and Supabase's docs say "The shared pooler doesn't support prepared statements in transaction mode".
- **Sources:** https://docs.sqlalchemy.org/en/21/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg · https://www.psycopg.org/psycopg3/docs/advanced/prepare.html · https://supabase.com/docs/guides/database/connecting-to-postgres

### T2-10 Function region and DB region are not stated

- **Reality:** Vercel Functions run in `iad1` (US East) by default. With `NullPool`, each command opens a new TLS connection and makes about 6–8 round trips (connect, BEGIN, SELECT … FOR UPDATE, UPDATE, COMMIT). If the DB is in an EU region, that adds hundreds of ms per command against NFR-8 (< 1 s).
- **Fix:** add a line to the Environments table: the function region and the DB region are the same (for example Vercel `fra1` with Supabase/Neon `eu-central-1`, or both in US East).
- **Source:** https://vercel.com/docs/functions/limitations (Regions: "Runs in a single region by default (`iad1`)")

## Tier 3 — notes and smaller risks

| # | Item | Finding | Suggested action | Source |
| --- | --- | --- | --- | --- |
| T3-1 | `@dnd-kit/core 6.3.1` | Version is current, but it hasn't been published since **2024-12-05** (about 23 months). The maintainer's work has moved to `@dnd-kit/react`, still pre-1.0 (0.5.3), and the migration guide treats core as the older API. Its peer `react >=16.8` accepts 19.3; no React 19 breakage was found. | Keep it (stable and widely used), but make the first FR-51 story a short spike of drag plus keyboard on the wall under React 19.3 and StrictMode. Keep the library behind `modules/locations` so a later switch to `@dnd-kit/react` 1.x or pragmatic-drag-and-drop stays local. | `npm view @dnd-kit/core time` · https://dndkit.com |
| T3-2 | openpyxl 3.1.5 | It is still the latest stable release (2024-06-28); `3.2.0b1` is an older 2022 beta, not a newer line. Classifiers stop at 3.11, but it works on 3.12. Its internal `datetime.utcnow()` raises a DeprecationWarning on 3.12+. | If pytest uses `filterwarnings = error`, ignore that warning for `openpyxl.*` only. In read-only mode, always `wb.close()`, and don't trust `ws.max_row` (dimensions can be missing or wrong). AD-8 says "values-only": that is `iter_rows(values_only=True)` together with `load_workbook(read_only=True, data_only=True)`. | https://pypi.org/project/openpyxl/ · https://foss.heptapod.net/openpyxl/openpyxl/-/issues/2051 |
| T3-3 | TypeScript 5.9.3 | **Confirmed correct choice.** `create-next-app@16.4.6` scaffolds `typescript: "^5"`, and `openapi-typescript@7.13.0` has peer `typescript: "^5.x"`. TS 6.0.3 and 7.0.2 (latest) would conflict with that peer. | Keep it. Note the reason in the Stack table so nobody "upgrades" to 7. | inspected `create-next-app-16.4.6.tgz` · `npm view openapi-typescript@7.13.0 peerDependencies` |
| T3-4 | PyJWT 2.15.1 / `JWT_SECRET` | From 2.11 on, PyJWT warns (`InsecureKeyLengthWarning`) when an HMAC key is shorter than recommended. From 2.13 on, it rejects empty keys outright. | Extend the refuse-to-start rule: in production, `JWT_SECRET` must be at least 32 bytes. Generate it with `python -c "import secrets;print(secrets.token_urlsafe(48))"`. | https://pyjwt.readthedocs.io/en/stable/changelog.html |
| T3-5 | Python 3.12 | It is still Vercel's default, but it has been security-fixes-only since 2025-04 (EOL 2028-10). 3.13 and 3.14 are available on Vercel. | 3.12 is fine for the semester. Choosing 3.14 is equally valid. The point is to pin it (T2-1). | https://endoflife.date/python |
| T3-6 | Alembic on SQLite | SQLite can't ALTER most column changes. Migrations that work on Postgres fail on SQLite unless they use batch mode. | Set `render_as_batch=True` in `env.py` for SQLite. Run `alembic upgrade head` on SQLite in CI (it already runs on local start). | https://alembic.sqlalchemy.org/en/latest/batch.html |
| T3-7 | JSON columns | SQLAlchemy `JSON` serializes with `json.dumps`, which fails on `Decimal`, `UUID` and `datetime`. It also doesn't track in-place mutation. | Store only `PlanState.model_dump(mode="json")` and always reassign the whole document. Don't mutate it in place, and don't use `MutableDict`. | https://docs.sqlalchemy.org/en/21/core/type_basics.html#sqlalchemy.types.JSON |
| T3-8 | Migrations against Supabase | Direct connections are IPv6 unless the project has the IPv4 add-on. The shared pooler is IPv4. | Run `uv run swp db upgrade` through the **session** pooler (port 5432 on the pooler host), not the transaction pooler and not the direct host. Put a separate `MIGRATION_DATABASE_URL` in `.env.example`. | https://supabase.com/docs/guides/database/connecting-to-postgres |
| T3-9 | Next.js 16 rewrite to `127.0.0.1:8000` | Confirmed: external rewrites work in `next dev`. `proxyClientMaxBodySize` (10 MB default) applies only when `proxy.ts` is used, and 4 MB is under it anyway. In production on Vercel, the top-level Services rewrite takes `/api/*` before Next runs. | Return the rewrite only when `NODE_ENV === "development"`, so a production build never proxies to localhost. As an option, `vercel dev --local` runs both services with no account (it could replace the concurrently setup if wanted). Keep `127.0.0.1`, not `localhost` (IPv6 `::1` resolution). | https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites · https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize · https://vercel.com/docs/services#local-development |
| T3-10 | Relative file paths on Vercel | Vercel: "The working directory is the base of your project, not the directory containing the file." It isn't documented whether that is the repo root or the service root under Services. | Load `settings/analysis.toml` and `alembic.ini` with paths built from `Path(__file__)`, never from the current directory. | https://vercel.com/docs/functions/runtimes/python#reading-relative-files |
| T3-11 | Frontend lint in CI | Next 16 removed `next lint`, and `next build` no longer runs ESLint. create-next-app 16.4.6 prompts for ESLint or Biome. The spine's CI runs typecheck and Vitest only. | Choose ESLint or Biome in the scaffold story and add it to CI. | https://nextjs.org/blog/next-16 · inspected `create-next-app-16.4.6.tgz` |
| T3-12 | Python bundle | Vercel bundles everything reachable under the service root, with no tree-shaking. | Put pytest, ruff and httpx2 in `[dependency-groups] dev`. Exclude `tests/**` with the service's `functions.excludeFiles`. | https://vercel.com/docs/functions/runtimes/python#controlling-what-gets-bundled |

## Confirmed current (no action)

Checked today against the registries:

| Package | Spine | Registry today | Notes |
| --- | --- | --- | --- |
| next | 16.4.6 | 16.4.6 | peer react `^19.0.0`, node `>=20.9.0` |
| react / react-dom | 19.3.1 | 19.3.1 | |
| tailwindcss | 4.3.5 | 4.3.5 | |
| @tanstack/react-query | 5.107.1 | 5.107.1 | peer react `^18 \|\| ^19` |
| zod | 4.6.7 | 4.6.7 | |
| sonner / lucide-react | 2.0.8 / 1.73.0 | same | peers accept React 19 |
| vitest | 5.1.0 | 5.1.0 | peer vite `^6.4 \|\| ^7 \|\| ^8` |
| @playwright/test | 1.65.1 | 1.65.1 | |
| shadcn | 4.23.0 | 4.23.0 | see T2-7 (default base changed) |
| openapi-typescript | 7.13.0 | 7.13.0 | peer TS `^5.x` (T3-3) |
| concurrently | 10.0.7 | 10.0.7 | node `>=22` |
| fastapi | 0.163.1 | 0.163.1 (2026-11-15) | needs python-multipart (T1-1) |
| uvicorn | 0.54.0 | 0.54.0 | local only |
| sqlalchemy | 2.1.8 | 2.1.8 | greenlet only with the `asyncio` extra, so the sync choice is lean |
| alembic | 1.20.1 | 1.20.1 | |
| pydantic / pydantic-settings | 2.14.3 / 2.16.3 | same | |
| psycopg(-binary) | 3.3.9 | 3.3.9 (2026-11-12) | T2-9 |
| openpyxl | 3.1.5 | 3.1.5 | T3-2 |
| pyjwt | 2.15.1 | 2.15.1 | T3-4 |
| bcrypt | 5.0.0 | 5.0.0 | T1-3 |
| pytest / ruff | 9.2.0 / 0.17.5 | same | |
| **uv** | **0.12.7** | **0.13.8** | **wrong in memlog** (T2-1) |
| **httpx** | **0.28.1** | 0.28.1, but superseded by httpx2 2.16.2 for the TestClient | T2-8 |

Fit checks that held up against live docs:

- Vercel Services: Beta on all plans; `services` key; `/api/(.*)` → `{service}` rewrite; `entrypoint: "module:app"`.
- Python runtime: uv installs, `uv.lock` supported, 3.12 the default.
- Function limits: 4.5 MB body, 300 s on Hobby.
- Supabase transaction pooler: port 6543, no prepared statements, IPv4.
- psycopg: `prepare_threshold=None`.
- SQLAlchemy 2.1: `Uuid` and `JSON` are generic types that work on both SQLite and Postgres (timestamps excepted, T1-2).
- The memlog was right to reject `@dnd-kit/react` (0.5.3, pre-1.0).
