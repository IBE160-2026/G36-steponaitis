# 15-1-warn-when-someone-else-saved-the-plan

## 2026-11-24 kl. 23:15 — Justas

### Oppgave
Bygge Story 15.1 (Warn when someone else saved the plan), eneste story i Epic 15. Justas ba om å bygge Epic 14 og 15 med subagenter der det går.

### Plan
- Start-commit `772c5a9`, deretter en fersk build-subagent med `bmad-build-auto`.
- Retrospektiven for Epic 14 kjørte samtidig i et eget git-worktree. Commiten ble plukket inn på `main` som `07238f3` etter at storyen var ferdig; en konflikt på `last_updated` i `sprint-status.yaml` ble løst for hånd.
- Kontroll av spec-status og arbeidstre, «done»-commit, logg og push.

### Resultat
- Spec: `.docs/implementation-artifacts/spec-15-1-warn-when-someone-else-saved-the-plan.md` (status done). Epic-kontekst: `epic-15-context.md`.
- Commits:
  - `772c5a9` (start);
  - `c786829` (story);
  - `5159a34` (done; epic 15 også `done`);
  - `07238f3` (retrospektiv for epic 14).
- Backend:
  - en kommando med utdatert `base_version` avvises med `plan_changed` (409) og `{current_version, last_edited_by, last_edited_at}`, før den brukes;
  - en gjentatt `command_id` gir fortsatt det lagrede resultatet først.
  - `plan_changed` står i `swp/api/errors.py` og i AD-11 i spinen. AD-6, AD-12 og Deferred-notatet om FR-41 er oppdatert.
- Frontend: dialogen «Someone saved this plan after you opened it…» har knappene **Reload plan** (standardfokus) og **Keep going**.
  - Reload plan dropper kommandoen og henter planen på nytt.
  - Keep going sender samme kommando på nytt med ny `base_version`.
- EXPERIENCE.md UJ-3 sier ikke lenger «the last save wins».
- To eksisterende tester har fått ny betydning:
  - i `test_commands.py` blir utdatert og samtidig kommando nå avvist;
  - `recommendations-page.spec.ts` klikker Keep going først.
- E2e-plassholderen `uj3 fr41` er nå en ekte test med to nettleserøkter.
- Verifisering:
  - lint, format, import-linter, ESLint og typecheck ok;
  - pytest 1145 passed / 2 skipped;
  - Vitest 763 passed;
  - trace ok (FR-41: 22 tester);
  - e2e i chromium, firefox og msedge: 438 passed, 0 failed, 0 flaky, 3 skipped (bare plassholderen for Epic 16, deployment);
  - etter en review-rettelse ble `uj3 fr41` kjørt på nytt (`--repeat-each=2`): 6 passed. Hele suiten ble ikke kjørt på nytt etter den rettelsen; CI kjører chromium.
- Epic 14-retroen: verdikt **avvist** fordi QR-skanningen med mobil ikke er gjort (`.docs/implementation-artifacts/epic-14-retro-2026-11-24.md`, 4 handlingspunkter i `sprint-status.yaml`).

### Åpne punkter
- Sjekken sammenligner bare versjonsnummer, så samme konto i en annen fane får også dialogen «Someone saved this plan». Vurder om det er ønsket (Story 15.1).
- Epic 14-retro: flytt den dupliserte `_ref`-byggeren (`domain/labels.py`, `domain/layout.py`) til domenekjernen, og `IMMUTABLE`-konstanten til en felles API-modul (punkt 2).
- Epic 14-retro: stories med akseptkriterier som krever en sjekk for hånd, skal stå i review til sjekken er bekreftet, og build-subagenter skal ikke starte dev-servere på :3000/:8000 når en e2e-port venter (punkt 4).
