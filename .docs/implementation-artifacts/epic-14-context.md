# Epic 14 Context: Location labels with QR codes

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Stage 2 feature, built after the milestone 2 gate. The planner picks an aisle and prints one label for every location in it. Each label shows the location code in large text and a QR code that a standard phone camera reads back as exactly that code. This makes locations easier for warehouse colleagues to find and scan. Labels are produced only from a browser print view: no PDF or CSV export, and no tracking of what was printed.

## Stories

- Story 14.1: Print location labels for an aisle

## Requirements & Constraints

- **What gets printed:** one label per location in the chosen aisle, taken from the import's Locations data, in Walk Path order. Virtual locations are left out.
- **Label content:** the location code in large text (for example `A-01-10-C1`) and a QR code that encodes exactly that code and nothing else: no URL, prefix or whitespace. Scanning it with a standard phone camera app must return the code.
- **Offline:** the local app makes no runtime network calls and needs no accounts or external services. The QR code must be drawn by a bundled npm package, never by a web service or CDN.
- **Browsers:** current desktop Chrome, Edge and Firefox, including their print function. Phones and handhelds are not supported for the app itself; the phone is only the scanner.
- **Print output:** black on white, A4, in a fixed grid. A label is never split across pages, and nothing depends on printed backgrounds being on.
- **Tests:** every test name carries its FR ID (`test_fr48_…` or `it("fr48_…")`), because `npm run trace` checks this.
  - A Vitest test decodes every rendered QR code with a bundled decoder (for example jsQR) and checks it equals its location code (`test_fr48_qr_encodes_exact_code`).
  - A Playwright print check runs in `chromium`, `firefox` and `msedge`. The e2e gate requires 0 failed, 0 flaky and 0 skipped.
  - Someone must scan a QR code printed from Chrome with a phone camera by hand, and note the result in the session log.
- **Data:** synthetic data from `data/sample/` only.

## Technical Decisions

- **Server owns the data and its order:** the frontend never parses location codes and never sorts or works out which locations belong to an aisle. Aisle membership, Walk Path order and the exclusion of virtual locations come from the server. Ordering comes from `domain/ordering.py`: text compares by code point, and all-digit identifier columns sort as numbers. The frontend renders lists in server order.
- **Import-scoped data:** labels depend on the import, not on the plan's planning copy. The data is served under the TanStack Query key `['import', importId]` with an immutable cache, and refetches after commands leave it alone. Reuse the existing import-scoped location and layout data where it fits rather than adding a parallel endpoint.
- **Location references:** views refer to locations as `LocationRef {code, aisle, level, section?, position?, is_best}`. Location codes are text, exactly as normalized at import.
- **Routing and slice:**
  - Route: `/plans/{id}/labels?aisle=A`.
  - Frontend module: `modules/labels`, a vertical slice. Code shared with other features goes in common folders.
  - The frontend fetches client-side with TanStack Query. No server component, route handler or server action calls the backend.
- **Layering:** the layers are `api > app > store > domain`, and import-linter enforces them.
  - `swp.domain` stays pure: stdlib and pydantic only, with no I/O.
  - `swp.api` never imports `swp.store` directly.
  - If a backend dependency is ever added, its top-level module goes into the `domain-pure` contract. The QR library is frontend-only.
- **Spine update in the same change:** the chosen QR library's name and exact version are added to the architecture spine's Stack table. Optionally, the matching decoder used only in tests is added too. The spine's "QR library is still decided after the milestone 2 gate" note is updated to match.
- **Fonts:** self-hosted through `@fontsource` (Barlow Semi Condensed for codes), never `next/font/google` or a CDN.

## UX & Interaction Patterns

- **Launcher entry:** the launcher (flow map drawer) currently shows the stage 2 plate **LBL** as inert: dashed, with a lock icon, "Coming in stage 2" and `aria-disabled="true"`. This epic makes it active, like CAT in Epic 13. It opens the label print view.
- **Screen view:** an aisle picker listing the import's aisles, a paper preview of the labels, and a toolbar with **Print** as the one primary button. Navigation back is tertiary or a link. Follow the button hierarchy: one primary per surface; a disabled button keeps its label, stays focusable and shows its reason.
- **Print styles:** in `@media print` the app shell and toolbar are hidden.
- **Label typography:** the location code is in Barlow Semi Condensed bold with tabular numbers. On screen, nothing is smaller than 11px.
- **Colour:** the print is pure black on white (DESIGN.md print tokens `print-ink #000000` and `print-paper #FFFFFF`). No class colours, tints or backgrounds. The move-list print view (Epic 8) is the closest existing model for the screen preview, shell hiding and black-and-white print rules.

## Cross-Story Dependencies

- Builds on the following:
  - the import's Locations data with Walk Path and the wall layout (Epics for import, locations and wall)
  - the launcher with its stage 2 plates
  - the move-list print view's print patterns (Epic 8)
  - login: every page requires a logged-in user
- Epic 13 already activated the other stage 2 plate (CAT) and is a reference for how to switch a plate from inert to active.
- Single-story epic: no intra-epic dependencies.
