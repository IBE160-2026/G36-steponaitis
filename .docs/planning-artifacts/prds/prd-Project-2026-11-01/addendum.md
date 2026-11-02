---
title: "PRD Addendum: Smart Warehouse Planner"
created: 2026-11-02
updated: 2026-11-02
---

# PRD Addendum: Smart Warehouse Planner

This addendum holds the rationale behind PRD decisions that is too detailed for the PRD itself. The binding rules, demo-data facts and earlier decisions stay in the brief's addendum (`.docs/planning-artifacts/briefs/brief-Project-2026-09-27/addendum.md`).

## Why the move list stays in a safe order (FR-23, FR-29, FR-31, FR-33–FR-35, FR-38)

The move list is ordered by round. Inside a round, the list must never ask a colleague to put a part into a location before the line that empties that location. A move depends on another when it needs a location that the other move empties, or when it moves a part that the other move has just placed.

- **Recommendations of one run never depend on each other.** Every suggested location is already empty when the run is made, each one is suggested for at most one part, and each part gets at most one recommendation.
- **Applying with another suggested location (FR-31) keeps that true.** The other location must have been empty when the run was made, so it cannot be one that a manual move in the same round has just emptied.
- **Manual moves before the first run get round 0.** Otherwise a manual move that empties a location and a round-1 recommendation into that location would share round 1.
- **Inside a round, moves out come before moves in (user decision 2026-11-02).** A manual move may go into an occupied location, for example one that another move in the same round empties. Sorting only by Walk Path could print the manual line first, and the colleague would find the location still full. So, within a round, a line into a location follows every line out of it. Lines that form a cycle (two parts swapping locations) cannot all satisfy this and fall back to Walk Path order; in that case the colleague handles the swap.
- **Two moves of the same part in one round are combined (FR-34).** "Part X: A → B" and "Part X: B → C" in the same round become "A → C", which is also all a colleague needs. They are combined only when B held none of the part before, because otherwise the second move also carries B's original stock, and combining would drop that move from the list.
- **Undo outdates the latest run (FR-35).** The reasoning above assumes that the planning copy only moves forward after a run. Undo breaks that. Example: rule 2 moves part S out of location L in round 1; run 2 recommends part F into L; the planner applies F, undoes F, undoes S, then moves S out of L by hand (round 2). If F's recommendation were not outdated, applying it would give two round-2 moves where F needs S to go first. Outdating every unapplied recommendation of the latest run after any undo closes this gap; the next run puts F in round 3. This sequence belongs in the answer-key test dataset.

**Rejected alternative:** computing each move's round from its dependencies (round = 1 + the highest round of the moves it depends on). It is exact, but it changes what "round" means from the brief's "one run of the recommendations" and is harder to explain on a printout.

## Why rule 3 has limits (FR-26; accepted by the user 2026-11-02)

Rounds only settle if no rule undoes another rule's move in a later round. As written in the brief's addendum, rule 3 could loop:

1. **Rule 3 against rule 2.** Part P (slow-moving) is in a pick group with Q, which sits in aisle A, and the planner has set a best-location mark on aisle A. Rule 3 moves P to an empty location in aisle A, which is a best location. In the next round, rule 2 moves P out of the best locations, to the first empty non-best location in location-code order, which may be in another aisle. In the round after that, rule 3 moves P back to aisle A. **Limit:** a slow-moving or dead-stock part is never offered a best location by rule 3.
2. **Rule 3 against itself.** Part P is in pick groups with Q (aisle C, 10 shared jobs) and R (aisle D, 6 shared jobs), and P has fewer picks than both. Round 1 handles the stronger pick group first and moves P to aisle C. In round 2, P and Q share an aisle, so rule 3 handles P–R and moves P to aisle D. In round 3, P and Q are split again and P goes back to aisle C. **Limit:** rule 3 does not move a part out of the aisle of a partner it shares at least as many jobs with.
3. **Moving toward a partner that is leaving (found in review).** Take pick group P–Q (P has fewer picks; P in aisle A, Q in aisle B) and pick group Q–S (Q has fewer picks; S in aisle A, more shared jobs). Round 1 moves Q to aisle A and P to aisle B, where Q no longer is; round 2 moves P back. Colleagues move P twice for nothing. **Limit:** a pick group whose partner already has a recommendation in the same run gets none; the next round handles it once the partner has settled.

When a limit blocks a pick group, it gets no recommendation and no "no space" entry, and the partner is never moved instead. All three cases belong in the answer-key test dataset.

## Why the planner can keep a part in place (FR-32)

The app has no size or capacity data, so the planner's judgment is the only fit check. Without a way to decline, a skipped recommendation would be generated again on every run, and "Apply all" would then carry it out. A keep-in-place mark stores the planner's "no" in the plan. It survives reset because it is a judgment about the warehouse, not about one sequence of moves.

## Why these columns are required and their values checked (FR-3, FR-4)

The required columns are the ones a feature reads:

- Locations file: location code, Walk Path, aisle and level.
- Inventory file: part, description, quantity and location.
- Transactions file: type, part, location, transaction code and date.

Section, Position, Unit, Warehouse and the quantity columns of the Transactions file are not used by any rule, so a file without them is still accepted. When a Warehouse column is present, it is only checked to reject an import that holds more than one warehouse (FR-6). Values in the required columns are checked because a blank quantity, an unreadable date or a duplicate location code would change movement classes, occupancy or move-list order without any visible error.

## Why the core is built in two milestones (§7.1; user decision 2026-11-02)

The teacher's feedback (2026-10-06) asked for a small core that is finished and stable before anything else, and named its flow: import → classify → find pick groups → get recommendations → try them in the planning copy. Since then, the core has gained saved plans, rounds, undo and the move list. Milestone 1 is that five-step flow on one stored plan, with its own gate, so the project has a finished, tested core even if time runs out. The warning when two people edit the same plan needs separate users to mean anything, so it moved to stage 2 with login.

## Demo-data reference figures

These figures come from the brief's addendum and are for checking the full demo data in `data/sample/` against the rules. They are approximate; the answer-key test dataset is the exact check.

- Movement classes: about 80 fast-moving, 250 medium-moving, 580 slow-moving and 640 dead-stock parts. (The brief's addendum also says 636 parts never move; the two figures come from different counts and should be re-checked when the tests run.)
- About 130 pick groups at 5 or more shared jobs; 77 pairs of parts are used together 10 or more times.
- 1,584 occupied and 416 empty locations, of which 41 hold only parts with stock 0; occupancy per aisle from 65% to 87%.
