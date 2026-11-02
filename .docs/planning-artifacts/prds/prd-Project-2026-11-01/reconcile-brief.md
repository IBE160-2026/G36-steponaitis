---
title: "Reconciliation: brief.md against PRD"
source: .docs/planning-artifacts/briefs/brief-Project-2026-09-27/brief.md
checked: prd.md, addendum.md, .memlog.md (prd-Project-2026-11-01)
date: 2026-11-02
---

# Reconciliation: brief.md against PRD

## Verdict

The PRD carries the brief's substance faithfully. Every core, stage 2 and "if time allows" scope item has a home (FR-1–FR-45, §7). The three author success signals are SM-3–SM-5, and the why-now argument, the main-system boundary, the planning copy, the move list and the transparency differentiator (FR-27) are all kept. Each problem bullet is answered by something: rules 1–3 cover usage-blind placement and split pick groups, FR-12–FR-14 cover the scattered overview, the stage 2 category check covers wrong-aisle parts, and the planning copy covers risky changes. The losses are in qualitative intent and success signals. The "it suggests, people decide" stance survives only as a clause in a non-goal, and the requirements give the planner no way to make a declined suggestion stick. The colleague's "one walk, in the right order" signal is neither measured nor reconciled with rounds. The course success criterion is gone. One brief measurable criterion falls outside the automated-test metric. One deliberate memlog decision (QR-only labels) is missing from §10, although §0 says every difference is listed there. No committed scope item is lost or contradicted.

**Totals:** 11 gaps: 1 high, 4 medium, 6 low.

## Gaps

### 1. A declined recommendation comes back on every run ("people decide" does not stick)

- **Source:** Executive Summary: "The tool is not connected to the company's main system and never changes it: it suggests, and people decide." The Solution, step 5: "recommendations are applied and adjusted in a separate planning copy".
- **PRD:** The stance appears only as a trailing clause in §6, non-goal 1. FR-22 says "A run replaces all recommendations from earlier runs that were not applied." FR-29 says "Apply all" applies every recommendation that is not applied or outdated. In UJ-1 the planner "skips one that would not fit physically" and then runs round 2. §6 adds "No capacity or fit checks … the planner judges that."
- **Type:** weakened
- **Severity:** high. The planner can apply a recommendation or leave it, but cannot decline it. A skipped recommendation is generated again on the next run, usually with the same target. "Apply all" in that round would then carry out the move the planner already rejected. The tool has no fit data, so the planner's judgment is the only fit check, and the plan has nowhere to store it. Without a fix, UX would design the recommendation list without a decline action, architecture would leave it out of the plan's state, and UJ-1's round 2 would not behave as the journey describes.
- **Fix:** Add an FR for declining a recommendation, or for marking a part "keep in place". The decision is stored in the plan, is left out of later runs and of Apply all, and can be undone. State "the tool suggests, the planner decides" as a principle in §1 or §2, not only as a non-goal.

### 2. The colleague's success signal has no metric, and "one walk" became one walk per round

- **Source:** Who This Serves: "Success is a move list they can follow in one walk, in the right order."
- **PRD:** The colleague JTBD in §2.1 covers walk order, the tick box and "never need a location that has not been freed yet". Other locations: FR-36 (ordered by round, then by the Walk Path of the from-location), and UJ-2 ("then starts on round 2"). §8 has no colleague metric; SM-5 is the author's own judgment.
- **Type:** weakened / unrecorded change
- **Severity:** medium. The number of rounds has no upper limit, and each round is a separate walk. The PRD changes "one walk" into "one walk per round" without saying so in §8, §9 or §10. The safety property in the JTBD ("never need a location that has not been freed yet") is argued in the PRD addendum but is not a testable consequence of FR-36.
- **Fix:** Add a testable consequence to FR-36 or SM-1: carried out top to bottom, every recommended move's to-location is empty once the lines above it are done. Record in §10 that a plan with several rounds means one walk per round. Alternatively, add a requirement that keeps rounds few, for example by showing the round count before printing.

### 3. The course success criterion was dropped

- **Source:** Success Criteria, Course: "the project, including documentation of AI-assisted development, testing and quality assurance, satisfies IBE160."
- **PRD:** Missing from §8. §0 names examiners as readers, and NFR-3 says AI is used only during development, but no metric or scope item covers the documentation, test evidence or QA. Not listed in §10.
- **Type:** dropped (unrecorded)
- **Severity:** medium. This is the criterion the course grades on. Epics derived from the PRD will not plan the documentation and QA deliverables.
- **Fix:** Add a course-level success metric, or a note in §8, that names the deliverables: documentation of AI-assisted development (for example the `.logs/` session logs), test evidence, and QA. Alternatively, record in §10 that it is tracked outside the PRD.

### 4. "A saved plan reopens with identical state" falls outside the automated-test metric

- **Source:** Success Criteria, Measurable: "Changes in the planning copy never change the imported inventory, and a saved plan reopens with identical state."
- **PRD:** FR-8 has the consequence. However, SM-1 "Validates FR-3–FR-5, FR-15–FR-36", and its list (classes, pick groups, recommendations, "no space", rounds, move list, import errors, import integrity) leaves out plan persistence. The SM-2 flow never reopens a plan.
- **Type:** weakened
- **Severity:** medium. A measurable criterion from the brief has no success metric, so the persistence test could slip out of the test stories.
- **Fix:** Add "saved plans reopen with identical state" to SM-1 and extend its range to cover FR-8. FR-2 and FR-11 could be added at the same time, since the brief's addendum also lists them as automated tests.

### 5. Location labels were narrowed to QR only, and §10 does not say so

- **Source:** Scope, Stage 2: "Location labels with QR codes or barcodes".
- **PRD:** FR-45 and §7.2 ("Location labels with QR codes"). The memlog records the decision ("Location labels (stage 2) use a QR code"). §10 is silent, although §0 says "every difference is listed in §10".
- **Type:** unrecorded change
- **Severity:** medium. The change is deliberate and small, but it breaks the PRD's own completeness claim, and examiners follow that trail.
- **Fix:** Add a §10 bullet saying labels use QR codes only and barcodes were dropped, with the reason (for example, standard phone cameras read QR codes).

### 6. "How full is it?" has no answer in the core

- **Source:** The Problem: "Answering "what is in this aisle?", "how full is it?" or "which parts barely move?" takes manual work across files."
- **PRD:** The JTBD in §2.1 repeats all three questions for the primary planner, with no stage attached. In the core, FR-13 offers only filters (by aisle and by occupied/empty). Occupancy per aisle as a figure first appears in FR-39, which is stage 2. FR-21 counts only best locations.
- **Type:** weakened
- **Severity:** low. The brief also puts the occupancy view in stage 2, but the PRD's JTBD implies the core answers the question.
- **Fix:** Add counts of occupied and empty locations per aisle to FR-13, which is cheap. Alternatively, say in the JTBD that the occupancy figure comes with the stage 2 warehouse view.

### 7. "Published threshold": the plan's settings are never shown

- **Source:** What Makes This Different: "Here every suggestion names the rule and the published threshold behind it, so the planner can check it."
- **PRD:** FR-27 carries thresholds in recommendation reasons. However, FR-17 stores settings per plan and changes them only in a configuration file (A-13), and no FR shows the plan's settings or period dates. FR-12 shows a part's class without its limits. "No space" entries (FR-26) carry the rule but no numbers.
- **Type:** weakened
- **Severity:** low. Two plans computed with different settings would look different with no visible reason.
- **Fix:** Add a consequence to FR-6 or FR-17: the plan shows its settings, meaning the period start and end, the class limits and the pick-group minimum. Add a consequence to FR-26: "no space" entries show the same reason text as FR-27.

### 8. The before/after table checks only the fast-mover half of the outcome

- **Source:** Executive Summary: "fast movers in the best spots, and parts that belong together stored in the same aisle", "so the planner can see the result before anything is physically moved."
- **PRD:** FR-35 counts fast-moving parts in best locations before and after, but has nothing for pick groups. SM-C2 warns against maximizing that count "at the cost of splitting pick groups", which the table cannot show. FR-19 shows whether each pick group is in the same aisle, but not before and after. It is also not covered by A-10, so it is unclear whether FR-19 shows the import or the planning copy.
- **Type:** weakened
- **Severity:** low
- **Fix:** Add to FR-35 the number of pick groups in the same aisle before and after, per aisle and in total. State whether FR-19 shows the planning copy.

### 9. The colleague's everyday benefit was dropped

- **Source:** Who This Serves: "Find parts faster through better placement and clear labels, and carry out the printed move list."
- **PRD:** The colleague JTBD in §2.1 covers only carrying out the move list. FR-45 (labels) does not link to colleagues.
- **Type:** dropped
- **Severity:** low
- **Fix:** Add a colleague JTBD for finding parts: better placement in the core, labels in stage 2. Point the description of FR-45 to it.

### 10. The Vision's purpose for re-runs was trimmed

- **Source:** Vision: "re-run on fresh transaction data to catch parts that have sped up or slowed down."
- **PRD:** §7.4 says "re-runs on fresh data as an everyday tool". The reason for re-running (catching parts that change class) is gone, and §6 "No comparing plans" gives no hint how it would be done later. §1 is titled Vision but describes v1.
- **Type:** dropped
- **Severity:** low
- **Fix:** Restore the clause in §7.4. Note that comparing classes across imports is the step that §6's "no comparing plans" defers to the vision, so architecture does not rule it out.

### 11. SM-2 was tightened to "someone other than the author", and stage 2 now waits on it

- **Source:** Success Criteria, Measurable: "The full core flow runs without errors on the demo data in `data/sample/`, following the README." Scope: "Stage 2 (after the core flow is finished and tested)".
- **PRD:** SM-2 ("Someone other than the author follows the README"), and §7.2 ("Stage 2 (after the core passes SM-1 and SM-2)"). The change is in neither the memlog nor §10.
- **Type:** unrecorded change
- **Severity:** low. In a solo project, the gate into stage 2 now depends on another person being available.
- **Fix:** Record the tightening in §10. Alternatively, let the author's own run from a clean checkout open the stage 2 gate, and keep the outside run as a later check.

## Noted, not counted

- **For the brief addendum check (addendum only):** FR-36 orders the move list by the Walk Path of the *from-location*, while the brief's addendum says "of the part's current location". This is not in §10. SM-1 also leaves out the addendum's automated tests for FR-2 (a plan built from an existing plan's files) and FR-11 (deleting one plan leaves the others unchanged).
- **Inherited from the brief, not a PRD change:** SM-3–SM-5 are judged against "which parts actually move", but the course version runs only on synthetic data. Neither the brief nor the PRD says what data the author judges them on.
