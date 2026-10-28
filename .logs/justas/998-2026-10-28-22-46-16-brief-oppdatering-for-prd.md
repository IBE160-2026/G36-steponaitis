# Brief-oppdatering før PRD

## 2026-10-28 kl. 22:46 — Justas

### Oppgave
Gå gjennom prosjektet etter `bmad-help`, finne brainstormingtema og anbefalinger før PRD, og oppdatere briefen og addendumet med brukerens beslutninger (lagrede planer, flyttliste, innlogging) og de hullene gjennomgangen avdekket.

### Plan
- `bmad-help`: brief er `final`, PRD er neste påkrevde steg.
- Leste brief, addendum, lærertilbakemelding, øktlogg og demodata; kjørte reglene mot `data/sample/` for å få tall (80 raske deler = 54 % av plukkene, 127 par ved terskel 5, 117 av dem i ulike ganger, 29–77 tomme lokasjoner per gang).
- Brukeren svarte på spørsmål om planer, utskrift og innlogging; to gjennomganger ga en liste over hull; brukeren ba om at alle ble rettet.
- Beslutninger der brukeren ikke svarte eksplisitt ble satt til anbefalt standard (se Åpne punkter).

### Resultat
Alle endringer er ukommittert (bortsett fra denne loggen).
- `brief.md`: New Plan (alle tre filer eller gjenbruk av en eksisterende plans originalfiler), lagrede planer (åpne, redigere, slette; sammenligning fjernet), flyttliste som nettleser-utskrift sortert på runde og deretter Walk Path, innlogging i trinn 2 med plan-listen som landingsside, opprydding av «create/edit locations», nye testbare suksesskriterier, omskrevet «What Makes This Different» ut fra konkurranseloggen, tredje brukergruppe (andre planleggere).
- `addendum.md`: ny seksjon «Plans, printing and users» (plan = frossen import + markeringer + planleggingskopi; samtidig redigering = siste lagring vinner med advarsel; bekreftelse ved sletting; minimal innlogging uten roller og registrering; «printed by» ikke sporet), regel «Rounds», virtuelle lokasjoner (`FLSKRS`) tillatt i import, utvidet suksessliste, seksjonene «Dropped (2026-10-28)» og «Competitor research (2026-10-28)», oppdaterte åpne spørsmål.
- `.gitignore`: `*.db`, `*.sqlite`, `*.sqlite3`, `uploads/` (verifisert med `git check-ignore`; `data/sample/` er ikke ignorert).
- Oppdaget at konkurranserapporten (`research.md`, digests, `.memlog.md`) er borte: mappen `.docs/planning-artifacts/research/competitive-warehouse-slotting-tools-2026-10-28/` har bare to tomme undermapper, og filene ble aldri committet.
- Lukket punktet om at briefen ikke var oppdatert med konkurrentfunnene (se `issues.md`).

### Åpne punkter
- Lukket senere samme økt: brukeren sa at konkurranserapporten og fristen ikke er viktige. Seksjonen «Competitor research» og spørsmålet om frist er fjernet fra addendumet, og alle rapportrelaterte punkter i `issues.md` er lukket. Briefens omskrevne «What Makes This Different» nevner fortsatt Optioryx, FORTNA og Infios uten kilde i repoet.
- Testdatasettet med fasit (ca. 20 deler) er ikke laget; lærertilbakemeldingen krever det før implementering.
- Beslutninger tatt som anbefalt standard uten eksplisitt svar: «create/edit locations» droppet; ny plan fra en annen plans resultat er utenfor omfang; sletting bekreftes (arkivering i stedet avgjøres i PRD).
- Hvordan brukere opprettes og lagres i trinn 2 (planlegger oppretter eller seedes) er bare satt som minimum og må konkretiseres i PRD/arkitektur.
