---
title: "Product Brief: Smart Warehouse Planner"
status: final
created: 2026-09-27
updated: 2026-10-28
---

# Product Brief: Smart Warehouse Planner

## Executive Summary

Smart Warehouse Planner is a web-based planning tool for a spare-parts warehouse. It imports the Excel files the warehouse already has (locations, inventory and transaction history), shows which parts are stored where, and classifies every part by how often it is picked. Using data analysis of transaction numbers, it also finds parts that are frequently used together. From this it recommends better locations: fast movers in the best spots, and parts that belong together stored near each other.

Today parts are placed wherever space was free when they arrived and are rarely re-evaluated, so fast movers sit in poor locations and parts used on the same job are spread across the warehouse. Every extra trip costs picking time, and moving parts costs labor, so a change of placement needs a plan backed by data rather than a hunch.

The tool is not connected to the company's main system and never changes it: it suggests, and people decide. Recommendations are tried out in a separate planning copy of the warehouse, so the planner can see the result before anything is physically moved. Each piece of work is saved as a plan that can be reopened later and printed as an ordered move list for the people doing the moving. The project is the solo semester project for IBE160 *Programmering med KI* (Høgskolen i Molde, autumn 2026) and is developed on synthetic demo data.

## The Problem

- **Placement is not based on usage.** Parts go where space was free on arrival. Fast movers can sit in poor locations while slow and dead stock occupy good ones.
- **Parts used together are stored apart.** Parts on the same job can be far from each other, so one job means several trips.
- **The overview is scattered.** Locations, inventory and transaction history live in separate Excel files. Answering "what is in this aisle?", "how full is it?" or "which parts barely move?" takes manual work.
- **Parts end up in the wrong aisle.** Parts are put away in aisles meant for other kinds of parts, so the aisle no longer tells where to look.
- **Changing placement is risky without a plan.** Moving parts costs labor, and there is no easy way to try a new arrangement before doing it for real.

## The Solution

A browser-based tool where the warehouse planner starts a New Plan by uploading the warehouse data (or reusing the files of an earlier plan) and works through one flow:

1. **See the warehouse** — parts, locations and which part is where; search, and move parts inside the plan.
2. **Understand movement** — every part is classified from its pick history as fast-moving, medium-moving, slow-moving or dead stock.
3. **Find parts that belong together** — parts often used on the same job (for example an air filter and a cabin filter) are flagged as pick groups.
4. **Get recommendations** — the planner marks the best locations (whole aisles, levels or single locations), and the tool suggests moves based on movement class and pick groups. Each suggestion states the rule behind it.
5. **Plan in a copy** — recommendations are applied and adjusted in a separate planning copy, and a before/after table per aisle shows what moves in and out. The plan is saved, can be reopened and edited later, and can be printed as a move list.

Once this core flow works, a second stage adds login (colleagues share the saved plans, and the landing page is the plans list), a visual view of the whole warehouse and its occupancy, a category check that lists parts placed in the wrong aisle, and printable location labels with QR codes or barcodes.

## What Makes This Different

- **Built from inside the problem.** The author works in the warehouse the tool targets and knows how the real data and process look. Requirements come from daily work.
- **Pick-together analysis you can inspect.** Sorting by pick frequency is standard practice, and dedicated slotting software also claims pick-together grouping. A spreadsheet or a general inventory tool does not find it from transaction numbers. Here every suggestion names the rule and the published threshold behind it, so the planner can check it.
- **Plan before you move, then hand over.** The planning copy lets the planner test a new placement safely instead of committing labor on a hunch. Saved plans can be reopened, and a plan prints as a move list ordered for the walk.
- **Right-sized.** Dedicated slotting and enterprise warehouse systems are typically sold on quote and with implementation work, and rarely publish how they decide where a part goes. This is a focused tool that starts from the Excel files the warehouse already has and needs no consultant.

## Who This Serves

- **Primary: the warehouse planner (the author).** Responsible for placement: manages locations, decides where parts go, and wants a data-backed plan for rearranging. Success is a placement plan they trust enough to act on.
- **Secondary: warehouse colleagues.** Find parts faster through better placement and clear labels, and carry out the printed move list.
- **Later: other planners.** The app may be used by more people in the future; they share the same saved plans.

## Success Criteria

**Checked with automated tests** on a small hand-made dataset with a known answer key (full list and rules in the addendum):

- Movement classes and pick groups match the answer key exactly, including edge cases (ties, a part in two locations, a part with no free location).
- Every recommendation names the part, its current location, the suggested location and the rule that produced it, and only uses empty locations, each for at most one part.
- Changes in the planning copy never change the imported inventory.
- An import with a missing required column fails with a clear message naming the column, and saves nothing.
- A saved plan reopens with identical state (marks, planning copy, recommendations); deleting one plan leaves the others unchanged.
- A new plan started from an existing plan's files gives the same classes, pick groups and recommendations as the original.
- The move list contains exactly the plan's moves, ordered by round and then walk path, and each line names part, from, to and rule.
- The full core flow (New Plan → classify → pick groups → recommendations → planning copy → move list) runs without errors on the demo data in `data/sample/`, following the README.

**Judged by the author:**

- The movement classes agree with the author's knowledge of which parts actually move.
- The top pick groups are ones the author recognizes as genuinely used together.

**Course:** the project, including documentation of AI-assisted development, testing and quality assurance, satisfies IBE160.

## Scope

**Core (built, tested and stable first)**

- New Plan: start a plan by uploading all three files, or by reusing the files from an existing plan; CSV/Excel import with clear errors for missing columns
- Saved plans: every plan is stored and shared, can be reopened, edited and deleted
- Parts, locations and which part is where; moving parts inside a plan; search
- Movement classification (fast, medium, slow, dead stock)
- Pick-together analysis from shared transaction numbers
- Marking best locations: whole aisles, levels and single locations
- Location recommendations
- Planning copy with a before/after table per aisle
- Printable move list: a browser print view of a plan's moves, ordered by round and then walk path

**Stage 2 (after the core flow is finished and tested)**

- User accounts and login, to track who uses the app and give it a professional look; plans stay shared between users, and the landing page is the saved-plans list
- Warehouse view: all aisles and locations with occupancy; occupied in red, empty in green, plus text label and tooltip
- Category check: categories from description keywords, categories per aisle, list of parts in the wrong aisle
- Location labels with QR codes or barcodes

**If time allows:** drag-and-drop placement, whole-warehouse optimization, QR/barcode scanning, and an estimated walking-distance reduction using the walk path.

**Out:** AI-generated explanations for recommendations; distance-based recommendations; any connection to the company's main system (no live sync, no writing back); real company data in the repo.

## Vision

If it proves itself, Smart Warehouse Planner becomes the everyday tool for keeping the warehouse organized and placement matched to demand, re-run on fresh transaction data to catch parts that have sped up or slowed down. Later steps could include scanning with handheld devices, a distance model that shows savings in meters, and use in other warehouses in the company.
