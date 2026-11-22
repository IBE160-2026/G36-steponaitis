# 8-1-move-list-order-and-header-in-the-domain

## 2026-11-23 kl. 00:46 — Justas

### Oppgave
Autonom kjøring (Epics 1–12), Story 8.1: rekkefølgen og toppteksten i flyttelista, i domenelaget.

### Plan
- Runbook: `.docs/implementation-artifacts/autonomous-run.md`.
- Bygget av en fersk subagent med `bmad-build-auto`; spec: `.docs/implementation-artifacts/spec-8-1-move-list-order-and-header-in-the-domain.md` (status `done`).
- Prompten ba om å slå på `test_fr38_answer_key_move_list`.

### Resultat
- Commits: `683b7ce7b11f08872c39a9dee63edeb34521ea49` (Story 8.1, med epic-konteksten `epic-8-context.md` og regenerert `schema.ts`), pluss sprint-commit «8-1 done».
- `test_fr38_answer_key_move_list` kjører nå og består: de 14 linjene i fasiten kommer i fasitens rekkefølge.
- Ingen åpne retro-punkter gjaldt koden storyen endret.
- Verifisering:
  - `lint:py`, `lint:imports` (5 kontrakter) og `typecheck` er ok.
  - pytest: 688 passed og 2 hoppet over (bare Postgres). Vitest: 373 passed.
  - Playwright chromium: 79 passed.

### Åpne punkter
- Krav-beslutning (middels funn, utsatt):
  - Situasjonen: en del flyttes A→B og så B→C i samme runde, og B hadde allerede delen.
  - Da slås de to flyttene ikke sammen. Rekkefølgeregelen skriver ut B→C først.
  - En kollega som følger papiret, vil dermed la beholdningen fra A bli stående på B, mens planen har alt på C.
  - Valget står mellom to løsninger:
    - et unntak i flytteliste-rekkefølgen for samme del (FR-38);
    - å slå sammen flyttene også når B allerede hadde delen (FR-34).
