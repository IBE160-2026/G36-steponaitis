---
title: Accessibility review — DESIGN.md and EXPERIENCE.md (Bin Wall)
reviewed: 2026-11-13
targets:
  - ./DESIGN.md (updated 2026-11-13)
  - ./EXPERIENCE.md (updated 2026-11-13)
context:
  - ../../../../PRODUCT.md (Accessibility & Inclusion)
  - ../../prds/prd-Project-2026-11-01/prd.md (NFR-10, FR-38, FR-42, FR-49)
  - ./.memlog.md (latest decisions win)
lens: WCAG 2.2 AA floor + product rules (no information by colour alone; keyboard-complete; move list legible in black and white)
---

# Accessibility review: Bin Wall spines

## Verdict

**Revise before build (conditional pass).** The foundation is strong: every meaning has a glyph or word, the wall is a keyboard grid with tooltips on focus, a list alternative exists ("Open as list", "Moves touching aisle A"), there is no drag-only path, motion respects reduced motion, and the contrast numbers DESIGN.md states are arithmetically correct. The problems are in the pairs that were **not** measured and in how behaviour is specified. Seven must-fix findings:

1. Focus on the graphite wall is barely visible, and it looks the same as the selection frame.
2. White "BEST" text on `#2C8A55` fails text contrast.
3. Single-key shortcuts fail WCAG 2.1.4 (Level A).
4. The 1280px fixed layout fails Reflow (1.4.10).
5. The printed round band disappears when browsers print without backgrounds (their default).
6. The tooltip behaviour does not meet 1.4.13.
7. The FR-49 colour warning checks the wrong pairs, so the default colours would trigger it. It also lets a user erase the focus indicator.

None of these needs a change to the four fixed concept-05 elements.

## Method

Contrast was recomputed with the WCAG 2.x relative-luminance formula, `(L1 + 0.05) / (L2 + 0.05)`, using the hex values in the DESIGN.md frontmatter. Colour-vision deficiency was checked with Machado et al. (2009) severity-1.0 matrices and CIELAB ΔE between the six editable colours. Thresholds: text 4.5:1 (large text ≥ 24px, or ≥ 18.66px bold, 3:1); non-text UI and graphics 3:1 (1.4.11).

## Contrast results

### Claims in DESIGN.md: all verified

| Pair | Stated | Computed |
|---|---|---|
| ink / surface, ground | 16.7, 14.3 | 16.73, 14.27 |
| ink-secondary / surface | 8.1 | 8.14 |
| ink-muted / surface; on hatch | 4.9; ~3.4 | 4.92; 3.42 |
| on-dark / wall; on-dark-secondary / wall | 9.9; 7.8 | 9.88; 7.81 |
| on-dark-nav / track; on-dark-muted / track | 12.4; 6.8 | 12.44; 6.75 |
| best `#3DAE6B` / wall, slot, shell | 4.4, 6.4, 5.1 | 4.40, 6.40, 5.14 |
| `#2C8A55` / wall; / white | 2.9; 4.3 | 2.87; 4.31 |
| accent `#9466F0` / wall, shell, slot, white, ground | 3.2, 3.7, 4.7, 3.9, 3.3 | 3.19, 3.73, 4.65, 3.88, 3.31 |
| class colours / open slot (red, blue, grey, yellow) | 3.8, 3.1, 5.8, 9.6 | 3.78, 3.12, 5.79, 9.58 |
| yellow / white | 1.9 | 1.88 |

### Pairs not stated in DESIGN.md that fail or are marginal

| Pair (where it occurs) | Ratio | Needs | Result |
|---|---|---|---|
| White text on `best-on-light #2C8A55` (`components.best-tag-on-light`, 11px/700) | **4.31** | 4.5 (text) | **Fail 1.4.3** |
| Ink 1px inner focus ring on wall / slot / shell | **1.35 / 1.08 / 1.16** | 3 | **Fail.** The ink ring is invisible on graphite |
| Accent focus/selection ring on the louvre slat `#3A4046` | **2.71** | 3 | **Fail** where a ring or arrow crosses a slat |
| Accent ring against the bin it surrounds: fast / slow / dead / best frame | **1.23 / 1.49 / 1.25 / 1.38** | 3 vs at least one neighbour | Relies on the wall gap only (3px; see F1) |
| Best frame `#3DAE6B` against the bin inside it: fast / medium / dead | 1.69 / 1.50 / **1.11** | 3 vs at least one neighbour | Between two best bins in a marked level, the frame touches a bin on both sides |
| Open slot `#141719` vs wall `#30353A` (and vs slat) | **1.45** (1.72) | 3 | **Fail.** An empty location barely separates from the wall face |
| No-location hatch stripe `#2A2F34` on slot | **1.33** | 3 | **Fail.** "No location" cannot be told from "empty" |
| Bins vs the wall face, not the slot: fast / slow | **2.60 / 2.14** | 3 | Bins actually sit on the wall face; the white label window (12.4:1) is what rescues occupancy |
| Input border `#D6D4CD` on white (search, hex field, plan name, to-location) | **1.48** | 3 | **Fail 1.4.11** (input boundary) |
| Accent fill with ink text (DESIGN Components "Move marker … *selected* (accent fill)"; stage-2 initials in a 34px accent disc) | ink 4.32, white 3.88 | 4.5 | **Fail**, and it contradicts the "never text on violet" rule |
| Outdated ring `#8F969D` vs the marker's white fill | 2.99 | 3 | Marginal. It passes against the wall (4.14), so acceptable |
| ink-disabled on surface-disabled | 2.88 | (exempt) | Exempt for inactive controls, but the disabled reason must be readable elsewhere (see F11) |
| `best #3DAE6B` on white / ground | 2.81 / 2.40 | 3 | Fine **only if** paper surfaces always use the derived shade (FR-49 must guarantee it) |

### Colour-vision check (six editable defaults)

Smallest ΔE between pairs. Below about 20 is hard to tell apart; below about 10 is effectively the same.

| Vision | Closest pairs |
|---|---|
| Typical | slow–accent 33 · dead–best 55 |
| Protan | **slow–accent 13.8** · fast–best 26 · dead–best 37 |
| Deutan | **slow–accent 13.1** · dead–best 27 · fast–best 28 |
| Tritan | **dead–accent 17.9** · slow–dead 27.5 · slow–best 28 |

The four movement classes are safe because the glyphs carry them. But **selection (violet) next to slow-moving (blue) almost disappears for red-green colour-blind users**. Under tritanopia the same happens next to dead stock. Selection and focus are frames, and nothing but colour separates them from the green best frame (see F1, F7).

## Findings

Severity: **High** = WCAG AA (or Level A) failure or a product-rule break that a user will hit in the core flow. **Medium** = likely failure or an underspecified behaviour that builders will get wrong. **Low** = polish or a doc inconsistency.

### F1 — High. Focus on the wall is weak and looks the same as selection

*Where:* EXPERIENCE.md State Patterns, "Focus" row; DESIGN.md Colors, Meaning table (`accent` covers "focus rings"); `components.legend.entry-editable-focus`; `components.bin-lifted.frame`; `components.move-target`.

- The ink inner ring is 1.08–1.35:1 on graphite, so it adds nothing there. On the wall, the visible focus is only the 2px violet ring: 3.19 on the wall, 2.71 on slats, and 1.2–1.5 against the coloured bins it touches. Between bins the gap is 3px, so a 2px ring outside a bin sits almost on the neighbouring bin.
- The selected lifted bin and the selected target use **the same 2px violet frame**. A keyboard user cannot tell "where my focus is" from "which move is selected" (2.4.7 in spirit; it fails the product's own "selection = accent frame" meaning).
- The green best frame (2px, radius 3) and the violet focus frame (2px, radius 4) differ by colour alone. That breaks "no information by colour alone" for deutan and protan users.
- `accent` is user-editable (FR-49), and focus rings use `accent`. A user can therefore make focus invisible **across the whole app**, paper side included. For example, they could pick `#30353A`, which then disappears on the wall.

*Fix:*
- Add a fixed, non-editable `focus` token, separate from `accent`.
- On graphite, draw focus as a **2px white outer ring plus a 2px `#141719` inner ring**. White is 12.4:1 on the wall and 18:1 on a slot. The dark inner ring is ≥ 3.1:1 against every default bin, which keeps it separate from the bin.
- Render focus *outside* and on top of neighbours (`outline-offset`, z-index), so the 3px gap is not the limit.
- On paper, keep ink 2px plus a white gap.
- Make selection differ from focus and from best by **form**, not just colour. For example: selection = double frame or corner brackets; best = solid frame plus the existing rail or tag; focus = halo ring.
- Remove "focus rings" from `accent` in the Meaning table.

### F2 — High. The white BEST tag on paper fails text contrast, and the FR-49 derivation would make it worse

*Where:* DESIGN.md `components.best-tag-on-light` (white text, 11px/700, on `#2C8A55`), the Colors paragraph "On white surfaces … best uses the original `#2C8A55` (4.3:1 on white)", and the Colors line "`best-on-light` follows the chosen `best`, darkened to 3:1 on white". EXPERIENCE.md, Warehouse colours: "darkening the same hue until it reaches 3:1 on white".

White on `#2C8A55` is **4.31:1**, and 11px bold is not large text, so this fails 1.4.3. Deriving best-on-light to only 3:1 would put white tag text at about 3:1. If the word "best" is ever set in green on white, that fails too.

*Fix:*
- Default `best-on-light` to **`#267A4B`** (white on it 5.29:1) or `#277F4E` (4.96:1).
- Change both derivation rules to "**darken until white text on it reaches ≥ 4.5:1**". That also guarantees ≥ 4.5:1 for the shade as a mark on white.
- State that the word "best" in tables is set in ink. Green is used only for marks and the tag fill.

### F3 — High. Single-character shortcuts (WCAG 2.1.4, Level A)

*Where:* EXPERIENCE.md Interaction Primitives: `G`, `G` + code, `/`, and `A` / `O` / `K` on the selected row. The text adds only "none fires while a text field has focus".

Unmodified letter keys that work outside a focused component fail 2.1.4 unless they can be turned off or remapped, or they are active only while the relevant component has focus. Speech-input users trigger them by accident, for example by saying "Apply" or "Go".

*Fix:*
- Scope `A` / `O` / `K` to when focus is inside the recommendations list (they are then component-scoped and pass).
- For the global `G` and `/`, add a "Single-key shortcuts: on/off" toggle. The Keyboard box in the launcher is the natural place, stored with the colour choices. Or require a modifier.
- Document all of this in the launcher's Keyboard box.

### F4 — High. Reflow (1.4.10) and zoom with a fixed 1280px layout

*Where:* EXPERIENCE.md Responsive & Platform ("< 1280px: the layout holds its 1280px minimum and the page scrolls horizontally" plus a notice); Accessibility Floor, "Text size"; DESIGN.md Layout & Spacing.

- At 200% zoom on a 1280–1440px laptop, the viewport is 640–720 CSS px. The whole app then scrolls in two directions. The user also gets a notice saying the app is "built for at least 1280 px", which in effect tells zoom users they are unsupported.
- 1.4.4 (200%) can pass with horizontal scroll, but 1.4.10 (AA) requires reflow at 320 CSS px for everything except content that needs a 2D layout. The wall, the move-list preview and wide data tables qualify for that exception. The saved-plans list, New Plan, overview, settings, the colour page, the recommendation list and detail, dialogs and the toolbar do not.
- A sticky 64px toolbar holding 8 flow steps plus the plan plate takes a large share of a zoomed viewport. When it scrolls horizontally with the page, steps 5–8 and the launcher button go off-screen.

*Fix:* Specify a zoom/narrow breakpoint, for example ≤ 1024 CSS px:

- The flow bar collapses to "Step 6 of 8 · Recommendations ▾".
- The plan plate becomes a single line.
- The aisle rail becomes a drawer, and the detail panel stacks under the list.
- Forms and lists reflow to one column.

Keep only the wall panel and print preview as their own scroll regions, which the 2D exception covers. Replace the notice with nothing, or with a hint that is not shown when the cause is zoom. Make the toolbar non-sticky below about 500 CSS px viewport height.

### F5 — High. The printed round band disappears on default print settings

*Where:* DESIGN.md `components.print-move-list.round-band` ("solid print-ink with white text") and Components, Print move list; EXPERIENCE.md Move list print ("black band"); UJ-2, step 3.

Chrome, Edge and Firefox print **without background graphics by default**. A solid black band with white text then prints as white text on white paper. The round header ("Round 1 · one walk · from-location before to-location") vanishes, and that header is the most safety-critical line for the colleague (SM-6).

*Fix:*
- Draw the band as **bold black text between thick rules**, for example 2px top and bottom borders, which print without background graphics. Or keep the fill, add `print-color-adjust: exact` (plus the `-webkit-` prefix) and still have a border-and-text fallback.
- Raise `rule-line` from 0.5px to ≥ 1px (0.75pt), because hairlines drop out on many office laser printers.
- Raise `print-body` from 11.5px (≈ 8.6pt) to ≥ 10pt, and set codes to ≥ 11–12pt bold. The colleague reads it standing in an aisle.

### F6 — High. The tooltip does not meet 1.4.13 (content on hover or focus)

*Where:* EXPERIENCE.md Interaction Primitives, "Selecting a bin on the wall" ("Focusing a cell shows its tooltip … `Esc` unpins …", "hover shows the tooltip after 150 ms"); Component Patterns, Hover note; `components.tooltip`.

- **Dismissible:** only the *pinned* popover has an `Esc` rule. A focus- or hover-triggered tooltip must close on `Esc` without moving focus or the pointer. The global `Esc` order ("popover, dialog, panel or launcher") does not list the tooltip.
- **Hoverable:** not specified. The pointer must be able to move onto the tooltip without it closing.
- **Persistent:** not specified. There must be no timeout, and it stays until hover or focus leaves, it is dismissed, or the content becomes invalid.
- The tooltip opens on every arrow press and can cover neighbouring cells the user is about to move to.

*Fix:*
- Add a 1.4.13 clause: `Esc` hides the transient tooltip and focus stays on the cell. The tooltip stays while hovered. There is no auto-hide. It is placed on the side away from the direction of travel, or above the run.
- Make the transient tooltip `aria-hidden`, because the cell's accessible name already carries the content. Screen readers then do not read it twice.
- Specify the pinned version as a non-modal `role="dialog"` with `aria-labelledby` set to the location code. Focus moves to its first action, and `Esc` returns focus to the cell. The cell has `aria-haspopup="dialog"` and `aria-expanded`.

### F7 — High. The FR-49 colour warning checks the wrong pairs and misses whole classes of breakage

*Where:* EXPERIENCE.md, "Change a colour from the Key" and "Warehouse colours (FR-49)"; DESIGN.md Colors, "These are defaults the planner can change"; PRD FR-49, "less than 3:1 against a background it is drawn on".

- **The defaults would trigger it.** The spec checks "the graphite wall, an open slot or white". Slow on wall is 2.14, fast on wall 2.60, and medium on white is 1.88 (white is where list swatches sit). The planner would see three warnings before changing anything. DESIGN.md measured classes only against the open slot.
- **It ignores text drawn on the colour.** The BEST tag puts ink text on the chosen `best` and needs 4.5:1. The derived `best-on-light` carries white text (see F2).
- **It ignores distinctness between meanings.** Nothing stops `best` = `accent`, or `accent` close to `slow` (already ΔE 13 for deutan/protan with the defaults). Best frame, selection frame and focus ring then become identical. The glyphs protect classes, but they **do not protect frames**.
- **The accent drives focus rings,** so the user can remove focus visibility everywhere (see F1).
- **Legend text names the colours.** "Best location (green frame…)" and "Selected (violet frame)" become false after a change. The accessible name updates to "the chosen colour's name or hex", and a hex value read aloud ("hash three D A E six B") is useless.

*Fix:*
- Define the checked pairs per token. Classes: vs `slot-empty` and vs `wall`, with the ink outline mandatory on paper swatches so white is not a pair. `best`: vs `wall`, `wall-slat`, `slot-empty`, plus ink text on it ≥ 4.5. `accent` (selection only once F1 is fixed): vs `wall`, `wall-slat`, `slot-empty`, `surface`.
- Add a **distinctness check**: warn when two meaning colours are closer than a set ΔE, or under simulated deutan/protan vision.
- Disallow, rather than warn on, an identical value for `best` and `accent`.
- Remove colour words from legend labels, or generate them from a small named-colour list (never hex) for both the visible label and the accessible name.
- Validate all eight presets against every pair and against each other.

### F8 — Medium. Empty and "no location" are hard to see on the wall

*Where:* DESIGN.md `colors.slot-empty`, `colors.slot-none-stripe`, `components.slot-empty`, `components.slot-none`; Colors paragraph "Contrast for the load-bearing pairs".

Occupancy is "shape, not colour", but the shape itself is low contrast: the open slot vs the wall is 1.45:1, the slot's slat 1.72, the base line 1.37, and the no-location hatch 1.33. Occupied bins read well only because of the white label window (12.4:1 on the wall). The claim "every bin colour against an open slot is ≥ 3:1" measures a pair that is not adjacent. Bins sit on the wall face, where fast is 2.60 and slow 2.14.

*Fix:*
- Give the open slot a 1px rim of `#8A9097` (3.84:1 on the wall, 5.59 in the slot).
- Raise the hatch stripe to about `#646B72` (3.33:1 on the slot).
- State in DESIGN.md that the label window is never omitted, because it is the high-contrast occupancy cue.
- Restate the contrast claim with the real adjacent pair.

### F9 — Medium. The violet selection on the wall: arrow and frame against slats and bins

*Where:* `components.move-arrow`, `components.bin-lifted.frame`, `components.move-target` (selected).

The 3px arrow runs across slats (2.71:1) and across red, grey and blue bins (1.23–1.49:1). With deutan or protan vision, violet next to a blue bin is ΔE ≈ 13.

*Fix:* Give the arrow and the selection frames a **1.5px `#141719` casing**. Violet vs casing is 4.65, and the casing is ≥ 3.1 against every default bin. Alternatively, use a lighter graphite-side shade such as `#B9A0F7` (5.56 on the wall, 4.71 on slats), split like best and best-on-light. In both cases add a form difference (F1).

### F10 — Medium. The wall grid model has gaps

*Where:* EXPERIENCE.md Interaction Primitives, "Selecting a bin on the wall"; Warehouse wall; Recommendation detail crops; Best-location marking.

- **Run boundaries:** it is not said what `↓` from L1 of the top run and `↑` from L4 of the bottom run do. Recommend that they cross into the other run at the same section index, or stop, and say which.
- **Skipped cells:** a hatched no-location cell is "not focusable", but arrow movement must skip it predictably. The grid also needs a cell there, or `aria-colindex` gaps.
- **Missing keys:** add `Ctrl+Home` / `Ctrl+End`.
- **Headers:** level labels (`rowheader`) and section numbers (`columnheader`) are not specified, nor `aria-rowcount` / `aria-colcount`.
- **`aria-selected`:** the spec uses it for "the selected move", but a move spans two cells, possibly in different aisles. Recommend describing selection in text ("move 1, selected, leaves here") instead of `aria-selected` on gridcells.
- **Recommendation detail crops:** their semantics are undefined. Recommend either a decorative `aria-hidden` image with a text summary ("From G-14-04-02, aisle G, level 4 → to A-02-01-01, best, level 1"), or a second grid. Do not create two more tab stops of 30+ cells each.
- **Marking by keyboard:** there is no keyboard path for Level and Whole aisle. The rail is a 4px hit target (2.5.8, see F14) and is not in the grid. Recommend: in Level mode `Enter` on any cell previews and marks its level ("Mark level 1 in aisle A?"), and the level-label `rowheader` is a button.
- **Focus not obscured (2.4.11):** the sticky toolbar, the "Save failed" bar and bottom-left toasts can cover the focused cell. Specify `scroll-padding` for both and scroll into view on focus inside the horizontally scrolling wall panel.
- **Name verbosity:** a name such as "A-07-01-02, best location, occupied, 2 parts: … Recommendation 2 arrives here" is read on every arrow press. Keep the name short (code, class or empty, best, move state) and put part details in `aria-describedby`.

### F11 — Medium. Disabled controls hide their reason from keyboard users

*Where:* EXPERIENCE.md Component Patterns, Buttons ("A disabled button keeps its label and gets a tooltip with the reason"); Undo last move; Apply all at n = 0; Print with no moves.

A native `disabled` button cannot take focus, so its reason tooltip is hover-only, which the spec itself bans. *Fix:* use `aria-disabled="true"`, keep it focusable, and link the reason with `aria-describedby`. Alternatively, show the reason as visible text next to the button.

### F12 — Medium. Colour popover and picker behaviour is underspecified

*Where:* EXPERIENCE.md, "Change a colour from the Key"; `components.colour-popover`; `components.legend`.

- **Roles are missing.** The popover should be a non-modal `role="dialog"` labelled by its title. Presets should be a `radiogroup` of `radio` items with names ("Red", "Vermilion"…) and `aria-checked`. The Key entry needs `aria-haspopup="dialog"` and `aria-expanded`.
- **Initial focus is missing.** Recommend the current preset.
- **Esc is surprising.** "`Esc` … keeps the last picked colour" is the opposite of the platform convention, where `Esc` cancels. Arrowing through radio presets with live preview selects as it goes, so a keyboard user who explores and then presses `Esc` ends up with a colour they only browsed past. Recommend: `Esc` restores the colour from when the popover opened; Done or a click outside keeps the pick.
- **The hex field needs validation.** Use `aria-invalid` and an inline message such as "Enter a colour as #RRGGBB". The native `<input type="color">` picker is inconsistently keyboard-operable (on macOS Firefox it opens the OS panel), so state that the hex field and the presets are the guaranteed keyboard path.
- **The warning is not announced.** Link it to the hex field with `aria-describedby` and announce it with `role="status"`. Announce the change itself too ("Fast-moving colour changed").
- **Position is not specified.** The popover is "anchored above" the Key. At 200% zoom it must flip or shift so it is never clipped.
- **The Settings page "Reset to defaults" confirm popover** needs the same rules, with Cancel focused.

### F13 — Medium. Other interaction patterns that will be built wrong

- **Other location ▾:** "Choosing one applies immediately." Make sure arrow keys only move the highlight, and that `Enter` or a click applies. Otherwise browsing applies moves (3.2.2).
- **Recommendation list:** this is described as a "single-tab-stop list" with actions reached by `Tab` inside the row. A `listbox` cannot contain buttons. Specify `grid`/`treegrid`, or a table with focusable rows, so assistive tech is not given invalid ARIA.
- **Toast:** 6 s with an Undo action (2.2.1, 2.2.4). Pause it while hovered or focused, and confirm that every toast action also exists elsewhere (Undo last move does). Recommend at least 10 s for toasts with text longer than one line.
- **Launcher:** it is a full-height overlay, so it should be a modal dialog: trap focus and make the background `inert`. The current "never trapped except inside an open dialog" leaves this ambiguous.
- **Part panel:** specify that focus moves into it and returns to the opener on `Esc`.
- **Flow bar "done":** use visually hidden text in the link name ("Overview, step 1, done") instead of `aria-label` on a glyph.
- **Tabs:** include the count in the name ("Rule 1, 9 recommendations").

### F14 — Low. Target size (2.5.8)

| Target | Size | Verdict |
|---|---|---|
| Wall bins / slots | 27 × 29px | Pass |
| Aisle cards (mini-walls `aria-hidden`) | card-size | Pass |
| Move markers | 17px round | Passes only through the **equivalent** exception: the lifted bin, the row and the table select the same move. State this. |
| `control-sm` buttons in table rows | 20px tall | Borderline (24px rows, spacing circles only touch). Make the minimum 24px. |
| Colour presets | 22px round | Probably passes on spacing; make them 24px |
| Best rail in marking mode | 4px tall | Fails on its own. Extend the hit area to ≥ 24px or the whole level row, and make the level label the keyboard target (F10). |
| Remove-mark "×" | unspecified | Specify ≥ 24 × 24px |

### F15 — Low. Text spacing (1.4.12)

Fixed sizes clip when users apply text-spacing overrides: recommendation row 58px, table row 24px, plan plate 214 × 42px, rule band 34px, "G-14-04-02 sits in a 92px chip". *Fix:* state that these are **minimum** heights and widths, and that chips and plates grow rather than truncate.

### F16 — Low. Motion

The lift is ≤ 200 ms and instant under reduced motion. That is good. Also state:

- "Scrolls the other view into place" uses `behavior: smooth` only when reduced motion is not requested.
- Toasts and popovers do not slide under reduced motion.
- The "Running…" state uses no looping spinner, which is consistent with "nothing blinks or loops".

### F17 — Low. Doc inconsistencies that affect accessibility

- **DESIGN.md Components, Move marker:** "*selected* (accent fill)" contradicts the frontmatter `move-marker.selected` (white fill, violet ring) and the "never text on violet" rule. Ink on violet is 4.32:1. Fix the prose.
- **DESIGN.md Components, App toolbar:** "initials … in a 34px accent disc" (stage 2) puts text on violet (white 3.88, ink 4.32). Use an ink disc with white initials, or a white disc with a violet ring.
- **The PRD glossary** says warehouse colours are "not part of Settings", while EXPERIENCE.md places them under "Settings → Warehouse colours". This does not affect accessibility, but it decides where keyboard users look for the page. Align the wording.

## What works well (keep)

- Every meaning has a non-colour cue: class glyphs, the BEST tag, Outdated (hatch, strike, word and cause), the applied check plus text, rule tags, and the NO SPACE text.
- Occupancy is read from shape and text, never red/green (FR-42 rewrite).
- The wall is a single-tab-stop grid with roving focus, and tooltips are reachable by keyboard.
- Equivalent non-visual paths exist: "Open as list" (FR-14 table) and the "Moves touching aisle A" table.
- There is no drag-and-drop, and modals are at most one deep.
- `Cancel` is the default focus on destructive confirms, and focus returns to the opener.
- Live regions are planned for run results, toasts and save status, and `role="alert"` for import errors.
- Print is black and white with no colour dependence by design. Only the band rendering needs fixing (F5).
- The stated contrast numbers are accurate.

## Suggested token changes (summary)

| Token | Now | Proposed | Why |
|---|---|---|---|
| `best-on-light` | `#2C8A55` | `#267A4B` | White tag text 5.29:1 (F2) |
| new `focus-on-dark` | (accent + ink) | white 2px + `#141719` 2px | Visible on wall and bins; not user-editable (F1) |
| new `focus-on-light` | (accent + ink) | ink 2px + 2px white offset | Separate from editable `accent` (F1) |
| `slot-empty` rim | none | 1px `#8A9097` | Empty slot 3.84:1 vs wall (F8) |
| `slot-none-stripe` | `#2A2F34` | `#646B72` | Hatch 3.33:1 on slot (F8) |
| `border` (inputs only) | `#D6D4CD` | `#8A9097` | Input boundary 3.22:1 (1.4.11) |
| `move-arrow` | 3px accent | 3px accent + 1.5px `#141719` casing | Crosses slats and bins (F9) |
| `print-move-list.round-band` | black fill, white text | bold black text between 2px rules (or fill + `print-color-adjust: exact` + border fallback) | Default print drops backgrounds (F5) |
| `print-move-list.rule-line` / `print-body` | 0.5px / 11.5px | ≥ 1px / ≥ 10pt | Office printers, aisle reading (F5) |
