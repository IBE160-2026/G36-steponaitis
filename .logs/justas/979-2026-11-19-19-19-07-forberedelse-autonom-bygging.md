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
- Ingen kode eller konfig er endret.

### Åpne punkter
- Supabase-prosjekt og Vercel-oppsett (preview av, Production-variabler, eventuelt `VERCEL_TOKEN`) må gjøres av brukeren før Story 1.3.
- Bekreft at GitHub Actions kjører på org-repoet før Story 1.2.
- Installer Microsoft Edge (Playwright `msedge` i 5.8, 8.4 og 12.5) og `uv python install 3.12`.
- Beslutninger før den autonome kjøringen: omfang (epic 1–12 eller alle), milepælsporter, branch- og push-strategi, hva som skjer ved blokkert story, retrospektiver, logg per story.
- Claude forbereder etter beslutningene: tillatelsesliste i `.claude/settings.json`, `persistent_facts` for `bmad-build-auto`, synk av `sprint-status.yaml`, goal-prompten, preflight-sjekk og testkjøring av Story 1.1.
