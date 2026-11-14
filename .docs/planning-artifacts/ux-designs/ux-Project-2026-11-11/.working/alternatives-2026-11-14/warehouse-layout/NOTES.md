# Warehouse layout (Locations view): three alternatives

Drawn 2026-11-14 to replace `mockups/warehouse-layout.svg`, which was too dense: a left list of nine mini-walls, a large wall, a colour popover, a tooltip and a table all on one 1440 × 900 screen. All three alternatives keep the fixed decisions:

- bin-wall elevations (L4 at the top, L1 at the bottom);
- class colour plus a glyph in a white label window;
- the lifted bin with an arrow to a dashed target and a numbered marker;
- the flow bar with the plan plate and the 8 steps, plus the avatar;
- the green rail or frame plus the BEST tag for best locations;
- violet only as a cased frame, ring or arrow;
- occupancy shown by shape plus text;
- a Key whose colour entries are clickable (palette icon).

Data is synthetic and matches the spines: aisle A 198 of 228, 117 best (3 empty), and the moves 1–4, M and ✓ from EXPERIENCE.md.

Generator: `gen_warehouse.py`. It reuses `../../landing-redesign/defs.svgfrag` and the `gen_landing.py` helpers. To regenerate, run `python3 gen_warehouse.py`.

## A: Aisle in focus (`A-aisle-in-focus.svg`)

The left aisle list becomes a row of nine aisle tabs (letter, %, moves) with the whole-warehouse figure at the end. The open aisle gets the full 1376px width, so all 19 sections still fit in two runs, and bins grow from 27 to 35px. The moves table moves into a bottom drawer. Collapsed, the drawer shows only the selected move with Apply, Other location and Keep in place; "Show all 7" opens it.

- **Gains:** it is the calmest version that still shows the whole aisle without scrolling, and it stays close to the spines' interaction model (grid, one arrow, the Key under the wall).
- **Costs:** you lose the mini-wall picture of the other aisles (tabs show only numbers), the full table is one click away, and the bins are still too small for the FST/MED codes, so they show the glyph only.

## B: Warehouse first (`B-warehouse-first.svg`)

Locations opens one zoom level higher. Four big numbers sit on top (79.2% occupied, 416 empty, 174 best, 19 recommendations). Below them, the nine aisles are 3 × 3 cards in walk order, each with its full bin wall at overview scale. The selected cross-aisle move (4410281, G-14-04-02 → A-02-01-01) is drawn as one route through the margin from the lifted bin in G to the framed target in A. "Whole warehouse | One aisle" switches zoom, and clicking a card opens that aisle's wall (as in A).

- **Gains:** it answers "where is there space, and where do things move?" at a glance, and it is the only option that shows cross-aisle moves as one picture.
- **Costs:** overview bins are pictures (colour and label window, no glyph), the same as today's mini-walls, so it takes a second step to act. It also adds a zoom level that EXPERIENCE.md ("no all-2,000-bins zoom in v1" [ASSUMPTION]) would have to accept. Routes need care when many moves are selected; only the selected move is drawn.

## C: Walk the aisle (`C-walk-the-aisle.svg`)

The aisle is one continuous run, like walking along it. Bins are drawn at front-page scale (52px, with FST/MED/SLW/DED codes), and the wall scrolls sideways. A whole-aisle scrubber above it shows all 19 sections, a frame for what is in view, and move ticks. The move table is replaced by an inline callout hung under the selected move: reason, from → to with BEST, Apply, Other location and Keep in place, a "Move 1 of 7" stepper, and "All 7 as a list". It also shows a drag in progress (FR-51): a slow-moving bin held over an occupied location with "Swap or put together", and the dashed outline left in its slot. The hovered Key entry shows "Change colour".

- **Gains:** it is the closest sibling of the front page, the most legible version, and the best drag targets. The reason sits next to the bin.
- **Costs:** only about 7 of 19 sections are visible, so the planner scrolls. The scrubber is a second picture of the same aisle. It breaks the spines' "two runs fit without scrolling" rule and complicates the keyboard grid (cells off screen).

## Recommendation

**A**, because it fixes the clutter without changing how the wall works. The changes are one aisle at a time, the full aisle without scrolling, the moves one click away, and the rail turned into tabs, and only DESIGN.md's Locations layout line (332px rail + 1044px wall + 246px table) needs rewriting. Two ideas from the others are worth adding:

- B's overview as the target of the "79.2% whole warehouse" tab, if the user wants the whole-warehouse picture;
- C's "Move 1 of 7" stepper inside A's collapsed drawer.
