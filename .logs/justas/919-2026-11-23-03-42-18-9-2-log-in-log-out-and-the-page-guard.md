# 9-2-log-in-log-out-and-the-page-guard

## 2026-11-23 kl. 03:42 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 9.2: logg inn, logg ut og sidevakt.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-9-2-log-in-log-out-and-the-page-guard.md` (status `done`).
- Prompten tok med notatene fra Story 9.1: alle e2e-tester må fortsatt virke med `FEATURE_AUTH=true`, og «Log in»-lenken peker til `/login`.

### Resultat
- Commits: `332efa350afcf54f5032322d8ad8a05ba41f6a1d` (Story 9.2), pluss sprint-commit «9-2 done».
- Nye endepunkter for innlogging og utlogging, siden `/login` og en sidevakt.
- Alle eksisterende e2e-tester bruker en felles innlogget fixture i `frontend/e2e/support/test.ts`. Nye tester ligger i `login.spec.ts`.
- `frontend/app/plans/[planId]/[step]/page.tsx` er slettet. Omdirigeringen fra `/move-list` til `/print` ligger nå i `next.config.ts`.
- Utloggingsknappen er midlertidig, i et nytt `account`-felt i verktøylinja. Avatarmenyen i Story 9.3 erstatter den.
- Verifisering:
  - `lint:py`, `ruff format --check` og `lint:imports` er ok.
  - pytest: 806 passed og 2 hoppet over.
  - `tests/app` mot lokal `postgres:17`: 235 passed og 3 hoppet over.
  - `gen:api` er stabilt; `lint` og `typecheck` er ok. Vitest: 426 passed.
  - Playwright chromium: 90 passed.
- Review: 28 funn, 6 rettet. Blant dem: 500-feil ved et brukernavn med et enslig surrogattegn, og en API-vakt som bare var testet på 2 av 10 routere.

### Åpne punkter
- Når en økt utløper mens appen er åpen, blir brukeren ikke sendt til Log in. Dette er utsatt til Story 9.3.
