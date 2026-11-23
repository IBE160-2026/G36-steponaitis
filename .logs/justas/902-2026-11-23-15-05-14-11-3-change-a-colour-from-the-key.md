# 11-3-change-a-colour-from-the-key

## 2026-11-23 kl. 15:05 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 11.3: endre en farge fra fargeforklaringen (Key). Dette er siste story i epic 11.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-11-3-change-a-colour-from-the-key.md` (status `done`).
- Build-agenten leverte for tidlig mens implementasjons-subagenten fortsatt kjørte. Den ble gjenopptatt med SendMessage, og fullførte verifisering, review og commit.

### Resultat
- Commits: `34cea6fc2c0f2be7fdaae5126776e39b84cc6537` (Story 11.3), pluss sprint-commit «11-3 done». Epic 11 er satt til `done`.
- Ny fargevelger i `frontend/components/common/wall/colour-popover.tsx`:
  - piltastene, fargekoden, velgeren og Reset bare forhåndsviser fargen;
  - Done eller et klikk utenfor lagrer den;
  - Esc gjenoppretter fargen.
- Epicen nevnte `modules/key-colours`. Fargevelgeren ligger likevel ved siden av den felles Key-en, fordi lint-regelen hindrer moduler i å importere hverandre.
- Anbefalingsdetaljen har seks nye tabulatorstopp, fordi fargeknappene i Key-en ligger under utsnittene.
- Verifisering:
  - `lint`, `typecheck`, `lint:py` og `lint:imports` (5 kontrakter) er ok.
  - pytest: 956 passed og 2 hoppet over. Vitest: 687 passed.
  - Playwright chromium: 125 passed.
    - Én full kjøring ga 1 feil i `delete-plan.spec.ts:63`: fokus gikk til feil rad når mange tester kjørte samtidig.
    - Testen besto alene, og neste fulle kjøring ga 125/125.
  - `key-colours` i firefox og msedge: 4 passed.
- Review: 34 funn. 4 middels og flere lave ble rettet, og ingenting er utsatt.

### Åpne punkter
- `delete-plan.spec.ts` feilet igjen på fokusraden under parallell last. Det er samme ustabile test som under Story 6.5, og den må gjøres stabil før milestone 2-porten.
- Kan nettleseren lese lagringen, men ikke skrive til den, vises «Colours can't be kept» først etter at første lagring har feilet.
