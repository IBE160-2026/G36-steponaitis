# Epic 2 Context: Explore parts, locations and pick groups

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner can see every part with its movement class and picks, every location with its stock and occupancy, and every pick group with its shared jobs, and can find any part or location from one search field. Classes and pick groups are computed once at plan creation from the frozen import and stored in the plan's analysis. Every view reads the plan as it is now (the planning copy, which equals the import until Epic 4 adds moves). The epic builds the `classify` and `pick_groups` domain slices, the first shared facts in `domain/planning.py`, the read-only views, and the first shared list components that the rule epics later depend on.

## Stories

- Story 2.1: Count picks and classify every part
- Story 2.2: Find pick groups
- Story 2.3: Parts roster
- Story 2.4: Locations table with occupancy
- Story 2.5: Pick groups table
- Story 2.6: Part panel and search

## Requirements & Constraints

- **Picks:** each Move to Repair line dated in the period is one pick, whatever its quantity. Issue Part, Return to Stock and Receipt lines never count. Only the date counts; the time of day is ignored. The period is the 12 months ending on and including `data_as_of`. It starts the day after the same date one year earlier, so a line on that earlier date does not count.
- **Classes:** every part in the Inventory file gets exactly one class: `fast` (≥24), `medium` (6–23), `slow` (1–5) or `dead` (0). The limits come from the plan's settings snapshot and are never hard-coded. Parts that appear only in the Transactions file are not classified and are not shown.
- **Pick groups:** a job is the set of Issue Part lines in the period that share a transaction code. Code `0` never forms a job. A part counts once per job. Only Inventory parts are considered. Two parts that share at least the minimum number of jobs (5; 4 is not enough) form a pick group, and each is the other's partner. A part can be in several pick groups.
- **Parts list:** shows the part number, description, total stock, current location, other locations, class, picks, number of pick groups and the kept-in-place flag (always false until Epic 7). It can be filtered by class and sorted by picks. It shows the planning copy.
- **Locations list:** shows each location's code, aisle, level, Walk Path, occupied/empty, best or not (always false until Epic 3), and every part stored there with its stock. A location whose inventory rows all have stock 0 is empty. Occupied/empty counts and the occupancy % are given per aisle and for the whole warehouse. Filters: aisle, occupied/empty, best.
- **Pick groups list:** shows both parts (number and description), the shared jobs, the aisle of each part's current location in the planning copy (none if the part has no current location), and whether the two are in the same aisle.
- **Search:** one field matches part numbers, descriptions and location codes as partial text, case-insensitive (Python `casefold`). Parts and locations come back as separate lists.
- **Answer-key checks** (`data/answer-key/expected.json`) must pass exactly. They include the class boundary parts, the pick-group traps (a repeated part on one job, code `0`, an out-of-period date, a part that is only in Transactions), a part in several groups, and exactly-5 pairs. On `data/sample/`, the whole warehouse has 1,584 occupied and 416 empty locations.
- **Performance:** import plus classes and pick groups on the demo data takes under 10 s; other views take under 1 s.
- **Tests** name their FR (e.g. `test_fr17_answer_key_classes`, `test_fr19_traps_do_not_count`). Domain tests call the domain directly. User-visible stories extend Playwright in `frontend/e2e/`.

## Technical Decisions

- **Slices:** `domain/classify.py`, `domain/pick_groups.py`, and `domain/views/{parts,locations,pick_groups,search}.py`, each with its own router in `api/routers/`. The frontend modules are `modules/{parts,locations,pick-groups}`. A domain slice imports only the kernel, never another slice; this is enforced by an import-linter independence contract. A frontend module imports only `components/*` and `lib/*`, never another module (ESLint). Anything a second module needs moves to `components/common/` in the story that first needs it.
- **Purity (AD-1):** the domain uses the stdlib and pydantic only. It never calls the clock and uses no randomness. Settings come from `plan.analysis`, never from `analysis.toml` directly.
- **Shared facts:** `domain/planning.py` holds the only implementations of `planning_copy(import, state)`, `stock_at`, `is_empty`, `current_location` and `aisle_of`. In this epic the planning copy is the import itself. `current_location` is the location with the most stock; on equal stock it is the first in location-code order; it is none when no stock is above zero. Every view imports these and never re-derives them.
- **Analysis storage (AD-4):** `app.plans.create` computes the class and picks of every part, plus every pick group (both parts and the shared jobs), into the plan's `analysis` JSON. A plan reopens with the same results even if `analysis.toml` changes. If the stored shape changes, bump `schema_version` and add an upcaster with a fixture. The import is frozen, and plan views never load `transactions`.
- **Ordering (AD-14):** every rule-defined order comes from `domain/ordering.py`, with text in Python `str` code-point order and all-digit Level values sorted numerically:
  - parts: most picks first, ties in part-number order;
  - pick groups: most shared jobs first, ties by the lower part number, then the higher;
  - locations, aisles and levels;
  - search results.

  The frontend shows server order. User-picked sorts compare text with `<`/`>` (never `localeCompare`) and numbers numerically. Decimal columns sort by a server `sort_rank`. Ties keep server order.
- **Server-authoritative views (AD-3):** the frontend never computes occupancy, current location, same aisle or search results. Every plan view carries the plan `version`. Views are fetched client-side with TanStack Query under `['plan', planId]`. Each request runs one fold and builds the whole response from it.
- **Endpoints:** `GET /api/plans/{id}/parts`, `/parts/{part}` (adds the class threshold, other locations with their stock, and pick groups with partner, shared jobs and partner's aisle), `/locations`, `/pick-groups`, `/search?q=`. The summary `GET /api/plans/{id}` now returns real per-class counts. Locations are `LocationRef {code, aisle, level, section?, position?, is_best}` plus contents. View models live in `domain/views/` and are the wire types. Regenerate `frontend/lib/api/schema.ts` (CI diffs it). All JSON is snake_case.
- **Values:** quantities and Walk Path are `Dec` normalized decimal strings. Class values are `fast/medium/slow/dead`. Part numbers and location codes are exact text (leading zeros kept).

## UX & Interaction Patterns

- **Parts roster (step 2):** each row shows:
  - the rank;
  - a `BinSwatch` with the `ClassGlyph`, in an ink outline;
  - the part number in Barlow over the description;
  - a why-line, e.g. "Fast-moving · 61 picks · G-14-04-02";
  - right-hand columns: total stock, other locations, pick-group count, kept in place.

  Class filter chips use glyphs: Fast-moving ▲, Medium-moving ◆, Slow-moving ▼, Dead stock. A part with no stock reads "No current location (no stock above zero)".
- **DataTable (`components/common/`):** column heads in ink-secondary, hairline dividers, numbers right-aligned and tabular. The table is a single tab stop: `↑`/`↓` move between rows, `Enter` opens a row, and `Tab` moves into a row's actions.
- **Locations (M1 table, step 3):** the FR-14 columns, with aisle, occupied/empty and best filters, and an occupancy line such as "86.8% occupied · 198 of 228 locations · 30 empty". Occupancy is shown in words and counts, never by colour alone. `?aisle=&loc=` sets the filter and focuses and scrolls to that row through `lib/view-state`.
- **Pick groups (step 4):** columns part A, part B, shared jobs, each part's aisle, and "Same aisle" (ink, with the link icon) or "Different aisles", in server order. Empty state: "No pick groups: no two parts share 5 or more jobs in the period."
- **PartPanel (`components/common/`, 400px side panel):** shows the number, description, class with glyph, picks with the threshold ("61 picks in the period (24 or more)"), total stock, current and other locations as `LocationChip`s, and pick groups. A `LocationChip` is a Barlow code, 24px high, with an ink outline, and opens with the keyboard. Opening the panel moves focus to its heading; `Esc` closes it and returns focus to the opener. The URL carries `?part=`. In M1, a chip opens the Locations table filtered to that aisle with the row focused; the wall comes in Epic 10. Keep in place and Manual move… arrive in later epics.
- **SearchField (`components/common/`, in the Parts and Locations headers):** results list parts and locations apart. A part opens the part panel; a location opens the Locations table at its aisle with the row focused. No match reads "No part or location matches “xyz”." `Ctrl+/` (`⌘/`) focuses the field, but a plain `/` never does. `Esc` clears the field, then blurs it.
- **Copy:** glossary terms are used verbatim, in sentence case, with thousands separators. There are no emoji or Unicode glyphs; glyphs are SVG paths. Every plan surface shows the data-as-of date.

## Cross-Story Dependencies

- This epic builds on Epic 1: the stored import and `analysis`, `app.plans.create`, the shell, flow bar, tokens, ClassGlyph, `lib/view-state`, the error envelope, and overview class counts that are zero until 2.1.
- Within the epic, 2.1 and 2.2 (analysis) feed 2.3–2.6. Story 2.3 adds the shared facts to `domain/planning.py` and creates `BinSwatch` and `DataTable`. Stories 2.4 and 2.5 reuse `DataTable`. Story 2.6 uses 2.3–2.5: the panel opens from roster rows, pick-group parts and search results, and its chips and search results open the Locations table from 2.4.
- Later epics extend this work:
  - Epic 3 fills `is_best`/best filters and counts.
  - Epic 4 turns `planning_copy` into a replay of moves, adds Manual move… to the PartPanel, and makes these views follow the planning copy.
  - Epic 5's rules read the classify and pick-group results (an allowed import exception).
  - Epic 7 adds keep in place.
  - Epic 10 points location chips and search results to the wall.
