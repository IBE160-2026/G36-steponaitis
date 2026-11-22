# 6-3-start-a-new-plan-from-an-existing-plan-s-import

## 2026-11-22 kl. 20:08 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 6.3: start en ny plan fra importen til en eksisterende plan.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-6-3-start-a-new-plan-from-an-existing-plan-s-import.md` (status `done`).

### Resultat
- Commits: `bdcc7b21233492f873a8a0c4089a001c1507908b` (Story 6.3), pluss sprint-commit «6-3 done».
- Ny Playwright-reise `frontend/e2e/reuse-import.spec.ts`. Den dekker også Escape-delen av retro-punkt 6 fra epic 1 (planplaten).
- Plan-platens meny har ikke lenger et eget «New Plan»-valg, i tråd med milepæl 2-lista i UX-DR5. New Plan finnes fortsatt på siden med lagrede planer.
- Verifisering:
  - lint (py, imports, ESLint), `typecheck` og `ruff format --check` er ok; `gen:api` er stabilt.
  - pytest: 569 passed og 10 hoppet over. Vitest: 287 passed.
  - `tests/app` mot lokal `postgres:17`: 135 passed og 2 hoppet over (to låsetester som bare kjører på SQLite).
  - Playwright chromium: 59 passed.
- Review: 37 funn.
  - Det middels funnet er rettet: fokus forsvant når man byttet mellom filer og gjenbruk på New Plan.
  - Flere lave funn er også rettet.

### Åpne punkter
- Story 6.4 må legge til en test for at New Plan laster lista med lagrede planer på nytt når gjenbruk får `not_found`. Den samme storyen må la sletting ta den samme låsen på importraden.
