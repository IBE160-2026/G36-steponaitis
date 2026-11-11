# Answer-key test dataset

A small hand-made dataset with the expected result for every part (PRD §7.3). The rule modules (classification, pick groups, recommendations, rounds, move-list order) are tested against it directly, without the user interface (NFR-1, SM-1).

| File | What it is |
| --- | --- |
| `Locations.csv`, `Inventory.csv`, `transactions.csv` | The three import files (UTF-8 CSV, comma). Made by `build_inputs.py` from hand-written tables. |
| `expected.json` | The expected results, worked out by hand. Tests read this file. |
| `build_inputs.py` | Rebuilds the CSV files: `uv run python data/answer-key/build_inputs.py` |

The expected results were worked out by hand from the PRD rules, then cross-checked against a throwaway simulator that is not part of the repo. If a test disagrees with `expected.json`, check the PRD before you change either one.

## The warehouse

- 39 locations in aisles A–D, with codes `<aisle>-01-<level>-<position>`. Aisle A has 3 levels × 3 positions, B has 4 × 3, and C and D have 3 × 3 each. Walk Path starts at 0 and goes up by 10 per location in file order: A 0–80, B 90–200, C 210–290, D 300–380.
- **Best-location mark: aisle A** (the whole aisle). Nothing else is best.
- 28 locations are occupied and 11 are empty. `A-01-01-03` is empty even though it has an inventory row, because that row has stock 0.
- Newest transaction date is **2026-09-30**, so the period runs from 2025-10-01 to 2026-09-30.
- Part numbers are text, and some are chosen so that text order and number order disagree: `0100` (leading zero), `1008614-00` (suffix), `10240` before `2400`, and `30400` before `3050`.

## Parts

| Part | Picks | Class | Location(s), import | Role |
| --- | --- | --- | --- | --- |
| 0100 | 1 | slow | A-01-01-01 | class boundary 1; only pick is on the period's first day; rule 2; undo; combined move |
| 0500 | 5 | slow | A-01-03-01 | class boundary 5; one pick on the newest date, one on 2025-09-30 (not counted); kept in place |
| 0600 | 6 | medium | A-01-02-02 | class boundary 6; rule 3 mover sitting in a best location (blocked) |
| 1008614-00 | 26 | fast | A-01-01-03 (stock 0) | part with no stock anywhere: no current location, skipped by every rule |
| 10240 | 24 | fast | B-01-01-03 | class boundary 24; tie in picks with 2400 (text order puts 10240 first) |
| 1100 | 30 | fast | C-01-01-01 | rule 1 in round 1; its emptied location takes a manual move in the same round |
| 1200 | 25 | fast | A-01-02-01 (2), B-01-01-02 (8) | two locations, one of them best; current location is B (more stock), so rule 1 applies |
| 2300 | 23 | medium | C-01-01-03 | class boundary 23; in two pick groups |
| 2400 | 24 | fast | C-01-01-02 | tie with 10240; 25 lines but one is outside the period; "no space" under rule 1, so rule 3 skips it |
| 30400 / 3050 | 10 / 10 | medium | D-01-01-03 / B-01-02-03 | exactly 5 shared jobs; rule 3 tie in picks: the later part in text order (3050) moves |
| 4400 | 0 | dead | B-01-01-01 (5), A-01-03-02 (5) | equal stock in two locations: current is A-01-03-02 (first in location-code order), so rule 2 applies |
| 5000 | 40 | fast | A-01-02-03 | already in a best location |
| 6100 / 6200 | 12 / 7 | medium | B-01-03-01 / D-01-02-01 | exactly 4 shared jobs, so not a pick group |
| 6600 / 7000 | 5 / 15 | slow / medium | C-01-02-03 / A-01-03-03 | slow part whose partner is in an aisle marked best: "no space" under rule 3 |
| 8100, 8200, 8300 | 16, 22, 18 | medium | B, C, D | rule 3 loop limit: 8100 is in groups with 8200 (10 jobs) and 8300 (6 jobs) |
| 8400, 8500, 8600 | 7, 15, 20 | medium | C, B, D | partner-leaving limit: 8500 moves to 8600, so 8400–8500 waits a round |
| 9000 | 0 | dead | A-01-01-02 | class boundary 0; has Receipt, Return to Stock and an out-of-period pick, none of which count; rule 2 |
| 9100 / 9200 | 9 / 11 | medium | D-01-02-02 / D-01-02-03 | pick group already in one aisle; manual swap (a cycle on the move list) |
| 9300 | 0 | dead | B-01-03-02 (2 + 3) | duplicate inventory rows, merged to 5; manual move into a location emptied in the same round |
| 9999 | — | — | not in Inventory | in the Transactions file only: never classified, and its 6 shared jobs with 6100 form no pick group |

## Pick groups

In run order: most shared jobs first, ties broken by the lower part number, both in text order.

| Shared jobs | Pick group | Mover (fewer picks) | Run 1 | Runs 2 and 3 |
| --- | --- | --- | --- | --- |
| 10 | 8100–8200 | 8100 | 8100 → C-01-03-01 | same aisle |
| 9 | 8500–8600 | 8500 | 8500 → D-01-03-01 | same aisle |
| 8 | 2400–5000 | 2400 | skipped: 2400 is "no space" (rule 1) | skipped: 2400 has a rule 1 recommendation |
| 7 | 1008614-00–2300 | 2300 | blocked: 1008614-00 has no current location | same |
| 6 | 8100–8300 | 8100 | skipped: 8100 already has a recommendation | blocked: 8100 is in 8200's aisle, and they share 10 ≥ 6 jobs (loop limit) |
| 6 | 8400–8500 | 8400 | blocked: partner 8500 has a recommendation | 8400 → D-01-03-03 |
| 6 | 9100–9200 | — | same aisle | same aisle |
| 5 | 0600–2300 | 0600 | blocked: 0600 is in a best location | same |
| 5 | 30400–3050 | 3050 (tie, later in text order) | 3050 → D-01-03-02 | same aisle |
| 5 | 6600–7000 | 6600 | "no space" (rule 3): 6600 is slow and aisle A is all best | same |

The 6100–6200 pair has 4 real jobs and three traps, each of which would make it 5 if counted: 6100 appears twice on one job, both parts appear on Issue Part lines with transaction code 0, and both appear on a job dated 2025-09-30.

## The scenario

`expected.json` → `steps` lists every action and its expected result. In short:

1. **Run 1 (round 1).** Aisle A has one empty best location (`A-01-01-03`, which only has the zero-stock row). Rule 1 gives it to 1100, which has the most picks. 1200, 10240 and 2400 get "no space". Rule 2 moves 4400, 9000, 0100 and 0500 out of A, to the first empty locations in B. Rule 3 gives 8100, 8500 and 3050.
2. **Planner, round 1.** Applies 1100. Makes manual moves: 9300 into 1100's emptied location, then 9100 and 9200 swap places. Marks 0500 "keep in place". Applies the rule 3 recommendations, then 4400 and 9000, and 0100 last.
3. **Run 2 (round 2).** Rule 1 fills the best locations that rule 2 freed: 1200 → A-01-01-01, 10240 → A-01-01-02, 2400 → A-01-03-02. Rule 3 now moves 8400 to its partner. 0500 is left alone.
4. **Undo after a later run** (the PRD addendum's sequence). Apply 1200, undo it, then undo 0100's round 1 move. Every run 2 recommendation is now outdated. 0100 is moved by hand to C-01-03-02 and then on to B-01-03-02 in round 2. The two moves combine into one Manual move, A-01-01-01 → B-01-03-02.
5. **Run 3 (round 3)** gives the same four recommendations as run 2, and Apply all applies them.

## Move list (14 lines, 3 rounds)

| Round | Part | From | To | Rule |
| --- | --- | --- | --- | --- |
| 1 | 9000 | A-01-01-02 | B-01-04-01 | 2 |
| 1 | 4400 | A-01-03-02 | B-01-03-03 | 2 |
| 1 | 8100 | B-01-02-01 | C-01-03-01 | 3 |
| 1 | 8500 | B-01-02-02 | D-01-03-01 | 3 |
| 1 | 3050 | B-01-02-03 | D-01-03-02 | 3 |
| 1 | 1100 | C-01-01-01 | A-01-01-03 | 1 |
| 1 | 9300 | B-01-03-02 | C-01-01-01 | Manual |
| 1 | 9100 | D-01-02-02 | D-01-02-03 | Manual |
| 1 | 9200 | D-01-02-03 | D-01-02-02 | Manual |
| 2 | 0100 | A-01-01-01 | B-01-03-02 | Manual |
| 3 | 1200 | B-01-01-02 | A-01-01-01 | 1 |
| 3 | 10240 | B-01-01-03 | A-01-01-02 | 1 |
| 3 | 2400 | C-01-01-02 | A-01-03-02 | 1 |
| 3 | 8400 | C-01-02-02 | D-01-03-03 | 3 |

- 9300 (from Walk Path 160) comes after 1100 (from Walk Path 210), because it moves into the location 1100 leaves. Sorting by Walk Path alone would print it first.
- 9100 and 9200 form a cycle, so they fall back to Walk Path order.
- 0100's undone round 1 move is not on the list, and its two round 2 moves are one line.

## Before/after (best marks: aisle A)

| | Before | After |
| --- | --- | --- |
| Fast-moving parts in best locations | 1 (5000) | 5 (5000, 1100, 1200, 10240, 2400) |
| Pick groups in one aisle | 1 (D) | 6 (A 1, C 1, D 4) |
| Occupied / empty, A | 8 / 1 | 9 / 0 |
| Occupied / empty, B | 8 / 4 | 5 / 7 |
| Occupied / empty, C | 6 / 3 | 5 / 4 |
| Occupied / empty, D | 6 / 3 | 9 / 0 |

`expected.json` also lists the parts that move into and out of each aisle. 1008614-00 has no current location, so it is not counted anywhere. An optional extra run on the final state gives no recommendations, only 6600 "no space": the plan has settled.

## Rules the PRD now states (decided 2026-11-11)

The dataset relies on these rules. Each was a reading of the PRD at first, and the author then confirmed it and added it to the PRD:

1. **A slow part whose partner's aisle is all best** gets "no space" under rule 3 (6600). See FR-26.
2. **A part in a second pick group in the same run** (8100–8300 in run 1) is skipped silently, because it already has a recommendation: no block and no "no space". See FR-27.
3. **A part that is "no space" under rule 1** (2400) is skipped by rule 3, with no second entry. See FR-27.
4. **The period** counts a line by its date only. A line at 2025-09-30 09:00 is outside the period, and one at 2025-10-01 08:00 is inside. See the Period entry in the glossary.

## Not covered here

These are tested with their own small fixtures, not with this dataset: import rejections (FR-3–FR-6: missing columns, bad values, unknown locations, more than one warehouse), reset, reopen, delete, and applying a recommendation with another suggested location (FR-31).
