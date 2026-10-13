---
title: "Addendum: Smart Warehouse Planner"
created: 2026-09-27
updated: 2026-10-13
---

# Addendum: Smart Warehouse Planner

Detail captured during the brief conversation that belongs in the PRD rather than the brief. The product is a planning tool, not connected to the company's main system; locations, moves and labels operate on imported data.

## Feature detail for the PRD (from user notes, 2026-09-27)

### Core website functionality

- Import warehouse data
- View all parts in inventory
- View existing warehouse locations
- See which part is stored in each location
- Create, edit and manage locations
- Move parts between locations
- Search for parts and locations
- Generate and print warehouse labels
- Generate QR codes or barcodes for locations

### Movement classification

Historical transactions determine how often each part is picked. Parts are classified as:

- Fast-moving
- Medium-moving
- Slow-moving
- Very low / dead stock

The classification drives location recommendations.

### AI: pick-together analysis (moved into MVP, 2026-09-27)

Parts that often appear on the same transaction number (for example, an air filter and a cabin filter) are recommended to be stored close together. This is the only AI feature in the product.

### Walking-distance measurement (stretch, conditional)

Originally described as an important part of the project (illustrative figures only: 26,400 → 20,100 m/month, −23.9%). First dropped because no distance model between locations exists; later returned as a stretch goal, available only if distance data between locations can be provided. In the MVP, "better location" is defined by the planner marking the best zones or aisles.

### Dropped (2026-09-27)

- **AI-generated explanations for recommendations.** Dropped; AI scope is pick-together analysis only.
- An unfinished "another advanced feature" line from the original notes.

### MVP and stretch lists

The current MVP and stretch lists live in the brief's **Scope** section, which is the single source of truth.

## Demo data (2026-10-13)

The anonymized company files are no longer used. They were removed from the repo and its git history on 2026-10-13 (they had never been pushed). `data/sample/` holds only synthetic data made by `data/generate_demo_data.py` (fixed seed). Real company data is never committed; `data/private/` is ignored by git.

### Files

| File | Rows | Columns |
| --- | --- | --- |
| `Locations.xlsx` | 2,000 | Location, Aisle, Section, Level, Position, Warehouse |
| `Inventory.xlsx` | 1,625 (1,545 parts) | Part, Part Description, Quantity, Unit, Location, Warehouse |
| `transactions.xlsx` | 20,000 | Transaction Type, Part, Part Description, Location, Transferred Quantity, Initial Quantity, Transaction Code, Date |

### What the demo data contains

- One warehouse, `NO`, with 9 aisles (A–I) of 222–223 locations. Location code `<aisle>-<section>-<level>-<position>`, e.g. `A-01-02-03`.
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
