# 13-1-keyword-rules-are-stored-globally-and-give-each-part-a-categ

## 2026-11-24 kl. 08:03 — Justas

### Oppgave
Story 13.1 (Keyword rules are stored globally and give each part a category) i autonom kjøring av Epic 13. Brukeren ba om å bygge Epic 13 og droppe Epic 14 og 15.

### Plan
- `start.sh`: preflight READY, CI grønn på `e802432`, start-commit `4b95570`.
- Fersk build-subagent med `bmad-build-auto`; kontroll av spec-status og arbeidstre; commit «Sprint: … done»; logg; push.

### Resultat
- Spec: `.docs/implementation-artifacts/spec-13-1-keyword-rules-are-stored-globally-and-give-each-part-a-category.md` (status done).
- Commit `e25cf0b`: domeneslice `domain/categories.py` (hele ord, casefold, første regel vinner), expand-only-migrasjon for `keyword_rules`, API `GET/POST /api/keyword-rules`, `PATCH/DELETE /api/keyword-rules/{id}`, `PUT /api/keyword-rules/order`, regenerert `schema.ts`. Lagringsbeslutningen for stage 2 er ført inn i Deferred-seksjonen i spinen. Ny `epic-13-context.md`.
- Utenfor kodekartet: `scripts/traceability.py` lister FR-43–FR-48 uten å feile; `_is_busy` flyttet til `store/db.py` som `is_busy` (delt av planer og nøkkelordregler, låst tabell gir 503).
- Verifisering: ruff og format ok; import-linter 5 kept / 0 broken; pytest 1075 passed (SQLite), tests/app 353 passed på Postgres 17; typecheck, ESLint ok; Vitest 713 passed; trace 43/43 (FR-43: 28 tester, FR-44: 9); e2e chromium 139 passed / 4 skipped.
- Epic 14 og 15 droppes etter ønske fra brukeren og bygges ikke.

### Åpne punkter
- Oppfølgingsreview anbefalt for 13.1: sjekken av NUL og ensomme surrogater i tekst, og låstestene (også Postgres-stien) er ikke reviewet på nytt.
- Epic 14 (QR-etiketter) og Epic 15 (advarsel ved samtidig redigering) er droppet etter beslutning fra brukeren; de står fortsatt som backlog i `sprint-status.yaml`, og de tilhørende hoppede e2e-testene blir stående.
