# G36 — JayJay

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Applikasjon

Applikasjonen er publisert på Vercel: https://g36steponaitis.vercel.app

## Demo og data

Den offentlige demoen inneholder **bare syntetiske demodata**. Ekte firmadata lastes aldri opp dit. Demofilene ligger i `data/sample/` (`Locations.xlsx`, `Inventory.xlsx`, `transactions.xlsx`) og lages av `data/generate_demo_data.py`.

Slik kommer du inn i appen:

- **Demo version** på forsiden: hopper over innloggingen og åpner appen med demokontoen.
- **Log in** med demokontoen: brukernavn `demo`, passord `demo`.
- **Create account**: lag din egen konto med brukernavn og passord (ingen e-post).

Første gang: velg **New Plan** og last opp de tre filene fra `data/sample/`. En lokal installasjon har ingen forside og ingen Demo version; logg inn med demokontoen.

## Medlemmer

- Justas Steponaitis

## Run locally

Prerequisites: Node.js 24, [uv](https://docs.astral.sh/uv/) and Python 3.12 (`uv python install 3.12`). No environment variables, accounts or Docker are needed.

```sh
npm install   # installs the frontend workspace and runs `uv sync` for the backend
npm run dev   # FastAPI on http://127.0.0.1:8000, Next.js on http://localhost:3000
```

Open http://localhost:3000. The browser calls `/api/*` on port 3000, which Next.js forwards to the backend. The local SQLite database is created at `backend/var/swp.db`.

To try accounts, see *Accounts, secrets and the public demo* below.

Checks:

| Check | Command |
| --- | --- |
| Python lint (ruff) | `npm run lint:py` |
| Layer rules (import-linter) | `npm run lint:imports` |
| Frontend lint and module boundaries (ESLint) | `npm run lint` |
| Python format (ruff) | `uv run --directory backend --locked ruff format --check` |
| TypeScript typecheck | `npm run typecheck` |
| Tests (pytest and Vitest) | `npm test` |
| Requirement traceability (SM-7) | `npm run trace` |
| End-to-end, all browsers (Playwright: Chromium, Firefox, Edge) | `npm run e2e` |
| End-to-end, Chromium only (what CI runs) | `npm run e2e -- --project=chromium` |
| End-to-end, production-like build with the demo on (Chromium, also in CI) | `npm run e2e:production` |
| End-to-end against the public deployment, after a deploy (Chromium, by hand only) | `npm run e2e:public` |

Before the first end-to-end run, install the browsers once: `npx --workspace frontend playwright install chromium firefox`. The Edge project uses the installed Microsoft Edge; if it is missing, install it from https://www.microsoft.com/edge or with `npx --workspace frontend playwright install msedge`. Playwright builds and starts the app itself on port 3000 (stop `npm run dev` first) against `backend/var/e2e.db`, which is deleted each time Playwright starts the server itself (a server already running on port 3000 is reused as it is).

CI (`.github/workflows/ci.yml`) runs these same checks on every push, plus `tests/app` against Postgres 17. To run that locally, start Postgres (for example `docker run -d --name swp-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=swp_test -p 55432:5432 postgres:17`) and run `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:55432/swp_test`; without `--database-url`, `tests/app` uses a temporary SQLite file. `docker run -d` returns before Postgres is ready, so wait until `docker exec swp-pg pg_isready` succeeds before running pytest, and remove the container afterwards with `docker rm -f swp-pg`.

## Accounts, secrets and the public demo

Accounts are off by default. To try them locally, start with `FEATURE_AUTH=true npm run dev`: every page then needs a login. Or copy `backend/.env.example` to `backend/.env` (git ignores it; its only active line turns `FEATURE_AUTH` on, the rest are commented placeholders) and export it before starting:

```sh
cp backend/.env.example backend/.env
set -a; . backend/.env; set +a; npm run dev
```

Log in as `demo` with the password `demo`. This demo account is created when the backend starts or `swp db upgrade` runs (set `DEMO_PASSWORD` before the first start to choose another password). The same seed loads the starter categories with `demo`: the keyword rules and aisle categories in `backend/settings/starter_categories.toml`, drafted from the synthetic `data/sample/` files, stored only when both category lists are empty, so the planner's own rules and aisle categories are never overwritten. If both lists are emptied, the next backend start (or `swp db upgrade`) loads the starter list again. A local install has no front page and no Demo version button.

Every setting is a backend environment variable; `backend/.env.example` lists them all with placeholder values only. Never commit a real value. The frontend reads no environment variable: it gets the flags at runtime from `GET /api/session`, so there is no frontend example file.

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_ENV` | `local` or `production`. Local migrates and seeds on startup; production does not and runs the checks below. | `local` |
| `FEATURE_AUTH` | Accounts and login; every page needs a session. Off: everyone acts as `planner`. | `false` |
| `FEATURE_DEMO` | Public demo: the front page, Demo version and the demo limits. | `false` |
| `DEMO_PASSWORD` | Password of the seeded `demo` account, used only when the account is first created. The public demo publishes `demo` on purpose. | `demo` |
| `DATABASE_URL` | App database. `postgresql://` URLs use psycopg 3. | SQLite at `backend/var/swp.db` |
| `MIGRATION_DATABASE_URL` | Connection `swp db upgrade` migrates through, e.g. a direct Postgres connection when `DATABASE_URL` goes through a pooler. It must name the same database as `DATABASE_URL` (the seed uses `DATABASE_URL`). | `DATABASE_URL` |
| `JWT_SECRET` | Key that signs the `swp_session` cookie. | a local development key |
| `MAX_UPLOAD_BYTES` | Largest upload in bytes. | `4000000` |
| `MAX_ROWS_PER_FILE` | Most rows read from one file. | `25000` |
| `MAX_PLANS` | Most saved plans while `FEATURE_DEMO` is on. | `50` |
| `MAX_ACCOUNTS` | Most accounts while `FEATURE_DEMO` is on. | `200` |

Known limit: **Apply all** runs as one request. On an import near the row limit, with thousands of recommendations, it can take minutes and time out on the public deployment. Apply recommendations a group at a time there. The files in `data/sample/` are well within the limit.

The backend (and `swp db upgrade`) refuses to start, logging one `Refusing to start: …` line per problem, when:

1. `VERCEL` is set and `APP_ENV` is not `production` (the platform sets `VERCEL`);
2. `APP_ENV` is anything other than `local` or `production`;
3. in production, `JWT_SECRET` is empty, the local default, the `.env.example` placeholder or shorter than 32 bytes;
4. in production, `DEMO_PASSWORD` is not set;
5. in production, `DATABASE_URL` is not set, empty or only blanks;
6. in production on Vercel (`VERCEL` set), `DATABASE_URL` is a SQLite database: Vercel's disk is read-only and temporary. Off Vercel, production on SQLite still starts (`npm run e2e:production` runs that way);
7. any setting has an invalid value (for example a `DEMO_PASSWORD` shorter than the Log in form allows, or a `MAX_PLANS` that is not a positive number). The line names the setting and the reason, never the value.

Generate a `JWT_SECRET` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. `swp db upgrade` migrates through `MIGRATION_DATABASE_URL` when it is set, otherwise `DATABASE_URL`, but seeds `demo` and the starter categories through `DATABASE_URL`, so both must name the same database; the running app always uses `DATABASE_URL`.

`npm run e2e:production` runs the same checks locally: Playwright builds and starts the app with `APP_ENV=production`, `FEATURE_AUTH` and `FEATURE_DEMO` on and throwaway secrets it generates for that run, then walks the examiner journey (front page, Demo version as `demo`, Log out, Log in as `demo` with that run's password, the Secure session cookie). It never reuses a running server, so stop `npm run dev` first. `npm run e2e:public` runs the same tests against the public deployment (or the origin in `PUBLIC_URL`; set `E2E_DEMO_PASSWORD` too if that deployment's demo password is not `demo`) with the password `demo`. It starts no server and creates no plan and no new account (Demo version recreates the `demo` account if its row is missing); Log in writes and clears one login-attempts row. Run it by hand after a deploy. It is not part of CI, which finishes before Vercel deploys.

The public deployment at https://g36steponaitis.vercel.app holds synthetic data only (the files in `data/sample/`); real company data is never uploaded there or committed here. *Deploy* below sets it up with `APP_ENV`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET`, `DEMO_PASSWORD`, `FEATURE_AUTH` and `FEATURE_DEMO`. Its `DEMO_PASSWORD` is `demo` and published on purpose, so examiners can Log in as `demo`/`demo`: Demo version already gives the same access without a password. `JWT_SECRET` and the connection strings stay secret. Because the login is public, anyone can type five wrong passwords for `demo`; Log in as `demo` then answers "Too many failed logins for this username. Wait a minute and try again." for a minute, while **Demo version** is never throttled.

## Deploy

The public URL https://g36steponaitis.vercel.app is one Vercel project with two services from `vercel.json`: the Next.js app in `frontend/` and the FastAPI backend in `backend/` (`swp.main:app`). Requests to `/api/*` go to the backend with their path unchanged; everything else goes to Next.js, so the browser keeps calling relative `/api/*` on one origin. Only `main` deploys (to Production); preview deployments are off. The steps below are done once, by hand, in the Supabase and Vercel dashboards. Never commit a connection string or password.

1. **Supabase:** create a project (free plan) and note its database password. Under *Connect*, copy two connection strings:
   - the **transaction pooler** (port `6543`): the app's `DATABASE_URL`. The backend uses no connection pool and no prepared statements on Postgres, as this pooler requires;
   - the **session pooler** (port `5432`): `MIGRATION_DATABASE_URL`, which `swp db upgrade` migrates through.

   Both name the same database. Put the password into each and URL-encode special characters.
2. **Migrate and seed (first time, and before every deploy that changes the schema):** production does not migrate or seed on startup, so run from the repo root, with the values only in your shell:

   ```sh
   APP_ENV=production JWT_SECRET=… DEMO_PASSWORD=demo \
     DATABASE_URL='postgresql://…:6543/postgres' MIGRATION_DATABASE_URL='postgresql://…:5432/postgres' \
     uv run --directory backend --locked swp db upgrade
   ```

   The line holds the database password and secrets, so keep it out of your shell history: start it with a space (zsh: `setopt HIST_IGNORE_SPACE`; bash: `HISTCONTROL=ignorespace`) or delete the line from the history afterwards. Run the upgrade *before* pushing a commit that contains a new migration: every push to `main` deploys at once, so pushing first means the new code briefly runs against the old schema.

   It migrates through `MIGRATION_DATABASE_URL` and seeds the `demo` account and the starter categories through `DATABASE_URL`. The startup checks need `JWT_SECRET` and `DEMO_PASSWORD` even here: use the same values you store in Vercel in step 4. `DEMO_PASSWORD` sets the password the `demo` account is created with on this first run and is never applied again, so keep it identical in both places. On the public deployment it is `demo`, which is published on purpose; `JWT_SECRET` and the database password stay out of the repo. Migrations only add, so the running deployment keeps working against the upgraded schema.
3. **Vercel project:** *Add New → Project*, import this GitHub repository and keep the repository root as the root directory; Vercel reads `vercel.json` and builds both services (Python dependencies from `backend/pyproject.toml` and `uv.lock`).
4. **Environment variables** (*Settings → Environment Variables*), each for **Production** only:
   - `APP_ENV=production`
   - `DATABASE_URL` (transaction pooler) and `MIGRATION_DATABASE_URL` (session pooler)
   - `JWT_SECRET`: generate it with `python -c "import secrets; print(secrets.token_urlsafe(48))"` (at least 32 bytes)
   - `DEMO_PASSWORD=demo`: the demo account's public password, the same value as in step 2
   - `FEATURE_AUTH=true`: accounts and Log in
   - `FEATURE_DEMO=true`: the demo front page, Demo version and the demo limits

   Production refuses to start without `APP_ENV=production`, `DATABASE_URL`, `JWT_SECRET` or `DEMO_PASSWORD` (see *Accounts, secrets and the public demo*). `MIGRATION_DATABASE_URL` is not checked: it is what `swp db upgrade` migrates through, and without it the upgrade falls back to `DATABASE_URL`, the transaction pooler, which must not be used for migrations. The frontend reads both flags at runtime from `GET /api/session`, so a redeploy is all they need.
5. **Deploy:** push to `main` (or *Redeploy* the latest Production deployment after changing a variable). Then check:
   - https://g36steponaitis.vercel.app/api/health answers `{"status":"ok"}`;
   - https://g36steponaitis.vercel.app opens on the demo front page (Log in, Create account, Demo version);
   - **Demo version** opens Saved plans as `demo`, and **Log out** returns to the front page;
   - **Log in** with `demo`/`demo` opens Saved plans as `demo`;
   - leftover test plans (e.g. «Testing») are deleted under Saved plans;
   - `npm run e2e:public` passes with 0 failed and 0 flaky. A Log in failure with "Too many failed logins" means someone locked `demo` for a minute: wait a minute and rerun.

   **Upgrade note:** the seed never changes an existing `demo` row, so a `demo` account created with an older `DEMO_PASSWORD` keeps that password. Delete its row in Supabase (*Table Editor → `users`*; nothing references it by foreign key, and plans keep their creator name); the next **Demo version** click recreates it with the current `DEMO_PASSWORD`. Click **Demo version** once before running `npm run e2e:public`, so its Log in test does not run before the row exists. Existing `demo` sessions end, because the new row has a new id.
6. **Keep-alive:** a free Supabase project pauses after a week without traffic. `.github/workflows/keep-alive.yml` runs three checks once a day: `GET /api/health` (which runs `SELECT 1`), `GET /api/session` (both `feature_auth` and `feature_demo` must be `true`) and `POST /api/auth/demo` (Demo version must log in as `demo`; it writes nothing while the `demo` row exists). Run it by hand under *Actions → Keep-alive → Run workflow* after the first deploy. A failed run means the site or the database is down, `FEATURE_AUTH` or `FEATURE_DEMO` was dropped from the Vercel settings, or Demo version is broken; GitHub emails the repository owner. GitHub disables scheduled workflows after 60 days without repository activity: re-enable it under *Actions → Keep-alive*. A project that has already paused does not wake from an HTTP request; restore it in the Supabase dashboard.

## Milestone 2 demo

A step-by-step walk through milestone 2 (Epics 1–12) on the synthetic files in `data/sample/`. The public deployment holds synthetic data only; real company data is never uploaded there or committed here.

1. **Install:** `npm install` (Node.js 24, uv and Python 3.12 as in *Run locally*).
2. **Start:** `npm run dev`, then open http://localhost:3000.
3. **New Plan:** choose **New Plan**, type a plan name and pick the three files from `data/sample/`: `Locations.xlsx` for Locations, `Inventory.xlsx` for Inventory and `transactions.xlsx` for Transactions. Press **New Plan**. The plan opens on **Overview** with "Data as of 2026-09-30".
4. **Look around:** **Parts** lists every part with its class (fast, medium, slow, dead) and picks; the class buttons filter the list. **Pick groups** lists the parts that are picked together; **Locations** shows the bin wall per aisle (**One aisle**) or the whole warehouse (**Whole warehouse**).
5. **Best locations:** open **Best locations** and press **Open as list**. Pick aisle `A` and press **Mark aisle A**. Then choose **Level**, pick level `1`, choose **in all aisles** and press **Mark level 1 in all aisles**. (The step also opens as a wall where you mark by clicking.)
6. **Run recommendations:** open **Recommendations** and press **Run recommendations**. Round 1 lists the moves under rule 1, rule 2 and rule 3, each with its reason in numbers and a crop of the wall, plus the "no space" entries.
7. **Apply:** select a recommendation and press **Apply** (or `Alt`/`⌥`+`A`). A toast confirms "Applied · move 1, round 1 · …". **Apply all (n)** applies every open recommendation of the run at once.
8. **Planning copy — manual move and undo:** search for a part (`Ctrl`+`/`), open it, press **Manual move…**, type an empty to-location and confirm. The remaining recommendations that the move touches show as outdated. **Undo last move** in the Recommendations header (or **Undo** in the toast) takes back the latest move, one move at a time.
9. **Drag on the wall:** open **Locations**, keep **One aisle**, and drag a bin with the mouse onto an empty location to move it, or onto an occupied one and choose **Swap** (or **Put together**). A swap is two manual moves; undo takes them back one at a time. Every drag move can also be made with the keyboard through **Manual move…**.
10. **Before/after:** open **Before/after** to see, per aisle, which parts moved in and out, fast-moving parts in best locations, pick groups kept together and occupancy, before → after.
11. **Move list and print:** open **Move list**. It lists every move by round in walking order, with the rule (or Manual, and "Swap 1/2" for a swap). Press **Print** for the black-and-white A4 list.
12. **Category check:** press `Ctrl`+`K`, type `CAT` and open **Categories**. **Keyword rules** already holds the starter rules (for example `filter` → Filters) and **Aisle categories** gives each aisle A–I its categories, so there is nothing to set up. Press **Category check**: it lists the parts whose category is not among their aisle's categories, with a count line "… parts outside their aisle's categories · 0 aisles without categories". Most parts show up there, because the synthetic data places parts in random locations; on real data the list is short. Open a part to move it, as in step 8.
13. **Run every check:**

    ```sh
    npm run lint:py
    uv run --directory backend --locked ruff format --check
    npm run lint:imports
    npm run lint
    npm run typecheck
    npm test
    npm run trace
    npx --workspace frontend playwright install chromium firefox   # once; Edge as above
    npm run e2e
    npm run e2e:production
    ```

    `npm test` includes the answer-key suite (`backend/tests/domain/test_answer_key.py`, all 20 answer-key steps, the move list and the final state, with no skips), the timing check (`backend/tests/app/test_nfr8_timing.py`: import under 10 s, a run under 5 s, one command plus the plan views under 1 s in total, and every plan view under 4 MB on a generated import at `MAX_ROWS_PER_FILE`) and the traceability check. `npm run trace` prints every core requirement (FR-1–FR-40, FR-42, FR-50, FR-51) and every NFR with the test names that carry its ID, and fails if a core FR has no test (SM-7). `npm run e2e` includes `frontend/e2e/sm2-flow.spec.ts`, which in Chromium, Firefox and Edge goes through New Plan, Overview, Parts, Pick groups, the aisle A and level 1 marks, a run, applying one recommendation, one manual move, Before/after and the Move list with its print layout.

Still to do before submission (SM-2): someone outside the group follows this README from a clean checkout and runs the demo flow.
