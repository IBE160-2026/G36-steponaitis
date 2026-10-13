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

The anonymized company files could not be used and were removed. `data/sample/` now holds synthetic data made by `data/generate_demo_data.py` (fixed seed). Originals go in `data/private/`, which git ignores.

### Files

| File | Rows | Columns |
| --- | --- | --- |
| `Locations.xlsx` | 2,000 | Location, Aisle, Section, Level, Position, Warehouse |
| `Inventory.xlsx` | 2,000 | Part, Part Description, Quantity, Unit, Location, Warehouse |
| `transactions.xlsx` | 20,000 | Part, Part Description, Location, Transferred Quantity, Initial Quantity, Transaction Code, Date |

### What the demo data contains

- One warehouse, `NO`, with 9 aisles (A–I) of 222–223 locations. Location code `<aisle>-<section>-<level>-<position>`, e.g. `A-01-02-03`.
- One car part per location: 87 part types for 20 petrol and diesel car models in three engine versions. Part numbers are 7-digit text.
- **Occupancy rule (user decision):** a location is occupied only if it holds at least one part with stock above zero. 1,830 locations are occupied and 170 hold a zero-stock part, so they count as empty.
- Negative Transferred Quantity is a pick (18,596 lines), positive is a receipt (1,404 lines). Initial Quantity + Transferred Quantity is the stock after the line; each part's last line ends at its inventory quantity.
- Transaction Code groups lines: 56% of the 10,499 pick codes hold 2–4 parts. Some part pairs (e.g. oil filter + drain plug washer, brake pads + brake discs for the same car) are built in to be picked together; 136 pairs are picked together 10 or more times.
- Movement: a few fast movers, most parts move rarely, and 630 parts never move (dead stock).
- Dates: random weekdays 2025-10-01 to 2026-09-30, 07:00–15:30, same date for all lines on one code. No real seasonality or trends.
- The demo data has no transaction types and no from/to locations; each line uses the part's own location.

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
