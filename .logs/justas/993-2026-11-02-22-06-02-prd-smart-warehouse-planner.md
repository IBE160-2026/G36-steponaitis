# PRD for Smart Warehouse Planner

## 2026-11-02 kl. 22:06 — Justas

### Oppgave
Fullføre PRD-utkastet som ble startet 2026-11-01 (bare tittel og frontmatter), etter at `bmad-help` viste at PRD var neste påkrevde steg. Brukeren valgte fast path og ba om finalize til slutt.

### Plan
- `bmad-help` → `bmad-prd` (Update/resume av `.docs/planning-artifacts/prds/prd-Project-2026-11-01/`).
- Discovery: leste brief, brief-addendum og lærertilbakemelding. Stakes: karaktersatt soloprosjekt, maks ca. 10 brukere. Ingen ny webresearch (konkurranseanalysen er nedprioritert).
- Fast path: én samlet spørsmålsrunde (12 spørsmål), deretter fullt utkast med `[ASSUMPTION]`-merker.
- Finalize: gjennomgang av memlog, avstemming mot de tre kildene og rubric-review (fire parallelle agenter), fire beslutninger fra brukeren, omskriving, bekreftelse av alle antakelser, språkvask (`bmad-review` structure+prose) og status `final`.
- Beslutningslogg: `.docs/planning-artifacts/prds/prd-Project-2026-11-01/.memlog.md` (33 linjer).

### Resultat
Alt ligger i `.docs/planning-artifacts/prds/prd-Project-2026-11-01/`. Mappen er committet som `44bd2fb` («Legg til ferdig PRD for Smart Warehouse Planner») og pushet til `origin/main` sammen med loggcommitene, etter at brukeren ba om det.
- `prd.md` (`status: final`): 48 FR (kjernen er FR-1–FR-38, trinn 2 FR-39–FR-48), 12 NFR, SM-1–SM-7 og SM-C1–SM-C3, UJ-1–UJ-3, ordliste, skjermoversikt (§4.0), kjernen delt i to milepæler (§7.1), case-liste for fasitdatasettet (§7.3), endringer fra briefen (§10) og 22 bekreftede antakelser (§11).
- `addendum.md`: begrunnelser for rekkefølgen i flyttelista, angre, rule 3-grensene, «keep in place», milepælene og referansetall for demodataene.
- Gjennomgangsrapporter: `review-rubric.md` og `reconcile-brief.md`, `reconcile-brief-addendum.md` og `reconcile-teacher-feedback.md`. Ingen kritiske funn. Alle høye funn er rettet.
- Brukerens beslutninger (alle logget i memlog):
  - Planer slettes permanent etter bekreftelse, uten arkiv.
  - Endringer lagres automatisk.
  - Anbefalinger kan brukes én og én eller alle samtidig, og en anbefaling kan brukes med en annen lokasjon som oppfyller regelen.
  - Manuelle flyttinger får regelen «Manual» og gjeldende runde, og kan gå til opptatte lokasjoner.
  - Angre og nullstill.
  - Fritt for alle å opprette konto (overstyrer brief-addendumet).
  - Kategoriinnstillingene er globale, og etiketter bruker kun QR-kode.
  - Brukergrensesnittet er på engelsk, og brukersuksess får ikke tall.
  - Nye rule 3-grenser mot runder som går i ring.
  - Ny funksjon «Keep in place» for å avslå en anbefaling.
  - Kjernen bygges i to milepæler, og advarselen om samtidig redigering flyttes til trinn 2.
  - Innenfor en runde kommer flytting ut før flytting inn.
  - Vercel-appen er kun en demo med syntetiske data.
- Lukket fire punkter i `issues.md`: standardvalgene, hvordan brukere opprettes, «hvorfor nå» og tall for brukersuksess.

### Åpne punkter
- Fasitdatasettet er fortsatt ikke laget. §7.3 i PRD-en lister nå alle tilfellene det må dekke (allerede åpent i `issues.md`).
- Det er uavklart om Walk Path-rekkefølgen stemmer med hvordan folk faktisk går på lageret (Open Question 1). Sjekkes når flyttelista prøves på lageret.
- Importen må sjekkes mot ekte eksportfiler før de brukes: andre kolonnenavn, flere lokasjonsmønstre, og at retur går via `RETURN-SKRS`/Putaway (Open Question 2).
