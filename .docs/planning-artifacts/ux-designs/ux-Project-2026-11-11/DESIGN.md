---
name: Smart Warehouse Planner — Bin Wall
description: Desktop planning tool for re-slotting a spare-parts warehouse. Light paper ground, a graphite shelf wall, and bins coloured by movement class. Concept 05 "Bin Wall".
status: final
created: 2026-11-11
updated: 2026-11-14
sources:
  - ../../../../PRODUCT.md
  - ../../prds/prd-Project-2026-11-01/prd.md
  - ./.memlog.md
  - ./mockups/
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
  input-border: '#8A9097'
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
  slot-rim: '#8A9097'
  slot-none-stripe: '#646B72'
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
  class-fast: '#D85144'
  class-medium: '#F0B323'
  class-slow: '#417DDC'
  class-dead: '#8C939A'
  label-window: '#FFFFFF'
  glyph: '#1B1E22'
  # Meaning colours outside the class system
  accent: '#9466F0'
  best: '#3DAE6B'
  best-on-light: '#267A4B'
  # Focus: fixed, never changed by the Key colours
  focus-on-dark: '#FFFFFF'
  focus-on-dark-inner: '#141719'
  focus-on-light: '#1B1E22'
  focus-gap: '#FFFFFF'
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
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: '1.3'
  print-code:
    fontFamily: Barlow Semi Condensed
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1.2'
  print-round:
    fontFamily: Barlow Semi Condensed
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1'
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
  control-sm: 24px
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
    rim: '1px {colors.slot-rim} around the recess'
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
    frame: '2px {colors.accent} inside a 1.5px {colors.slot-empty} casing on both sides, radius {rounded.DEFAULT}, when selected'
    vacated-slot: '1.4px dashed {colors.surface}, dash 2 2, radius {rounded.md}'
  move-arrow:
    stroke: '{colors.accent}'
    stroke-width: 3px
    casing: '1.5px {colors.slot-empty} on both sides'
    linecap: round
  move-target:
    stroke: '{colors.surface} dashed 1.6px, dash 3 2.5 (pending) | {colors.accent} solid 2.2px inside a 1.5px {colors.slot-empty} casing (selected)'
    radius: '{rounded.md}'
    fill: 'rgba(255,255,255,0.16) when selected'
    glyph: 'plus, 13px, {colors.surface}'
  move-marker:
    size: '{spacing.marker-size}'
    radius: '{rounded.full}'
    typography: '{typography.marker}'
    recommended: 'fill {colors.surface}, 1.2px {colors.ink} ring, number in {colors.ink}'
    selected: 'fill {colors.surface}, 2px {colors.accent} ring, number in {colors.ink}'
    manual: 'fill {colors.ink}, 1.2px {colors.surface} ring, letter M in {colors.surface}'
    applied: 'fill {colors.ink}, 1.2px {colors.surface} ring, check glyph in {colors.surface}'
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
    radius: '{rounded.xl}'
    letter-plate: '30px square, white, 1.2px {colors.ink}, radius {rounded.sm}, letter in {typography.section-title}'
    mini-wall: 'background {colors.slot-empty}, radius {rounded.md}, bins 2.9px × 5.5px'
  app-toolbar:
    height: '{spacing.toolbar-height}'
    background: 'louvre pattern {colors.shell} with {colors.shell-slat} slats (11px × 3px, radius 1.5px, 18 × 12 tile)'
    bottom-edge: '1px {colors.shell-edge}'
    product-mark: 'a medium-moving bin in miniature in the fixed brand yellow #F0B323; it never follows a changed class colour'
    initials: 'stage 2 only: 34px {colors.ink} disc, initials in {colors.surface}'
  plan-plate:
    background: '{colors.surface}'
    radius: '{rounded.md}'
    height: 42px
    edge: '6px {colors.ink} bar on the left'
    title: '{typography.panel-title}'
    meta: '{typography.meta}'
  flow-bar:
    background: '{colors.flow-track}'
    border: '1px {colors.flow-track-edge}'
    radius: '{rounded.xl}'
    height: 38px
    step-label: '{typography.button}, weight 500, {colors.on-dark-nav}'
    step-number: '14px ring, 1.2px {colors.on-dark-muted}, number {typography.tag}'
    step-done: '14px disc {colors.on-dark-nav}, check glyph {colors.ink}'
  flow-step-current:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    radius: '{rounded.DEFAULT}'
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
    edge: '5px {colors.ink} bar on the left'
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
    border: '1.5px {colors.ink}'
    foreground: '{colors.ink}'
    radius: '{rounded.md}'
    typography: '{typography.meta}, 700'
  input:
    background: '{colors.surface}'
    border: '1px {colors.input-border}'
    focus: '{components.focus-ring.on-paper}'
    radius: '{rounded.lg}'
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
    entry-editable-hover: 'background {colors.selected-tint}, radius {rounded.DEFAULT}, 14px palette icon in {colors.ink-secondary} after the label'
    entry-editable-focus: '{components.focus-ring.on-paper}'
  colour-popover:
    background: '{colors.surface}'
    border: '1px {colors.border}'
    radius: '{rounded.lg}'
    shadow: '0 8px 20px rgba(27,30,34,0.22)'
    width: '264px'
    presets: '8 round swatches, 22px with a 24px hit area, in two rows of 4, from {components.colour-presets} for the entry being changed; 1px black at 18% edge; the current colour has a 2px {colors.ink} ring at 14.5px radius and a check'
    default-chip: 'right of the presets: Default label in {typography.meta}, a 16px swatch of the default and its hex in {typography.code}, {colors.ink-secondary}'
    hex-field: '{components.input}, 104px, with a 22px swatch button that opens the browser colour picker'
    warning: '{typography.caption}, {colors.ink}, warning-triangle icon, on {colors.error-tint}'
  print-move-list:
    paper: '{colors.print-paper}'
    ink: '{colors.print-ink}'
    round-band: 'no fill: bold ROUND 1 in {typography.print-round} inside a 1.5px {colors.print-ink} box, then the walk note in {typography.print-body}, with 2px {colors.print-ink} rules above and below the band'
    body: '{typography.print-body}'
    codes: '{typography.print-code}'
    tick-box: '14px square, 1.5px {colors.print-ink}'
    rule-line: '1px {colors.print-ink}'
  colour-presets:
    note: 'Eight shades of each entry own hue, lightest first; each passes that entry contrast check and is at least ΔE 22 from the other five defaults; the entry default is one of the eight'
    fast: '#DFB19A #DF9AA5 #E58C61 #DF7267 #D37382 #E4586E #DB6024 #D85144'
    medium: '#F7F083 #FAED0F #EBB98E #F0B323 #C7BE23 #FBA255 #D26304 #8B8419'
    slow: '#98C6E1 #5EB5E9 #98A3E1 #8A99EF #4C9AE6 #378CBE #677AEA #417DDC'
    dead: '#B8BFC1 #B3B5BD #A4A8AD #949C9E #8C939A #848890 #798386 #7C808D'
    best: '#9AE0A5 #A3D6C4 #73D483 #53CAA0 #3CC353 #3DAE6B #459B7D #309C42'
    selection: '#A280E5 #B45AF7 #9466F0 #7267E0 #6658EF #9516F3 #9034D5 #5747F6'
  toast:
    background: '{colors.ink}'
    foreground: '{colors.surface}'
    typography: '{typography.body}, weight 500'
    radius: '{rounded.lg}'
    size: 'up to 560px wide, 44px minimum height, 14px side padding'
    icon: '18px UI icon in {colors.on-dark} (check for applied, clock for outdated)'
    action: '{typography.button}, {colors.surface}, underlined, right-aligned'
    shadow: '0 8px 20px rgba(27,30,34,0.22)'
  button-destructive:
    background: '{colors.ink}'
    foreground: '{colors.surface}'
    radius: '{rounded.lg}'
    height: '{spacing.control-lg}'
    typography: '{typography.button}'
    note: 'same look as button-primary; the label names the loss (Delete plan, Reset plan); never red'
  input-error:
    background: '{colors.surface}'
    border: '1.5px {colors.error}'
    icon: '16px warning triangle in {colors.error}, 8px right of the field'
    message: '{typography.caption}, {colors.ink}, next to the icon or under the field'
  focus-ring:
    on-graphite: '2px {colors.focus-on-dark-inner} ring directly outside the element, then a 2px {colors.focus-on-dark} ring outside that; drawn above neighbouring bins'
    on-paper: '2px {colors.focus-gap} gap outside the element, then a 2px {colors.focus-on-light} ring'
---

## Brand & Style

Smart Warehouse Planner looks like the thing it plans. The planner sits in an office next to the warehouse floor, and every aisle on screen is drawn the way it looks from the floor: a graphite shelf face, sections across, levels L1–L4 up, and every location a bin. Bins are coloured plastic, like real picking bins. Empty locations are open dark slots with no bin in them. The interface does not offer an abstract grid of squares with a colour legend. It shows the shelf.

The posture is **industrial-plain**. There are two materials. The working surfaces are light paper (`{colors.ground}` and `{colors.surface}`) with near-black ink and condensed codes. The shelf hardware is graphite: the louvre-panel toolbar, the flow bar and the wall itself. The shelf world contributes type, palette, density and one signature move, **the lifted bin**. Everything else is standard, buildable web controls: buttons, tabs, tables, segmented controls. Nothing is dressed up as a costume.

Four things from concept 05 are fixed and must stay as drawn (memlog decision):

1. Each aisle is a **bin-wall elevation**: sections across, levels L1–L4 up, every location a bin, and an empty location shown as an open dark slot.
2. **Movement class is the bin colour plus a glyph** in a white label window: fast-moving red ▲, medium-moving yellow ◆, slow-moving blue ▼, dead stock grey slashed ring.
3. **The lifted bin** marks a recommended move. The bin is lifted out of its slot, an arrow runs to a dashed target slot, and a numbered marker matches the table row.
4. **The top flow bar** holds the plan plate (plan name, data-as-of date, round) and the 8 steps with check marks.

The voice is quiet and exact, like a parts catalogue. Every bin is a real location code and every move shows from, to and why. The visual system never claims more than the data supports: there are no distance lines, no capacity bars and no heat-map gradients.

Visual references (the spines win on any conflict with a mock): [warehouse layout](./mockups/warehouse-layout.svg) · [recommendations interface](./mockups/interface.svg) · [features menu](./mockups/features-menu.svg) · [screen map](./mockups/screen-map.svg) · [demo front page](./mockups/landing.svg) · [log in and create account](./mockups/login.svg) · [components sheet 1](./mockups/components-sheet.svg) · [components sheet 2](./mockups/components-sheet-2.svg) · [concept card](./.working/concepts/05-bin-wall/concept.md).

Mocks that have not been re-rendered since 2026-11-13 may still show these superseded details:
- a yellow frame and arrow for the selected move (now violet `{colors.accent}` with a dark casing);
- a colour-mode switch above the wall (removed);
- green for applied / done / together (now an ink check);
- "Open the demo" or "Open the app" on the front page (now Log in and Create account; the front page mock was redrawn 2026-11-14);
- the old red and blue class hexes;
- a violet plan-plate edge and violet input focus border (now ink and the fixed focus ring);
- `#2C8A55` for best on paper (now `#267A4B`, and "best" in table text is ink);
- presets that fail their own contrast check (presets now always pass).

## Colors

The palette has three layers: paper, graphite and meaning. Colour carries meaning only in the bin system and in a few named states, and every meaning also has a shape or a word. Light ground only; there is no dark mode in v1.

**Paper (working surfaces).**
- **Ground `#EEEDE8`** is the page background, a warm light grey suited to daylight and fluorescent office light. Cards and tables sit on **Surface `#FFFFFF`**.
- **Ink `#1B1E22`** is the text, the primary button fill and the strong outlines. It reaches 16.7:1 on white and 14.3:1 on the ground.
- **Ink secondary `#4A5058`** is for reasons, metadata and column heads (8.1:1 on white). **Ink muted `#6B717A`** is for placeholders only (4.9:1 on white). It is not used for text on hatched rows, where it drops to about 3.4:1.
- **Border `#D6D4CD`** outlines cards and tertiary buttons (a tertiary button is identified by its label, not its border). **Input border `#8A9097`** outlines every text and colour input, 3.2:1 on white, so an input's boundary is visible on its own. **Hairline `#E6E4DE`** divides rows. **Band `#E4E2DB`** is the rule header strip in the recommendations list.
- **Selected tint `#F3EFFD`** fills the selected row and the selected aisle card. It is derived from the selection colour (the chosen colour at about 10% on white, so the default is a pale violet). It carries no meaning on its own: the ink outline and the selection bar mark the row.

**Graphite (shelf hardware).**
- **Shell `#262A2E`** with **shell slat `#2F3439`** makes the louvre-panel toolbar. **Flow track `#16191C`** holds the 8 steps.
- **Wall `#30353A`** with **wall slat `#3A4046`** is the shelf face. **Beam `#1F2326`** runs under each level and **upright `#454B52`** starts each section.
- **Slot empty `#141719`** is an open slot: an empty location. Its **slot rim `#8A9097`** (1px, 3.8:1 on the wall) makes the recess readable against the wall face, which the dark recess alone is not (1.45:1). **Slot-none stripe `#646B72`**, hatched over the slot colour (3.3:1), marks a position where no location exists (aisle I has fewer locations than the others) and forms the background of the "no space" chip.
- Text on graphite uses **on-dark `#E3E6E9`** for level labels (9.9:1 on the wall), **on-dark secondary `#C9CED3`** for section numbers (7.8:1), **on-dark nav `#D5D9DD`** for flow-bar labels (12.4:1 on the track) and **on-dark muted `#9AA1A8`** for steps not yet reached (6.8:1).

**Meaning.**

| Token | Hex | Means | Paired cue | Never used for |
|---|---|---|---|---|
| `class-fast` | `#D85144` | fast-moving bin | ▲ glyph in the label window | errors on the wall, warnings, "occupied" |
| `class-medium` | `#F0B323` | medium-moving bin | ◆ glyph | selection |
| `class-slow` | `#417DDC` | slow-moving bin | ▼ glyph | links, information |
| `class-dead` | `#8C939A` | dead-stock bin | slashed-ring glyph | disabled controls |
| `best` | `#3DAE6B` | best location, on graphite | "BEST" tag on the level label, frame shape, rail | applied, success, "done" |
| `best-on-light` | `#267A4B` | best location, on paper | "BEST" tag (white text on it) or a mark next to the word "best" in ink | applied, success, "done", text colour |
| `accent` | `#9466F0` | selection: the selected move's frames, arrow and marker ring, the selected-row bar, the hover-note edge | a cased frame, a ring, an arrow or a bar, never a filled bin and never text | focus, movement class, best location, chrome |
| `focus-on-dark` / `focus-on-dark-inner`, `focus-on-light` / `focus-gap` | `#FFFFFF` / `#141719`, `#1B1E22` / `#FFFFFF` | keyboard focus (`{components.focus-ring}`) | a double ring of fixed shape | selection, anything the planner can recolour |
| `outdated` | `#8F969D` | outdated marker ring and slot outline | dashed line plus the word "Outdated" | — |
| `error` / `error-tint` | `#D33A2C` / `#FBE6E3` | import errors, and the background of colour warnings (FR-42) | warning triangle plus a sentence naming the file, row and column, or the colour and background | anything on the wall |

**Key colours: defaults the planner can change.** Six tokens are the defaults of the Key colours, which the planner changes only by clicking an entry in the wall's Key (PRD FR-42, behaviour in EXPERIENCE.md): `class-fast`, `class-medium`, `class-slow`, `class-dead`, `best` and `accent` (selection). A changed colour replaces the token everywhere it is drawn. Two tokens are derived: `best-on-light` follows a chosen `best` by darkening the same hue until white text on it reaches 4.5:1 and the colour itself reaches 3:1 on white, and `selected-tint` follows `accent`. **Reset this colour** restores that entry's default; for best location it also restores the fixed `best-on-light` default `#267A4B`. Every other token is fixed: **focus, inputs, the plan plate edge, the round chip and the "You are here" tag never use an editable colour**, and the glyphs, BEST tag and frame shapes never change, so meaning never rests on the chosen colours.

The contrast check (FR-42), run in the colour popover, measures each colour where it is actually drawn, and all defaults pass it:

| Colour | Checked against | Defaults |
|---|---|---|
| Each movement class | the wall face `{colors.wall}` and an open slot `{colors.slot-empty}` (the louvre slats are texture, not a background). On paper a swatch always has an ink outline, so white is not a checked pair. | fast 3.05 / 4.44 · medium 6.59 / 9.58 · slow 3.06 / 4.45 · dead 3.98 / 5.79 |
| `best` | the wall, an open slot, and ink text on it (BEST tag, needs 4.5:1) | 4.40 / 6.40 / 5.95 |
| `accent` | its dark casing `{colors.slot-empty}` on graphite, and white on paper | 4.65 / 3.88 |

A second check warns when two of the six colours are **too alike**: CIELAB ΔE (CIE76) below 20 between any two of them. The default pairs are at least ΔE 37 apart (slow-moving and selection are the closest).

**Best location is green.** The best-location frame, rail and BEST tag use green, and the "BEST" text stays, so the cue is never colour alone. On the graphite wall the shade is **`#3DAE6B`**: 4.4:1 on the wall, 6.4:1 on an open slot, 3.7:1 on a slat and 5.1:1 on the shell, and ink BEST text on it reaches 6.0:1. On white surfaces (the marking list, tables, popovers) best uses **`#267A4B`**: white BEST text on it reaches 5.3:1, and as a mark it is 5.3:1 on white and 4.5:1 on the ground. The word "best" in a table cell is set in ink, not green.

**Applied does not use green.** The applied state is an **ink check glyph plus the text "Applied · move N"**, in `{colors.ink}`. Flow-bar done steps show an ink check on an `{colors.on-dark-nav}` disc. On the wall, an applied marker is an ink disc with a white check. In pick groups, "same aisle" is written in ink with a link glyph.

**Colour is reserved for movement class.** Occupancy is never coloured. It shows by shape (a bin compared with an open slot) and by text (occupied / empty, counts and %), following the FR-42 rewrite. Red and green are never used as an occupied/empty pair.

**Selection has its own colour: violet `#9466F0`,** a hue that no movement class, best location or state uses. On the wall every selection frame and the arrow sit inside a **1.5px `{colors.slot-empty}` casing**, so the violet is read against the casing (4.65:1) wherever it crosses a slat or a bin, and the casing is at least 4.4:1 against every default bin. On paper violet is 3.9:1 on white and 3.3:1 on the ground. Violet is below 4.5:1 against both ink and white, so **violet never carries text and nothing is written on a violet fill**: the selected move marker is a white chip with a 2px violet ring and an ink number. Selection differs from best location by form as well as colour: a selected frame is cased and always comes with its numbered marker and arrow, while a best frame is a single uncased line with its rail or BEST tag.

**Focus is fixed and is not selection.** Keyboard focus uses `{components.focus-ring}`, which the planner cannot recolour. On graphite it is a 2px white ring outside a 2px `#141719` inner ring: white is 12.4:1 on the wall, 10.5:1 on a slat, 14.5:1 on the shell and 17.7:1 on the flow track, and the dark inner ring is at least 4.4:1 against every default bin, the best frame and the violet frame, and 18:1 against white controls. On paper it is a 2px ink ring with a 2px white gap: ink is 14.3:1 on the ground, 12.9:1 on the band and 14.8:1 on the selected tint. Focus is a halo of two rings; selection is a single cased violet line. The two never look alike.

Contrast for the load-bearing pairs: ink on the label window is 16.7:1, and the white label window is 12.4:1 on the wall. That makes the label window the strongest occupancy cue, so **a bin is never drawn without its label window**. Every default bin colour is ≥ 3:1 against both the wall face and an open slot (table above). The ink number on the white selected marker is 16.7:1. White on an ink button is 16.7:1. Medium-moving yellow on white is only 1.9:1, so **yellow is never text and never the only edge on white**; a class swatch on paper always sits inside a 1.2–1.5px ink outline.

## Typography

There are two families, both on Google Fonts:

- **Barlow Semi Condensed** (500/600/700) is the voice of the shelf label. It sets everything that is a *code or a count*: location codes, part numbers, aisle letters, level labels, ranks, markers, tags, page titles and the launcher plate codes. The condensed width lets `G-14-04-02` sit in a 92px chip and keeps the wall labels inside 27px bins. Fallback: `'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`.
- **Figtree** (400/500/600/700) is the reading voice: descriptions, reasons, buttons, tabs and table cells. Fallback: `'Helvetica Neue', Helvetica, Arial, sans-serif`.

All numbers are **tabular** (`font-variant-numeric: tabular-nums`) so picks, counts and Walk Path values line up in columns.

The ramp runs from `{typography.display-hero}` (66px, demo front page only, with `{typography.lead}` for its one-line summary) through `{typography.page-title}` (28px, one per screen: "Recommendations", "Locations") and `{typography.section-title}` (22px: "Aisle A", the whole-warehouse %) down to body at 13px. The smallest text is 11px (`{typography.tag}`, column heads, the BEST tag). Nothing goes below 11px on screen. The launcher plate code (`{typography.plate-code}`, 36px) is the only large, decorative use of type inside the app, and even there it is a real navigation code (OVR, PRT, LOC…).

A part is always written as **part number in Barlow 700 + description in Figtree**, for example **4410281** Brake pads, front - VW Golf. A reason line is always `{typography.reason}` in `{colors.ink-secondary}`, worded in numbers ("Fast-moving: 61 picks in the period (24 or more)"). No letter-spacing, no all-caps body text. All-caps appears only on short tags such as BEST and NO SPACE, and on the printed ROUND band.

Print uses its own sizes: `{typography.print-body}` (13.5px, about 10pt) for text and `{typography.print-code}` (16px bold, 12pt) for part numbers and location codes, because the colleague reads the list standing in an aisle.

## Layout & Spacing

The canvas is a desktop browser. Mocks are drawn at 1440 × 900. Fixed heights and widths in this file (rows, chips, plates, bands) are minimums: with user text-spacing overrides, chips and plates grow rather than truncate.

- **Shell:** the toolbar is `{spacing.toolbar-height}` (64px) and is always visible. Below it, the page has a 24px gutter (`{spacing.page-gutter}`), a page title row, then content panels at `{spacing.panel-gap}` (16px) apart with `{spacing.panel-padding}` (16px) inside.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24. Tight groupings (glyph to code, chip to caption) use 4–8. Panel padding and gaps use 16. Page edges use 24.
- **Control heights:** `{spacing.control-lg}` 36px for page-level actions, `{spacing.control-md}` 28px for row actions, `{spacing.control-sm}` 24px for actions inside a dense table row (the smallest target, WCAG 2.5.8).
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

An aisle of 19 sections is drawn in **two runs**, sections 01–10 on top and 11–19 below, with an "End of aisle A · Walk Path 2,270 →" cap after the last section. Ten sections × 96px plus the label column fill the 1044px panel. At 27px per bin, that is the limit: bins never shrink below 27px. When the viewport is narrower, the aisle rail collapses before the bins do. At 200% zoom or below about 1024 CSS px the page reflows into one column, and only the wall panel and wide data tables scroll in two dimensions (see EXPERIENCE.md, Responsive & Platform).

## Elevation & Depth

The interface is flat. Depth comes from **material**: paper surfaces on a paper ground, and bins sitting in a graphite wall. Hierarchy comes from tone, outline and type, not from shadow.

**The lifted bin is the one depth moment.** A bin with a recommended move is pulled out of its slot. It is drawn about 1.2× larger (33 × 34px), offset up and left, and casts the only content shadow in the product: `0 6px 10px rgba(0,0,0,0.45)`. The slot it left behind shows a dashed white outline. The shadow means exactly one thing: *this part is about to move*. It is never used on cards, buttons or panels.

**Overlays float, functionally.** Tooltips, the bin popover, the colour popover, menus, the hover note and toasts use one soft ambient shadow, the *overlay shadow* `0 8px 20px rgba(27,30,34,0.22)`, so they read as lying above the wall. They are temporary layers, not a hierarchy device, and never stack more than one deep.

Bins themselves have a printed-plastic shading: a 3.5px darker top lip (`rgba(0,0,0,0.22)`) and a 1.5px bottom line (`rgba(0,0,0,0.18)`). This shading is part of the bin graphic and is not elevation.

## Shapes

Corners are small and mechanical, like injection-moulded bins and pressed-steel shelving.

- `{rounded.xs}` 1px: the bin label window.
- `{rounded.sm}` 2px: bins, open slots, location chips, BEST tags.
- `{rounded.md}` 3px: best-location frames, rule tags, the round chip, the plan plate, the "no space" chip.
- `{rounded.DEFAULT}` 4px: launcher plates, hover notes, the selected segment, the current flow-step pill.
- `{rounded.lg}` 6px: buttons, inputs, segmented controls, tooltips and popovers (the colour popover included), the wall panel.
- `{rounded.xl}` 8px: page panels, cards (aisle cards included) and the flow-bar track.
- `{rounded.full}`: only the numbered move markers, the flow-step discs and count pills, which are the round chips of the system.

**Glyphs carry the shape language of the classes**: triangle up, diamond, triangle down, slashed ring. They are drawn as filled SVG paths in `{colors.glyph}` (the ring as a 1.6px stroke), sized 9px inside a 27px bin and 8px in table swatches. UI icons are a separate set: outline paths at a consistent 1.6px stroke with round caps and joins. The UI icon set is: search, grid (launcher), lock (stage 2), clock (outdated), pin (kept in place), palette (changeable colour), warning triangle, check, link (same aisle), chevron, plus and ×. Neither set uses emoji or Unicode symbols.

## Components

Visual specs only. Behaviour lives in EXPERIENCE.md, Component Patterns.

**The bin system.**
- **Bin** (`{components.bin}`). A 27 × 29px plastic bin in its class colour, with a top lip and bottom line. A white **label window** (`{components.bin-label-window}`, 21 × 13px) holds the class glyph in ink. When a bin is drawn at about 56px or wider (the demo front page and the legend at large scale), the window also shows a three-letter code: FST, MED, SLW, DED. When a location holds **two parts**, the label window is split in two, with one glyph per half. The bin colour follows the part with the most picks [ASSUMPTION].
- **Open slot** (`{components.slot-empty}`). An empty location: a dark recess with a 1px light rim, a slat near the top and a base line. There is no bin in it. That shape difference, filled bin compared with an open recess, *is* the occupancy cue.
- **No location** (`{components.slot-none}`). A hatched recess where a section/level/position has no location in the Locations file.
- **Best location.** Drawn by the kind of mark (FR-21): a **level mark** gives the level a 4px green rail (`{components.best-rail}`) and a green **BEST** tag (`{components.best-tag}`, ink text) on its level label; a **whole-aisle mark** gives every level of the aisle its rail and BEST tag, and adds a BEST tag to the aisle letter plate and the aisle card; a **single-location mark** draws a 2px green frame (`{components.best-frame}`) around that bin or slot, and its level label shows "BEST" with the count of single marks on that level ("BEST 2"). A location covered by a rail gets no frame. On paper surfaces, the tag uses `{components.best-tag-on-light}` (white text on `#267A4B`); in a table cell, "best" is written in ink.
- **Lifted bin** (`{components.bin-lifted}`), **move arrow** (`{components.move-arrow}`), **move target** (`{components.move-target}`). The bin rises with the lift shadow. When its move is selected, it gets a 2px accent frame, a 3px accent arrow curving to the target slot, and a solid accent frame around the target, each inside a 1.5px dark casing. When not selected, the target is a dashed white outline with a plus glyph.
- **Move marker** (`{components.move-marker}`). A 17px round chip with the move's number in the list. Variants: *recommended* (white, ink ring), *selected* (white, 2px accent ring, ink number), *manual* (ink fill, "M"), *applied* (ink fill, white check), *outdated* (white with a grey ring, dashed grey slot outline).
- **Legend** (`{components.legend}`). It sits under every wall and is always visible. In the UI it is labelled **Key**. In order: Fast-moving ▲ · Medium-moving ◆ · Slow-moving ▼ · Dead stock ⊘ · Empty (open slot) · **Best location (frame, rail, BEST tag)** · **Selected (cased frame and marker)** · 2 parts (split label). Labels never name a colour, because the colours can be changed. Each entry pairs a miniature of the real graphic, drawn in the current colours, with its glossary name. It is never a colour dot alone. The six entries whose colour can be changed (the four movement classes, best location and selected) are buttons: on hover they get the selected tint and a small palette icon, and on focus the fixed focus ring. Empty and 2 parts are plain text, not buttons.
- **Colour popover** (`{components.colour-popover}`). Clicking a colour entry in the Key opens it, anchored above the entry: a title with the entry's glyph ("Slow-moving ▼ colour"), eight preset shades of that entry's hue (`{components.colour-presets}`) with the current one ringed and checked, a Default chip with the default swatch and hex, the warning line (only when a check fails), the hex field with its picker button, and **Reset this colour** (tertiary) and **Done** (primary). → [components sheet 1](./mockups/components-sheet.svg), Key colour popover.

**Shell and navigation.**
- **App toolbar** (`{components.app-toolbar}`). Louvre-panel graphite, 64px. From left to right: the product mark (a medium-moving bin in miniature, in the fixed brand yellow; it does not follow a changed class colour), the name "Smart Warehouse Planner" in Barlow 15px white, the plan plate, the flow bar, the launcher button (36px square, `{colors.flow-track}`, grid icon). In stage 2, the user's initials appear in white on a 34px ink disc.
- **Plan plate** (`{components.plan-plate}`). A white label, 214 × 42px minimum, with a 6px ink bar on the left. It shows the plan name in `{typography.panel-title}`, "Data as of 2026-09-30 · round 1" in `{typography.meta}`, and a chevron.
- **Flow bar** (`{components.flow-bar}`, `{components.flow-step-current}`). Eight steps in a dark track: Overview, Parts, Locations, Pick groups, Best locations, Recommendations, Before/after, Move list. A done step shows an ink check on a light disc. Steps not reached show their number in a ring. The current step is a white pill with ink text and a ringed number.
- **Launcher** (`{components.launcher-plate}`, `{components.launcher-plate-stage2}`, `{components.you-are-here-tag}`). A full-height overlay panel on graphite. Plates hang from rails in rows, like bin labels on a shelf. Each plate has a 36px code (SAV, NEW, SET, OVR, PRT, LOC, GRP, BST, REC, B/A, MOV), a name, two lines of live counts, a step badge and an icon. The current plate has a 2px ink frame and a "You are here" tag (white, ink border). Stage-2 plates are empty slots: dark, with a dashed outline, a lock icon and "Coming in stage 2".

**Controls.**
- **Buttons.** `{components.button-primary}` is ink fill with white text, used for one action per surface ("Run recommendations", "New Plan", "Apply" on the selected row). `{components.button-secondary}` is white with an ink outline ("Apply", "Apply all (15)"). `{components.button-tertiary}` is white with a border outline ("Reset…", "Undo last move", "Other location ▾", "Open as list"). `{components.button-link}` is underlined ink text ("Keep in place", "Before/after table"). `{components.button-disabled}` is a pale fill with grey text.
- **Segmented control** (`{components.segmented-control}`): Planning copy | Import, Wall | List, and Whole aisle | Level | Single location.
- **Tabs** (`{components.tab}`) with **count pills** (`{components.count-pill}`): All 19 · Rule 1 9 · Rule 2 6 · Rule 3 4 · No space 31 · Kept in place 3 · Outdated 1.
- **Input** (`{components.input}`): white, with a 1px `{colors.input-border}` boundary (3.2:1 on white) and the paper focus ring on focus. It contains a search icon and a placeholder in ink muted.
- **Input error** (`{components.input-error}`): the boundary turns 1.5px `{colors.error}` (4.8:1 on white), and a warning triangle plus a sentence in ink names the problem ("This is the from-location. Choose another."). The icon and the sentence carry the error, so it is never colour alone. → [components sheet 2](./mockups/components-sheet-2.svg), Manual move.
- **Import error** (`{components.import-error}`). A pale red panel with a 1px red border, a warning triangle, a bold first line "Import stopped: nothing was saved." and then the file · row · column sentence in ink. The failing file's upload tile gets a red outline and the same triangle. Files that passed show a check.
- **Destructive button** (`{components.button-destructive}`): looks like the primary button (ink fill, white text) and appears only inside a confirm dialog or popover, next to **Cancel**, which has the default focus. The label names what is lost ("Delete plan", "Reset plan"). Red is never used for it, because red is a class colour on the wall.
- **Focus ring** (`{components.focus-ring}`). Fixed, never recoloured. On graphite (wall, toolbar, flow bar, launcher): a 2px dark inner ring and a 2px white outer ring, drawn outside the element and above its neighbours, so the 3px bin gap never limits it. On paper: a 2px white gap and a 2px ink ring.

**Recommendations.**
- **Rule band** (`{components.rule-band}`). The 34px band starts with a rule tag (`{components.rule-tag}`, "Rule 1" in white Barlow on ink), then the rule name in body-strong ("Fast-moving parts into best locations"), then the ordering note on the right in caption ("Most picks first · best locations offered in location-code order").
- **Recommendation row** (`{components.recommendation-row}`). From left to right: rank "#1" (`{typography.rank}`) over "of 9", a 26 × 30px bin swatch, the part number and description, and the reason line. Then the from chip → to chip (`{components.location-chip}`) with captions under each ("not best", "best · level 1, aisle A"), and the actions on the right. *Selected* (`{components.recommendation-row-selected}`): tinted, ink outline, 5px accent bar. *Outdated* (`{components.recommendation-row-outdated}`): hatched, secondary ink, struck-through target code, a clock icon with "Outdated". *Applied*: an ink check with "Applied · move 3, round 1" over "In the planning copy". *No space*: the dark hatched **NO SPACE chip** (`{components.no-space-chip}`) in place of the to-chip.
- **Round chip** (`{components.round-chip}`). "Round 1" in a white chip with an ink outline and a 5px ink bar, next to the page title.
- **Recommendation detail panel.** 400px on the right, `{colors.surface}`, `{rounded.xl}`; from-crop over to-crop at full bin size, each with an `{typography.panel-title}` caption, the rule and round between them in `{typography.meta}`.

**Overlays.**
- **Tooltip** (`{components.tooltip}`). The bin popover. It shows the location code in 20px Barlow, "Level 1", the BEST tag, "Occupied · 2 parts" on the right, the mark source and Walk Path, a hairline, then one line per part (bin swatch, part number, description, class · picks · stock), and a partner strip on the ground colour.
- **Hover note** (`{components.hover-note}`). A two-line card for a move on the wall: "Rule 1 · 8044172 Oil filter - Toyota Corolla" / "33 picks (24 or more) · A-12-04-02 → A-14-02-01".

**Lists.**
- **Roster row** (`{components.roster-row}`). A ranked line: "#1", a miniature bin, part number, description, and a why-line ("61 picks · fast-moving · partner of 4410297").
- **Aisle card** (`{components.aisle-card}`). An aisle letter plate, a mini-wall (every location as a 2.9 × 5.5px bin or slot), "86.8%" in Barlow 15px, "198 of 228 · 30 empty", and the number of moves. The selected card is tinted with an ink outline.
- **Whole-warehouse card.** An `{components.aisle-card}` without the letter plate: the total % in `{typography.section-title}`, then occupied, empty, best and empty-best counts in `{typography.meta}`.

**Supporting components.** Built from existing tokens; no new materials. Drawn at real size in [components sheet 1](./mockups/components-sheet.svg) (Key colour popover, the read-only Settings page, toasts, confirm popover and dialog) and [components sheet 2](./mockups/components-sheet-2.svg) (part panel, manual move with input errors, Other location list, saved-plans list); the spines win on conflict.
- **Toast** (`{components.toast}`). An ink strip up to 560 × 44px, bottom-left with a 24px offset: an 18px icon in `{colors.on-dark}`, white text in `{typography.body}` at weight 500, and at most one underlined action on the right ("Undo", "View"). → [components sheet 1](./mockups/components-sheet.svg).
- **Dialog and confirm popover** (Reset…, Delete…, Apply all). `{colors.surface}`, overlay shadow, 16–20px padding, buttons right-aligned with Cancel first. A dialog has `{rounded.xl}`, a 20px Barlow bold title (the `{typography.rank}` style) and sits over a `{colors.ink}` scrim at 45%; a popover has `{rounded.lg}`, a 1px `{colors.border}` edge, a pointer toward its trigger and a `{typography.body-strong}` question. Both → [components sheet 1](./mockups/components-sheet.svg).
- **Side panel** (part panel, → [components sheet 2](./mockups/components-sheet-2.svg)). 400px wide on the right, `{colors.surface}`, 1px `{colors.border}` on its left edge, no shadow, `{typography.section-title}` part number with the description in `{typography.body}`.
- **Listbox and menu** (Other location ▾, the plan plate menu, the row menu, manual-move autocomplete). `{colors.surface}`, 1px `{colors.border}`, `{rounded.lg}`, overlay shadow; rows `{spacing.control-md}` tall; the highlighted row has `{colors.selected-tint}` and an ink left bar; location codes in `{typography.code}`.
- **Drag on the wall** (FR-51). No new materials. The dragged bin is drawn as `{components.bin-lifted}`, since the lift shadow already means *this part is about to move*, and the slot it left shows the dashed white outline. The location under the pointer is framed like a selected `{components.move-target}`, with a plus glyph on an empty slot and ⇄ on an occupied one. Locations that cannot take a drop get no frame. The **drop dialog** is a popover (as below) anchored to the dropped-on location: checkbox rows `{spacing.control-md}` tall with glyph swatch, part number in `{typography.code}` and class · stock in `{typography.meta}`; Swap and Put together as `{components.button-secondary}`, Move as `{components.button-primary}`, Cancel as `{components.button-tertiary}`. The keep-in-place warning is a warning triangle and an ink sentence, without the red boundary of `{components.input-error}`. Not drawn yet.
- **Global notice** (Save failed, storage unavailable). A full-width strip under the toolbar, `{colors.surface}` with a 2px `{colors.ink}` bottom rule, a warning triangle and `{typography.body-strong}` text.
- **Data table** (saved plans, Moves touching aisle, before/after, Open as list, pick groups). `{colors.surface}`, rows `{spacing.table-row}` minimum, `{typography.column-head}` heads in `{colors.ink-secondary}`, `{colors.hairline}` dividers, codes in `{typography.code-table}`, numbers right-aligned and tabular. Before/after values show "Before → After" with the change in `{typography.body-strong}`.
- **Demo front page.** `{colors.ground}` page under the graphite header, which holds only the logo and name, a "How it works" link and a Log in button outlined in `{colors.on-dark}`. Hero: the headline in `{typography.display-hero}` and the one-line summary in `{typography.lead}`, with `{components.button-primary}` "Log in", `{components.button-secondary}` "Create account" and `{components.button-tertiary}` "Demo version" with a play glyph (FR-50); beside it, a short bin wall drawn at large scale (56px bins with FST/MED/SLW/DED) with one lifted bin, the accent arrow to a dashed best-location target, and a reason card. Below, "One part, start to finish": four `{colors.surface}` panels hung from a graphite rail, numbered 1–4, following one demo part from its export row, to its movement class, to Apply / Keep in place, to its line on the printed move list. No synthetic-data line, no README or demo-data links and no footer text (user decision 2026-11-14).
- **Log in and Create account.** The graphite header with only the logo and name, then a 380px `{colors.surface}` card centred on `{colors.ground}`, with a `{colors.border}` outline and `{rounded.lg}` corners. The title is in `{typography.page-title}`; labels sit above `{components.input}` fields 40px high, and a password field has an underlined "Show" `{components.button-link}` inside it. The submit is a full-width `{components.button-primary}`; the other page is an underlined link; Demo version is a full-width `{components.button-tertiary}` with a play glyph under an "or" rule. Wrong details show one pale-red panel like `{components.import-error}`; field errors use `{components.input-error}`. The user menu opens from the toolbar avatar as a white popover: "Logged in as", the username in Barlow bold, and a Log out row.

**Print move list** (`{components.print-move-list}`). Pure black on white, no tints, and nothing that depends on the browser printing backgrounds. The header block shows the plan name in Barlow 14pt bold, then "Data as of … · uploaded … · N rounds", then the generated time. Each round starts with a band that has no fill: **ROUND 1** in bold `{typography.print-round}` inside a 1.5px black box, followed by "one walk · from-location before to-location", with 2px black rules above and below. Each line has a 14px tick box, the round, the part number and the from- and to-codes in `{typography.print-code}`, the description and the rule in `{typography.print-body}`, and a blank Note space. A swap line adds "Swap 1/2" after the rule and the two codes joined by ↔ in `{typography.print-code}` under it (FR-51). Lines are separated by 1px rules. The print stylesheet may add `print-color-adjust: exact` (with the `-webkit-` prefix), but nothing relies on it.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Draw every aisle as a shelf face: sections across, L1 at the bottom, every location a bin or an open slot | Draw the warehouse as a grid of coloured squares or a heat map |
| Pair every class colour with its glyph (▲ ◆ ▼ ⊘) and the glossary name in the legend | Show a movement class by colour alone, or invent a fifth class colour |
| Show occupancy by shape (bin compared with an open slot) and by text (occupied/empty, %, counts) | Colour locations red/green for occupied/empty, or use any colour scale for occupancy |
| Mark best locations with the green frame or rail **and** the BEST tag | Use green for applied, success, "done", "same aisle" or anything other than best location |
| Use `#3DAE6B` for best on graphite and `#267A4B` on paper | Put the paper shade on the graphite wall (under the non-text floor) |
| Show applied as an ink check plus "Applied · move N" | Show applied with a green tick or a green row |
| Keep the lift shadow for the lifted bin only | Add drop shadows to cards, buttons, plates or panels |
| Use violet `accent` only for selection: a cased frame, a ring, an arrow or a bar | Fill a bin with violet, write text in violet, put text on a violet fill, or use it for focus or chrome |
| Draw keyboard focus with the fixed `{components.focus-ring}` | Let a recolourable token (selection, best, a class) draw focus |
| Keep bins at ≥ 27px wide; collapse the aisle rail or scroll the wall panel first | Shrink bins until the glyph is unreadable |
| Write codes and counts in Barlow Semi Condensed with tabular numbers | Set location codes or part numbers in the body face, or with proportional digits |
| Print the move list in pure black on white, with boxed ROUND bands, rules and tick boxes | Rely on bin colours, tints, greys or printed backgrounds |
| Show the data-as-of date on every plan surface | Draw distance lines, capacity bars, "metres saved" or anything implying live stock |
