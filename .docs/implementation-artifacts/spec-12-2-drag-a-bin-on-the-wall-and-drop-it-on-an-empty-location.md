---
title: 'Story 12.2: Drag a bin on the wall and drop it on an empty location'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'e019e4482a00bba79e00d28a70913cf98ddbe3a2'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-12-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 12.1 gave the server `move_parts`, `put_together` and `swap`, but the planner can still only move a part by typing a location code in **Manual move…**. FR-51 / UX-DR50 ask for a mouse drag on the One aisle wall that moves a bin to an empty slot in one gesture.

**Approach:** Add @dnd-kit/core 6.3.1 (pinned in the spine's Stack table) and a drag slice `frontend/modules/locations/drag/`. The slice owns the DndContext, the lifted bin, the target hints, the per-version preview cache, the drop dialog and the `move_parts` send. The shared `WallGrid` gets an optional `drag` binding, like `marking`, and only One aisle passes it. While touching them, split `WallGrid` (its per-cell markup into a `WallCell` component) and move `AisleMode` out of `locations-page.tsx`. That is the "split WallGrid/AisleMode" part of epic-10 retro item 89. The other parts of item 89 (marking geometry, the Best locations header, fixtures, marking strings) stay open.

## Boundaries & Constraints

**Always:**
- Drag is mouse/pointer only. Use only a pointer sensor with a distance activation of 4px, never a KeyboardSensor. Do not spread dnd-kit's `attributes` onto grid cells: the grid's roles, names and tab stop stay exactly as they are. A press without that movement keeps today's click (pin the tooltip, select the cell's move).
- Only an occupied bin in the open aisle starts a drag. No drag starts while a command is unconfirmed (`disabledReason` set). The tooltip hides when a drag starts.
- Dragged part: one part → it; two parts (split label) → the half of the cell under the press (left = `parts[0]`, right = `parts[1]`); three or more → `parts[0]` (most picks; the wall view lists parts most picks first).
- Target kind comes only from the server move preview for (dragged part, from, target) (AD-3). The preview is fetched through the QueryClient keyed by plan, part, from, target **and the wall's version**, with `staleTime: Infinity`, so there is at most one request per target per plan version. Kinds: `target: "empty"` and `allowed` → plus glyph + "Move here"; `target: "occupied"` → ⇄ + "Swap or put together"; `none`, a refusal, the own slot or a gap cell → no target, `cursor: not-allowed`. While the preview is loading, no hint shows.
- Only located cells of the open aisle's grid are drop targets. Aisle tabs, the Key, the drawer, the warehouse figure and anything outside the grid are not. A drop there, or `Esc`, cancels, and nothing is sent.
- Dropping on an empty target with one part at the from-location sends `{type: "move_parts", from, to, parts: [part]}` at once, with no dialog. With several parts, the drop dialog opens. Every send goes through `usePlanCommands(planId).sendWithEvents` (AD-12). Plan-changing controls show "Saving the last change…" exactly as today.
- Toast after a confirmed command. With one move event, use `moveToast(events)` from `manual-move-dialog.tsx`, which gives "Moved 4410281: G-14-04-02 → G-14-01-04 (Manual, round 1)." and the combine/remove texts for FR-34. With several events, use "Moved N parts: <from> → <to> (Manual, round R)." Both get the Undo action of the **last** event (`moveUndoAction`). A refused or failed command shows what the command flow already shows. The wall and drawer then follow the refetched wall view (the "M" marker comes from Story 10.4's layer).
- Drop dialog (several parts at the from-location, empty target): a Radix Popover anchored to the dropped-on cell, titled "Move to <to>", with the heading "Parts to move from <from>". It has one checkbox per part of the from-location: glyph, part number, description, "<Class> · <stock>". The dragged part starts checked. Then **Move** (primary) and **Cancel** (tertiary). With nothing checked, Move is `aria-disabled` with "Choose at least one part to move." (reason via `aria-describedby`, through `Button`'s `disabledReason`). While saving, Move shows the saving reason. Move sends `move_parts` with the checked parts in from-location order. `Esc` or Cancel closes it with nothing sent, and focus returns to the dropped-on cell. Everything works by keyboard.
- New strings go in `lib/copy`. Tests name their FR/NFR/UX-DR (`fr51_…`, `uxdr50_…`, `nfr10_…`). The new e2e spec imports `test`/`expect` from `e2e/support/test.ts`.

**Never:**
- No drag in Whole warehouse, the Best locations marking wall, or recommendation crops (they never pass `drag`). No drag between aisles.
- No occupied-target behaviour beyond the hint: a drop on an occupied location changes nothing and sends nothing in this story (Story 12.3 adds its dialog). No `put_together`/`swap` sends.
- No client-side occupancy or move-effect computation beyond reading `WallLocation.parts` to choose the dragged part and list the dialog rows. No backend change, no new endpoint, no `schema.ts` change.
- Do not change Manual move…, the marking wall's behaviour, or the existing wall e2e expectations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| click, no drag | press + release, < 4px movement | tooltip pins, the cell's move is selected (as today) | — |
| one part → empty | from holds 4410281; drop on an empty slot whose preview is `empty`/allowed | one `move_parts` with `parts: [4410281]`; toast "Moved 4410281: F → T (Manual, round R)." with Undo; the bin shows at T with "M" | 409 or busy → the command flow's existing message, nothing else |
| FR-34 merge | drop returns a part to its first from-location | `move_parts` sent; toast "Removed move n: …" or "Combined into one move: …" | — |
| several parts → empty | from holds A, B (dragged B) | popover "Move to T", rows A, B, B checked; Move sends checked parts in from order | none checked → Move aria-disabled "Choose at least one part to move." |
| occupied target | preview `occupied` | hint ⇄ "Swap or put together"; drop sends nothing | — |
| no target | own slot, gap, virtual/`none`, refused preview | no hint, not-allowed cursor; drop sends nothing | — |
| cancel | `Esc` during a drag, or drop outside the grid | nothing sent, nothing changes | — |
| saving | a command unconfirmed | no drag starts; dialog Move aria-disabled "Saving the last change…" | — |
| split label | two parts, press on the right half | `parts[1]` is dragged (dialog checks it) | — |

</intent-contract>

## Code Map

- `frontend/package.json` (+ root `package-lock.json`) -- add `"@dnd-kit/core": "6.3.1"` exactly: `npm install --workspace frontend --save-exact @dnd-kit/core@6.3.1` from the repo root. If the install is denied, stop and report it; do not retry.
- `frontend/components/common/wall/wall-grid.tsx` (676 lines) -- the grid layer. Cells are rendered in the map at lines 532-627 (gap cell 543-555, located cell 557-625); click at 593-601; tooltip reducer/timers 62-102 and 244-492. Extract the located/gap cell markup into a new `components/common/wall/wall-cell.tsx` (`WallCell`), leaving the grid's behaviour identical. Add `drag?: WallDrag` to `WallGridProps` (type defined in common/wall). Per cell it gives an optional pointer binding (dnd-kit `useDraggable` listeners for occupied cells, `useDroppable` for located cells; ids = codes) and a hint state (`"move" | "swap" | "none" | undefined`) drawn on the cell: a target frame, the glyph and the text label, `data-drop-target`, and the cursor. Keep the hooks inside a drag-only child component so the marking wall never calls dnd-kit hooks. Hide the tooltip on drag start (dispatch `hide`/`escape` through a callback the binding exposes, or a `dragging` flag).
- `frontend/components/common/wall/aisle-wall.tsx` -- passes `...grid` through to `WallGrid`; `drag` flows through `AisleWallProps` unchanged. It also needs to render the vacated slot's dashed outline at the from-cell while dragging: in the grid layer, or as a `drag`-driven overlay using `cellRect`.
- `frontend/components/common/wall/index.ts` -- export `WallDrag` (and `WallCell` if used outside).
- `frontend/components/common/wall/moves-layer.tsx`, `bin.tsx` -- reuse `Bin`/`liftedRect` styling for the lifted bin drawn in `DragOverlay` (SVG `Bin` at the drawn scale, with the lift shadow used for lifted bins).
- `frontend/modules/locations/locations-page.tsx` -- `AisleMode` (lines 407-580) moves to a new `frontend/modules/locations/aisle-mode.tsx` with its helpers and `ScopeSwitch` type (export what `WallMode` needs). There it wraps `LocationsWall` in the drag provider and passes `grid.drag`. `WallMode`/`WarehouseMode`/`ListMode` are unchanged apart from imports.
- New `frontend/modules/locations/drag/` --
  - `drag-context.tsx`: `WallDragProvider({planId, wall, children})`. It holds the DndContext (PointerSensor `{activationConstraint: {distance: 4}}` only; check in `node_modules/@dnd-kit/core` that it suppresses the click after a drag and cancels on `Esc`, and add the guards if not), the dragged state (from code, part, pointer half), `onDragOver` → preview fetch → hint, `onDragEnd` → decide → send or open the dialog, `onDragCancel`, and the `DragOverlay`. It returns the `WallDrag` binding for the grid.
  - `drag.ts`: pure helpers: `draggedPart(parts, half)`, `dropHint(preview, isOwnSlot)`, `dropAction(preview, fromPartCount)` → `"send" | "dialog" | "none"`, `dragPreviewKey(planId, part, from, to, version)` (extends `planMovePreviewKey` from `lib/api/plans.ts:168`), `dragMoveToast(events)` (one event → `moveToast`, several → the N-parts text).
  - `drop-dialog.tsx`: the popover. Pattern: `components/common/other-location.tsx:147-198` (Radix `Popover` with `Anchor`), `Button` with `disabledReason` (`components/common/button.tsx:56-79`), `ClassGlyph`, `CLASS_LABELS`/`RULE_LABELS` in `lib/copy`.
- `frontend/lib/api/plans.ts` -- `fetchMovePreview` (322), `planMovePreviewKey` (168), types `WallLocation`/`WallPart` (`parts` most picks first, `stock` string, `movement_class`), `MovePreview` (`allowed`, `target`, `target_parts`, `version`). Read-only, unless a key helper belongs here.
- `frontend/lib/commands/react.tsx` -- `usePlanCommands(planId)` → `{sendWithEvents, disabledReason}`; `lib/commands/undo.ts:55` `moveUndoAction(event, send, notify)`; `components/common/toast.tsx:38` `showToast(message, {action})`; `components/common/manual-move-dialog.tsx:108` `moveToast(events)` (reuse; move it to `lib/copy` or `lib/commands` if a module may not import it; components/common imports are allowed from modules).
- `frontend/lib/copy/index.ts` -- add `MOVE_HERE = "Move here"`, `SWAP_OR_PUT_TOGETHER = "Swap or put together"`, `CHOOSE_PART_TO_MOVE = "Choose at least one part to move."`, `dropDialogTitle(to)`, `partsToMoveFrom(from)`, `movedPartsToast(n, from, to, round)`.
- `frontend/modules/best-locations/marking-wall.tsx`, `modules/locations/warehouse-view.tsx`, recommendation crop (`components/common/wall/crop.ts` users) -- must not pass `drag`; read-only.
- `frontend/e2e/locations-wall.spec.ts:1-60` -- pattern for a sample plan, `wallOf`, grid cells `[data-grid-cell="CODE"]`; `e2e/support/plan-api.ts` `postCommand`, `getJson`, `planVersion`; `e2e/support/sample-plan.ts` `createSamplePlan`. The sample data has **no** location with two parts: build one with `postCommand(... {type: "put_together", from, to, parts:[p]})` (or `manual_move` onto an occupied slot) before opening the page.
- `frontend/tests/*.test.tsx` -- Vitest has no DOM: pure helpers plus `renderToStaticMarkup` (see `tests/manual-move.test.tsx`).

## Tasks & Acceptance

**Execution:**
- `frontend/package.json`, `package-lock.json` -- install `@dnd-kit/core@6.3.1` exact -- the spine-pinned drag library.
- `frontend/modules/locations/aisle-mode.tsx`, `frontend/modules/locations/locations-page.tsx` -- move `AisleMode` out (no behaviour change), then wire `WallDragProvider` and `grid.drag` -- the item-89 split and the One-aisle-only drag.
- `frontend/components/common/wall/wall-cell.tsx`, `wall-grid.tsx`, `aisle-wall.tsx`, `index.ts` -- `WallCell` extraction, the optional `drag` binding, hint/cursor/vacated outline, tooltip hidden during a drag -- the item-89 split plus the drag surface.
- `frontend/modules/locations/drag/drag.ts`, `drag-context.tsx`, `drop-dialog.tsx` -- the drag slice per the Boundaries.
- `frontend/lib/copy/index.ts` -- the new strings.
- `frontend/tests/drag.test.tsx` -- `fr51_`/`uxdr50_` tests: `draggedPart` (1, 2 left/right, 3+), `dropHint`/`dropAction` for every matrix row, `dragPreviewKey` includes the version, `dragMoveToast` one/several/combined/removed, drop dialog static markup (title, rows, dragged part checked, Move aria-disabled with the reason when nothing is checked, saving reason), and the marking wall / warehouse markup carrying no drag attributes (`nfr10_`).
- `frontend/e2e/drag.spec.ts` -- `uj1 drags a bin …` with the Playwright mouse at 1440×900 on a fresh sample plan. Cover: a short press still pins the tooltip; the Move here hint over an empty slot and the not-allowed cursor over the own slot; `Esc` cancels (plan version unchanged); a one-part drop sends the move (toast text, the part's new current location by API, the "M" marker at the target, version +1); several parts (set up by API) open the dialog, unchecking all gives the disabled reason, Move moves only the checked part; a drop on an occupied slot shows the ⇄ hint and changes nothing; no drag starts on the Best locations wall or in Whole warehouse. Run in chromium, firefox and msedge.

**Acceptance Criteria:**
- Given the One aisle wall, when I press an occupied bin and move more than 4px, then a lifted bin follows the pointer, its slot shows the dashed vacated outline and the tooltip hides; a press without movement behaves as before.
- Given a drag, when I hover cells, then empty-allowed targets show the plus glyph and "Move here", occupied targets show ⇄ and "Swap or put together", and the own slot/gaps/`none` show nothing with the not-allowed cursor, each from at most one preview request per target per plan version.
- Given a one-part drop on an empty slot, when the server confirms, then exactly one `move_parts` was sent, the toast reads "Moved <part>: <from> → <to> (Manual, round <r>)." with Undo, and the wall shows the bin at its new slot with "M".
- Given several parts at the from-location, when I drop on an empty slot, then the "Move to <to>" popover lists every part with the dragged one checked, and Move sends only the checked parts; Cancel/`Esc` sends nothing and focus returns to the cell.
- Given Whole warehouse, Best locations or a recommendation crop, when I press and move, then no drag starts; Manual move… still works by keyboard (NFR-10).
- Given an unconfirmed command, then no drag starts and every plan-changing control shows "Saving the last change…".
- Given the existing suites, then `locations-wall.spec.ts`, `best-locations-wall.spec.ts`, `locations-warehouse.spec.ts` and the Vitest wall tests pass unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 36 findings — high 0, medium 0, low 28, false 7, maybe-false 1
- findings:
  - `[low]` `[patch]` (verification-gap) tooltip suppression during a drag is untested — e2e now shows a hover tooltip, starts a drag and asserts it closes, and waits 300 ms over another cell asserting no tooltip.
  - `[low]` `[patch]` (verification-gap) a drop before the preview arrives (`fetchQuery` wait) is untested — e2e step delays `**/moves/preview**` 1.5 s, drops without waiting for the hint, asserts the toast and version +1.
  - `[low]` `[reject]` (verification-gap) `canDrag` while saving is untested — holding a command unconfirmed needs request interception; a lift mid-save would only end in the command flow's `busy`; the rule is a one-line guard.
  - `[low]` `[reject]` (blind) a refused drop gives no feedback / `refusal_message` unshown — the spec's no-target rule is no hint + not-allowed cursor, already shown while hovering; adding a refusal surface is new UI.
  - `[low]` `[reject]` (blind) no pending state while a drop awaits its preview; a second drag can race — needs a drop inside the preview latency; the second send meets the command flow's `busy`; a guard adds state for a rare case.
  - `[low]` `[reject]` (blind) `version`/`entry.parts` captured before the await — only a refetch during the ~100 ms preview round-trip hits it, and the server validates the command (AD-3).
  - `[low]` `[reject]` (blind) the dialog previewed only the dragged part — server-authoritative: a refused part comes back as `command_rejected` through the command flow.
  - `[low]` `[reject]` (blind) the several-parts toast's Undo undoes only the last move — a recorded Design Notes decision (FR-35 one step at a time).
  - `[false]` `[reject]` (blind) the dialog outlives its anchor on an aisle switch — the popover is non-modal Radix: pressing a tab or moving focus outside dismisses it (`onOpenChange(false)`), so it cannot stay open over a remounted wall.
  - `[low]` `[patch]` (blind) `WallCellProps` had both `drop` and `drag.drop` — the top-level `drop` was removed from the exported type.
  - `[low]` `[reject]` (blind) the hint label can be clipped on the bottom row — the label sits inside the scroll box's content and extends its scroll area; cosmetic.
  - `[low]` `[reject]` (blind) the drag binding is rebuilt every render — no measured slowness; e2e drags are smooth at 223 cells; memoizing adds complexity.
  - `[low]` `[reject]` (blind) `WallDragProvider` has no unit tests — Vitest has no DOM in this repo; its stateful paths are covered by `e2e/drag.spec.ts`.
  - `[low]` `[patch]` (blind) e2e misses paths — added a drop outside the grid (on aisle tab B, nothing sent); refused/saving/multi-part-toast/Undo-press paths rejected as low with pure-function coverage in `tests/drag.test.tsx`.
  - `[low]` `[reject]` (blind) e2e hard-codes 6px — test-only, documented next to the helper.
  - `[low]` `[reject]` (blind) grep-based "no drag elsewhere" unit test is brittle — the e2e no-drag test covers Best locations and Whole warehouse behaviourally.
  - `[maybe-false]` `[reject]` (blind) `Esc` during a drag may also close other overlays — would need a drag with the part panel open; if true it is only low (both close, nothing changes).
  - `[false]` `[reject]` (blind) `package-lock.json` and the spec missing from the diff — they were left out of the review file on purpose (lockfile size; spec is the claims file) and are committed with the change.
  - `[low]` `[patch]` (blind) `locations-page.tsx` kept a re-export only for tests — re-export deleted; `tests/wall.test.tsx`/`tests/warehouse.test.tsx` import `@/modules/locations/locations-wall`.
  - `[low]` `[reject]` (edge) second drop during a pending drop — same as the race row above.
  - `[low]` `[reject]` (edge) `busy` outcome on the direct drop is not toasted — only reachable through that race; `canDrag` blocks drags while a command is pending.
  - `[low]` `[reject]` (edge) anchor cell missing when the preview resolves — needs an aisle switch inside the preview round-trip; nothing is sent, so nothing changes.
  - `[false]` `[reject]` (edge) dialog stays open after an aisle change — same refutation as the blind anchor row (outside interaction dismisses the popover).
  - `[low]` `[reject]` (edge) dialog lists stale parts after a refetch — the server rejects a stale part; rare.
  - `[low]` `[reject]` (edge) dialog closes on a rejected/failed send — the command flow shows the refusal; reopening is one drag.
  - `[false]` `[reject]` (edge) `onDragStart` finds no part and leaves an invisible drag — only cells with an entry and `parts.length > 0` get listeners (`canDrag`), and `draggedPart` always returns a part for ≥1 parts.
  - `[false]` `[reject]` (edge) zero-width cell gives scale 0 — a pressed cell is visible and sized; a hidden cell cannot be pressed.
  - `[low]` `[reject]` (edge) e2e `nearestInView` may return empty — fixed sample data and viewport; failure would point at the helper.
  - `[low]` `[reject]` (edge) e2e assumes two one-part locations in aisle A — fixed synthetic sample data (every location holds one part).
  - `[low]` `[reject]` (edge, claim) an errored preview is re-requested at the same version — only after a failed request, where a retry is the better outcome.
  - `[low]` `[reject]` (edge, claim) a `display: contents` wrapper changes the DOM under `WithPartPanel` — no layout effect; every existing wall e2e passes.
  - `[low]` `[reject]` (intent) item 89 split is partial (WallGrid still grows, AisleMode moved not decomposed) — the spec takes the named split only and records the rest of item 89 as open; no named harm.
  - `[low]` `[reject]` (intent) AD-12 "every plan-changing control aria-disabled" not tested during `move_parts` — those controls use the shared `usePlanCommands` reason already pinned by earlier stories' tests; this story adds no new control besides Move, which is tested.
  - `[low]` `[patch]` (intent) untested: drop outside the wall / aisle tabs not targets — e2e drop on aisle tab B added (same patch as the blind e2e row); virtual/hatched cells and crops rejected as low (crops never receive `drag`; gaps are not droppables).
  - `[false]` `[reject]` (intent) the toast asserts round 0 vs the AC's round 1 — the AC's numbers are example data; a fresh plan is round 0.
  - `[false]` `[reject]` (intent) the "Moved N parts" toast and Undo are beyond the AC — recorded in Design Notes; the AC does not word a several-parts toast.

## Design Notes

- One aisle passes `drag`, and nothing else does. That one prop is the whole "where drag is allowed" rule, which keeps the shared wall free of module imports (modules may import components/common, never the reverse).
- The "Moved N parts" toast is this story's own wording, because the UX spec only words the one-part drop. Undo there takes back the last part's move, as the toast's Undo does elsewhere (FR-35 is one step at a time).
- A drop before the target's preview has arrived awaits `queryClient.fetchQuery` for the same versioned key, then decides. It never guesses from `WallLocation.occupied`.

## Verification

**Commands:**
- `npm run lint` and `npm run typecheck` -- expected: clean.
- `npm run test:web` -- expected: all pass, incl. `tests/drag.test.tsx` and `tests/module-boundaries.test.ts`.
- `npm test` -- expected: backend and web green (backend unchanged).
- `npm run e2e -- --project=chromium` -- expected: all specs pass, incl. `e2e/drag.spec.ts`.
- `npx --workspace frontend playwright test e2e/drag.spec.ts --project=firefox --project=msedge` -- expected: pass (if a browser is missing, report it).

## Auto Run Result

**Summary:** On the Locations wall in One aisle you can now drag a bin with the mouse (FR-51, UX-DR50).
- **Starting a drag:** a press that moves more than 4px lifts the bin, using @dnd-kit/core 6.3.1 with a pointer sensor only. The lifted bin follows the pointer, the slot it left shows a dashed outline, and the tooltip hides. A press without that movement is still a click.
- **Target hints:** each hint comes from the server's move preview, cached by plan version.
  - An empty location shows + and "Move here".
  - An occupied one shows ⇄ and "Swap or put together".
  - The bin's own slot, gaps and targets the preview says no to show nothing, with the not-allowed cursor.
- **Dropping:** a one-part drop on an empty location sends `move_parts` at once and shows the manual move toast with Undo. A drop from a location with several parts opens the "Move to <to>" popover with checkboxes.
- **Cancelling:** `Esc`, a drop outside the grid, or a drop on an occupied location (Story 12.3) sends nothing.
- **Where drag works:** only One aisle passes the `drag` binding. Best locations, Whole warehouse and crops never get it.
- **Epic-10 item 89:** this story does its "split WallGrid/AisleMode" part. The cell markup moved to `WallCell`, `AisleMode` moved to `aisle-mode.tsx`, and the wall chrome moved to `locations-wall.tsx`. The other parts of item 89 (marking geometry, the Best locations header, fixtures, marking strings) stay open.

**Files changed:**
- `frontend/package.json`, `package-lock.json`: `@dnd-kit/core` 6.3.1, exact.
- `frontend/components/common/wall/wall-cell.tsx` (new): `WallCell`/`WallGapCell` split out of `WallGrid`; the drag-only `DraggableWallCell`; the vacated outline and the target hints.
- `frontend/components/common/wall/wall-grid.tsx`: uses `WallCell`; the optional `drag` prop; no tooltip while a drag is on.
- `frontend/components/common/wall/moves-layer.tsx`: `LiftedBin`.
- `frontend/components/common/wall/index.ts`: the new exports.
- `frontend/modules/locations/aisle-mode.tsx` (new): `AisleMode`, moved, now wrapped in `WallDragProvider`.
- `frontend/modules/locations/locations-wall.tsx` (new): `LocationsHeader` and `LocationsWall`, moved.
- `frontend/modules/locations/locations-page.tsx`: slimmed down; imports the moved parts.
- `frontend/modules/locations/drag/drag.ts`: pure rules for the dragged part, the hint, the drop action, the preview key and the toast.
- `frontend/modules/locations/drag/drag-context.tsx`: the DndContext provider: preview cache, drop decision, send and toast.
- `frontend/modules/locations/drag/drop-dialog.tsx`: the popover where you choose which parts move.
- `frontend/lib/copy/index.ts`: the drag strings.
- `frontend/tests/drag.test.tsx`: 15 tests named `fr51_`, `uxdr50_`, `nfr10_`, `fr10_` and `fr34_`.
- `frontend/tests/wall.test.tsx`, `frontend/tests/warehouse.test.tsx`: new import path.
- `frontend/e2e/drag.spec.ts`: 3 UJ-1 tests (one-part drop, choosing parts, no drag elsewhere).

**Review:** 36 findings: 0 high, 0 medium, 28 low, 7 false, 1 maybe-false.
- **Patched (6 rows, all low):**
  - an e2e check that no tooltip shows during a drag
  - an e2e drop made before the preview arrives
  - an e2e drop outside the grid, on an aisle tab
  - the duplicate `drop` field removed from `WallCellProps`
  - the leftover `LocationsWall` re-export removed
  - (one more row shares the outside-the-grid e2e patch)
- **Also fixed during verification:** `drag.spec.ts:128` failed in both full chromium runs. A focused cell keeps its tooltip after `Escape`, so the step now asserts only that the pinned dialog is gone.
- **Deferred:** none.
- **Rejected:** every rejected row and its reason are in the triage log:
  - feedback for a refused drop
  - the race between overlapping drops and the busy outcome
  - values captured before the await
  - a stale part list in the dialog
  - the dialog closing after a rejection
  - Undo of the last move on the several-parts toast (a recorded design decision)
  - label clipping
  - re-rendering the binding every render
  - no provider unit tests (Vitest has no DOM)
  - brittle tests and helpers
  - the partial item-89 split
  - AD-12 coverage through the shared reason
  - 7 false findings and 1 maybe-false

**Follow-up review:** not recommended (`false`). The patched entries were 0 high, 0 medium and 6 low.

**Verification (after the patches):**
- `npm run lint`, `npm run typecheck`, `npm run lint:py`, `npm run lint:imports`: clean, 5 contracts kept.
- `npm run test:web`: 39 files, 702 tests passed.
- `npm run test:py`: 996 passed, 2 skipped. The backend is unchanged and the patches touched only frontend files.
- `npm run e2e -- --project=chromium`: 128 passed.
- `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge`: 6 passed.

**Residual risks:**
- A second drag dropped while the first drop is still waiting for its preview meets the command flow's `busy` without a dedicated message.
- `canDrag` during an unconfirmed command is pinned by no test.
- The "no drag elsewhere" unit test is a source-text check. The e2e test covers Best locations and Whole warehouse by behaviour.
- The rest of epic-10 item 89 is still open.
