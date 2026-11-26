# Issue-triage av alle åpne punkter

## 2026-11-26 kl. 17:32 — Justas

### Oppgave
Justas spurte om hver story bør gås gjennom én og én for å rette alle åpne punkter og spørsmål. Anbefalingen var å triagere i stedet, og Justas ba om å kjøre triagen. I samme økt ble appen startet lokalt.

### Plan
- `/bmad-help`: Epic 16 pågår. Story 16.1 står i `review` og venter på de manuelle deploy-sjekkene. Story 16.2 er i backlog.
- Delte de 109 åpne punktene i `issues.md` i fire deler. Fire lesende agenter (Explore) sjekket hver sin del mot koden (`163fa95`), specene, loggene, git-historikken og `sprint-status.yaml`, og la hvert punkt i én kategori: STALE, DECISION, BUG, TESTGAP, HUMAN eller POLISH.
- Samlet resultatet i én rapport.

### Resultat
- Rapport: [issue-triage-2026-11-26.md](../../.docs/implementation-artifacts/issue-triage-2026-11-26.md). Fordeling: 19 STALE, 24 DECISION, 11 BUG (alle lave), 12 HUMAN, 7 POLISH og 36 TESTGAP. Rapporten er ukommittert.
- Ingen punkter i `issues.md` er lukket ennå, og ingen kode er endret. Lukking venter på godkjenning fra Justas.
- Nye funn som er bekreftet i koden:
  - Undo-toasten nevner runden til det opprinnelige flyttet (`lib/commands/undo.ts:62`).
  - Kategorivelgeren normaliserer ikke tekst slik serveren gjør (`aisle-categories-tab.tsx:35-36`).
  - Transaksjonskoden «00» som tekst danner en jobb (`pick_groups.py:16,29`).
  - Én stor jobb gir kvadratisk partelling (`pick_groups.py:41`).
- Ingen tester ble kjørt. Appen kjører lokalt med `npm run dev` på :3000 og :8000.

### Åpne punkter
- Godkjenn eller avvis triage-rapporten: lukk de 19 STALE-punktene, ta stilling til de 24 beslutningene, frafall de 36 TESTGAP-punktene eksplisitt (blant dem de ikke-kjørte oppfølgingsreviewene som formelt blokkerer) og de 7 POLISH-punktene.
- Velg hvilke billige feil fra triagen som skal rettes (138 undo-runde, 220 kategorinormalisering, 85 «00»-kode, 86 tak på jobbstørrelse), og hvilke som frafalles.
