# 12-1-drag-commands-expand-into-manual-moves-on-the-server

## 2026-11-23 kl. 15:51 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 12.1: dra-kommandoer gjøres om til manuelle flytt på serveren.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-12-1-drag-commands-expand-into-manual-moves-on-the-server.md` (status `done`).
- Build-agenten leverte for tidlig mens implementasjons-subagenten kjørte pytest. Den ble gjenopptatt med SendMessage, og fullførte verifisering, review og commit.

### Resultat
- Commits: `319486b6068450147b9bd59b6def79bb1d815cdd` (Story 12.1, med epic-konteksten `epic-12-context.md`), pluss sprint-commit «12-1 done».
- Nye kommandoer:
  - `MoveParts`, `PutTogether` og `Swap`, pluss hendelsen `SwapMade`;
  - nye domenemoduler `drag.py` og `manual_steps.py`;
  - retro-punkt 36 fra epic 4 er delvis tatt opp, med lengdegrenser på de nye kommandoene.
- Regelen for samme del (FR-34/FR-38) er uendret, og de nye kommandoene gjør den ikke verre.
- Verifisering:
  - `lint:py`, `ruff format --check`, `lint:imports` (5 kontrakter), `typecheck` og `lint` er ok; `gen:api` er stabilt.
  - Vitest: 687 passed. pytest: 996 passed og 2 hoppet over.
  - `tests/app` mot lokal `postgres:17`: 314 passed og 3 hoppet over (før review-rettelsene, som bare rørte domenetester og en docstring).
  - Playwright chromium: 125 passed.
- Review: 25 funn, ingen høye eller middels. 6 lave ble rettet, og ingenting er utsatt.

### Åpne punkter
- Til Story 12.4 har `swap_made.move_numbers` stegnumre også når FR-34 slår sammen eller fjerner et av stegene (retro-punkt 72 fra epic 8).
