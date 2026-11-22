# ci-fiks-e2e-route-teardown

## 2026-11-22 kl. 12:44 — Justas

### Oppgave
CI ble rød på `main` (kjøring 45017052318) etter Epic 4-retroen. Alle 48 e2e-tester gikk grønt, men Playwright meldte «1 error was not a part of any test». Runbookens CI-fiksregel gjelder før neste story.

### Plan
- Forsøk 1 i fersk subagent med `bmad-build-auto`. Spec: `.docs/implementation-artifacts/spec-ci-45017052318-e2e-route-handlers-end-with-their-test.md`.

### Resultat
- Årsak: en `page.route`-handler i `plan-overview.spec.ts` (`GET /api/plans`) var fortsatt i `route.fetch` da testen sluttet og siden lukket seg.
- Commit `a619451ccf480595ef221a2e006599b87a9d3a12`:
  - Ny felles `frontend/e2e/support/test.ts`, der `page`-fixturen kaller `page.unrouteAll({ behavior: "ignoreErrors" })` etter testen.
  - Alle 12 e2e-specer importerer `test` og `expect` derfra.
  - En ESLint-regel (`no-restricted-imports`) hindrer nye specer i å importere `test` direkte fra `@playwright/test`.
- Verifisering: ESLint og typecheck er ok. Playwright chromium gikk 49/49 i seks kjøringer, uten feil utenfor tester.
- CI-kjøring 45018574495 på `main` er grønn.

### Åpne punkter
- Utsatt (lav): ingen test tvinger frem en handler som fortsatt kjører når testen slutter, og ingen automatisk sjekk bekrefter at lint-regelen fortsatt slår til.
