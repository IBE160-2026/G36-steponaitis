# 7-4-reset-the-planning-copy

## 2026-11-22 kl. 23:40 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 7.4: tilbakestill plankopien (Reset).

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-7-4-reset-the-planning-copy.md` (status `done`).

### Resultat
- Commits: `5395cd1d9d1a3eb121d07873c44a384f467b41a0` (Story 7.4), pluss sprint-commit «7-4 done».
- Ny Playwright-reise `frontend/e2e/reset.spec.ts` («uj3 resets the planning copy»).
- Retro-punkter som er tatt hensyn til:
  - epic 4: 31 og 36;
  - epic 5: 43 og 46;
  - epic 6: 54 og 56.
- Verifisering:
  - lint (py, imports, ESLint), `typecheck` og `ruff format --check` er ok; `gen:api` er stabilt.
  - pytest: 662 passed og 10 hoppet over. Vitest: 373 passed.
  - Playwright chromium: 79 passed.
- Review: 29 funn. 1 middels og 3 lave ble rettet:
  - e2e sjekker nå at en reset sender siden tilbake til Open-fanen;
  - en reset fjerner en gammel «run failed»-melding;
  - en test låser rekkefølgen på handlingene i launcheren.

### Åpne punkter
- To designvalg i spec-en (Design Notes) bør bekreftes:
  - «N moves» i dialogen og toasten teller flytt slik planleggeren ser dem. Et kombinert flytt teller én gang, og et flytt som er angret ved å flytte delen tilbake, teller null.
  - En reset av en plan uten noe å tilbakestille gjør ingenting. Den gir ingen `plan_reset`-hendelse og ingen ny versjon, selv om akseptkriteriet nevner hendelsen uten unntak. Klienten viser likevel «Plan reset. 0 moves removed; …».
- `LAUNCHER_ACTIONS` er ikke dokumentert i AGENTS.md. Punktet er utsatt og ligger allerede under retro-punkt 56 fra epic 6.
