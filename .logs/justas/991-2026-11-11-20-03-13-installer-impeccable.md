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
- Ingen endringer i repoet.

### Åpne punkter
- Kjør `/impeccable init` i prosjektet for å sette designkontekst før UX-arbeidet starter.
