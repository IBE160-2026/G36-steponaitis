# 4-4-views-follow-the-planning-copy

## 2026-11-22 kl. 11:36 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 4.4: visningene følger planleggingskopien.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-4-4-views-follow-the-planning-copy.md` (status `done`).

### Resultat
- Commits: `4a367ca9879fb22543632effe5a307f01fedec5a` (Story 4.4), pluss sprint-commit «4-4 done».
- Verifisering:
  - `gen:api` er ok; ruff, import-linter (5 kontrakter), ESLint og typecheck er ok.
  - pytest: 407 passed; Vitest: 212 passed.
  - Playwright chromium: 48 passed i to fulle kjøringer på rad.
- Retro-punkter lukket:
  - Epic 2, punkt 12, 13 og 14: gangbytte nullstiller ikke filtrene; Pick groups-teksten bruker `min_shared_jobs`; reglene for delens gang og listede deler ligger i `domain/planning.py`.
  - Epic 3, punkt 20: planen hentes på nytt opp til høyeste sette versjon.
- To punkter i `issues.md` er lukket.
- Review: 27 funn, 3 middels rettet. En feilet del-lasting fryser ikke tabellen lenger, og det er nye e2e-tester for refetch-grensen og for å bytte del direkte i panelet.

### Åpne punkter
- Oppfølgingsreview anbefalt: rettelsen for feilet del-lasting i panelet har ingen egen test.
- E2e var ustabil før review-rettelsene. 3 av 8 kjøringer hadde én feil: to ganger «ad12 retries a command after a proxy 500», én gang at `createSamplePlan` ikke fikk 201.
