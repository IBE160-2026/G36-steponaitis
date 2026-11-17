# Åpne punkter før sprint planning

## 2026-11-17 kl. 22:09 — Justas

### Oppgave
Etter `bmad-help` ville brukeren lukke de tre åpne punktene fra [epics-og-stories](982-2026-11-17-21-40-20-epics-og-stories.md) før sprint planning: Story 12.1 mot spinen, spine-endringer for stage 2/ITA, og om de største storyene skal deles.

### Plan
- Lest Story 1.1, 10.2, 10.4, 12.1, 13.1–15.1 og spinens AD-3, AD-6, AD-10, AD-11, Capability map og Deferred.
- Tre beslutninger lagt frem for brukeren (AskUserQuestion), alle tre med anbefalt valg eller eksplisitt valg:
  1. 12.1: oppdater spinen (anbefalt) — valgt.
  2. Stage 2/ITA: lukk, storyene bærer spine-endringen selv; legg en merknad i Deferred (anbefalt) — valgt.
  3. Deling: bare 1.1 deles i tre; 10.2 og 10.4 forblir som de er.

### Resultat
- **ARCHITECTURE-SPINE.md** (`updated: 2026-11-17`):
  - AD-3: move-preview returnerer også `target: empty | occupied | none` og `target_parts[]` (delene på `to`), slik at slippdialogen aldri regner dem ut selv.
  - Capability map, FR-51: `domain/drag` (handlere for `move_parts`, `put_together`, `swap`, dispatchet av `domain.apply`). Story 12.1 er dermed i tråd med spinen uten endring.
  - Deferred, Stage 2: merknad om at Story 13.1, 13.4, 14.1 og 15.1 oppdaterer spinen i samme endring (globale kategoritabeller, starterkategorier som andre seed, QR-bibliotek i Stack, `plan_changed` i AD-11).
- **epics.md** (nå 75 stories, Epic 1 har 9):
  - Story 1.1 delt i 1.1 «Local walking skeleton» (scaffold, `npm run dev`, `/api/health`, lag- og slice-regler lokalt, `.gitignore`, README), 1.2 «CI on every push» (ci.yml med SQLite + Postgres 17, `/api/health` mot Postgres, bevisst brudd feiler CI; schema-diffen legges til av storyen som først genererer `schema.ts`) og 1.3 «Live on the public Vercel URL» (Vercel Services, Supabase, Production-variabler uten `JWT_SECRET` som kommer i 9.7, oppstartssjekk, `keep-alive.yml` med `workflow_dispatch`, README-URL).
  - Tidligere 1.2–1.7 renummerert til 1.4–1.9, med alle henvisninger (1.5→1.7, 1.7→1.9) og «affects Epic 1 Stories 1.1–1.3» i Additional Requirements.
- Lukket i `issues.md`: alle tre punktene fra 2026-11-17.
- Endringene i spinen og epics.md er committet som `222c3fb` («Resolve open planning items before sprint planning») og pushet til origin/main sammen med loggcommiten, slik brukeren ba om.

### Åpne punkter
Ingen.
