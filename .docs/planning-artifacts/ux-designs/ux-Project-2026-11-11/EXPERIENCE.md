---
name: Smart Warehouse Planner
status: final
created: 2026-11-11
updated: 2026-11-14
sources:
  - ../../../../PRODUCT.md
  - ../../prds/prd-Project-2026-11-01/prd.md
  - ./.memlog.md
  - ./DESIGN.md
  - ./mockups/
  - ./.working/concepts/05-bin-wall/
---

# Smart Warehouse Planner — Experience Spine

> Draft (fast path) from concept 05 "Bin Wall", the PRD and PRODUCT.md. Guesses are tagged [ASSUMPTION]. Decisions the user still has to make are under **Open Questions** at the end. Requirement numbers (FR-n, NFR-n, UJ-n) and glossary terms refer to the PRD and are used verbatim. This spine does not restate them. The spines win on any conflict with a mock.

## Foundation

- **Form factor:** a single-surface **desktop web app** in current Chrome, Edge and Firefox (NFR-9). There is no phone or handheld surface in v1. Output is **paper**: the move list is printed from the browser.
- **UI system:** none chosen yet. The stack is decided in the architecture step (PRODUCT.md, Stack). Controls are plain, buildable web controls: buttons, tabs, tables, segmented controls, a native `<dialog>`-style modal. Whatever library is picked, it must honour these behaviours and the tokens in `DESIGN.md`.
- **Visual identity:** `DESIGN.md` is the reference. This spine names its tokens and components by path, for example `{colors.best}` or `{components.bin}`.
- **Language:** the UI is in English (NFR-11). Copy uses the PRD glossary terms exactly: best location, pick group, partner, keep in place, "no space", round, data-as-of date, planning copy, move list, outdated recommendation.
- **Scope change carried here (decided 2026-11-13; the PRD records it as FR-42, milestone 2, which also covers changing colours from the Key):** the warehouse view (FR-42) is in the core (milestone 2). It becomes the **Locations view** (aisle bin walls) and the **wall crops in the recommendation detail**. FR-42 is rewritten so occupancy shows by shape plus text, never red/green. Colour stays reserved for movement class.
- **Users in this spine:** the **planner** (in the PRD journeys this is Justas) and the **colleague**, who only meets the printed move list. Login is in the core from milestone 2 (FR-39, FR-40, decision 2026-11-14). In milestone 1 "created by" / "last edited by" show the fixed value `planner` (FR-11); from milestone 2 they show the logged-in user, as the mocks with "Justas" or a "JS" avatar do.

## Information Architecture

The saved-plans list is the start page after login (FR-8, FR-40). Everything else lives inside an open plan, under the always-visible toolbar: plan plate · flow bar · launcher button.

**Naming.** The PRD glossary's **warehouse view** (FR-42) is shown as the **Wall** mode of the Locations step (page title "Locations") and as the wall crops in the recommendation detail. This spine calls it "the wall". The `legend` component is labelled **Key** in the UI, and UI-facing text says "Key".

| Surface | Reached from | Purpose | Flow step |
|---|---|---|---|
| Log in | Demo front page "Log in"; any page while logged out; after Log out | Username and password (with Show), a link to Create account and, on the public deployment, **Demo version** (FR-50). Wrong details show one alert, "Wrong username or password. Check both and try again.", never saying which was wrong; the username is kept, the password is cleared and focused. Then the saved-plans list (FR-40). → [log in sheet](./mockups/login.svg) | — |
| Create account | Demo front page "Create account"; Log in page link | Username (unique, letters and numbers; hint "Letters and numbers. Must not be taken."), Password with Show, and Repeat password, since there is no password reset (FR-39). Checked on submit; focus moves to the first error: "That username is taken. Try another." / "The passwords don’t match." Then logged in on the saved-plans list. → [log in sheet](./mockups/login.svg) | — |
| Saved-plans list | After login or Demo version; launcher **SAV**; plan plate menu | All plans, most recently edited first (FR-8): name, data-as-of date, upload date (FR-7), created/edited by and at; New Plan; delete | — |
| New Plan | Saved-plans list "New Plan"; launcher **NEW** | Name, three files *or* "Or reuse the import of a saved plan"; import errors | — |
| Plan overview | Flow step 1; launcher **OVR**; after a successful import | Data-as-of and upload dates, period, settings, counts per movement class, best and empty counts, parts kept in place | 1 |
| Parts (ranked roster) | Flow step 2; **PRT**; search | Every part ranked by picks, filter by class, keep in place, open the part panel | 2 |
| Locations: **wall** (default) and list | Flow step 3; **LOC**; search; "Show on the Locations wall" | Nine aisle cards with occupancy; the open aisle as a bin wall; tooltip per location; "Open as list" gives the FR-14 table | 3 |
| Pick groups | Flow step 4; **GRP** | Pick groups sorted by shared jobs, both parts, aisles, same aisle / different aisles (FR-20) | 4 |
| Best locations | Flow step 5; **BST**; "Edit best-location marks" on the wall | Mark and unmark on the wall (whole aisle / level / single location), with a list of marks | 5 |
| Recommendations | Flow step 6; **REC** | Run, tabs per rule, apply / other location / keep in place, no space, outdated, apply all, undo, reset; **recommendation detail** with the from and to wall crops | 6 |
| Before/after table | Flow step 7; **B/A**; "Before/after table" link | Per aisle and total: moves in and out, fast-moving in best locations, pick groups in the same aisle | 7 |
| Move list print view | Flow step 8; **MOV** | Screen preview plus browser print; black and white | 8 |
| Settings | Launcher **SET**; plan overview | **Settings** (the glossary term), read-only: the analysis settings this plan was computed with (FR-18), changed in the config file, not in the app. Colours are not settings: they are changed only from the wall's Key (FR-42; see Warehouse wall) | — |
| Launcher (features menu) | Toolbar grid button; `Ctrl+K` / `⌘K` | All features as plates in flow order, the open plan, other saved plans, the Keyboard box listing every shortcut | — |
| Part panel | Search result, roster row, tooltip part line, recommendation | One part: class and picks, locations and stock, pick groups and partners, keep in place, Manual move… | — [ASSUMPTION] |
| Manual move dialog | Part panel, location tooltip, list row action | From-location (if the part has several), to-location, confirm | — |

**Later (stage 2, after the milestone 2 gate), shown in the launcher as empty slots marked "Coming in stage 2":** category settings and category check (**CAT**), location label print view (**LBL**). The concept's separate **WHV** "Warehouse view" plate is retired, because the warehouse view is now the core Locations wall.

**Navigation model.** The flow bar is navigation, not a wizard. Any step can be opened at any time, and the check marks only report state. The launcher is the full map. The plan plate opens a small menu: switch to a recent plan, "All saved plans", "New Plan from this import" (FR-2) [ASSUMPTION]. Modals stack at most one deep. The avatar at the right end of the toolbar opens the user menu: "Logged in as" with the username ("demo" after Demo version) and **Log out**, which returns to Log in, or to the demo front page on the public deployment (FR-40).

**Demo front page (public deployment only).** The [demo front page](./mockups/landing.svg) is the first page of the public demo deployment (NFR-5; redesigned 2026-11-14 as layout B, "Follow one part"). It says in one line what the tool does ("Every move comes with a reason."), and its four numbered panels follow one demo part from its export row, to its movement class, to the planner's choice (Apply or Keep in place), to its line on the printed move list. It has three actions: **Log in** (primary, also in the header), **Create account** (FR-39, FR-40) and **Demo version** (FR-50), which skips the login page and opens the saved-plans list as the seeded demo account. In the app a demo visitor is simply that account: the user menu shows its username and Log out. The header holds only the name, a "How it works" link that scrolls to the panels, and Log in. There is no README or demo-data link, no synthetic-data notice and no explanatory footer text (user decision 2026-11-14); the README states that the deployment holds synthetic data only and lists the demo account. It makes no claims about customers, savings or distances. A local install opens on Log in; after login the saved-plans list is the start page (FR-8). Demo version preloads no plan: first-time visitors upload the three files from `data/sample/` in New Plan, as the README describes (UJ-1). A local install has no Demo version; there the README's demo account is used.

→ Composition references: [recommendations interface](./mockups/interface.svg) · [log in and create account](./mockups/login.svg) · [features menu](./mockups/features-menu.svg) · [screen map of the other key screens](./mockups/screen-map.svg). The spines win on conflict (DESIGN.md, Brand & Style, lists details the older mocks still show).

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

**Shell and navigation.**

| Component | Use | Behavioural rules |
|---|---|---|
| Toolbar, current step, stage-2 plates, "You are here" `{components.app-toolbar}`, `{components.flow-step-current}`, `{components.launcher-plate-stage2}`, `{components.you-are-here-tag}` | Shell, launcher | The toolbar stays at the top, except below about 500 CSS px of viewport height, where it scrolls with the page. The current-step pill is the flow link for the open page. "You are here" marks the launcher plate of the open page. Stage-2 plates are listed but inert, with `aria-disabled="true"`. |
| Plan plate `{components.plan-plate}` | Toolbar, every plan surface | Always shows the plan name, data-as-of date and current round ("round 0" before the first run). Click or `Enter` opens the plan menu. The upload date is in its tooltip and on the overview. |
| Flow bar `{components.flow-bar}` | Toolbar | Eight links. The current step is `aria-current="step"`. Check rules [ASSUMPTION]: steps 1–4 are checked once the plan exists (their data is computed on import). Best locations is checked when at least one best-location mark exists. Recommendations is checked when the latest run has no unapplied, non-outdated recommendation left. Before/after and Move list never get a check (they are outputs). The check is an ink glyph; the link name carries it as visually hidden text ("Overview, step 1, done"). |
| Launcher `{components.launcher-plate}` | Grid button or `Ctrl+K` / `⌘K` | A modal dialog over the current page: focus moves to "Go to: type a code or a name", focus stays inside, and the page behind is `inert`. Typing filters plates and saved plans, `↑`/`↓` move the highlight, and `Enter` opens the highlighted plate (type "REC", then `Enter`). No match shows "No feature or saved plan matches “xyz”." `Esc` closes and returns focus to the grid button. Live counts on each plate come from the open plan. Stage-2 plates are announced as "Coming in stage 2" and are not activatable. |
| Search field | Parts and Locations headers, wall header, launcher | One field matches part numbers, part descriptions and location codes (FR-15), partial text, case-insensitive. Results list parts and locations separately. A location result opens the wall at that bin. A part result opens the part panel and selects its current location on the wall. |

**Wall.**

| Component | Use | Behavioural rules |
|---|---|---|
| Bin `{components.bin}` / open slot `{components.slot-empty}` | Wall, recommendation crops, aisle mini-walls | One focusable cell per location on the open wall (see Warehouse wall). Mini-walls in aisle cards are decorative (`aria-hidden`). Their card carries the numbers as text. |
| No location `{components.slot-none}` | Wall | Not focusable; arrow keys skip it. Counted in no total; the tooltip of a neighbouring cell never mentions it. |
| Bin label window `{components.bin-label-window}` + glyph `{components.class-glyph}` | Bins, swatches | Decorative to assistive tech: the class is in the cell's accessible name. The glyph never changes meaning. |
| Best-location frame and rail `{components.best-frame}`, `{components.best-rail}` | Wall | Always paired with the text BEST: level and whole-aisle marks show the rail and a BEST tag on each marked level label (aisle marks also tag the letter plate and aisle card); single marks show the frame and "BEST n" on their level label. In marking mode the rail's hit area is the whole level row (at least 24px tall) and the level label is a button: hover or focus shows "Mark level 1 in aisle A". |
| BEST tag `{components.best-tag}`, `{components.best-tag-on-light}` | Wall level labels, tooltip, tables | Text, not a control. In Best locations marking mode the level label with its tag is part of the rail's hit target. |
| Lifted bin `{components.bin-lifted}` + marker `{components.move-marker}` | Wall, recommendation crops | Every recommendation of the latest run whose from-location is on the shown wall lifts its bin. Its number matches the row in the list. Selecting a marker, bin or row selects the move in both places. Only the **selected** move draws its arrow `{components.move-arrow}`. The 17px marker meets the target-size rule through equivalents: the recommendation row, the lifted bin and the "Moves touching aisle" table row select the same move. |
| Move target `{components.move-target}` | Wall | A dashed target is focusable as its location cell. Its tooltip adds "Recommendation 2 arrives here from G-14-04-02". |
| Hover note `{components.hover-note}` | Wall | Shown for the selected move only, next to its arrow. It never covers the from-bin or the target, and flips side near the wall edge. |
| Tooltip `{components.tooltip}` | Wall cells, location chips | Shows on hover or focus; dismissible, hoverable and persistent (WCAG 1.4.13); `Enter` pins it. Full rules in Interaction Primitives. |
| Location chip `{components.location-chip}` | Rows, tooltips, detail | Shows a location code. Activating it opens that location on the wall with its tooltip pinned. |
| Wall panel `{components.wall-panel}` | Locations, Best locations | Scrolls in both directions inside itself when the viewport is narrower than the wall (two-dimensional content, the WCAG 1.4.10 exception); the page never shrinks bins. The focused cell is scrolled into view, with `scroll-padding` for the toolbar, the save notice and toasts, so focus is never hidden (2.4.11). |
| Key `{components.legend}` | Under every wall | Always visible. Six colour entries are buttons (see Warehouse wall, Change a colour from the Key); Empty and 2 parts are text. Each entry's name is its glossary name plus "change colour" ("Fast-moving, change colour"), never a colour word or hex. |
| Colour popover `{components.colour-popover}` | Key entries | Non-modal dialog; full rules in Warehouse wall, Change a colour from the Key. |
| Aisle card `{components.aisle-card}` | Locations wall rail | Letter, mini-wall, occupancy %, "occupied of total · empty", moves touching the aisle. Selecting it opens that aisle's wall. The whole-warehouse card above shows the total %, occupied, empty, best and empty best. |

**Recommendations.**

| Component | Use | Behavioural rules |
|---|---|---|
| Run recommendations | Recommendations header (primary) | Starts a new round (FR-23). While running (≤ 5 s, NFR-8): the button reads "Running…", is disabled, and the list is inert. Afterwards the round chip, tabs and counts update, and focus moves to the first row. Earlier unapplied recommendations and no-space entries are replaced. |
| Round chip `{components.round-chip}` | Recommendations header | Shows the current round ("Round 0" before the first run). Next to it, one line: "Run 2026-11-11 09:42 by planner · 19 recommendations · 31 no space" and "The next run starts round 2 and uses the planning copy as it is then." |
| Tabs + count pills `{components.tab}`, `{components.count-pill}` | Recommendations | All · Rule 1 · Rule 2 · Rule 3 · No space · Kept in place · Outdated. Counts are always visible, including 0, and are part of each tab's name ("Rule 1, 9 recommendations"). Arrow keys move between tabs. |
| Rule band `{components.rule-band}` + rule tag `{components.rule-tag}` | Recommendations | Not interactive. It names the rule and its ordering rule, so the list order is explained (Explain every number). The All tab shows bands in rule order 1, 2, 3. A rule tab shows only its band. |
| Collapsed group | Recommendations, under each rule band | Shows the first 5 rows per rule, then "Show #6–#9 (4 more under rule 1)" [ASSUMPTION: 5]. No-space parts with the same rule and reason collapse into one line ("30 more like this"), which expands in place. |
| Recommendation row `{components.recommendation-row}` | Recommendations | Click or `Enter` selects the row and fills the detail panel. Actions: **Apply** · **Other location ▾** · **Keep in place**. The selected row's Apply is primary, the others secondary. Outdated rows: Apply is disabled, with the reason shown (FR-29). Applied rows: no actions, shows "Applied · move N, round R". |
| Selected / outdated row `{components.recommendation-row-selected}`, `{components.recommendation-row-outdated}` | Recommendations | One selected row per list, kept when switching tabs if the row is visible. An outdated row stays in place (it is not hidden) until the next run, so the planner can see what changed. |
| Other location ▾ | Recommendation row | Opens a listbox of the locations FR-31 allows, in location-code order, each with aisle, level and best/not best. Typing and arrow keys only move the highlight; `Enter` or a click applies the highlighted location, with the rule and round kept. Nothing applies while browsing. An empty list says "No other location fits rule 1 right now." There is no free text; any other placement is a Manual move. |
| Keep in place (link) | Recommendation row, part panel, roster row | Sets the mark at once (FR-32). The row moves to the "Kept in place" tab, and a toast shows "4410281 is kept in place. Remove the mark from the part or the Kept in place tab." Removing is the same link, now reading "Remove keep in place". |
| NO SPACE chip `{components.no-space-chip}` | Recommendations, No space tab | Takes the to-chip's place and is not focusable on its own. The row's accessible name includes "no space" and the cause. |
| Apply all (n) | Recommendations header | n = recommendations of the latest run that are neither applied nor outdated, minus no space and kept in place (FR-30). A confirm popover [ASSUMPTION]: "Apply 15 recommendations from round 1? Undo reverses them one move at a time." Disabled at n = 0. |
| Undo last move | Recommendations header, part panel | The tooltip names the move: "Undo move 3: 9723950 A-03-04-02 → A-05-01-03". It reverses the most recent move only (FR-35). Afterwards every unapplied recommendation of the latest run becomes outdated, and a notice says so. Disabled when there are no moves. |
| Reset… | Recommendations header | A confirm dialog (FR-35) with `{components.button-destructive}`: "Reset removes all 18 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1." Buttons: **Reset plan** (primary) · **Cancel** (default focus). |
| Recommendation detail | Recommendations, right panel | For the selected row: "Selected: #1 under rule 1", the part, a **From aisle** wall crop (the 3 sections around the from-location) and a **To aisle** crop, the arrow label "Rule 1 · round 1", "Effect if applied" (Now → After for the counts the before/after table uses) [ASSUMPTION], and "Moves in the planning copy" (the last 3, newest first, "Undo reverses move 3 first"). The link "Show on the Locations wall" opens the from-aisle with the move selected. |

**Plans and parts.**

| Component | Use | Behavioural rules |
|---|---|---|
| Saved-plans row | Saved-plans list | Click opens the plan as it was left (FR-9). The row menu has Delete… and "New Plan from this import" (FR-2). Delete confirms in a dialog (FR-12): "Delete “Autumn re-slot”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive.", **Cancel** (default focus) · **Delete plan** (`{components.button-destructive}`). → [components sheet 2](./mockups/components-sheet-2.svg) |
| Import error `{components.import-error}` | New Plan | Lists errors (see State Patterns). The failing file's tile is marked. Passed files stay selected, so only the failing one is re-uploaded [ASSUMPTION]. |
| Roster row `{components.roster-row}` | Parts, Pick groups | Ranked by picks, with ties in part-number order. The why-line names class, picks and the most relevant fact (partner, current location, "in a best location"). FR-13 fields not on the line (total stock, other locations, number of pick groups, kept in place) appear as right-hand columns. Filter by movement class with glyph chips. |
| Part panel | Side panel over Parts / Locations | Part number and description, class with glyph, picks and threshold, total stock, current location, other locations, pick groups (partner, shared jobs, aisle), keep in place toggle, "Manual move…". Opening it moves focus to its heading. `Esc` closes it and returns focus to the control that opened it. |
| Manual move dialog | Part panel, tooltip, list row | From-location (preselected when the part has one), a to-location field with autocomplete over the Locations file. It refuses the from-location and virtual locations with an inline reason (FR-33), shown as `{components.input-error}`: red boundary, warning icon and a sentence ("This is the from-location. Choose another." / "FLSKRS is a virtual location, not a shelf."), with `aria-invalid="true"` and the sentence linked by `aria-describedby`. It shows "to an occupied location: stock is added together" when the target already holds the part. Confirm creates the move with rule Manual and the current round. Then the FR-34 merge happens silently, and a toast says "Combined into one move: G-14-04-02 → A-02-01-01 (Manual)." → [components sheet 2](./mockups/components-sheet-2.svg) |

**Controls and feedback.**

| Component | Use | Behavioural rules |
|---|---|---|
| Buttons `{components.button-primary}`, `{components.button-secondary}`, `{components.button-tertiary}`, `{components.button-link}`, `{components.button-disabled}` | Everywhere | At most one primary per surface (Run recommendations, New Plan, Print, or Apply on the selected row). Secondary for repeatable commits (Apply, Apply all). Tertiary for reversible or navigational actions (Undo last move, Reset…, Open as list, Other location ▾). Link for low-commitment verbs (Keep in place, Before/after table). A disabled button keeps its label, stays focusable with `aria-disabled="true"`, and shows its reason on hover and on focus, linked with `aria-describedby` ("No moves to undo"). Labels end with "…" when a dialog follows. |
| Input `{components.input}` | Search, plan name, launcher | `Enter` submits, `Esc` clears and then blurs. The plan name is required: "Give the plan a name." inline under the field. Plan names need not be unique [ASSUMPTION]. |
| Segmented control `{components.segmented-control}` | Wall header, Locations, Best locations | Behaves as a radio group: arrow keys switch, and the selection persists per plan [ASSUMPTION]. |
| Toast `{components.toast}` | Global, bottom-left | One at a time, at least 10 s (longer for longer text), paused while hovered or focused, at most one action. **Undo** appears only when Undo last move would reverse exactly what the toast reports, that is, a move ("Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01" · Undo). A toast about marks never offers Undo, because FR-35 undo never reverses marks: "Best-location marks changed · 3 recommendations are now outdated" · **View** (opens the Outdated tab). Every toast action also exists elsewhere (Undo last move, the Outdated tab). Under reduced motion it appears without sliding. Announced via `aria-live="polite"`. → [components sheet 1](./mockups/components-sheet.svg) |
| Focus ring `{components.focus-ring}` | Everything focusable | Fixed: the Key colours never change it. On graphite (wall, toolbar, launcher) the dark inner and white outer ring; on paper the ink ring with a white gap. |

**Print.**

| Component | Use | Behavioural rules |
|---|---|---|
| Print move list `{components.print-move-list}` | Move list | Print view only; rules in Move list print. |

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
| Opening a plan | Any plan surface | The toolbar shows the plan plate at once; the page shows "Opening Autumn re-slot…" as text (no spinner) and fills in when the data is ready. |
| Saving | Plan plate tooltip, launcher open-plan card | "Saved automatically" after every change (FR-10). There is no Save button. |
| Save failed | Global notice under the toolbar | "The last change was not saved. It is still on screen; trying again." Retries automatically. Edits stay possible [ASSUMPTION]. |
| Empty plan: no best locations | Best locations; Recommendations | "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations." On Recommendations: "Rule 1 and rule 2 need best locations. Rule 3 runs without them." Run stays enabled. |
| Empty plan: no run yet | Recommendations | Round chip "Round 0". "No run yet. Run recommendations to start round 1 on the planning copy as it is now." |
| Loading a run | Recommendations | See "Run recommendations" in Component Patterns. The list keeps its old content, dimmed and inert, until the new round replaces it. |
| Run failed | Recommendations | The run is all or nothing [ASSUMPTION]: "The run stopped before it finished. Nothing changed: still round 1. Run recommendations to try again." The list keeps the previous round; the button is enabled again and focused. |
| No moves found | Recommendations after a run | "Round 3 found no recommendations and no “no space” parts. The rules have nothing more to suggest for these best-location marks." Undo, Reset and the move list stay available. |
| No space | Recommendations row, "No space" tab | The NO SPACE chip replaces the to-chip, with the rule's reason in numbers (FR-28) and a plain cause: "no empty best location" (rule 1), "no empty location outside best locations" (rule 2), "no empty location in aisle D outside best locations" (rule 3). No actions apart from Keep in place and opening the part. |
| Outdated | Recommendations row, wall marker | Hatched row, struck-through target, "Outdated" with a clock icon and the cause from FR-29: "A-11-02-02 was filled by a manual move." / "4410281 has been moved." / "The best-location marks changed." / "Outdated after undo." Apply disabled until the next run. On the wall: the grey dashed marker, no lift. |
| Keep in place | Row, roster, tooltip, overview | The row goes to "Kept in place" with "Kept in place · Remove". In roster and tooltip: a pin glyph with "kept in place" text. The overview shows the count. |
| Applied | Row, wall | An ink check with "Applied · move 3, round 1" / "In the planning copy". On the wall the bin sits in its new slot with an applied marker (ink disc and white check) for the current round [ASSUMPTION]. |
| Move back removes it (FR-34) | Manual move dialog, wall | When the to-location is the part's first from-location in this round, the dialog says "This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed." The confirm button reads **Remove move**. |
| Undo done | Recommendations, wall | A toast: "Undid move 3. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue." |
| Reset done | Recommendations | A toast: "Plan reset. 18 moves removed; marks kept. The next run is round 1." |
| Kept/Outdated/No space tab empty | Recommendations | "Nothing kept in place." / "No outdated recommendations." / "No “no space” parts in this run." |
| Part with no current location | Part panel, tooltip, roster | "No current location (no stock above zero)" in place of the code; with no stock it gets no recommendation and Manual move… is disabled with that reason. |
| No pick groups | Pick groups | "No pick groups: no two parts share 5 or more jobs in the period." |
| Before = after | Before/after table | The table renders with equal values and the note "No moves yet: before and after are the same." |
| No moves to print | Move list | "There are no moves to print." (FR-38) Print is disabled. A link goes to Recommendations. |
| Search: no match | Search field | "No part or location matches “xyz”." |
| Launcher: no match | Launcher | "No feature or saved plan matches “xyz”." |
| Key colours can't be kept | Key colour popover | When browser storage is blocked (private window, blocked site data), the defaults are used and a note says "Colours can't be kept in this browser; changes last until you close this tab." Changes still apply for the session. |
| Focus | All | The fixed `{components.focus-ring}`: on graphite a 2px white ring outside a 2px dark ring, on paper a 2px ink ring with a 2px white gap. The Key colours never change it, and it never looks like selection (a single cased violet line). |
| If time allows: plan changed by someone else | Any plan surface | FR-41 warning: "Someone saved this plan after you opened it. Reload it, or keep going and your version replaces theirs." Not in core. |

## Interaction Primitives

**Keyboard-complete (NFR-10).** Every action has a keyboard path. The mouse is never required.

- `Tab` / `Shift+Tab` follow reading order: toolbar → page header actions → main content → side panel.
- Destructive actions (Delete…, Reset…) always open a confirm dialog or popover with **Cancel** focused.

**Shortcuts.** There are no single-character shortcuts (WCAG 2.1.4): every shortcut uses a modifier, and plain letters, digits and `/` never trigger anything. The launcher's Keyboard box lists them.

| Windows / Linux | macOS | Action | Where |
|---|---|---|---|
| `Ctrl+K` | `⌘K` | Open the launcher. Type a plate code or a name, then `Enter` (`Ctrl+K`, REC, `Enter` opens Recommendations). This is how to jump to any flow step. | Everywhere, also in text fields |
| `Ctrl+/` | `⌘/` | Focus the page's search field | Pages with a search field |
| `Alt+A` | `⌥A` | Apply the selected recommendation | Focus inside the recommendations list |
| `Alt+O` | `⌥O` | Open Other location ▾ for the selected recommendation | Same |
| `Alt+K` | `⌥K` | Keep the selected recommendation's part in place | Same |
| `Esc` | `Esc` | Close the topmost layer: tooltip, popover, dialog, panel or launcher, in that order | Everywhere |

The app takes `Ctrl+K` from the browser's search-bar shortcut, as most web apps do. Flow steps get no direct key: `Alt+digit` switches tabs in Chrome and Firefox on Linux, and `Alt+F/E/V/S/B/T/H/D` open browser menus or the address bar, so those stay with the browser. The `Alt` shortcuts never fire while a text field has focus.

**Lists and tables.** The recommendations list holds buttons in its rows, so it is a `grid` (one row per recommendation), not a `listbox`. The roster, pick groups, saved plans and other tables are tables with focusable rows. Each is a single tab stop: `↑`/`↓` move between rows, `Enter` selects or opens, and `Tab` moves into the selected row's actions.

**Selecting a bin on the wall.** The open wall is one composite widget: `role="grid"` with `aria-rowcount` and `aria-colcount`. Each run is a row group; the level labels (L4 at the top of a run down to L1) are row headers and the section numbers are column headers. Exactly one cell is in the tab order.

- `←`/`→` move one position, crossing section boundaries. `↑`/`↓` move one level; `↓` from L1 of the top run continues to the top level of the bottom run at the same column, and `↑` goes back. `Page Up`/`Page Down` jump between the top run (sections 01–10) and the bottom run (11–19). `Home`/`End` go to the first or last location of the level in that run, and `Ctrl+Home`/`Ctrl+End` to the first cell of the top run and the last cell of the bottom run.
- Positions with no location stay in the grid as empty, non-focusable cells (so column indexes stay aligned), and arrow keys skip over them.
- Each cell's accessible name is short and complete: code, level, best, occupied or empty with the class, and the move state, for example "A-07-01-02, level 1, best location, occupied, fast-moving, move 2 arrives here". The part lines form its description (`aria-describedby`). The selected move is stated in text ("move 1, selected, leaves here"), not with `aria-selected`, because a move spans two cells.
- **Tooltip (WCAG 1.4.13).** Focusing a cell, or hovering it for 150 ms [ASSUMPTION], shows its tooltip, so every tooltip is reachable by keyboard. It is *dismissible*: `Esc` hides it without moving focus or the pointer. It is *hoverable*: the pointer can move from the cell onto the tooltip without it closing. It is *persistent*: there is no timeout; it stays until focus or the pointer leaves both cell and tooltip, `Esc` is pressed, or its content changes. It opens above the run (below it for the bottom run's lowest level near the panel edge), so it never covers the next cell in the direction of travel. The visual tooltip is `aria-hidden`, because the cell's name and description already carry its content.
- `Enter` (or a click) pins the tooltip as a non-modal `role="dialog"` labelled by the location code, with actionable content (part lines open the part panel, "Manual move…", "Show recommendation #1"). Focus moves to its first action; `Esc` closes it and returns focus to the cell. The cell has `aria-haspopup="dialog"` and `aria-expanded`.
- Clicking a lifted bin or a marker selects that move.
- The focused cell is scrolled into view inside the wall panel, clear of the toolbar, the save notice and toasts (2.4.11).

**Markers link both ways.** Selecting a move anywhere (row, marker, lifted bin, "Moves touching aisle A" table) selects it everywhere, scrolls the other view into place (smoothly only when reduced motion is not requested) and draws its arrow.

**Banned:** drag and drop as the only way to move a part (a keyboard path always exists; drag to move is not planned in v1 [ASSUMPTION]), hover-only information, single-character shortcuts, auto-advancing steps, infinite scroll, modal stacks deeper than one, and any animation longer than 200 ms apart from the bin lift (see Accessibility Floor).

## Warehouse wall

This section covers the Locations view and the recommendation detail. It realises FR-14 and the rewritten FR-42, plus FR-22 on the wall. → [warehouse layout mock](./mockups/warehouse-layout.svg) · [components sheet 1](./mockups/components-sheet.svg) (Key and colour popover)

**Overview of 9 aisles.** The left rail lists aisles in walk order A → I ("Walk order A → I"). At the top is the whole-warehouse card: occupancy %, "1,584 of 2,000 locations · 416 empty", "174 best locations · 7 of them empty" (FR-14, FR-22). Each aisle card shows its mini-wall, %, "occupied of total · empty" and the moves that touch it. Opening the Locations view shows the aisle last opened in this plan, or aisle A [ASSUMPTION].

**Open aisle.** The header shows the aisle letter plate, "Aisle A", and the text line "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270". On the right: **Open as list** (the FR-14 table filtered to this aisle, with filters for aisle / occupied-empty / best) and **Edit best-location marks** (switches to the Best locations step with this aisle open). The page header holds **Planning copy | Import** [ASSUMPTION: Import shows the frozen import, read-only, with no markers and no actions] and the search field.

**Layout rules.**
- One wall per aisle (Aisle column). Levels come from the Level column, with the highest level on top and L1 at the bottom, like the real shelf.
- Locations are placed left to right in Walk Path order within their aisle and level. Section and position numbers are read from the location code when it matches `<aisle>-<section>-<level>-<position>`. [ASSUMPTION] When codes follow another pattern (FR-6 allows several), locations are drawn as one continuous run per level without section labels. See Open Questions.
- **Sections are split into two runs**: the first ⌈n/2⌉ sections on top (01–10 of 19) and the rest below (11–19), each run with its own level labels. An end cap closes the aisle: "End of aisle A · Walk Path 2,270 →".
- Positions with no location in the file are hatched `{components.slot-none}`, are not focusable, and are skipped by arrow keys.
- The **Key** (`{components.legend}`) is always visible under the wall. Its colour entries are buttons that open the colour popover (see Change a colour from the Key below).

**The wall always shows movement class.** Bins are in class colours with glyphs. The concept's colour-mode switch is removed, because the FR-42 rewrite drops red/green occupancy and occupancy is already readable by shape (bin against open slot) and by the text counts.

**Best-location marking on the wall.** How a best location is drawn depends on its mark (DESIGN.md, Components, Best location): a **level mark** (in this aisle or in all aisles) gives the level the green rail and a **BEST** tag on its level label; a **whole-aisle mark** does the same on every level and adds a BEST tag to the aisle letter plate and aisle card; a **single-location mark** draws the green frame `{components.best-frame}` around that location, and its level label shows "BEST n". The tooltip names the mark that makes it best ("Level 1 in aisle A (best-location mark)"). If several marks cover it, all are listed.

In the Best locations step the wall becomes the marking tool. **Whole aisle | Level | Single location** sets the mode. In Level mode a scope toggle "in this aisle | in all aisles" covers FR-21 [ASSUMPTION]. Hovering or focusing a cell previews the mark for the current mode ("Mark level 1 in aisle A", "Mark aisle A", "Mark A-07-01-02"), and `Enter` or click sets it; the level labels are also buttons in Level mode, and the rail's hit area is the whole level row. Marks are listed beside the wall with remove buttons (at least 24 × 24px, "×", labelled "Remove mark Level 1 in aisle A"). "174 best · 7 empty" updates live. Changing marks makes affected recommendations outdated (FR-29) and says so in a toast with **View** and no Undo: "Best-location marks changed · 3 recommendations are now outdated".

**Moves on the wall.** Every recommendation of the latest run whose from-location is on this wall shows a **lifted bin** with its numbered marker. Targets on this wall show as dashed slots with a plus glyph and the same number. A move from another aisle into this one shows only its target, with the tooltip "From G-14-04-02 (aisle G)". Applied moves of the current round show applied markers. Manual moves show "M". Outdated ones show the grey dashed marker and no lift. **Only the selected move** draws the accent arrow and the hover note ("Rule 1 · 8044172 Oil filter - Toyota Corolla / 33 picks (24 or more) · A-12-04-02 → A-14-02-01"). This keeps the wall readable when a round has many moves. Below the wall, **"Moves touching aisle A · round 1"** lists the same moves with matching numbers, Rule, Part, Class · picks, From, To, Status and Action (Apply / Keep in place), plus "Open round 1".

**Selection and tooltip.** As in Interaction Primitives. The tooltip content is the location code, its level ("Level 1", from the Level column, not parsed from the code), BEST tag, "Occupied · 2 parts" or "Empty", the mark source, Walk Path, one line per part (glyph swatch, part number, description, class · picks · stock), and a partner strip when a partner is relevant ("Partner 4410281 · 14 shared jobs · arrives with move 2"). It never shows capacity or distance.

**Density limits.**
- Bins stay **≥ 27px wide** (DESIGN.md, Layout & Spacing). At 27px the label window holds the glyph only. The three-letter code (FST/MED/SLW/DED) appears only at about 56px or wider.
- Two parts in a location get a split label. Three or more show the glyph of the part with the most picks plus a small "+" tick, and the full list is in the tooltip [ASSUMPTION].
- One aisle is open at a time. The aisle cards are overview only. There is no "all 2,000 bins at once" zoom in v1 [ASSUMPTION].
- One arrow at a time.

**Recommendation detail crops.** These are the same wall at the same bin size, cropped to the three sections around the from-location and the to-location, stacked "From aisle G" over "To aisle A" with the rule and round between them. A cross-aisle move needs no long arrow: the crops are the arrow. The crops are pictures, not grids: each is `role="img"` with a text name ("From G-14-04-02, aisle G, level 4 → to A-02-01-01, aisle A, level 1, best location"), so they add no tab stops; "Show on the Locations wall" opens the full grid.

**Change a colour from the Key (FR-42).** The only way to change a colour is to click its entry in the Key under the wall; there is no colours page and no colour entry in Settings. The six colour entries are Fast-moving, Medium-moving, Slow-moving, Dead stock, Best location and Selected; Empty and 2 parts are not clickable. Each entry is a button named by its glossary name, never by a colour ("Fast-moving, change colour"), with `aria-haspopup="dialog"` and `aria-expanded`. Clicking it, or pressing `Enter` or `Space` on it, opens a small colour popover above it, a non-modal `role="dialog"` labelled by its title:
- a title naming what is being changed, with its fixed glyph or cue ("Fast-moving ▲ colour");
- eight preset shades of that entry's hue (`{components.colour-presets}`), a `radiogroup` of named `radio` swatches ("Fast-moving shade 3 of 8", the default one "Default") with the current one ringed and checked; every preset passes that entry's contrast check;
- a Default chip showing the default swatch and hex;
- a hex field and a swatch button that opens the browser's own colour picker. The hex field and the presets are the guaranteed keyboard path, since the native picker is not keyboard-operable in every browser. An invalid value sets `aria-invalid` and shows "Enter a colour as #RRGGBB";
- the contrast and likeness warnings for this colour (the checks below), shown under the presets only when a check fails, linked to the hex field with `aria-describedby` and announced with `role="status"`;
- **Reset this colour** (back to the default for this colour only) and **Done**.

Focus starts on the current preset. Arrow keys move between presets and preview each one live on the wall behind the popover, so the choice is judged on the real wall. **Done** or a click outside keeps the pick and announces it ("Fast-moving colour changed"). `Esc` restores the colour the entry had when the popover opened, then closes [ASSUMPTION]. Either way focus returns to the Key entry. The popover flips or shifts to stay inside the viewport, also at 200% zoom.

**Key colours (FR-42).** Each of the six colours (fast-moving, medium-moving, slow-moving, dead stock, best location and selection) keeps its fixed glyph or cue (▲, ◆, ▼, slashed ring, the BEST tag, the selection frame) whatever its colour. A change applies at once to every wall, mini-wall, wall crop and class swatch; the printed move list stays black and white.

The popover's checks measure each colour where it is drawn (pairs and default ratios in DESIGN.md, Colors):
- **Movement classes:** against the wall face `{colors.wall}` and against an open slot `{colors.slot-empty}`. Not against white: on paper a class swatch always has an ink outline.
- **Best location:** against the wall and an open slot, plus ink text on it (the BEST tag) at 4.5:1.
- **Selection:** against its dark casing `{colors.slot-empty}` on the wall, and against white `{colors.surface}` on paper.

A failing pair shows a warning naming the colour and the background, for example "Slow-moving on the wall: 2.1:1 (3:1 or more recommended)". A second warning appears when two of the six colours are **too alike** (CIELAB ΔE below 20) and names both: "Slow-moving and Selection look alike (ΔE 12). Bins and the selection frame may be hard to tell apart." The planner can keep either choice. All six defaults pass both checks, so a fresh browser shows no warnings. For best location the planner picks the wall shade; the paper shade is derived by darkening the same hue until white text on it reaches 4.5:1 and the colour reaches 3:1 on white [ASSUMPTION]. **Reset this colour** restores that entry's DESIGN.md default; nothing resets every colour at once. The choice is stored in the browser, survives a reload, and changes no plan or import; if storage is blocked, see State Patterns. Focus is never affected: it uses the fixed `{components.focus-ring}`.

## Move list print

Realises FR-38 and UJ-2. The reader is the colleague, who has never seen the app. → [screen map, Move list panel](./mockups/screen-map.svg)

- **Screen view:** a paper preview of the list with a toolbar holding **Print** (primary) and "Back to Recommendations". The toolbar and the app shell are hidden in print (`@media print`).
- **Paper:** A4 portrait [ASSUMPTION]. Pure black on white `{components.print-move-list}`. No colour, no tints, no bin swatches. Legible on a black-and-white office printer.
- **Header (every page):** "Move list · Spring re-slot 2026"; "Data as of 2026-09-30 · uploaded 2026-10-02 · 2 rounds" (FR-38); "Generated 2026-11-11 10:05 · Smart Warehouse Planner". The page number "Page 1 of 3" sits in the footer [ASSUMPTION].
- **Rounds:** each round starts with a band that survives printing without backgrounds (browsers' default): bold **ROUND 1** in a 1.5px black box, then "one walk · from-location before to-location", between 2px black rules. `print-color-adjust: exact` may be added, but nothing depends on it. A band never ends a page alone: it keeps at least two lines with it. Column heads repeat on each page.
- **Line:** tick box · Round · Part · Description · From · To · Rule · Note. Every line prints its Round value (FR-38), even under its band. Note is a blank ruled space for the colleague's remark, for example "not at from-location" [ASSUMPTION: the Note column]. The from-location is always printed before the to-location. Codes and part numbers are in Barlow bold at 12pt, text at about 10pt, rules 1px.
- **Order:** exactly FR-38's order. The UI never re-sorts the printed list, and the footnote states the rule in plain words: "Lines follow Walk Path; an emptied location always comes before a move into it."
- **Reprint:** the generated time is the only thing that tells two printouts apart (UJ-3). It is printed in the header, not in small print.

## Accessibility Floor

Behavioural. Visual contrast lives in `DESIGN.md`.

- **Target WCAG 2.2 AA** for the screen UI [ASSUMPTION: the PRD sets only NFR-10; AA is this spine's proposed floor].
- **No information by colour alone** (NFR-10, PRODUCT.md). Movement class = colour + glyph + name in the legend, tooltip and accessible name. Occupied/empty = bin compared with open slot + the words "occupied"/"empty" + counts. Best location = green frame/rail + "BEST" tag + "best" in text. Rule = "Rule 1/2/3/Manual" text. Outdated = hatch + strike + the word "Outdated" + a cause. No space = the chip text. Applied = ink check + "Applied · move N". Selection = a cased frame, the numbered marker and the arrow, plus "selected" in text. Focus = the fixed double ring, never a recolourable colour.
- **Keyboard:** every form, button, tab, list, the wall grid and the launcher work with the keyboard (Interaction Primitives). Tooltips appear on focus, not only on hover. Nothing is hover-only.
- **Focus** is always visible on paper and on graphite (`{components.focus-ring}`, fixed). Focus is never trapped except inside an open modal dialog (the launcher, Reset…, Delete…). Closing a dialog returns focus to the control that opened it.
- **Screen readers:** each page announces its surface ("Recommendations, round 1, 19 recommendations, 31 no space"). Run results, toasts and save status use `aria-live="polite"`. Import errors use `role="alert"` and are linked to the failing file tile.
- **Text size and reflow:** the UI stays usable at 200% browser zoom and reflows to one column down to 320 CSS px (Responsive & Platform). Only the wall panel and wide data tables scroll in two dimensions, inside their own regions. With text-spacing overrides, rows, chips and plates grow rather than clip.
- **Targets:** at least 24 × 24px (`{spacing.control-sm}`), except the 17px move markers, which have equivalent targets (row, lifted bin, table row).
- **Motion:** the bin lift animates (≤ 200 ms) only when a move is selected. With `prefers-reduced-motion` it appears instantly, scrolling jumps instead of gliding, and toasts and popovers appear without sliding. Nothing blinks or loops; "Running…" is text, not a spinner.
- **Print:** the move list is legible in black and white with background printing off. Nothing in it depends on colour, grey tone or a filled background.

## Responsive & Platform

Desktop only (NFR-9). There is no phone or tablet layout.

The design width is 1280–1440px, and that is where the two-panel layouts below apply. Narrower viewports, including browser zoom (200% on a 1280–1440px laptop gives 640–720 CSS px), reflow instead of scrolling the whole page sideways (WCAG 1.4.10).

| Viewport width (CSS px) | Behaviour |
|---|---|
| ≥ 1440 | As drawn: aisle rail 332px, wall panel 1044px, recommendations list plus a 400px detail panel. |
| 1280–1439 [ASSUMPTION] | The aisle rail collapses to a compact column (letter, %, moves count, no mini-wall). The wall keeps 27px bins. The recommendation detail narrows, and its wall crops show 2 sections instead of 3. |
| 1024–1279 | The recommendation detail stacks under the list. The aisle rail becomes a drawer opened from the wall header. The part panel overlays the page. The wall panel scrolls inside itself. |
| < 1024 (zoom or a narrow window), down to 320 | One column. The flow bar collapses to "Step 6 of 8 · Recommendations ▾" (a menu of the eight steps) and the plan plate to one line; side panels, the detail panel, forms, settings, the saved-plans list, dialogs and the recommendation list stack. Only the wall panel, the wall crops and data tables wider than the viewport scroll in two dimensions inside their own regions (the two-dimensional-content exception); the page itself never scrolls sideways. Below about 500 CSS px of viewport height the toolbar scrolls with the page. No "too narrow" notice is shown. |

Browser print is part of the platform: Chrome, Edge and Firefox print dialogs, with no PDF export (out of scope).

## Inspiration & Anti-patterns

The direction came from a round of ten divergent concepts (memlog 2026-11-11). The user chose **05 Bin Wall** as "very intuitive and easy to use".

- **Lifted from the real shelf:** the elevation view, coloured picking bins, label windows and louvre panels. A planner who walks the aisles recognises the wall at once.
- **Lifted from parts catalogues:** condensed codes as the main typographic voice, and every item identified by its number first.
- **Kept from the concept round as a discipline:** "every bin is a real location code, every move shows from, to and why".
- **Not chosen:** 01 Exploded Parts Catalogue (dimetric exploded view, very dense at 10px cells), 02 Orienteering Course (plan as a course to walk; long legs tangle), 03 Visible Record Index (card-cabinet strips; shape cues only work when a drawer is pulled out), 04 Construction Drawing Set (drawings and revisions; hatching turns grey at small sizes), 06 Floor Marking (floor signage; a dense hybrid), 07 Network Diagram (metro map; mirrored rows could read as physical layout), 08 Guide Map (visitor map; risk of reading as decoration), 09 Exposure Sheets (overlay sheets; hatches blur on weak printers), 10 Coupon Book (rounds as tear-off coupons; it also set aisle A to 99% occupied, against the 65–87% in the data). The risks are the ones each concept card named. The memlog does not record the user's reasons for not choosing them.
- **Rejected for this product:** a red/green occupancy grid (colour-only, and it fights the class colours), heat maps, KPI tile dashboards, distance or "metres saved" visuals, AI-sounding copy, gamified progress.

## Key Flows

Not yet narrated: changing a colour from the Key, the demo front page, Pick groups, Parts and the launcher (see Open Questions 10–14).

### UJ-1. Justas builds a re-slotting plan from a fresh export

Justas, the warehouse planner, suspects the fast-moving parts have drifted to the far aisles.

1. Justas logs in and lands on the saved-plans list (FR-40). There Justas clicks **New Plan**, types "Autumn re-slot" and chooses the Locations, Inventory and Transactions files.
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
3. The colleague starts at the boxed "ROUND 1 · one walk" band and works top to bottom. For each line they go to the from-location, take the part, carry it to the to-location and tick the box.
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

**Failure path (if time allows):** another planner has saved the same plan meanwhile. Justas's next change shows the FR-41 warning. Justas reloads or continues, and the last save wins.

## Open Questions

**Resolved on 2026-11-13** (each is written into the body; history in `.memlog.md`): applied state, the two best greens, the wall always showing movement class, the demo front page and no demo shortcut, violet selection, Key colours (FR-42, changed only from the Key), and from the review pass: the fixed focus ring, modifier-only shortcuts, reflow, the print band, a Round value on every printed line, and the class defaults `#D85144` / `#417DDC`.

**Resolved on 2026-11-14:** the demo front page redesign (layout B, "Follow one part", with no synthetic-data notice) login in the core (FR-39, FR-40, milestone 2), the Demo version button (FR-50, milestone 2), and FR-41 moved to "if time allows"; the Log in and Create account details in [the log in sheet](./mockups/login.svg): Repeat password, letters-and-numbers usernames, Demo version also on Log in, and Log out to the front page on the public deployment.

**Still open. Not blocking; each stays as drafted until the user says otherwise:**

1. **Wall placement for other code patterns.** FR-3 makes Section and Position optional columns (the demo files have them). Use them when present; otherwise "Walk Path order within aisle and level, sections parsed from the code when it matches". How should non-matching codes draw? (For architecture.)
2. **Design width.** Is 1280px the right width for the full two-panel layouts? (Narrower viewports and zoom reflow as in Responsive & Platform.)
3. **Planning copy | Import toggle on the wall.** Keep it (a read-only "before" wall) or drop it, since the before/after table already covers "before"?
4. **"Effect if applied" panel.** A per-recommendation preview of the before/after counts is not in the PRD. Keep it as UX, or drop it to stay within FR-37?
5. **Apply all confirmation.** Confirm before applying many moves (as drafted), or apply at once and rely on undo?
6. **Move list Note column and paper.** Keep the blank Note column (as drafted)? A4 portrait?
7. **Paper shade of a chosen best colour.** Derived by darkening the hue until white text reaches 4.5:1 (as drafted), or a fixed paper shade whatever the wall shade?
8. **Colour popover `Esc`.** `Esc` restores the colour from when the popover opened; Done or a click outside keeps the pick (as drafted, replacing the earlier "Esc keeps"). Keep as drafted?
9. **Colour presets and likeness threshold.** Eight shades of each entry's hue (as drafted, DESIGN.md `colour-presets`) and a "too alike" warning below ΔE 20. Keep as drafted?
10. **Journey: changing a colour from the Key.** Needs a narrated journey from the user (the Key colour popover).
11. **Journey: first-time demo visitor.** Needs a narrated journey from the user (demo front page → Demo version, Log in with the README's demo account, or Create account → empty saved-plans list → New Plan with `data/sample/`).
12. **Journey: Pick groups.** Needs a narrated journey from the user.
13. **Journey: Parts roster.** Needs a narrated journey from the user (UJ-1 goes from Locations to Best locations without visiting Parts or Pick groups).
14. **Journey: launcher and search.** Needs a narrated journey from the user.
