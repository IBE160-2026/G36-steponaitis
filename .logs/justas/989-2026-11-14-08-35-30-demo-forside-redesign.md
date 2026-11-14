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
- Ingenting av dette er committet ennå. Bare loggfilene committes av denne skillen.

### Åpne punkter
- Log in- og Create account-sidene finnes bare i tekst, uten mock. Layout, feiltekster og plasseringen av Log out må tegnes og vurderes (EXPERIENCE.md Open Question 15).
- Det er antatt at FR-41 (advarsel ved samtidig redigering) blir i stage 2. Brukeren sa bare «login», så dette må bekreftes.
- README må si at den offentlige demoen bare har syntetiske data (NFR-5) og liste demokontoen (FR-40, NFR-2). README sier ingen av delene i dag.
- Innlogging i kjernen gjør kjernen større, mens lærerens tilbakemelding 4.1 sier at den alt er for stor. Dette bør tas med i samme avklaring om hva som kan utsettes.
