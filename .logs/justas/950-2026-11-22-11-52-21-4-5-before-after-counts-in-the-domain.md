# 4-5-before-after-counts-in-the-domain

## 2026-11-22 kl. 11:52 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 4.5: før/etter-tall i domenet.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-4-5-before-after-counts-in-the-domain.md` (status `done`).

### Resultat
- Commits: `22b982b6a61c8ab297f89dddb716f80bc79bbe75` (Story 4.5), pluss sprint-commit «4-5 done».
- Ny domenemodul `backend/swp/domain/before_after.py` med `build_before_after`. Den gir før/etter per gang og for hele lageret:
  - deler inn og ut av gangen;
  - raske deler i best locations;
  - pick groups der begge delene står i samme gang;
  - opptatte og tomme lokasjoner.
- `planning.import_copy` og `ordering.part_number_order` er lagt til, og modulen er tatt med i `domain-slices`-kontrakten.
- Fasiten stemmer med `expected.json`: raske deler i best locations går fra 1 til 5, og pick groups i én gang går fra 1 til 6.
- Verifisering: ruff og import-linter er ok (5 kontrakter); pytest 414 passed og Vitest 212 passed; Playwright chromium 48 passed.
- Review: 19 funn, 3 rettet (alle i testene), ingen utsatt.

### Åpne punkter
Ingen.
