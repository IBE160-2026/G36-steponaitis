# 7-2-apply-a-recommendation-with-another-location

## 2026-11-22 kl. 22:35 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 7.2: bruk en anbefaling med en annen plassering.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-7-2-apply-a-recommendation-with-another-location.md` (status `done`, oppfølgingsreview anbefalt).

### Resultat
- Commits: `ec62d2d9b41259ebdedb8b13648d4a9f681559af` (Story 7.2), pluss sprint-commit «7-2 done».
- Ny Playwright-reise `frontend/e2e/other-location.spec.ts`.
- Retro-punkt 45 fra epic 5 er delvis løst:
  - det finnes nå én felles konstant for klassene slow og dead;
  - utdatert-sjekken og den nye plasseringslista bruker samme regelsjekk;
  - punktet står likevel åpent, fordi regelutvalget i `rules.py` fortsatt har egne vilkår.
- Verifisering:
  - lint (py, imports, ESLint), `typecheck` og `ruff format --check` er ok; `gen:api` er stabilt.
  - pytest: 631 passed og 12 hoppet over. Vitest: 339 passed.
  - Playwright chromium: 77 passed.
- Review: 32 funn, ingen høye. 2 middels og 6 lave ble rettet:
  - det manglet tester i ekte nettleser for klikk og skriving i plasseringslista;
  - lista ble hengende på «Loading locations…» når kallet feilet.

### Åpne punkter
- Oppfølgingsreview er anbefalt for Story 7.2. Rettelsene i plasseringspopupen er ikke gjennomgått på nytt.
