# Etiketter: QR-koden gir delenummer

## 2026-11-28 kl. 17:51 — Justas

### Oppgave
Justas skannet en QR-kode fra en Chrome-utskrift av plasseringsetikettene (Story 14.1) og bekreftet at den virker, men bestemte at QR-koden skal gi delenummeret, ikke plasseringskoden. Endringen gjelder FR-48 og Story 14.1.

Valgene hans i økten:
- delen planen legger på plassen (etter flyttene), ikke lageret slik det ble importert;
- én etikett per del når en plass har flere deler;
- ingen etikett for en tom plass.

### Plan
- Spec: [spec-14-1-label-qr-gives-the-part-number.md](../../.docs/implementation-artifacts/spec-14-1-label-qr-gives-the-part-number.md), godkjent som full spec (2 606 tokens, over retningslinjen på 1 600; ett mål, så den ble ikke delt).
- Bygg 2 av to i økten; bygg 1 og bokføringen står i [876 epic-16-retro-fixes](876-2026-11-28-13-56-24-epic-16-retro-fixes.md).
- Bygging i en under-agent, gjennomgang med tre lesere, e2e-porten kjørt av hovedøkten.

### Resultat
Commit `840f90e` (lokal, ikke pushet).

- **API:** `GET /api/plans/{plan_id}/labels` erstatter `GET /api/imports/{import_id}/labels`. Svaret har én etikett per (plass, del) med beholdning over 0 i planen slik den er nå: plasser i Walk Path-rekkefølge, deler på samme plass i delenummer-rekkefølge. Alle gater listes, også en uten beholdning.
- **Etiketten:** plasseringskoden i stor tekst, en QR-kode på 22 mm som koder nøyaktig delenummeret, og delenummeret i liten tekst. Fortsatt A4, 3 per rad og 36 mm høyde.
- **Siden følger planen:** etter en bekreftet kommando hentes etikettene på nytt uten omlasting.
- **Print er av** mens etikettene hentes, etter en mislykket henting (feilen vises over arket) og for en gate uten etiketter.
- **Ny linje på skjermen:** «The labels show each part where the plan puts it. Print them after the moves are carried out.»
- **Dokumenter:** FR-48 i `prd.md` (med ny linje i `.memlog.md`), Story 14.1 og Epic 14 i `epics.md`, og raden i arkitektur-spinen er skrevet om slik det er bygget, merket «decided 2026-11-28».
- **Status:** Story 14.1 er satt til `review` og Epic 14 til `in-progress` i `sprint-status.yaml`, fordi kriteriet som bare et menneske kan sjekke, er endret.

Verifisert på det endelige treet:
- `npm run e2e`: 456 bestått i chromium, firefox og msedge, 0 feilet, 0 flaky, 0 hoppet over.
- `npm test`: 1244 bestått og 2 hoppet over i pytest, 796 bestått i Vitest.
- ruff, ruff format, import-linter (5 kontrakter), ESLint, tsc og `npm run trace` er rene.
- `test_fr48_qr_encodes_exact_code` dekoder hver tegnet QR-kode med jsQR og sammenligner med delenummeret.

Gjennomgang: 21 funn. 16 rettet (elleve rettinger), 1 delvis utsatt, 4 avvist med begrunnelse. Se Review Triage Log i specen.

### Åpne punkter
- Skriv ut en gate fra Chrome og skann en QR-kode med mobilkamera: den skal gi delenummeret. Story 14.1 står i `review` til Justas bekrefter det i en logg.
- Print på etikettsiden henter ikke på nytt før utskrift slik flyttelista gjør (AD-17), så en annen planleggers lagring kommer først med etter neste henting. Ført i `deferred-work.md`.

## 2026-11-28 kl. 18:18 — Justas

### Oppgave
Håndsjekken av de nye etikettene etter push.

### Plan
- Justas skriver ut en gate fra Chrome og skanner en QR-kode med mobilkamera.

### Resultat
- Etikettendringen ble pushet og deployet (`840f90e`, `origin/main` på `78a1b96`).
- **Bekreftet av Justas i økten:** «all works good» på punktet «skriv ut en gate fra Chrome og skann en QR-kode: den skal gi delenummeret». Kriteriet i Story 14.1 som bare et menneske kan sjekke, er dermed oppfylt.
- `sprint-status.yaml`: Story 14.1 er satt til `done` og Epic 14 til `done`. Punktet er lukket i `issues.md`.

### Åpne punkter
- Ingen nye. Fortsatt åpent fra denne loggen: Print på etikettsiden henter ikke på nytt før utskrift (ført i `deferred-work.md`).
