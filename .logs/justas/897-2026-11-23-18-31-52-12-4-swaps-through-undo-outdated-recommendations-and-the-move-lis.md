# 12-4-swaps-through-undo-outdated-recommendations-and-the-move-lis

## 2026-11-23 kl. 18:31 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 12.4: bytter gjennom Undo, utdaterte anbefalinger og flyttelista.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-12-4-swaps-through-undo-outdated-recommendations-and-the-move-list.md` (status `done`).
- Prompten tok med de utsatte punktene fra 8.2 (retro-punkt 72 fra epic 8) og 12.1.

### Resultat
- Commits: `562f39ea49f33a11d295e9efa74e60c25490ddec` (Story 12.4), pluss sprint-commit «12-4 done».
- Bytter som er delvis angret (utsatt fra 8.2):
  - hvert byttesteg lagrer nå størrelsen på byttet;
  - flyttelista merker et bytte bare mens alle stegene står;
  - et delvis angret bytte skrives ut som vanlige Manual-linjer.
- `swap_made.move_numbers` lister nå bare steg som står som eget flytt (utsatt fra 12.1). Toasten for et bytte kan derfor si «1 manual move» eller «0 manual moves». Playwright-reisen fra 12.3 regner ut forventet antall fra oppsettet sitt.
- De to utsatte punktene i `issues.md` er lukket.
- Regelen for samme del (FR-34/FR-38) er urørt.
- Verifisering:
  - `lint:py`, `lint:imports` (5 kontrakter), `lint` og `typecheck` er ok; `gen:api`-diffen er committet.
  - pytest: 1004 passed og 2 hoppet over. Vitest: 713 passed.
  - Playwright chromium: 130 passed.
  - `drag.spec.ts` i firefox og msedge: 10 passed.

### Åpne punkter
Ingen nye.
