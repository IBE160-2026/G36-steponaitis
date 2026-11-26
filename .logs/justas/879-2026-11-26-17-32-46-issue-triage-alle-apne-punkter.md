# Issue-triage av alle åpne punkter

## 2026-11-26 kl. 17:32 — Justas

### Oppgave
Justas spurte om hver story bør gås gjennom én og én for å rette alle åpne punkter og spørsmål. Anbefalingen var å triagere i stedet, og Justas ba om å kjøre triagen. Etterpå godtok Justas alle anbefalingene og ba om at alle fire feilene ble rettet. I samme økt ble appen startet lokalt.

### Plan
- `/bmad-help`: Epic 16 pågår. Story 16.1 står i `review` og venter på de manuelle deploy-sjekkene. Story 16.2 er i backlog.
- Triage: fire lesende agenter sjekket de 109 åpne punktene mot koden (`163fa95`) og la hvert i én kategori. Rapport: [issue-triage-2026-11-26.md](../../.docs/implementation-artifacts/issue-triage-2026-11-26.md).
- Rettinger med `bmad-build`. Spec: [spec-triage-2026-11-26-bug-fixes.md](../../.docs/implementation-artifacts/spec-triage-2026-11-26-bug-fixes.md). En implementeringsagent gjorde jobben, og tre reviewere gikk gjennom diffen. Fire funn ble rettet. Punkt 115 ble et beslutningsspørsmål: Justas valgte å rette regel 3.

### Resultat
- Triagen ga 19 utdaterte punkter, 24 beslutninger, 11 feil (alle lave), 12 manuelle sjekker, 7 polish-punkter og 36 testhull.
- Rettet i `1a39c3a`:
  - **138:** hendelsen `recommendations_outdated` har nå `round` fra siste kjøring, og undo-toasten bruker den.
  - **85:** null-koder som «00», «0.0», «0,0» og «-0» danner ikke jobb.
  - **86:** en jobb med over 100 ulike deler gir ingen par.
  - **102:** et merke som ikke dekker noen plassering gir 422, og steget Best locations hakes av bare når et merke dekker en plassering.
  - **115:** løkkegrensen i regel 3 leser partnerens gang etter tidligere flytt i samme kjøring.
  - **220:** kategorivelgeren sammenligner tekst slik serveren gjør.
  - **121:** test lagt til.
- Rettet etter review:
  - `round` har standardverdi 0, slik at lagrede resultater fra før endringen fortsatt kan leses.
  - Null-koder med komma eller fortegn regnes også som null.
  - `assert_never` i meldingshjelperen for merker.
  - PRD-en er oppdatert.
- Beslutningene står nå i spinen (AD-4, AD-7, AD-17, AD-18), i epics.md (UX-DR48 og akseptkriteriet for Story 7.4) og i PRD-en (FR-19, FR-21, FR-26).
- Verifisering:
  - `npm test`, alle lint-kommandoer, typecheck og trace er grønne.
  - `npm run e2e`: 453 passed, 0 failed og 0 flaky i chromium, firefox og msedge. De 3 hoppede testene er plassholderen for uj5 deploy.
- `issues.md`: 100 punkter er lukket (utdaterte, beslutninger, rettede feil, kjente begrensninger, frafalte testhull og polish, to duplikater). De oppfølgingsreviewene som ikke ble kjørt, er eksplisitt frafalt av Justas. De 9 som står åpne, er manuelle sjekker.
- Utviklingsserveren ble stoppet før e2e-porten. `main` er pushet til origin (`163fa95..7e8c0c2`).

### Åpne punkter
Ingen nye. De gjenværende manuelle sjekkene (deploy av 16.1, QR-skanning, README-kjøring av en annen person, utskrift i Firefox og overvåking av låser på Postgres) står fortsatt i `issues.md`.
