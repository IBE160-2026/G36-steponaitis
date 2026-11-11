# Installer Impeccable

## 2026-11-11 kl. 20:03 — Justas

### Oppgave
Finne Impeccable design-skillen for Claude Code på nettet og installere den, som forberedelse til UX-designarbeidet.

### Plan
- Søkte på nettet og fant den offisielle kilden: GitHub-repoet `pbakaus/impeccable` (ca. 108k stjerner). README anbefaler `npx impeccable install`.
- Claude fikk ikke kjøre `npx` (auto-modus blokkerer kode fra nettet), så brukeren kjørte installasjonen selv.
- Valgte global installasjon, slik at ingen filer havner i gruppens repo.

### Resultat
- Brukeren kjørte `npx impeccable install --providers=claude --scope=global` (impeccable 4.8.2).
- Installert: skillen i `~/.claude/skills/impeccable` (engine v0.1.21, darwin-arm64), 4 agenter i `~/.claude/agents` (asset-producer, documenter, finish-reviewer, manual-edit-applier), design-hooks i `~/.claude/settings.json`.
- Verifisert at filene og hook-oppføringene finnes, og at `impeccable`-skillen nå vises i Claude Code.
- Ingen endringer i repoet ved installasjonen.
- Deretter kjørt `/impeccable init`: prosjektet utforsket (README, PRD, data/), tre spørsmål stilt. Svar: stack avgjøres i arkitektursteget; appen brukes nå mest til kursdemoen (førstegangsforståelse viktigst); produktnavnet er «Smart Warehouse Planner», og firmaets navn og merkevare vises aldri.
- `PRODUCT.md` skrevet i prosjektroten (plattform web, brukere, formål, posisjonering, kontekst, begrensninger, prinsipper, tilgjengelighet). Ikke committet ennå.
- Ingen bildegenerering tilgjengelig, så ingen `buildPath` registrert (kode-først). Live-modus hoppet over fordi det ikke finnes noen app å kjøre ennå.

### Åpne punkter
- Stack er ikke valgt; PRODUCT.md `## Stack` må oppdateres etter arkitektursteget.
