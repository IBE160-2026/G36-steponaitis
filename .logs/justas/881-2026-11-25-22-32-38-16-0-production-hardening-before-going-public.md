# 16-0-production-hardening-before-going-public

## 2026-11-25 kl. 22:32 — Justas

### Oppgave
Bygge Story 16.0 med `bmad-build`: herde appen før den går på en offentlig URL. Dette gjelder oppstartssjekken, innloggingsstrupingen, startseedet og hva som skjer med en tilbakeholdt endring når en annen bruker logger inn etter at økten er utløpt.

### Plan
- Epic 16-kontekst kompilert til `.docs/implementation-artifacts/epic-16-context.md`.
- Spec: [spec-16-0-production-hardening-before-going-public.md](../../.docs/implementation-artifacts/spec-16-0-production-hardening-before-going-public.md). Justas valgte å holde de fire delene i én story og én spec (~2 800 tokens). Han besluttet også at Create account etter utløpt økt dropper den tilbakeholdte endringen.
- Implementering i subagent, review med tre lag (blind, edge case, verification gap), patcher, deretter full verifisering og e2e-porten.

### Resultat
- **Commit `33e5e0f`**, pushet til `origin/main` sammen med loggcommiten `aa9e697`.
- **Oppstart:** backend og `swp db upgrade` nekter å starte når `VERCEL` er satt og `APP_ENV` ikke er `production`. En ugyldig innstilling gir én `Refusing to start: <SETTING>: <grunn>`-linje uten verdi og uten pydantic-traceback. CLI-en skriver én linje per problem til stdout gjennom `swp`-loggeren.
- **Struping:** forsøket telles (`login_attempts.reserve`) før passordsjekken. Samtidige forespørsler gir derfor høyst 5 bcrypt-sjekker; testen kjører på SQLite og Postgres 17. Riktig passord nullstiller telleren.
- **Seed:** startkategoriene leser TOML først etter at begge tabellene er funnet tomme. En opptatt lås prøves 3 ganger og logges deretter med årsak. Demo-seedet hopper over en opptatt database. Docstringen i bootstrap er rettet.
- **Utløpt økt:** klienten husker hvem som var logget inn. Samme bruker får endringen sendt. Annen bruker, ny konto, demo eller ukjent forrige bruker gir i stedet toasten «The last change was not saved: a different user logged in.», og endringen droppes.
- **E2e:**
  - Hjelperen oppretter kontoen før den logger inn, og prøver igjen ved 429. Ellers låste parallelle workere `e2eplanner` på en fersk database.
  - En kjent flaky test i `recommendations-page.spec.ts:25` er stabilisert. Den feilet 2/20 på baseline; nå venter testen på at Apply er aktivert før Alt+A, og den gikk 30/30.
- **Docs:** README (oppstartsregler) og AD-18 (struping) i ARCHITECTURE-SPINE er oppdatert.
- **Verifisering:**
  - lint, format, import-linter, ESLint og tsc er rene
  - pytest: 1188 bestått
  - Vitest: 788 bestått
  - trace OK
  - `tests/app` på Postgres 17 i docker: 429 bestått
  - `npm run e2e` i chromium, firefox og msedge: 453 bestått, 0 feilet, 0 flaky, 3 hoppet over (plassholderen for Epic 16-deploy)
- **Review:** 18 funn er triagert i specen. 5 er patchet, 2 er utsatt til `deferred-work.md`, og resten er avvist med begrunnelse.
- **Status:** `16-0-production-hardening-before-going-public` er satt til `review` i sprint-status, og `epic-16` er `in-progress`.
- **Lukket i issues.md:** Story 9.3 (tilbakeholdt endring under ny bruker), Story 9.4 (struping ved samtidige forsøk), Story 9.7 (pydantic-traceback), epic 9 retro punkt 1 og 3, og epic 13 retro punkt 1 (startseedet).

### Åpne punkter
- En opptatt lås i strupingsskrivingen (`login_attempts.reserve`) gir 500 i stedet for 503. Siden Story 16.0 går hver innlogging gjennom denne skrivingen (utsatt i `deferred-work.md`).
- Alt+A, Alt+K og Alt+O på Recommendations-siden ignoreres uten tilbakemelding mens en endring lagres (utsatt i `deferred-work.md`).
- Produktavveining: 5 eller flere samtidige innlogginger med riktig passord for samme konto kan kort få `login_locked`, til den første lykkes og nullstiller telleren. Avgjør om dette er akseptabelt.
- Story 16.0 står i `review`: sett den til `done` etter din gjennomgang (eventuelt med `bmad-walkthrough`) før Story 16.1.
