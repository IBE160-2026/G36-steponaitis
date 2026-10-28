# Deep recon: konkurrenter til Smart Warehouse Planner

## 2026-10-28 kl. 21:47 — Justas

### Oppgave
Kjøre `bmad-deep-recon` (type competitive) for å sjekke hvordan Smart Warehouse Planner (SWP) står mot eksisterende slotting-verktøy. Beslutningen: hvor SWP ligger i forhold til konkurrentene, som grunnlag for «What Makes This Different» i briefen og differensiering i PRD-en.

### Plan
- `bmad-help` viste at briefen er `final` og at PRD er neste påkrevde steg; brukeren valgte deretter å kjøre konkurranseresearch først.
- Konkurrenter foreslått ut fra tre søk og godkjent: Optioryx Pulse, FORTNA OptiSlot DC, Infios (Körber) Slotting, én enterprise-WMS (valgt: SAP EWM), én lettvekts lagerverktøy (valgt: Zoho Inventory), regneark som utgangspunkt.
- Preset `standard` (3 parallelle assistenter, 8 kilder per runde, validering `normal`). Trajectory kuttet til lett gjennomgang. Siste seksjon er en sammenligningstabell brief vs. konkurrenter.
- Tre assistenter bak «research firewall» (ingen prosjektfiler): A = tre slotting-leverandører, B = SAP EWM + Zoho, C = regneark-baseline + brukerstemme.

### Resultat
- Rapport: `.docs/planning-artifacts/research/competitive-warehouse-slotting-tools-2026-10-28/research.md` (status complete, 31 kilder), med `digests/` (tre filer) og `.memlog.md`. Mappen er ikke committet.
- Hovedfunn: Optioryx, FORTNA og Infios hevder alle pick-together (affinity), hastighetsplassering og forhåndsvisning før flytting. Briefens påstand om at pick-together er noe «et regneark eller enkelt verktøy ikke kan» holder mot regneark og Zoho, men ikke mot dedikert programvare. SWPs forsvarbare forskjell er åpenhet (publiserte terskler og regel per forslag), start fra eksisterende Excel-filer, ingen konsulent/tilbud, og lite spare-parts-lager. Ingen leverandør publiserer slotting-priser, terskler eller nevner reservedeler/små lagre.
- Verifisering (normal): 1 verified, 5 unverified, 1 disputed (Zoho-priser: offisiell side vs. Capterra), 1 overturned (Infios-affinity: den lille «ikke nevnt» var feil, Infios AI-side hevder affinity).
- Sitatsjekk: mekanisk OK (31 markører/31 rader). To kildefeil funnet og rettet i vedlegget.
- Begrensninger: nesten alt om konkurrentenes funksjoner er leverandørskrevet og ofte udatert; G2 og Reddit var blokkert, så ingen daterte 1–3★-sitater om slotting-verktøy.
- Briefen er IKKE endret; kun anbefalinger i rapporten.

### Åpne punkter
- Brief og PRD er ikke oppdatert med funnene: «What Makes This Different» bør skrives om (se Recommendations 1–4 i rapporten), og «enterprise systems are expensive and heavy» bør mykes opp til «priset på tilbud og solgt med implementering». Beslutning venter.
- Zoho-prisene er omstridt og må sjekkes på live-siden før de siteres.
- Optioryx sine utviklerdokumenter sier «OptiSlot — Coming Soon» mens markedsføringen selger slotting; om slotting faktisk er levert er uavklart.
- Ekte brukerstemme om slotting-verktøy mangler (G2/Capterra/TrustRadius/Reddit blokkert); kan løses manuelt eller med en utarbeidet prompt til eget research-verktøy.
- Ikke kjørt: semantisk sitatsjekk med eget subagent, HTML-briefing og `bmad-review`-polering (doc_standards). Blue Yonder og Manhattan er ikke dekket.
- Tre forelda rader i rapportens staleness-kart (FORTNA-casestudie 2023, SAP EWM 9.3-dokumentasjon, SAP-lisensestimater) bør sjekkes mot nyere kilder.
