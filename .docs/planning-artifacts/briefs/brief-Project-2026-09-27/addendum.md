---
title: "Addendum: Smart Warehouse Planner"
created: 2026-09-27
updated: 2026-10-28
---

# Addendum: Smart Warehouse Planner

Detail captured during the brief conversation that belongs in the PRD rather than the brief. The product is a planning tool, not connected to the company's main system; locations, moves and labels operate on imported data.

On 2026-10-14 the brief was rewritten to follow the standard product-brief template (Executive Summary, Problem, Solution, Differentiators, Users, Success Criteria, Scope, Vision). The detail that no longer fits there — rules, the full test criteria, constraints and risks, open questions and stage 2 feature detail — was moved here unchanged. It is still binding for the PRD and implementation.

## Rules

These are the first versions of the rules to implement and test against. The thresholds are settings, so they can be tuned later without changing the logic.

- **Period.** Analysis uses the last 12 months before the newest transaction date in the import.
- **Pick.** One Move to Repair line is one pick (a shelf pick). Return to Stock, Issue Part and Receipt lines are not picks.
- **Movement classes.** By picks per part in the period: fast-moving 24 or more (about two a month), medium-moving 6–23, slow-moving 1–5, dead stock 0. With the demo data this gives about 80 fast, 250 medium, 580 slow and 640 dead-stock parts.
- **Pick groups.** Issue Part lines that share a transaction number belong to the same job. Two parts form a pick group when they appear on the same job at least 5 times in the period (about 130 pairs in the demo data). Transaction number `0` is never grouped.
- **Occupancy.** A location is occupied when it holds at least one part with stock above zero; otherwise it is empty.
- **Best locations.** The planner can mark three things as best: whole aisles (e.g. aisle A), levels (e.g. level 1 in all aisles, or level 2 in aisle C) and single locations (e.g. `D-04-01-02`). A location counts as best when it is marked in any of these ways. Marks can be removed again. Best locations come only from the planner's marks, not from distance or walk path.
- **Walk path.** Each location has a Walk Path value: 0 at the first location in aisle A and 10 more for each next location along the walk. The walking distance between two locations is the difference between their values.
- **Current location.** A part stored in more than one location uses the location with the most stock as its current location.
- **Recommendations**, applied in this order and only to empty locations:
  1. A fast-moving part outside the best locations gets a suggested empty best location. Parts with the most picks go first, and empty best locations are offered in location-code order.
  2. A slow-moving or dead-stock part in a best location gets a suggested empty location outside the best locations, offered in location-code order. This frees best locations for rule 1 once the moves are applied in the planning copy and the recommendations are run again.
  3. When two parts in a pick group are in different aisles, the part with fewer picks gets a suggested empty location in the aisle of the other part, offered in location-code order. Pairs with the most shared jobs go first, ties by part number. Rule 3 never moves a part out of a best location.

  A part gets at most one recommendation, and each empty location is suggested to at most one part. If no empty location fits, the part is listed as "no space" instead. Parts with the same number of picks are ordered by part number. Recommendations do not use categories; if one moves a part into an aisle meant for another category, the category check (stage 2) lists it.
- **Rounds.** Rule 2 only frees best locations once its moves are applied and the recommendations are run again. Each run of the recommendations on the plan's current state is a round (round 1, 2, …), and every move carries the round it came from. A round-2 move may depend on a location that a round-1 move frees, so moves must be carried out in round order.
- **Categories (stage 2).** Categories come only from keywords in the part description, never from part numbers, because part numbers change over time. Parts share common keywords such as filter, rotor and oil. The planner sets keyword rules that map a keyword to a category (e.g. "filter" → Filters). Keywords match whole words, ignoring upper and lower case, so "oil" matches "Engine oil" but not "Coil spring". The planner sets the order of the rules, and a part gets the category of the first rule that matches (so "Oil filter" is a filter only if the "filter" rule comes before the "oil" rule); a part with no match has no category. The planner assigns one or more categories to each aisle. The category check lists every part whose category is not assigned to its aisle. Parts without a category and aisles without categories are not checked. The imported files have no categories and no keyword list exists yet. A starter keyword list for the demo data is made in stage 2: AI (Claude Code, during development) drafts it from the part descriptions, and the planner checks it. The tool itself applies the keyword rules without AI, so the check gives the same result every time and can be tested.
- **Test dataset.** Before implementation, a small hand-made dataset (about 20 parts) is written with the expected class, pick groups and recommendations for each part, and used as the answer key in automated tests. It covers the edge cases: a tie in picks, a part stored in two locations, a part in several pick groups, and a part with no empty location that fits ("no space").

## Testable success criteria (full list)

Checked with automated tests on the test dataset above:

- A part with 24 or more picks in the last 12 months is classified as fast-moving, 6–23 as medium-moving, 1–5 as slow-moving, and 0 as dead stock.
- Two parts that appear together on at least 5 Issue Part transactions in the last 12 months are shown as a pick group; a pair with 4 is not.
- Importing a file with a missing required column gives a clear error message naming the column, and no data from that file is saved.
- A location holding no part with stock above zero is shown as empty.
- A location in a marked aisle, in a marked level, or marked on its own counts as a best location; all other locations do not.
- Changes in the planning copy do not change the imported inventory.
- Every recommendation names the part, its current location, the suggested location and the rule that produced it, and only suggests locations that are empty, each to at most one part.
- A saved plan reopens with identical state (best-location marks, planning copy, recommendations, rounds); deleting one plan leaves all other plans unchanged.
- A new plan started from an existing plan's original files gives the same classes, pick groups and recommendations as the original plan, and the edits of the original plan are not carried over.
- The move list contains exactly the moves of the plan, ordered by round and then by the Walk Path of the part's current location; each line names part, description, from, to and rule; the print view shows plan name, "data as of" date and generated-at time.
- An import accepts the virtual location `FLSKRS` in transactions (not in `Locations.xlsx`) and rejects a shelf pick (Move to Repair, Receipt, Return to Stock) or an inventory row whose location is missing from `Locations.xlsx`.
- Running the full core flow (New Plan → classify → pick groups → recommendations → planning copy → move list) on the demo data in `data/sample/` works without errors, following the README.

## Solution detail

- **Import** covers locations, inventory and transaction history (part number, quantity, transaction number and related fields). Virtual locations such as `FLSKRS` (and `RETURN-SKRS` in real data) appear in transactions but not in `Locations.xlsx`; they are allowed and are never shelf locations. In the demo data all 8,867 Issue Part lines are at `FLSKRS`.
- **Planning copy result** is shown as a before/after table per aisle: which parts move in and out, and how many fast movers sit in the best locations.
- **Login (stage 2).** A user logs in and lands on the saved-plans list, with a New Plan button. That list is the dashboard; no separate dashboard is planned.
- **Warehouse view (stage 2).** All aisles with their locations, and the occupancy of the warehouse and each aisle. Occupied locations are red and empty ones green. Each location also has a text label (occupied or empty) and a tooltip with the location code and the part stored there, so the view does not rely on color alone.

## Plans, printing and users (user decisions, 2026-10-28)

- **A plan** is one import, the planner's best-location marks, and the planning copy with its recommendations. Each plan records the import it was built from and the import date ("data as of …"), because the tool is only as current as the latest import. The imported data of a plan is frozen; every edit (moving a part, applying a recommendation, marking best locations) lives in the plan and never changes the import.
- **Saved plans.** The app saves every plan, so it needs persistent storage (decided in architecture). A plan can be reopened at any time and edited further, including after it has been printed (no locking). Plans are visible in the app. Comparing plans was considered and removed (2026-10-28).
- **Deleting a plan** asks for confirmation and affects only that plan. Any user can delete any plan; archiving instead of deleting is left to the PRD.
- **Concurrent editing.** Plans are shared, so two users could edit the same plan. Last save wins, with a warning if the plan changed since it was opened. No live collaboration.
- **New Plan** is the entry point of the flow. The planner starts a new plan by uploading all three files, or by reusing the original imported files of an existing plan (not its edited state). Starting a new plan from the result of an earlier plan is not in scope: after the moves are done, a fresh export from the main system is the source of truth.
- **Move list.** A plan can be printed as a move list in a browser print view (no PDF or CSV export). Each line has part, description, from, to, the rule behind it and a tick box. Lines are ordered by round first (see Rounds) and then by the Walk Path of the part's current location, so dependent moves come in the right order and the walk stays short. Because plans stay editable after printing, the print view shows the plan name, the "data as of" date and the time it was generated, so an old printout can be recognized. Core, not stage 2.
- **Users (stage 2).** Login tracks who uses the app and gives it a more professional look. The app may be used by more people in the future. Plans are shared between all users. Every plan stores `created_by` and `last_edited_by` from the start, even before login exists. A browser print view cannot tell whether anything was actually printed, so "printed by" is not tracked. Minimum login: users are created by the planner or seeded, with no self-registration, password reset or roles; passwords are stored hashed; the README lists demo credentials for examiners.
- **Scope note.** Saved plans and the move list add work to a core the teacher already called tight. Keep the order: finish and test import → classify → pick groups → recommendations → planning copy first, then saved plans and the move list, then stage 2.

## Constraints and Risks

- **Solo scope.** One person in about two months. The core flow is finished and tested before any stage 2 or "if time allows" item is started, and progress is checked early against the core list.
- **Stored uploads.** Saved plans keep the uploaded data on disk. The database and any uploads folder must be git-ignored (`.gitignore` rules added 2026-10-28), so uploaded warehouse data never reaches the public repo; `data/sample/` stays committed.
- **Stale data (accepted).** The company's main system stays the source of truth. The tool's picture is only as current as the latest import, so data must be re-imported before planning.
- **Confidentiality.** Real company data must not leave the company and is never committed to the repo, which is public. The course version uses only synthetic demo data made by `data/generate_demo_data.py`. The earlier anonymized company files are no longer used and were removed from the git history before they were ever pushed.
- **Walk path is not meters.** The walk path gives the order of locations along the walk in steps of 10, not measured distance, so walking-distance estimates are relative until real distances are measured.
- **Real data differs from the demo data.** The demo data follows the format and process of the real export (see below), but real files may have other column names, several location-code patterns and duplicate rows. The import must be checked against real data before it is used with real files.

## Open Questions

- Does the walk path order (aisle by aisle, location by location) match how people actually walk in the warehouse?
- Should deleting a plan archive it instead? (decided in the PRD)

Closed 2026-10-28: the dashboard is the saved-plans list; create/edit locations dropped; starting a plan from another plan's result is out of scope.

## Feature detail for the PRD (from user notes, 2026-09-27)

### Core website functionality

- Import warehouse data
- View all parts in inventory
- View existing warehouse locations
- See which part is stored in each location
- Move parts between locations, inside a plan (creating and editing locations was dropped 2026-10-28)
- Print the plan as a move list
- Search for parts and locations
- Generate and print warehouse labels (stage 2)
- Generate QR codes or barcodes for locations (stage 2)

### Movement classification

Historical transactions determine how often each part is picked. Parts are classified as:

- Fast-moving
- Medium-moving
- Slow-moving
- Very low / dead stock

The classification drives location recommendations.

### Pick-together analysis (moved into MVP, 2026-09-27)

Parts that often appear on the same transaction number (for example, an air filter and a cabin filter) are recommended to be stored close together. It is data analysis of shared transaction numbers, not a language model (renamed from "AI" after teacher feedback, 2026-10-06).

### Walking-distance measurement (if time allows)

Originally described as an important part of the project (illustrative figures only: 26,400 → 20,100 m/month, −23.9%). First dropped because no distance model between locations exists. Since 2026-10-13 the locations have a Walk Path value, so a before/after walking-distance estimate is an "if time allows" item, in relative steps rather than meters. Recommendations never use distance: best locations come only from the planner's marks on aisles, levels and single locations.

### Dropped (2026-09-27)

- **AI-generated explanations for recommendations.** Dropped; AI scope is pick-together analysis only.
- An unfinished "another advanced feature" line from the original notes.

### Dropped (2026-10-28)

- **Creating and editing locations.** Locations come from the company system, and a location made in the app has no Walk Path value, which would break the move-list order.
- **Comparing plans.**
- **"Printed by" tracking.** A browser print view cannot show whether anything was printed.

## MVP and stretch lists

The current MVP and stretch lists live in the brief's **Scope** section, which is the single source of truth.

## Demo data (2026-10-13)

The anonymized company files are no longer used. They were removed from the repo and its git history on 2026-10-13 (they had never been pushed). `data/sample/` holds only synthetic data made by `data/generate_demo_data.py` (fixed seed). Real company data is never committed; `data/private/` is ignored by git.

### Files

| File | Rows | Columns |
| --- | --- | --- |
| `Locations.xlsx` | 2,000 | Location, Walk Path, Aisle, Section, Level, Position, Warehouse |
| `Inventory.xlsx` | 1,625 (1,545 parts) | Part, Part Description, Quantity, Unit, Location, Warehouse |
| `transactions.xlsx` | 20,000 | Transaction Type, Part, Part Description, Location, Transferred Quantity, Initial Quantity, Transaction Code, Date |

### What the demo data contains

- One warehouse, `NO`, with 9 aisles (A–I) of 222–223 locations. Location code `<aisle>-<section>-<level>-<position>`, e.g. `A-01-02-03`.
- **Walk Path** (user decision, 2026-10-13): 0 at `A-01-01-01`, then 10 more for each next location in file order (aisle A 0–2,220 … aisle I 17,780–19,990). It replaces the missing distance data.
- Car parts: 87 part types for 20 petrol and diesel car models in three engine versions. Part numbers are 7-digit text. 80 parts are stored in two locations.
- **Occupancy rule (user decision):** a location is occupied only if it holds at least one part with stock above zero. 1,584 locations are occupied and 416 empty (375 with no part, 41 with only a zero-stock part). Occupancy varies by aisle, from 65% to 87%.
- Transaction types follow the real process: **Move to Repair** (shelf pick to `FLSKRS`, 9,635 lines, one part per code), **Issue Part** (used, at `FLSKRS`, 8,867 lines grouped by job code), **Return to Stock** (back to the same shelf, 953 lines) and **Receipt** (goods received, 545 lines, code `0`). The real two-step return via `RETURN-SKRS` and Putaway is simplified to one line.
- On shelf lines, Initial Quantity + Transferred Quantity is the stock after the line, and the last line per part and location ends at its inventory quantity. On Issue Part lines, Initial Quantity is what was waiting at `FLSKRS`.
- Pick-together analysis uses Issue Part: 59% of the 4,869 job codes hold 2–4 parts. Some pairs (e.g. brake pads + brake discs for the same car) are built in; 77 pairs are used together 10 or more times.
- Movement: a few fast movers, most parts move rarely, and 636 parts never move (dead stock).
- Dates: random weekdays 2025-10-01 to 2026-09-30, 07:00–15:30. A job is picked in the morning and issued or returned later the same day. No real seasonality or trends.

### Findings from the original company export (2026-09-30)

These still apply when real data is imported.

- **Move to Repair** = a part is picked from a shelf and moved to `FLSKRS`. This is the physical pick and the basis for pick frequency.
- **Return to Stock** = a picked part was not consumed and goes back (`FLSKRS` → `RETURN-SKRS`, then **Putaway** to a shelf).
- **Issue Part** = the part is consumed (`FLSKRS` → `FLSKRS`). It shows the exact consumption.
- **FLSKRS** is a virtual location.
- **Pick-together analysis uses Issue Part**, not Move to Repair: Move to Repair almost always has one part per transaction number, while about half of Issue Part transaction numbers hold several parts.
- Part numbers and location codes come in several patterns (e.g. `2007060` and `1008614-00`; `A-01-01-01-A1`, `A-07-02-00-A`, `06-01-30-D1`). Treat part numbers as text; do not assume a single location format.
- Some parts are stored in more than one location, and some inventory rows repeat the same part in the same location; merge them on import.
- Receiving and putaway lines have Transaction No `0`; they are not groupable.
- **No capacity or size data** exists and none can be provided. Occupancy means occupied or empty only, and recommendations cannot check whether a part fits a location; the planner judges that.
