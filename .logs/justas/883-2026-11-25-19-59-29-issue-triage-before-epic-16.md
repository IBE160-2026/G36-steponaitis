# Issue-triage før Epic 16

## 2026-11-25 kl. 19:59 — Justas

### Oppgave
Justas ba om å gå gjennom åpne punkter og spørsmål (140 åpne linjer i `issues.md`) før `bmad-build` kjøres på Epic 16 (deploy), og til slutt commit og push.

### Plan
- `bmad-help`: fant ståstedet: Epics 1–15 ferdige, Epic 16 (16.1, 16.2) i backlog.
- Triagerte punktene i grupper. Først de som blokkerer deploy, kontrollert mot koden; deretter sjekker bare et menneske kan gjøre.
- Justas valgte anbefalingene: én herdingsstory før 16.1, Apply all dokumenteres som grense, 4,5 MB-grensen verifiseres i 16.1, løste punkter krysses av underveis.
- Sjekket startlista mot alle 87 deltyper i `data/sample/` med et skript (i scratchpad, ikke committet).

### Resultat
- Commit `413c680`:
  - **Story 16.0 «Production hardening before going public»** er lagt inn i `epics.md` og `sprint-status.yaml` før 16.1, med fem akseptkriterier:
    - `VERCEL` med `APP_ENV` ulik `production` nekter oppstart (i dag slipper `APP_ENV=local` gjennom, `startup.py:49`).
    - Ugyldig innstilling logges uten verdien.
    - Innloggingsforsøket telles før passordsjekken. Tellingen er atomisk i dag, men låsesjekken kjører før den trege passordsjekken.
    - Startseedet er trygt.
    - En tilbakeholdt endring lagres ikke under en annen brukers navn.
  - **Story 16.1** har fått et akseptkriterium: åpne den største veggen på den offentlige URL-en, og noter om Vercels 4,5 MB-grense teller gzippet eller ukomprimert svar.
  - **Apply all** på svært store importer er dokumentert som kjent grense i README og AD-18.
  - **Startlista** `backend/settings/starter_categories.toml` er kontrollert og godkjent uendret av Justas, og filhodet er oppdatert:
    - Alle 87 deltyper får en kategori, og alle 59 nøkkelord brukes.
    - Av 9 konflikter vinner riktig regel i alle.
    - Bare 165 av 1 625 lagerrader ligger i en gang som passer kategorien.
  - **Epic 13-retroen** er endret fra `rejected` til `accepted-with-open-items`, med en Resolution-seksjon:
    - R9 og R15 er godtatt som kjente begrensninger.
    - R19 (ca. 90 % utenfor) står som det er, og README trinn 12 forklarer hvorfor.
    - Tiltakspunkt 110 i `sprint-status.yaml` er satt til done.
  - **`issues.md`:** sju punkter er krysset av (Postgres-låsen fra Story 4.2 var allerede løst i `db.py`), og seks punkter peker nå til Story 16.0 eller 16.1.
- **Beslutning, Story 15.1:** samme konto i en annen fane beholder «Someone saved this plan»-advarselen.
- **Klargjort for håndsjekkene B, C og D:**
  - `npm run dev` kjører.
  - Planen «Manual checks 2026-11-25» (`064c4785-99aa-4ad2-8908-33de52724a7b`) ligger i den lokale databasen. Den har gang A som best og to runder med Apply all, til sammen 230 flytt.
  - Siden for etiketter er `/plans/<id>/labels?aisle=A`, og utskrift av flyttelista er `/plans/<id>/print`.
- Ingen kode er endret, så tester og lint er ikke kjørt.

### Åpne punkter
- Håndsjekkene som allerede står i `issues.md` gjenstår:
  - QR-skanning med mobil (Story 14.1)
  - README-kjøring ved en annen person (SM-2)
  - utskrift fra Firefox: topptekst, sidetall og ROUND-bånd (Story 8.4)
- Gjennomgang av de ca. 20 åpne produktbeslutningene gjenstår, blant annet FR-26, FR-38 og om en anvendt anbefaling blir utdatert. Spørsmålene står allerede i `issues.md`.
