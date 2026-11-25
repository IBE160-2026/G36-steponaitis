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
- **Commit `82c0279`** (lokalt, ikke pushet).
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
