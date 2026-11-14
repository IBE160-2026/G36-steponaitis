# Components sheet 2: three alternatives (2026-11-14)

All three cover the same content: the part panel, the Manual move dialog with its to-location states (error, virtual location, already holds the part, back to where it started), the FR-51 Swap or put together drop dialog with the kept-in-place warning, the Other location list (open and empty), and the saved-plans list with its row menu, the Delete dialog and the empty state. Everything is drawn at real size with synthetic data. All three are 1440 wide and taller than one screen (A 2539, B 2662, C 2690 px), because the components are at 1:1 and have room around them.

Built from `comp.py`, a shared component library that reuses `../../landing-redesign/defs.svgfrag` (fonts, glyphs, icons, louvre, overlay shadow). Regenerate with `python3 gen_A.py`, `gen_B.py`, `gen_C.py`.

Component changes, the same in all three, all within DESIGN.md:
- **Part panel:** the class is shown as the bin itself (colour, glyph and label window). Partner rows open the part, shown with a chevron instead of "Open" links. A "current" marker sits on the location row.
- **Manual move:** a "move strip" names the exact move (from-chip → to-chip · Manual · round 1) and fills only when the to-location is valid. The confirm button stays disabled while the field shows an error.
- **Drop dialog:** it names both parts ("Moving" and "Already here") and says in one line what Swap and Put together will each do, before the two buttons. The target on the wall gets the cased violet frame plus a swap icon chip.
- **Other location:** a filter field, a group header that names the rule, and the footer "Browsing applies nothing".
- **Saved plans:** each name cell has two lines (name, then round · moves), and the row menu button shows on hover and on focus.

## A: Specimen sheet (`A-specimen-sheet.svg`)
A classic spec sheet. It has a drawing title block, five numbered sections, and for each component numbered anatomy pins tied to a legend that names the part and its tokens (for example "section-title 22 · body 14"). The part panel also gets a 400 px dimension line. A works best as a teaching and hand-off document, because it says *why* each part is there. The trade-off is that it is the most text-heavy of the three, its sections are not the same height (there is empty space under the drop dialog), and it shows fewer states than C (no autocomplete, no part-panel variants).

## B: In the app (`B-in-context.svg`)
B follows the planner's path through three real-size app screens with the real graphite toolbar: Saved plans → Locations wall → Recommendations, numbered 1–3 like the front page's panels. The screen behind each component is faded, and the component stays crisp. Dialogs that would sit on a scrim are drawn beside their trigger, with a dashed leader from the control that opens them (Delete… → Delete dialog, Manual move… → dialog). B answers "where does this live and what opens it" better than any spec, and it is the closest to the front page the user liked. The trade-offs: it is the tallest sheet, the background screens are extra drawing to keep in sync with the spines, and showing several overlays at once is a sheet convention, not a real screen state (modals stack one deep).

## C: Storybook board (`C-storybook-states.svg`)
C gives one card per component *state*. Each card has the component name, an outlined state chip (READY, TYPING, ERROR, NOTE, WARNING, OPEN, EMPTY, CONFIRM, DISABLED, ON, HOVER), the component on a dotted canvas, and a footer that names the trigger and the FR. A dashed cut edge marks a slice that shows only the part that changes, such as kept in place, no stock, or the kept-in-place warning. C has the widest state coverage (it adds autocomplete, the part panel kept in place and with no stock, and a row hover), and each card maps one-to-one to a story or test in the build. The trade-off is less prose than A and no screen context like B, so you have to know the app to read it.

## Recommendation
**C.** A components sheet exists so the components can be built and checked state by state, and C is the only layout where every state has its own named place, with no explanatory text that can drift out of date. If you also want to see the components in place, the Locations-wall screen from B (step 2) works as a single context frame above C's cards.
