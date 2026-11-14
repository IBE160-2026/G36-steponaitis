# Components sheet 1: three alternatives (2026-11-14)

They replace `mockups/components-sheet.svg` and cover the same scope: the Key and its colour popover, the read-only Settings page, toasts (Undo and View), the Apply all confirm popover, the Delete plan dialog, and buttons with their states. All three are 1440 wide and use the landing/login visual language: paper ground, Barlow headings, Figtree body text, real-size components and synthetic data. They are taller than 900 (A 2318, B 2381, C 2724) because everything is drawn at real size with room around it.

## A: Spec sheet (`A-spec-sheet.svg`)
A classic spec sheet. Each component sits alone on paper at real size, with numbered pins, red-brown measurement lines (264, 220, 44, 560 max, 456, 36) and a short parts list. The colour popover has its own "Checks" column (contrast, too alike, invalid hex, storage blocked). There is also a Key-entry state column and a ×3 detail of the focus ring on paper and on graphite. It is the most precise for building, but it shows least of *why* and *where*: the live preview on the wall is only described, not shown.

## B: In context (`B-in-context.svg`)
Each component is drawn at real size on the faded screen where it opens. The colour popover sits over a full 12-section aisle wall whose slow-moving bins really show the previewed shade, with the complete Key under it. Apply all opens on a faded Recommendations page and Delete plan over the scrim on Saved plans. The Undo toast appears at the bottom-left after an Apply, and Settings is shown inside the app shell. Short numbered "beats" explain the behaviour, and a final strip shows the button kinds and where each one was used. It reads like the front page the user chose ("follow one part"). The trade-off is that hover, pressed and disabled states appear only in the final strip, not per component.

## C: State matrix (`C-state-matrix.svg`)
A storybook built around states. A table runs controls down (Key entry, preset swatch, hex field, the five button kinds, the toast action) and states across (default, hover, focus, pressed/open, disabled, error). "—" marks a state that does not exist. Then the colour popover in four states for four different entries, the toast and confirm variants, and Settings at wide and narrow (<1024px) widths. It leaves out the fewest states and is the easiest to build and test from. It is also the least atmospheric and the longest sheet, and the wall context is missing.

## Recommendation
**B.** The Key colour popover only makes sense next to the wall it recolours, and B is the only option that shows this. B also matches the story-led layout of the front page the user picked. If the group wants build-ready states, add C's section 01 (Controls × states) to B as a second page instead of choosing C on its own.

## Changes to the components themselves (all within DESIGN.md unless marked)
- The Key shows all 8 entries, including **2 parts**, which the old sheet left out. It no longer fades out at the edge, where the old sheet half-hid Best location and Selected.
- The colour popover is drawn exactly to spec: 264 wide, 22px presets on a 30px pitch, Default chip, 104px hex field with a picker swatch, Reset this colour, Done and the pointer. The title shows the fixed cue for every entry: ▲ ◆ ▼ ⊘, the BEST tag for Best location, and the cased frame for Selected.
- Settings shows **movement class limits as one ruler** (0 · 1–5 · 6–23 · 24 or more, each drawn as its bin). There is a Read-only pill and a footer that says where values change. Colours appear nowhere on the page.
- The Delete plan dialog uses the EXPERIENCE.md copy for "Autumn re-slot". The old sheet said “Spring re-slot 2025”, which clashed with the 2026 plan.
- **[Proposed, not in DESIGN.md]** C adds hover and pressed colours: primary hover #363C42 and pressed #000; outlined buttons hover to `ground` and press to `band`. The hover swatch ring is 1.5px `ink-disabled`. The link hover underline is 2px. These need adding to DESIGN.md if C's states are adopted.

## Files
- `common.py`: shared real-size builders (bin, wall, Key, colour popover, toast, confirm popover, dialog, Settings, focus rings). It reads `../../landing-redesign/defs.svgfrag`.
- `gen_a.py`, `gen_b.py`, `gen_c.py`: run `python3 gen_x.py` from this folder to rewrite the matching SVG.
