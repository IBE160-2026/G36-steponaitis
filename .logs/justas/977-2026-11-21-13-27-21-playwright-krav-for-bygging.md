# Playwright-krav for bygging

## 2026-11-21 kl. 13:27 — Justas

### Oppgave
Brukeren spurte om hver byggeagent tester appen med Playwright. Svaret var nei: bare rundt 12 stories og gatene 5-8/12-5 nevner Playwright, CI kjører ikke Playwright, og kravet i `GOAL.md` linje 17 (alle brukerreiser testet med Playwright) ble ikke håndhevet, fordi runbooken går foran goal og subagentene aldri leser `GOAL.md`. Brukeren ba om tre endringer som lukker hullet.

### Plan
- Legge en persistent fact i `_bmad/custom/bmad-build-auto.toml` som alle byggeagenter leser.
- Legge Playwright-jobb i CI via Story 1.2, og la runbooken sjekke den.
- Legge et dekningssteg for brukerreisene UJ-1–UJ-8 inn i runbooken før epic 12-retrospektiven.

### Resultat
Committet i `48c13a5` (`_bmad/custom/bmad-build-auto.toml` og `.docs/implementation-artifacts/autonomous-run.md`):
- **Per story:** hver story med brukersynlig endring legger til eller utvider en Playwright-test i `frontend/e2e/` for sin brukerreise (UJ fra `EXPERIENCE.md`), sjekker synlig resultat, og `npx playwright test --project=chromium` er del av verifiseringen.
- **CI:** `ci.yml` skal ha en `e2e`-jobb med Chromium (`--pass-with-no-tests` til første test finnes, rapporter som artefakter ved feil). Runbook steg 8 «After 1-2» sjekker at jobben finnes og er grønn, ellers er 1-2 blokkert.
- **Dekning:** nytt steg `e2e-user-journeys` etter 12-5 og før epic 12-retrospektiven. En fersk `bmad-build-auto`-agent sørger for at UJ-1–UJ-8 har grønne Playwright-tester i chromium, firefox og msedge. Steg som krever Epic 13–16 hoppes over og listes i specen. Mangler noe, går steget til *Unblock*. *Finish* krever nå steget.
- TOML-fila er validert (10 persistent facts).

### Åpne punkter
Ingen.
