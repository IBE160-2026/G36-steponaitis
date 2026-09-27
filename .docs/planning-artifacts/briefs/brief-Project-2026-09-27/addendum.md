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
