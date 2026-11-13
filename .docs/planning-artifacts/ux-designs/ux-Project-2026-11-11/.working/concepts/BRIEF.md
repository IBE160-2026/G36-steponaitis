# Shared brief: 10 divergent SVG design concepts for Smart Warehouse Planner

You are one of 10 designers working in parallel. Each of you owns ONE concept (a visual world + a product structure). The concepts must differ strongly from each other, so commit fully to yours and do not drift toward a generic SaaS dashboard.

## Read first (required)

1. `PRODUCT.md` (project root): users, purpose, principles, accessibility. This is product truth.
2. `.docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md`: read §3 Glossary and §4.0 Key screens, and skim §4.6–4.10 and §4.12 (warehouse view). Use the glossary terms verbatim in UI copy.
3. `/Users/justas/.claude/skills/impeccable/reference/craft-floor.md`: quality floor and bans (no eyebrow/kicker labels above headings, no gradient text, no emoji/unicode as icons, no identical icon+heading+text card grids, no thick coloured border-left on cards, no hard offset shadows unless your world is neobrutalist).
4. `/Users/justas/.claude/skills/impeccable/reference/mode-operate.md` if it exists: the app screens are an Operate surface. The landing page is a Persuade surface (more expression allowed).

## The product in one paragraph

Smart Warehouse Planner (exact product name) imports three files a spare-parts warehouse already exports (Locations, Inventory, Transactions). It classifies every part by picks in the last 12 months (fast-moving ≥24, medium-moving 6–23, slow-moving 1–5, dead stock 0), finds pick groups (two parts with ≥5 shared jobs; each is the other's partner), lets the planner mark best locations (whole aisle, a level, or single location), then runs recommendations in rounds: rule 1 fast-moving part into a best location, rule 2 slow-moving/dead stock out of a best location, rule 3 part moved into its partner's aisle, plus Manual moves. Each recommendation can be applied, applied with another suggested location, or declined with "keep in place". "No space" when no empty location fits. Outdated recommendations are marked. Moves live in a planning copy; the import never changes. A before/after table per aisle shows the effect. Output: a printed move list in round order with a tick box per line. The tool suggests; the planner decides. Explain every number. Honest about data: always show the data-as-of date; never claim distance, capacity, metres saved, or live stock.

## Synthetic demo data (use these realistic numbers; never invent customers, testimonials, or usage figures)

- One warehouse, 9 aisles A–I, 2,000 locations (~222 per aisle). Each aisle: 19 sections × 4 levels × 3 positions. Location code `<aisle>-<section>-<level>-<position>`, e.g. `C-07-02-03`.
- Walk Path: 0 at A-01-01-01, +10 per location, up to 19,990 in aisle I. Ordering only, not a distance. Aisles walked A→I.
- Aisles 65–87% occupied; 416 empty locations; 1,545 parts; 636 dead stock; 80 parts in two locations.
- Data-as-of date: 2026-09-30. Period: 2025-10-01 – 2026-09-30.
- Example parts (synthetic; car-model descriptions are fine): `9723950 Headlight bulb H7 - Peugeot 308`, `6900616 Timing belt kit - Hyundai Tucson`, `5315766 Air filter - Audi A4`, `7181839 Alternator - Hyundai Tucson`, `2555849 Brake hose - Toyota Corolla`, `3298226 Tail light assembly - Toyota RAV4`, brake pads + brake discs for the same car often form a pick group (e.g. `4410281 Brake pads, front - VW Golf` + `4410297 Brake disc, front - VW Golf`, 14 shared jobs).
- Plausible plan name: "Spring re-slot 2026", created by Justas. Example recommendation: `4410281 Brake pads, front - VW Golf` · fast-moving · 61 picks · current G-14-04-02 (not best) → suggested A-02-01-01 (best location: aisle A, level 1) · rule 1. Example rule 2: `3632446 Catalytic converter - BMW 320d` · dead stock · 0 picks · in best location A-01-04-01 → suggested H-11-04-03 · rule 2.
- Virtual location `FLSKRS` exists in transactions only; never a shelf.
- NEVER use any real company name or logo. Synthetic data only.

## Surfaces to draw (SVG, 1440 × 900 each, `viewBox="0 0 1440 900"`)

Write these files into your concept folder:

1. `landing.svg` — public landing page first viewport (+ start of the section below if it fits). Persuade mode: the most expressive of the set. Must say what the tool does in one clear line, show the flow (import → classify → mark best locations → recommendations in rounds → before/after → printed move list), and a primary action ("Open the demo" / "Start a New Plan"). No invented claims, no testimonials, no "meters saved".
2. `warehouse-layout.svg` — **MOST IMPORTANT.** The digital warehouse layout: all 9 aisles with their locations, showing occupied/empty (never colour alone — add shape/pattern/text cue), best locations, movement class of the stored parts, and at least one visible recommendation/move overlaid on the layout (from-location → to-location with rule label), plus a hover/selected location tooltip (location code + parts stored). Show aisle occupancy % and whole-warehouse occupancy. Show the data-as-of date. This is where your concept's signature move should be most alive. Make the layout a real, buildable, information-dense map — not a decorative illustration.
3. `interface.svg` — **MOST IMPORTANT.** The main working interface of the app: the recommendations workspace (run round, list per rule with the reason and the numbers, Apply / Apply with another location / Keep in place, a "no space" row, an outdated row), with the app shell (navigation, plan name, data-as-of date, where-am-I-in-the-flow indicator) and how it connects to the warehouse layout and the before/after effect. Real content, real states.
4. `features-menu.svg` — the features menu / navigation model: how the planner moves between all features (saved plans, New Plan, plan overview, parts, locations, pick groups, best locations, recommendations, before/after, move list, settings; and stage-2 items: warehouse view, category check, location labels, account — shown as later/locked). Can be an expanded nav, a command palette, a flow map, a mega-menu, a launcher — whatever fits your concept. Show the flow order and where the planner is.
5. `screen-map.svg` — a sketch sheet of ALL other key screens as small but legible thumbnails in your concept's style: saved-plans list, New Plan (with an import error naming file/row/column), plan overview, parts list, locations list, pick groups, best locations marking, before/after table, move list print view (black & white, round headers, tick boxes, header with plan name, data-as-of date, upload date, rounds, generated time). Label each thumbnail.
6. `concept.md` — a short card (≤250 words): concept name, THESIS (one idea, the default it refuses), OWN-WORLD (palette hexes, type faces, materials), SIGNATURE MOVE (named concretely), how the warehouse layout works, navigation model, honest risk, and a one-line "why a planner would trust it".

## SVG craft rules

- Hand-authored, valid XML (run `xmllint --noout file.svg` on every file). No raster images, no base64, no external images, no `<foreignObject>`, no JavaScript. Use `<defs>`, `<pattern>`, `<symbol>`/`<use>`, `<clipPath>`, gradients only when your world needs them.
- Fonts: you may `@import` a Google Font inside an SVG `<style>` (escape `&` as `&amp;`), always with a sensible fallback stack. Avoid the overused defaults: Inter-as-display, Space Grotesk, Space Mono, IBM Plex, DM Sans, Fraunces, Playfair, Syne, Outfit, Plus Jakarta Sans — unless your world truly needs one.
- Text must be real and readable: minimum 11px for UI text on a 1440-wide canvas, body 13–15px, tabular numbers for data. No lorem ipsum.
- No information by colour alone: classes, rules, occupied/empty, best location, outdated each need a shape, pattern, or text cue.
- Icons: authored SVG paths in one consistent stroke weight. No emoji.
- Buttons, tabs, inputs, tables, menus must read as standard, buildable web controls (Operate mode); the world contributes type, palette, density and ONE signature move, not costume controls.
- Light or dark: choose from the use scene (office desk next to the warehouse floor, daylight/fluorescent) and your world, not by habit.
- Aim for density and polish of the best product in the category. Each SVG is typically 300–900 lines; do it properly.

## Verify by looking

Render each SVG to PNG and look at it, fix what is broken (overlaps, text overflow, clipping, illegible sizes), then look again once:

```sh
cd <your concept folder> && (qlmanage -t -s 1440 -o /private/tmp/claude-501/-Users-justas-Documents-IBE160-Semester-Oppgave/059fb26e-f3a1-415e-93f9-e0028ea9c2fa/scratchpad/<your-folder-name> warehouse-layout.svg >/dev/null 2>&1 &); perl -e 'sleep 8'
```

(create that scratchpad subfolder first). Then Read the resulting `.svg.png`. Quick Look renders web fonts with a fallback and pads to a square — that is fine; judge layout, overlap, and legibility. Do not leave PNGs in the concept folder.

## Report back (≤150 words)

Concept name, the signature move, which files you wrote, and the one thing you are least sure about.
