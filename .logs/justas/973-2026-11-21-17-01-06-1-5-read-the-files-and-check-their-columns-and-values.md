# 1-5-read-the-files-and-check-their-columns-and-values

## 2026-11-21 kl. 17:01 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 1.5: lese importfilene (CSV/xlsx) og sjekke kolonner og verdier.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-1-5-read-the-files-and-check-their-columns-and-values.md` (status `done`).

### Resultat
- Commits: `b4ea2030f4b36593d53213f93f367dcd32e3356d` (Story 1.5), pluss sprint-commit «1-5 done».
- Verifisering: `uv lock --check` og `uv sync --locked` ok; ruff ok; import-linter 4 kept; pytest 102 passed; Playwright chromium 10 passed (ingen synlig endring, så ingen ny e2e-test). `tests/app` på Postgres 17 kjøres i GitHub CI.
- Review: 36 funn (0 høye, 2 middels); tre rettelser — stopp ved fiendtlig xlsx med fjern rad, test for formelceller, positive grenser for rader og opplastingsstørrelse. Ingenting utsatt.

### Åpne punkter
- En fil med over 10 000 tomme rader totalt får feilen «more than N rows» selv om datarader er under grensen.
- En formelcelle lagret uten resultat leses som tom.
- Tekst over 1 000 tegn og kolonner etter nr. 100 kuttes uten feilmelding.
