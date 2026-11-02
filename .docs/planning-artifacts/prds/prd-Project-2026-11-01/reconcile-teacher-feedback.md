# Reconciliation: teacher feedback vs PRD

- **Source:** `.docs/planning-artifacts/briefs/brief-Project-2026-09-27/tilbakemelding-product-brief.md` (IBE160 teacher, 2026-10-06)
- **Checked:** `prd.md`, `addendum.md` and `.memlog.md` in `prd-Project-2026-11-01/` (state 2026-11-02)
- **Date:** 2026-11-02

## Verdict

The PRD meets most of the teacher's concrete requests. It fixes the movement-class thresholds (FR-16) and the pick-group rule (FR-18), and gives three ordered recommendation rules with tie-breaks (FR-23–FR-26). It calls the analysis data analysis rather than AI (§4.5, NFR-3). The rules have testable consequences, and the primary metrics have concrete thresholds (SM-1, SM-2). It requires an answer-key dataset before implementation (§7.3) and a before/after table per aisle (FR-35). Thresholds are settings (FR-17). The app runs locally with no keys on `data/sample/` (NFR-2), only synthetic data is committed (NFR-4), and examiners are not users (§2.2). The main problem is scope. Since the feedback, the core has taken on several large features:

- saved, shared plans with concurrent-edit handling
- a multi-round recommendation process with loop guards
- undo/reset
- a printed move list

The only gate before stage 2 (SM-1 and SM-2) requires all 36 core FRs. So the teacher's five-step flow (import → classify → pick groups → recommendations → planning copy) never counts as finished on its own. There are smaller gaps too:

- Rules that change results still rest on unconfirmed assumptions.
- The answer key covers less than SM-1 claims.
- There is no screen sketch.
- Confidentiality covers only the repo, not where real data is imported or hosted.

## Gaps

**Summary:** 15 gaps — 1 high, 6 medium, 8 low.

### 1. The core has grown well past the teacher's core, with no checkpoint for the five-step flow

- **Source:** Samlet vurdering, change 1: «Del MVP-en i en kjerne (import, deler og lokasjoner, bevegelsesklassifisering, analyse av deler som plukkes sammen, anbefalinger og planleggingskopi) og et trinn 2 (etiketter med QR-kode, dashbord og belegg per gang).» Vanskelighetsgrad: «Pass på at kjerneflyten blir ferdig og stabil før dere legger til mer. Kjerneflyten her er: importer → klassifiser → finn plukkgrupper → få anbefalinger → prøv dem i planleggingskopien.»
- **PRD location:** §7.1 (core = FR-1–FR-36), §7.2 (stage 2 only "after the core passes SM-1 and SM-2"), §8 SM-1/SM-2 (together they validate FR-1–FR-36). These were added to the core after the feedback:
  - FR-2: reuse an import
  - FR-7–FR-11: saved, shared plans, including delete and the concurrent-edit warning
  - FR-30: change the target of a recommendation
  - FR-32: merge moves
  - FR-33: undo/reset
  - FR-36: move list

  The brief addendum's scope note admits this: "Saved plans and the move list add work to a core the teacher already called tight."
- **Type:** scope risk
- **Severity:** high
- **Fix:** Add a "core flow done" milestone to §7.1 that matches the teacher's five steps: FR-1, FR-3–FR-6, FR-12–FR-29, FR-31, FR-34 and FR-35. Its share of the SM-1 tests and a README demo must pass before work starts on FR-2, FR-7–FR-11, FR-30, FR-32, FR-33 and FR-36. A stop at that point then still counts as a finished core.

### 2. The recommendation engine is more than "one simple, explainable rule"

- **Source:** Forslag til justering 2: «Start med én enkel, forklarbar anbefalingsregel, for eksempel: fast-moving-deler flyttes til merkede beste soner, og deler i samme plukkgruppe legges i samme gang. Mer avansert optimalisering av hele lageret holdes som «if time allows» …»
- **PRD location:** FR-22–FR-28 (three ordered rules, rounds, run-replacement semantics, outdated recommendations), the two anti-loop limits in FR-25, FR-30, FR-32, and both rationale sections in `addendum.md`. Eight of the open assumptions are here: A-14–A-19, A-22 and A-24.
- **Type:** scope risk
- **Severity:** medium
- **Fix:** Build the engine in steps inside the core:
  1. A single run of rule 1 and rule 3 (the teacher's example), with answer-key tests.
  2. Rule 2, rounds and the rule 3 loop limits.
  3. Outdated recommendations, changed targets and move merging.

  Record in §7.1 that step 1 is a valid place to stop.

### 3. Multi-user handling is pulled into a single-user core

- **Source:** Vanskelighetsgrad table: «Brukere, roller og innlogging | lav | Én primærbruker (lagerplanleggeren). Innlogging er ikke nevnt og trengs neppe i v1.» and «Sanntid, samtidighet eller flere brukere som påvirker hverandre | lav | Én bruker om gangen.»
- **PRD location:** All of these are core:
  - FR-9: detects concurrent edits, warns and offers a reload
  - FR-10: records who created and last edited a plan
  - §3: "Plans are shared by all users"
  - NFR-5: up to about 10 users, a few at the same time
  - UJ-3: edge case about concurrent edits
- **Type:** scope risk
- **Severity:** medium
- **Fix:** State that the core assumes one user at a time. Move FR-9's concurrent-edit warning to stage 2 with login (FR-37–FR-38). Keep only the created-by and last-edited-by fields, which cost little.

### 4. Details that change results are still unconfirmed assumptions

- **Source:** Viktigste endringer 3: «Definer reglene presist … Det er dette Claude Code skal implementere, og det dere skal teste mot.» Gjennomførbarhet: ««Open Questions» om Excel-filene og definisjonen av beste lokasjoner bør avklares før PRD.» Neste steg 1: «besvar «Open Questions» (kolonner, tidsrom og definisjon av beste lokasjoner)».
- **PRD location:** In §11, these assumptions change computed results or expected test outputs:
  - A-3: where the period starts and ends
  - A-5: the required columns
  - A-6, A-12
  - A-14–A-19: rounds and rule order or ties
  - A-22–A-24, A-27

  A-1 (user journeys the author has not narrated) is also still open, and the PRD status is "draft".
- **Type:** weakened
- **Severity:** medium
- **Fix:** Confirm or change each of these assumptions and remove its tag before the answer key is written, because the answer key fixes them. At least A-3, A-5, A-12, A-14–A-19, A-22–A-24 and A-27 need this. Only assumptions about the user interface can stay open.

### 5. The answer-key dataset covers less than SM-1, has no folder, and NFR-4 as worded rules it out

- **Source:** Del 2, criterion 3: «Fastsett terskler og regler, og lag et lite testdatasett med kjent fasit.» Neste steg 3: «Lag et lite, anonymisert testdatasett med fasit (forventede klasser og grupper) før implementeringen starter». Criterion 7: «Bestem hvor eksempeldata skal ligge».
- **PRD location:** §7.3 limits the expected outputs to "movement class, pick groups and recommendations for each part" and lists five cases. SM-1 claims these tests also cover "rounds, move-list content and order, import errors and import integrity". §7.3 is missing:
  - the two rule 3 loop cases that the PRD addendum says "belong in the answer-key test dataset"
  - a later-round run
  - the move-list order
  - transaction code `0`
  - a part that appears twice on the same job
  - dates on the period boundary
  - virtual locations
  - broken import files (missing column, unknown location)

  No folder is named for the dataset. NFR-4 says "Only synthetic demo data (made by `data/generate_demo_data.py`) is committed". Read strictly, that forbids committing a hand-made fixture.
- **Type:** weakened
- **Severity:** medium
- **Fix:** Expand §7.3 to list every expected output that SM-1 depends on: the cases above, plus round 1 and round 2 recommendations. Name its folder, for example `tests/fixtures/answer-key/`. Reword NFR-4 so hand-made synthetic test fixtures may be committed.

### 6. No sketch or screen outline for recommendations and the planning copy

- **Source:** Del 2, criterion 4 (Design og brukeropplevelse, status Juster): «gjerne med de viktigste skjermbildene eller flytene skissert» and «Skisser hvordan anbefalinger og planleggingskopien vises, for eksempel som en før/etter-tabell per gang.»
- **PRD location:** FR-27 and FR-35 say what to show, but nothing about screens, navigation or layout. Open questions include:
  - where "no space" parts and outdated recommendations appear
  - how apply, apply all and change target work on screen
  - how rounds are shown

  §0 only mentions "the next BMad steps (UX …)" and makes no commitment.
- **Type:** weakened
- **Severity:** medium
- **Fix:** Add a short "Key screens" list:
  - saved-plans list
  - plan page with parts, locations, pick groups, recommendations and before/after
  - print view

  Include a rough text wireframe of the recommendations list and the before/after table. Or state that the UX step must deliver these sketches before stories are written.

### 7. Confidentiality covers only the repo, not where real data is imported or hosted

- **Source:** Vanskelighetsgrad, Sikkerhet og personvern (middels): «Firmadata er konfidensielle. Kursversjonen bruker endrede data, men repoet er offentlig.» Criterion 7: «sørg for at ekte eller lite anonymiserte firmadata aldri committes, heller ikke i historikken. Legg Excel-filer fra jobben i `.gitignore`.»
- **PRD location:** NFR-4 covers the repo only, but:
  - Open Question 2 expects real files to be imported later.
  - The core has no login (FR-10 uses the fixed value `planner`).
  - Stage 2 lets anyone create an account (FR-37).
  - The repo's README links a public Vercel deployment.

  The PRD does not name `data/private/` as the only place for real exports, although the brief addendum and `.gitignore` do. It also does not cover real data in test fixtures, screenshots or the committed `.logs/` session logs.
- **Type:** weakened
- **Severity:** medium
- **Fix:** Extend NFR-4:
  - Real exports are kept only in the git-ignored `data/private/`.
  - They are imported only on a local instance, never on a hosted or public deployment, which holds demo data only.
  - No real part numbers, files or screenshots go into fixtures, docs or `.logs/`.

### 8. The before/after table does not show what rule 3 achieves

- **Source:** Forslag til justering 1: «De er nyttige, men ikke nødvendige for å vise verdien av anbefalingene.» Criterion 4: «for eksempel som en før/etter-tabell per gang».
- **PRD location:** FR-35 counts only fast-moving parts in best locations. SM-C2 warns against splitting pick groups, but nothing measures it, so the summary does not show what rule 3 achieves.
- **Type:** weakened
- **Severity:** low
- **Fix:** Add to FR-35 the number of pick groups whose two parts are in the same aisle, before and after. Show it for the whole warehouse, and per aisle for the pairs placed there.

### 9. Analysis modules only have to work without the UI

- **Source:** Criterion 5 (Kodekvalitet og arkitektur): «Hold analyselogikken i egne, testbare moduler.»
- **PRD location:** NFR-1 says the rules can be tested "in isolation … without the user interface". FR-17 keeps settings separate from logic.
- **Type:** weakened
- **Severity:** low
- **Fix:** Reword NFR-1: classification, pick groups, recommendations and move-list order are separate modules. They take data and settings as input and do no database, file or network I/O, so the answer-key tests call them directly.

### 10. The PRD does not say what the README must contain

- **Source:** Criterion 6: «Legg ved et anonymisert eksempeldatasett og beskriv importen steg for steg i README.» Kjørbar for sensor: «så kan sensor kjøre hele flyten».
- **PRD location:** NFR-2 and SM-2 require the flow to run "by following the README", but do not say what the README must contain. The expected demo results stay in the brief addendum: about 80 fast, 250 medium, 580 slow and 640 dead-stock parts, and about 130 pick groups.
- **Type:** weakened
- **Severity:** low
- **Fix:** Add to NFR-2 that the README gives:
  - the install and start commands
  - which `data/sample/` file goes in each upload field
  - the best-location marks to set for the demo
  - the exact expected class and pick-group counts

  An examiner can then tell a correct run from a wrong one.

### 11. Import checks columns and locations, but not values, and the CSV format is undefined

- **Source:** Filhåndtering (middels): «Import fra CSV/Excel med ukjent kvalitet og kolonneoppsett». Example success criterion: «import av en fil med manglende kolonne gir en tydelig feilmelding og ingen halvimporterte data».
- **PRD location:** FR-3–FR-5. A-4 accepts both `.xlsx` and `.csv`. Nothing covers:
  - blank part numbers or location codes
  - dates that cannot be read
  - quantities that are not numbers, or are negative
  - duplicate location codes, or missing Walk Path values
  - CSV encoding and delimiter (Norwegian Excel saves CSV with semicolons and decimal commas)
- **Type:** weakened
- **Severity:** low
- **Fix:** Add a consequence to FR-3 or FR-4: a row with an invalid required value rejects the import, names the file, row and column, and saves nothing. Then either limit the core to `.xlsx` (the demo format) or fix the CSV encoding and delimiter.

### 12. The course criterion and traceability from FR to story to test are not carried into the PRD

- **Source:** Criterion 1 (Prosess og KI-styring, 30 %): «slik at krav kan spores fra brief til kode» and «Fortsett å dokumentere slike beslutninger». Hvorfor product brief er viktig: «om sensor kan følge en sporbar vei fra plan til ferdig app».
- **PRD location:** §8 drops the brief's "Course" success criterion (the project, including documentation of AI-assisted development, testing and QA, satisfies IBE160). FR IDs exist, but nothing requires stories, tests or commits to cite them.
- **Type:** dropped
- **Severity:** low
- **Fix:** Add a secondary metric: every story and every automated test names the FR consequence or consequences it covers. AI-assisted work and decisions continue to be logged in memlogs and `.logs/`. Keep the brief's course criterion.

### 13. Stage 2 has grown beyond the teacher's stage 2 list

- **Source:** Forslag til justering 1: «Flytt etiketter med QR- eller strekkode, dashbord og belegg per gang til et trinn 2». Vanskelighetsgrad: «Innlogging er ikke nevnt og trengs neppe i v1.»
- **PRD location:** Besides labels and the warehouse view, §7.2 adds:
  - login where anyone can create an account (FR-37–FR-38)
  - a category check spread over five FRs (FR-40–FR-44): create, edit and reorder keyword rules, global aisle categories, and a starter set drafted with AI
- **Type:** scope risk
- **Severity:** low (stage 2 is gated behind SM-1, SM-2 and SM-C3)
- **Fix:** Give stage 2 an explicit order: the warehouse view and labels first, since the teacher named them, and login and the category check last. The semester can then end cleanly after any finished stage 2 item.

### 14. The build order says saved plans come later, but every core FR is built around a plan

- **Source:** Vanskelighetsgrad: «Pass på at kjerneflyten blir ferdig og stabil før dere legger til mer.»
- **PRD location:** §7.1 sets the order "planning copy first; then saved plans and the move list". But a stored plan is needed from the first story:
  - FR-1: an import creates a plan
  - FR-17: each plan stores its settings
  - FR-20: marks are stored in the plan
  - FR-34
  - NFR-10: plans are stored persistently
- **Type:** contradicted
- **Severity:** low
- **Fix:** State that step 1 includes a minimal stored plan (one import with its marks, moves and recommendations). Only these come later:
  - the saved-plans list
  - reusing an import
  - delete
  - the concurrent-edit warning
  - the move list

### 15. No plan for where secrets live once login arrives

- **Source:** Criterion 7 (Ryddighet i repoet): «En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge.» Kjørbar for sensor: «uten gruppens nøkler».
- **PRD location:** Missing. NFR-2 rules out API keys, but stage 2 login (FR-37–FR-38) needs at least a secret for signing sessions, and the PRD says nowhere where it lives. The seeded demo account (A-29) has public credentials by design.
- **Type:** dropped
- **Severity:** low
- **Fix:** Add to NFR-2 or NFR-4:
  - Any secret comes from a git-ignored `.env`, with a committed `.env.example`.
  - The README run works with a local default or a generated value, never the author's own key.
  - The demo account is never used on a real deployment.
