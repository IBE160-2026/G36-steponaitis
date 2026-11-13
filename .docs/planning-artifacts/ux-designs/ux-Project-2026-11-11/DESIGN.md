---
name: Smart Warehouse Planner — Bin Wall
description: Desktop planning tool for re-slotting a spare-parts warehouse. Light paper ground, a graphite shelf wall, and bins coloured by movement class. Concept 05 "Bin Wall".
status: draft
created: 2026-11-11
updated: 2026-11-13
sources:
  - ../../../../PRODUCT.md
  - ../../prds/prd-Project-2026-11-01/prd.md
  - ./.memlog.md
  - ./.working/concepts/05-bin-wall/
colors:
  # Paper side: the working surfaces
  ground: '#EEEDE8'
  surface: '#FFFFFF'
  surface-disabled: '#F3F2EE'
  band: '#E4E2DB'
  row-quiet: '#FAFAF7'
  selected-tint: '#F3EFFD'
  ink: '#1B1E22'
  ink-secondary: '#4A5058'
  ink-muted: '#6B717A'
  ink-disabled: '#8A9097'
  border: '#D6D4CD'
  hairline: '#E6E4DE'
  hatch-stripe: '#D9D7D0'
  # Graphite side: shell, flow bar and the shelf wall
  shell: '#262A2E'
  shell-slat: '#2F3439'
  shell-edge: '#121416'
  flow-track: '#16191C'
  flow-track-edge: '#3A4046'
  wall: '#30353A'
  wall-slat: '#3A4046'
  wall-edge: '#1A1D20'
  beam: '#1F2326'
  upright: '#454B52'
  slot-empty: '#141719'
  slot-line: '#2C3136'
  slot-none-stripe: '#2A2F34'
  on-dark: '#E3E6E9'
  on-dark-secondary: '#C9CED3'
  on-dark-nav: '#D5D9DD'
  on-dark-muted: '#9AA1A8'
  stage2-outline: '#6B727A'
  stage2-code: '#7E858D'
  stage2-text: '#AEB4BA'
  launcher-rail: '#454B52'
  launcher-rail-edge: '#5A6168'
  # Movement class: the bin plastics (colour + glyph, never colour alone)
  class-fast: '#D33A2C'
  class-medium: '#F0B323'
  class-slow: '#2462C6'
  class-dead: '#8C939A'
  label-window: '#FFFFFF'
  glyph: '#1B1E22'
  # Meaning colours outside the class system
  accent: '#9466F0'
  best: '#3DAE6B'
  best-on-light: '#2C8A55'
  outdated: '#8F969D'
  error: '#D33A2C'
  error-tint: '#FBE6E3'
  # Print (move list): pure black on white
  print-ink: '#000000'
  print-paper: '#FFFFFF'
typography:
  display-hero:
    fontFamily: Barlow Semi Condensed
    fontSize: 66px
    fontWeight: '700'
    lineHeight: '1.06'
  plate-code:
    fontFamily: Barlow Semi Condensed
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1'
  page-title:
    fontFamily: Barlow Semi Condensed
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.15'
  section-title:
    fontFamily: Barlow Semi Condensed
    fontSize: 22px
    fontWeight: '700'
    lineHeight: '1.2'
  rank:
    fontFamily: Barlow Semi Condensed
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1'
  panel-title:
    fontFamily: Barlow Semi Condensed
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1.25'
  part-number:
    fontFamily: Barlow Semi Condensed
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1.2'
  code:
    fontFamily: Barlow Semi Condensed
    fontSize: 13.5px
    fontWeight: '700'
    lineHeight: '1.2'
  code-table:
    fontFamily: Barlow Semi Condensed
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.3'
  wall-label:
    fontFamily: Barlow Semi Condensed
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1'
  wall-section:
    fontFamily: Barlow Semi Condensed
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
  tag:
    fontFamily: Barlow Semi Condensed
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
  marker:
    fontFamily: Barlow Semi Condensed
    fontSize: 11.5px
    fontWeight: '700'
    lineHeight: '1'
  lead:
    fontFamily: Figtree
    fontSize: 19px
    fontWeight: '400'
    lineHeight: '1.37'
  body-strong:
    fontFamily: Figtree
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.35'
  body:
    fontFamily: Figtree
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  reason:
    fontFamily: Figtree
    fontSize: 12.5px
    fontWeight: '400'
    lineHeight: '1.3'
  caption:
    fontFamily: Figtree
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.3'
  meta:
    fontFamily: Figtree
    fontSize: 11.5px
    fontWeight: '500'
    lineHeight: '1.3'
  column-head:
    fontFamily: Figtree
    fontSize: 11.5px
    fontWeight: '600'
    lineHeight: '1.3'
  button:
    fontFamily: Figtree
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1'
  tab:
    fontFamily: Figtree
    fontSize: 13.5px
    fontWeight: '500'
    lineHeight: '1'
  print-body:
    fontFamily: Figtree
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.3'
rounded:
  xs: 1px
  sm: 2px
  md: 3px
  DEFAULT: 4px
  lg: 6px
  xl: 8px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  page-gutter: 24px
  panel-gap: 16px
  panel-padding: 16px
  toolbar-height: 64px
  control-lg: 36px
  control-md: 28px
  control-sm: 20px
  rule-band: 34px
  recommendation-row: 58px
  table-row: 24px
  bin-width: 27px
  bin-height: 29px
  bin-gap: 3px
  slot-pitch: 30px
  level-pitch: 40px
  section-pitch: 96px
  marker-size: 17px
components:
  bin:
    width: '{spacing.bin-width}'
    height: '{spacing.bin-height}'
    radius: '{rounded.sm}'
    background: '{colors.class-fast} | {colors.class-medium} | {colors.class-slow} | {colors.class-dead}'
    lip-top: '3.5px band, rgba(0,0,0,0.22), radius 1.5px'
    lip-bottom: '1.5px line, rgba(0,0,0,0.18)'
  bin-label-window:
    background: '{colors.label-window}'
    radius: '{rounded.xs}'
    size: '21px × 13px at bin-width'
    glyph-size: 9px
    glyph-color: '{colors.glyph}'
  class-glyph:
    fast: 'filled triangle, point up'
    medium: 'filled diamond'
    slow: 'filled triangle, point down'
    dead: 'ring with a 45° slash, 1.6px stroke'
  slot-empty:
    background: '{colors.slot-empty}'
    radius: '{rounded.sm}'
    slat: '{colors.wall-slat}, 2.6px tall, radius 1.3px, near the top'
    base-line: '{colors.slot-line}, 1px'
  slot-none:
    background: 'diagonal hatch {colors.slot-none-stripe} on {colors.slot-empty}'
  best-frame:
    stroke: '{colors.best}'
    stroke-width: 2px
    radius: '{rounded.md}'
  best-rail:
    background: '{colors.best}'
    height: 4px
  best-tag:
    background: '{colors.best}'
    foreground: '{colors.ink}'
    typography: '{typography.tag}'
    radius: '{rounded.sm}'
    size: '40px × 15px'
  best-tag-on-light:
    background: '{colors.best-on-light}'
    foreground: '{colors.surface}'
    typography: '{typography.tag}'
    radius: '{rounded.sm}'
  bin-lifted:
    scale: '33px × 34px (about 1.2× a bin)'
    shadow: '0 6px 10px rgba(0,0,0,0.45)'
    frame: '2px {colors.accent}, radius {rounded.DEFAULT}, when selected'
    vacated-slot: '1.4px dashed #FFFFFF, dash 2 2, radius {rounded.md}'
  move-arrow:
    stroke: '{colors.accent}'
    stroke-width: 3px
    linecap: round
  move-target:
    stroke: '#FFFFFF dashed 1.6px, dash 3 2.5 (pending) | {colors.accent} solid 2.2px (selected)'
    radius: '{rounded.md}'
    fill: 'rgba(255,255,255,0.16) when selected'
    glyph: 'plus, 13px, white'
  move-marker:
    size: '{spacing.marker-size}'
    radius: '{rounded.full}'
    typography: '{typography.marker}'
    recommended: 'fill {colors.surface}, 1.2px {colors.ink} ring, number in {colors.ink}'
    selected: 'fill {colors.surface}, 2px {colors.accent} ring, number in {colors.ink}'
    manual: 'fill {colors.ink}, 1.2px white ring, letter M in white'
    applied: 'fill {colors.ink}, 1.2px white ring, white check glyph'
    outdated: 'fill {colors.surface}, 1.2px {colors.outdated} ring, dashed slot outline {colors.outdated} dash 2 2'
  wall-panel:
    background: 'louvre pattern {colors.wall} with {colors.wall-slat} slats (9px × 2.6px, radius 1.3px, 14 × 10 tile)'
    border: '1px {colors.wall-edge}'
    radius: '{rounded.lg}'
    beam: '4px {colors.beam} under each level'
    upright: '5px {colors.upright} at each section start'
  aisle-card:
    background: '{colors.surface}'
    selected-background: '{colors.selected-tint}'
    selected-border: '1.5px {colors.ink}'
    radius: '{rounded.lg}'
    letter-plate: '30px square, white, 1.2px {colors.ink}, radius {rounded.sm}, letter in {typography.section-title}'
    mini-wall: 'background {colors.slot-empty}, radius {rounded.md}, bins 2.9px × 5.5px'
  app-toolbar:
    height: '{spacing.toolbar-height}'
    background: 'louvre pattern {colors.shell} with {colors.shell-slat} slats (11px × 3px, radius 1.5px, 18 × 12 tile)'
    bottom-edge: '1px {colors.shell-edge}'
  plan-plate:
    background: '{colors.surface}'
    radius: '{rounded.md}'
    height: 42px
    edge: '6px {colors.accent} bar on the left'
    title: '{typography.panel-title}'
    meta: '{typography.meta}'
  flow-bar:
    background: '{colors.flow-track}'
    border: '1px {colors.flow-track-edge}'
    radius: 7px
    height: 38px
    step-label: '{typography.button}, weight 500, {colors.on-dark-nav}'
    step-number: '14px ring, 1.2px {colors.on-dark-muted}, number {typography.tag}'
    step-done: '14px disc {colors.on-dark-nav}, check glyph {colors.ink}'
  flow-step-current:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    radius: 5px
    height: 30px
  button-primary:
    background: '{colors.ink}'
    foreground: '{colors.surface}'
    radius: '{rounded.lg}'
    height: '{spacing.control-lg}'
    typography: '{typography.button}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '1px {colors.ink}'
    radius: '{rounded.lg}'
  button-tertiary:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '1px {colors.border}'
    radius: '{rounded.lg}'
  button-link:
    foreground: '{colors.ink}'
    typography: '{typography.button}'
    decoration: underline
  button-disabled:
    background: '{colors.surface-disabled}'
    foreground: '{colors.ink-disabled}'
    border: '1px {colors.border}'
  segmented-control:
    track: '{colors.surface}, 1px {colors.border}, radius {rounded.lg}, height 34px'
    selected: '{colors.ink} fill, {colors.surface} text, radius {rounded.DEFAULT}'
  tab:
    typography: '{typography.tab}'
    idle: '{colors.ink-secondary}'
    selected: '{colors.ink}, weight 600, 3px {colors.ink} underline'
  count-pill:
    radius: '{rounded.full}'
    height: 18px
    idle: '{colors.surface}, 1px {colors.border}, number {colors.ink}'
    selected: '{colors.ink} fill, number {colors.surface}'
    typography: '{typography.marker}'
  location-chip:
    background: '{colors.surface}'
    border: '1px {colors.ink}'
    radius: '{rounded.sm}'
    height: 24px
    typography: '{typography.code}'
    best-mark: 'small ribbon glyph top-right, {colors.ink}'
  rule-tag:
    background: '{colors.ink}'
    foreground: '{colors.surface}'
    radius: '{rounded.md}'
    height: 20px
    typography: '{typography.tag}, 12px'
  round-chip:
    background: '{colors.surface}'
    border: '1.2px {colors.ink}'
    edge: '5px {colors.accent} bar on the left'
    radius: '{rounded.md}'
    height: '{spacing.control-md}'
    typography: '{typography.code}, 14px'
  no-space-chip:
    background: 'hatch {colors.slot-none-stripe} on {colors.slot-empty}'
    radius: '{rounded.md}'
    label: 'white inset {rounded.sm}, NO SPACE in {typography.code}, 12.5px'
    reason: '{typography.meta}, 600, white'
  rule-band:
    background: '{colors.band}'
    height: '{spacing.rule-band}'
    title: '{typography.body-strong}, 700'
  recommendation-row:
    background: '{colors.surface}'
    height: '{spacing.recommendation-row}'
    divider: '1px {colors.hairline}'
  recommendation-row-selected:
    background: '{colors.selected-tint}'
    border: '1.5px {colors.ink}'
    edge: '5px {colors.accent} bar on the left'
  recommendation-row-outdated:
    background: 'diagonal hatch {colors.hatch-stripe} on white at 60%'
    text: '{colors.ink-secondary}'
    target-code: 'struck through'
  tooltip:
    background: '{colors.surface}'
    border: '1px {colors.border}'
    radius: '{rounded.lg}'
    shadow: '0 8px 20px rgba(27,30,34,0.22)'
    pointer: '9px triangle toward the selected bin'
  hover-note:
    background: '{colors.surface}'
    radius: '{rounded.DEFAULT}'
    shadow: '0 8px 20px rgba(27,30,34,0.22)'
    edge: '6px {colors.accent} bar on the left'
  roster-row:
    rank: '{typography.rank} at 14–20px'
    swatch: 'bin in miniature, 16px'
    part-number: '{typography.code}'
    why-line: '{typography.meta}, {colors.ink-secondary}'
  launcher-plate:
    background: '{colors.surface}'
    radius: '{rounded.DEFAULT}'
    size: '238px × 128px'
    code: '{typography.plate-code}'
    step-badge: '26px ring 1.5px {colors.ink}; current step filled {colors.ink}'
    hangers: 'two 10 × 14px {colors.wall-edge} tabs on the rail above'
  launcher-plate-stage2:
    background: '{colors.slot-empty}'
    border: '1.4px dashed {colors.stage2-outline}, dash 5 4'
    code: '{colors.stage2-code}, 34px'
    text: '{colors.stage2-text}'
  you-are-here-tag:
    background: '{colors.surface}'
    border: '1.5px {colors.accent}'
    foreground: '{colors.ink}'
    radius: '{rounded.md}'
    typography: '{typography.meta}, 700'
  input:
    background: '{colors.surface}'
    border: '1px {colors.border}'
    focus-border: '2px {colors.accent}'
    radius: 5px
    placeholder: '{colors.ink-muted}'
  import-error:
    background: '{colors.error-tint}'
    border: '1px {colors.error}'
    radius: '{rounded.md}'
    text: '{colors.ink}'
    icon: 'warning triangle, {colors.error}'
  legend:
    swatch: '16px × 18px miniature bin or slot'
    label: '{typography.caption}, 500'
  print-move-list:
    paper: '{colors.print-paper}'
    ink: '{colors.print-ink}'
    round-band: 'solid {colors.print-ink} with white text, 18px'
    tick-box: '12px square, 1.2px {colors.print-ink}'
    rule-line: '0.5px {colors.print-ink}'
---

## Brand & Style

Smart Warehouse Planner looks like the thing it plans. The planner sits in an office next to the warehouse floor, and every aisle on screen is drawn the way it looks from the floor: a graphite shelf face, sections across, levels L1–L4 up, and every location a bin. Bins are coloured plastic, like real picking bins. Empty locations are open dark slots with no bin in them. The interface does not offer an abstract grid of squares with a colour legend. It shows the shelf.

The posture is **industrial-plain**. There are two materials. The working surfaces are light paper (`{colors.ground}` and `{colors.surface}`) with near-black ink and condensed codes. The shelf hardware is graphite: the louvre-panel toolbar, the flow bar and the wall itself. The world contributes type, palette, density and one signature move, **the lifted bin**. Everything else is standard, buildable web controls: buttons, tabs, tables, segmented controls. Nothing is dressed up as a costume.

Four things from concept 05 are fixed and must stay as drawn (memlog decision):

1. Each aisle is a **bin-wall elevation**: sections across, levels L1–L4 up, every location a bin, and an empty location shown as an open dark slot.
2. **Movement class is the bin colour plus a glyph** in a white label window: fast-moving red ▲, medium-moving yellow ◆, slow-moving blue ▼, dead stock grey slashed ring.
3. **The lifted bin** marks a recommended move. The bin is lifted out of its slot, an arrow runs to a dashed target slot, and a numbered marker matches the table row.
4. **The top flow bar** holds the plan plate (plan name, data-as-of date, round) and the 8 steps with check marks.

The voice is quiet and exact, like a parts catalogue. Every bin is a real location code and every move shows from, to and why. The visual system never claims more than the data supports: there are no distance lines, no capacity bars and no heat-map gradients.

Visual references (the spines win on any conflict with a mock): [warehouse layout](./.working/concepts/05-bin-wall/warehouse-layout.svg) · [recommendations interface](./.working/concepts/05-bin-wall/interface.svg) · [features menu](./.working/concepts/05-bin-wall/features-menu.svg) · [screen map](./.working/concepts/05-bin-wall/screen-map.svg) · [landing](./.working/concepts/05-bin-wall/landing.svg) · [concept card](./.working/concepts/05-bin-wall/concept.md).

## Colors

The palette has three layers: paper, graphite and meaning. Colour carries meaning only in the bin system and in a few named states, and every meaning also has a shape or a word.

**Paper (working surfaces).**
- **Ground `#EEEDE8`** is the page background, a warm light grey suited to daylight and fluorescent office light. Cards and tables sit on **Surface `#FFFFFF`**.
- **Ink `#1B1E22`** is the text, the primary button fill and the strong outlines. It reaches 16.7:1 on white and 14.3:1 on the ground.
- **Ink secondary `#4A5058`** is for reasons, metadata and column heads (8.1:1 on white). **Ink muted `#6B717A`** is for placeholders only (4.9:1 on white). It is not used for text on hatched rows, where it drops to about 3.4:1.
- **Border `#D6D4CD`** outlines cards and tertiary controls. **Hairline `#E6E4DE`** divides rows. **Band `#E4E2DB`** is the rule header strip in the recommendations list. **Selected tint `#F3EFFD`** (a pale violet) fills the selected row and the selected aisle card.

**Graphite (shelf hardware).**
- **Shell `#262A2E`** with **shell slat `#2F3439`** makes the louvre-panel toolbar. **Flow track `#16191C`** holds the 8 steps.
- **Wall `#30353A`** with **wall slat `#3A4046`** is the shelf face. **Beam `#1F2326`** runs under each level and **upright `#454B52`** starts each section.
- **Slot empty `#141719`** is an open slot: an empty location. **Slot-none stripe `#2A2F34`**, hatched over the slot colour, marks a position where no location exists (aisle I has fewer locations than the others) and forms the background of the "no space" chip.
- Text on graphite uses **on-dark `#E3E6E9`** for level labels (9.9:1 on the wall), **on-dark secondary `#C9CED3`** for section numbers (7.8:1), **on-dark nav `#D5D9DD`** for flow-bar labels (12.4:1 on the track) and **on-dark muted `#9AA1A8`** for steps not yet reached (6.8:1).

**Meaning.**

| Token | Hex | Means | Paired cue | Never used for |
|---|---|---|---|---|
| `class-fast` | `#D33A2C` | fast-moving bin | ▲ glyph in the label window | errors on the wall, warnings, "occupied" |
| `class-medium` | `#F0B323` | medium-moving bin | ◆ glyph | selection |
| `class-slow` | `#2462C6` | slow-moving bin | ▼ glyph | links, information |
| `class-dead` | `#8C939A` | dead-stock bin | slashed-ring glyph | disabled controls |
| `best` | `#3DAE6B` | best location, on graphite | "BEST" tag on the level label, frame shape, rail | applied, success, "done" |
| `best-on-light` | `#2C8A55` | best location, on paper | "best" text or "BEST" tag | applied, success, "done" |
| `accent` | `#9466F0` | selection: the move in focus, "You are here", the plan plate edge, focus rings | a frame, a ring, an arrow, a bar or a tag, never a filled bin and never text | movement class, best location |
| `outdated` | `#8F969D` | outdated marker ring and slot outline | dashed line plus the word "Outdated" | — |
| `error` / `error-tint` | `#D33A2C` / `#FBE6E3` | import error panel | warning triangle plus a sentence naming the file, row and column | anything on the wall |

**These are defaults the planner can change.** The six warehouse colours (`class-fast`, `class-medium`, `class-slow`, `class-dead`, `best` and `accent`) are the defaults of the in-app Warehouse colours setting (PRD FR-49, behaviour in EXPERIENCE.md). A changed colour replaces the token everywhere it is drawn; `best-on-light` follows the chosen `best`, darkened to 3:1 on white. Every other token is fixed, and the glyphs, BEST tag and selection frame shape never change, so meaning never rests on the chosen colours.

**Best location is green.** This is a user decision from 2026-11-13. The best-location frame, rail and BEST tag use green, and the "BEST" text stays, so the cue is never colour alone. On the graphite wall, the concept's `#2C8A55` reaches only 2.9:1 against the louvre, so the wall uses a tuned **`#3DAE6B`**. That gives 4.4:1 on the wall, 6.4:1 on an open slot and 5.1:1 on the shell, which clears the 3:1 non-text floor everywhere it appears. The BEST tag on graphite is `#3DAE6B` with ink text. On white surfaces (the marking list, tables, popovers) best uses the original **`#2C8A55`** (4.3:1 on white), always next to the word "best" or a BEST tag. The split into `best` (on graphite) and `best-on-light` (on paper) was confirmed by the user on 2026-11-13.

**Applied no longer uses green.** Concept 05 used `#2C8A55` only for "applied", which now clashes with best location. The applied state becomes an **ink check glyph plus the text "Applied · move N"**, in `{colors.ink}`. The same change applies to other "done" uses of green in the mocks. Flow-bar done steps show an ink check on an `{colors.on-dark-nav}` disc. On the wall, an applied marker is an ink disc with a white check. In pick groups, "together" is written in ink with a link glyph. Confirmed by the user on 2026-11-13.

**Colour is reserved for movement class.** Occupancy is never coloured. It shows by shape (a bin compared with an open slot) and by text (occupied / empty, counts and %). This follows the FR-42 rewrite decided on 2026-11-13. Red and green are never used as an occupied/empty pair.

**Selection has its own colour: violet.** Concept 05 used the medium-moving yellow for selection too. On 2026-11-13 the user gave selection its own colour, violet `#9466F0`, a hue that no movement class, best location or state uses. One shade works on both sides: 3.2:1 on the graphite wall, 3.7:1 on the shell, 4.7:1 on an open slot, 3.9:1 on white and 3.3:1 on the paper ground, so it clears the 3:1 floor for frames, rings and arrows everywhere. It is below 4.5:1 against both ink and white, so **violet never carries text and nothing is written on a violet fill**: the selected move marker is a white chip with a 2px violet ring and an ink number, and the "You are here" tag is white with a violet border.

Contrast for the load-bearing pairs: ink on the label window is 16.7:1. Every bin colour against an open slot is ≥ 3:1 (red 3.8, blue 3.1, grey 5.8, yellow 9.6). The ink number on the white selected marker is 16.7:1. White on an ink button is 16.7:1. Medium-moving yellow on white is only 1.9:1, so **yellow is never text and never the only edge on white**; a medium-moving swatch always sits inside a 1.2–1.5px ink outline.

## Typography

There are two families, both on Google Fonts, with fallbacks `'Arial Narrow', 'Helvetica Neue', Arial, sans-serif` and `'Helvetica Neue', Helvetica, Arial, sans-serif`.

- **Barlow Semi Condensed** (500/600/700) is the voice of the shelf label. It sets everything that is a *code or a count*: location codes, part numbers, aisle letters, level labels, ranks, markers, tags, page titles and the launcher plate codes. The condensed width lets `G-14-04-02` sit in a 92px chip and keeps the wall labels inside 27px bins.
- **Figtree** (400/500/600/700) is the reading voice: descriptions, reasons, buttons, tabs and table cells.

All numbers are **tabular** (`font-variant-numeric: tabular-nums`) so picks, counts and Walk Path values line up in columns.

The ramp runs from `{typography.display-hero}` (66px, landing only) through `{typography.page-title}` (28px, one per screen: "Recommendations", "Warehouse view") and `{typography.section-title}` (22px: "Aisle A", the whole-warehouse %) down to body at 13px. The smallest text is 11px (`{typography.tag}`, column heads, the BEST tag). Nothing goes below 11px on screen. The launcher plate code (`{typography.plate-code}`, 36px) is the only large, decorative use of type inside the app, and even there it is a real navigation code (OVR, PRT, LOC…).

A part is always written as **part number in Barlow 700 + description in Figtree**, for example **4410281** Brake pads, front - VW Golf. A reason line is always `{typography.reason}` in `{colors.ink-secondary}`, worded in numbers ("Fast-moving: 61 picks in the period (24 or more)"). No letter-spacing, no all-caps body text. All-caps appears only on short tags such as BEST and NO SPACE.

## Layout & Spacing

The canvas is a desktop browser. Mocks are drawn at 1440 × 900.

- **Shell:** the toolbar is `{spacing.toolbar-height}` (64px) and is always visible. Below it, the page has a 24px gutter (`{spacing.page-gutter}`), a page title row, then content panels at `{spacing.panel-gap}` (16px) apart with `{spacing.panel-padding}` (16px) inside.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24. Tight groupings (glyph to code, chip to caption) use 4–8. Panel padding and gaps use 16. Page edges use 24.
- **Control heights:** `{spacing.control-lg}` 36px for page-level actions, `{spacing.control-md}` 28px for row actions, `{spacing.control-sm}` 20px for actions inside a dense table row.
- **Recommendations:** the list is 976px wide (left) and the detail panel 400px (right). The rule band is 34px, a recommendation row is 58px, and the selected row grows to fit a partner note.
- **Locations view (the wall):** a 332px aisle rail (left) next to the 1044px wall panel (right), with a 246px "Moves touching this aisle" table below the wall.

**Wall geometry.** This is the part to get exactly right, because it decides whether the wall fits on screen.

| Measure | Token | Value |
|---|---|---|
| Bin | `{spacing.bin-width}` × `{spacing.bin-height}` | 27 × 29px |
| Gap between bins | `{spacing.bin-gap}` | 3px |
| Position pitch | `{spacing.slot-pitch}` | 30px |
| Level pitch (bin + beam + air) | `{spacing.level-pitch}` | 40px |
| Section pitch (3 positions + upright) | `{spacing.section-pitch}` | 96px |
| Level-label column | — | 48px, holds L1–L4 and the BEST tag |

An aisle of 19 sections is drawn in **two runs**, sections 01–10 on top and 11–19 below, with an "End of aisle A · Walk Path 2,270 →" cap after the last section. Ten sections × 96px plus the label column fill the 1044px panel. At 27px per bin, that is the limit: bins never shrink below 27px. When the viewport is narrower, the aisle rail collapses before the bins do (see EXPERIENCE.md, Responsive & Platform).

## Elevation & Depth

The interface is flat. Depth comes from **material**: paper surfaces on a paper ground, and bins sitting in a graphite wall. Hierarchy comes from tone, outline and type, not from shadow.

**The lifted bin is the one depth moment.** A bin with a recommended move is pulled out of its slot. It is drawn about 1.2× larger (33 × 34px), offset up and left, and casts the only content shadow in the product: `0 6px 10px rgba(0,0,0,0.45)`. The slot it left behind shows a dashed white outline. The shadow means exactly one thing: *this part is about to move*. It is never used on cards, buttons or panels.

**Overlays float, functionally.** Tooltips, the bin popover and menus use one soft ambient shadow, `0 8px 20px rgba(27,30,34,0.22)`, so they read as lying above the wall. They are temporary layers, not a hierarchy device, and never stack more than one deep.

Bins themselves have a printed-plastic shading: a 3.5px darker top lip (`rgba(0,0,0,0.22)`) and a 1.5px bottom line (`rgba(0,0,0,0.18)`). This shading is part of the bin graphic and is not elevation.

## Shapes

Corners are small and mechanical, like injection-moulded bins and pressed-steel shelving.

- `{rounded.xs}` 1px: the bin label window.
- `{rounded.sm}` 2px: bins, open slots, location chips, BEST tags.
- `{rounded.md}` 3px: best-location frames, rule tags, the round chip, the plan plate, the "no space" chip.
- `{rounded.DEFAULT}` 4px: launcher plates, hover notes, the selected segment.
- `{rounded.lg}` 6px: buttons, inputs, segmented controls, popovers, the wall panel.
- `{rounded.xl}` 8px: page panels and cards.
- `{rounded.full}`: only the numbered move markers, the flow-step discs and count pills, which are the round chips of the system.

**Glyphs carry the shape language of the classes**: triangle up, diamond, triangle down, slashed ring. They are drawn as filled SVG paths in `{colors.glyph}` (the ring as a 1.6px stroke), sized 9px inside a 27px bin and 8px in table swatches. UI icons are a separate set: outline paths at a consistent 1.6px stroke with round caps and joins. Neither set uses emoji or Unicode symbols.

## Components

Visual specs only. Behaviour lives in EXPERIENCE.md, Component Patterns.

**The bin system.**
- **Bin** (`{components.bin}`). A 27 × 29px plastic bin in its class colour, with a top lip and bottom line. A white **label window** (`{components.bin-label-window}`, 21 × 13px) holds the class glyph in ink. When a bin is drawn at about 56px or wider (the landing and the legend at large scale), the window also shows a three-letter code: FST, MED, SLW, DED. When a location holds **two parts**, the label window is split in two, with one glyph per half. The bin colour follows the part with the most picks [ASSUMPTION].
- **Open slot** (`{components.slot-empty}`). An empty location: a dark recess with a slat near the top and a base line. There is no bin in it. That shape difference, filled bin compared with an open recess, *is* the occupancy cue.
- **No location** (`{components.slot-none}`). A hatched recess where a section/level/position has no location in the Locations file.
- **Best location.** A 2px green frame (`{components.best-frame}`) around each best bin or slot, a 4px green rail (`{components.best-rail}`) under a best level, and a green **BEST** tag (`{components.best-tag}`, ink text) on the level label. On paper surfaces, the tag uses `{components.best-tag-on-light}` (white text on `#2C8A55`) or the word "best" in a table cell.
- **Lifted bin** (`{components.bin-lifted}`), **move arrow** (`{components.move-arrow}`), **move target** (`{components.move-target}`). The bin rises with the lift shadow. When its move is selected, it gets a 2px accent frame, a 3px accent arrow curving to the target slot, and a solid accent frame around the target. When not selected, the target is a dashed white outline with a plus glyph.
- **Move marker** (`{components.move-marker}`). A 17px round chip with the move's number in the list. Variants: *recommended* (white, ink ring), *selected* (accent fill), *manual* (ink fill, "M"), *applied* (ink fill, white check), *outdated* (white with a grey ring, dashed grey slot outline).
- **Legend** (`{components.legend}`). It sits under every wall and is always visible. In order: Fast-moving ▲ · Medium-moving ◆ · Slow-moving ▼ · Dead stock ⊘ · Empty (open slot) · **Best location (green frame, rail and BEST tag)** · 2 parts (split label). Each entry is a miniature of the real graphic and its glossary name. It is never a colour dot alone.

**Shell and navigation.**
- **App toolbar** (`{components.app-toolbar}`). Louvre-panel graphite, 64px. From left to right: the product mark (a medium-moving bin in miniature), the name "Smart Warehouse Planner" in Barlow 15px white, the plan plate, the flow bar, the launcher button (36px square, `{colors.flow-track}`, grid icon). In stage 2, the user's initials appear in a 34px accent disc.
- **Plan plate** (`{components.plan-plate}`). A white label, 214 × 42px, with a 6px accent bar on the left. It shows the plan name in `{typography.panel-title}`, "Data as of 2026-09-30 · round 1" in `{typography.meta}`, and a chevron.
- **Flow bar** (`{components.flow-bar}`, `{components.flow-step-current}`). Eight steps in a dark track: Overview, Parts, Locations, Pick groups, Best locations, Recommendations, Before/after, Move list. A done step shows an ink check on a light disc. Steps not reached show their number in a ring. The current step is a white pill with ink text and a ringed number.
- **Launcher** (`{components.launcher-plate}`, `{components.launcher-plate-stage2}`, `{components.you-are-here-tag}`). A full-height overlay panel on graphite. Plates hang from rails in rows, like bin labels on a shelf. Each plate has a 36px code (SAV, NEW, SET, OVR, PRT, LOC, GRP, BST, REC, B/A, MOV), a name, two lines of live counts, a step badge and an icon. The current plate has an accent frame and a "You are here" tag. Stage-2 plates are empty slots: dark, with a dashed outline, a lock icon and "Coming in stage 2".

**Controls.**
- **Buttons.** `{components.button-primary}` is ink fill with white text, used for one action per surface ("Run recommendations", "New Plan", "Apply" on the selected row). `{components.button-secondary}` is white with an ink outline ("Apply", "Apply all (15)"). `{components.button-tertiary}` is white with a border outline ("Reset…", "Undo last move", "Other location ▾", "Open as list"). `{components.button-link}` is underlined ink text ("Keep in place", "Before/after table"). `{components.button-disabled}` is a pale fill with grey text.
- **Segmented control** (`{components.segmented-control}`): Planning copy | Import, Wall | List, and Whole aisle | Level | Single location.
- **Tabs** (`{components.tab}`) with **count pills** (`{components.count-pill}`): All 19 · Rule 1 9 · Rule 2 6 · Rule 3 4 · No space 31 · Kept in place 3 · Outdated 1.
- **Input** (`{components.input}`): white, with a 1px border and a 2px accent border on focus. It contains a search icon and a placeholder in ink muted.

**Recommendations.**
- **Rule band** (`{components.rule-band}`). The 34px band starts with a rule tag (`{components.rule-tag}`, "Rule 1" in white Barlow on ink), then the rule name in body-strong ("Fast-moving parts into best locations"), then the ordering note on the right in caption ("Most picks first · best locations offered in location-code order").
- **Recommendation row** (`{components.recommendation-row}`). From left to right: rank "#1" (`{typography.rank}`) over "of 9", a 26 × 30px bin swatch, the part number and description, and the reason line. Then the from chip → to chip (`{components.location-chip}`) with captions under each ("not best", "best · level 1, aisle A"), and the actions on the right. *Selected* (`{components.recommendation-row-selected}`): tinted, ink outline, 5px accent bar. *Outdated* (`{components.recommendation-row-outdated}`): hatched, secondary ink, struck-through target code, a clock icon with "Outdated". *Applied*: an ink check with "Applied · move 3, round 1" over "In the planning copy". *No space*: the dark hatched **NO SPACE chip** (`{components.no-space-chip}`) in place of the to-chip.
- **Round chip** (`{components.round-chip}`). "Round 1" in a white chip with an ink outline and a 5px accent bar, next to the page title.

**Overlays.** The **tooltip** (`{components.tooltip}`) is the bin popover. It shows the location code in 20px Barlow, the BEST tag, "Occupied · 2 parts" on the right, the mark source and Walk Path, a hairline, then one line per part (bin swatch, part number, description, class · picks · stock), and a partner strip on the ground colour. The **hover note** (`{components.hover-note}`) is a two-line card for a move on the wall: "Rule 1 · 8044172 Oil filter - Toyota Corolla" / "33 picks (24 or more) · A-12-04-02 → A-14-02-01".

**Lists.**
- **Roster row** (`{components.roster-row}`). A ranked line: "#1", a miniature bin, part number, description, and a why-line ("61 picks · fast-moving · partner of 4410297").
- **Aisle card** (`{components.aisle-card}`). An aisle letter plate, a mini-wall (every location as a 2.9 × 5.5px bin or slot), "86.8%" in Barlow 15px, "198 of 228 · 30 empty", and the number of moves. The selected card is tinted with an ink outline.

**Import error** (`{components.import-error}`). A pale red panel with a 1px red border, a warning triangle, a bold first line "Import stopped: nothing was saved." and then the file · row · column sentence in ink. The failing file's upload tile gets a red outline and the same triangle. Files that passed show a check.

**Print move list** (`{components.print-move-list}`). Pure black on white, no tints. The header block shows the plan name in Barlow 14px, then the dates, then the generated time. Each round starts with a solid black band with white text ("Round 1 · one walk · from-location before to-location"). Each line has a 12px tick box, the part number, description, from-code and to-code in Barlow, and the rule. Lines are separated by 0.5px rules.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Draw every aisle as a shelf face: sections across, L1 at the bottom, every location a bin or an open slot | Draw the warehouse as a grid of coloured squares or a heat map |
| Pair every class colour with its glyph (▲ ◆ ▼ ⊘) and the glossary name in the legend | Show a movement class by colour alone, or invent a fifth class colour |
| Show occupancy by shape (bin compared with an open slot) and by text (occupied/empty, %, counts) | Colour locations red/green for occupied/empty, or use any colour scale for occupancy |
| Mark best locations with the green frame and rail **and** the BEST tag | Use green for applied, success, "done", "together" or anything other than best location |
| Use `#3DAE6B` for best on graphite and `#2C8A55` on paper | Put `#2C8A55` on the graphite wall (2.9:1, under the non-text floor) |
| Show applied as an ink check plus "Applied · move N" | Show applied with a green tick or a green row |
| Keep the lift shadow for the lifted bin only | Add drop shadows to cards, buttons, plates or panels |
| Use violet `accent` only as a frame, ring, arrow, bar or tag | Fill a bin with violet, write text in violet, or put text on a violet fill |
| Keep bins at ≥ 27px wide; collapse the aisle rail or scroll the wall panel first | Shrink bins until the glyph is unreadable |
| Write codes and counts in Barlow Semi Condensed with tabular numbers | Set location codes or part numbers in the body face, or with proportional digits |
| Print the move list in pure black on white, with round bands and tick boxes | Rely on bin colours, tints or greys in print |
| Show the data-as-of date on every plan surface | Draw distance lines, capacity bars, "metres saved" or anything implying live stock |
