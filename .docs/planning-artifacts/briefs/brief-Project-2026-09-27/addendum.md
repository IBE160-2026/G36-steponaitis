---
title: "Addendum: Smart Warehouse Planner"
created: 2026-09-27
updated: 2026-09-27
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

## Data findings from the demo files (2026-09-30)

Source: `data/sample/` (anonymized). Originals go in `data/private/`, which git ignores.

### Files

| File | Rows | Columns |
| --- | --- | --- |
| `locations.xlsx` | 3,105 | Name, Warehouse |
| `inventory.xlsx` | 2,862 (2,711 parts) | Part Description, Part, Total Quantity, ATP, Unit, Part Location, Warehouse |
| `transactions.xlsx` | 31,326 | Transaction (type), Part, From Location, To Location, Initial/Transacted/Final Quantity, Unit, Warehouse, Transaction No, Transaction Date |

### How the warehouse process shows up in the data (confirmed by the user)

- **Move to Repair** = a part is picked from a shelf and moved to `FLSKRS`. This is the physical pick and the basis for pick frequency.
- **Return to Stock** = a picked part was not consumed and goes back (`FLSKRS` → `RETURN-SKRS`, then **Putaway** to a shelf).
- **Issue Part** = the part is consumed (`FLSKRS` → `FLSKRS`). It shows the exact consumption.
- **FLSKRS** is a virtual location.
- **Pick-together analysis uses Issue Part**, not Move to Repair: Move to Repair almost always has one part per transaction number (100 of ~12,000 have two), while 54% of Issue Part transaction numbers hold several parts.

### Dates

The original export has dates; they were removed from the demo files. `data/add_demo_dates.py` adds a random **Transaction Date** (weekdays 2025-10-01 to 2026-09-30, 07:00–15:30, same date for all lines on one transaction number, fixed seed). Demo dates are evenly spread, so they show no real seasonality or trends.

### Data the import must handle

- Part numbers and location codes come in several patterns by design (e.g. `2007060` and `1008614-00`; `A-01-01-01-A1`, `A-07-02-00-A`, `06-01-30-D1`). Treat part numbers as text; do not assume a single location format.
- 135 parts are stored in more than one location.
- 7 inventory rows repeat the same part in the same location; merge them on import.
- **Occupancy rule (user decision):** a location is occupied only if it holds at least one part with stock above zero. Locations holding only zero-stock parts count as empty, and several zero-stock parts can share one location. With the demo data, 2,015 locations are occupied and 1,090 empty (809 with no parts, 281 with only zero-stock parts).
- 9,873 lines have Transaction No `0` (receiving and putaway); they are not groupable.
- Volume for analysis: 9,794 shelf picks covering 1,113 parts; 126 part pairs are used together 10 or more times.

### Demo adjustments

- **Parts without a description removed.** 386 parts appeared in the transactions but not in the inventory, so they had no description or location. All 8,776 of their transaction lines were removed; every part in the transactions is now in the inventory.
- **No capacity or size data** exists and none can be provided. Occupancy means occupied or empty only, and recommendations cannot check whether a part fits a location; the planner judges that.
