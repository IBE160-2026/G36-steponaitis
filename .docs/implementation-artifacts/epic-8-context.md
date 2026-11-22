# Epic 8 Context: Print the move list for colleagues

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Milestone 2 gives the planner a black-and-white move list printed from the browser. It holds exactly the plan's effective moves, in round order. Within a round, moves out of a location come before moves into it. Swap lines are marked, and the header tells two printouts apart. The reader is a colleague who has never seen the app and follows the paper top to bottom in the aisles. The colleague must never arrive at a location that a later line still has to empty. The epic closes the move-list part of the answer-key scenario that was deferred from Epics 5 and 7, and adds the print check in every supported browser.

## Stories

- Story 8.1: Move-list order and header in the domain
- Story 8.2: Mark the lines of a swap
- Story 8.3: Move list print view
- Story 8.4: Paper layout and print check in every browser

## Requirements & Constraints

- **Content:** exactly the plan's effective moves after combining and move-back (FR-34), no more and no fewer. Each line has round, part, part description, from-location, to-location, rule, move number and a tick box. A plan with no moves says "There are no moves to print." There is no PDF or CSV export.
- **Order:** rounds ascend. Within a round, a line into a location comes after every line in that round that moves a part out of it. Other lines follow the Walk Path of the from-location, then part-number text order. Lines that form a cycle follow Walk Path order. A property test checks that no line moves a part into a location that a later line in the same round empties, except inside a cycle (`test_fr38_out_before_in`).
- **Rounds:** round numbers print as stored and gaps stay. Round 0 is labelled "before the first run". The header's round count is the number of distinct rounds that have a move.
- **Swaps:** lines that share a `swap_id` follow each other where the order allows, and carry `swap {index, size, locations: [a, b]}`, but only while the swap is intact: every step of that swap exists and is its own effective move. If one step was undone or combined, the remaining lines print as ordinary Manual lines (`test_fr38_swap_mark_only_when_intact`). A cycle made with plain manual moves, such as the answer key's 9100 ↔ 9200, gets no swap mark. Until Epic 12 adds the swap command, swaps are tested with fixture states.
- **Answer key:** the final state of the Story 7.5 scenario gives 14 lines in the answer key's order. 9300 comes after 1100, because it moves into the location 1100 leaves. 9100 and 9200 are in Walk Path order as a cycle. 0100's round 2 line is one combined Manual move (`test_fr38_answer_key_move_list`). `data/answer-key/` is read-only.
- **Header:** plan name, data-as-of date, upload date, number of rounds and the generated time. The generated time is the only thing that tells two printouts apart, so it is printed in the header and not in small print.
- **Browsers:** current desktop Chrome, Edge and Firefox, including print. The print must be legible on a black-and-white office printer with background printing turned off.
- **Editing:** printing never locks a plan, and the plan stays editable.
- **Tests and gate:** test names carry their FR (`test_fr38_*`). The milestone 2 gate needs FR-38 among the answer-key tests, plus the move-list print check in every Playwright project.

## Technical Decisions

- **The move list is a domain view.** `domain/move_list.py` is the only place that builds the lines, their order and the swap marks, as pure code with no database, file or network access. Its input is the effective moves from `domain.planning.replay`. Import-linter lets the `move_list` slice import only `planning` and the domain kernel. All ordering comes from `domain/ordering.py`: Python `str` code-point order, with all-digit identifier columns sorted numerically.
- **Endpoint:** `GET /api/plans/{id}/move-list` returns the plan `version`, the header (`name`, data-as-of date, `uploaded_at`, round count, `generated_at`) and the rounds with their lines in domain order. A plan with no moves gets an empty list. `generated_at` is the server instant of the request, and the client formats it in the viewer's time zone. The endpoint never writes and does one `replay` per request, with no cross-request cache.
- **Server-authoritative:** the frontend never computes or re-sorts the move-list order or the swap marks.
- **Slice locations:** the backend slice is `domain/move_list`. The frontend has the route `app/plans/[id]/print` and the module `modules/move-list`. Dates and times go through `lib/format` (`YYYY-MM-DD`, `HH:MM`).
- **Print route:** it fetches the view on mount and renders only after the response arrives. Pressing Print fetches the view again, re-renders it and then calls `window.print()`, so every printout has a fresh generated time and the latest moves. The header and column heads sit in a repeating `<thead>`. "Page X of Y" is best effort.
- After a backend change, regenerate `frontend/lib/api/schema.ts`, because CI fails on a diff.
- **E2E:** Playwright projects `chromium`, `firefox` and `msedge` use `data/sample/` to import, mark best locations, run, apply all and open the print route. Each project emulates print media and checks the header, the ROUND bands and that the line count equals the plan's moves. It saves a PDF (Chromium-based projects) or a screenshot as an artifact for manual review.

## UX & Interaction Patterns

- **Screen view:** a paper preview with **Print** (the only primary button) and "Back to Recommendations". In `@media print`, the app shell, the toolbar and the preview buttons are hidden. In the flow bar, Move list is `aria-current="step"` and never gets a check, because it is an output. The launcher already opens the step through "mov".
- **Header (every page):** "Move list · <plan name>", then "Data as of YYYY-MM-DD · uploaded YYYY-MM-DD · N rounds", then "Generated YYYY-MM-DD HH:MM · Smart Warehouse Planner". The plan name is in Barlow 14pt bold.
- **Round band:** bold "ROUND N" in a 1.5px black box, followed by "one walk · from-location before to-location", with 2px black rules above and below. Round 0 reads "before the first run". The band has no fill and is never left alone at the end of a page: it keeps at least two lines with it (`break-after: avoid` / `break-inside: avoid`).
- **Line:** 14px tick box · Round · Part · Description · From · To · Rule · Note (a blank ruled space). Every line prints its Round value, even under its band. Codes and part numbers are in Barlow bold at about 12pt (16px), and text is in Figtree at about 10pt (13.5px). Lines are separated by 1px rules.
- **Swap line:** the Rule cell reads "Manual · Swap 1/2", with "A-02-01-01 ↔ G-14-04-02" under it in the code font.
- **Footnotes:** "Lines follow Walk Path; moves out of a location come before moves into it, except in a swap." When a swap is present, also: "Swap: set one bin aside, move the other into its place, then put the first one in."
- **Paper:** A4 portrait, pure black on white, with no colour, grey tones, tints or bin swatches. Changed Key colours never reach the print. `print-color-adjust: exact` may be set, but nothing may rely on it.
- **Empty state:** "There are no moves to print." Print is `aria-disabled` and shows that reason on hover and on focus, and a link goes to Recommendations.
- **Copy rules:** use glossary terms exactly, sentence case, no exclamation marks, and dates as `YYYY-MM-DD` and times as `HH:MM`.

## Cross-Story Dependencies

- Builds on Epic 4 (`replay`, effective moves, FR-34 combining and move-back), Epic 5 (runs, rounds, rules, the Recommendations page) and Epic 7 (undo, reset, and the Story 7.5 answer-key final state, whose printed order was left for this epic). Epic 6's launcher already links to the Move list step.
- 8.1 comes first, because it supplies the domain lines and the endpoint. 8.2 adds swap marks to the same domain view. 8.3 renders the view and needs 8.1 (and 8.2 for swap cells). 8.4 styles the paper and adds the cross-browser e2e check on top of 8.3.
- Swap marks are tested with fixture states, because the drag and swap commands (FR-51) arrive in Epic 12.
