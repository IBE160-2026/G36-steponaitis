# 4-2-make-a-manual-move-command-and-preview

## 2026-11-22 kl. 10:28 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 4.2: manuell flytting, med kommando og forhåndsvisning.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-4-2-make-a-manual-move-command-and-preview.md` (status `done`).

### Resultat
- Commits: `079b689dbea1121e4e26b016d592bee1b7908fd2` (Story 4.2), pluss sprint-commit «4-2 done».
- Verifisering:
  - ruff og import-linter er ok (5 kontrakter).
  - pytest: 399 passed. `tests/app` mot lokal `postgres:17`: 92 passed og 1 hoppet over; busy-testen gjelder bare SQLite.
  - ESLint og typecheck er ok; Vitest: 183 passed; `gen:api` er stabilt.
  - Playwright chromium: 35 passed i tre kjøringer. Én kjøring etter review-rettelsen avsluttet med feil uten fanget utskrift; det tyder på en ustabil test, men er ikke bekreftet.
- Retro-punkt 22 er lukket:
  - Under skrivelåsen leses bare id, versjon og tilstand, og importen leses før låsen tas.
  - SQLite busy/locked gir 503 med den nye feilkoden `unavailable`.
- Importen lagrer nå virtuelle lokasjoner (dataformat versjon 2, eldre importer oppgraderes automatisk). Det trengs for avvisningen «FLSKRS is a virtual location, not a shelf.».
- Review: 28 funn, 1 middels rettet (test for kombinert flytt inn i en lokasjon som allerede har delen).

### Åpne punkter
- Planleggingsartefakt endret: build-kjøringen la feilkoden `unavailable` til i AD-11 i arkitektur-spinen. Det kom fra retro-punkt 22, ikke fra storyen selv. Justas bør bekrefte endringen.
- På Postgres venter en andre skriver på låsen i stedet for å få 503 (ingen lock timeout). En busy-feil etter at låsen er tatt gir fortsatt 500.
- Mulig ustabil e2e-test (én ubekreftet feil lokalt). Følges med i CI.
