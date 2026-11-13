# Spine Pair Review — Smart Warehouse Planner

Rubric walker (`.claude/skills/bmad-ux/references/validate.md`), run 2026-11-13 against `DESIGN.md` and `EXPERIENCE.md` (both `status: draft`, `updated: 2026-11-13`). Judged against `.memlog.md` (latest decisions win), `PRODUCT.md` and the PRD (§3 glossary, FR-1–FR-38, FR-42, FR-49, NFRs). No `design_md_examples` / `experience_md_examples` were resolvable in this run, so shape is judged against `SKILL.md` and `references/design-md-spec.md` only.

## Overall verdict

The pair is a strong, buildable contract. All 126 `{token}` references in DESIGN.md and all 46 in EXPERIENCE.md resolve, every colour has a hex value, the contrast figures in prose match the tokens (re-computed, all within ±0.05), and the 2026-11-13 decisions (green best location, violet selection, no Colour by, demo front page, ink "applied", FR-49 with clickable Key entries) are carried almost everywhere. The remaining problems are concentrated in three places: a few leftovers from the yellow-selection era that now contradict the violet rules (a violet-filled selected marker, a violet initials disc); FR-49 edges that a developer would have to guess (does changing "selection" also change focus rings? what are the 8 presets? how is `best-on-light` derived when white text sits on it?); and surface closure (Warehouse colours, the demo front page, Pick groups, Parts and the launcher have no journey). One FR-38 mismatch (Round per line) should be fixed before architecture.

## 1. Flow coverage — adequate

Checked: UJ-1, UJ-2 and UJ-3 from PRD §2.3 against EXPERIENCE.md Key Flows (protagonist, numbered steps, climax, failure path), then every IA surface for a journey that lands on it (SKILL.md "Surface closure").

UJ-1, UJ-2 and UJ-3 are strong: names verbatim, named protagonist (Justas, the colleague), numbered steps, a marked climax and a failure path each.

### Findings
- **high** Several IA surfaces have no journey that lands on them: **Settings → Warehouse colours** and the **Key colour popover** (FR-49, the newest and most interaction-heavy feature), the **demo front page** (NFR-5), **Pick groups** (step 4), the **Parts** roster (step 2), the **launcher** and **search**. UJ-1 jumps from Locations (step 3) to Best locations (step 4) and never visits Parts or Pick groups, although PRD UJ-1 says "the plan opens with … movement classes and pick groups" (EXPERIENCE.md Key Flows, UJ-1 steps 2–4; IA table rows Parts, Pick groups, Settings, Launcher; IA "Demo front page" paragraph). PRODUCT.md says most sessions are "someone meeting the flow for the first time, following the README" on the public demo, and that visitor has no journey at all. *Fix:* ask the user to narrate (not invent) (a) a first-time demo visitor: demo front page → Open the app → empty saved-plans list → New Plan with `data/sample/`; (b) a short FR-49 flow (e.g. the planner finds slow-moving blue hard to see on the wall, clicks the Key entry, gets the 3:1 warning, keeps or resets). Add Parts / Pick groups beats to UJ-1 step 3 only if the user confirms them.
- **low** UJ-1 failure path relies on the [ASSUMPTION] that passed files stay selected (Component Patterns, Import error row). Fine as tagged; just note the flow depends on it.

## 2. Token completeness — adequate

Checked: every frontmatter token (66 colours, 23 type styles, 7 radii, 22 spacing tokens, 47 components) and every `{path}` reference in both files; hex completeness; contrast for load-bearing pairs (re-computed with the WCAG formula).

All references resolve. No colour is missing a hex. Stated ratios check out (accent 3.19 on wall / 3.73 shell / 4.65 slot / 3.88 white / 3.31 ground; best 4.40 / 6.40 / 5.14; `#2C8A55` 2.87 on wall, 4.31 on white; ink 16.73 / 14.27).

### Findings
- **high** `{components.best-tag-on-light}` sets **white 11px bold text on `best-on-light` #2C8A55 = 4.31:1**, below the 4.5:1 that EXPERIENCE.md's own "Target WCAG 2.2 AA" floor needs for small text (DESIGN.md frontmatter `best-tag-on-light`; DESIGN.md Components "Best location": "white text on `#2C8A55`"). Worse, the FR-49 derivation rule darkens a chosen best colour only "until it reaches 3:1 on white" (DESIGN.md Colors "These are defaults…"; EXPERIENCE.md Warehouse wall "Warehouse colours (FR-49)"), so a derived tag can carry white text at 3:1. The rule also does not reproduce the default: deriving from `#3DAE6B` to 3:1 does not give `#2C8A55` (4.31:1). *Fix:* derive `best-on-light` to ≥ 4.5:1 against white (and use ink text if that fails), or switch the light tag to ink text on a pale best tint; state that Reset restores the fixed `#2C8A55`.
- **medium** The 8 preset swatches in `{components.colour-popover}` are never defined (DESIGN.md frontmatter `colour-popover.presets`; EXPERIENCE.md "Change a colour from the Key"). A developer has to invent a palette. It's also unclear whether all six Key entries share one preset set. *Fix:* list the 8 hex values (ideally including each default) and say whether the set is shared or per entry.
- **medium** Radii in components disagree with the Shapes narrative: `colour-popover.radius` is `{rounded.DEFAULT}` (4px) but Shapes says popovers use `{rounded.lg}`; `aisle-card.radius` is `{rounded.lg}` but Shapes says cards use `{rounded.xl}`; `flow-bar` 7px, `flow-step-current` 5px and `input` 5px are off the scale (DESIGN.md frontmatter components vs Shapes list). *Fix:* pick one value per component and either add `rounded` tokens for 5/7px or snap them to the scale.
- **low** Literal values instead of tokens: `#FFFFFF` / "white" in `bin-lifted.vacated-slot`, `move-target`, `move-marker.manual/applied`; shadows as rgba strings in three components with no shadow token; `colour-popover.shadow` is prose ("the popover shadow (same as hover notes)") (DESIGN.md frontmatter). *Fix:* reference `{colors.surface}` / `{colors.label-window}` and add `shadow-lift` / `shadow-overlay` entries (or state them once in Elevation & Depth and reference by name).
- **low** Inline overrides suggest missing type tokens: `rule-tag` "{typography.tag}, 12px", `round-chip` "{typography.code}, 14px", `no-space-chip` "12.5px", toolbar name "Barlow 15px", aisle card "Barlow 15px" (DESIGN.md frontmatter, Components). *Fix:* add tokens or drop to existing sizes.
- **low** 19 tokens are defined but never referenced in either spine, among them `launcher-rail`, `launcher-rail-edge`, `row-quiet`, `on-dark`, `on-dark-secondary` (colour prose names them by hex, not token), `table-row`, `code-table`, `column-head`, `part-number`, `wall-label`, `wall-section`, `print-body`, `lead`. *Fix:* reference them from the component that uses them (e.g. `wall-panel` level labels → `{typography.wall-label}` + `{colors.on-dark}`), or drop the unused ones.
- **low** Contrast not stated for bins against the wall face: slow-moving blue is 2.14:1 and fast-moving red 2.60:1 against `wall` (only vs open slot is given). Violet on the louvre slats (`wall-slat`) is 2.71:1. The load-bearing occupancy cue (bin vs open slot) passes, so this is low. *Fix:* one sentence stating that the bin vs slot pair is the one that counts, and that the selection frame is drawn on the slot or with a 1px ink keyline.
- **low** Light mode only. That's fine for this product, but it's not said. *Fix:* one line in Colors: "Light ground only; no dark mode in v1."

## 3. Component coverage — thin

Checked: every component name in either spine for a DESIGN.md visual spec and an EXPERIENCE.md behavioural rule.

The 47 frontmatter components are well specified visually, and most have a Component Patterns row.

### Findings
- **medium** Components with behaviour but **no visual spec** in DESIGN.md: toast, confirm dialog / confirm popover (Reset…, Delete…, Apply all, Reset to defaults), part panel (side panel), manual move dialog, Other location ▾ listbox, plan plate menu, global save-failed notice, saved-plans row/table, generic data table (Moves touching aisle, before/after table, Open as list, pick groups), recommendation detail panel layout, whole-warehouse card, **Warehouse colours settings page** (rows, colour input, preview strip, warning row), and the **demo front page** (only `display-hero` / `lead` type exists) (EXPERIENCE.md Component Patterns, State Patterns, Warehouse wall). *Fix:* add DESIGN.md Components entries (even two lines each, mostly token references) for toast, dialog, side panel, listbox/menu, notice, data table, settings row, and the front page.
- **medium** Components with a visual spec but **no Component Patterns row**: `legend`, `colour-popover`, `tooltip`, `slot-none`, `print-move-list`. Their behaviour exists in the invented sections (Warehouse wall, Interaction Primitives, Move list print), so a consumer extracting by component name will miss it (EXPERIENCE.md Component Patterns). *Fix:* add one-line rows that point to the section ("Legend / Key `{components.legend}` — see Warehouse wall, Change a colour from the Key").
- **low** The pin glyph for "kept in place" (State Patterns, Keep in place) and the clock icon for Outdated have no icon spec beyond the generic "1.6px outline" rule (DESIGN.md Shapes). *Fix:* list the UI icon set once (search, grid, lock, clock, pin, palette, warning, check, link, chevron).

## 4. State coverage — adequate

Checked: each IA surface for empty, loading, error, focus, success and edge states.

Import, recommendations, outdated, no space, undo/reset, move list and before/after are covered very well.

### Findings
- **medium** Missing states:
  - **Warehouse colours storage unavailable** (private window / blocked storage): FR-49 says the colours "survive a reload", and nothing covers the fallback.
  - **Run failure** (a run that errors, not just a slow one).
  - **Cold load of a plan** (opening a large saved plan: what shows while loading).
  - **Part with no current location** in the part panel and tooltip (FR-27/§3 "Current location").
  - **FR-34 removal**: what the planner sees when a manual move back to the first from-location removes the move.
  - **Launcher filter: no match**.

  (EXPERIENCE.md State Patterns.) *Fix:* add one row each; storage-unavailable can be "defaults are used; a note on the Warehouse colours page says choices cannot be kept in this browser".
- **low** Delete confirm copy is not given (FR-12 "permanent, no archive") (Component Patterns, Saved-plans row). *Fix:* add the sentence, e.g. "Delete "Autumn re-slot"? This cannot be undone."

## 5. Visual reference coverage — thin

Checked: files in `mockups/`, `wireframes/` (absent), `imports/` (empty), `.working/concepts/05-bin-wall/`, and their inline links.

Spines-win-on-conflict is stated (DESIGN.md Brand & Style; EXPERIENCE.md header and IA). Inline links are specific (warehouse layout, interface, features menu, screen map, landing, concept card).

### Findings
- **medium** `mockups/` (5 SVGs, untracked, created 20:34) is an **orphan**: both spines link only to `.working/concepts/05-bin-wall/…`, and the mockups are byte-identical copies of those concept files (DESIGN.md Brand & Style "Visual references"; EXPERIENCE.md IA, Warehouse wall, Move list print). *Fix:* re-point the links to `./mockups/…` (the promoted location per SKILL.md Finalize) or delete `mockups/` until promotion.
- **medium** The mocks still show **superseded decisions**, and the spines don't list them: yellow `#F0B323` used for selection (e.g. 381 uses in warehouse-layout.svg, which is mostly bins but includes the selection frame and arrow), a "Colour by" control (warehouse-layout.svg), "Open the demo" twice (landing.svg), and `#2C8A55` green for applied / done / together (all five SVGs). "Spines win" covers this legally, but a builder working from the picture will copy them. *Fix:* add one line next to the visual references: "Known superseded in the mocks: yellow selection → violet `{colors.accent}`; Colour by → removed; green applied/done → ink check; 'Open the demo' → 'Open the app'; white best frame → green." Or re-render the mocks.

## 6. Bloat & overspecification — adequate

### Findings
- **low** DESIGN.md Colors carries decision history ("This is a user decision from 2026-11-13", "Confirmed by the user on 2026-11-13", "Concept 05 used…", three times) (DESIGN.md Colors, paragraphs "Best location is green", "Applied no longer uses green", "Selection has its own colour"). This is memlog content. *Fix:* keep the rule and the ratio, and drop the provenance.
- **low** EXPERIENCE.md restates PRD logic in places: the FR-31 eligibility rule (Other location row), the FR-30 count (Apply all row), the FR-29 cause list (State Patterns, Outdated). *Fix:* cite the FR and keep only the UI delta (copy, control, order).
- **low** The "Resolved by the user on 2026-11-13" list in Open Questions repeats decisions already written into the body. *Fix:* collapse to one line pointing at the memlog.

## 7. Inheritance discipline — adequate

Checked: `sources` paths resolve (all four resolve from the run folder), UJ names verbatim (yes), glossary terms, component names across sections, EXPERIENCE token refs (all resolve).

### Findings
- **high** **FR-38 requires round on every line**, but DESIGN.md's print spec omits it ("Each line has a 12px tick box, the part number, description, from-code and to-code in Barlow, and the rule", DESIGN.md Components "Print move list"). EXPERIENCE.md tags the Round column as an [ASSUMPTION] (Move list print, "Line") and Open Question 6 asks whether to add it. It's not optional. *Fix:* add Round to the DESIGN.md line spec, remove "the Round column" from the [ASSUMPTION] tag, and narrow OQ 6 to the Note column and A4 portrait. Also add "number of rounds" to the DESIGN.md print header (FR-38 header list; EXPERIENCE already has "2 rounds").
- **high** **FR-42 tooltip must include the location's level**, but neither tooltip spec lists it: EXPERIENCE.md Warehouse wall "Selection and tooltip" (code, BEST tag, occupied/empty, mark source, Walk Path, part lines) and DESIGN.md Components "Overlays" (tooltip). The cell's accessible name (Interaction Primitives) also lacks level. *Fix:* add "Level 1" (from the Level column, not parsed from the code) to the tooltip line and to the accessible-name example.
- **medium** **FR-7: the saved-plans list must show both dates** (data-as-of and upload). The IA row lists only "name, data-as-of date, created/edited by and at" (EXPERIENCE.md IA, Saved-plans list). *Fix:* add the upload date. Also state the FR-8 sort (most recently edited first).
- **medium** Glossary drift on **"Settings"**: PRD §3 defines Settings as the analysis thresholds and says Warehouse colours are "not part of Settings". EXPERIENCE.md renames the FR-18 part "Analysis settings" and puts both under a page called "Settings" (EXPERIENCE.md IA, Settings row; Warehouse wall "Settings → Warehouse colours"). *Fix:* keep the glossary word "Settings" for the FR-18 block, and label the other block "Warehouse colours (display only, kept in this browser)". Or make Warehouse colours its own launcher plate. Either way, don't introduce "Analysis settings".
- **medium** **Warehouse view / Locations view / Locations wall / wall** naming isn't settled. The PRD glossary term is "Warehouse view" (and FR-49 says "the warehouse view's key"). EXPERIENCE calls the surface "Locations view", "Locations wall" and "the wall", the flow step "Locations", and DESIGN.md Typography uses "Warehouse view" as a page-title example (DESIGN.md Typography ramp sentence). *Fix:* state once in EXPERIENCE.md IA that the glossary's warehouse view is shown as the Locations step's Wall mode, pick the page title (e.g. "Locations"), and change the DESIGN.md example to match.
- **low** "Key" vs "legend": DESIGN.md uses the component name Legend, EXPERIENCE uses "legend (the Key)" and "Key entry", and the PRD uses "key". *Fix:* say once that the component `legend` is labelled "Key" in the UI, then use "Key" in all UI-facing text.
- **low** "Other location ▾" vs the glossary/FR-31 "another suggested location", and "together/apart" for pick groups vs FR-20 "in the same aisle" (EXPERIENCE.md IA Pick groups; DESIGN.md Colors "In pick groups, 'together'…"). *Fix:* consider "Other suggested location ▾" and "same aisle / different aisles".
- **low** Stale text in EXPERIENCE.md Foundation: "the PRD is being updated in parallel". The PRD is already updated (final, FR-42 rewritten, FR-49 added). *Fix:* "the PRD records this as FR-42 (milestone 2) and FR-49".

## 8. Shape fit — strong

DESIGN.md sections are in canonical order (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts). EXPERIENCE.md has every required default plus both triggered sections (Responsive & Platform, Inspiration & Anti-patterns). The invented sections (Warehouse wall, Move list print, Open Questions) earn their place. No findings.

## Cross-cutting: superseded-decision leftovers and FR-49 gaps

These cut across categories 2, 3 and 7 and carry the highest downstream risk, so they are listed together.

- **high** **Selected move marker described as "accent fill"** (DESIGN.md Components, Move marker: "*selected* (accent fill)"). This contradicts the frontmatter (`move-marker.selected`: white fill, 2px accent ring, ink number), the Colors rule "nothing is written on a violet fill", and the memlog decision ("selected marker = white chip with violet ring"). It's a yellow-era leftover. *Fix:* "*selected* (white, 2px accent ring, ink number)".
- **high** **FR-49 scope of "selection" is ambiguous app-wide.** `accent` is also the focus ring, the input focus border, the plan plate edge, the round chip edge, the selected-row bar, the hover-note edge and the "You are here" border (DESIGN.md Colors table `accent`; frontmatter `input`, `plan-plate`, `round-chip`, `legend.entry-editable-focus`; EXPERIENCE.md State Patterns "Focus"). DESIGN.md says "a changed colour replaces the token everywhere it is drawn", and EXPERIENCE allows keeping a sub-3:1 colour. So a planner can make **focus indicators** unreadable across the whole app, and change chrome that FR-49 doesn't cover ("colours used in the warehouse view"). *Fix:* split into `selection` (changeable: wall, crops, markers, selected row bar) and a fixed `focus` / `accent` token for focus rings, inputs, plan plate, round chip and "You are here". Or state explicitly that FR-49 changes only wall/crop/marker selection.
- **medium** **Best frame and selected target frame differ only by colour.** Both are ~2px solid frames (`best-frame` 2px vs `move-target` selected 2.2px), the default pair is only 1.38:1 apart in luminance, and FR-49 lets the planner set them to the same colour. There is also no warning when two warehouse colours are set equal or near-equal (EXPERIENCE.md Warehouse colours warns only against backgrounds). Single-location best marks have no visible BEST text on the wall, only in the tooltip (EXPERIENCE.md Component Patterns, Best-location frame row). *Fix:* give one of the two a shape difference (e.g. the best frame with corner ticks, or the selected target as a double ring), and/or add a "too similar to <other colour>" warning to FR-49 rows.
- **medium** **Key labels hard-code colour names** that FR-49 makes changeable: "Best location (green frame, rail and BEST tag)" and "Selected (violet frame)" (DESIGN.md Components, Legend). After a change they're wrong. The same applies to the accessible-name example "Fast-moving, red, change colour", which EXPERIENCE does say updates. *Fix:* label by shape ("Best location (frame, rail, BEST tag)", "Selected (frame)"). Also say where "Selected" sits in the Key order (currently unspecified).
- **medium** **Whole-aisle best marks have no defined wall rendering.** EXPERIENCE says level marks get the rail + BEST tag, and frames go "around each best bin or slot", but doesn't say whether an aisle mark puts the rail and tag on every level or frames all 228 locations. UJ-1 step 4 marks aisle A whole (DESIGN.md Components "Best location"; EXPERIENCE.md Warehouse wall "Best-location marking on the wall"). *Fix:* define it, e.g. an aisle mark = rail + BEST tag on every level, plus a BEST tag on the aisle letter plate and aisle card, and no per-bin frames.
- **medium** **Stage-2 initials "in a 34px accent disc"** puts text on a violet fill (DESIGN.md Components, App toolbar), which the Colors rules forbid. *Fix:* use a white disc with an accent ring or an ink disc.
- **medium** **Error tint is now used outside the import panel.** `colour-popover.warning` sits on `{colors.error-tint}`, but the Colors table says `error` / `error-tint` mean "import error panel" and are never used for "anything on the wall" (DESIGN.md Colors table vs frontmatter `colour-popover`). *Fix:* widen the table row to "import errors and contrast warnings", or use a neutral warning style.
- **medium** **New FR-49 assumptions are not in Open Questions.** The memlog logs `best-on-light` derived from best [ASSUMPTION] and Esc/outside-click keeps the pick [ASSUMPTION], and the 8 presets are undefined. EXPERIENCE.md "Still open" lists six older items only (EXPERIENCE.md Open Questions). *Fix:* add them as non-blocking items 7–9.
- **low** The popover button is labelled "**Reset**" in EXPERIENCE.md (Change a colour from the Key) but "Reset this colour" in the memlog decision. *Fix:* use "Reset this colour" so it is not confused with the plan's "Reset…".
- **low** "Landing" is still used as a surface name in DESIGN.md: `{typography.display-hero}` "(66px, landing only)" (Typography) and "the landing and the legend at large scale" (Components, Bin). Not an app page, but the term should match EXPERIENCE's "demo front page". *Fix:* replace with "demo front page".
- **low** The product mark is "a medium-moving bin in miniature" (DESIGN.md Components, App toolbar). Does it follow a changed `class-medium`? *Fix:* state that it uses a fixed colour (or ink), so that a brand mark doesn't read as a class swatch.
- **low** The single-key global shortcut `G` (EXPERIENCE.md Interaction Primitives) conflicts with WCAG 2.2 SC 2.1.4 (Character Key Shortcuts) under the stated AA target, unless it can be turned off or remapped. Also, "`G` followed by a plate code … jumps directly" conflicts with the launcher rule "typing filters … `Enter` opens". *Fix:* make `G` active only outside text fields with a setting to turn it off (or use `Ctrl/⌘+K`), and say whether `G REC` needs `Enter`.

## Mechanical notes

- **Token references:** 126 (DESIGN.md) and 46 (EXPERIENCE.md) distinct `{path}` references. All resolve. 19 defined tokens are unreferenced (listed in §2).
- **Frontmatter/body hex consistency:** every hex in the prose matches its token (`#EEEDE8`, `#FFFFFF`, `#1B1E22`, `#4A5058`, `#6B717A`, `#D6D4CD`, `#E6E4DE`, `#E4E2DB`, `#F3EFFD`, graphite set, class set, `#9466F0`, `#3DAE6B`, `#2C8A55`, `#8F969D`, `#D33A2C` / `#FBE6E3`). Contrast claims were recomputed and are correct to ±0.05.
- **Superseded-decision scan:** no "yellow selection", "white best frame" or green "applied" remains in the rules. Remaining leftovers: Move marker "selected (accent fill)", stage-2 "accent disc", "landing" ×2 in DESIGN.md, and the page-title example "Warehouse view". "Colour by" appears only as a removal note (correct).
- **Sources:** both spines' `sources` resolve (`../../../../PRODUCT.md`, `../../prds/prd-Project-2026-11-01/prd.md`, `./.memlog.md`, `./.working/concepts/05-bin-wall/`, `./DESIGN.md`).
- **Layout arithmetic checks:** 332 + 16 + 1044 + 2×24 = 1440; 976 + 16 + 400 + 48 = 1440; 10 × 96 + 48 = 1008 ≤ 1044.
- **Mermaid:** none present.
- **Status:** both files are `draft`. Do not set `final` until the high findings are resolved.
- **Severity counts:** critical 0 · high 6 · medium 16 · low 18.
