# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Undecided: chosen in the architecture step (bmad-architecture), which has not run yet. It must deploy to Vercel as a public demo and also install and run locally on a laptop with no paid accounts, API keys or network calls at runtime (PRD NFR-2, NFR-5).

## Users

**Primary: the planner.** In the real use case this is the warehouse planner of a spare-parts warehouse (the author), who decides where parts should sit. The job is to turn the warehouse's own exports into a data-backed re-slotting plan: which parts to move where, with a reason the planner trusts, and a list colleagues can carry out without them.

**In practice right now: the course demo.** The app is used mainly to demo and evaluate the IBE160 project (*Programmering med KI*, Høgskolen i Molde, autumn 2026), on synthetic data. Most sessions are someone meeting the flow for the first time, following the README: import the demo files, see movement classes and pick groups, mark best locations, run recommendations, try them, compare before/after, print the move list. First-run clarity matters more than expert speed.

**Secondary: the colleague.** A warehouse worker who never uses the app and only sees the printed move list. They work through it top to bottom, one walk per round, ticking a box per line.

**Not users:** anyone who needs live stock figures, phone or handheld users (v1), and examiners as a product audience (they run the demo through the README).

## Product Purpose

Smart Warehouse Planner imports the three files the warehouse already exports (Locations, Inventory, Transactions). It shows which part is where, classifies every part by how often it is picked, and finds parts used on the same jobs. From that, and from the locations the planner marks as best, it recommends moves. Recommendations are tried in a planning copy of the warehouse, a before/after table per aisle shows the effect, and the finished plan prints as a move list in round order.

Success means the planner would act on the recommendations and hand the printed list to colleagues (PRD SM-5). It also means the demo flow runs end to end from the README on the sample data (SM-2), and a colleague can follow the list top to bottom without arriving at a location that has not been emptied yet (SM-6).

## Positioning

**The tool suggests; the planner decides.** Every recommendation names its rule (rule 1: fast-moving into a best location; rule 2: slow-moving or dead stock out of a best location; rule 3: next to its pick-group partner) and the numbers behind it. Each one can be applied, applied with another location, or declined with "keep in place". Nothing touches the company's main system, and the import is never changed. Explainable, deterministic rules built on the warehouse's own transaction history, with no AI at runtime, are the core of the product, not a limitation.

## Operating Context

- Desktop browser (current Chrome, Edge, Firefox) on a laptop or office monitor. No phones or handhelds in v1.
- Input: `.xlsx` or UTF-8 `.csv` exports. There is no column-mapping screen, and import errors name the file, the row and the column.
- The core flow, in order: New Plan → plan overview → parts / locations / pick groups → best-location marks → recommendations (rounds) → planning copy and before/after table → move list print view.
- Output is paper. The move list is printed from the browser's print function and carried into the aisles; its header shows the plan name, the data-as-of date and when it was generated.
- Plans are saved automatically and shared, and they reopen exactly as they were left. Up to about 10 users in total.
- Key screens and the fixed vocabulary are in the PRD: `.docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md` §3 Glossary and §4.0. UI copy uses the glossary terms verbatim (e.g. "best location", "pick group", "keep in place", "no space", "round", "data-as-of date").

## Capabilities and Constraints

- Core (milestones 1–2): FR-1–FR-40, FR-42 and FR-50 (the warehouse view, moved into milestone 2 on 2026-11-13; its key colours can be changed by clicking them; accounts, login and a Demo version button that skips the login, moved into milestone 2 on 2026-11-14; FR-50). Stage 2 (category check, location labels with QR) starts only after the milestone 2 gate. The concurrent-edit warning (FR-41) is an "if time allows" item.
- The data has no size or capacity information, so the app cannot check whether a part fits. The planner judges that and uses "keep in place".
- Walk Path is an ordering only. No distances or "meters saved" claims.
- Out of scope: PDF or CSV export, tracking whether moves were carried out, live collaboration, roles, creating or editing locations, comparing plans, AI-generated explanations.
- The UI is in English (NFR-11).
- Solo project: one person, about two months.

## Brand Commitments

- The product name is **Smart Warehouse Planner**.
- The UI never shows the real company's name, logo or any other identifying brand. No other identity commitments.

## Evidence on Hand

- Synthetic demo data: `data/sample/` (Locations.xlsx, Inventory.xlsx, transactions.xlsx), generated by `data/generate_demo_data.py`.
- Hand-made answer-key dataset with expected results: `data/answer-key/`.
- Public demo deployment: https://g36steponaitis.vercel.app (synthetic data only).
- There are no testimonials, customers, usage figures or measured time savings. Do not invent any. Real company files, part numbers and screenshots must never appear in the UI, the docs or examples.

## Product Principles

1. **Explain every number.** A recommendation, class or count always shows the rule and the figures behind it. Nothing is a black box.
2. **The planner has the last word.** Applying, adjusting or declining is always one clear step away, and nothing changes the import or the company's system.
3. **Clear on first contact.** Someone new must get through the whole flow from the README without help. Name things with the glossary terms and show where the planner is in the flow.
4. **Paper is a first-class output.** The move list must be safe to follow by someone who never saw the app: round order, from-location before to-location, a tick box per line.
5. **Honest about the data.** Always show how current the data is (the data-as-of date), and never imply capacity, distance or live stock knowledge the tool does not have.

## Accessibility & Inclusion

- No information is shown by color alone. Movement classes, rules, occupied/empty, best location and outdated recommendations each need a text or shape cue as well (NFR-10).
- All forms and buttons can be used with the keyboard (NFR-10).
- The move list must stay legible when printed in black and white.
