# Åpne punkter før bygging

## 2026-11-21 kl. 12:11 — Justas

### Oppgave
Brukeren ville lukke de åpne punktene fra [forberedelse-autonom-bygging](979-2026-11-19-19-19-07-forberedelse-autonom-bygging.md) før den autonome byggingen av Epic 1–12 starter.

### Plan
- Sjekke om GitHub Actions kjører på org-repoet `IBE160-2026/G36-steponaitis`.
- Repo- og org-innstillingene for Actions kan bare leses av admin (403), så brukeren valgte en probe-branch.
- Pushe loggcommiten `229ef93` som lå lokalt.

### Resultat
- `229ef93` er pushet til `origin main`.
- Probe:
  - Branchen `ci-probe` fikk en workflow med ett steg (`echo`), commit `49ed7e0`.
  - Run `44897847406` gikk til `completed success`. **GitHub Actions kjører på repoet.**
  - Branchen er slettet på GitHub og lokalt; `origin` har bare `main`.
- Punktet om GitHub Actions i `issues.md` er lukket.
- `GOAL.md` i prosjektroten inneholder:
  - stegene før start
  - `/goal`-kommandoen for den autonome kjøringen av Epic 1–12 (følger runbooken; ferdig ved DONE eller STOPPED)
  - hvor kjøringen kan følges

### Åpne punkter
- Start Claude Code på nytt og testkjør Story 1.1 med runbooken mens brukeren ser på. Dette kan ikke gjøres fra denne økten, og punktet står allerede åpent i `issues.md`.
- Epic 16 (deployment) venter fortsatt på at nettsiden blir godkjent. Punktet står allerede åpent.

## 2026-11-21 kl. 13:05 — Justas

### Oppgave
Committe brukerens endringer i `GOAL.md`.

### Plan
- Se gjennom diffen og committe bare `GOAL.md`.

### Resultat
- Committet som `8e830f8` og pushet til `origin/main`. Brukerens endringer:
  - Nye regler: commit og push etter hver story, merge epics til `main` når CI er grønn, løse blokkerte stories selv og logge løsningen i issues-fila.
  - DONE krever nå Playwright-tester for alle brukerreiser.
  - Nye stoppvilkår: når noe krever ny konto, kjøp eller et produkt som ikke er listet, eller når 5 stories på rad ender som «blocked».
  - Fjernet seksjonene «Before you start» og «Following the run» og kodeblokken rundt kommandoen.
- Rettet etterpå: kommandolinja startet med `goal` uten `/`; skråstreken er lagt til, committet som `19fd9a7` og pushet.
- Senere: motsigelsen om blokkerte stories er rettet i `GOAL.md` (brukerens valg): opptil 5 fiksforsøk på samme story, hvert logget i `issues.md`, aldri hopp over; deretter stopp. Unntak lagt inn i regelen om at runbooken vinner. «5 stories på rad blokkert» er erstattet av «fortsatt blokkert etter 5 forsøk». Committet som `ce7a5c3` og pushet.
- Senere: runbooken `autonomous-run.md` er oppdatert tilsvarende: ny seksjon *Unblock* (opptil 5 fiksforsøk i ferske subagenter, hvert forsøk logget i `issues.md`, ingen forsøk ved behov for ny konto/kjøp/nytt produkt), steg 6 og regelen om blokkert story peker dit, og feilet milepælssjekk regnes som blokkert story i stedet for direkte stopp. Committet som `6df2738` og pushet.
- Senere: antall fiksforsøk for blokkert story er økt fra 5 til 20 i både `GOAL.md` og runbooken (brukerens ønske). Ukommittert.

### Åpne punkter
Ingen.
