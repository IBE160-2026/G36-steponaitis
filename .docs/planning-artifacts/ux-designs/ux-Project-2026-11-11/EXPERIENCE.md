---
name: Smart Warehouse Planner
status: draft
created: 2026-11-11
updated: 2026-11-13
sources:
  - ../../../../PRODUCT.md
  - ../../prds/prd-Project-2026-11-01/prd.md
  - ./.memlog.md
  - ./DESIGN.md
  - ./.working/concepts/05-bin-wall/
---

# Smart Warehouse Planner — Experience Spine

> Draft (fast path) from concept 05 "Bin Wall", the PRD and PRODUCT.md. Guesses are tagged [ASSUMPTION]. Decisions the user still has to make are under **Open Questions** at the end. Requirement numbers (FR-n, NFR-n, UJ-n) and glossary terms refer to the PRD and are used verbatim. This spine does not restate them. The spines win on any conflict with a mock.

## Foundation

- **Form factor:** a single-surface **desktop web app** in current Chrome, Edge and Firefox (NFR-9). There is no phone or handheld surface in v1. Output is **paper**: the move list is printed from the browser.
- **UI system:** none chosen yet. The stack is decided in the architecture step (PRODUCT.md, Stack). Controls are plain, buildable web controls: buttons, tabs, tables, segmented controls, a native `<dialog>`-style modal. Whatever library is picked, it must honour these behaviours and the tokens in `DESIGN.md`.
- **Visual identity:** `DESIGN.md` is the reference. This spine names its tokens and components by path, for example `{colors.best}` or `{components.bin}`.
- **Language:** the UI is in English (NFR-11). Copy uses the PRD glossary terms exactly: best location, pick group, partner, keep in place, "no space", round, data-as-of date, planning copy, move list, outdated recommendation.
- **Scope change carried here (decided 2026-11-13; the PRD is being updated in parallel):** the warehouse view (FR-42) moves into the core (milestone 2). It becomes the **Locations view** (aisle bin walls) and the **wall crops in the recommendation detail**. FR-42 is rewritten so occupancy shows by shape plus text, never red/green. Colour stays reserved for movement class.
- **Users in this spine:** the **planner** (in the PRD journeys this is Justas) and the **colleague**, who only meets the printed move list. Core has no login, so "created by" / "last edited by" show the fixed value `planner` (FR-11). Mocks that show "Justas" or a "JS" avatar show stage 2.

## Information Architecture

The saved-plans list is the start page (FR-8). Everything else lives inside an open plan, under the always-visible toolbar: plan plate · flow bar · launcher button.

| Surface | Reached from | Purpose | Flow step |
|---|---|---|---|
| Saved-plans list | App open; launcher **SAV**; plan plate menu | All plans: name, data-as-of date, created/edited by and at; New Plan; delete | — |
| New Plan | Saved-plans list "New Plan"; launcher **NEW** | Name, three files *or* "Or reuse the import of a saved plan"; import errors | — |
| Plan overview | Flow step 1; launcher **OVR**; after a successful import | Data-as-of and upload dates, period, settings, counts per movement class, best and empty counts, parts kept in place | 1 |
| Parts (ranked roster) | Flow step 2; **PRT**; search | Every part ranked by picks, filter by class, keep in place, open the part panel | 2 |
| Locations: **wall** (default) and list | Flow step 3; **LOC**; search; "Show on the Locations wall" | Nine aisle cards with occupancy; the open aisle as a bin wall; tooltip per location; "Open as list" gives the FR-14 table | 3 |
| Pick groups | Flow step 4; **GRP** | Pick groups sorted by shared jobs, both parts, aisles, together/apart | 4 |
| Best locations | Flow step 5; **BST**; "Edit best-location marks" on the wall | Mark and unmark on the wall (whole aisle / level / single location), with a list of marks | 5 |
| Recommendations | Flow step 6; **REC** | Run, tabs per rule, apply / other location / keep in place, no space, outdated, apply all, undo, reset; **recommendation detail** with the from and to wall crops | 6 |
| Before/after table | Flow step 7; **B/A**; "Before/after table" link | Per aisle and total: moves in and out, fast-moving in best locations, pick groups together | 7 |
| Move list print view | Flow step 8; **MOV** | Screen preview plus browser print; black and white | 8 |
| Settings | Launcher **SET**; plan overview; "Change colours" in the wall legend | Two parts. **Analysis settings**: read-only, the settings this plan was computed with (FR-18), changed in the config file, not in the app. **Warehouse colours**: editable in the app (FR-49), see Warehouse wall | — |
| Launcher (features menu) | Toolbar grid button; `G` then a code | All features as plates in flow order, the open plan, other saved plans, keyboard help | — |
| Part panel | Search result, roster row, tooltip part line, recommendation | One part: class and picks, locations and stock, pick groups and partners, keep in place, Manual move… | — [ASSUMPTION] |
| Manual move dialog | Part panel, location tooltip, list row action | From-location (if the part has several), to-location, confirm | — |

**Later (stage 2, after the milestone 2 gate), shown in the launcher as empty slots marked "Coming in stage 2":** login and create account (**ACC**), category settings and category check (**CAT**), location label print view (**LBL**). The concept's separate **WHV** "Warehouse view" plate is retired, because the warehouse view is now the core Locations wall.

**Demo front page (public deployment only).** The concept's [landing page](./.working/concepts/05-bin-wall/landing.svg) becomes the front page of the public demo deployment (NFR-5, user decision 2026-11-13). It says in one line what the tool does, shows the flow from import to the printed move list, states that the demo holds synthetic data only, and has one primary action, **Open the app**, which goes to the saved-plans list. It makes no claims about customers, savings or distances. A local install opens straight on the saved-plans list, which stays the app's start page (FR-8). There is no "Open the demo" shortcut: first-time users follow the README and upload the three files from `data/sample/` in New Plan (UJ-1, user decision 2026-11-13).

**Navigation model.** The flow bar is navigation, not a wizard. Any step can be opened at any time, and the check marks only report state. The launcher is the full map. The plan plate opens a small menu: switch to a recent plan, "All saved plans", "New Plan from this import" (FR-2) [ASSUMPTION]. Modals stack at most one deep.

→ Composition references: [recommendations interface](./.working/concepts/05-bin-wall/interface.svg) · [features menu](./.working/concepts/05-bin-wall/features-menu.svg) · [screen map of the other key screens](./.working/concepts/05-bin-wall/screen-map.svg). The spines win on conflict.

## Voice and Tone

Microcopy. The brand posture lives in `DESIGN.md`, Brand & Style. The voice is a careful colleague reading the shelf: short, exact, in numbers, glossary words only.

| Do | Don't |
|---|---|
| "Fast-moving: 61 picks in the period (24 or more)" | "High-velocity item" / "Hot part 🔥" |
| "Pick group with 7181839 (aisle D): 7 shared jobs (5 or more)" | "Frequently bought together" |
| "Import stopped: nothing was saved. transactions.xlsx · row 1,284 · column Date: “2026-13-02” is not a valid date. Fix the row and upload the file again." | "Something went wrong with your upload." |
| "No space · no empty best location" | "Error: allocation failed" |
| "Applied · move 3, round 1" | "Success! ✓ Moved" |
| "Outdated · A-11-02-02 was filled by a manual move." | "Stale" / "Invalid" |
| "Data as of 2026-09-30" on every plan surface | "Live stock", "real-time", "current inventory" |
| "Walk Path 0–2,270" (an ordering) | "2.3 km walk", "metres saved", "faster picking" |
| "The next run starts round 2 and uses the planning copy as it is then." | "Re-optimise!" |
| "Keep in place" (the glossary verb) | "Reject", "Dismiss", "Ignore" |
| "Coming in stage 2" | "Premium", "Upgrade", "Locked" |

Rules: sentence case. Numbers as digits with thousands separators. Dates as `YYYY-MM-DD` and times as `HH:MM` [ASSUMPTION]. No exclamation marks, no emoji, no praise. The tool suggests and never commands: "Recommended", not "Required". No company names anywhere, demo data only.

## Component Patterns

Behavioural rules. Visual specs are in `DESIGN.md`, Components.

| Component | Use | Behavioural rules |
|---|---|---|
| Plan plate `{components.plan-plate}` | Toolbar, every plan surface | Always shows the plan name, data-as-of date and current round ("round 0" before the first run). Click or `Enter` opens the plan menu. The upload date is in its tooltip and on the overview. |
| Flow bar `{components.flow-bar}` | Toolbar | Eight links. The current step is `aria-current="step"`. Check rules [ASSUMPTION]: steps 1–4 are checked once the plan exists (their data is computed on import). Best locations is checked when at least one best-location mark exists. Recommendations is checked when the latest run has no unapplied, non-outdated recommendation left. Before/after and Move list never get a check (they are outputs). The check is an ink glyph plus `aria-label` "done". |
| Launcher `{components.launcher-plate}` | Grid button or `G` | Opens over the current page, with focus in "Go to: type a code or a name". Typing filters plates and saved plans. `Enter` opens. `Esc` closes and returns focus to the grid button. Live counts on each plate come from the open plan. Stage-2 plates are announced as "Coming in stage 2" and are not activatable. |
| Bin `{components.bin}` / open slot `{components.slot-empty}` | Wall, recommendation crops, aisle mini-walls | One focusable cell per location on the open wall (see Warehouse wall). Mini-walls in aisle cards are decorative (`aria-hidden`). Their card carries the numbers as text. |
| Best-location frame and rail `{components.best-frame}`, `{components.best-rail}` | Wall | Always paired with the BEST tag on the level label (level marks) or in the tooltip (aisle and single marks). In marking mode the rail is a hit target: hover or focus shows "Mark level 1 in aisle A". |
| Lifted bin `{components.bin-lifted}` + marker `{components.move-marker}` | Wall, recommendation crops | Every recommendation of the latest run whose from-location is on the shown wall lifts its bin. Its number matches the row in the list. Selecting a marker, bin or row selects the move in both places. Only the **selected** move draws its arrow `{components.move-arrow}`. |
| Recommendation row `{components.recommendation-row}` | Recommendations | Click or `Enter` selects the row and fills the detail panel. Actions: **Apply** · **Other location ▾** · **Keep in place**. The selected row's Apply is primary, the others secondary. Outdated rows: Apply is disabled, with the reason shown (FR-29). Applied rows: no actions, shows "Applied · move N, round R". |
| Other location ▾ | Recommendation row | Opens a listbox of locations that pass FR-31 (empty now, empty at the run, fit the rule), in location-code order, each with aisle, level and best/not best. Typing filters. Choosing one applies immediately with the rule and round kept. An empty list says "No other location fits rule 1 right now." There is no free text; any other placement is a Manual move. |
| Keep in place (link) | Recommendation row, part panel, roster row | Sets the mark at once (FR-32). The row moves to the "Kept in place" tab, and a toast shows "4410281 is kept in place. Remove the mark from the part or the Kept in place tab." Removing is the same link, now reading "Remove keep in place". |
| Apply all (n) | Recommendations header | n = recommendations of the latest run that are neither applied nor outdated, minus no space and kept in place (FR-30). A confirm popover [ASSUMPTION]: "Apply 15 recommendations from round 1? Undo reverses them one move at a time." Disabled at n = 0. |
| Run recommendations | Recommendations header (primary) | Starts a new round (FR-23). While running (≤ 5 s, NFR-8): the button reads "Running…", is disabled, and the list is inert. Afterwards the round chip, tabs and counts update, and focus moves to the first row. Earlier unapplied recommendations and no-space entries are replaced. |
| Undo last move | Recommendations header, part panel | The tooltip names the move: "Undo move 3: 9723950 A-03-04-02 → A-05-01-03". It reverses the most recent move only (FR-35). Afterwards every unapplied recommendation of the latest run becomes outdated, and a notice says so. Disabled when there are no moves. |
| Reset… | Recommendations header | A confirm dialog (FR-35): "Reset removes all 18 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1." Buttons: **Reset plan** (primary) · **Cancel** (default focus). |
| Tabs + count pills `{components.tab}`, `{components.count-pill}` | Recommendations | All · Rule 1 · Rule 2 · Rule 3 · No space · Kept in place · Outdated. Counts are always visible, including 0. Arrow keys move between tabs. |
| Collapsed group | Recommendations, under each rule band | Shows the first 5 rows per rule, then "Show #6–#9 (4 more under rule 1)" [ASSUMPTION: 5]. No-space parts with the same rule and reason collapse into one line ("30 more like this"), which expands in place. |
| Recommendation detail | Recommendations, right panel | For the selected row: "Selected: #1 under rule 1", the part, a **From aisle** wall crop (the 3 sections around the from-location) and a **To aisle** crop, the arrow label "Rule 1 · round 1", "Effect if applied" (Now → After for the counts the before/after table uses) [ASSUMPTION], and "Moves in the planning copy" (the last 3, newest first, "Undo reverses move 3 first"). The link "Show on the Locations wall" opens the from-aisle with the move selected. |
| Segmented control `{components.segmented-control}` | Wall header, Locations, Best locations | Behaves as a radio group: arrow keys switch, and the selection persists per plan [ASSUMPTION]. |
| Location chip `{components.location-chip}` | Rows, tooltips, detail | Shows a location code. Activating it opens that location on the wall with its tooltip pinned. |
| Search field | Parts and Locations headers, wall header, launcher | One field matches part numbers, part descriptions and location codes (FR-15), partial text, case-insensitive. Results list parts and locations separately. A location result opens the wall at that bin. A part result opens the part panel and selects its current location on the wall. |
| Part panel | Side panel over Parts / Locations | Part number and description, class with glyph, picks and threshold, total stock, current location, other locations, pick groups (partner, shared jobs, aisle), keep in place toggle, "Manual move…". `Esc` closes. |
| Manual move dialog | Part panel, tooltip, list row | From-location (preselected when the part has one), a to-location field with autocomplete over the Locations file. It refuses the from-location and virtual locations with an inline reason (FR-33). It shows "to an occupied location: stock is added together" when the target already holds the part. Confirm creates the move with rule Manual and the current round. Then the FR-34 merge happens silently, and a toast says "Combined into one move: G-14-04-02 → A-02-01-01 (Manual)." |
| Roster row `{components.roster-row}` | Parts, Pick groups | Ranked by picks, with ties in part-number order. The why-line names class, picks and the most relevant fact (partner, current location, "in a best location"). FR-13 fields not on the line (total stock, other locations, number of pick groups, kept in place) appear as right-hand columns. Filter by movement class with glyph chips. |
| Aisle card `{components.aisle-card}` | Locations wall rail | Letter, mini-wall, occupancy %, "occupied of total · empty", moves touching the aisle. Selecting it opens that aisle's wall. The whole-warehouse card above shows the total %, occupied, empty, best and empty best. |
| Toast | Global, bottom-left | One at a time, 6 s, with an Undo action only where undo is the very next move [ASSUMPTION]. Announced via `aria-live="polite"`. |
| Import error `{components.import-error}` | New Plan | Lists errors (see State Patterns). The failing file's tile is marked. Passed files stay selected, so only the failing one is re-uploaded [ASSUMPTION]. |
| Saved-plans row | Saved-plans list | Click opens the plan as it was left (FR-9). The row menu has Delete… (confirm, FR-12) and "New Plan from this import" (FR-2). |
| Buttons `{components.button-primary}`, `{components.button-secondary}`, `{components.button-tertiary}`, `{components.button-link}`, `{components.button-disabled}` | Everywhere | At most one primary per surface (Run recommendations, New Plan, Print, or Apply on the selected row). Secondary for repeatable commits (Apply, Apply all). Tertiary for reversible or navigational actions (Undo last move, Reset…, Open as list, Other location ▾). Link for low-commitment verbs (Keep in place, Before/after table). A disabled button keeps its label and gets a tooltip with the reason ("No moves to undo"). Labels end with "…" when a dialog follows. |
| Rule band `{components.rule-band}` + rule tag `{components.rule-tag}` | Recommendations | Not interactive. It names the rule and its ordering rule, so the list order is explained (Explain every number). The All tab shows bands in rule order 1, 2, 3. A rule tab shows only its band. |
| Round chip `{components.round-chip}` | Recommendations header | Shows the current round ("Round 0" before the first run). Next to it, one line: "Run 2026-11-11 09:42 by planner · 19 recommendations · 31 no space" and "The next run starts round 2 and uses the planning copy as it is then." |
| NO SPACE chip `{components.no-space-chip}` | Recommendations, No space tab | Takes the to-chip's place and is not focusable on its own. The row's accessible name includes "no space" and the cause. |
| Selected / outdated row `{components.recommendation-row-selected}`, `{components.recommendation-row-outdated}` | Recommendations | One selected row per list, kept when switching tabs if the row is visible. An outdated row stays in place (it is not hidden) until the next run, so the planner can see what changed. |
| Move target `{components.move-target}` | Wall | A dashed target is focusable as its location cell. Its tooltip adds "Recommendation 2 arrives here from G-14-04-02". |
| Hover note `{components.hover-note}` | Wall | Shown for the selected move only, next to its arrow. It never covers the from-bin or the target, and flips side near the wall edge. |
| BEST tag `{components.best-tag}`, `{components.best-tag-on-light}` | Wall level labels, tooltip, tables | Text, not a control. In Best locations marking mode the level label with its tag is part of the rail's hit target. |
| Bin label window `{components.bin-label-window}` + glyph `{components.class-glyph}` | Bins, swatches | Decorative to assistive tech: the class is in the cell's accessible name. The glyph never changes meaning. |
| Input `{components.input}` | Search, plan name, launcher | `Enter` submits, `Esc` clears and then blurs. The plan name is required: "Give the plan a name." inline under the field. Plan names need not be unique [ASSUMPTION]. |
| Wall panel `{components.wall-panel}` | Locations, Best locations | Scrolls horizontally inside itself when the viewport is narrower than the wall; the page never shrinks bins. |
| Toolbar, current step, stage-2 plates, "You are here" `{components.app-toolbar}`, `{components.flow-step-current}`, `{components.launcher-plate-stage2}`, `{components.you-are-here-tag}` | Shell, launcher | The toolbar never scrolls away. The current-step pill is the flow link for the open page. "You are here" marks the launcher plate of the open page. Stage-2 plates are listed but inert, with `aria-disabled="true"`. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| No plans yet | Saved-plans list | "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions." **New Plan** (primary). The README demo files are named: "Demo files: data/sample/". |
| Import running | New Plan | A step list, not a percentage: "Reading Locations.xlsx ✓ · Checking columns ✓ · Checking values… · Counting picks · Finding pick groups". Under 10 s on the demo data (NFR-8). Cancel is allowed and saves nothing. |
| Import error: missing column | New Plan | "Import stopped: nothing was saved. Inventory.xlsx is missing the column Quantity. Required: Part, Part Description, Quantity, Location." (FR-3) |
| Import error: invalid value | New Plan | "Import stopped: nothing was saved." followed by "transactions.xlsx · row 1,284 · column Date: “2026-13-02” is not a valid date. Fix the row and upload the file again." All errors in the failing file are listed by row, up to 20, then "and 37 more in this file" [ASSUMPTION]. (FR-4) |
| Import error: unknown location | New Plan | "Inventory.xlsx · row 512 · column Location: “K-01-01-01” is not in the Locations file." (FR-5) |
| Import error: unreadable / two warehouses | New Plan | "Inventory.pdf can't be read as .xlsx or .csv." / "Locations.xlsx holds more than one warehouse. One import holds one warehouse." (FR-4, FR-6) |
| Import passed | → Plan overview | The plan opens on the overview with a toast: "Spring re-slot 2026 created. Data as of 2026-09-30." |
| Saving | Plan plate tooltip, launcher open-plan card | "Saved automatically" after every change (FR-10). There is no Save button. |
| Save failed | Global notice under the toolbar | "The last change was not saved. It is still on screen; trying again." Retries automatically. Edits stay possible [ASSUMPTION]. |
| Empty plan: no best locations | Best locations; Recommendations | "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations." On Recommendations: "Rule 1 and rule 2 need best locations. Rule 3 runs without them." Run stays enabled. |
| Empty plan: no run yet | Recommendations | Round chip "Round 0". "No run yet. Run recommendations to start round 1 on the planning copy as it is now." |
| Loading a run | Recommendations | See "Run recommendations" in Component Patterns. The list keeps its old content, dimmed and inert, until the new round replaces it. |
| No moves found | Recommendations after a run | "Round 3 found no recommendations and no "no space" parts. The rules have nothing more to suggest for these best-location marks." Undo, Reset and the move list stay available. |
| No space | Recommendations row, "No space" tab | The NO SPACE chip replaces the to-chip, with the rule's reason in numbers (FR-28) and a plain cause: "no empty best location" (rule 1), "no empty location outside best locations" (rule 2), "no empty location in aisle D outside best locations" (rule 3). No actions apart from Keep in place and opening the part. |
| Outdated | Recommendations row, wall marker | Hatched row, struck-through target, "Outdated" with a clock icon and the cause from FR-29: "A-11-02-02 was filled by a manual move." / "4410281 has been moved." / "The best-location marks changed." / "Outdated after undo." Apply disabled until the next run. On the wall: the grey dashed marker, no lift. |
| Keep in place | Row, roster, tooltip, overview | The row goes to "Kept in place" with "Kept in place · Remove". In roster and tooltip: a pin glyph with "kept in place" text. The overview shows the count. |
| Applied | Row, wall | An ink check with "Applied · move 3, round 1" / "In the planning copy". On the wall the bin sits in its new slot with an applied marker (ink disc and white check) for the current round [ASSUMPTION]. |
| Undo done | Recommendations, wall | A toast: "Undid move 3. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue." |
| Reset done | Recommendations | A toast: "Plan reset. 18 moves removed; marks kept. The next run is round 1." |
| No moves to print | Move list | "There are no moves to print." (FR-38) Print is disabled. A link goes to Recommendations. |
| Before = after | Before/after table | The table renders with equal values and the note "No moves yet: before and after are the same." |
| No pick groups | Pick groups | "No pick groups: no two parts share 5 or more jobs in the period." |
| Search: no match | Search field | "No part or location matches “xyz”." |
| Kept/Outdated/No space tab empty | Recommendations | "Nothing kept in place." / "No outdated recommendations." / "No "no space" parts in this run." |
| Focus | All | A visible 2px `{colors.accent}` ring plus a 1px `{colors.ink}` inner ring, so the ring reads on paper and on graphite [ASSUMPTION]. |
| Stage 2: plan changed by someone else | Any plan surface | FR-41 warning: "Someone saved this plan after you opened it. Reload it, or keep going and your version replaces theirs." Not in core. |

## Interaction Primitives

**Keyboard-complete (NFR-10).** Every action has a keyboard path. The mouse is never required.

- `Tab` / `Shift+Tab` follow reading order: toolbar → page header actions → main content → side panel.
- `G` opens the launcher. `G` followed by a plate code (`G REC`, `G MOV`, `G LOC`…) jumps directly. `/` focuses the page's search field. `Esc` closes the topmost popover, dialog, panel or launcher, in that order.
- Lists (recommendations, roster, pick groups, saved plans) are single-tab-stop lists. `↑`/`↓` move between rows, `Enter` selects or opens, and row actions are reached with `Tab` inside the selected row.
- In Recommendations, shortcuts work on the selected row [ASSUMPTION]: `A` Apply, `O` Other location, `K` Keep in place. Shortcuts are listed in the launcher's Keyboard box, and none fires while a text field has focus.
- Destructive actions (Delete…, Reset…) always open a confirm dialog with **Cancel** focused.

**Selecting a bin on the wall.** The open wall is one composite widget (`role="grid"`, rows = levels from L4 down to L1 within each run, cells = positions). Exactly one cell is in the tab order.

- `←`/`→` move one position, crossing section boundaries. `↑`/`↓` move one level. `Page Up`/`Page Down` jump between the top run (sections 01–10) and the bottom run (11–19). `Home`/`End` go to the first or last location of the level.
- Focusing a cell shows its tooltip (the same content as hover), so **every tooltip is reachable by keyboard**. `Enter` pins the tooltip as a popover with actionable content (part lines open the part panel, "Manual move…", "Show recommendation #1"). `Esc` unpins and returns focus to the cell.
- Each cell's accessible name is complete in text: "A-07-01-02, best location, occupied, 2 parts: 4410297 fast-moving 38 picks; 4410298 medium-moving 14 picks. Recommendation 2 arrives here."
- Mouse: hover shows the tooltip after 150 ms [ASSUMPTION]. Click pins it. Clicking a lifted bin or a marker selects that move.

**Markers link both ways.** Selecting a move anywhere (row, marker, lifted bin, "Moves touching aisle A" table) selects it everywhere, scrolls the other view into place and draws its arrow.

**Banned:** drag and drop as the only way to move a part (a keyboard path always exists; drag to move is not planned in v1 [ASSUMPTION]), hover-only information, auto-advancing steps, infinite scroll, modal stacks deeper than one, and any animation longer than 200 ms apart from the bin lift (see Accessibility Floor).

## Warehouse wall

The Locations view and the recommendation detail. It realises FR-14 and the rewritten FR-42, plus FR-22 on the wall. → [warehouse layout mock](./.working/concepts/05-bin-wall/warehouse-layout.svg)

**Overview of 9 aisles.** The left rail lists aisles in walk order A → I ("Walk order A → I"). At the top is the whole-warehouse card: occupancy %, "1,584 of 2,000 locations · 416 empty", "174 best locations · 7 of them empty" (FR-14, FR-22). Each aisle card shows its mini-wall, %, "occupied of total · empty" and the moves that touch it. Opening the Locations view shows the aisle last opened in this plan, or aisle A [ASSUMPTION].

**Open aisle.** The header shows the aisle letter plate, "Aisle A", and the text line "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270". On the right: **Open as list** (the FR-14 table filtered to this aisle, with filters for aisle / occupied-empty / best) and **Edit best-location marks** (switches to the Best locations step with this aisle open). The page header holds **Planning copy | Import** [ASSUMPTION: Import shows the frozen import, read-only, with no markers and no actions] and the search field.

**Layout rules.**
- One wall per aisle (Aisle column). Levels come from the Level column, with the highest level on top and L1 at the bottom, like the real shelf.
- Locations are placed left to right in Walk Path order within their aisle and level. Section and position numbers are read from the location code when it matches `<aisle>-<section>-<level>-<position>`. [ASSUMPTION] When codes follow another pattern (FR-6 allows several), locations are drawn as one continuous run per level without section labels. See Open Questions.
- **Sections are split into two runs**: the first ⌈n/2⌉ sections on top (01–10 of 19) and the rest below (11–19), each run with its own level labels. An end cap closes the aisle: "End of aisle A · Walk Path 2,270 →".
- Positions with no location in the file are hatched `{components.slot-none}` and are not focusable.
- The **legend** is always visible under the wall.

**Warehouse colours (FR-49).** The planner can change the wall's colours under Settings → **Warehouse colours**, also reached from a "Change colours" link in the wall legend. The page lists six rows: fast-moving, medium-moving, slow-moving, dead stock, best location and selection. Each row shows its fixed glyph or cue (▲, ◆, ▼, slashed ring, the BEST tag, the selection frame), a colour input (hex field plus the browser's colour picker), and a live preview: a strip of the bin wall with an open slot, a best-location rail and a selected bin, drawn with the chosen colours. Changes apply at once to every wall, mini-wall, wall crop and class swatch; the printed move list stays black and white. When a colour falls below 3:1 against a background it is drawn on (the graphite wall, an open slot or white), the row shows a warning naming the pair, for example "Slow-moving on an open slot: 2.4:1 (3:1 or more recommended)", and the planner can keep it anyway. **Reset to defaults** restores the DESIGN.md defaults after a confirm popover. For best location the planner picks the wall shade; the paper shade is derived by darkening the same hue until it reaches 3:1 on white [ASSUMPTION]. The choice is stored in the browser, survives a reload, and changes no plan or import. All controls are keyboard reachable, and every colour input has a visible label ("Fast-moving colour").

**No "Colour by" switch.** The wall always shows movement class: bins in class colours with glyphs. The concept's "Colour by" control is removed (user decision 2026-11-13), because the FR-42 rewrite drops red/green occupancy and occupancy is already readable by shape (bin against open slot) and by the text counts.

**Best-location marking on the wall.** Best locations get the green frame `{components.best-frame}`. A level marked in this aisle or in all aisles gets the green rail under it and a **BEST** tag on its level label. The tooltip names the mark that makes it best ("Level 1 in aisle A (best-location mark)"). If several marks cover it, all are listed. In the Best locations step the wall becomes the marking tool. **Whole aisle | Level | Single location** sets the mode. In Level mode a scope toggle "in this aisle | in all aisles" covers FR-21 [ASSUMPTION]. Hovering or focusing a rail or bin previews the mark ("Mark level 1 in aisle A"), and `Enter` or click sets it. Marks are listed beside the wall with remove buttons ("×", labelled "Remove mark Level 1 in aisle A"). "174 best · 7 empty" updates live. Changing marks makes affected recommendations outdated (FR-29) and says so in a toast.

**Moves on the wall.** Every recommendation of the latest run whose from-location is on this wall shows a **lifted bin** with its numbered marker. Targets on this wall show as dashed slots with a plus glyph and the same number. A move from another aisle into this one shows only its target, with the tooltip "From G-14-04-02 (aisle G)". Applied moves of the current round show applied markers. Manual moves show "M". Outdated ones show the grey dashed marker and no lift. **Only the selected move** draws the accent arrow and the hover note ("Rule 1 · 8044172 Oil filter - Toyota Corolla / 33 picks (24 or more) · A-12-04-02 → A-14-02-01"). This keeps the wall readable when a round has many moves. Below the wall, **"Moves touching aisle A · round 1"** lists the same moves with matching numbers, Rule, Part, Class · picks, From, To, Status and Action (Apply / Keep in place), plus "Open round 1".

**Selection and tooltip.** As in Interaction Primitives. The tooltip content is the location code, BEST tag, "Occupied · 2 parts" or "Empty", the mark source, Walk Path, one line per part (glyph swatch, part number, description, class · picks · stock), and a partner strip when a partner is relevant ("Partner 4410281 · 14 shared jobs · arrives with move 2"). It never shows capacity or distance.

**Density limits.**
- Bins stay **≥ 27px wide** (DESIGN.md, Layout & Spacing). At 27px the label window holds the glyph only. The three-letter code (FST/MED/SLW/DED) appears only at about 56px or wider.
- Two parts in a location get a split label. Three or more show the glyph of the part with the most picks plus a small "+" tick, and the full list is in the tooltip [ASSUMPTION].
- One aisle is open at a time. The aisle cards are overview only. There is no "all 2,000 bins at once" zoom in v1 [ASSUMPTION].
- One arrow at a time.

**Recommendation detail crops.** These are the same wall at the same bin size, cropped to the three sections around the from-location and the to-location, stacked "From aisle G" over "To aisle A" with the rule and round between them. A cross-aisle move needs no long arrow: the crops are the arrow.

## Move list print

Realises FR-38 and UJ-2. The reader is the colleague, who has never seen the app. → [screen map, Move list panel](./.working/concepts/05-bin-wall/screen-map.svg)

- **Screen view:** a paper preview of the list with a toolbar holding **Print** (primary) and "Back to Recommendations". The toolbar and the app shell are hidden in print (`@media print`).
- **Paper:** A4 portrait [ASSUMPTION]. Pure black on white `{components.print-move-list}`. No colour, no tints, no bin swatches. Legible on a black-and-white office printer.
- **Header (every page):** "Move list · Spring re-slot 2026"; "Data as of 2026-09-30 · uploaded 2026-10-02 · 2 rounds"; "Generated 2026-11-11 10:05 · Smart Warehouse Planner". The page number "Page 1 of 3" sits in the footer [ASSUMPTION].
- **Rounds:** each round starts with a black band "Round 1 · one walk · from-location before to-location". A band never ends a page alone: it keeps at least two lines with it. Column heads repeat on each page.
- **Line:** tick box · Round · Part · Description · From · To · Rule · Note (a blank ruled space for the colleague's remark, e.g. "not at from-location") [ASSUMPTION: the Round column and the Note column]. The from-location is always printed before the to-location. Codes are in Barlow bold.
- **Order:** exactly FR-38's order. The UI never re-sorts the printed list, and the footnote states the rule in plain words: "Lines follow Walk Path; an emptied location always comes before a move into it."
- **Reprint:** the generated time is the only thing that tells two printouts apart (UJ-3). It is printed in the header, not in small print.

## Accessibility Floor

Behavioural. Visual contrast lives in `DESIGN.md`.

- **No information by colour alone** (NFR-10, PRODUCT.md). Movement class = colour + glyph + name in the legend, tooltip and accessible name. Occupied/empty = bin compared with open slot + the words "occupied"/"empty" + counts. Best location = green frame/rail + "BEST" tag + "best" in text. Rule = "Rule 1/2/3/Manual" text. Outdated = hatch + strike + the word "Outdated" + a cause. No space = the chip text. Applied = ink check + "Applied · move N". Selection = accent frame + `aria-selected`.
- **Keyboard:** every form, button, tab, list, the wall grid and the launcher work with the keyboard (Interaction Primitives). Tooltips appear on focus, not only on hover. Nothing is hover-only.
- **Focus** is always visible on paper and on graphite. Focus is never trapped except inside an open dialog. Closing a dialog returns focus to the control that opened it.
- **Screen readers:** each page announces its surface ("Recommendations, round 1, 19 recommendations, 31 no space"). Run results, toasts and save status use `aria-live="polite"`. Import errors use `role="alert"` and are linked to the failing file tile.
- **Text size:** the UI stays usable at 200% browser zoom. The wall then scrolls horizontally inside its panel rather than shrinking bins.
- **Motion:** the bin lift animates (≤ 200 ms) only when a move is selected. With `prefers-reduced-motion` it appears instantly. Nothing blinks or loops.
- **Print:** the move list is legible in black and white. Nothing in it depends on colour or grey tone.
- **Target WCAG 2.2 AA** for the screen UI [ASSUMPTION: the PRD sets only NFR-10; AA is this spine's proposed floor].

## Responsive & Platform

Desktop only (NFR-9). There is no phone or tablet layout.

| Viewport width | Behaviour |
|---|---|
| ≥ 1440px | As drawn: aisle rail 332px, wall panel 1044px, recommendations list plus a 400px detail panel. |
| 1280–1439px [ASSUMPTION] | The aisle rail collapses to a compact column (letter, %, moves count, no mini-wall). The wall keeps 27px bins. The recommendation detail narrows, and its wall crops show 2 sections instead of 3. |
| < 1280px [ASSUMPTION] | The layout holds its 1280px minimum and the page scrolls horizontally. A one-time notice under the toolbar: "Smart Warehouse Planner is built for a desktop browser at least 1280 px wide." Print is unaffected. |

Browser print is part of the platform: Chrome, Edge and Firefox print dialogs, with no PDF export (out of scope).

## Inspiration & Anti-patterns

The direction came from a round of ten divergent concepts (memlog 2026-11-11). The user chose **05 Bin Wall** as "very intuitive and easy to use".

- **Lifted from the real shelf:** the elevation view, coloured picking bins, label windows and louvre panels. A planner who walks the aisles recognises the wall at once.
- **Lifted from parts catalogues:** condensed codes as the main typographic voice, and every item identified by its number first.
- **Kept from the concept round as a discipline:** "every bin is a real location code, every move shows from, to and why".
- **Not chosen:** 01 Exploded Parts Catalogue (dimetric exploded view, very dense at 10px cells), 02 Orienteering Course (plan as a course to walk; long legs tangle), 03 Visible Record Index (card-cabinet strips; shape cues only work when a drawer is pulled out), 04 Construction Drawing Set (drawings and revisions; hatching turns grey at small sizes), 06 Floor Marking (floor signage; a dense hybrid), 07 Network Diagram (metro map; mirrored rows could read as physical layout), 08 Guide Map (visitor map; risk of reading as decoration), 09 Exposure Sheets (overlay sheets; hatches blur on weak printers), 10 Coupon Book (rounds as tear-off coupons; it also set aisle A to 99% occupied, against the 65–87% in the data). The risks are the ones each concept card named. The memlog does not record the user's reasons for not choosing them.
- **Rejected for this product:** a red/green occupancy grid (colour-only, and it fights the class colours), heat maps, KPI tile dashboards, distance or "metres saved" visuals, AI-sounding copy, gamified progress.

## Key Flows

### UJ-1. Justas builds a re-slotting plan from a fresh export

Justas, the warehouse planner, suspects the fast-moving parts have drifted to the far aisles.

1. On the saved-plans list Justas clicks **New Plan**, types "Autumn re-slot" and chooses the Locations, Inventory and Transactions files.
2. The import runs its step list. It passes, and the plan opens on the **Plan overview**: data as of the newest transaction date, uploaded today, the period, the settings, and counts per movement class.
3. Justas opens **Locations** (step 3). The wall shows aisle A. Justas tabs into the wall, arrows across a level and reads tooltips: which parts sit where, occupied or empty.
4. Justas goes to **Best locations**, chooses Whole aisle and marks aisle A, then chooses Level · in all aisles and marks level 1. Green frames and rails appear, the BEST tags appear on the L1 labels, and "best · empty" counts update.
5. In **Recommendations** Justas clicks **Run recommendations**. Round 1 lists rule 1, rule 2 and rule 3 recommendations, each with its reason in numbers, and the "No space" tab shows a count.
6. Justas selects #1 under rule 1. The detail panel lifts the bin out of G-14-04-02 and shows the target A-02-01-01. Justas applies it, and applies most of the others the same way.
7. For one rule 1 part, Justas opens **Other location ▾**, picks another empty best location and applies it.
8. One part would not fit physically, so Justas clicks **Keep in place**. It moves to the Kept in place tab.
9. From the part panel Justas makes a **Manual move** to another location, and the move appears with "M" on the wall.
10. **Climax:** Justas opens **Before/after**. Aisle by aisle, the table shows more fast-moving parts in best locations, more pick groups in the same aisle, and which parts move in and out. On the wall, aisle A's lifted bins have settled into their new slots with applied markers.
11. **Resolution:** the plan is saved automatically. Justas runs again: round 2 offers rule 1 the best locations that the applied rule 2 moves freed.

**Failure path:** the Inventory file lacks the Quantity column. The import stops: "Import stopped: nothing was saved. Inventory.xlsx is missing the column Quantity." The Inventory tile is marked and the other two files stay chosen. Justas fixes the export, re-chooses Inventory.xlsx and runs the import again.

### UJ-2. A colleague carries out the move list

1. Justas opens **Move list** and prints it from the browser.
2. The colleague takes the printout. The header shows the plan name, the data-as-of date and when it was generated.
3. The colleague starts at the black "Round 1 · one walk" band and works top to bottom. For each line they go to the from-location, take the part, carry it to the to-location and tick the box.
4. A line into a location always comes after the line that empties it, so no target is ever still full.
5. **Climax:** the last box of round 1 is ticked. Every location the round needed was emptied before something went into it, and the walk ended without a single blocked shelf.
6. The colleague turns to the "Round 2" band, whose moves use locations that round 1 freed, and starts the second walk.

**Failure path:** a part is not at its from-location because someone moved it after the export. The colleague writes it in the line's Note space and carries on. Justas decides later. The tool does not track whether moves were carried out.

### UJ-3. Justas continues a saved plan a week later

1. Justas opens the app. The saved-plans list shows "Autumn re-slot" at the top with its last-edited time.
2. Justas opens it. The plan plate shows the same data-as-of date and round, and every mark, move, recommendation (outdated ones included) and no-space part is exactly as it was left.
3. In Recommendations Justas clicks **Undo last move**. The toast names the undone manual move, and the unapplied recommendations of the latest run turn outdated.
4. Justas runs again to get fresh recommendations, then applies two more.
5. Justas prints the move list again.
6. **Climax:** the new printout's header carries a new generated time, so the fresh list is clearly told apart from last week's paper on the desk.
7. To try a different set of best locations without losing this plan, Justas uses **New Plan from this import** from the plan plate menu. The new plan has the same import and none of the marks or moves.

**Failure path (stage 2):** another planner has saved the same plan meanwhile. Justas's next change shows the FR-41 warning. Justas reloads or continues, and the last save wins.

## Open Questions

**Resolved by the user on 2026-11-13:**

- **Applied state:** an ink check plus "Applied · move N"; green means best location only.
- **Best green:** two shades, `#3DAE6B` on the graphite wall and `#2C8A55` on paper.
- **"Colour by":** the switch is removed; the wall always shows movement class.
- **Landing page:** kept only as the front page of the public demo deployment, with **Open the app** leading to the saved-plans list.
- **Demo entry:** no "Open the demo" shortcut; uploading the sample files in New Plan (UJ-1) is enough.
- **Selection colour:** selection gets its own colour, violet `#9466F0`, instead of sharing the medium-moving yellow.
- **Warehouse colours:** the planner can change the colours of the movement classes, best location and selection in the app (new PRD FR-49); glyphs and text never change.

**Still open. Not blocking; each stays as drafted until the user says otherwise:**

1. **Wall placement for other code patterns.** FR-3 makes Section and Position optional columns (the demo files have them). Use them when present; otherwise "Walk Path order within aisle and level, sections parsed from the code when it matches". How should non-matching codes draw? (For architecture.)
2. **Minimum width.** Is 1280px the right desktop floor, with horizontal scroll below it?
3. **Planning copy | Import toggle on the wall.** Keep it (a read-only "before" wall) or drop it, since the before/after table already covers "before"?
4. **"Effect if applied" panel.** A per-recommendation preview of the before/after counts is not in the PRD. Keep it as UX, or drop it to stay within FR-37?
5. **Apply all confirmation.** Confirm before applying many moves (as drafted), or apply at once and rely on undo?
6. **Move list columns.** Add a Round column and a blank Note column (as drafted) next to the round bands? A4 portrait?
