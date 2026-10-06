# Tilbakemelding på product brief

| | |
|---|---|
| **Gruppe** | G36 – G36-steponaitis |
| **Product brief** | `.docs/planning-artifacts/briefs/brief-Project-2026-09-27/brief.md` (commit `57d0bd3`) |
| **Tilbakemelding fra** | Faglærer i IBE160 (utarbeidet med KI-støtte) |
| **Dato** | 2026-10-06 |

## Samlet vurdering

- **Godt utgangspunkt med justeringer.** Gruppen kan gå videre og innarbeide punktene under.

Vi har vurdert `brief.md` for «Smart Warehouse Planner» sammen med `addendum.md` i samme mappe.

**Det som er bra:**

1. Dette er et ekte problem fra egen arbeidsplass: et reservedelslager der plasseringen ikke følger bruken, deler som plukkes sammen står langt fra hverandre, og oversikten ligger i flere Excel-filer. Dere har egen domenekunnskap og realistiske data. Det gir et godt grunnlag for å kontrollere at appen gir riktige svar.
2. Avgrensningene er modne. Verktøyet er ikke koblet til hovedsystemet og skriver aldri tilbake, «it suggests, and people decide», og planleggingskopien gjør det trygt å prøve en ny plassering. Det er også et godt valg å droppe KI-genererte forklaringer og sette avstandsdata som betinget tillegg.

**De viktigste endringene:**

1. MVP-en har tretten «must-have»-punkter for én person. Dere påpeker selv at det gir lite slakk. Del MVP-en i en kjerne (import, deler og lokasjoner, bevegelsesklassifisering, analyse av deler som plukkes sammen, anbefalinger og planleggingskopi) og et trinn 2 (etiketter med QR-kode, dashbord og belegg per gang).
2. Suksesskriteriene bygger mest på deres eget skjønn («matches the author's knowledge») og på bruk etter emnet. Legg til kriterier med konkrete terskler og forventede resultater som kan testes.
3. Definer reglene presist: grenser for fast/medium/slow/dead stock (for eksempel antall plukk per 12 måneder), hva som teller som «frequently picked together» (for eksempel antall felles transaksjoner) og hvordan en anbefaling velges. Det er dette Claude Code skal implementere, og det dere skal teste mot.

## Vanskelighetsgrad og gjennomførbarhet

### Vurdert vanskelighetsgrad

- **Middels**

**Sammenlignbart med:** 4) KI-støttet MRP II (vanskelig), avgrenset til én modul. Prosjektet har logistikkdomenelogikk på samme måte, men bare for lagerplassering. Bredden tilsvarer middels-forslagene som 2) AI CV- og søknadsassistent.

**Begrunnelse:**

| Faktor | Nivå (lav / middels / høy) | Kommentar |
|---|---|---|
| Domenelogikk – hvor mange og hvor kompliserte regler og beregninger må stemme? | middels | Bevegelsesklassifisering, analyse av deler som plukkes sammen (samforekomst på transaksjonsnummer) og regler for anbefalt plassering. Reglene er forståelige, men må defineres. |
| Datamodell – antall entiteter og relasjoner mellom dem | middels | Del, lokasjon, gang/sone, beholdning, transaksjon, plukkgruppe og planleggingskopi. Planleggingskopien betyr i praksis to versjoner av lageret. |
| Brukere, roller og innlogging | lav | Én primærbruker (lagerplanleggeren). Innlogging er ikke nevnt og trengs neppe i v1. |
| KI-funksjonalitet i appen, f.eks. kall til språkmodell, prompts i koden og håndtering av usikre svar | lav | «AI» er her samforekomstanalyse (market basket), ikke en språkmodell. Det er et godt og testbart valg. Kall det gjerne dataanalyse, slik at det er tydelig hva det er. |
| Integrasjoner og eksterne tjenester, f.eks. API-er, betaling og e-post | lav | Ingen eksterne tjenester. Hovedsystemet er bevisst holdt utenfor. |
| Sanntid, samtidighet eller flere brukere som påvirker hverandre | lav | Én bruker om gangen. |
| Filhåndtering, f.eks. opplasting, PDF-lesing og eksport | middels | Import fra CSV/Excel med ukjent kvalitet og kolonneoppsett, og utskrift av etiketter med QR- eller strekkode. |
| Sikkerhet og personvern | middels | Firmadata er konfidensielle. Kursversjonen bruker endrede data, men repoet er offentlig. Vær sikker på at dataene som committes, er tilstrekkelig anonymisert. |

**Hva vanskelighetsgraden betyr for dere:**

- _Middels:_ Et godt balansert valg. Pass på at kjerneflyten blir ferdig og stabil før dere legger til mer. Kjerneflyten her er: importer → klassifiser → finn plukkgrupper → få anbefalinger → prøv dem i planleggingskopien.

### Gjennomførbarhet med BMAD og Claude Code

Dere skal planlegge med BMAD (product brief → PRD → arkitektur → epics og stories) og implementere med Claude Code. Vurderingen under tar hensyn til at det må være tid til hele denne flyten, og til testing, retting og README til slutt.

| Spørsmål | Vurdering (OK / risiko / stor risiko) | Kommentar |
|---|---|---|
| **Tid og omfang** – kan v1 realistisk bli ferdig og stabil i løpet av semesteret, med tid til flere iterasjoner? | risiko | Tretten punkter alene, med BMAD-flyten og testing i tillegg, er stramt. Med en prioritert kjerne er det realistisk. |
| **BMAD-flyten** – er briefen konkret nok til at PRD, arkitektur og stories kan lages uten store hull, og blir det overkommelig mange stories? | OK | Funksjonene er konkret beskrevet i briefen og addendum. «Open Questions» om Excel-filene og definisjonen av beste lokasjoner bør avklares før PRD. |
| **Egnet for Claude Code** – bruker løsningen en vanlig, godt dokumentert teknologistakk som Claude Code håndterer godt, eller krever den nisjeteknologi, spesialmaskinvare eller mye manuell konfigurasjon? | OK | CRUD, import, tabeller, enkle analyser og QR-generering er godt egnet. Utskrift av etiketter kan kreve litt prøving. |
| **Kontroll på KI-ens arbeid** – kan gruppen selv avgjøre om koden gjør det riktige? Krever domenet kunnskap gruppen ikke har, f.eks. avanserte beregninger eller fagregler, så er det vanskelig å kvalitetssikre. | OK | Dere kjenner lageret og kan kjenne igjen riktige plukkgrupper og klassifiseringer. Det er en stor fordel. |
| **Testbarhet** – finnes det tydelige regler og forventede resultater som tester kan skrives mot? | risiko | Klassifisering og samforekomst er ideelle for enhetstester med et lite, håndlaget datasett, men først når terskler og regler er bestemt. |
| **Kjørbar for sensor** – kan appen kjøres lokalt etter README, uten gruppens nøkler, betalte kontoer eller egen infrastruktur? | OK | Ingen språkmodell eller eksterne tjenester. Legg ved et anonymisert eksempeldatasett, så kan sensor kjøre hele flyten. |
| **Avhengigheter og kostnader** – krever løsningen betalte API-er, f.eks. språkmodeller, og finnes det en plan for kostnad, testmodus eller mock-data? | OK | Ingen betalte API-er. |

**Konklusjon om gjennomførbarhet:**

- **Gjennomførbart med justert omfang.** Se forslagene under.

**Forslag til justering av omfang eller vanskelighetsgrad:**

1. Flytt etiketter med QR- eller strekkode, dashbord og belegg per gang til et trinn 2 som tas når kjerneflyten er ferdig og testet. De er nyttige, men ikke nødvendige for å vise verdien av anbefalingene.
2. Start med én enkel, forklarbar anbefalingsregel, for eksempel: fast-moving-deler flyttes til merkede beste soner, og deler i samme plukkgruppe legges i samme gang. Mer avansert optimalisering av hele lageret holdes som «if time allows», slik dere allerede har gjort.

## Hvorfor product brief er viktig for mappen

Product brief er utgangspunktet for PRD, arkitektur, stories og til slutt koden. Del 1 av mappen vurderes blant annet på om sensor kan følge en sporbar vei fra plan til ferdig app. Den vurderes også på om appen gjør det dere har beskrevet, om den er testet, om den er godt designet, og om den kan kjøres etter README. Et uklart, for stort eller for lite brief gjør alt dette vanskeligere senere. Det er mye enklere å rette nå enn sent i semesteret.

## 1. Gjennomgang av briefens deler

| Del av brief | Status | Kommentar |
|---|---|---|
| Executive Summary – er det klart hva appen er, og hvilket problem den løser? | OK | Klart at dette er et planleggingsverktøy for et reservedelslager som anbefaler bedre plasseringer uten å endre hovedsystemet. |
| The Problem – er problemet konkret, med reelle situasjoner og brukere? | OK | Fire konkrete problemer fra egen arbeidshverdag, blant annet eksempelet med flere turer per plukk og spredte Excel-filer. |
| The Solution – beskriver løsningen brukeropplevelsen, ikke bare teknologi? | OK | Sju nummererte trinn som beskriver hva planleggeren gjør. Teknologi er holdt utenfor. |
| What Makes This Different – er vurderingen ærlig og realistisk? | OK | Ærlig og konkret. Dere er tydelige på at sortering etter frekvens er standard, og at plukkgruppene og planleggingskopien er det nye. |
| Who This Serves – er primærbrukerne tydelige, og vet vi hva de trenger? | OK | Én tydelig primærbruker. «IBE160 examiners» trenger ikke stå som målgruppe for selve produktet. |
| Success Criteria – kan kriteriene faktisk sjekkes eller testes? | Juster | Kriteriene bygger på skjønn og på bruk etter emnet. Legg til kriterier som «en del med minst N plukk siste 12 måneder klassifiseres som fast-moving», «to deler som opptrer på samme transaksjon i minst N tilfeller, vises som plukkgruppe», «import av en fil med manglende kolonne gir en tydelig feilmelding og ingen halvimporterte data» og «endringer i planleggingskopien påvirker ikke den importerte beholdningen». |
| Scope – er det klart hva som er med i første versjon, og hva som ikke er det? | Juster | Tydelig delt i MVP, «if time allows» og «out». MVP-en er for stor for én person. Prioriter innenfor den. |
| Vision – henger visjonen sammen med resten uten å blåse opp omfanget? | OK | Lagerkart, skanning og avstandsmodell ligger tydelig etter MVP. |

## 2. Utgangspunkt for del 1 av mappen

Punktene følger kriteriene i sensorveiledningen for del 1. Vektene i parentes viser hvor mye hvert kriterium teller i del 1.

| Kriterium i del 1 | Hva briefen bør legge til rette for | Status | Kommentar |
|---|---|---|---|
| **1. Prosess og KI-styring** (30 %) | Brief som er presis nok til at PRD og stories kan bygges direkte på den, slik at krav kan spores fra brief til kode. | OK | Briefen og addendum er presise, og endringer er datert, for eksempel at plukkgruppeanalysen ble flyttet inn i MVP og at forklaringer ble droppet. Fortsett å dokumentere slike beslutninger. |
| **2. Funksjonalitet og omfang** (20 %) | Realistisk omfang for gruppen og semesteret: en tydelig kjerneflyt som kan bli ferdig og stabil, og nok innhold til å vise reell funksjonalitet. | Juster | Rikelig funksjonalitet, men risiko for at mye blir halvferdig. Prioriter kjerneflyten. |
| **3. Kvalitetssikring og testing** (15 %) | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller. | Juster | Domenet er godt egnet for tester. Fastsett terskler og regler, og lag et lite testdatasett med kjent fasit. |
| **4. Design og brukeropplevelse** (10 %) | Tydelige brukere og brukssituasjoner som designet kan bygges rundt, gjerne med de viktigste skjermbildene eller flytene skissert. | Juster | Brukeren er tydelig. Skisser hvordan anbefalinger og planleggingskopien vises, for eksempel som en før/etter-tabell per gang. |
| **5. Kodekvalitet og arkitektur** (10 %) | Teknologivalg som er begrunnet og ikke mer komplekse enn appen trenger. | OK | Ingen eksterne tjenester eller språkmodell. Hold analyselogikken i egne, testbare moduler. |
| **6. README og kjørbarhet** (10 %) | Løsning som andre kan kjøre lokalt uten betalte kontoer, og uten tilgang til gruppens egne tjenester og nøkler. | OK | Gode forutsetninger. Legg ved et anonymisert eksempeldatasett og beskriv importen steg for steg i README. |
| **7. Ryddighet i repoet** (5 %) | En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge. | Juster | Bestem hvor eksempeldata skal ligge, og sørg for at ekte eller lite anonymiserte firmadata aldri committes, heller ikke i historikken. Legg Excel-filer fra jobben i `.gitignore`. |

## 3. Neste steg for gruppen

1. Gå gjennom Excel-filene og besvar «Open Questions» (kolonner, tidsrom og definisjon av beste lokasjoner). Skriv deretter ned tersklene for bevegelsesklasser og regelen for plukkgrupper.
2. Del MVP-en i kjerne og trinn 2, og legg til testbare suksesskriterier med konkrete terskler.
3. Lag et lite, anonymisert testdatasett med fasit (forventede klasser og grupper) før implementeringen starter, og gå videre til PRD.

Oppdater product brief i repoet når dere har gjort endringene, slik at historikken viser hvordan planen utviklet seg. Det er en del av prosessen sensor ser etter.
