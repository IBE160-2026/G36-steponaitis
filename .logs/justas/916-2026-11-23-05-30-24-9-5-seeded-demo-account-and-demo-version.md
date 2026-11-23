# 9-5-seeded-demo-account-and-demo-version

## 2026-11-23 kl. 05:30 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 9.5: forhåndsopprettet demokonto og Demo-versjon.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-9-5-seeded-demo-account-and-demo-version.md` (status `done`).
- Prompten krevde at demodataene bare kommer fra de syntetiske filene i `data/sample/`.

### Resultat
- Commits: `456fbda3dbdf74758be13fe91c89002d3e9712e1` (Story 9.5), pluss sprint-commit «9-5 done».
- Nytt endepunkt `POST /api/auth/demo`. Kommandoen `swp db upgrade` oppretter kontoen `demo`/`demo` når `DEMO_PASSWORD` ikke er satt.
- Brukernavnet `demo` er definert ett sted, i `swp.domain.accounts`.
- Ny Playwright-reise `frontend/e2e/demo-version.spec.ts`.
- Verifisering:
  - `lint:py`, `ruff format --check`, `lint:imports`, `lint` og `typecheck` er ok; `gen:api` legger bare til `/api/auth/demo`.
  - pytest: 868 passed og 2 hoppet over.
  - `tests/app` mot lokal `postgres:17`: 282 passed og 3 hoppet over.
  - Vitest: 442 passed. Playwright chromium: 99 passed.
- Review: 22 funn, ingen høye eller middels. 3 lave ble rettet, og ingenting er utsatt.

### Åpne punkter
- E2e kaller aldri den ekte `POST /api/auth/demo`. Kallet sendes i stedet videre til en innlogging med `demo`/`demo`, fordi `FEATURE_DEMO` i e2e ville begrense testene til 50 planer. Endepunktet er dekket av backend-testene.
- `demo`/`demo` opprettes på enhver database der `DEMO_PASSWORD` ikke er satt. Akseptkriteriene krever det. Sjekk av hemmeligheter i produksjon kommer i Story 9.7.
