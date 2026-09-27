---
title: "Product Brief: Smart Warehouse Planner"
status: final
created: 2026-09-27
updated: 2026-09-27
---

# Product Brief: Smart Warehouse Planner

## Executive Summary

Smart Warehouse Planner is a web-based planning tool for a spare-parts warehouse. Using data imported from the company's main system, it shows which parts are stored where, classifies every part by how often it is picked, and uses AI to find parts that are frequently picked together. From this it recommends better locations: fast movers in the best spots, and parts that belong together stored near each other.

The tool is not connected to the main system and never changes it: it suggests, and people decide. Recommendations can be tried out in a separate planning copy of the warehouse, so the planner can rearrange placement and see the result before anything is physically moved.

The project is the solo semester project for IBE160 *Programmering med KI* (Høgskolen i Molde, autumn 2026) and is developed on real warehouse data that has been altered for confidentiality. It is also meant for real use: the author and colleagues intend to use it in their own warehouse once the course is complete.

## The Problem

- **Placement is not based on usage.** Parts are placed where space was free when they arrived and are rarely re-evaluated. Fast movers can sit in poor locations while slow and dead stock occupy good ones.
- **Parts used together are stored apart.** Parts that appear on the same transaction can be far from each other, so one pick means several trips.
- **The overview is scattered.** Locations, inventory and transaction history live in separate Excel files. Answering "what is in this aisle?", "how full is it?" or "which parts barely move?" takes manual work.
- **Changing placement is risky without a plan.** Moving parts costs labor, and there is no easy way to try a new arrangement before doing it for real.

## The Solution

A browser-based tool where the warehouse planner can:

1. **Import data** — CSV/Excel files for locations, inventory, and transaction history (part number, quantity, transaction number and related fields).
2. **Manage the warehouse data** — view parts and locations, see which part is in each location, create and edit locations, move parts, search, and track warehouse and aisle occupancy.
3. **Label locations** — generate and print labels with QR codes or barcodes.
4. **Understand movement** — every part is classified from its transaction history as fast-moving, medium-moving, slow-moving, or very low / dead stock.
5. **Find parts that belong together (AI)** — the system analyzes which parts are frequently picked on the same transaction number (for example, an air filter and a cabin filter) and flags them as groups.
6. **Get location recommendations** — based on movement class and pick-together groups, the tool suggests where parts should be stored. The planner marks which zones or aisles count as the best locations, and recommendations are made against that. If distance data between locations can be provided, it is used as well.
7. **Plan in a copy** — create a separate planning copy of the warehouse, apply or adjust recommendations there, and review the new arrangement before moving parts physically.

## What Makes This Different

- **Built from inside the problem.** The author works in the warehouse the tool targets and has real (anonymized) data. Requirements come from daily work, not guesswork.
- **Pick-together analysis.** Sorting by pick frequency is standard practice. Finding which parts are actually picked together, using transaction numbers, is what a spreadsheet or simple tool cannot do.
- **Plan before you move.** The planning copy lets the planner test a new placement safely instead of committing labor on a hunch.
- **Right-sized.** Enterprise warehouse systems with placement optimization are expensive and heavy. This is a focused tool that starts from the Excel files the warehouse already has.

## Who This Serves

- **Primary: the warehouse planner (the author)** — the person responsible for placement; manages locations, decides where parts go, and wants a data-backed plan for rearranging.
- **Secondary: warehouse colleagues** — find parts faster through clear labels and better placement.
- **Course audience: IBE160 examiners** — assess the application and how AI was used in developing, testing and quality-assuring it.

## Success Criteria

- **Classification that matches reality.** The movement classification agrees with the author's knowledge of which parts actually move.
- **Pick-together groups that make sense.** The top groups found are ones the author recognizes as genuinely picked together, like the air filter and cabin filter example.
- **A usable plan.** A complete planning copy can be produced from real data, with recommendations the author considers worth acting on.
- **Used after the course.** The author and colleagues use the tool on real company data and physically move parts based on its recommendations.
- **Course requirements met.** The project, including documentation of AI-assisted development, testing and quality assurance, satisfies IBE160.

## Scope

**MVP: all must-have (about two months, solo)**

- CSV/Excel import
- Inventory database
- Location management (create, edit, manage)
- Part-to-location assignment and moving parts
- Search for parts and locations
- Basic warehouse dashboard
- Warehouse and aisle occupancy tracking
- Label generation and printing, with QR codes or barcodes for locations
- Transaction analysis and movement classification (fast, medium, slow, dead stock)
- Pick-together analysis (AI)
- Marking which zones or aisles are the best locations
- Recommended part locations
- Planning copy of the warehouse

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

- **Solo scope.** The MVP has thirteen must-have items for one person in about two months. The plan leaves little slack, so progress should be checked early against the MVP list.
- **Stale data (accepted).** The company's main system stays the source of truth. The tool's picture is only as current as the latest import, so data must be re-imported before planning.
- **Confidentiality.** Real company data must not leave the company. The course version uses altered data.
- **Distance data uncertain.** Without it, improvement cannot be shown in meters.
- **Data quality.** The Excel files have not yet been reviewed.

## Open Questions

- What exactly do the Excel files contain (columns, time span, volume)? To be reviewed when shared.
- How does the planner define the best locations: by aisle, zone, shelf height, or something else?
- Can distance data between locations be provided, and in what form?
- Who exactly will use the tool at work?

## Vision

If it proves itself, Smart Warehouse Planner becomes the everyday tool for keeping the warehouse organized and placement matched to demand, re-run on fresh transaction data to catch parts that have sped up or slowed down. Later steps could include a warehouse map, scanning with handheld devices, a distance model that shows savings in meters, and use in other warehouses in the company.
