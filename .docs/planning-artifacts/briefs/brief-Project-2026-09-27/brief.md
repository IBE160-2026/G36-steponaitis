---
title: "Product Brief: Smart Warehouse Planner"
status: final
created: 2026-09-27
updated: 2026-10-13
---

# Product Brief: Smart Warehouse Planner

## Executive Summary

Smart Warehouse Planner is a web-based planning tool for a spare-parts warehouse. Using data imported from the company's main system, it shows which parts are stored where, classifies every part by how often it is picked, and uses data analysis of transaction numbers to find parts that are frequently picked together. From this it recommends better locations: fast movers in the best spots, and parts that belong together stored near each other.

The tool is not connected to the main system and never changes it: it suggests, and people decide. Recommendations can be tried out in a separate planning copy of the warehouse, so the planner can rearrange placement and see the result before anything is physically moved.

The project is the solo semester project for IBE160 *Programmering med KI* (Høgskolen i Molde, autumn 2026) and is developed on synthetic demo data modelled on the real warehouse, since real company data cannot be shared. It is also meant for real use: the author and colleagues intend to use it in their own warehouse once the course is complete.

## The Problem

- **Placement is not based on usage.** Parts are placed where space was free when they arrived and are rarely re-evaluated. Fast movers can sit in poor locations while slow and dead stock occupy good ones.
- **Parts used together are stored apart.** Parts that appear on the same transaction can be far from each other, so one pick means several trips.
- **The overview is scattered.** Locations, inventory and transaction history live in separate Excel files. Answering "what is in this aisle?", "how full is it?" or "which parts barely move?" takes manual work.
- **Changing placement is risky without a plan.** Moving parts costs labor, and there is no easy way to try a new arrangement before doing it for real.

## The Solution

A browser-based tool where the warehouse planner can:

1. **Import data** — CSV/Excel files for locations, inventory, and transaction history (part number, quantity, transaction number and related fields).
2. **Manage the warehouse data** — view parts and locations, see which part is in each location, create and edit locations, move parts, search, and (stage 2) track warehouse and aisle occupancy.
3. **Label locations (stage 2)** — generate and print labels with QR codes or barcodes.
4. **Understand movement** — every part is classified from its transaction history as fast-moving, medium-moving, slow-moving, or very low / dead stock.
5. **Find parts that belong together (data analysis)** — the system analyzes which parts are frequently picked on the same transaction number (for example, an air filter and a cabin filter) and flags them as groups.
6. **Get location recommendations** — based on movement class and pick-together groups, the tool suggests where parts should be stored. The planner marks which zones or aisles count as the best locations, and recommendations are made against that. If distance data between locations can be provided, it is used as well.
7. **Plan in a copy** — create a separate planning copy of the warehouse, apply or adjust recommendations there, and review the new arrangement before moving parts physically. The result is shown as a before/after table per aisle (which parts move in and out, and how many fast movers sit in the best zones).

## What Makes This Different

- **Built from inside the problem.** The author works in the warehouse the tool targets and knows how the real data and process look. Requirements come from daily work, not guesswork.
- **Pick-together analysis.** Sorting by pick frequency is standard practice. Finding which parts are actually picked together, using transaction numbers, is what a spreadsheet or simple tool cannot do.
- **Plan before you move.** The planning copy lets the planner test a new placement safely instead of committing labor on a hunch.
- **Right-sized.** Enterprise warehouse systems with placement optimization are expensive and heavy. This is a focused tool that starts from the Excel files the warehouse already has.

## Who This Serves

- **Primary: the warehouse planner (the author)** — the person responsible for placement; manages locations, decides where parts go, and wants a data-backed plan for rearranging.
- **Secondary: warehouse colleagues** — find parts faster through clear labels and better placement.

## Success Criteria

**Testable (checked with automated tests on a small hand-made dataset with a known answer key, see Rules):**

- A part with 24 or more picks in the last 12 months is classified as fast-moving, 6–23 as medium-moving, 1–5 as slow-moving, and 0 as dead stock.
- Two parts that appear together on at least 5 Issue Part transactions in the last 12 months are shown as a pick group; a pair with 4 is not.
- Importing a file with a missing required column gives a clear error message naming the column, and no data from that file is saved.
- A location holding no part with stock above zero is shown as empty.
- Changes in the planning copy do not change the imported inventory.
- Every recommendation names the part, its current location, the suggested location and the rule that produced it, and only suggests locations that are empty.
- Running the full core flow (import → classify → pick groups → recommendations → planning copy) on the demo data in `data/sample/` works without errors, following the README.

**Judged by the author:**

- **Classification that matches reality.** The movement classes agree with the author's knowledge of which parts actually move.
- **Pick groups that make sense.** The top groups are ones the author recognizes as genuinely picked together, like the air filter and cabin filter example.
- **Used after the course.** The author and colleagues use the tool on real company data and physically move parts based on its recommendations.

**Course:** the project, including documentation of AI-assisted development, testing and quality assurance, satisfies IBE160.

## Rules

These are the first versions of the rules to implement and test against. The thresholds are settings, so they can be tuned later without changing the logic.

- **Period.** Analysis uses the last 12 months before the newest transaction date in the import.
- **Pick.** One Move to Repair line is one pick (a shelf pick). Return to Stock, Issue Part and Receipt lines are not picks.
- **Movement classes.** By picks per part in the period: fast-moving 24 or more (about two a month), medium-moving 6–23, slow-moving 1–5, dead stock 0. With the demo data this gives about 80 fast, 250 medium, 580 slow and 640 dead-stock parts.
- **Pick groups.** Issue Part lines that share a transaction number belong to the same job. Two parts form a pick group when they appear on the same job at least 5 times in the period (about 130 pairs in the demo data). Transaction number `0` is never grouped.
- **Occupancy.** A location is occupied when it holds at least one part with stock above zero; otherwise it is empty.
- **Best zones.** The planner marks whole aisles, or levels within an aisle, as best zones.
- **Recommendations**, applied in this order and only to empty locations:
  1. A fast-moving part outside the best zones gets a suggested empty location in a best zone. Parts with the most picks go first.
  2. A slow-moving or dead-stock part in a best zone gets a suggested empty location outside the best zones, to free space for rule 1.
  3. When two parts in a pick group are in different aisles, the part with fewer picks gets a suggested empty location in the aisle of the other part.

  A part gets at most one recommendation. If no empty location fits, the part is listed as "no space" instead.
- **Test dataset.** Before implementation, a small hand-made dataset (about 20 parts) is written with the expected class, pick groups and recommendations for each part, and used as the answer key in automated tests.

## Scope

**Core (built, tested and stable first)**

The core flow is: import → classify → find pick groups → get recommendations → try them in the planning copy.

- CSV/Excel import, with clear errors for missing columns
- Inventory database: parts, locations and which part is where
- Location management (create, edit, manage) and moving parts
- Search for parts and locations
- Transaction analysis and movement classification (fast, medium, slow, dead stock)
- Pick-together analysis (data analysis of shared transaction numbers)
- Marking which aisles or levels are the best zones
- Recommended part locations, using the rules above
- Planning copy of the warehouse, with a before/after table per aisle

**Stage 2 (after the core flow is finished and tested)**

- Basic warehouse dashboard
- Warehouse and aisle occupancy tracking
- Label generation and printing, with QR codes or barcodes for locations

**If time allows**

- Warehouse map/layout view
- Drag-and-drop part placement
- Whole-warehouse optimization
- QR/barcode scanning
- Distance-based recommendations and estimated walking-distance reduction before vs. after (only if distance data between locations can be provided)

**Out**

- AI-generated explanations for recommendations
- Any connection to the company's main system (no live sync, no writing back)

## Constraints and Risks

- **Solo scope.** One person in about two months. The core flow is finished and tested before any stage 2 or "if time allows" item is started, and progress is checked early against the core list.
- **Stale data (accepted).** The company's main system stays the source of truth. The tool's picture is only as current as the latest import, so data must be re-imported before planning.
- **Confidentiality.** Real company data must not leave the company and is never committed to the repo, which is public. The course version uses only synthetic demo data made by `data/generate_demo_data.py`. The earlier anonymized company files are no longer used and were removed from the git history before they were ever pushed.
- **Distance data uncertain.** Without it, improvement cannot be shown in meters.
- **Real data differs from the demo data.** The demo data follows the format and process of the real export (see the addendum), but real files may have other column names, several location-code patterns and duplicate rows. The import must be checked against real data when the tool is used at work after the course.

## Open Questions

- How does the planner define the best locations: by aisle, zone, shelf height, or something else?
- Can distance data between locations be provided, and in what form?
- Who exactly will use the tool at work?

## Vision

If it proves itself, Smart Warehouse Planner becomes the everyday tool for keeping the warehouse organized and placement matched to demand, re-run on fresh transaction data to catch parts that have sped up or slowed down. Later steps could include a warehouse map, scanning with handheld devices, a distance model that shows savings in meters, and use in other warehouses in the company.
