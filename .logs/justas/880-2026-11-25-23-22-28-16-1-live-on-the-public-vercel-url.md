# 16-1-live-on-the-public-vercel-url

## 2026-11-25 kl. 23:22 — Justas

### Oppgave
Sette Story 16.0 til `done` og bygge Story 16.1 med `bmad-build`: gjøre repoet klart for den offentlige Vercel-URL-en mot Supabase Postgres. Justas ba om at subagenter brukes der det er mulig.

### Plan
- Story 16.0 er satt til `done` (commit `51cbac2`), og punktet i issues.md er lukket.
- En subagent rettet epic-16-konteksten etter endringen i AD-18. To subagenter undersøkte parallelt koden og Vercel-dokumentasjonen for Services.
- Spec: [spec-16-1-live-on-the-public-vercel-url.md](../../.docs/implementation-artifacts/spec-16-1-live-on-the-public-vercel-url.md).
- Justas svarte ikke på spørsmålene og ba meg fortsette, så jeg valgte anbefalingene:
  - Justas gjør stegene i Supabase og Vercel selv i dashboardene, etter README.
  - Specen holdes som én story.
- Implementering i subagent, review i tre lag (blind, edge case, verification gap), patcher i samme subagent, deretter full verifisering.

### Resultat
- **Commit `82c0279`**, pushet til `origin/main` sammen med `51cbac2` og loggcommiten (`88c8237..384f85e`).
- **Funn under implementeringen:** startsjekken fra Story 16.0 krever sterk `JWT_SECRET` og `DEMO_PASSWORD` når `APP_ENV=production`. Specen fulgte epicen og satte dem først i 16.2, så backend ville nektet å starte. Justas valgte å sette begge i Vercel nå (kun Production). `FEATURE_AUTH` og `FEATURE_DEMO` er fortsatt av, og startsjekken er ikke svekket.
- **`vercel.json`:** Vercel Services med `web` (`frontend/`, nextjs) og `api` (`backend/`, fastapi, `swp.main:app`). `/api/(.*)` går til backend, alt annet til Next.js, og bare `main` deployes.
- **Postgres-motor:** `get_engine()` bruker `NullPool` og `prepare_threshold=None` på Postgres, så den virker gjennom transaction-pooleren til Supabase. SQLite er uendret.
- **Dev-proxy:** `/api`-omskrivingen i `next.config.ts` brukes bare når `VERCEL` ikke er satt.
- **`keep-alive.yml`:** kaller `GET /api/health` én gang i døgnet og kan også startes for hånd, med `--retry 3`.
- **README:** ny «Deploy»-seksjon med seks steg:
  1. Supabase og pooler-URL-ene
  2. manuell `swp db upgrade` før push, uten at hemmelighetene havner i shell-historikken
  3. import av prosjektet i Vercel
  4. fem miljøvariabler, kun for Production
  5. deploy og sjekk
  6. keep-alive, med en merknad om at GitHub slår av planlagte jobber etter 60 dager
- **Tester:** `test_nfr6_postgres_engine_is_transaction_pooler_safe`, `test_nfr6_sqlite_engine_keeps_its_pool`, `test_nfr5_vercel_routes_api_to_the_fastapi_service` og `test_nfr5_vercel_deploys_only_main`.
- **Verifisering:**
  - lint, format, import-linter, ESLint og tsc er rene
  - pytest: 1192 bestått
  - Vitest: 788 bestått
  - trace OK
  - `tests/app` på Postgres 17 i docker (med NullPool-motoren): 429 bestått
  - `npm run e2e` i chromium, firefox og msedge: 453 bestått, 0 feilet, 0 flaky, 3 hoppet over (`uj5`-plassholderen)
- **Review:** 14 funn er triagert i specen. 7 er patchet, 1 er utsatt til `deferred-work.md` (om `excludeFiles` faktisk virker), og resten er avvist med begrunnelse.
- **Status:** `16-1-live-on-the-public-vercel-url` er satt til `review` i sprint-status. Den blir der til Justas har bekreftet de manuelle sjekkene.
- https://g36steponaitis.vercel.app svarte `NOT_FOUND` da økten startet, så ingenting er deployet ennå.

### Åpne punkter
- Gjør deploy-stegene i README («Deploy» 1–6): Supabase-prosjekt, første `swp db upgrade`, Vercel-prosjekt og fem variabler for Production, deretter deploy. Sjekk `/` og `/api/health` på den offentlige URL-en, og kjør keep-alive for hånd én gang.
- Last opp en import i maksimal størrelse (25 000 lokasjoner) på den offentlige URL-en og åpne Locations-veggen. Noter om grensen på 4,5 MB gjelder den gzippede eller den ukomprimerte kroppen. Feiler det: senk grensen og oppdater AD-18.
- Sjekk i den første byggeloggen hos Vercel at `excludeFiles` holder `backend/tests/` og `backend/var/` ute av funksjonen, og at frontend-installasjonen virker med lockfila i rotmappen. Hvis ikke: legg til `installCommand` på `web`-tjenesten (`deferred-work.md`).
- Story 16.1 står i `review`: sett den til `done` når sjekkene over er bekreftet i en sesjonslogg.

## 2026-11-28 kl. 10:51 — Justas

### Oppgave
Gjøre de manuelle sjekkene som holdt Story 16.1 i `review` (README «Deploy» 1–6, import i maksimal størrelse på den offentlige URL-en, `excludeFiles` og frontend-installasjon i byggeloggen), og sette storyen til `done`.

### Plan
- Claude sjekket først status: `/` svarte 200, `/api/health` 500 (`FUNCTION_INVOCATION_FAILED`, `DATABASE_URL` ikke satt), keep-alive feilet 26. og 27. nov.
- Justas gjorde dashbordstegene selv, med veiledning steg for steg; hemmelighetene ble aldri vist i chatten.
- Claude verifiserte det som kan sjekkes utenfra (helse, region-header, keep-alive-kjøringen, størrelsen på vegg-svaret) og laget syntetiske maks-filer.

### Resultat
- **Supabase:** prosjekt i Stockholm-regionen. `swp db upgrade` kjørt fra Mac-en med transaction pooler (6543) som `DATABASE_URL` og session pooler (5432) som `MIGRATION_DATABASE_URL`. SQL Editor viste alle tabellene (`users`, `plans`, `imports`, `login_attempts`, `keyword_rules`, `aisle_categories`, `alembic_version`).
- **Vercel:** `APP_ENV`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET`, `DEMO_PASSWORD` satt for Production; `FEATURE_AUTH`/`FEATURE_DEMO` fortsatt av (Story 16.2). Redeploy av `184070b` uten cache.
- **Byggelogg:** Python 3.12 fra `backend/.python-version`, avhengigheter fra `uv.lock`; `npm install` (652 pakker) og `next build` (Next.js 16.4.6, 19 ruter) gikk rent, så `installCommand` trengs ikke. Bygget tok 48 s.
- **`excludeFiles`:** Output-visningen for Python-funksjonen i Vercel har ingen `tests/` eller `var/`. Punktet i `deferred-work.md` er merket løst.
- **Helse:** `/` 200 og `/api/health` → `{"status":"ok"}`.
- **Keep-alive:** startet for hånd, run 46130937952 grønn (12 s).
- **Maks-import:** syntetiske filer laget fra `data/sample/` (10 gater × 25 seksjoner × 5 nivåer × 20 posisjoner = 25 000 lokasjoner, alle fylt med én lagerlinje, de 20 000 eksempeltransaksjonene; 2,6 MB xlsx) og sjekket mot `read_import` lokalt først. Lagt i `~/Downloads/swp-max-size/`, utenfor repoet. Planen «Testing» ble opprettet på den offentlige URL-en, og Locations-veggen viste gatene A–J.
- **4,5 MB-spørsmålet:** `GET /api/imports/<id>/layout` for maks-importen er 3 658 040 byte ukomprimert og 207 358 byte gzippet. Begge er under 4,5 MB, så veggen passer uansett hvilken Vercel teller; spørsmålet trenger ikke avgjøres, og AD-18 er uendret.
- **Funksjonsregion:** funksjonen kjører i `iad1` (Washington; `x-vercel-id: arn1::iad1::…`) mens databasen er i Stockholm. Et forsøk på å bytte til `arn1` ble ikke gjennomført (redeployen ble hengende og Justas fant ikke valget på gratisplanen). Godtatt slik det er: hver spørring tar en tur over Atlanteren.
- **Status:** `16-1-live-on-the-public-vercel-url` satt til `done` i `sprint-status.yaml`. Endringen i sprint-status og `deferred-work.md` er ukommittert.
- Fire åpne punkter fra 2026-11-25 er lukket i `issues.md`.
- Ikke gjort: rot-`npm install` kjører `uv sync` en gang til på Vercel (dev-verktøy som pytest og ruff), som koster ca. 3 s byggetid. Ufarlig, ikke tatt med som åpent punkt.

### Åpne punkter
- Slett testplanen «Testing» (25 000 lokasjoner) fra den offentlige databasen før Story 16.2 slår på demoen, eller bestem at den skal stå.
- `.gitignore`-regelen `.env*` (ukommittert endring) treffer også `backend/.env.example`; legg til `!.env.example` før den committes.
