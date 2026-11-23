# 11-2-key-colours-as-live-css-variables-kept-in-the-browser

## 2026-11-23 kl. 14:06 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 11.2: fargene i fargeforklaringen (Key) som levende CSS-variabler, lagret i nettleseren.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-11-2-key-colours-as-live-css-variables-kept-in-the-browser.md` (status `done`).
- Prompten tok med notatet fra Story 11.1 om ugyldige farger.

### Resultat
- Commits: `255680d1931bccd649584af09fc2505ffa204158` (Story 11.2), pluss sprint-commit «11-2 done».
- CSS-variabler:
  - åtte `:root`-variabler holder standardfargene fra DESIGN.md;
  - temaets tokens peker nå til dem, så ingen veggkomponent er endret.
- Lagring i nettleseren:
  - `frontend/lib/colours/storage.ts` lagrer fargene i localStorage under `swp:colours`;
  - alle lesinger og skrivinger er i try/catch;
  - ugyldige verdier forkastes før de brukes.
- Et skript i `<head>` setter de lagrede fargene før første tegning, så siden ikke blinker.
- `providers.tsx` setter dem én gang til etter hydrering.
- Ny Playwright-reise `frontend/e2e/key-colours.spec.ts`.
- Verifisering:
  - Vitest: 673 passed.
  - `lint` og `typecheck` er ok.
  - Playwright chromium: 124 passed.
  - Den første fulle e2e-kjøringen, før review, ga 1 feil i en ukjent test. To senere kjøringer ga 124/124.
- Review: 25 funn. 1 middels rotårsak og 5 lave ble rettet, blant annet at to åpne faner ikke lenger overskriver hverandres farger. Ingenting er utsatt.

### Åpne punkter
- En farge som endres i en annen fane, vises først etter at siden lastes på nytt.
- At fargene settes på nytt etter hydrering, er ikke testet i dev-modus.
- Når lagringen kan leses men ikke skrives, regnes den som tilgjengelig til første lagring feiler.
- Enda en e2e-kjøring feilet én gang uten kjent årsak. Det tyder på ustabile tester før milestone 2-porten.
