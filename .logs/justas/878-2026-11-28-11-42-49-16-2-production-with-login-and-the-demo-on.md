# 16-2-production-with-login-and-the-demo-on

## 2026-11-28 kl. 11:42 — Justas

### Oppgave
Bygg Story 16.2 (`bmad-build`): den offentlige deployen skal kjøre med innlogging og demo på, slik at sensorene kan bruke appen på https://g36steponaitis.vercel.app med demokontoen.

### Plan
- Spec: [spec-16-2-production-with-login-and-the-demo-on.md](../../.docs/implementation-artifacts/spec-16-2-production-with-login-and-the-demo-on.md) (godkjent, beholdt samlet på ca. 1 800 tokens).
- Beslutninger (Justas): demopassordet på den offentlige siden publiseres som `demo` (Log in `demo`/`demo`); testplanen «Testing» slettes.
- Ingen endring i backend: den gamle `demo`-raden slettes i Supabase, og neste klikk på Demo version oppretter den på nytt med `DEMO_PASSWORD=demo`.
- Før bygget: `.gitignore` fikk `!.env.example` og ble committet (`a9253312`); epic-16-konteksten ble kompilert på nytt (plandokumentene var endret 2026-11-26).

### Resultat
- Commit `6659a7f`:
  - ny `npm run e2e:public` (`frontend/playwright.public.config.ts`): kjører `e2e/production` mot den offentlige URL-en, uten retries, og lager ingen planer eller nye kontoer;
  - ny Log in-test (`fr40 uj5 …`) i produksjonssuiten;
  - den hoppede `uj5`-plassholderen er fjernet, så `npm run e2e` har 0 hoppet over;
  - README-runbooken er oppdatert: flaggene, `DEMO_PASSWORD=demo`, sjekklisten, sletting av `demo`-raden og at `demo` kan låses i 60 s.
- Review med tre lag: 15 funn, 9 rettet, 6 avvist, ingenting utsatt.
- Verifisert:
  - ESLint, tsc og trace er rene, og secret-greppen på diffen er tom;
  - `npm run e2e` (chromium, firefox, msedge): 453 bestått, 0 feilet, 0 flaky, 0 hoppet over;
  - `npm run e2e:production`: 3 bestått.
- Storyen står på `review`, fordi akseptkriteriene på den offentlige URL-en må sjekkes av forfatteren.
- Løst: punktet om `.gitignore`/`!.env.example` (`a9253312`).

### Åpne punkter
- Gjør dashboard-stegene for Story 16.2 (README *Deploy* steg 4–5):
  - Vercel (bare Production): `FEATURE_AUTH=true`, `FEATURE_DEMO=true`, `DEMO_PASSWORD=demo`, deretter Redeploy;
  - Supabase: slett `demo`-raden i `users`;
  - klikk Demo version én gang, slett «Testing», kjør `npm run e2e:public` og gå gjennom SM-2 på `data/sample/`;
  - logg resultatet, så kan 16.2 settes til `done`.
- Epic 16-retrospektiv (valgfri) etter at 16.2 er `done`.
