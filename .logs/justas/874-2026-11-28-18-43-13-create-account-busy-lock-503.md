# Create account svarer 503 ved opptatt databaselås

## 2026-11-28 kl. 18:43 — Justas

### Oppgave
Justas kjørte `/bmad-help` og ba meg gjøre det jeg anbefalte: vise sprintstatus for å få de 35 åpne retro-punktene fram til en beslutning, og rette feilen der Create account svarer 500 i stedet for 503 når databaselåsen er opptatt.

### Plan
- Sprintstatus med `bmad-sprint-planning` (bare lesing).
- Rettelsen med `bmad-build` som one-shot: [spec-create-account-busy-lock-answers-503.md](../../.docs/implementation-artifacts/spec-create-account-busy-lock-answers-503.md).
- Én uavhengig gjennomgang (Blind Hunter), deretter chromium-e2e kjørt av hovedøkten.

### Resultat
**Sprintstatus:** 77 stories, 16 epics og 16 retrospektiver er `done`. Ingen risikoer eller advarsler. 35 retro-punkter står `open` (epic 1: 3, 4: 4, 5: 4, 6: 6, 7: 3, 8: 2, 9: 3, 10: 4, 11: 3, 12: 3). Ingenting er endret i `sprint-status.yaml`.

**Rettelsen:** commit `2dc3273` (lokal, ikke pushet).
- `backend/swp/store/users.py`: innsettingen av en bruker kjører i `write_transaction` og gir `UsersBusy` ved opptatt lås. `insert_seed_user` er fjernet; `demo`-seeden bruker samme `insert_user`.
- `backend/swp/app/auth/__init__.py`: Create account svarer `unavailable` (503) med «Create account is busy. Try again.», uten cookie og uten konto.
- Ruten `/api/auth/signup` oppgir 503, og `frontend/lib/api/schema.ts` er laget på nytt med `npm run gen:api`.
- Seks nye tester (`test_fr39_…` og én `test_fr50_…`), to av dem med en lås som virkelig holdes. Låshjelperen er flyttet til `backend/tests/conftest.py` som `table_write_locked`.
- `ARCHITECTURE-SPINE.md` nevner Create account og `demo`-seeden blant skrivingene som svarer 503.
- Punktet i `deferred-work.md` er merket `resolved`, og punktet fra 2026-11-28 i `issues.md` er lukket.

Verifisert på SQLite: `npm run test:py` 1249 bestått og 2 hoppet over før rettelsene etter gjennomgangen, deretter de fire auth-testfilene med 133 bestått; `npm run lint:py`, `ruff format --check`, `npm run lint:imports`, `npm run typecheck`, `npm run test:web` (796 bestått) og `npm run trace` er rene; `npm run e2e -- --project=chromium` 152 bestått. Firefox og Edge er ikke kjørt.

Gjennomgangen ga ni funn: fire rettet (delte testhjelpere, opprydding av motoren etter låsen, test for seed-stien med ekte lås, test for at innsettingen bruker `write_transaction`), ett ført som notat i specen, fire avvist med begrunnelse i specens Review Triage Log.

**Min anbefaling for de 35 retro-punktene** (lest ut fra punktteksten, ikke kontrollert mot koden; avgjørelsen er Justas sin):
- Gjør (kan gi 500 eller feil resultat), 4: epic 1 datoer utenfor område i `_parse_date`; epic 6 `get_plan` som kappløper med sletting; epic 5 rule 3 uten best location; epic 7 flow bar viser Recommendations som ferdig etter undo.
- Gjør hvis det er tid (synlige kanttilfeller), 14: epic 1 tvetydige tall og størrelsessjekk; epic 4 From-valg i manual-move-dialogen, avvis del utenfor `listed_parts`, dialogdetaljer; epic 5 kantstier på Recommendations-siden; epic 6 `plan_not_found`-kroken og launcher-overleveringer; epic 7 trygg toast-Undo; epic 9 hull i klientens auth-flyt; epic 10 valgt flytt og gate, Locations lasting og fokus, Level-modus; epic 11 fargelageret.
- Frafall (bare tester), 8: epic 4 `has_moves`; epic 6 sterkere tester; epic 8 print-verifisering (håndsjekken i Firefox står alt som eget punkt); epic 9 lav-alvorlige tester; epic 10 lave veggfunn; epic 11 `KEY_COLOUR_OF`; epic 12 tidsmåling og antall preview-kall.
- Frafall (bare refaktorering og duplisering), 9: epic 5 delte predikater og fildeling; epic 6 `now` etter parsing og copy til `lib/copy`; epic 7, 8 og 9 opprydding av duplisering; epic 11 ett `#RRGGBB`-predikat; epic 12 én hjelper for dra-årsaker.

### Åpne punkter
- Postgres-grenene av testene med ekte lås (`test_fr39_real_write_lock_is_unavailable`, `test_fr50_demo_with_real_write_lock_on_users_answers_unavailable`) kjøres bare i CI; sjekk CI-kjøringen etter push av `2dc3273`.
- De 35 retro-punktene venter fortsatt på beslutning (står alt i `issues.md` fra 2026-11-28; anbefalingen står over).
