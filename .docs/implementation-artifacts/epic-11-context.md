# Epic 11 Context: Change the Key colours

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner can change any of the six Key colours (Fast-moving, Medium-moving, Slow-moving, Dead stock, Best location, Selected) by clicking that entry in the Key under the wall. A popover offers preset shades, a hex field and a live preview on the real wall, and it warns when a colour is hard to read or too like another one. The choice is kept in this browser. This lets a planner fix a hard-to-see colour in a few seconds, for example on an old office monitor (UJ-4), without changing any plan, import or analysis. Meaning never depends on colour: glyphs, BEST text and frame shapes stay the same. The slice is frontend-only: `lib/colours` holds the colour maths, presets and storage, and `modules/key-colours` holds the Key buttons and the popover. It builds on the Epic 10 wall and its Key.

## Stories

- Story 11.1: Colour maths and presets
- Story 11.2: Key colours as live CSS variables kept in the browser
- Story 11.3: Change a colour from the Key

## Requirements & Constraints

- **Editable colours:** exactly six. Their defaults are the DESIGN.md tokens fast `#D85144`, medium `#F0B323`, slow `#417DDC`, dead `#8C939A`, best `#3DAE6B` and selection (accent) `#9466F0`.
  - Two tokens are derived. `best-on-light` (default `#267A4B`) darkens the chosen best hue until white text on it reaches 4.5:1 and the colour itself reaches 3:1 on white. `selected-tint` (default `#F3EFFD`) is the selection colour at about 10% on white.
- **Contrast check:** WCAG 2 relative-luminance ratio, measured where each colour is actually drawn.
  - Movement classes: against the wall `#30353A` and an open slot `#141719`. Not against white, because a swatch on paper always has an ink outline.
  - Best location: against the wall and an open slot, plus ink text on it (the BEST tag) at 4.5:1.
  - Selection: against its casing `#141719` and against white `#FFFFFF`.
  - The threshold is 3:1 except the 4.5:1 text pair.
- **Likeness check:** CIELAB ΔE (CIE76) below 20 between any two of the six colours flags them as too alike.
- **Warnings only:** the planner can keep a failing colour. All defaults pass every check, so a fresh browser shows no warning.
- **Expected default ratios (±0.02):**
  - fast 3.05 / 4.44, medium 6.59 / 9.58, slow 3.06 / 4.45, dead 3.98 / 5.79 (wall / open slot)
  - best 4.40 / 6.40 / 5.95 (wall / open slot / ink text)
  - selection 4.65 / 3.88 (casing / white)
  - Default pairs are at least ΔE 37 apart; slow-moving and selection are the closest.
- **Presets:** the DESIGN.md `colour-presets` give eight shades per entry, lightest first, with the default among them. Every preset passes its own entry's contrast check.
- **Reset:** Reset this colour restores only that entry's default. For best location it also restores `best-on-light` `#267A4B`. Nothing resets all colours at once.
- **Persistence:** colours are kept in this browser and survive a reload. They change no plan, import or analysis, and nothing about colours is ever sent to the server.
- **Fixed elements:** the printed move list stays black and white, and glyphs, BEST text and frame shapes never change (no information by colour alone).
- **Tests:**
  - Vitest `fr42_colours.test.ts` covers the default ratios, each preset passing its entry's check, the default ΔE ≥ 37 and the best-derivation values.
  - A Playwright run of UJ-4 changes Slow-moving to shade 6, reloads, and checks the wall, mini-walls and crops use the new shade, ▼ is unchanged and the print preview has no colour.
  - Test names reference FR-42.

## Technical Decisions

- **CSS variables as the only path:** the eight colour variables (`--colour-fast`, `--colour-medium`, `--colour-slow`, `--colour-dead`, `--colour-best`, `--colour-best-on-light`, `--colour-selection`, `--colour-selected-tint`) are the single source.
  - They must be read by every wall, mini-wall, wall crop, class swatch, best rail, frame and tag, and by every selection frame, arrow, marker ring and selected-row bar. One change then updates them all at once.
  - The focus ring, inputs, the plan plate edge, the round chip, the "You are here" tag and the product mark (fixed brand yellow `#F0B323`) never read these variables.
  - The print stylesheet stays pure black on white.
- **Storage:** localStorage key `swp:colours` is read and written only inside try/catch.
  - An inline script in the root layout applies the stored colours before first paint, so no default colour flashes.
  - Invalid stored values are ignored and the defaults are used.
  - If storage is blocked, changes live in memory for the page's life.
- **Frontend-only slice:** no backend endpoint, command or plan version is involved.
  - Frontend modules import only `components/*` and `lib/*`, never another module (ESLint). Colour maths and storage belong in `lib/colours`.
  - If the Key or wall primitives need changes to host the buttons, they are made in `components/common` and not duplicated.
- **Copy:** English, sentence case, glossary names verbatim, never colour words or hex in accessible names, no emoji or exclamation marks.

## UX & Interaction Patterns

- **Key:**
  - It sits under every wall, is always visible and keeps a fixed order.
  - The six colour entries are buttons named "<glossary name>, change colour" with `aria-haspopup="dialog"` and `aria-expanded`.
  - On hover an entry shows the selected tint background and a 14px palette icon after the label. On focus it shows the fixed paper focus ring.
  - Empty and 2 parts stay plain text.
- **Colour popover:**
  - It opens on click, `Enter` or `Space`, anchored above the entry.
  - It is a non-modal `role="dialog"`, 264px wide, labelled by its title with the glyph ("Fast-moving ▲ colour").
  - The eight presets are a `radiogroup` of 22px round swatches with a 24px hit area, in two rows of 4. Each radio is named "Fast-moving shade 3 of 8", and the default one is named "Default". The current preset is ringed and checked.
  - Next to the presets sits a Default chip with the default swatch and its hex.
  - The hex field (104px) has a 22px swatch button that opens the native colour picker. The hex field and the presets are the guaranteed keyboard path.
  - It ends with **Reset this colour** (tertiary) and **Done** (primary).
- **Behaviour:**
  - Focus starts on the current preset, and arrow keys preview each shade live on the wall.
  - A hex value that is not `#RRGGBB` sets `aria-invalid` and shows "Enter a colour as #RRGGBB". A valid value previews at once.
  - Warnings appear under the presets only when a check fails. They are linked to the hex field with `aria-describedby` and announced with `role="status"`. Examples: "Slow-moving on the wall: 2.1:1 (3:1 or more recommended)" and "Slow-moving and Selection look alike (ΔE 12). Bins and the selection frame may be hard to tell apart."
  - **Done** or a click outside keeps and stores the pick, and announces "Fast-moving colour changed".
  - `Esc` restores the colour the entry had when the popover opened.
  - Either way, focus returns to the Key entry.
  - The popover flips or shifts to stay inside the viewport, also at 200% zoom.
- **Storage blocked:** the popover shows "Colours can't be kept in this browser; changes last until you reload or close this page."
- **No other colour surface:** there is no colours page and no colour entry in Settings.

## Cross-Story Dependencies

- Story 11.1 (maths, presets, derived tokens) feeds Story 11.2 (applying and storing the variables) and Story 11.3 (popover checks and warnings).
- Story 11.2 must be in place before Story 11.3, which writes through it.
- The epic depends on the Epic 10 wall, Key, mini-walls and crops, which already take tokens through CSS variables. Story 11.2 must find every hard-coded use of the six colours and route it through the variables.
- The print check relies on the Epic 8 move-list print stylesheet staying colourless.
- Epic 12 (drag) runs on the same wall and must also use the selection and class variables.
