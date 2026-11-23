# 11-1-colour-maths-and-presets

## 2026-11-23 kl. 13:28 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 11.1: fargeberegning og forhåndsvalg (presets).

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-11-1-colour-maths-and-presets.md` (status `done`).

### Resultat
- Commits: `10417910e1ee1a4d0d513a948d3f6b91d25286f2` (Story 11.1, med epic-konteksten `epic-11-context.md`), pluss sprint-commit «11-1 done».
- Nytt bibliotek `frontend/lib/colours/` (`maths.ts`, `presets.ts`, `checks.ts`) med testen `fr42_colours.test.ts` (68 tester).
- Tolkningen av «#267A4B-kompatible verdier» står i spec-en:
  - standardfargen for best gir det faste tokenet `#267A4B`;
  - andre farger for best gjøres mørkere, med samme fargetone, til hvit tekst får kontrast 4,5:1.
- Storyen endrer ingenting brukeren ser, så den har ingen ny Playwright-test.
- Verifisering:
  - Vitest: 645 passed.
  - `lint` og `typecheck` er ok.
  - Playwright chromium: 123 passed.
- Review: 1 middels og 19 lave funn. Det middels og 7 lave ble rettet, og ingenting er utsatt.

### Åpne punkter
- En farge for best som ligger ett steg fra standarden, får et synlig lysere token enn standarden selv. Reviewen godtok dette.
- Story 11.2 må hoppe over ugyldige lagrede farger før `checkContrast` og `similarPairs`, fordi disse kaster `RangeError`.
