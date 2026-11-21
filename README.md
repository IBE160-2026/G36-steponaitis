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

Checks:

| Check | Command |
| --- | --- |
| Python lint (ruff) | `npm run lint:py` |
| Layer rules (import-linter) | `npm run lint:imports` |
| Frontend lint and module boundaries (ESLint) | `npm run lint` |
| TypeScript typecheck | `npm run typecheck` |
| Tests (pytest and Vitest) | `npm test` |
| End-to-end (Playwright, Chromium) | `npm run e2e -- --project=chromium` |

Before the first end-to-end run, install the browser once: `npx --workspace frontend playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs these same checks on every push, plus `tests/app` against Postgres 17. To run that locally, start Postgres (for example `docker run -d --name swp-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=swp_test -p 55432:5432 postgres:17`) and run `uv run --directory backend --locked pytest tests/app --database-url postgresql://postgres:postgres@localhost:55432/swp_test`; without `--database-url`, `tests/app` uses a temporary SQLite file. `docker run -d` returns before Postgres is ready, so wait until `docker exec swp-pg pg_isready` succeeds before running pytest, and remove the container afterwards with `docker rm -f swp-pg`.
