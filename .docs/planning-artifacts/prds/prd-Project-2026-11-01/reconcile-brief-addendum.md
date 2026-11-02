# Reconciliation: brief addendum vs PRD

Source: `.docs/planning-artifacts/briefs/brief-Project-2026-09-27/addendum.md` (binding rules, test criteria, plan/printing/user decisions, constraints, demo-data facts).
Checked against: `prd.md`, `addendum.md` (PRD addendum) and `.memlog.md` in `prd-Project-2026-11-01/`. Checked 2026-11-02.

## Verdict

The PRD carries the binding rules faithfully where it matters most. The thresholds are unchanged: 24 / 6–23 / 1–5 / 0 picks, 5 shared jobs, and transaction code `0` never grouped. Occupancy, best-location marks, Walk Path as an ordering only, and the order, tie-breaks, one-per-part and one-per-location limits and "no space" outcome of rules 1–3 also match. So do categories, the answer-key dataset, the virtual-location and shelf-line import check, text part numbers, mixed location-code patterns, merged duplicate inventory rows and the absence of capacity data. Every deliberate override in the memlog except one appears in §10: self-registration, permanent delete, manual moves into occupied locations, autosave/undo/reset and the two rule 3 limits. No threshold or rule ordering is contradicted. The weak spots are elsewhere. First, test traceability: SM-1, the automated-test metric, leaves out the saved-plan, delete and reuse-import criteria that the addendum requires as automated tests. Second, several reinterpretations are not recorded in §10: round numbering on a run with no new move, the data-as-of date, the move-list sort key, the period end, rules 1–2 working only on the current location, and QR-only labels. Third, the solo-scope constraint and its early progress check were dropped. There are 12 gaps: 1 high, 4 medium and 7 low.

## Gaps

### 1. The automated-test metric (SM-1) leaves out the addendum's persistence, delete and reuse criteria
- **Source** (Testable success criteria (full list)): "Checked with automated tests on the test dataset above: … A saved plan reopens with identical state (best-location marks, planning copy, recommendations, rounds); deleting one plan leaves all other plans unchanged." and "A new plan started from an existing plan's original files gives the same classes, pick groups and recommendations as the original plan, and the edits of the original plan are not carried over." and "A location holding no part with stock above zero is shown as empty."
- **PRD:** §8 SM-1 lists "classes, pick groups, recommendations, "no space", rounds, move-list content and order, import errors and import integrity" and "Validates FR-3–FR-5, FR-15–FR-36". That range leaves out FR-2 (reuse an import), FR-8 (reopen identical), FR-11 (delete isolation) and FR-13 (empty shown). The README flow in SM-2 does not reopen, delete or reuse a plan either. The FR consequences exist, but no success metric makes them automated tests, and SM-1 is the gate for starting stage 2 (§7.2).
- **Type:** weakened
- **Severity:** high. The addendum binds these as automated tests. A test or epic planner working from SM-1 would leave them out.
- **Fix:** Add saved-plan round-trip, delete isolation and new-plan-from-import (plus occupancy) to SM-1's list, and widen "Validates" to include FR-2, FR-8, FR-11 and FR-13. An alternative is a separate primary metric for persistence tests that also gates stage 2.

### 2. "Each run is a round" changed by A-14 without a §10 entry, and the glossary contradicts FR-22
- **Source** (Rules, Rounds): "Each run of the recommendations on the plan's current state is a round (round 1, 2, …), and every move carries the round it came from."
- **PRD:** §3 Glossary "Round" says "Each run starts a new round". FR-22 (A-14) says "A run with no new move since the previous run replaces that run's recommendations and keeps its round." §10 lists round 0 for manual moves but not A-14.
- **Type:** unrecorded change, with an internal inconsistency
- **Severity:** medium. The PRD defines round numbering two ways, and round numbering decides the move-list order.
- **Fix:** Reword the glossary entry to match FR-22: a run starts a new round only after a new move. Add A-14 to the §10 list.

### 3. The data-as-of date is redefined from "import date" to the newest transaction date
- **Source** (Plans, printing and users, A plan): "Each plan records the import it was built from and the import date ("data as of …"), because the tool is only as current as the latest import."
- **PRD:** §3 Glossary "Data-as-of date" uses `[ASSUMPTION A-2: the newest transaction date in the Transactions file.]`. FR-6 records the import time separately but shows the newest-transaction date as "data as of". §10 does not list this.
- **Type:** unrecorded change (reinterpretation)
- **Severity:** medium. The date is printed on every move list and is part of test criterion "print view shows plan name, 'data as of' date and generated-at time". Which date counts changes what that test asserts.
- **Fix:** Confirm A-2 with the author. If it is kept, add a §10 line saying "data as of" means the newest transaction date, not the upload date. Otherwise define it as the import date.

### 4. No testable consequence covers a location that holds only zero-stock rows
- **Source** (Testable success criteria): "A location holding no part with stock above zero is shown as empty." Also Rules, Occupancy, and Demo data: "416 empty (375 with no part, 41 with only a zero-stock part)".
- **PRD:** The §3 Glossary carries the definition. FR-13 only says "occupied or empty". No consequence states that a location whose only rows have stock 0 is empty, is shown as empty and may be suggested. The §7.3 edge-case list does not include it either.
- **Type:** weakened
- **Severity:** medium. This is a binding test criterion, and its key edge case (41 locations in the demo data) is not made explicit.
- **Fix:** Add a consequence to FR-13 (and a reference in FR-26): "A location whose inventory rows all have stock 0 is empty, is shown as empty and can be suggested by a rule." Add such a location to the §7.3 answer-key edge cases.

### 5. The solo time box and the early progress check were dropped
- **Source** (Constraints and Risks, Solo scope): "One person in about two months. The core flow is finished and tested before any stage 2 or "if time allows" item is started, and progress is checked early against the core list."
- **PRD:** §1 says "one person in one semester". §7.2 and SM-C3 gate stage 2 behind the core, but not the "if time allows" items. The ~2-month time box and the early checkpoint against the core list are missing, and the PRD has no constraints or risks section.
- **Type:** dropped
- **Severity:** medium. This constraint and its mitigation should shape epic sizing and sprint planning.
- **Fix:** Add a short constraints note to §7 or §5. It should state the ~2-month solo time box, that neither stage 2 nor "if time allows" items start before SM-1 and SM-2 pass, and that there is an early checkpoint against the core list.

### 6. "Same recommendations" for a new plan from an existing import was narrowed without a record
- **Source** (Testable success criteria): "A new plan started from an existing plan's original files gives the same classes, pick groups and recommendations as the original plan, and the edits of the original plan are not carried over."
- **PRD:** FR-2's second consequence narrows this to "with the same best-location marks and no moves, its first run gives the same recommendations as the chosen plan's first run". FR-17 (A-13), where each plan stores its own settings, leaves open which settings a reused-import plan uses. If the configuration changed in between, "same classes" can fail.
- **Type:** unrecorded change (narrowed)
- **Severity:** low. The narrowing is sensible, because marks are edits and are not carried over, so the addendum's literal wording cannot hold.
- **Fix:** Add a §10 line explaining the reformulation. State in FR-2 whether the new plan uses the chosen plan's stored settings or the current ones.

### 7. The move-list sort key changed from "current location" to "from-location"
- **Source** (Plans, printing and users, Move list, and the test criterion): "Lines are ordered by round first (see Rounds) and then by the Walk Path of the part's current location".
- **PRD:** FR-36 says "ordered by round, then by the Walk Path of the from-location". This is not recorded in §10.
- **Type:** unrecorded change (clarification)
- **Severity:** low. The intent is the same. But a test written from the addendum might sort by the part's current location in the planning copy, which after the move is the to-location.
- **Fix:** Add a §10 line saying the addendum's "current location" means the move's from-location, which is the part's current location when the move was made.

### 8. Period end boundary: "before" became "up to and including"
- **Source** (Rules, Period): "Analysis uses the last 12 months before the newest transaction date in the import."
- **PRD:** §3 "Period" says "the 12 months up to and including the newest transaction date". A-3 tags only the start day. Including the end day is neither tagged nor in §10.
- **Type:** unrecorded change (boundary interpretation)
- **Severity:** low
- **Fix:** Extend A-3 to cover both ends and add both boundary days to the answer-key dataset (§7.3).

### 9. Rules 1–2 apply only to the current location, and a part with no stock has no current location; neither is tagged
- **Source** (Rules, Recommendations and Current location): "A fast-moving part outside the best locations …", "A slow-moving or dead-stock part in a best location …", and "A part stored in more than one location uses the location with the most stock as its current location."
- **PRD:** FR-23 and FR-24 test only "whose current location is (not) a best location". §3 adds "A part with no stock above zero anywhere has no current location." Neither is tagged as an assumption or listed in §10. Two consequences follow. A slow or dead-stock part whose smaller second stock sits in a best location is never moved out. A fast mover at zero stock gets no rule 1 recommendation, and its location counts as empty.
- **Type:** unrecorded change (interpretation)
- **Severity:** low. It follows the addendum's Current location rule, but it decides answer-key results for "a part stored in two locations".
- **Fix:** Tag both points as assumptions, or confirm them as decisions. Add an answer-key case: a part in two locations where one of them is a best location.

### 10. Location labels are QR only; barcodes dropped without a §10 entry
- **Source** (Feature detail, Core website functionality): "Generate QR codes or barcodes for locations (stage 2)". Also MVP and stretch lists, Stage 2: "Location labels with QR codes or barcodes".
- **PRD:** FR-45, the §3 "Location label" entry and §7.2 say QR code only. The memlog records this as a user decision on 2026-11-02, but §10 does not list it.
- **Type:** unrecorded change
- **Severity:** low (stage 2, and the addendum offered QR as one option)
- **Fix:** Add to §10: "Location labels use QR codes only; barcodes dropped (user decision 2026-11-02)."

### 11. Virtual locations are allowed only on Issue Part lines, so a real Return to Stock line at `RETURN-SKRS` rejects the import
- **Source** (Solution detail, Import): "Virtual locations such as `FLSKRS` (and `RETURN-SKRS` in real data) appear in transactions but not in `Locations.xlsx`; they are allowed and are never shelf locations." Also Findings: "Return to Stock = … (`FLSKRS` → `RETURN-SKRS`, then **Putaway** to a shelf)."
- **PRD:** FR-4 accepts only "An Issue Part line at a virtual location". Return to Stock is a shelf line that must be in the Locations file, and Putaway is ignored (A-6). With a real export, a Return to Stock line at `RETURN-SKRS` would reject the whole import. The addendum's own test criterion also lists Return to Stock as a shelf line, so the conflict starts in the source.
- **Type:** weakened
- **Severity:** low. The demo data uses the simplified one-line return, and §9 Q2 already requires checking against real files.
- **Fix:** Add this case to §9 Q2. For real data, either treat Putaway as the shelf line and allow known virtual locations on Return to Stock, or state that real imports need this rule adapted.

### 12. The demo-data reference figures were dropped
- **Source** (Rules, Movement classes and Pick groups, and Demo data): "about 80 fast, 250 medium, 580 slow and 640 dead-stock parts"; "about 130 pairs in the demo data"; "1,584 locations are occupied and 416 empty (375 with no part, 41 with only a zero-stock part)".
- **PRD:** missing. SM-2 only checks that the demo flow runs "without errors".
- **Type:** dropped
- **Severity:** low. These are reference figures, but they are the only check that the period, thresholds and occupancy behave correctly on the full demo data.
- **Fix:** Add them as expected ranges for `data/sample/`, either to SM-2 or to the PRD addendum. Reconcile "640 dead-stock" with "636 parts never move" in the source.

## Not counted: ambiguities shared by the addendum and the PRD

These are not PRD gaps, but each one decides answer-key results and should be settled before the test dataset is written:

- **"No space" and the one-outcome limit.** Neither document says whether a part listed "no space" under rule 1 or rule 2 can still get a rule 3 recommendation.
- **Equal stock in two locations.** Neither document says which location is the current location.
- **Sort order.** "Part-number order" and "location-code order" could be text order or numeric order. With text part numbers (`2007060`, `1008614-00`) and mixed location-code patterns, the choice changes results.
- **Rule 3 loop cases.** The PRD addendum says both rule 3 loop cases belong in the answer key, but §7.3 does not list them.
