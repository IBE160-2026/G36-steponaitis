# 10-3-navigate-the-wall-by-keyboard-and-read-its-tooltips

## 2026-11-23 kl. 09:19 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 10.3: naviger i veggen med tastaturet og les tooltipene.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-10-3-navigate-the-wall-by-keyboard-and-read-its-tooltips.md` (status `done`, oppfølgingsreview anbefalt).
- Prompten tok med notatene fra Story 10.2 og nålen som Story 7.1 utsatte.

### Resultat
- Commits: `1cb1cf97081935f1f0953abf60a3fa76ea16a434` (Story 10.3), pluss sprint-commit «10-3 done».
- Rutenettet i veggen er nå veggens eneste tabulatorstopp. Stoppet i rulleområdet fra 10.2 er fjernet.
- `?loc=`-lenker åpner veggen med en festet dialog for plasseringen. Bare `?mode=list` åpner tabellen.
- En ny e2e-test dekker dyplenke og «Open as wall» for valgt gang. Oppfølgingspunktet fra 10.2 i `issues.md` er lukket.
- En del som holdes på plass, viser nålen og «kept in place» i tooltipen. Det var utsatt fra Story 7.1, og punktet i `issues.md` er lukket.
- Retro-punkt 27 fra epic 4 er halvveis løst: valgene for fra-plassering i Manual move-dialogen oppdateres nå ved hver visning. 409-testen i Playwright og retro-punkt 32 er utsatt.
- Verifisering:
  - `lint:py`, `lint:imports` (5 kontrakter), `lint` og `typecheck` er ok.
  - pytest: 930 passed og 2 hoppet over. Vitest: 500 passed.
  - Playwright chromium: 112 passed.
- Review: 3 middels og 13 lave funn ble rettet, og 2 ble utsatt.

### Åpne punkter
- Oppfølgingsreview anbefalt for Story 10.3:
  - fokus mellom den festede veggdialogen, Manual move-dialogen og delpanelet er bare sjekket i Chromium;
  - ingen test sjekker hvor tooltipen havner på skjermen.
- Et nytt klikk på en lenke til samme plassering, etter at dialogen er lukket, gjør ingenting.
- På en plassering med flere deler flytter Manual move… bare den øverste delen.
- Retro-punkt 27 fra epic 4 (409-test i Playwright) og punkt 32 fra epic 4 står åpne.
