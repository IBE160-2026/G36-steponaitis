# 9-4-login-throttle-and-account-limits

## 2026-11-23 kl. 04:47 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 9.4: struping av innloggingsforsøk og grenser for kontoer.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-9-4-login-throttle-and-account-limits.md` (status `done`).

### Resultat
- Commits: `1f0dfb38478308c102a840855d4646b5233b0f67` (Story 9.4), pluss sprint-commit «9-4 done».
- Innlogging låses etter for mange feilede forsøk (429). Grensene for kontoer og planer gir 409. `schema.ts` har fått de nye statuskodene.
- E2e-testen av låsing kjører mot ekte server. De to demotestene faker 409 med `page.route`, fordi e2e-serveren kjører med `FEATURE_DEMO` av.
- Verifisering:
  - `lint:py`, `ruff format --check` og `lint:imports` er ok.
  - pytest: 844 passed og 2 hoppet over.
  - `tests/app` mot lokal `postgres:17`: 264 passed og 3 hoppet over.
  - `lint` og `typecheck` er ok. Vitest: 437 passed.
  - Playwright chromium: 97 passed.
- Review: 36 funn, ingen høye eller middels. 6 lave ble rettet, alle i tester. Ingenting er utsatt.

### Åpne punkter
- Mange innloggingsforsøk sendt samtidig kan gi flere enn 5 gjetninger per låsevindu.
- Rader i `login_attempts` for brukernavn som aldri logger inn, slettes aldri.
- Grensene for kontoer og planer er myke når forespørsler kommer samtidig.
