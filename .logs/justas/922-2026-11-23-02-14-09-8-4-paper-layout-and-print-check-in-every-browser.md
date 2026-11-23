# 8-4-paper-layout-and-print-check-in-every-browser

## 2026-11-23 kl. 02:14 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 8.4: papiroppsett for flyttelista og utskriftssjekk i alle nettlesere. Dette er siste story i epic 8.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-8-4-paper-layout-and-print-check-in-every-browser.md` (status `done`).
- Build-agenten leverte for tidlig mens implementasjons-subagenten fortsatt kjørte e2e, og satte spec-en til `blocked`. Den ble gjenopptatt med SendMessage, og fullførte verifisering, review og commit.

### Resultat
- Commits: `9baf2156cabf840e617cd0b6375a994c9e6dae31` (Story 8.4), pluss sprint-commit «8-4 done». Epic 8 er satt til `done`.
- Ny Playwright-test `frontend/e2e/move-list-print.spec.ts`. Papirstiler ligger i `globals.css`, og verktøylinja og lagringsstatusen skjules ved utskrift.
- Verifisering:
  - lint (py, imports, ESLint), `typecheck` og `ruff format --check` er ok; `gen:api` er stabilt.
  - pytest: 694 passed og 2 hoppet over. Vitest: 399 passed.
  - Playwright chromium: 82 passed.
- Utskriftssjekk (`move-list-print.spec.ts` og `move-list.spec.ts`): 9 passed.

| Nettleser | Resultat | Lagret for manuell kontroll |
|---|---|---|
| chromium | 3/3 passed | A4-PDF, minst 2 sider |
| firefox | 3/3 passed | skjermbilde i print-modus |
| msedge | 3/3 passed | A4-PDF, minst 2 sider |

- Review: 30 funn, ingen høye eller middels. 6 lave ble rettet:
  - testen sjekker at PDF-en er A4 og har minst 2 sider;
  - meldingen «There are no moves to print» skrives ut i svart.

### Åpne punkter
- Firefox kan ignorere regelen som holder et ROUND-bånd sammen med de første linjene. Det er middels hvis det stemmer, men ikke bekreftet.
- Skriver man ut fra nettleserens meny i stedet for Print-knappen, får «Generated» et eldre tidspunkt. Dette kommer fra Story 8.3.
- At toaster skjules ved utskrift, er aldri testet med en toast faktisk på skjermen.
- Bare side 1 av PDF-en er sett på med øynene. Det er ikke bekreftet at toppteksten gjentas på senere sider, og heller ikke sidetall i Firefox.
