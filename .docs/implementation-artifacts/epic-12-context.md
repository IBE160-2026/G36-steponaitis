# Epic 12 Context: Drag parts to move or swap them on the wall

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The planner can drag a part on the Locations wall (One aisle) onto an empty location to move it, or onto an occupied one to swap it or put it together with what is there, choosing which parts move when a location holds several. Every drop is one server command that expands into ordinary Manual moves, so undo, combined moves (FR-34), outdated recommendations and the move list treat drag moves like any other move, and a swap can never be saved as half its moves. The epic ends with the milestone 2 gate: the whole core proven by answer-key tests (SM-1) and the README demo flow (SM-2) before any stage 2 work starts.

## Stories

- Story 12.1: Drag commands expand into manual moves on the server
- Story 12.2: Drag a bin on the wall and drop it on an empty location
- Story 12.3: Drop on an occupied location to swap or put together
- Story 12.4: Swaps through undo, outdated recommendations and the move list
- Story 12.5: Milestone 2 gate

## Requirements & Constraints

- **Drag (FR-51):** mouse-only, planning copy only. Several parts at the from-location → planner chooses ≥1. Drop on empty → one Manual move per chosen part. Drop on occupied → always asks Swap / Put together / Cancel; nothing changes until chosen. Put together = Manual moves into the location. Swap = chosen parts go there, chosen back-parts (≥1, all pre-checked when several) go to the from-location. Virtual locations are not targets; dropping on its own location does nothing. A swap involving a kept-in-place part warns but is allowed and keeps the mark.
- **Each step obeys manual-move rules (FR-33):** rule Manual, current round (0 before first run), all of the part's stock at the from-location moves (never split), stock added together if the to-location already holds the part.
- **Combined moves (FR-34) apply per step:** a re-move from the earlier to-location (that held none of the part before) merges into one Manual move; a move back to the first from-location removes the move. Merges happen silently with the existing merge toast.
- **Undo (FR-35):** a swap is undone one move at a time, latest first (back-part's move first). After any undo every unapplied recommendation of the latest run becomes outdated (FR-29).
- **Outdated recommendations (FR-29):** drag steps outdate open recommendations (`moved`/`filled`) through the same revalidation as manual moves.
- **Move list (FR-38):** swap lines follow each other where the round/out-before-in/Walk Path order allows, marked "Manual · Swap 1/2" with "A ↔ B", plus the swap footnote — only while every move of that swap is intact (exists and is its own effective move). After undo or an FR-34 combine, the remainder prints as ordinary Manual lines. Swap membership survives reopen (FR-9).
- **Accessibility (NFR-10):** drag is the only mouse-only exception; every move a drag makes must remain possible via keyboard **Manual move…** (a swap = two manual moves). Drop dialog checkboxes/buttons are keyboard-operable.
- **Answer-key case:** a swap dragged from a location with two parts where only one is chosen moves only that part out and the chosen back-part in; the other part stays; both lines are marked on the move list; undoing one move leaves one unmarked Manual line.
- **M2 gate:** SM-1 — all answer-key and fixture tests green (FR-2, FR-3–6, FR-9, FR-12, FR-14, FR-16–17, FR-19, FR-21, FR-23–27, FR-29–35, FR-36, FR-37, FR-38, FR-51); a script maps every core FR (FR-1–FR-40, FR-42, FR-50, FR-51) and NFR to test names carrying its ID and fails if a core FR has none (SM-7). SM-2 — from a clean checkout, following only the README, the flow New Plan → classes → pick groups → best marks → recommendations → planning copy → before/after → move list runs on `data/sample/`, Playwright in chromium, firefox and msedge each with a move-list print check. README also covers tests, demo account `demo`/`demo`, `.env.example` with no real values, synthetic data only on the public deployment. Timing (NFR-8): import < 10 s, run < 5 s, command + plan views < 1 s; max-size import keeps plan views < 4 MB. No scaling work beyond ~10 users. A run of the README by someone else is noted as still to do.

## Technical Decisions

- **Drag commands expand on the server (AD-16):** a drop sends exactly one command — `move_parts {from, to, parts[]}`, `put_together {from, to, parts[]}` or `swap {from, to, parts[], back_parts[]}` — added to the closed command union in `domain/commands.py`. Handlers live in the drag slice (`domain/drag.py`), dispatched by `domain.apply`, using only kernel facts from `domain/planning.py` (`replay`, `stock_at`, `current_location`, `is_empty`). Expansion order: each chosen part from → to (listed order), then each back-part to → from; next move numbers; swap steps share one `swap_id = uuid5(command_id, "swap:1")`. One transaction, one version bump.
- **Rejections (`command_rejected`, nothing changes):** no part chosen; swap without back-part; part on both sides; part not stored at its stated location; from/to virtual or not in Locations file; from == to; `move_parts` onto occupied; `put_together` onto empty. A kept-in-place part is accepted.
- **Step log (AD-5):** steps are append-only with `swap_id`; planning copy and effective moves always derived by `replay`; undo deletes the last step only.
- **Commands (AD-6):** idempotent by `command_id` (retry returns stored result, adds no steps); serialized, optimistic version. Events: `swap_made` with move numbers plus `move_made` / `moves_combined` / `move_removed` per step as `replay` reports.
- **Server-authoritative (AD-3):** frontend computes no move effects or occupancy. The move preview `GET /api/plans/{id}/moves/preview?part=&from=&to=` additionally returns `target: empty | occupied | none` and, for occupied, the parts there (number, description, class, picks, stock, kept in place); it writes nothing. Request at most once per target per plan version.
- **Client commands (AD-12):** one command at a time; plan-changing controls `aria-disabled` "Saving the last change…" while unconfirmed; the dragged bin may show meanwhile.
- **Wire types (AD-13):** regenerate `frontend/lib/api/schema.ts` from `swp openapi`; CI fails on diff.
- **Move list (AD-17):** `domain/move_list.py` alone builds order and swap marks.
- **Recommendations (AD-7):** revalidate order `moved`, `filled`, `marks`, `partner_aisle`.
- **Frontend slice:** `modules/locations/drag` using @dnd-kit.
- **Tests:** names carry FR/NFR IDs (`test_fr51_*`); domain tests in `backend/tests/domain`, app test `tests/app/test_fr51_swap_move_list.py`, e2e `frontend/e2e/drag.spec.ts`, timing `tests/app/test_nfr8_timing.py`.

## UX & Interaction Patterns

- **Where:** Locations wall, **One aisle** only. No drag in Whole warehouse, Best locations step (click = mark), or recommendation crops. Drag stays inside the open aisle; aisle tabs/cards are not targets.
- **Start:** press on an occupied bin + >4px movement; otherwise a click (select, pin tooltip). Lifted bin follows pointer; vacated slot shows dashed outline. Split label → the half under the pointer; three+ parts → the part with most picks.
- **Targets:** empty → plus glyph + "Move here"; occupied → ⇄ + "Swap or put together"; virtual, hatched and own slot → no target, not-allowed cursor. `Esc` or drop outside the wall cancels.
- **Drop on empty, one part:** no dialog; `move_parts` sent; bin settles with "M" marker; toast "Moved 4410281: G-14-04-02 → G-14-01-04 (Manual, round 1)."
- **Drop dialog (popover anchored to target):** empty with several parts → "Move to <code>", checkboxes (glyph, number, description, class · stock), dragged part checked, **Move** (primary) / **Cancel**. Occupied → "<code> is occupied", "Parts to move from <from>" (only when several), "Parts to move back to <from>" (Swap only, only when several, all checked), **Swap** and **Put together** (both secondary, neither default), **Cancel**. Disabled reasons: "Choose at least one part to move." / "Choose at least one part to move back." (aria-disabled, reason via `aria-describedby`). Keep-in-place warning: triangle + ink sentence "4410297 is kept in place. Swap anyway?" — Swap stays enabled. `Esc`/Cancel closes with nothing changed, focus returns to the wall.
- **After swap:** toast "Swapped G-14-04-02 ↔ G-14-01-03 · 2 manual moves, round 1."; undo uses `undo_preview` wording ("Undo move 8: …"), two undos for a two-part swap.
- **Print:** swap footnote "Swap: set one bin aside, move the other into its place, then put the first one in."; print stays black and white.

## Cross-Story Dependencies

- 12.1 (commands, preview extension, regenerated schema) is the base for 12.2–12.4.
- 12.2 builds the drag mechanics and empty-target path; 12.3 adds the occupied-target dialog on top of it.
- 12.4 relies on existing undo (`undo_preview`), recommendation revalidation and the move-list view from earlier epics (4, 5, 7, 8) and on the wall from Epic 10.
- 12.5 depends on all M2 epics being done; public deployment checks are deferred to Story 16.2.
