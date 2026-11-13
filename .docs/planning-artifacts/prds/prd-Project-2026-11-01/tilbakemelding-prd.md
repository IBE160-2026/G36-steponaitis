# Tilbakemelding på PRD

| | |
|---|---|
| **Gruppe** | G36 – G36-steponaitis |
| **PRD vurdert** | `.docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md` (status `final`, sist endret 2026-11-11, commit 7f2cfa7) |
| **Dato** | 2026-11-12 |
| **Type** | Formativ tilbakemelding, ikke karakter |

## 1. Samlet inntrykk

Dette er en uvanlig sterk PRD: tydelig tese, et presist glossar og 48 FR-er med testbare konsekvenser som kan bli testtilfeller nesten uendret. Brukbarheten for neste fase er størst for kjernelogikken (klassifisering, plukkgrupper, regler). Risikoen er størrelsen: ca. 10 000 ord og en kjerne på 38 FR-er for én person på to måneder, der de mest kompliserte reglene (runder, regelgrenser, sammenslåing av flyttinger) gir mye å bygge og teste.

## 2. Dette fungerer godt

- **Reglene er konkrete nok til å testes.** §3 og FR-16/17 gir terskler og grenseverdier («24 or more picks → fast-moving; 6–23 → medium-moving»), og FR-24–FR-27 fastsetter rekkefølge og tie-breaks. Det er nettopp dette briefen-tilbakemeldingen ba om.
- **Kontroll og testing er tenkt gjennom.** §7.3 lister hva fasit-datasettet må dekke (grenseverdier, «no space», angre etter ny kjøring, bytte av to deler), og NFR-1 krever at reglene er egne moduler som testes uten brukergrensesnitt. NFR-2/3 gjør at sensor kan kjøre alt uten nøkler, språkmodell eller kostnad.
- **Ærlig avgrensning.** §6 Non-Goals begrunner utelatelsene («The data has no size or capacity information»), §7 deler kjernen i to milepæler med egne porter, og SM-C3 (ikke starte før porten er passert) følger opp rådet om å ferdigstille en liten kjerne først.

## 3. Oversikt per dimensjon

| Dimensjon | Vurdering | Kort begrunnelse |
|---|---|---|
| Beslutningsklarhet | sterk | Valg og avveininger er datert og begrunnet (§10, addendum), med avviste alternativer. |
| Substans | sterk | Innholdet er eid og domenespesifikt; NFR-ene har tall (NFR-8) og er ikke boilerplate. |
| Strategisk sammenheng | god | Teser og funksjoner henger sammen, men suksessmålene måler mest at testene passerer, ikke at anbefalingene er gode. |
| Testbarhet | sterk | Nesten alle FR-er har målbare konsekvenser og en fasit å teste mot. |
| Scope og avgrensning | god | Non-Goals og milepæler er tydelige, men omfanget i kjernen er stort for én person. |
| Brukbarhet for neste fase | god | Glossar og ID-er er konsekvente; lengden og prosessporet gjør uttrekk tyngre enn nødvendig. |
| Formtilpasning | god | Passer et verktøy med én hovedbruker; ny «Key screens»-oversikt (§4.0) hjelper UX. Noe overformalisert. |

## 4. Viktigste forbedringer

### 4.1 Kjernen er stor, og de vanskeligste reglene ligger sent
- **Alvorlighet:** høy
- **Hvor:** §7.1 («The core is FR-1–FR-38»), FR-26, FR-34, FR-38
- **Problem og hvorfor det betyr noe:** FR-26 har fire unntak i punktlister, FR-34 slår sammen flyttinger, og FR-38 sorterer flyttelisten med syklushåndtering. Hver av disse trenger egne fasit-tilfeller og mange stories. Alt ligger i milepæl 2, som er «core» og dermed ikke kan kuttes uten å bryte porten (SM-1 «in full»).
- **Forslag:** Velg hva som kan gå til trinn 2 hvis tiden strammer inn, og skriv det inn som «kan utsettes». Et eksempel: FR-34 kan erstattes av «to flyttinger av samme del i samme runde vises som to linjer, og planleggeren slår dem sammen for hånd». Da trenger ikke SM-1 å dekke FR-34 for å åpne porten.

### 4.2 Suksessmålene måler ikke om anbefalingene er gode
- **Alvorlighet:** medium
- **Hvor:** §8 SM-1, SM-3–SM-5, SM-7; NFR-4/5 og §9 punkt 2
- **Problem og hvorfor det betyr noe:** SM-1 og SM-2 viser at koden følger reglene, ikke at reglene hjelper. SM-3–SM-5 skal vurderes mot «the author's knowledge», men §9 sier at ekte data ikke importeres, og kursdataene er syntetiske. Da er det uklart hva forfatterens kunnskap kan sammenlignes med. SM-7 («The course is satisfied») er ikke et produktmål.
- **Forslag:** Gjør SM-3–SM-5 målbare på demo-dataene, f.eks.: «Etter å ha anvendt alle runde 1-anbefalinger på `data/sample/` øker antall fast-moving deler i beste lokasjoner og antall plukkgrupper i samme gang, ifølge før/etter-tabellen (FR-37).» Skriv ærlig at SM-5 gjelder en realistisk vurdering på syntetiske data, og flytt SM-7 til dokumentasjonen.

### 4.3 PRD-en bærer sitt eget arbeidsspor
- **Alvorlighet:** medium
- **Hvor:** §0, §10, §11, og inline «(decision 2026-11-02)» i f.eks. FR-26/FR-27
- **Problem og hvorfor det betyr noe:** Ca. 10 000 ord gir UX, arkitektur og stories mye å lese. §10 (endringer fra briefen) og §11 (22 bekreftede antakelser) beskriver historien, ikke kravene, og vedtaksdatoer midt i FR-ene gjør konsekvensene tyngre å lese.
- **Forslag:** Flytt §10 og §11 til `addendum.md`, behold bare datoene i addendumet, og la FR-ene stå som rene setninger. Alternativt: skriv bare «Se addendum» i §0.

### 4.4 Milepælene har avhengigheter som ikke er synlige
- **Alvorlighet:** medium
- **Hvor:** §7.1 milepæl 1 mot FR-23, FR-27, FR-29
- **Problem og hvorfor det betyr noe:** Milepæl 1 skal kunne bygges først, men FR-23 viser til «reset (FR-35)», FR-27 og FR-26 til «kept in place» (FR-32), og FR-29 til «any undo» (FR-35). Alle tre ligger i milepæl 2. Fasiten for milepæl 1 inneholder også «a part kept in place».
- **Forslag:** Legg til en kort setning i milepæl 1: «Reglene i FR-26/FR-27 ignorerer ‘keep in place’ til FR-32 er bygd; fasitens tilfelle for dette hører til milepæl 2.» Eller flytt FR-32 til milepæl 1.

### 4.5 Små løse tråder
- **Alvorlighet:** lav
- **Hvor:** §9 («No open questions remain») mot addendum («should be re-checked when the tests run»)
- **Problem og hvorfor det betyr noe:** Addendumet har en kjent avvik mellom to tall for døde deler (636 og 640) som ikke står i åpne spørsmål.
- **Forslag:** Skriv det som åpent spørsmål 1: «Avklar 636 mot 640 før fasit for demo-data fryses.»

## 5. Mekaniske funn

- FR-12 (slett plan), FR-34 og FR-36 nevnes ikke i noen UJ; UJ-1 viser til «FR-13–FR-33» som en bred rekkevidde. Legg til én setning om sletting i UJ-3, eller godta at FR-ene er støttefunksjoner.
- ID-ene FR-1–FR-48, SM-1–SM-7 og A-1–A-22 er sammenhengende, og krysshenvisningene jeg sjekket løser seg.
- Glossaret brukes konsekvent. Antakelsene er samlet i §11 og alle bekreftet; det finnes ingen ubesvarte `[ASSUMPTION]`.
- Ingen sensitive opplysninger funnet.

## 6. Før dere går videre

**Må avklares før UX, arkitektur og epics:**
- Hva som kan utsettes fra kjernen hvis tiden blir knapp (4.1), og hvordan milepælene skal håndtere FR-32/FR-35 (4.4).
- Hvordan SM-3–SM-5 skal måles på syntetiske data (4.2).

**Kan vente:** rekkefølgen i trinn 2 (settes i sprintplanlegging), 636/640-avviket, valg av lagring og distribusjon (overlatt til arkitektur).

**Tilbakemelding på briefen:** hovedpunktene er fulgt opp (**ja**). Kjernen er delt fra trinn 2, tersklene og plukkgruppereglene er definert, import med manglende kolonne gir feilmelding uten halvlagrede data (FR-3), importen endres aldri (FR-36), fasit-datasett er planlagt (§7.3), nøkkelskjermbilder er skissert (§4.0) og data er avgrenset til syntetiske (NFR-4).

## 7. Refleksjonsspørsmål

1. Mange regler ble avgjort etter at KI-en eller gjennomgangen fant sløyfer (addendum, «Why rule 3 has limits»). Hvordan sjekket dere selv at hvert unntak er riktig, og ikke bare logisk konsistent med KI-ens forslag?
2. Hvis dere bare får tid til halvparten av kjernen, hvilke FR-er sier dere at planleggeren ikke kan klare seg uten, og hvilke er «fint å ha»?

_Vurdert mot kvalitetsrubrikken i bmad-prd. Dette er veiledning, ikke sensur._
