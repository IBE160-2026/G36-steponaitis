# Kildeoppdateringer fra spine

## 2026-11-16 kl. 21:30 — Justas

### Oppgave
Etter `bmad-help` ba brukeren meg rette de to åpne punktene fra [arkitektur-spine](984-2026-11-16-21-05-38-arkitektur-spine.md) slik jeg anbefalte. Det ene var å føre spinens Upstream Updates inn i PRD og EXPERIENCE.md. Det andre var å bekrefte de to gjenværende fast path-antakelsene, slik at kildedokumentene stemmer med arkitekturen før epics og stories.

### Plan
- Lest Upstream Updates og AD-5, AD-7, AD-8, AD-10–AD-12 og AD-16–AD-18 i `ARCHITECTURE-SPINE.md`, og brukt formuleringene derfra.
- Rettet PRD og EXPERIENCE.md direkte, uten en egen `bmad-prd`- eller `bmad-ux`-runde. Endringene er små, og beslutningene er allerede tatt i spinen.
- Antakelsene er godtatt som anbefalt, og markørene er fjernet fra spinen.

### Resultat
- **PRD** (`prds/prd-Project-2026-11-01/prd.md`):
  - FR-29 har to nye årsaker, partner_aisle (rule 3) og moved back (FR-34). Ingen andre årsaker gjør en anbefaling utdatert, og den første årsaken i lista vises.
  - UJ-2 og beskrivelsen av FR-38 lover ikke lenger at hvert mål er tomt: unntaket er sykluser/swap, og Put together kan la andre deler stå.
  - FR-41 og UJ-3 legger nå endringen oppå den andre brukerens endringer, i stedet for at «last save wins».
  - §10 har fått et nytt punkt om endringene fra spinen.
- **EXPERIENCE.md** (`ux-designs/ux-Project-2026-11-11/EXPERIENCE.md`):
  - Importen viser opplastingsfremdrift og deretter ett serversteg. Cancel finnes bare under opplastingen. UJ-1 og UJ-5 er rettet til samme ordlyd.
  - Under lagring er kontrollene deaktivert («Saving the last change…»). «Save failed» prøver på nytt i ca. 15 s, deretter forkastes endringen og planen hentes på nytt.
  - Nye tilstander: Upload too large (4 MB / 25 000 rader), Plan deleted while open, Session expired, Login locked (5 forsøk, 1 min) og Demo limits reached.
  - Tekst for de nye outdated-årsakene. Fargereserven varer til siden lastes på nytt eller lukkes.
  - Utskriften viser ROUND 0 «before the first run», og hull i rundenummereringen beholdes. «Page X of Y» er best effort.
  - Undo-teksten dekker kombinert flytt («Undo splits move 3 …») og fjernet flytt («Undo restores move 4 …»), og toasten følger den. FR-41-teksten er rettet.
  - Notatet «Updated on 2026-11-16 from the architecture spine» står under Open Questions.
- **Spine:** `[ASSUMPTION]` er fjernet fra root-`npm run dev` (concurrently) og fra preview-deployments av for hele prosjektet. Innledningen sier nå at ingen antakelser gjenstår, og Upstream Updates er markert som utført. Memloggen har to nye linjer.
- To punkter i `issues.md` fra arkitektur-spine er lukket.
- Dokumentendringene er ikke committet. Bare loggfilene er committet.

### Åpne punkter
Ingen.
