# 9-7-production-like-auth-configuration-readme-and-secrets

## 2026-11-23 kl. 06:50 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 9.7: produksjonslik oppsett av innlogging, README og hemmeligheter. Dette er siste story i epic 9.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-9-7-production-like-auth-configuration-readme-and-secrets.md` (status `done`).
- Prompten tok med de utsatte punktene fra 9.1, 9.5 og 9.6.
- Den forbød deploy, Vercel, Supabase, eksterne kontoer og ekte hemmeligheter.

### Resultat
- Commits: `c4cf71b3a6c282ce80742b6a01ff16e0f6b90b79` (Story 9.7), pluss sprint-commit «9-7 done». Epic 9 er satt til `done`.
- Ny oppstartssjekk med `APP_ENV=production`. Den nekter å starte, med én loggmelding per feil, når:
  - `JWT_SECRET` er tom, en standardverdi som ligger i repoet, eller kortere enn 32 byte (utsatt fra 9.1);
  - `DEMO_PASSWORD` ikke er satt (utsatt fra 9.5).
- `swp db upgrade` bruker `MIGRATION_DATABASE_URL` når den er satt.
- Ny `backend/.env.example` med bare plassholdere. En test sjekker at den lister alle innstillinger.
- README har fått en engelsk seksjon: «Accounts, secrets and the public demo».
- Ny Playwright-konfig `playwright.production.config.ts` og skriptet `npm run e2e:production`:
  - den bygger og starter appen produksjonslikt, med `FEATURE_AUTH` og `FEATURE_DEMO` på og engangshemmeligheter for hver kjøring;
  - den går gjennom UJ-5 med det ekte demo-flagget (utsatt fra 9.6) og sjekker at øktcookien er Secure og HttpOnly;
  - CI kjører også dette steget.
- De tre utsatte punktene i `issues.md` er lukket.
- Verifisering:
  - `lint:py`, `ruff format --check` og `lint:imports` er ok.
  - pytest: 887 passed og 2 hoppet over.
  - `tests/app` mot lokal `postgres:17`: 295 passed og 3 hoppet over.
  - `lint` og `typecheck` er ok. Vitest: 458 passed.
  - Playwright chromium: 102 passed. `e2e:production`: 2 passed.
  - `git grep` etter `JWT_SECRET=` og `DEMO_PASSWORD=` finner bare plassholdere og testverdier.
- Review: 29 funn, ingen høye. 1 middels og 4 lave ble rettet. Det middels funnet: aktive linjer i `.env.example` ville ha blitt regnet som bevisst satt i produksjon. De er nå kommentert ut.

### Åpne punkter
- En ugyldig innstilling, for eksempel et `DEMO_PASSWORD` som Log in ville avvist, gir en pydantic-traceback som viser verdien, i stedet for en linje som begynner med «Refusing to start». Prosessen nekter likevel å starte.
- AGENTS.md nevner ikke `npm run e2e:production`.
