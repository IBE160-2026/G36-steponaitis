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

To try accounts, start with `FEATURE_AUTH=true npm run dev`: every page then needs a login. Log in as `demo` with the password `demo`; this account is created when the backend starts (set `DEMO_PASSWORD` before the first start to choose another password). A local install has no Demo version button.

Checks:

| Check | Command |
| --- | --- |
| Python lint (ruff) | `npm run lint:py` |
| Layer rules (import-linter) | `npm run lint:imports` |
| Frontend lint and module boundaries (ESLint) | `npm run lint` |
| Python format (ruff) | `uv run --directory backend --locked ruff format --check` |
| TypeScript typecheck | `npm run typecheck` |
| Tests (pytest and Vitest) | `npm test` |
| End-to-end, all browsers (Playwright: Chromium, Firefox, Edge) | `npm run e2e` |
| End-to-end, Chromium only (what CI runs) | `npm run e2e -- --project=chromium` |

Before the first end-to-end run, install the browsers once: `npx --workspace frontend playwright install chromium firefox`. The Edge project uses the installed Microsoft Edge; if it is missing, install it from https://www.microsoft.com/edge or with `npx --workspace frontend playwright install msedge`. Playwright builds and starts the app itself on port 3000 (stop `npm run dev` first) against `backend/var/e2e.db`, which is deleted each time Playwright starts the server itself (a server already running on port 3000 is reused as it is).

CI (`.github/workflows/ci.yml`) runs these same checks on every push, plus `tests/app` against Postgres 17. To run that locally, start Postgres (for example `docker run -d --name swp-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=swp_test -p 55432:5432 postgres:17`) and run `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:55432/swp_test`; without `--database-url`, `tests/app` uses a temporary SQLite file. `docker run -d` returns before Postgres is ready, so wait until `docker exec swp-pg pg_isready` succeeds before running pytest, and remove the container afterwards with `docker rm -f swp-pg`.

## Milestone 1 demo

A step-by-step walk through milestone 1 (Epics 1–5) on the synthetic files in `data/sample/`. The public deployment holds synthetic data only; real company data is never uploaded there or committed here.

1. **Install:** `npm install` (Node.js 24, uv and Python 3.12 as in *Run locally*).
2. **Start:** `npm run dev`, then open http://localhost:3000.
3. **New Plan:** choose **New Plan**, type a plan name and pick the three files from `data/sample/`: `Locations.xlsx` for Locations, `Inventory.xlsx` for Inventory and `transactions.xlsx` for Transactions. Press **New Plan**. The plan opens on **Overview** with "Data as of 2026-09-30".
4. **Look around:** **Parts** lists every part with its class (fast, medium, slow, dead) and picks; **Pick groups** lists the parts that are picked together; **Locations** shows occupancy per aisle.
5. **Best locations:** open **Best locations**. With **Whole aisle** selected, pick aisle `A` and press **Mark aisle A**. Then choose **Level**, pick level `1`, choose **in all aisles** and press **Mark level 1 in all aisles**.
6. **Run recommendations:** open **Recommendations** and press **Run recommendations**. Round 1 lists the moves under rule 1, rule 2 and rule 3, each with its reason in numbers, plus the "no space" entries.
7. **Apply:** select a recommendation and press **Apply** (or `Alt`/`⌥`+`A`). A toast confirms "Applied · move 1, round 1 · …". **Apply all (n)** applies every open recommendation of the run at once.
8. **Manual move (optional):** search for a part (`Ctrl`+`/`), open it, press **Manual move…**, type an empty to-location and confirm.
9. **Before/after:** open **Before/after** to see, per aisle, which parts moved in and out, fast-moving parts in best locations, pick groups kept together and occupancy, before → after.
10. **Run every check:**

    ```sh
    npm run lint:py
    uv run --directory backend --locked ruff format --check
    npm run lint:imports
    npm run lint
    npm run typecheck
    npm test
    npx --workspace frontend playwright install chromium firefox   # once; Edge as above
    npm run e2e
    ```

    `npm test` includes the answer-key suite (`backend/tests/domain/test_answer_key.py`: answer-key steps 1–14; steps 15–20, the move list, the final current locations, the final before/after and the settled check show as skipped until Epics 7 and 8) and the timing check (`backend/tests/app/test_nfr8_timing.py`: import under 10 s, a run under 5 s, one command plus the plan views under 1 s in total). `npm run e2e` includes `frontend/e2e/m1-flow.spec.ts`, which in Chromium, Firefox and Edge goes through New Plan, Overview, Parts, Pick groups, the aisle A and level 1 marks, a run, applying one recommendation, one manual move and Before/after.
