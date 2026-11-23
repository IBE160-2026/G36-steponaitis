# 12-2-drag-a-bin-on-the-wall-and-drop-it-on-an-empty-location

## 2026-11-23 kl. 16:50 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 12.2: dra en binge på veggen og slipp den på en tom plassering.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-12-2-drag-a-bin-on-the-wall-and-drop-it-on-an-empty-location.md` (status `done`).
- Prompten ba om at den nye e2e-testen også kjøres i firefox og msedge.

### Resultat
- Commits: `6499d88b5d891fa10bb3a6a2b951c8d463ae0ede` (Story 12.2), pluss sprint-commit «12-2 done».
- Ny avhengighet `@dnd-kit/core@6.3.1`, med fast versjon. Den er nevnt i arkitekturen (`technology.md`).
- Retro-punkt 89 fra epic 10 er delvis løst:
  - `WallCell` er skilt ut;
  - `AisleMode` og `LocationsWall` er flyttet ut av `locations-page.tsx`;
  - de andre delpunktene står åpne.
- Ny Playwright-reise `frontend/e2e/drag.spec.ts`.
- Verifisering:
  - `lint`, `typecheck`, `lint:py` og `lint:imports` (5 kontrakter) er ok.
  - Vitest: 702 passed. pytest: 996 passed og 2 hoppet over.
  - Playwright chromium: 128 passed.
  - `drag.spec.ts` i firefox og msedge: 6 passed.
- `drag.spec.ts:128` feilet i de to første fulle kjøringene:
  - testen antok at ingen tooltip var synlig etter Escape, men en celle med fokus beholder tooltipen sin;
  - steget sjekker nå bare at den festede dialogen er borte.
- Review: 36 funn, ingen høye eller middels. 6 lave ble rettet. Ingen oppfølgingsreview anbefales.

### Åpne punkter
Ingen nye.
