# Epic 10 Context: See and mark the warehouse as a bin wall

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner sees each aisle as a graphite shelf wall, with sections across, levels up and every location a bin or an open slot, and can also see the whole warehouse at overview scale. The wall shows movement class, occupancy and best locations. Tooltips work by keyboard and mouse. Recommendations appear as lifted bins, and wall crops appear in the recommendation detail. From milestone 2, best locations are marked directly on the wall. The wall becomes the default Locations view and the Best locations marking tool, and the milestone 1 tables stay available as **Open as list**. The slice owns `domain/layout`, `domain/views/wall` and `modules/locations` (wall). The wall primitives (Bin, Slot, SlotNone, WallGrid/WallPanel, Key) go to `components/common` in the story that first reuses them. Epic 11 (Key colours) and Epic 12 (drag) build on this wall.

## Stories

- Story 10.1: Wall layout as an import-scoped domain view
- Story 10.2: Draw one aisle as a bin wall with its Key
- Story 10.3: Navigate the wall by keyboard and read its tooltips
- Story 10.4: See recommendations and moves on the wall
- Story 10.5: Wall crops in the recommendation detail
- Story 10.6: Whole warehouse view
- Story 10.7: Mark best locations on the wall

## Requirements & Constraints

- **The warehouse view:** all aisles are drawn by section and level, with one place per location.
  - Occupancy shows by shape plus text: a filled bin against an open slot, and "Occupied · N parts" or "Empty". It is never shown in red or green.
  - Colour is reserved for movement class and is always paired with a glyph: ▲ fast, ◆ medium, ▼ slow, slashed ring for dead.
  - Best locations get a green rail or frame plus the text BEST.
  - Occupancy shows per aisle and for the whole warehouse, as % and counts.
- **Planning copy:** the wall shows the planning copy and updates after every move, undo and reset. From a recommendation, the planner can see the part's current and suggested locations on the wall.
- **Marks on the wall:** the planner can mark and unmark a whole aisle, a level in all aisles, a level in one aisle, or a single location. A location covered by any mark is best. Marks live in the plan, never in the import.
- **No information by colour alone, and keyboard-complete:** every wall action has a keyboard path. The wall never claims capacity, distance or savings.
- **Key:** it sits under every wall and is always visible. It lists Fast-moving, Medium-moving, Slow-moving, Dead stock, Empty, Best location, Selected and 2 parts, in that order, each as a miniature of the real graphic with its glossary name and never a colour word. In this epic the entries are plain text, and Epic 11 makes six of them buttons.
- **Size limit:** the layout response for a generated max-size import (25,000 location rows) stays under 4 MB.
- **Tests:** they are named `test_fr42_*` (layout tests `test_fr42_layout_*`). They cover all three layout sources: the answer-key codes, the demo data with Section/Position, and a fixture with other code patterns. Story 10.7 adds a Playwright run of UJ-1 step 4 in Chromium, Firefox and Edge.

## Technical Decisions

- **The layout is a domain view.** `domain/layout.py` builds each aisle's logical cells (run, row, column, gap), the two-run split and the end cap Walk Path. It takes the layout from these sources, in order:
  1. the Section and Position columns;
  2. the code pattern `<aisle>-<section>-<level>-<position>`;
  3. one run per level in Walk Path order, without section labels.

  The first ⌈n/2⌉ sections form the top run. Empty positions become gap cells. Virtual locations are never on the wall. The frontend never parses location codes or derives cells. It owns only pixels, crops (N sections, or N positions in the fallback) and route lines between logical cells.
- **Ordering:** levels run top-down with L1 at the bottom. All-digit Level, Section and Position values sort numerically. Every other order comes from `domain/ordering.py`, using Python `str` code-point order. The frontend shows lists in server order.
- **Location references:** every view refers to a location as `LocationRef {code, aisle, level, section?, position?, is_best}`.
- **Import-scoped against plan-scoped data:**
  - `GET /api/imports/{import_id}/layout` is cached immutably under `['import', importId]` and never refetched after a command.
  - `GET /api/plans/{id}/wall?aisle=` is a plan view carrying `version` and built from one `replay`. It returns occupancy, parts (number, description, class, picks, stock, kept in place), the top part, best and its covering marks, and per-aisle counts.
  - After each command the client refetches every `['plan', planId]` query and renders only sets whose versions agree.
  - The frontend never computes occupancy, outdated status or move effects.
- **Purity and isolation:** `swp.domain` uses only stdlib and pydantic. A domain slice module imports only the domain kernel (`values`, `ordering`, `planning`, `state`, `commands`, `errors`, `views/common`) and never another slice module, and import-linter enforces this. A frontend module imports only `components/*` and `lib/*`, never another module (ESLint). Anything a second module needs moves to `components/common` or `lib` in the story that needs it, not in a later refactor.
- **Writes:** every change goes through `POST /api/plans/{id}/commands` via `lib/commands`. Marks use `set_best_mark` and `remove_best_mark`, and the drawer reuses `apply`, `apply_other_location` and `set_keep` from Epics 5 and 7. This epic adds no new write endpoint.
- **Recommendations on the wall:** they use the server `number` (numbered across the round) and the derived statuses applied, outdated and `moved_back`. The undo preview and outdated causes are worded only in `lib/copy`.
- **URL state:** `?aisle=&loc=&rec=&move=&part=` is built only by `lib/view-state`. The last aisle, the One aisle | Whole warehouse choice and other view choices persist per plan in localStorage (`swp:plan:<id>:view`, wrapped in try/catch).
- **Rendering choice:** SVG or DOM is open. DESIGN.md and EXPERIENCE.md govern the look, and the layout view governs the data. Tokens come in through CSS variables, so that Epic 11 can recolour classes later.

## UX & Interaction Patterns

- **Bin wall:**
  - The wall panel is graphite with a louvre pattern, beams and uprights. It has two runs and an end cap reading "End of aisle A · Walk Path 2,270".
  - A bin has its class colour, lip shading and a white label window with the glyph. Two parts get a split label. Three or more parts show the top part's glyph and a "+" tick. FST/MED/SLW/DED appear only at ≥56px.
  - An open slot is a dark recess with a rim, and a no-location cell is hatched.
  - Bins are at least 27px wide and scale to about 35px at 1440. The panel scrolls in 2D inside itself rather than shrinking bins further.
- **Best drawing:**
  - A level or whole-aisle mark gives a 4px green rail and a BEST tag on the level label. An aisle mark also tags the aisle tab and the aisle card.
  - A single mark gives a 2px green frame and "BEST n" on the level label. A location under a rail gets no frame.
  - The green is `#3DAE6B` on graphite and `#267A4B` on paper.
- **Locations chrome:**
  - A **One aisle | Whole warehouse** segmented control (a radio group with arrow keys). Aisle tabs A–I form a tab list showing the letter plate, % and moves, followed by the whole-warehouse figure.
  - The open-aisle header reads like "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270", followed by Open as list and Edit best-location marks.
  - The view opens on the last aisle or on A.
- **Keyboard grid:**
  - The wall is one `role="grid"` with exactly one tab stop. Runs are row groups, level labels are row headers and section numbers are column headers.
  - `←/→` move across sections. `↑/↓` move between levels and cross runs. Page Up/Down jump between runs. Home/End and Ctrl+Home/End jump to the ends. Gap cells are skipped.
  - The focused cell scrolls into view clear of the toolbar, notices and toasts.
  - A cell's accessible name is short, for example "A-07-01-02, level 1, best location, occupied, fast-moving", with the part lines as its `aria-describedby`.
- **Tooltip (WCAG 1.4.13):**
  - It opens on focus or after a 150 ms hover. `Esc` dismisses it without moving focus. It is hoverable, stays until focus or pointer leaves, opens above the run and is `aria-hidden`.
  - It shows the code, "Level N", BEST, occupied or empty, the mark sources, Walk Path, one line per part and a partner strip.
  - `Enter` or a click pins it as a non-modal dialog with these actions: a part line opens the PartPanel, Manual move… opens the ManualMoveDialog, and Show recommendation #n. `Esc` returns focus to the cell.
  - Search results and LocationChips open the wall at a location.
- **Moves:**
  - A lifted bin (33×34, the only content shadow) has a 17px numbered marker, and its vacated slot has a dashed outline. Targets are dashed with a plus glyph.
  - Markers: an applied move gets an ink disc with a check, a manual move gets "M", and an outdated one gets a grey dashed marker with no lift.
  - Only the selected move draws the cased violet arrow and the hover note. The note flips near the edges and never covers the from-bin or the target.
  - Selection is linked both ways between the list row, marker, bin and drawer row.
  - The lift takes ≤200 ms and is instant under reduced motion. A cell's name states its move in text and never uses `aria-selected`.
- **Drawer:** it reads "Moves touching aisle A · Round 1 · N moves · N to decide". Collapsed, it shows the selected move with Apply · Other location · Keep in place. "Show all N" opens the DataTable.
- **Crops:**
  - The From aisle crop (3 sections) sits over the To aisle crop at the same bin size, with "Rule 1 · round 1" between them.
  - Each crop is `role="img"` with a text name and adds no tab stops.
  - Show on the Locations wall opens the wall from the crop. Under the crops, "Moves in the planning copy" lists the last 3 moves.
  - Responsive: 2 sections at 1280–1439, stacked at 1024–1279, and 2D scroll below 1024.
- **Whole warehouse:**
  - Four figures (occupied %, empty, best with how many are empty, recommendations this round) above nine aisle cards in a 3×3 grid. The grid has 2 columns at 1024–1279 and 1 column below that.
  - The mini-walls are decorative (`aria-hidden`) and show no glyphs. Selecting a card opens that aisle.
  - The selected move is drawn as one route, which can cross aisles.
- **Marking on the wall:**
  - Modes are Whole aisle | Level (with "in this aisle | in all aisles") | Single location.
  - Hover or focus previews the mark ("Mark level 1 in aisle A"), and `Enter` or a click sets or removes it.
  - In Level mode the level labels are buttons and the hit area covers the whole level row (≥24px).
  - The marks list has ≥24px remove buttons, and the live counts read "174 best · 7 empty".
  - The toast reads "Best-location marks changed · N recommendations are now outdated", with View and no Undo.
  - No drag happens in this step.
- **Copy and focus:** English, sentence case, glossary terms verbatim, with no emoji and no exclamation marks. The focus ring is fixed: on graphite, a dark inner ring and a white outer ring.

## Cross-Story Dependencies

- Story 10.1's layout endpoint and `LocationRef` feed every later story. Story 10.2 builds the wall view endpoint and the shared wall primitives that Stories 10.5, 10.6 and 10.7 reuse, and that Epic 9's front page and Epics 11–12 may also use.
- Story 10.3's grid and tooltip are the base for the move markers in Story 10.4 and for marking in Story 10.7.
- Story 10.4 depends on the recommendations from Epic 5 and on Other location, keep in place and undo from Epic 7. Story 10.5 extends the detail panel in `modules/recommendations` from Epic 5.
- Story 10.7 reuses the mark commands and the outdated toast from Epic 3.
- The wall reuses the existing PartPanel, ManualMoveDialog, SearchField, DataTable and ClassGlyph from Epics 2–4, plus `lib/commands`, `lib/copy` and `lib/view-state`.
- Epic 11 turns the Key entries into colour buttons, and Epic 12 adds drag in One aisle only.
