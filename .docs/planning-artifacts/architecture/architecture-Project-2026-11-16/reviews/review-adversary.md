---
review: adversary
target: ARCHITECTURE-SPINE.md (draft, 2026-11-16)
lens: "Two units one level down that each obey every AD to the letter yet still build incompatibly"
date: 2026-11-16
inputs:
  - ../ARCHITECTURE-SPINE.md
  - ../../../prds/prd-Project-2026-11-01/prd.md
  - ../../../ux-designs/ux-Project-2026-11-11/EXPERIENCE.md
  - ../../../../../data/answer-key/README.md (+ expected.json steps)
---

# Adversarial review: Architecture Spine

## Verdict

The spine settles the big shape well: pure domain, one plan document, a step log that is folded, one command endpoint, generated types. The holes are one level down. They are **who owns a derived fact** (applied status, current round, run-time state, the undo target), **what a reference points to** (recommendation numbers, mark removal, the undo target under last-write-wins), and **how the plan document changes over time** (milestone 1 → milestone 2 JSON). Every hole below is a pair of stories that both obey AD-1…AD-18 as written and still don't fit together. Most fixes are a few lines of AD text and no new machinery. Two of them (H1, H5) would ship visible bugs on the answer-key scenario's own patterns (FR-34 move-back, a combination with a move in between).

Severity: **High** = wrong plan state or wrong printout reaches the user. **Medium** = rework or a confusing UI between stories. **Low** = an edge case or hygiene.

| # | Hole | Severity | ADs touched |
| --- | --- | --- | --- |
| H1 | "Applied" has two owners; an FR-34 move-back leaves "Applied · move N" with no move | High | AD-5, AD-7 |
| H2 | Recommendation identity and numbering are unowned; a stale "apply #3" applies another round's #3 | High | AD-4, AD-6, AD-7 |
| H3 | The run has no anchor in the step log: FR-31's "empty when the run was made" and FR-29's "part has been moved" are left to each story | High | AD-4, AD-5, AD-7 |
| H4 | `revalidate` can mean "would a run still say this" or "does it still fit its rule" | High | AD-7 |
| H5 | Undo pops the last *step*, but the UI names the last *move*; with FR-34 they differ | High | AD-5, AD-6 |
| H6 | The command result shape, and the idempotency record behind it, are unspecified | Medium | AD-6, AD-3 |
| H7 | Views are many GETs at possibly different versions; static and dynamic wall data are not split | Medium | AD-3, AD-15 |
| H8 | PlanState evolution from milestone 1 to milestone 2 has no owner; `analysis` and import JSON have no version | High | AD-4, AD-6 |
| H9 | "SQLite serializes writes" is not a lock; the command_id check can race | Medium | AD-6, AD-9 |
| H10 | Command and view models have two possible homes (domain vs `api/schemas`) | Medium | AD-1, AD-13, layer table |
| H11 | Best-location and keep marks have no identity, and no-op commands are undefined | Medium | AD-6, AD-7 |
| H12 | Apply all: snapshot vs incremental semantics | Medium | AD-6, AD-7 |
| H13 | Shared derived facts (current location, empty, best, normalized import) can be re-implemented per module | Medium | AD-1, AD-4, AD-8 |
| H14 | `planner` rows from milestone 1 vs milestone 2 accounts; username canonical form; FK or text | Medium | AD-10, ER diagram |
| H15 | Flag pairs can drift; a 401 in the save queue drops the edit; the route guard has no allowed home | Medium | AD-2, AD-10, AD-12 |
| H16 | Who seeds and migrates, and when (lifespan on Vercel cold starts) | Medium | AD-10, Environments |
| H17 | Decimal on the wire: no canonical string; AD-14's string sort applied to numeric columns | Medium | Conventions, AD-14 |
| H18 | Time zones: upload date, generated-at, timestamps inside backend copy, period ownership | Low–Medium | Conventions, AD-8, AD-11, AD-17 |
| H19 | CSRF and unsafe-method guard; AD-11's closed list has no 403 | Medium | AD-10, AD-11 |
| H20 | Import lifecycle race (FR-12 delete vs FR-2 reuse) and SQLite FKs off by default | Low–Medium | AD-4, AD-9 |
| H21 | Smaller pairs: swap "intact", `current_round` redundancy, initial state, NULL ordering, platform 413 | Low | AD-4, AD-5, AD-17, AD-18 |

---

## H1 — "Applied" has two owners (High)

**Unit A: "Manual moves and FR-34" story.** Implements AD-5 to the letter. A manual move back to the first from-location appends a step, and `replay` removes the effective move (FR-34). Per AD-7 ("An FR-34 removal by moving a part back is a move, not an undo, so only `revalidate` applies to it"), it does not touch any recommendation.

**Unit B: "Recommendations view" story.** Implements AD-7 to the letter. A recommendation with stored status `applied` shows "Applied · move N, round R" (EXPERIENCE.md, Recommendation row). AD-7: "An `applied` recommendation stays applied while its step exists."

**Clash.** Apply rec #1 (part X, L1 → L2, move 8). Then manually move X from L2 back to L1 (move 9). FR-34 removes the move. The move list, the before/after table and the wall show nothing for X. Recommendations still show "Applied · move 8, round 1", pointing at a move that exists nowhere. Apply all won't redo it, `revalidate` ignores `applied`, and the planner can't tell the plan dropped it. The applied state is stored in two places: `recommendation.status = applied` and `step.recommendation_id`. Undo (AD-5 deletes the step) and Reset (deletes both) must keep them in step by hand, and FR-34 removal breaks the link silently.

The same split shows up in a second way. Answer-key step 16 undoes 0100's **round 1** step while run 2 is the latest run. AD-7 makes that run-1 recommendation `outdated`, but it belongs to no tab (the tabs show the latest run). The next run "replaces all recommendations … that were not applied" (FR-23), so it then disappears. Nothing says whether it should be shown in the meantime.

**AD gap.** "Applied" should be a derived fact with one source: the step log. AD-7 stores it instead.

**Proposed AD (replace AD-7's status bullets):**

> - A recommendation **stores** only `open` or `outdated` (with a cause). **`applied` is derived** by the domain from the step log, never stored. A recommendation is applied when a step references it.
> - The recommendation view gives each applied recommendation `move_number`, `applied_to` and `rule` **from its effective move** (after FR-34). When FR-34 has removed that effective move (moved back), the view shows the recommendation as outdated with the derived cause `moved_back`: "4410281 was moved back to G-14-04-02; the move was removed." This is shown, not stored. Undoing the move-back step brings the applied state back without any write.
> - Undo of a step that references a recommendation sets that recommendation to `outdated(undo)` (stored), because it then has no step.
> - A run deletes every recommendation and "no space" entry of earlier runs that has no step referencing it, the outdated ones included. Runs keep their metadata (round, created at/by) even with no recommendations left (FR-9).
> - Only the latest run's recommendations appear in the Open, Kept in place, Outdated and No space tabs. The Applied tab lists every applied recommendation of the latest run.

---

## H2 — Recommendation identity and numbering are unowned (High)

**Unit A: "Run" story (domain).** AD-1 says IDs come in as arguments. The story receives one `run_id` in `ctx` and identifies recommendations by their index in the run: 1, 2, 3 …

**Unit B: "Wall markers" story (milestone 2).** Numbers the markers on one aisle's wall 1…k in the order they appear on that wall. AD-3 forbids computing rules, but numbering isn't listed. EXPERIENCE.md requires the numbers to be "across the whole round, not per rule, so a number on the wall is never ambiguous".

**Unit C: "Apply" command story.** `apply {recommendation: 3}`.

**Clash.**
1. The wall's #2 is the list's #7.
2. Under last-write-wins (AD-6), user A has round 2 open and clicks Apply on #3. User B runs round 3 first. A's `apply 3` applies **round 3's #3**, a different part. `base_version` is not enforced, so nothing catches it.
3. The answer-key harness addresses recommendations by part ("apply 1100"). A domain story may make that the command shape (see H10).

**AD gap.** AD-4 lists "recommendations with status" but gives them no identity, no stable display number and no rule for stale references.

**Proposed AD (add to AD-4 / AD-7):**

> - Each recommendation has `id = "<run_id>:<n>"` and `number = n`. `n` is 1-based and fixed at run time in the AD-14 order (rule 1, then rule 2, then rule 3, each in its processing order). It never changes when other recommendations are applied or outdated. "No space" entries are keyed by `(run_id, part)` and are not numbered.
> - Commands reference recommendations by `id` only, never by number or part. A command naming a recommendation that is not in the latest run is rejected with `command_rejected`: "This recommendation is from round 2. Round 3 has replaced it."
> - Every view that shows a recommendation (list, wall marker, lifted bin, "Moves touching aisle", crops) shows `number` from the server and never numbers anything itself.

---

## H3 — The run has no anchor in the step log (High)

**Unit A: "Apply with another location" story (FR-31, milestone 2).** Needs the locations that were "empty when the run was made". AD-4 gives a run only "round, created at/by, recommendations with status, no space". The story adds `empty_at_run: [codes]` to new runs, which is legal under AD-4's open `state` document. Runs made in milestone 1 don't have it.

**Unit B: "Other location ▾ listbox" story (frontend + view).** Builds the option list as "empty now ∩ fits the rule". Nothing in the spine mentions the run-time condition.

**Unit C: "revalidate" story.** Implements "the part has been moved" (AD-7) by comparing the part's current location with `rec.from`.

**Clash.**
- The listbox offers locations that the command then rejects, or the reverse.
- Milestone 1 runs have no `empty_at_run`, so FR-31 either crashes or quietly drops the condition for them.
- "The part has been moved" gives different answers depending on how it is read. Read as "current location changed", it misses a second stock of the part being put together into `rec.from`. Read as "any step of the part since the run", it needs to know which steps are "since the run", and AD-5 gives the step log no relation to runs.

**What already holds, unstated.** Every step made after run *k* carries round *k*, and every step made before it carries a round below *k*. Applied recommendations take their run's round, only the latest run is applicable, and manual moves take the current round. Undo deletes only the last step. Any undo since run *k* outdates all of its open recommendations, so while a recommendation is open, the steps with `round < k` are exactly the steps that existed when the run was made. The run-time state can therefore be **derived** without storing anything. The spine doesn't say so, so stories will each invent their own version.

**Proposed AD (add to AD-5):**

> - **Round invariant.** Every step made after run *k* and before the next run or reset has round *k*. No step with round *k* exists before run *k*. `domain.apply` asserts this.
> - **Run baseline.** `domain.planning.run_baseline(import, steps, k) = replay(import, [s for s in steps if s.round < k])`. It is the planning copy at the moment run *k* was made, valid whenever run *k* has an open recommendation. FR-31's "empty when the run was made" is "empty in `run_baseline`". Nothing about the run-time state is stored.
> - **Moved since the run.** A recommendation's part "has been moved" (FR-29) when a step with that part and `round == k` exists that does not reference this recommendation.
> - `domain.recommendations.other_locations(state, rec_id)` is the only implementation of FR-31's allowed set. The listbox view and the `apply_other_location` command both call it.

---

## H4 — `revalidate` is underspecified (High)

**Unit A: "revalidate" story, version 1.** Reads "the rule no longer holds" (AD-7) as "a run on the current state would no longer produce this recommendation". It re-runs the rules and outdates any open recommendation that differs.

**Unit B: "revalidate" story, version 2.** Reads it as "the suggested location still fits the rule", with predicate checks like FR-31's.

**Clash.** The planner adds a single-location best mark on an empty location that sorts before the rule 1 target in code order. Under A, every rule 1 recommendation after it shifts and is outdated ("The best-location marks changed"). Under B, none is. Removing a mark and adding it back can't be reversed either way, because outdated is sticky. The toast's count ("3 recommendations are now outdated") and the wall's markers differ by implementation, and the answer key doesn't cover mark changes after a run. Also open: whether FR-26's skip conditions are re-checked ("partner already has a recommendation", "already in the aisle of another partner"), and whether a recommendation that is kept in place is still revalidated.

**Proposed AD (replace AD-7's cause bullet):**

> An open recommendation *r* of run *k* becomes `outdated` after a command when the **first** of these, in this order, is true:
> 1. `moved`: *r*'s part has been moved since the run (H3 definition).
> 2. `filled`: *r*'s suggested location is not empty in the current planning copy. The cause stores the location and the move number that filled it, for the copy "A-11-02-02 was filled by a manual move."
> 3. `marks`: a mark-dependent condition of *r*'s rule fails on the current marks. Rule 1: the suggested location is best and the from-location is not. Rule 2: the from-location is best and the suggested location is not. Rule 3: the from-location is not best, and for a slow-moving or dead-stock part the suggested location is not best.
> 4. `partner_aisle` (rule 3): the partner's current aisle is not the suggested location's aisle.
>
> Nothing else outdates a recommendation: not the order of other recommendations, not the FR-26/FR-27 skip conditions, and not whether a new run would choose the same location. Undo sets `outdated(undo)` on every open recommendation (AD-7). Recommendations whose part is kept in place are revalidated like any other. "Kept in place" is derived from the keep marks at view time and is never a status. `revalidate(state) -> state` depends only on the state (plus the run baseline from H3), so reopening the plan and replaying it give the same result.

---

## H5 — Undo pops the last *step*, but the UI names the last *move* (High)

**Unit A: "Undo/reset" domain story.** AD-5: "Undo deletes the last step."

**Unit B: "Undo last move" button story.** EXPERIENCE.md: the tooltip names the move ("Undo move 3: 9723950 A-03-04-02 → A-05-01-03"). The story takes the highest-numbered move from the move-list view, so it never calls into the step log and computes no rules (AD-3 holds).

**Clash.**
- **FR-34 with a move in between.** Step 5 moves X from L1 to L2. Step 6 moves Y. Step 7 moves X from L2 to L3 in the same round. Steps 5 and 7 combine into move 5 (L1 → L3), because "a combined move shows the number of its first step". The highest move number is 6 (Y), so the tooltip says "Undo move 6: Y …". Undo pops step 7 and splits X's move instead.
- **Move-back removal (H1).** The last step is a removal with no visible move. The tooltip names an unrelated move.
- **Last-write-wins.** User A reads "Undo move 3". User B makes move 4. A's `undo` removes B's move 4. `base_version` is not enforced, and `undo` carries no target.
- The toast "Undid move 3" has no source (see H6).

**Proposed AD (add to AD-5 / AD-6):**

> - The plan view has `undo_preview`, built by `domain.planning` from the **last step**: `{step_move_number, part, from, to, effect}`. `effect` is one of `reverts_move(n)`, `splits_combined_move(n)` (restores move *n* to its state before this step) or `restores_removed_move(n)`. Every Undo surface (button tooltip, toast, launcher action) renders `undo_preview` and nothing else.
> - The `undo` command carries `expected_move_number`, the last step's move number. If the last step has a different number, the command is rejected with `command_rejected`: "The plan changed: the last move is now move 7. Check it before you undo." This check is independent of FR-41 and is on from milestone 1.

---

## H6 — Command result shape and the idempotency record (Medium)

**Unit A: "Command endpoint" story.** Returns `{"ok": true, "version": 8}`. That obeys AD-6 ("returns the stored result"), and AD-3 says the client refetches anyway.

**Unit B: "Toasts" story.** Needs the copy EXPERIENCE.md specifies: "Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01", "Combined into one move: G-14-04-02 → A-02-01-01 (Manual).", "Swapped G-14-04-02 ↔ G-14-01-03 · 2 manual moves, round 1.", "Best-location marks changed · 3 recommendations are now outdated", "Undid move 3 …", "Plan reset. 18 moves removed". With nothing in the result, it diffs the views before and after the refetch. That breaks the intent of AD-3 (the client computing what became outdated), and a concurrent edit by another user corrupts the diff.

**Also unspecified.**
- How many `command_id`s `state` keeps.
- Whether Reset clears them. If it does, a retried command after a reset applies twice.
- Whether the duplicate check happens before or after the lock. If before, two in-flight retries both apply.

**Proposed AD (add to AD-6):**

> - `domain.apply(state, command, ctx) -> (state, CommandResult)`. `CommandResult` is one Pydantic union per command type with common fields `{command_id, type, version}` and typed facts:
>   - `moves_created`: `[{move_number, part, from, to, rule, round, swap_id}]`
>   - `combined`: `[{move_number, from, to}]`
>   - `removed`: `[move_number]`
>   - `undone`: an `undo_preview`
>   - `run`: `{run_id, round, recommendations, no_space}`
>   - `newly_outdated`: count and cause
>   - `apply_all`: `{applied, skipped}`
>
>   The toasts render only `CommandResult` fields.
> - The service keeps the last 100 `{command_id, result}` pairs in `state.recent_commands`. Reset never clears them. The duplicate check runs **inside** the locked transaction, after the plan row is read for update (see H9). A duplicate returns the stored `result` with the **current** `version`.

---

## H7 — Views: many GETs, mixed versions, static vs dynamic (Medium)

**Unit A: "Wall" story.** `GET /api/plans/{id}/wall` returns geometry (AD-15) plus occupancy, classes and markers, all in one payload computed per request.

**Unit B: "Recommendations" story.** `GET /api/plans/{id}/recommendations`.

AD-3 makes the client refetch every `['plan', planId]` query after each command. The queries return independently.

**Clash.**
- If another user commits between the two GETs, the wall is at version 8 and the list at version 7. The wall then shows marker #9 with no row, and selecting it from the wall finds no row.
- Wall geometry depends only on the import, which never changes (FR-36). It is still recomputed and resent after every command (2,000 cells), so NFR-8's 1 s budget is spent on unchanged data.
- One story may add an in-process cache keyed by plan id. On Vercel serverless that cache is stale across instances.

**Proposed AD (add to AD-3):**

> - Every plan view response carries the plan `version` it was computed from. The client renders a set of plan queries only when their versions agree, and refetches the stale ones otherwise (at most 2 retries, then it shows them as they are).
> - Data that depends only on the import (wall geometry from AD-15, the locations table's static columns, analysis) is served from import- and analysis-scoped endpoints with `Cache-Control: private, max-age=31536000, immutable` and a `['import', importId]` query key. AD-3's refetch does not touch them. Version-scoped overlays (occupancy, parts per cell, markers, best flags) come from `['plan', planId]` queries.
> - The backend has no cross-request cache of plan state. Each request runs `replay` once and builds all the views it returns from that single fold.

---

## H8 — PlanState evolution across milestones (High)

**Unit A: milestone 1 "plan state" story.** Defines `PlanState` with `schema_version = 1` and the fields milestone 1 uses: marks, runs, steps and counters. Keep marks (FR-32) and `swap_id` (FR-51) are milestone 2 features, so the story leaves them out, as the SM-C3 "do not start early" rule suggests.

**Unit B: milestone 2 "Keep in place" story.** Adds `keep_marks: list[str]` and bumps `schema_version` to 2.

**Unit C: milestone 2 "Drag/swap" story, built in parallel.** Adds `swap_id` on steps and also bumps to 2.

**Clash.**
- Two different "version 2"s.
- Pydantic validation of milestone 1 rows fails on a required new field, so opening an old plan returns 500.
- AD-6 says "GET requests never write", so an upgrade-on-read can't be persisted on open. Some story will "fix" that by writing on GET.
- Alembic migrates columns, not the contents of the JSON. A story may write an Alembic data migration while another writes a Python upcaster, so the upgrade has two owners.
- `analysis` and the import JSON have no `schema_version` at all.
- H3's derivation and H1's derived status change what is stored, so they need this chain too.

**Proposed AD (add as AD-4a):**

> - `plans.state`, `plans.analysis` and `imports.data` each carry `schema_version`. `swp/domain/state_migrations.py` owns one append-only chain of pure upcasters per document, `v_n → v_{n+1}`. A story that changes a stored shape adds the next number, its upcaster and a fixture `backend/tests/domain/fixtures/<doc>_v<n>.json` in the same change. Alembic never rewrites JSON contents.
> - The store upcasts on every read and always writes the current version. A GET upcasts in memory and never saves (FR-9). The upgraded document is saved by the next command.
> - New fields have defaults that reproduce the old behaviour: no keep marks, no `swap_id`, `recent_commands = []`. Models use `extra="forbid"`.
> - Milestone 1's `PlanState` already declares every AD-4 field (keep marks, `swap_id`, run `created_by/at`, `recent_commands`), even when unused. Milestone 2 should then need no upcaster. The chain exists for the changes nobody has foreseen yet.

---

## H9 — "SQLite serializes writes" is not a lock (Medium)

**Unit A: "Store" story.** Uses `select(Plan).with_for_update()` as AD-6 says. On SQLite this is silently a plain SELECT, inside a default deferred transaction.

**Unit B: "Command service" story.** Checks `command_id in state.recent_commands` and then applies.

**Clash.**
- Locally, uvicorn runs sync endpoints in a thread pool, and two browser tabs (or the AD-12 retry plus the original request) are enough for both transactions to read version 7. The second to write gets `SQLITE_BUSY` (WAL snapshot conflict) and returns 500.
- With a long `busy_timeout`, the second transaction's stale read can instead be committed over the first, depending on the isolation configuration.
- If the duplicate check reads outside the transaction, the same `command_id` applies twice.

AD-9 forbids dialect-specific SQL, so `BEGIN IMMEDIATE` is formally off-limits, and the spine offers no portable alternative.

**Proposed AD (replace the lock clause in AD-6):**

> The service uses **optimistic compare-and-swap on `version`**, which works the same on both databases:
> 1. Read the plan.
> 2. Return the stored result if `command_id` is recorded.
> 3. Run `domain.apply` and then `revalidate`.
> 4. `UPDATE plans SET state=:s, version=version+1, last_edited_by=:u, last_edited_at=:t WHERE id=:id AND version=:read_version`.
>
> If no row is updated, restart from step 1, up to 3 times, then return `internal`. `with_for_update()` is not used. `swp/store` may set SQLite connection pragmas (`foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout=5000`) in a connect hook. These are configuration, not SQL in queries, and are the one allowed exception to AD-9's dialect rule.

---

## H10 — Command and view models have two homes (Medium)

**Unit A: "Domain commands" story.** Defines `swp/domain/commands.py` with `Apply(part: str)`, because the answer-key harness speaks in parts ("apply 1100"). Then `domain.apply(state, Apply(...))` as AD-6 says.

**Unit B: "API" story.** AD-13 says the Pydantic schemas in `swp/api/schemas` are the **only** definition of request and response shapes, so it defines `ApplyRequest(recommendation_id: str)` and maps it to the domain command.

**Clash.**
- The layer table lets the API import "domain models (as DTO input only)", while AD-13 says the API schemas are the only definition. Both readings are compliant.
- Two command unions drift, each with its own field names.
- The views have the same problem: the domain returns view models, and `api/schemas` defines response models next to them.

**Proposed AD (replace AD-13's first sentence):**

> - The plan command union lives in `swp/domain/commands.py`, and the plan views live in `swp/domain/views/`. FastAPI uses them **directly** as request bodies and `response_model`s, so they define the wire shape.
> - `swp/api/schemas` holds only shapes that belong to the API: auth, the saved-plans list rows, upload metadata, errors and `CommandResult` envelopes if they are not in the domain.
> - Test harnesses translate answer-key actions ("apply 1100") into real commands with test helpers. A helper looks up the recommendation by part in the run result and sends its `id`. No part-based command exists.

---

## H11 — Marks have no identity, and no-op commands are undefined (Medium)

**Unit A: milestone 1 "Locations list marking" story.** Keeps marks as a list and sends `remove_best_mark {index: 2}`.

**Unit B: milestone 2 "Wall marking" story.** Sends `remove_best_mark {kind: "level", level: "1", aisle: "A"}`.

Both fit "a closed union (e.g. … `remove_best_mark` …)".

**Clash.**
- Under last-write-wins, an index-based remove deletes whichever mark now sits at index 2.
- Marking aisle A twice gives a duplicate, and removing one copy leaves A best, which looks like a bug but matches FR-21's "if another mark still covers it".
- `set_keep` on a part that is already kept may return 409 in one story and succeed in another. A 4xx makes AD-12 drop the command and show an error for a harmless double click.
- Whether a no-op bumps `version` and `last_edited_*` is undefined. FR-9's spirit is that looking is not a change.

**Proposed AD (add to AD-4 / AD-6):**

> - A best-location mark is a value: `{kind:"aisle", aisle}`, `{kind:"level", level, aisle: str | null}` (null = all aisles) or `{kind:"location", location}`. Marks form a **set** in AD-14 order. Keep marks are a set of part numbers.
> - Mark commands carry the value, never an index.
> - Setting a mark that exists, or removing one that doesn't, is a **no-op**. A no-op returns 200 with a `CommandResult` that has no facts, records its `command_id`, and does not bump `version` or `last_edited_by/at`.

---

## H12 — Apply all: snapshot vs incremental (Medium)

**Unit A: "Apply all" story, version 1.** Takes the set of open, non-kept recommendations at the start, expands them to steps, then runs `revalidate` once (AD-6: "call `domain.apply` and then `revalidate`").

**Unit B: "Apply" story.** Rejects an invalid recommendation. "Apply all" in version 2 is a loop of single applies.

**Clash.** FR-26 allows a rule 3 recommendation for Q into partner P's aisle, followed later in the same run by P's own rule 3 recommendation out of that aisle. P is the mover in a lower-ranked pick group, and FR-26 only skips Q's group when P *already* has a recommendation. Applying them one by one in a different order outdates Q (`partner_aisle`). Version 1 applies both and marks Q `applied`, so the result depends on which story wrote Apply all. The same split appears for the "Apply all (n)" confirm count against what actually gets applied.

**Proposed AD (add to AD-7):**

> Apply all is a fold over the latest run's recommendations in `number` order:
> 1. Skip *r* unless it is open, its part is not kept in place, and it passes the H4 checks on the **current intermediate** state.
> 2. Apply it as a single `apply` would.
> 3. Revalidate.
>
> All steps are in one transaction with one version bump. `CommandResult.apply_all` lists the applied numbers and each skipped number with its cause. The view's `apply_all_count` is the number of open, non-kept recommendations at view time. The confirm popover shows it, and the toast reports the real count from the result.

---

## H13 — Shared derived facts can be re-implemented (Medium)

**Unit A: "Rules" story.** Implements *current location* (most stock, then first in code order) inside `domain/rules`.

**Unit B: "Before/after" story.** Needs current location for "a part counts once, in the aisle of its current location". It writes its own and forgets the equal-stock tie-break. 4400 in the answer key has equal stock in two locations.

**Unit C: "Import" story.** Stores inventory rows as parsed.

**Unit D: "Replay" story.** Merges duplicates (FR-6) during replay.

**Unit E: "Parts list" story.** Reads the import directly for "before" counts and shows 9300 twice. It also takes the part description from the last row, while the move list takes the first.

AD-1 keeps all of this in the domain, but not in **one place** in the domain. AD-14 covers order, not these predicates.

**Proposed AD (add as AD-5a and extend AD-8):**

> - `swp/domain/planning.py` is the only implementation of `current_location(copy, part)`, `is_empty(copy, location)` / `occupied`, `stock_at(copy, part, location)`, `aisle_of(location)`, `is_best(location, marks) -> list[Mark]` (the marks that cover it, for the tooltip's mark source) and `run_baseline` (H3). Every other domain module imports these and never re-derives them.
> - The import stores the **normalized** data that every consumer reads:
>   - `locations` keyed by code (aisle, level, walk_path, section?, position?);
>   - `inventory` merged by `(part, location)`, with zero-stock rows kept;
>   - `parts` as `{part: description}`, the first non-blank description in file order;
>   - `transactions` reduced to the fields analysis needs.
>
>   Zero-stock rows count for "part listed" (FR-13) and for nothing else. They are not "stored there" on the wall or in the locations list, and they do not make a location occupied.

---

## H14 — `planner` rows vs milestone 2 accounts (Medium)

**Unit A: milestone 1 "Autosave" story.** Writes `created_by = last_edited_by = "planner"` (AD-10).

**Unit B: milestone 2 "Create account" story.** The regex `[A-Za-z0-9]{1,32}` accepts `planner`, `Planner` and `demo`.

**Unit C: milestone 2 "Store" story.** Reads the ER diagram (`USER ||--o{ PLAN : "created_by / last_edited_by (username)"`) as a foreign key from `plans.created_by` to `users.username`.

**Unit D: "Login" story.** Writes `last_edited_by` as the user typed it at login. Uniqueness ignores case, so typing `JUSTAS` matches the account `Justas`.

**Clash.**
- The first visitor to register `planner` "owns" every milestone 1 plan in the saved-plans list.
- The milestone 2 Alembic migration that adds the FK fails on existing `planner` rows (local installs that were upgraded).
- One user shows up as `Justas` and `JUSTAS`.
- If `JWT sub` is the username, renaming is impossible later (out of scope, but it also ties tokens to the typed form).

**Proposed AD (tighten AD-10):**

> - `created_by` and `last_edited_by` are plain text with **no FK**. The ER line is descriptive only.
> - The value is `users.username` exactly as registered, never as typed at login.
> - The JWT `sub` is the user's UUID. The service loads the user on each request.
> - `planner` is a reserved name: never a row in `users`, and rejected at sign-up ignoring case with the normal "That username is taken. Try another." `demo` is reserved for the seed.

---

## H15 — Flag drift, 401 in the queue, and the route guard (Medium)

**Unit A: "Frontend auth" story.** Reads `NEXT_PUBLIC_FEATURE_AUTH`, which Next.js inlines at **build** time.

**Unit B: "Backend auth" story.** Reads `FEATURE_AUTH` at **run** time.

A redeploy of one Vercel service, or a local `.env` edited without rebuilding, splits them.
- Frontend on, backend off: the login page posts to an endpoint that doesn't exist.
- Frontend off, backend on: every call returns 401 and the UI has no way to log in.

**Unit C: "Save queue" story (AD-12).** "4xx: drop the command, show `message`, and refetch." A 401 after 30 days, or after a `JWT_SECRET` rotation, silently discards the edit the planner just made.

**Unit D: "Route guard" story.** FR-40 requires login on every page except login, sign-up and the demo front page. The cookie is httpOnly, and AD-2 bans server components and route handlers from calling the backend. The story writes Next middleware that checks whether the cookie is **present**. An expired or forged cookie then passes the guard and the page loads before the API returns 401.

**Proposed AD (add to AD-10 / AD-12):**

> - `GET /api/session` → `{user: {username} | null, auth_enabled, demo_enabled, max_upload_bytes}` is the runtime source of truth. The `NEXT_PUBLIC_*` flags only decide which routes are compiled in. At start the client compares them with `/api/session` and shows "This build and the server disagree about login. Rebuild the frontend." if they differ.
> - The route guard is client-side: it calls `/api/session` and redirects to login on `user: null` when `auth_enabled`. Next middleware may at most redirect when the cookie is missing. It never decides that a user is logged in.
> - In the save queue, `unauthenticated` (401) stops the queue, drops the pending commands, shows "Your session ended. Log in again. The last change was not saved." and opens Log in with a return path. Every other 4xx keeps AD-12's rule.

---

## H16 — Who seeds and migrates, and when (Medium)

**Unit A: "Auth" story.** "The demo account is seeded idempotently" (AD-10). The story does it in the FastAPI `lifespan`, which also covers "Migrations and the demo seed run on start" for `local`.

**Unit B: "Ops" story.** Production migrations and the seed run manually with `uv run swp db upgrade` (Environments).

**Clash.**
- On Vercel, `lifespan` runs on every cold start, so Unit A seeds production (and, if migrations share the hook, runs Alembic on every cold start).
- Two cold starts insert `demo` at once. The unique index rejects one, and since the check-then-insert can't use dialect-specific `ON CONFLICT` (AD-9), that instance fails to start.
- Is the seed exempt from `MAX_ACCOUNTS`?
- Is `POST /api/auth/demo` exempt from the 5-failure lock (AD-18)? If not, anyone can type five wrong passwords for `demo` and block Demo version for every visitor, once a minute, indefinitely.

**Proposed AD (tighten AD-10 / AD-18):**

> - `swp.app.bootstrap(upgrade=True, seed=True)` is the only migrate-and-seed path. The CLI `swp db upgrade` calls it, and `lifespan` calls it only when `APP_ENV=local`.
> - The seed looks the user up by lowercase username, inserts if absent, and treats an integrity error as success. It does not count toward `MAX_ACCOUNTS`. The demo password comes from `DEMO_PASSWORD`, default `demo`.
> - `POST /api/auth/demo` takes no password and ignores the login throttle. It returns 404 when `FEATURE_DEMO` is off.

---

## H17 — Decimal on the wire (Medium)

**Unit A: "Import" story.** Converts `.xlsx` numeric cells with `Decimal(str(cell))`. `5.0` becomes `"5.0"`, a CSV `5` becomes `"5"`, and merging gives `"10.0"`.

**Unit B: "Store" story.** Calls `state.model_dump()` before passing it to the SQLAlchemy `JSON` column. `json.dumps` raises on `Decimal`, so the story adds `json_serializer=…default=float`, and the DB now holds floats. Another path uses `model_dump(mode="json")` and holds strings. Both round-trip through Pydantic until a float like `0.1+0.2` appears.

**Unit C: "Parts/locations table" story.** Follows AD-14: "A sort the user picks in a table compares strings with `<` and `>`". FR-13's "sorted by picks" happens to be integers, but a Walk Path or stock sort over decimal strings orders `"100" < "20"`.

**Also.** Level ordering ("highest level on top", AD-14 owns it) uses code-point text order, so level `"10"` sorts below `"9"`.

**Proposed AD (tighten the IDs and values convention and AD-14):**

> - Quantities and Walk Path use one type, `swp.domain.values.Dec = Annotated[Decimal, PlainSerializer(dec_str, return_type=str)]`. `dec_str` writes the normalized value in plain notation with no exponent and no trailing zeros (`"5"`, `"2.5"`). `.xlsx` floats enter through `Decimal(repr(f))`.
> - The store writes JSON only through `model_dump(mode="json")`. No custom JSON encoder exists.
> - AD-14's string rule applies to **text** columns. Integer columns compare as numbers. Decimal columns compare by a server-supplied integer `sort_rank` per row, and the client never parses decimals.
> - In `ordering.py`, identifier columns that are all digits (Level, Section, Position) sort numerically within an import. Otherwise they sort by code point.

---

## H18 — Time zones (Low–Medium)

**Unit A: "Import" story.** Sets `upload_date = datetime.now(UTC).date()`, a plain `YYYY-MM-DD` as the convention says.

**Unit B: "Saved-plans list" and "Move list header" stories.** Show it as is. An Oslo upload at 00:30 shows yesterday's date.

**Unit C: "Move list" domain story.** Builds the header as final copy (AD-11's spirit), including "Generated 2026-11-11 10:05" in **server** time (AD-17), which is UTC. The frontend story instead formats `generated_at` in local time. Which one renders the header?

**Unit D: "Import" story, dates.** AD-8 allows a time after `T`. With text like `2026-09-30T23:30:00+02:00`, one implementer converts to UTC first, giving `2026-09-30T21:30Z`, which is harmless here. Another implementer, given `…T01:00+02:00`, converts and lands on the previous day.

**Unit E: "Overview" story.** Shows period start and end by recomputing them from `data_as_of` and the settings. The classify story computes its own (12 months back from 29 February is the edge case). They can disagree.

**Proposed AD (tighten the Dates and times convention):**

> - The API sends every instant as ISO 8601 UTC with `Z`, including `uploaded_at`, run `created_at` and the move list's `generated_at`. Only the frontend formats them, in the viewer's zone. The upload date shown is the local date of `uploaded_at`.
> - Backend `message` strings never contain a date or time.
> - In import dates, any time and offset after the date is discarded **without conversion**.
> - `period_start` and `period_end` are computed once in `analysis` and stored there. Classification and every view read them from it.

---

## H19 — CSRF and the unsafe-method guard (Medium)

**Unit A: "New Plan upload" story.** `POST /api/plans` takes `multipart/form-data`. A cross-site HTML form can send that without a CORS preflight.

**Unit B: milestone 1 local install.** Auth is off, so there is no cookie to protect. Any page the examiner visits can auto-submit a form to `http://localhost:3000/api/plans` and create plans, up to `MAX_PLANS`.

**Unit C: milestone 2 "Auth" story.** `SameSite=Lax` stops cross-site cookie sending on POST. `POST /api/auth/login` and `/api/auth/demo` remain login-CSRF targets that need no cookie. A "Log out" built as a `GET` link is CSRF-able.

**Unit D: any story that adds a 403.** AD-11's code list is closed and has none, so the story either reuses `unauthenticated` (wrong) or edits the closed list.

**Proposed AD (add to AD-10 and AD-11):**

> - Middleware in `swp/api` rejects every POST, PUT, PATCH and DELETE unless `Sec-Fetch-Site` is `same-origin` or `none`, or `Origin` matches the request host (`X-Forwarded-Host` behind Vercel). The rejection is the new code `forbidden` (403).
> - JSON endpoints accept only `application/json`, and the upload is the only multipart endpoint.
> - Log out is `POST /api/auth/logout`.

---

## H20 — Import lifecycle race (Low–Medium)

**Unit A: "Delete plan" story.** AD-4: "An import is deleted in the same transaction as the last plan that uses it". The story counts the plans using the import, finds 1, and deletes the plan and the import.

**Unit B: "New Plan from this import" story.** Concurrently reads the source plan's `import_id` and inserts a new plan with it.

**Clash.** SQLite has `foreign_keys` **off** by default, so the new plan is left pointing at a deleted import and every GET on it returns 500. On Postgres, without an FK the same thing happens; with one, the insert fails and nobody has defined the copy for it.

**Proposed AD (add to AD-4 / AD-9):**

> - `plans.import_id` is an FK with `ON DELETE RESTRICT`, and SQLite enables FKs (H9 pragma).
> - Delete runs `DELETE plan`, then `DELETE FROM imports WHERE id=:i AND NOT EXISTS (SELECT 1 FROM plans WHERE import_id=:i)`, in one transaction.
> - FR-2's create maps an FK or not-found error to `plan_not_found`: "The plan you chose was deleted. Its import is gone."

---

## H21 — Smaller pairs (Low)

- **Swap "intact" (AD-17 vs FR-34).** The swap story marks a group as intact when all its steps exist. The move-list story marks it as intact when all its steps are separate effective moves. PRD FR-38 says "as it was made", so after a combination the rest print as ordinary lines. *AD text:* "A swap group is intact when every step with that `swap_id` exists **and** is its own effective move (not combined or removed by FR-34)."
- **`current_round` stored and derivable.** AD-4 stores `current_round`. The glossary defines it as the latest run's round since the reset, so it is also `max(run.round, default 0)`. A run story that increments the counter and a reset story that deletes runs can drift apart. *AD text:* "`current_round` is derived from the runs and not stored. `next_move_number` is stored, because undo makes it underivable."
- **Initial state.** The New Plan story and the FR-2 story each build an empty `PlanState`, one with `current_round=None` and one with `0`. *AD text:* "`PlanState.new()` in the domain is the only constructor."
- **NULL ordering.** The create story leaves `last_edited_at` NULL until the first change. The list story's `ORDER BY last_edited_at DESC` puts NULLs **first** on Postgres and **last** on SQLite, which breaks AD-9 portability. Milestone 1's "open the most recently edited plan" then differs by database. *AD text:* "Creation sets `last_edited_by/at` = `created_by/at`. The columns are NOT NULL."
- **Platform 413.** Vercel's 4.5 MB limit returns a non-AD-11 body before the backend's `MAX_UPLOAD_BYTES` check can run, and AD-11's frontend parser assumes the envelope. *AD text:* "The New Plan form checks the total file size against `/api/session.max_upload_bytes` before uploading. The error parser maps any non-envelope response to `internal` with the HTTP status in `details`."
- **The no-space and keep display after a mark.** A part kept in place after a run still has its run's "no space" entry. Nothing says whether that entry stays in the No space tab. Follow H4's rule: keep is derived, so show it under Kept in place and not under No space.
- **Recommendation copy owner.** The reason sentences (FR-28, the UX detail panel) and the outdated-cause sentences are UI copy, but AD-11 only makes *error* messages backend copy. A list story that renders reasons from structured fields and a wall hover-note story that renders its own will word them differently. *AD text:* "Recommendations and outdated causes carry **structured** reason and cause data only. All sentences are built in one frontend module, `frontend/lib/copy/recommendations.ts`, from EXPERIENCE.md wording."

---

## What holds up under attack

- **AD-5 (step log + `replay`)** is what makes H1, H3 and H5 fixable without new storage. Once applied status, the run baseline and the undo target are derived from it, each has exactly one owner.
- **AD-8** is specific enough that two parser stories can't read a cell differently. The remaining gap is the normalized output shape (H13).
- **AD-16** pins the swap expansion order and the both-sides rejection. The open question is only how intact groups are defined after FR-34 (H21).
- **AD-14 and AD-15** remove the most likely frontend–backend split (ordering and geometry). H17 narrows AD-14's string rule to text columns.

## Suggested order of fixes

1. H1, H3 and H4 together. They all change AD-7, and H3's round invariant is what H4's `moved` cause relies on.
2. H2, H5, H6 and H11, the command-reference set: IDs, undo target, result shape and mark values.
3. H8 before the first milestone 1 commit to `PlanState`. If milestone 1 declares every AD-4 field, H8 costs almost nothing.
4. H9, H10 and H13 for the backend skeleton story.
5. H14–H19 before milestone 2 (auth, demo, deploy).
6. H20 and H21 when convenient.
