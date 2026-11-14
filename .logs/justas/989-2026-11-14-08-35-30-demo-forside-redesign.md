# Demo-forside-redesign

## 2026-11-14 kl. 08:35 — Justas

### Oppgave
Brukeren syntes demo-forsiden (landing page) var svak. Den skulle ikke vise README- og Demo data-lenker, ikke ha boksen «This demo holds synthetic data only», ikke ha den lange teksten nederst, og den skulle ha en Log in-knapp. Brukeren ba om tre eksempler og valgte B.

### Plan
- Rendret dagens `mockups/landing.svg` og pekte på svakhetene: generisk oppsett, ingen før/etter, flyttelista vises aldri, steg-kortene var like og brukte koder, og demovarselet tok for mye plass.
- Avklarte at Log in krever PRD-endring: brukeren valgte å flytte innlogging inn i kjernen.
- Tegnet tre SVG-forslag i Bin Wall-stil med et Python-skript: A før/etter-vegg, B følg én del, C papiret først.
- Brukeren valgte B. B ble installert som `mockups/landing.svg`, og PRD og UX-spinene ble oppdatert.

### Resultat
- `mockups/landing.svg` er erstattet med B, «Follow one part»:
  - Overskrift: «Every move comes with a reason.»
  - Knapper: Log in og Create account. Headeren har bare navn, «How it works» og Log in.
  - Ved siden av: en vegg med en løftet binge og et begrunnelseskort.
  - Under: fire paneler som følger del 4410281 fra eksportrad til linje på flyttelista.
  - Eksempelflyttet er endret til G-14-01-04, slik at veggen og teksten stemmer.
- Alle tre forslag og generatoren ligger i `.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/.working/landing-redesign/`.
- PRD (`prd.md`, updated 2026-11-14):
  - FR-39 og FR-40 (konto, inn- og utlogging) er flyttet til kjernen, milestone 2. FR-41 (advarsel ved samtidig redigering) blir i stage 2.
  - Ellers oppdatert: §4.0, ordliste, §4.11, FR-40 (demo-forsiden er åpen uten innlogging), NFR-2, NFR-6, NFR-12, §7.1, §7.2, §10 og A-9.
  - NFR-5 krever ikke lenger at forsiden sier at dataene er syntetiske, men README skal si det. En lokal installasjon åpner på innlogging.
- PRODUCT.md: listen over kjerne og stage 2 er oppdatert.
- DESIGN.md: komponentbeskrivelsen av demo-forsiden er skrevet om, og listen over utdaterte mocks er oppdatert.
- EXPERIENCE.md:
  - Log in og Create account er lagt i IA-tabellen.
  - ACC er fjernet fra stage 2-plassene.
  - Avsnittet om demo-forsiden er skrevet om.
  - Log out ligger i en brukermeny i verktøylinja [ASSUMPTION].
  - UJ-1 starter nå med innlogging.
  - Open Question 11 er oppdatert, og 15 er ny: Log in-sidene har ingen mock.
- `.memlog.md` har fått fire nye linjer.
- Oppfølging samme dag. Brukeren bekreftet at innlogging og kontoopprettelse skal være i kjernen, og at kjernestørrelsen er under kontroll.
  - FR-41 er flyttet fra stage 2 til «if time allows» i PRD §7.5, UJ-3, §4.11 og §10, og i EXPERIENCE.md.
  - Ny FR-50, Demo version (milestone 2):
    - En knapp på demo-forsiden hopper over innloggingen og åpner lista over lagrede planer som den seedede demokontoen.
    - Den finnes bare på den offentlige demoen, og ingen plan er forhåndslastet.
    - Oppdatert i PRD (ordliste, §4.0, NFR-5, §7.1, §10), PRODUCT.md, DESIGN.md og EXPERIENCE.md.
    - Mocken har fått en tertiærknapp med play-ikon og én hjelpelinje under.
  - README har fått seksjonen «Demo og data»: bare syntetiske data, `data/sample/`, Demo version, demokontoen `demo`/`demo` og Create account.
- Committet på brukerens bestilling som `4d5b869` på `main` (ikke pushet): PRD, PRODUCT.md, README, DESIGN.md, EXPERIENCE.md, `.memlog.md`, `mockups/landing.svg` og `.working/landing-redesign/`.

### Åpne punkter
- Log in- og Create account-sidene finnes bare i tekst, uten mock. Layout, feiltekster og plasseringen av Log out må tegnes og vurderes (EXPERIENCE.md Open Question 15).
- Demokontoens brukernavn og passord (`demo`/`demo`) i README er valgt av Claude og må bekreftes, og seedingen må bruke dem.
