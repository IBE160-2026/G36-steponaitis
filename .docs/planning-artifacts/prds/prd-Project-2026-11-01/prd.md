---
title: "PRD: Smart Warehouse Planner"
status: final
created: 2026-11-01
updated: 2026-11-14
---

# PRD: Smart Warehouse Planner

## 0. Document Purpose

This PRD defines what Smart Warehouse Planner must do. It is written for the author (developer and primary user), for the IBE160 examiners who follow the trail from plan to code, and for the next BMad steps (UX, architecture, epics and stories). It builds on the final product brief and its addendum in `.docs/planning-artifacts/briefs/brief-Project-2026-09-27/`, and on the teacher's feedback in the same folder (`tilbakemelding-product-brief.md`, 2026-10-06). It does not repeat their background.

The rules in the brief's addendum are carried into the requirements here. Where this PRD differs from the brief or its addendum, this PRD wins; every difference is listed in §10. Vocabulary is fixed in §3 Glossary and used verbatim. Key screens are outlined in §4.0, and features are grouped in §4, core first and stage 2 after, with globally numbered requirements (FR-1 …) that later documents can refer to. Details first inferred while writing and then confirmed by the author (2026-11-02) are listed in §11. Rationale and rejected alternatives are in `addendum.md` next to this file; the review and reconciliation reports (`review-*.md`, `reconcile-*.md`) are in the same folder.

## 1. Vision

Smart Warehouse Planner is a browser-based planning tool for a spare-parts warehouse. The planner imports the three Excel files the warehouse already exports (locations, inventory and transaction history). The tool shows which part is where, classifies every part by how often it is picked, and finds parts that are used on the same jobs. From that, and from the locations the planner marks as best, it recommends moves: fast-moving parts into the best locations, slow-moving parts and dead stock out of them, and pick-group partners into the same aisle. Every recommendation names the rule and the numbers behind it.

**The tool suggests; the planner decides.** Nothing touches the company's main system. Recommendations are tried in a planning copy of the warehouse, the planner can apply, adjust or decline each one, and a before/after table per aisle shows the result before anything is physically moved. The finished plan prints as a move list in round order, which colleagues carry out with a tick box per line, one walk per round. Plans are saved and shared, so a planner can come back to a plan, run another round and print again.

The data needed to place parts by usage already exists in the warehouse's own exports; it is not used for placement. With AI-assisted development, a focused tool that uses it is within reach of one person in one semester (IBE160 *Programmering med KI*, Høgskolen i Molde, autumn 2026). The course version runs on synthetic demo data only.

## 2. Target User

### 2.1 Jobs To Be Done

**Planner (primary: the author)**
- When placement has drifted away from how parts are actually used, I want a data-backed plan for which parts to move where, so I can rearrange without spending labor on a hunch.
- When I look at a recommendation, I want to see the rule and the numbers behind it, and to decline it when I know better, so the plan only holds moves I trust.
- When I ask "what is in this aisle?", "how full is it?" or "which parts barely move?", I want the answer without combining three Excel files.
- When the plan is ready, I want to hand colleagues a list they can follow without me, so the moves get done in the right order.

**Colleague (secondary: does not use the app)**
- When I carry out a re-slotting, I want a printed list in walk order with a box to tick, so I know what to move and never arrive at a location that has not been emptied yet.
- Day to day, I want parts that are used together and picked often to sit close and in best locations (and, in stage 2, locations with clear labels), so I find them faster.

**Other planners (later)**
- Up to about 10 users in total open, continue and print the same shared plans.

### 2.2 Non-Users (v1)

- **Anyone who needs live stock figures.** The company's main system stays the source of truth; the tool is only as current as its latest import.
- **Examiners.** They are not a target user of the product (teacher feedback, 2026-10-06); they run the demo flow through the README.
- **Other warehouses in the company, and handheld users.** Vision only (brief, Vision).

### 2.3 Key User Journeys

*Drafted from the brief and addendum; confirmed by the author 2026-11-02.*

- **UJ-1. Justas builds a re-slotting plan from a fresh export.**
  Justas, the warehouse planner, suspects the fast-moving parts have drifted to the far aisles and has a fresh export of the three files. On the saved-plans list Justas clicks New Plan, names it "Autumn re-slot" and uploads the files. The import passes and the plan opens with its data-as-of date, movement classes and pick groups. Justas marks aisle A and level 1 in all aisles as best and runs the recommendations. Round 1 lists rule 1, 2 and 3 recommendations, each with its reason, and a few parts with "no space". Justas applies most of them, applies one with another suggested location, marks one part "keep in place" because it would not fit physically, and makes one manual move. **Climax:** the before/after table shows, aisle by aisle, more fast-moving parts in best locations and more pick groups in the same aisle, and which parts move in and out. **Resolution:** the plan is saved automatically; Justas runs round 2 to use the best locations that the rule 2 moves freed. **Edge case:** the Inventory file lacks the Quantity column; the import stops with a message naming the file and the column, nothing is saved, and Justas fixes the export and uploads again.
  *Realized by FR-1, FR-3–FR-8, FR-10, FR-13–FR-33, FR-37, FR-42.*

- **UJ-2. A colleague carries out the move list.**
  Justas prints the move list from the plan. A colleague takes the printout; the header shows the plan name, the data-as-of date and when it was generated. The colleague works through round 1 from top to bottom, moving each part from its from-location to its to-location and ticking the box; a line into a location always comes after the line that empties it. Then the colleague starts on round 2, whose moves use locations that round 1 freed. **Edge case:** a part is not at its from-location because someone moved it after the export; the colleague notes it on the printout and Justas decides. The tool does not track whether moves were carried out.
  *Realized by FR-38.*

- **UJ-3. Justas continues a saved plan a week later.**
  Justas opens the saved-plans list, sees "Autumn re-slot" with its last-edited time, and opens it exactly as it was left: marks, moves, rounds and recommendations. Justas undoes the last manual move, applies two more recommendations and prints again; the new generated-at time tells the new printout from the old one. To try a different set of best locations without losing this plan, Justas starts a New Plan from the same import. **Edge case (if time allows):** another planner saves a change to the same plan while Justas has it open; Justas's next change shows a warning, and the last save wins.
  *Realized by FR-2, FR-8–FR-10, FR-30, FR-35, FR-38, FR-40; if time allows also FR-41.*

## 3. Glossary

Downstream documents use these terms exactly.

**Data and the warehouse**

- **Import** — the three files a plan is built from: the **Locations file**, the **Inventory file** and the **Transactions file** (in the demo data `Locations.xlsx`, `Inventory.xlsx` and `transactions.xlsx`). An import is frozen: nothing in the app changes it. One import can be used by several plans.
- **Data-as-of date** — the newest transaction date in the Transactions file: the date the import's data is current to. Shown together with the date the import was uploaded.
- **Part** — an item identified by its part number, kept as text exactly as in the files (e.g. `2007060`, `1008614-00`).
- **Location** — a shelf location listed in the Locations file, with a location code (e.g. `A-01-02-03`), an aisle, a level and a Walk Path value. Location codes are kept as text and may follow several patterns.
- **Virtual location** — a location that appears in the Transactions file but not in the Locations file, such as `FLSKRS` (and `RETURN-SKRS` in real data). Never a shelf location and never a move's to-location.
- **Aisle** — a group of locations, taken from the Aisle column of the Locations file (A–I in the demo data).
- **Level** — the shelf height of a location, taken from the Level column of the Locations file.
- **Walk Path** — a number per location that orders the locations aisle by aisle and location by location (0 at the first location in aisle A, then 10 more for each next location). An ordering only, not a distance.
- **Text order** — how location codes and part numbers are sorted wherever this PRD says "location-code order" or "part-number order": plain text order, character by character.
- **Stock** — the quantity of a part in a location.
- **Occupied location / empty location** — a location is occupied when it holds at least one part with stock above zero; otherwise it is empty (including when all its inventory rows have stock 0).
- **Occupancy** — the share of locations that are occupied, for an aisle or the whole warehouse.
- **Current location** — for a part in one location, that location; for a part in more than one, the location with the most stock; on equal stock, the one first in location-code order. A part with no stock above zero anywhere has no current location.

**Analysis**

- **Transaction types** — **Move to Repair** (a part is picked from a shelf), **Issue Part** (a part is consumed on a job, at a virtual location), **Return to Stock** (an unused part goes back to a shelf) and **Receipt** (goods received, transaction code `0`). Move to Repair, Return to Stock and Receipt are **shelf lines**.
- **Pick** — one Move to Repair line. No other transaction type is a pick.
- **Period** — the 12 months up to and including the newest transaction date in the import. It starts the day after the same date one year earlier. A transaction counts by its date only; the time of day is ignored (decision 2026-11-11).
- **Picks** — the number of picks of a part in the period, across all its locations.
- **Movement class** — one of four classes from a part's picks: **fast-moving** (24 or more), **medium-moving** (6–23), **slow-moving** (1–5) and **dead stock** (0).
- **Job** — all Issue Part lines in the period that share a transaction code (called "transaction number" in the brief). Transaction code `0` is never a job.
- **Shared jobs** — the number of jobs on which two parts both appear.
- **Pick group** — two parts with 5 or more shared jobs. Each part is the other's **partner**.
- **Settings** — the period length, the class limits and the pick-group minimum, kept outside the rule logic so they can be tuned.

**Plans and recommendations**

- **Plan** — one import, the planner's best-location marks and keep-in-place marks, and the planning copy with its moves and recommendations. Has a name, a data-as-of date, and who created and last edited it. Plans are shared by all users.
- **Best-location mark** — a mark the planner sets on a whole aisle, a level (in all aisles or in one aisle) or a single location.
- **Best location** — a location covered by at least one best-location mark. Comes only from marks, never from Walk Path.
- **Planning copy** — the plan's own working state of the warehouse: the import plus all moves. All edits happen here.
- **Move** — a change in the planning copy that moves a part's stock from one location (the **from-location**) to another (the **to-location**). Every move has a rule and a round.
- **Manual move** — a move the planner makes by hand, with the rule **Manual**.
- **Run** — one execution of the recommendation rules on the planning copy's current state.
- **Recommendation** — a suggested move from a run: part, current location, **suggested location** and rule. Applying it creates a move.
- **Rule** — the reason for a move: **rule 1** (fast-moving part into a best location), **rule 2** (slow-moving or dead-stock part out of a best location), **rule 3** (part moved into its partner's aisle) or **Manual**.
- **"No space"** — the outcome for a part that a rule applies to when no empty location fits. Not a recommendation.
- **Outdated recommendation** — a recommendation that can no longer be applied (FR-29).
- **Keep in place** — a mark the planner sets on a part in a plan to decline its recommendations; later runs and "Apply all" leave the part alone.
- **Round** — the number every move carries. Each run starts a new round (round 1, 2, …). An applied recommendation gets the round of its run; a manual move gets the **current round**, which is the round of the latest run since the last reset, or round 0 if there is none. Moves are carried out in round order, because a later round may use a location that an earlier round frees; colleagues make one walk per round.
- **Before/after table** — a per-aisle comparison of the import ("before") and the planning copy ("after").
- **Move list** — the printable list of a plan's moves.

**People (and stage 2)**

- **Planner** — a person who uses the app to plan placement. Once login exists (milestone 2), every user is a planner.
- **Colleague** — a warehouse worker who carries out a printed move list; does not use the app.
- **User** — a person with an account who logs in to the app (milestone 2).
- **Demo version** — the public deployment's way into the app without typing a login: it logs the visitor in as the seeded demo account (FR-50).
- **Category** (stage 2) — a kind of part (e.g. Filters), given by keyword rules.
- **Keyword rule** (stage 2) — a mapping from a keyword in the part description to a category, in an order the planner sets.
- **Aisle categories** (stage 2) — the categories the planner assigns to an aisle.
- **Category check** (stage 2) — the list of parts whose category is not among their aisle's categories.
- **Warehouse view** — a visual view of all aisles, drawn shelf by shelf, with occupancy, movement classes and best locations (FR-42).
- **Location label** (stage 2) — a printed label with a location code and its QR code.

## 4. Features

Core features (4.1–4.10, FR-39–FR-40 and FR-50 in 4.11, and 4.12) are built, tested and stable before any stage 2 feature (4.13, 4.14) or "if time allows" item (FR-41, §7.5) is started; the core itself is built in two milestones (§7.1).

### 4.0 Key screens

An outline for the UX step, which decides layout and navigation. Core: **saved-plans list** (start page, New Plan button); **New Plan** (name, three files or an existing plan's import, import errors); **plan overview** (data-as-of date, settings, counts); **parts** and **locations** (lists, search, manual move); **warehouse view** (aisles drawn shelf by shelf; also shows where a recommendation moves a part); **pick groups**; **best locations** (marking); **recommendations** (run, list per rule with reasons, apply, apply all, apply with another suggested location, keep in place, "no space", outdated); **before/after table**; **move list** print view; **login** and **create account** (milestone 2); on the public deployment only, a **demo front page** in front of the app, with **Demo version** (NFR-5, FR-50). Stage 2: category settings and category check; location label print view.

### 4.1 New Plan and import

**Description:** New Plan is the entry point of the flow. The planner names the plan and either uploads the three files or reuses the import of an existing plan. The import is checked before anything is saved, so a plan never rests on a half-imported file. Realizes UJ-1.

#### FR-1: Start a New Plan from uploaded files

The planner can start a New Plan by giving it a name and uploading a Locations file, an Inventory file and a Transactions file. Realizes UJ-1.

**Consequences (testable):**
- Files in `.xlsx` format, or `.csv` in UTF-8 with a header row and comma or semicolon as delimiter, are accepted. There is no column-mapping screen.
- A plan is only created when all three files pass FR-3 to FR-5.
- When the import succeeds, the plan opens with movement classes and pick groups already computed.
- Running New Plan on the demo files in `data/sample/` succeeds without errors.

#### FR-2: Start a New Plan from an existing plan's import

The planner can start a New Plan that reuses the import of an existing plan instead of uploading files. Realizes UJ-3.

**Consequences (testable):**
- The new plan has the same import as the chosen plan, and none of its best-location marks, keep-in-place marks, moves or recommendations.
- The new plan is computed with the current settings. With unchanged settings it gives the same movement classes and pick groups as the chosen plan, and with the same best-location marks and no moves its first run gives the same recommendations as the chosen plan's first run.

**Out of Scope:**
- Starting a plan from another plan's planning copy (its result). After moves are carried out, a fresh export from the main system is the source of truth.

#### FR-3: Reject files with missing required columns

The system checks each file for its required columns before saving anything.

**Consequences (testable):**
- Required columns (other columns are optional):
  - Locations file: Location, Walk Path, Aisle, Level.
  - Inventory file: Part, Part Description, Quantity, Location.
  - Transactions file: Transaction Type, Part, Location, Transaction Code, Date.
- Column names match ignoring upper/lower case and surrounding spaces.
- A file missing a required column gives an error message that names the file and the column, and no data from the import is saved.

#### FR-4: Reject invalid values

The system checks the values in the required columns before saving anything.

**Consequences (testable):**
- The import is rejected, with a message naming the file, row and column, when a required cell is blank; when Quantity is not a number or is negative; when Walk Path is not a number; when Date cannot be read as a date; or when the same location code appears twice in the Locations file.
- A file that cannot be read as `.xlsx` or `.csv` is rejected with a message naming the file.
- Nothing from a rejected import is saved.

#### FR-5: Check the locations in the import

The system checks that every inventory row and shelf line refers to a location in the Locations file.

**Consequences (testable):**
- An Issue Part line at a virtual location (e.g. `FLSKRS`) is accepted.
- An inventory row, or a shelf line (Move to Repair, Return to Stock, Receipt), whose location is not in the Locations file rejects the import with a message naming the file, the row and the location, and nothing is saved.
- Lines with other transaction types are accepted and ignored by the analysis.

#### FR-6: Normalize the imported data

The system keeps the imported values as they are and merges true duplicates.

**Consequences (testable):**
- Part numbers and location codes are stored as text exactly as in the files (leading zeros and suffixes such as `-00` kept).
- Location codes of several patterns are accepted (e.g. `A-01-02-03`, `A-01-01-01-A1`, `06-01-30-D1`).
- Inventory rows that repeat the same part in the same location are merged into one, with the quantities added.
- One import holds one warehouse: if a Warehouse column holds more than one value, the import is rejected with a message naming the file.

#### FR-7: Record the data-as-of date

Each plan records the data-as-of date of its import and the date the import was uploaded.

**Consequences (testable):**
- The data-as-of date is the newest transaction date in the Transactions file.
- Both dates are shown on the plan, in the saved-plans list and on the move list.

### 4.2 Saved plans

**Description:** Every plan is saved and shared. The saved-plans list is the home of the app: it shows all plans and has the New Plan button. A plan reopens exactly as it was left and can be edited again at any time, even after it has been printed. Realizes UJ-3.

#### FR-8: Saved-plans list

The planner can see all saved plans and start a New Plan from the list. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- Each plan shows its name, data-as-of date, created by, created at, last edited by and last edited at.
- Plans are listed with the most recently edited first.
- The list is the start page of the app (from milestone 2 it is the page a user lands on after login, FR-40; on the public deployment the demo front page comes first, NFR-5).

#### FR-9: Reopen a plan with identical state

The planner can open any saved plan and continue editing it. Realizes UJ-3.

**Consequences (testable):**
- A reopened plan has identical best-location marks, keep-in-place marks, moves (with rules and rounds), recommendations (including outdated ones), "no space" parts and current round.
- A plan stays editable after its move list has been printed; there is no locking.

#### FR-10: Save automatically

Every change to a plan is saved automatically. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- A change (best-location mark, keep-in-place mark, run, applied recommendation, move, undo, reset) is saved without a Save button; reloading the page shows it.

**Out of Scope:**
- Warning when two people edit the same plan at the same time: if time allows (FR-41). Live collaboration is not planned at all.

#### FR-11: Record who created and last edited a plan

Every plan records who created it and who last edited it, from the first version.

**Consequences (testable):**
- Before login exists (milestone 1), both fields hold the fixed value `planner`.
- From milestone 2, both fields hold the logged-in user (FR-40).

#### FR-12: Delete a plan

The planner can delete a plan after confirming.

**Consequences (testable):**
- Delete asks for confirmation; cancelling leaves the plan unchanged.
- Delete is permanent; there is no archive.
- Deleting one plan leaves every other plan unchanged, including plans that reuse its import (FR-2).
- The stored import files are deleted when no remaining plan uses them.

### 4.3 Parts, locations and search

**Description:** The planner can see the warehouse as the plan has it now: every part, every location, which part is where and the occupancy of each aisle. The views show the planning copy, so they change as moves are made; the import ("before") is shown in the before/after table (FR-37). Realizes UJ-1.

#### FR-13: Parts list

The planner can see every part in the Inventory file.

**Consequences (testable):**
- Each part shows part number, part description, total stock, current location, any other locations, movement class, picks, number of pick groups and whether it is kept in place.
- The list can be filtered by movement class and sorted by picks.

#### FR-14: Locations list

The planner can see every location in the Locations file, which parts are in it and the occupancy of each aisle.

**Consequences (testable):**
- Each location shows its code, aisle, level, Walk Path, occupied or empty, best location or not, and each part stored there with its stock.
- A location whose inventory rows all have stock 0 is shown as empty, and a rule can suggest it.
- For each aisle and for the whole warehouse, the number of occupied and empty locations and the occupancy are shown.
- The list can be filtered by aisle, by occupied/empty and by best location.

#### FR-15: Search

The planner can search for parts and locations from one search field.

**Consequences (testable):**
- Search matches part numbers, part descriptions and location codes, as partial text and ignoring upper/lower case.
- A result opens the part or the location, from where the planner can make a manual move (FR-33).

### 4.4 Movement classification

**Description:** Every part in the Inventory file gets a movement class from its picks in the period. Classes come from the import only, so they do not change when moves are made. Realizes UJ-1.

#### FR-16: Count picks in the period

The system counts each part's picks in the period.

**Consequences (testable):**
- Each Move to Repair line in the period counts as one pick, whatever its quantity.
- Issue Part, Return to Stock and Receipt lines never count as picks.
- Lines dated outside the period do not count; a line on the newest transaction date counts, and a line on the same date one year earlier does not.

#### FR-17: Classify every part

The system gives every part in the Inventory file exactly one movement class.

**Consequences (testable):**
- 24 or more picks → fast-moving; 6–23 → medium-moving; 1–5 → slow-moving; 0 → dead stock.
- The answer-key test dataset (§7.3) gets exactly its expected classes, including the boundary values 0, 1, 5, 6, 23 and 24.
- Parts that appear in the Transactions file but not in the Inventory file are not classified or shown.

#### FR-18: Keep thresholds as settings

The thresholds are settings, separate from the rule logic.

**Consequences (testable):**
- The period length, class limits and pick-group minimum are read from settings; changing a setting changes the results without changing code.
- Settings are changed in a configuration file, not in the app. (The colours in the warehouse view's key are a display choice, changed in the view itself: FR-42.)
- Each plan stores the settings it was computed with and shows them (period start and end, class limits, pick-group minimum), so a saved plan reopens with identical results even if the settings change later.

### 4.5 Pick-together analysis

**Description:** Parts that are often used on the same job, such as an air filter and a cabin filter, are found from shared transaction codes on Issue Part lines. This uses data analysis, not a language model. Realizes UJ-1.

#### FR-19: Find pick groups

The system finds every pick group in the import.

**Consequences (testable):**
- Two parts that appear together on 5 or more jobs in the period form a pick group; two parts with 4 shared jobs do not.
- A part that appears several times on the same job counts once for that job.
- Transaction code `0` never forms a job.
- Only parts in the Inventory file are considered.
- The answer-key test dataset gets exactly its expected pick groups, including a part in several pick groups.

#### FR-20: Show pick groups

The planner can see all pick groups and each part's pick groups.

**Consequences (testable):**
- Each pick group shows both parts (part number and description), the number of shared jobs, the aisle of each part's current location in the planning copy, and whether they are in the same aisle.
- The list is sorted by shared jobs, most first.

### 4.6 Best locations

**Description:** The planner says which locations are best; the tool never guesses. Marks can be set on whole aisles, on levels and on single locations, and removed again. Realizes UJ-1.

#### FR-21: Mark and unmark best locations

The planner can set and remove best-location marks in a plan.

**Consequences (testable):**
- The planner can mark a whole aisle, a level in all aisles, a level in one aisle, or a single location.
- A location in a marked aisle, in a marked level, or marked on its own is a best location; all other locations are not.
- Removing one mark leaves a location best if another mark still covers it.
- Marks are stored in the plan and never change the import.

#### FR-22: Show best locations

The planner can see which locations are best.

**Consequences (testable):**
- The locations list (FR-14), the warehouse view (FR-42) and the before/after table (FR-37) show which locations are best.
- The plan shows the number of best locations and of empty best locations.

### 4.7 Recommendations

**Description:** A run applies three ordered rules to the planning copy's current state and suggests moves into empty locations only. Each recommendation states its rule and its reason in numbers, so the planner can check it. Rule 2 frees best locations only once its moves are applied and the recommendations are run again, so a plan is built in rounds. Realizes UJ-1, UJ-3.

#### FR-23: Run the recommendations

The planner can run the recommendations at any time on the plan's planning copy.

**Consequences (testable):**
- Each run starts a new round: the first run is round 1, the next round 2, and so on. After a reset (FR-35) the next run is round 1 again.
- A run replaces all recommendations and "no space" parts from earlier runs that were not applied.
- A run uses the current locations and occupancy of the planning copy, the current best-location marks and the keep-in-place marks. Movement classes and pick groups come from the import.
- Two runs on the same state give the same recommendations, in the same order.

#### FR-24: Rule 1 — fast-moving parts into best locations

A fast-moving part whose current location is not a best location gets a recommendation to an empty best location.

**Consequences (testable):**
- Parts are taken in order of most picks first; parts with the same picks in part-number order.
- Empty best locations are offered in location-code order.

#### FR-25: Rule 2 — slow-moving parts and dead stock out of best locations

A slow-moving or dead-stock part whose current location is a best location gets a recommendation to an empty location that is not a best location.

**Consequences (testable):**
- Parts are taken in order of fewest picks first, then in part-number order.
- Empty locations are offered in location-code order.
- A best location that a rule 2 move frees is offered to rule 1 only in a later round, after the move is applied and the recommendations are run again.

#### FR-26: Rule 3 — partners into the same aisle

When the two parts of a pick group have current locations in different aisles, the part with fewer picks gets a recommendation to an empty location in its partner's aisle.

**Consequences (testable):**
- Pick groups are taken in order of most shared jobs first; ties are broken by the lower part number of the two parts, then by the higher, in part-number order.
- When both parts have the same picks, the part that comes later in part-number order is the one that moves.
- Empty locations in the partner's aisle are offered in location-code order.
- A slow-moving or dead-stock part is never offered a best location, so rule 3 and rule 2 cannot undo each other's moves round after round (decision 2026-11-02). If every empty location in the partner's aisle is a best location, the part is listed as "no space" under rule 3 (decision 2026-11-11).
- The pick group gets no recommendation, and is not listed as "no space", when:
  - the part that would move sits in a best location (rule 3 never moves a part out of a best location);
  - the part that would move is already in the aisle of another partner it shares at least as many jobs with, so a part in several pick groups is not moved back and forth between rounds (decision 2026-11-02);
  - the partner already has a recommendation in this run, because it may leave its aisle; a later round handles the pick group (decision 2026-11-02);
  - either part has no current location, or the part that would move is kept in place.
- The partner is never moved instead.

#### FR-27: Limits on recommendations, and "no space"

The rules are applied in the order rule 1, rule 2, rule 3, with fixed limits.

**Consequences (testable):**
- Only empty locations in the planning copy are suggested; virtual locations never are.
- Parts with no current location, and parts kept in place, are skipped by all rules.
- A part gets at most one recommendation per run; a part that already has one gets none from a later rule, nor from its other pick groups under rule 3. Such a pick group is skipped silently: no block and no "no space" (decision 2026-11-11).
- Each empty location is suggested to at most one part per run.
- When a rule applies to a part but no empty location fits, the part is listed once as "no space" with that rule, and later rules skip it in the same run; for example, a part that is "no space" under rule 1 gets no rule 3 entry (decision 2026-11-11).
- The answer-key test dataset gets exactly its expected recommendations and "no space" parts, in round 1 and round 2.

#### FR-28: Explain each recommendation

Each recommendation shows the part, part description, current location, suggested location, rule and the reason in numbers.

**Consequences (testable):**
- Rule 1 and rule 2 recommendations show the movement class, the picks and the threshold (e.g. "fast-moving: 31 picks in the period (24 or more)").
- Rule 3 recommendations show the partner, the partner's aisle and the number of shared jobs (e.g. "pick group with 2007060: 12 shared jobs (5 or more)").
- "No space" parts show the rule and the same reason.

#### FR-29: Mark outdated recommendations

A recommendation that a later change has made invalid is shown as outdated.

**Consequences (testable):**
- A recommendation becomes outdated when its part has been moved; when its suggested location is no longer empty; when a change to the best-location marks means its rule no longer holds; or after any undo (FR-35).
- An outdated recommendation cannot be applied, and stays outdated until the next run.

### 4.8 Planning copy and moves

**Description:** The planner applies, adjusts or declines recommendations and makes manual moves in the planning copy. Moves can be undone from the latest backwards, and the import never changes. Realizes UJ-1, UJ-3.

#### FR-30: Apply recommendations

The planner can apply one recommendation, or all recommendations of the latest run at once.

**Consequences (testable):**
- Applying a recommendation creates a move with its rule and the round of its run.
- "Apply all" applies every recommendation of the latest run that is neither applied nor outdated; "no space" parts and parts kept in place are skipped.

#### FR-31: Apply a recommendation with another suggested location

Instead of the suggested location, the planner can apply a recommendation with another location that still fits its rule.

**Consequences (testable):**
- The other location must be empty in the planning copy now, must have been empty when the run was made, and must fit the rule: a best location for rule 1; a location that is not best for rule 2; a location in the partner's aisle for rule 3, and not a best location if the part is slow-moving or dead stock.
- The move keeps the recommendation's rule and round.
- The choice is made when applying; it is not stored as an edit of the recommendation. Any other placement is a manual move (FR-33).

#### FR-32: Keep a part in place

The planner can decline a recommendation by marking its part "keep in place", for example when the part would not fit physically. Realizes UJ-1.

**Consequences (testable):**
- The planner can set the mark from a recommendation or from the part, and remove it again.
- A part kept in place gets no recommendation and no "no space" entry in later runs, and "Apply all" skips it.
- Parts kept in place are listed in the plan with their count.
- The planner can still make a manual move of a kept part.

#### FR-33: Make a manual move

The planner can move a part from one of its locations to any location in the Locations file.

**Consequences (testable):**
- The to-location may be empty or occupied.
- The move gets the rule Manual and the current round (round 0 before the first run).
- The move moves all of the part's stock at the from-location; the part's other locations are unchanged. Quantities are never split.
- A virtual location, or the from-location itself, cannot be the to-location.
- If the to-location already holds the same part, the stock is added together.

#### FR-34: Combine two moves of a part in one round

A part moved twice in the same round, through a location it was not in before, gets one move instead of two.

**Consequences (testable):**
- When a part is moved again from the to-location of its move in the current round, and that to-location held none of the part before the first move, the two moves become one move from the first from-location to the new to-location, with the rule Manual.
- When such a part is moved back to its first from-location, the move is removed.
- In every other case the moves stay separate.

#### FR-35: Undo and reset

The planner can undo moves and reset the planning copy.

**Consequences (testable):**
- Undo reverses the most recent move (an applied recommendation, a manual move, or the second step of a combination under FR-34, which restores the state before that step). It can be repeated back to the first move. A move in the middle cannot be removed on its own.
- Undo does not reverse runs, best-location marks or keep-in-place marks; marks are removed by unmarking.
- After any undo, all recommendations of the latest run that are not applied become outdated, and an undone recommendation does not come back until the next run.
- Reset asks for confirmation, then removes all moves, recommendations and "no space" parts; the current round becomes 0. Best-location marks and keep-in-place marks are kept.

#### FR-36: Never change the import

No action in a plan changes the import.

**Consequences (testable):**
- After any sequence of moves, undo and reset, the import (locations, inventory, transactions) is identical to what was uploaded.
- Movement classes and pick groups do not change when moves are made.

### 4.9 Before/after table

**Description:** The before/after table is how the planner judges a plan before anything is physically moved: what moves in and out of each aisle, whether fast-moving parts end up in best locations, and whether pick groups end up together. Both "before" and "after" use the current best-location marks. Realizes UJ-1.

#### FR-37: Show a before/after table per aisle

The planner can see, for each aisle and for the whole warehouse, the import ("before") next to the planning copy ("after").

**Consequences (testable):**
- For each aisle, the table lists the parts that move in (stock in the aisle in the planning copy but not in the import) and the parts that move out (the reverse).
- The table shows the number of fast-moving parts in best locations before and after. A part counts once, in the aisle of its current location, and counts as in a best location when its current location is best.
- The table shows the number of pick groups whose two parts have current locations in the same aisle, before and after, per aisle and in total.
- The table updates after every move, undo and reset.

### 4.10 Move list

**Description:** The plan prints as a move list in a browser print view, so colleagues can carry out the moves in an order where every location is emptied before a part is moved into it. Realizes UJ-2.

#### FR-38: Print the move list

The planner can open a print view of the plan's move list and print it from the browser.

**Consequences (testable):**
- The list contains exactly the plan's moves (after FR-34), no more and no fewer.
- Each line shows round, part, part description, from-location, to-location, rule and a tick box.
- Lines are ordered by round. Within a round, a line into a location comes after every line in that round that moves a part out of that location; otherwise lines follow the Walk Path of the from-location, then part-number order. Where lines form a cycle (for example two parts swapping locations), those lines follow Walk Path order (decision 2026-11-02).
- Within a round, no line moves a part into a location that a later line in the same round moves a part out of, except in a cycle.
- The header shows the plan name, the data-as-of date, the upload date, the number of rounds and the time the list was generated.
- A plan with no moves shows that there are no moves to print.

**Out of Scope:**
- PDF or CSV export; tracking who printed a list or whether it was carried out.

### 4.11 Accounts and login (core, milestone 2; FR-41 if time allows)

**Description:** Login tracks who uses the app and gives it a more professional look. Anyone can create an account. Plans stay shared: every user sees, edits and deletes every plan. With separate users, the app also warns when two people edit the same plan (if time allows). Accounts, login and the demo version moved into the core on 2026-11-14 (UX step); the section keeps its number so the FR IDs stay.

#### FR-39: Create an account

Any person with access to the app can create an account and use the app.

**Consequences (testable):**
- An account needs a username and a password; usernames are unique and use letters and numbers only. No email address is needed.
- The password is typed twice when the account is created, and the two must match (there is no password reset).
- Passwords are stored hashed, never in plain text.
- There are no roles, no admin and no password reset.

#### FR-40: Log in and out

A user can log in and log out.

**Consequences (testable):**
- Every page except login, create account and, on the public deployment, the demo front page (NFR-5) requires login.
- After login, the user lands on the saved-plans list (FR-8).
- Log out returns to the login page; on the public deployment, to the demo front page.
- Plans record the logged-in user as created by and last edited by (FR-11).
- The README lists a seeded demo account so examiners can log in without creating one.

#### FR-50: Open the demo version without logging in

On the public deployment, a visitor can skip the login: **Demo version** on the demo front page, and on the login page, opens the app as the seeded demo account. Numbered FR-50 because requirement IDs are global and FR-49 is withdrawn; it sits here because it belongs with login.

**Consequences (testable):**
- Demo version goes straight to the saved-plans list (FR-8), with no login page and no password.
- The visitor is logged in as the seeded demo account (FR-40), so created by / last edited by show that account (FR-11), and Log out works as for any user.
- Plans stay shared (§4.11): the demo account sees the same plans as every other user. No plan is preloaded; a first-time visitor uploads the files from `data/sample/` in New Plan (UJ-1).
- A local install has no demo front page and no Demo version; there the README's demo account is used (NFR-2).

#### FR-41: Warn when two people edit the same plan (if time allows)

A user who changes a plan that someone else has saved since the user opened it is warned. Realizes UJ-3.

**Consequences (testable):**
- The warning says the plan has changed and offers to reload it.
- If the user continues, the user's version of the whole plan is saved and the other user's changes since then are lost (last save wins).

### 4.12 Warehouse view (core, milestone 2)

**Description:** A visual view of the warehouse as the plan has it now. Each aisle is drawn shelf by shelf, the way it looks from the floor, with occupancy, movement classes and best locations. The planner uses it to look at locations and to see where a recommendation moves a part. It shows the planning copy of the open plan and does not rely on colour alone. Part of the core since the UX step (decision 2026-11-13); the section keeps its number so that FR-42 keeps its ID. Realizes UJ-1.

#### FR-42: Show the warehouse view

The planner can see all aisles with their locations, occupancy, movement classes and best locations.

**Consequences (testable):**
- Each aisle is drawn by section and level, with one place for every location in the Locations file.
- Occupancy is shown by shape and text, not by red/green colour: an occupied location is drawn filled, an empty location is drawn as an open, empty place, and its tooltip says occupied or empty.
- Colour is reserved for movement class: each part stored in a location shows its movement class by colour and by a symbol, so the class can also be read without colour.
- Best locations are marked with a green rail or frame and the text BEST.
- Each location has a tooltip with the location code, its level, whether it is a best location, and the parts stored there with movement class, picks and stock. The tooltip can also be opened with the keyboard.
- Occupancy is shown for each aisle and for the whole warehouse, as a percentage and as occupied and empty counts.
- From a recommendation, the planner can see the part's current location and the suggested location in the warehouse view.
- The view shows the plan's planning copy and updates after every move, undo and reset.
- The view has a key that names each movement class with its colour and symbol, and shows best location, selection and empty. Clicking a colour entry in the key (or choosing it with the keyboard) opens a colour chooser for that colour: each movement class, best locations and selection. The view shows the new colour at once (user decision 2026-11-13, UX step).
- Symbols, the text BEST and all other text stay the same when a colour is changed, so no information depends on the chosen colours (NFR-10). Key entries without a colour (such as empty) are not clickable.
- When a chosen colour has less than 3:1 contrast against a background it is drawn on, or two chosen colours are hard to tell apart (the threshold is set in the UX spec), a warning says so; the planner can still keep the colour. Each colour can be reset to its default.
- Chosen colours are kept in the browser and survive a reload. They change no plan, no import and no analysis result, and the printed move list stays black and white.

### 4.13 Category check (stage 2)

**Description:** Some parts are put away in aisles meant for other kinds of parts. The category check finds them from keywords in the part description. Categories never come from part numbers, because part numbers change over time. The check is applied without AI, so it gives the same result every time. Keyword rules and aisle categories are global: one set is shared by all plans. The starter keyword list for the demo data is drafted with AI (Claude Code) during development and checked by the author before it is committed.

#### FR-43: Manage keyword rules

The planner can create, edit, delete and reorder keyword rules.

**Consequences (testable):**
- A keyword rule maps one keyword to one category (e.g. "filter" → Filters).
- Keyword rules are global and the same in every plan.

#### FR-44: Give parts a category

The system gives each part the category of the first keyword rule that matches its part description.

**Consequences (testable):**
- Keywords match whole words, ignoring upper/lower case: "oil" matches "Engine oil" but not "Coil spring".
- The first matching rule in the planner's order wins: "Oil filter" is a filter only if the "filter" rule comes before the "oil" rule.
- A part with no matching rule has no category.

#### FR-45: Assign categories to aisles

The planner can assign one or more categories to each aisle.

**Consequences (testable):**
- Aisle categories are global and apply to every plan with that aisle.

#### FR-46: Run the category check

The planner can see every part whose category is not assigned to the aisle of its current location in the planning copy.

**Consequences (testable):**
- Parts without a category, and aisles without categories, are not checked.
- The check gives the same result every time for the same plan state, keyword rules and aisle categories.
- Recommendations do not use categories; a recommendation that moves a part into an aisle of another category shows up in the check.

#### FR-47: Ship starter categories for the demo data

The demo setup includes keyword rules and aisle categories for the demo data.

**Consequences (testable):**
- Following the README, the category check runs on the demo data without manual setup.

### 4.14 Location labels (stage 2)

**Description:** Printable labels make locations easy to find and scan.

#### FR-48: Print location labels

The planner can print a label for every location in a chosen aisle.

**Consequences (testable):**
- Each label shows the location code in large text (e.g. `A-01-10-C1`) and a QR code that encodes exactly that location code.
- Labels are printed from a browser print view, one label per location in the aisle, in Walk Path order.
- A QR code scanned with a standard phone camera app returns the location code.

## 5. Cross-Cutting Non-Functional Requirements

- **NFR-1 Separate, testable rules.** Classification, pick groups, recommendations, rounds and move-list order are separate modules. They take data and settings as input, do no database, file or network work, give the same output for the same input, and are tested directly against the answer-key test dataset (§7.3) without the user interface.
- **NFR-2 Runs locally for examiners.** The app installs and runs on a laptop with no paid accounts, API keys, external services or network calls at runtime. The README gives the install and start steps, a step-by-step import of the demo files in `data/sample/`, how to run the tests and the demo account.
- **NFR-3 No AI at runtime.** The app uses no language model or AI service. AI is used only during development.
- **NFR-4 Confidentiality.** The repo is public. Only synthetic data is committed: the demo data made by `data/generate_demo_data.py` and the hand-made answer-key test dataset. The database, uploaded files and real exports (kept only in `data/private/`) are git-ignored and never committed. No real part numbers, files or screenshots go into test data, documentation or `.logs/`.
- **NFR-5 Public deployment is a demo.** The public deployment (Vercel, linked from the README) holds synthetic demo data only; real company data is never uploaded to it (decision 2026-11-02). Real use would need a company-internal setup, outside the course. How the deployment is built is decided in architecture. The public deployment opens on a demo front page: it says what the tool does, shows the flow from import to the printed move list, and offers Log in, Create account and Demo version (FR-39, FR-40, FR-50). It makes no claims about customers, savings or distances, and it carries no synthetic-data notice: the README states that the public deployment holds synthetic data only (user decision 2026-11-14, UX step). A local install opens on the login page; after login, on the saved-plans list.
- **NFR-6 Secrets (milestone 2).** Secrets such as the session key come from environment variables and are never committed; the README explains how to set them for a local run, with an example file that holds no real values.
- **NFR-7 Scale.** Up to about 10 users in total and a few at the same time; no special scaling work.
- **NFR-8 Responsiveness.** On a typical laptop, importing the demo data and computing classes and pick groups takes under 10 seconds, a run takes under 5 seconds, and other actions respond within 1 second.
- **NFR-9 Browsers.** Current desktop versions of Chrome, Edge and Firefox, including their print function. Phones and handheld devices are not supported in v1.
- **NFR-10 Accessibility.** No information is shown by color alone; forms and buttons can be used with the keyboard.
- **NFR-11 Language.** The user interface is in English.
- **NFR-12 Persistence.** Plans, their imports and accounts are stored persistently and survive a restart of the app. The storage technology is decided in architecture.

## 6. Non-Goals (Explicit)

- **Not connected to the main system.** The tool never reads from or writes to the company's main system; it suggests, and the planner decides.
- **No capacity or fit checks.** The data has no size or capacity information, so recommendations cannot check whether a part fits a location; the planner judges that and can keep a part in place.
- **No walking-distance estimates.** Walk Path is an ordering only; distance-based recommendations and savings in meters were dropped.
- **No creating or editing locations.** Locations come from the company system; a location made in the app would have no Walk Path value.
- **No comparing plans, and no plan built from another plan's result.**
- **No live collaboration, roles, permissions or password reset.**
- **No PDF or CSV export**, and no tracking of printing or of moves carried out.
- **No AI-generated explanations.** Each recommendation is explained by its rule.
- **No archive** of deleted plans.
- **No real data on the public deployment.**

## 7. MVP Scope

### 7.1 In Scope: the core, in two milestones

The core is FR-1–FR-40, FR-42 and FR-50. It is built in two milestones so that the teacher's five-step flow is finished and tested on its own before anything is added (decision 2026-11-02).

**Milestone 1: the core flow on one stored plan.** Import, classify, find pick groups, get recommendations, try them in the planning copy.
- FR-1, FR-3–FR-7 (New Plan from files, import checks), FR-10–FR-11 (autosave, created by / last edited by)
- FR-13–FR-15 (parts, locations, search)
- FR-16–FR-20 (movement classification, pick groups)
- FR-21–FR-30, FR-33 (best locations, recommendations, apply, manual moves)
- FR-36–FR-37 (import never changes, before/after table)
- **Build order:** import → classification → pick groups → best locations → rule 1 → planning copy and before/after table → rule 2 and rounds → rule 3. This starts with one simple, explainable rule, as the teacher advised.
- **Gate:** the answer-key tests for these FRs pass, and the README demo of this flow runs on `data/sample/`.

**Milestone 2: saved plans and the move list.**
- FR-2, FR-8, FR-9, FR-12 (saved-plans list, reopen, reuse an import, delete)
- FR-31, FR-32, FR-34, FR-35 (apply with another suggested location, keep in place, combined moves, undo and reset)
- FR-38 (move list)
- FR-42 (warehouse view; moved from stage 2, decision 2026-11-13)
- FR-39–FR-40 (create an account, log in and out; moved from stage 2, decision 2026-11-14) and FR-50 (demo version without login, new 2026-11-14)
- **Gate:** SM-1 and SM-2 pass in full.

### 7.2 Stage 2 (after the milestone 2 gate)

- Category check (FR-43–FR-47)
- Location labels with QR codes (FR-48)

The order inside stage 2 is decided in sprint planning.

### 7.3 Dependency before implementation: the answer-key test dataset

**Status:** made 2026-11-11, in `data/answer-key/` (final location, decision 2026-11-11).

The answer-key test dataset is a small hand-made dataset (about 20 parts, more if the cases need it) with the expected result for each part. It is written before the rules are implemented, and it is committed in `data/answer-key/`. It holds expected movement classes, pick groups, round 1 and round 2 recommendations and "no space" parts, and move-list content and order. It covers at least:
- the class boundaries (0, 1, 5, 6, 23 and 24 picks) and both period boundaries;
- a tie in picks;
- a part stored in two locations (one of them a best location), and a part with equal stock in two locations;
- a part with no stock anywhere, and a location whose inventory rows all have stock 0;
- two parts with exactly 5 shared jobs and two parts with 4;
- a part in several pick groups, a pick group whose partner also gets a recommendation, and a slow-moving part whose partner is in an aisle marked best;
- a part with "no space";
- a best location freed by rule 2 in round 1 and used by rule 1 in round 2;
- a part kept in place;
- an undo after a later run;
- a manual move into a location emptied in the same round, and two parts swapping locations.

### 7.4 Constraints

- **Solo time box.** One person in about two months. Progress is checked early against the milestone 1 list. No stage 2 or "if time allows" item starts before the milestone 2 gate.

### 7.5 Out of Scope for MVP

- **If time allows:** drag-and-drop placement, whole-warehouse optimization, QR/barcode scanning, and the warning when two people edit the same plan (FR-41; moved from stage 2, decision 2026-11-14).
- **Vision (after the course):** an everyday tool, re-run on fresh transaction data to catch parts that have sped up or slowed down; handheld devices; other warehouses in the company.

## 8. Success Metrics

**Primary**
- **SM-1: Answer-key tests pass.** All automated tests on the answer-key test dataset pass. They cover import checks and integrity (FR-3–FR-6, FR-36), reusing an import (FR-2), reopening with identical state (FR-9), delete isolation (FR-12), occupancy including zero-stock locations (FR-14), picks and classes (FR-16–FR-17), pick groups (FR-19), best locations (FR-21), runs, rules, "no space" and outdated recommendations (FR-23–FR-27, FR-29), moves, keep in place, combined moves, undo and reset (FR-30–FR-35), before/after counts (FR-37), and move-list content and order (FR-38). Validates those FRs and NFR-1.
- **SM-2: The demo flow runs from the README.** From a clean checkout, following only the README, the flow New Plan → movement classes → pick groups → best-location marks → recommendations → planning copy → before/after table → move list runs on `data/sample/` without errors. The author's run opens the gate; a run by someone else is done before submission. Validates FR-1, FR-7, FR-13, FR-17, FR-19, FR-21, FR-23, FR-30, FR-37, FR-38 and NFR-2.

**Secondary**

SM-3 to SM-5 are judged by the author, with no numeric target (decision 2026-11-02).

- **SM-3:** The movement classes agree with the author's knowledge of which parts actually move. Validates FR-16–FR-17.
- **SM-4:** The top pick groups are ones the author recognizes as genuinely used together. Validates FR-19–FR-20.
- **SM-5:** The author would act on the recommendations and hand the printed move list to colleagues. Validates FR-23–FR-38.
- **SM-6: The move list is safe to follow.** A colleague can carry out the printed list top to bottom, one walk per round, and never meets a location that a later line still has to empty (except in a cycle). Tested through FR-38's consequences. Validates FR-38.
- **SM-7: The course is satisfied.** The project, including documentation of AI-assisted development (session logs in `.logs/`, decision logs), testing and quality assurance, satisfies IBE160. Every story and every automated test names the FR it covers.

**Counter-metrics (do not optimize)**
- **SM-C1: Number of moves.** Every move costs labor. A plan with fewer moves that the planner trusts is better than a long one; rules are not tuned to produce more recommendations. Counterbalances SM-5.
- **SM-C2: Fast-moving parts in best locations.** The before/after table shows it next to pick groups in the same aisle; neither is a score to maximize at the cost of the other or of moves the planner would not make. Counterbalances SM-5.
- **SM-C3: Features started before their gate.** Starting milestone 2, stage 2 or "if time allows" work before its gate passes makes everything half-finished (teacher feedback). Keep it at zero.

## 9. Open Questions

No open questions remain. Both earlier questions were closed on 2026-11-11:

1. **Walk Path and real walking — closed, no change.** The warehouse has long aisles about 90 cm wide, each of which can be entered from both ends, and people can walk around them. An aisle-by-aisle order therefore works as it is: a colleague can enter each aisle from either end, and the tick boxes let the list be worked in any order. Walk Path stays an ordering read from the Locations file, and the demo data is not changed (user decision 2026-11-11).
2. **Real data — closed, out of scope.** The project will not import real exports, so the import is not adapted to them (other column names, other location-code patterns, returns through `RETURN-SKRS` and Putaway). The import is built and tested against the demo data and the answer-key test dataset only (user decision 2026-11-11).

## 10. Changes from the Brief and Addendum

- **Accounts:** anyone can create an account (self-registration). Replaces "users are created by the planner or seeded, no self-registration" (user decision 2026-11-02).
- **Core in two milestones, and the concurrent-edit warning moved to stage 2** (user decision 2026-11-02), following the teacher's advice to finish a small core first.
- **Deleting plans:** permanent after confirmation, no archive. Closes the addendum's open question.
- **Keep in place:** new; the planner can decline a recommendation so it does not come back (user decision 2026-11-02).
- **Manual moves:** shown on the move list with the rule Manual and the current round, and may go into occupied locations.
- **Saving and undo:** autosave on every change, with undo and reset.
- **Rule 3 limits:** a slow-moving or dead-stock part is never offered a best location; a part is not moved out of the aisle of a partner it shares at least as many jobs with; a pick group whose partner already has a recommendation waits for the next round. As written in the brief's addendum, rule 3 could loop with rule 2 and with itself between rounds (user decision 2026-11-02).
- **Move-list order:** "the Walk Path of the part's current location" is read as the move's from-location, which is where the part is when the move is carried out. Within a round, moves out of a location come before moves into it (user decision 2026-11-02).
- **One walk per round:** the brief's "one walk" becomes one walk per round, since rounds must be carried out in order.
- **Data-as-of date:** the newest transaction date, shown with the upload date. The addendum called it "the import date".
- **New Plan from an existing import:** gives the same recommendations as the original plan only with the same best-location marks, no moves and unchanged settings, since marks and moves are not carried over.
- **Location labels:** QR codes only; barcodes dropped (user decision 2026-11-02).
- **Public deployment:** demo data only (user decision 2026-11-02).
- **Demo flow metric:** must run from a clean checkout following only the README.
- **Before/after table:** also shows pick groups in the same aisle.
- **Answer-key details (user decision 2026-11-11):** the period counts transactions by date only; a slow-moving or dead-stock part whose partner's aisle has only best locations empty is "no space" under rule 3; a part that already has a recommendation is skipped silently in its other pick groups; a part that is "no space" under rule 1 gets no rule 3 entry; the answer-key test dataset lives in `data/answer-key/`.
- **Warehouse view in the core, and FR-42 rewritten** (user decision 2026-11-13, UX step): the warehouse view moves from stage 2 into milestone 2 and draws each aisle shelf by shelf; it is also where a recommendation's current and suggested locations are shown. Occupancy is shown by shape and text instead of red and green, colour is reserved for movement class, and best locations get a green rail or frame with the text BEST. Milestone 1 is unchanged, so the small-core-first order still holds.
- **Key colours instead of a colour setting** (user decision 2026-11-13, UX step): the planner can change a colour in the warehouse view by clicking its entry in the view's key (FR-42). A separate colour-settings requirement, FR-49, was drafted and withdrawn the same day to keep the core small; its ID is not reused.
- **Login in the core** (user decision 2026-11-14, UX step): create an account and log in and out (FR-39–FR-40) move from stage 2 into milestone 2, so the app and the demo front page offer Log in and Create account. Milestone 1 is unchanged.
- **Demo version** (user decision 2026-11-14, UX step): a Demo version button on the demo front page opens the app without typing a login, as the seeded demo account (FR-50, milestone 2). This replaces the 2026-11-13 decision that there is no demo shortcut; there is still no preloaded plan.
- **Concurrent-edit warning to "if time allows"** (user decision 2026-11-14): FR-41 moves from stage 2 to the if-time-allows list (§7.5), since it matters little while plans are shared.
- **Demo front page without a synthetic-data notice** (user decision 2026-11-14, UX step): NFR-5 no longer asks the front page to state that the data is synthetic; the deployment still holds synthetic data only, and the README says so.
- **New detail decided while writing the PRD** (all confirmed by the author 2026-11-02; listed in §11): required columns and value checks, round 0 for manual moves before the first run, tie-breaks, "no space" handling, outdated recommendations, applying with another suggested location, combined moves, the answer-key cases.

## 11. Confirmed Assumptions

These details were inferred while writing the PRD and confirmed by the author on 2026-11-02. They are decisions now; the list keeps the trail from inference to decision visible.

- **A-1** (§2.3) User journeys drafted from the brief and addendum, not narrated by the author.
- **A-2** (§3 Period) The period starts the day after the same date one year before the newest transaction date.
- **A-3** (FR-1) `.xlsx`, and `.csv` in UTF-8 with a header row and comma or semicolon delimiter; no column-mapping screen.
- **A-4** (FR-3) The required columns per file.
- **A-5** (FR-5) Transaction types other than the four known ones are accepted and ignored.
- **A-6** (FR-6) An import with more than one warehouse is rejected.
- **A-7** (FR-4) Negative quantities are rejected.
- **A-8** (FR-8) Saved-plans list sorted by most recently edited.
- **A-9** (FR-11) Before login exists (milestone 1), created by / last edited by hold the fixed value `planner`.
- **A-10** (§4.3, FR-42) Parts list, locations list and warehouse view show the planning copy.
- **A-11** (FR-15) Search matches partial text in part numbers, part descriptions and location codes, ignoring upper/lower case.
- **A-12** (FR-17, FR-19) Only parts in the Inventory file are classified and considered for pick groups.
- **A-13** (FR-2, FR-18) Settings live in a configuration file, not in the app; each plan stores the settings it used; a new plan uses the current settings.
- **A-14** (FR-25) Rule 2 takes parts with the fewest picks first, then in part-number order.
- **A-15** (FR-26) When both parts of a pick group have the same picks, the part later in part-number order moves.
- **A-16** (§3 Text order) Location codes and part numbers sort as plain text, character by character.
- **A-17** (FR-33) A move moves all of the part's stock at the from-location.
- **A-18** (FR-35) Keep-in-place marks survive a reset.
- **A-19** (FR-39) An account is a username and password, without an email address.
- **A-20** (FR-40) A seeded demo account is listed in the README.
- **A-21** (NFR-8) The response-time targets.
- **A-22** (NFR-9) Desktop browsers only.
