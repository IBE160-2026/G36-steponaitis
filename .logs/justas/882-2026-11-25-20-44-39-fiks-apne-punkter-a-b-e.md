# Fiks åpne punkter (A, B, E)

## 2026-11-25 kl. 20:44 — Justas

### Oppgave
Rette åpne punkter fra `issues.md` og action items i `sprint-status.yaml` før Epic 16. Brukeren valgte tre grupper: A (bokføring), B (klare kodefeil) og E (planleggingsdokumentene oppdatert slik de ble bygget). Produktbeslutninger (D), testhull og oppfølgingsreviews (F) og sjekker bare et menneske kan gjøre (G) ble holdt utenfor.

### Plan
- Fire subagenter samtidig:
  - backend: import, best-markeringer, `login_attempts`, normalisering;
  - frontend UI: åtte feil;
  - kategorier: full stack;
  - docs: `epics.md` og `ARCHITECTURE-SPINE.md`.
- Bokføringen gjorde jeg selv: AGENTS.md, statuser i `sprint-status.yaml` og avkrysning i `issues.md`.
- Deretter hele porten: lint, enhetstester, trace og e2e i tre nettlesere. Til slutt commit og push.

### Resultat
- **Kode (`3ca0c42`):**
  - `PUT /api/keyword-rules/order` krever `base_ids` og avviser en utdatert rekkefølge med 409. Edit sender bare endrede felt. `categories.spec.ts` rydder opp i `finally`.
  - Én `normalize_text` for kategori- og nøkkelordtekst i backend (fjerner Cf-tegn, NFC, slår sammen mellomrom). Sammenligning går via `category_key` (casefold). Gangnavn trimmes bare.
  - `sendJson` og `postJson` er slått sammen i `frontend/lib/api/send-json.ts`.
  - Importen teller bare ikke-tomme rader mot radgrensen. Taket er 1 048 576 leste rader.
  - Koder for best-markeringer har nå en grense på 200 tegn.
  - Rader i `login_attempts` der låsen er utløpt, slettes når en ny feil registreres.
  - Dialogen ved slipp på en opptatt plass tilbyr ikke lenger Swap når den dratte delen også ligger på målet.
  - `Button` beholder samme element når den deaktiveres, så fokus blir stående.
  - Undo viser en lastetilstand mens sammendraget lastes.
  - Delsøket venter 250 ms (debounce).
  - Log out-flagget utløper etter 5 s.
  - En lenke til samme plassering åpner veggdialogen igjen.
  - 401 i New Plan og Delete plan åpner Log in.
  - Fargelagringen prøveskrives når siden lastes.
- **Dokumenter og bokføring (`041f288`):**
  - `epics.md` og spinen er oppdatert slik epic 4, 6, 7, 8, 10, 11, 12 og 13 ble bygget, også `base_ids` og normaliseringen. Epic 14–15 er ikke merket som droppet.
  - AGENTS.md har fått `LAUNCHER_ACTIONS` og regler for story-flyten:
    - en story med akseptkriterier bare et menneske kan sjekke, blir i review;
    - vakt for oppfølgingsreview;
    - ingen dev-servere mens e2e-porten kjører;
    - les utsatte punkter før en story bygges;
    - retro før neste epic.
  - 17 action items er satt til done. 31 punkter i `issues.md` er lukket (134 → 103 åpne).
- **Verifisering:**
  - lint:py, ruff format, lint:imports, ESLint og tsc: grønne.
  - pytest: 1174 passed, 2 skipped. Vitest: 778 passed. trace: OK.
  - e2e i chromium, firefox og msedge: 444 passed, 3 skipped, 6 failed.
    - De 3 hoppede er eksisterende plassholdere for Epic 16 (retro punkt 114).
    - De 6 feilene kom fra to nye tester med feil i selve testen: klikk på en `aria-disabled` knapp, og samme søketekst fylt inn på nytt. Begge er rettet og kjører grønt i alle tre nettlesere.

### Åpne punkter
- Delvis løst og ført på eksisterende linjer i `issues.md`: frontend-velgeren speiler ikke serverens `normalize_text`, og `login_attempts`-rader med 1–4 feil uten lås blir stående til Story 16.0.
- Epic 7 punkt 62: e2e-test for Undo av kombinert flytt og tilbakeflytt mangler (står allerede i `issues.md`).
- Epic 8 punkt 69: Print kan skrive ut gammel liste hvis en kommando lander under refetch.
- Produktspørsmål fra docs-synken som ikke sto i lista fra før: FR-22 (vise hvilke plasseringer som er best i før/etter), launcherens Keyboard-boks (alle snarveier eller fire faste) og re-seed når begge kategoritabellene tømmes.
