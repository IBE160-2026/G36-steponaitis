# G36 — JayJay

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Applikasjon

Applikasjonen er publisert på Vercel: https://g36steponaitis.vercel.app

## Demo og data

Den offentlige demoen inneholder **bare syntetiske demodata**. Ekte firmadata lastes aldri opp dit. Demofilene ligger i `data/sample/` (`Locations.xlsx`, `Inventory.xlsx`, `transactions.xlsx`) og lages av `data/generate_demo_data.py`.

Slik kommer du inn i appen (når innloggingen er bygget, milestone 2):

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
| `DEMO_PASSWORD` | Password of the seeded `demo` account, used only when the account is first created. | `demo` |
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
5. in production, `DATABASE_URL` is not set;
6. any setting has an invalid value (for example a `DEMO_PASSWORD` shorter than the Log in form allows, or a `MAX_PLANS` that is not a positive number). The line names the setting and the reason, never the value.

Generate a `JWT_SECRET` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. `swp db upgrade` migrates through `MIGRATION_DATABASE_URL` when it is set, otherwise `DATABASE_URL`, but seeds `demo` and the starter categories through `DATABASE_URL`, so both must name the same database; the running app always uses `DATABASE_URL`.

`npm run e2e:production` runs the same checks locally: Playwright builds and starts the app with `APP_ENV=production`, `FEATURE_AUTH` and `FEATURE_DEMO` on and throwaway secrets it generates for that run, then walks the examiner journey (front page, Demo version as `demo`, Log out). It never reuses a running server, so stop `npm run dev` first.

The public deployment at https://g36steponaitis.vercel.app holds synthetic data only (the files in `data/sample/`); real company data is never uploaded there or committed here. Setting its Vercel environment variables is Story 16.2.

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
