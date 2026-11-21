# 1-4-app-shell-and-design-foundation

## 2026-11-21 kl. 14:58 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 1.4: app-skall og designfundament — layout, verktøylinje, designtokens og grunnkomponenter (Button, Input, toast, ConfirmDialog).

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-1-4-app-shell-and-design-foundation.md` (status `done`).

### Resultat
- Commits: `1b376985f8941f73670f74c94cd0e4bc82dc2193` (Story 1.4), pluss sprint-commit «1-4 done».
- Verifisering: `npm install` ok; ESLint ok; typecheck ok; Vitest 48 passed (4 filer); pytest 36 passed; ruff ok; import-linter 4 kept; `next build` ok; Playwright chromium 10 passed (3 skjelett + 7 nye `uj1`-tester for app-skallet).
- Review: 46 funn, ingen høye; rettelser lagt inn og alt verifisert på nytt.

### Åpne punkter
- Utsatte testhull (ingen side bruker komponentene ennå): toast pause ved hover/fokus og redusert bevegelse, Esc i Input, ConfirmDialog Cancel-først og fokus — dekkes i Playwright fra Story 1.8.
- Oppfølgingsreview anbefalt: klikk-blokkering på deaktivert Button er bare enhetstestet, ikke med ekte klikk i nettleser.
- Mellom 1024 og ca. 1100 px bredde brytes verktøylinja til to rader (ca. 97 px); 64 px-høyden sjekkes bare ved 1280 px.
