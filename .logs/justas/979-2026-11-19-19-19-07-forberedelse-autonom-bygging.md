# Forberedelse til autonom bygging

## 2026-11-19 kl. 19:19 — Justas

### Oppgave
Brukeren vil bygge alle epics og stories autonomt med goal-kommandoen, med én subagent per story og uten at et menneske må gripe inn. Før det trengs en liste over hva som må forberedes.

### Plan
- Lest `bmad-build-auto` (workflow, steg 1, 3 og 4, `customize.toml`) for å se hva skillen selv gjør og hva den overlater til andre.
- Sjekket den lokale maskinen (verktøy og nettlesere), GitHub-tilgangen, `.gitignore`, `data/sample/` og stories med eksterne steg: 1.2, 1.3, 5.8, 8.4, 9.7 og 12.5.

### Resultat
- Funn:
  - `bmad-build-auto` committer, men pusher ikke.
  - Den oppdaterer ikke `sprint-status.yaml`.
  - Den krever ren arbeidskopi og en branch som passer til storyen, ellers stopper den (HALT).
  - Subagentene ser ikke Claudes minne, så prosjektregler må ligge i filer.
- Maskinen:
  - Python 3.12 mangler (systemet har 3.9; `uv` finnes).
  - Microsoft Edge og Firefox mangler.
  - Docker er installert.
  - Vercel CLI og `psql` mangler.
- GitHub:
  - `gh` har scopene `repo` og `workflow`.
  - Actions-status på org-repoet kunne ikke leses (403, ikke admin).
- Listen er gitt brukeren i tre deler: A) bare brukeren kan gjøre, B) beslutninger, C) det Claude forbereder.

**Oppfølging kl. 19:32.** Brukeren valgte alle anbefalingene i B og utsatte deployment til nettsiden er godkjent:
- Beslutningene:
  - omfang epic 1–12
  - loopen fører milepælsportene selv
  - `main` med push etter hver story
  - stopp og varsel ved blokkert story
  - retrospektiv med `-H` etter hver epic
  - én logg per story
- **Deployment utsatt** (`53af420`):
  - Ny Epic 16 «Go live on the public URL» `[DEPLOY]`.
  - Story 1.3 er flyttet til 16.1.
  - Vercel-delene av 9.7 og 12.5 er flyttet til 16.2.
  - 9.7 heter nå «Production-like auth configuration, README and secrets».
  - Spinen har fått en merknad.
  - `sprint-status.yaml` er regenerert: 16 epics og 76 stories. Det gamle 1.3-punktet og den gamle 9.7-nøkkelen falt bort, begge sto på `backlog`.
- **Oppsett for loopen** (`018addb`):
  - `.claude/settings.json`: tillatelsesliste for uv, npm, npx, git, gh og docker. Den nekter force-push, `reset --hard`, rebase, Vercel CLI, `.env` og `data/private`, og redigering av `data/sample` og `data/answer-key`.
  - `.claude/settings.local.json` (git-ignorert) har `autoContinueAtUsageLimit: true`.
  - `_bmad/custom/bmad-build-auto.toml`: `persistent_facts` om `main`, utsatt deployment, syntetiske data, vertikale slices, spinen, FR-navn i tester og subagent-oppførsel.
  - `.claude/scripts/preflight-autonom.sh` sjekker maskin, git, CI og sprint-status.
  - `.docs/implementation-artifacts/autonomous-run.md` er runbooken goal-kommandoen følger.
- **Funn:** subagenter kan starte egne subagenter, men disse kjører alltid asynkront, og resultatet kommer som varsel. Det står som et faktum i build-auto-overstyringen og må prøves i testkjøringen av Story 1.1.
- `uv python install 3.12` er kjørt, og Docker Desktop er startet.
- Preflight: alt OK unntatt ren arbeidskopi før commit, og varsel om manglende Edge og manglende CI.

### Åpne punkter
- Bekreft at GitHub Actions kjører på org-repoet før Story 1.2.
- ~~Installer Microsoft Edge før Story 5.8~~ (løst: Edge 157.0.4341.60 installert av brukeren, preflight READY uten advarsler utover manglende CI).
- Testkjør Story 1.1 med runbooken mens brukeren ser på, før hele loopen settes i gang.
- Start Claude Code på nytt før kjøringen, slik at `.claude/settings.json` lastes.
- Epic 16 (deployment) kjøres etter at brukeren har godkjent nettsiden: Supabase, Vercel-variabler og eventuelt `VERCEL_TOKEN`.
