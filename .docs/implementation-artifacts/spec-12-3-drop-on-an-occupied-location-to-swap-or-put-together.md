---
title: 'Story 12.3: Drop on an occupied location to swap or put together'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '8bc402293c8dc75f4467198fafdb185124b19d9f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-12-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 12.2 lets the planner drag a bin onto an empty location, but a drop on an occupied location only shows the ⇄ "Swap or put together" hint and does nothing. FR-51 / UX-DR50 ask for a dialog there that lets the planner choose Swap, Put together or Cancel, and which parts move on each side.

**Approach:** Extend the drag slice `frontend/modules/locations/drag/`. A drop whose server preview says `target: "occupied"` (and `allowed`) opens an "occupied" drop dialog, a popover anchored to the dropped-on cell. It lists the parts to move from the from-location (only when it holds several, dragged part checked) and the parts to move back from the target (only when it holds several, all checked; the list comes from the preview's `target_parts`). It shows a kept-in-place warning and the buttons **Swap**, **Put together** and **Cancel**. Swap sends the server's `swap` command (Story 12.1) and Put together sends `put_together`, each through the existing command flow, followed by a toast.

## Boundaries & Constraints

**Always:**
- The dialog opens only after a drop whose preview (the same versioned `fetchQuery` the drop already awaits) is `allowed` with `target: "occupied"`. Nothing is sent until Swap or Put together is pressed. `Esc`, Cancel or a press outside closes it with nothing sent, and focus returns to the dropped-on cell (same as the 12.2 dialog).
- Title: `"<to> is occupied"` (e.g. "G-14-01-03 is occupied"). Group "Parts to move from <from>" only when the from-location has ≥2 parts (rows as in 12.2: glyph, number, description, "<Class> · <stock>"; the dragged part checked). Group "Parts to move back to <from>" only when `target_parts` has ≥2 entries, all checked. These rows come from `TargetPart`, whose `movement_class` may be `null`: then show no glyph and use the stock alone as the stats line. With one part on a side, that part is the side's choice and gets no checkbox.
- Buttons, in this order: **Swap** (secondary), **Put together** (secondary), **Cancel** (tertiary). Neither Swap nor Put together is the default. When the dialog opens, focus goes to the first checkbox if there is one, else to the popover content (`tabIndex={-1}`), never to a button.
- Disabled reasons go through `Button`'s `disabledReason` (aria-disabled plus `aria-describedby`), checked in this order. While a command is unconfirmed, both buttons show `SAVING_REASON`. With no part to move checked, both show "Choose at least one part to move." With from-parts checked but no back-part checked, only Swap shows "Choose at least one part to move back."; Put together stays enabled.
- Kept-in-place warning: when any part a Swap would move is `kept_in_place`, show the `warning` icon (TriangleAlert, decorative) and an ink sentence above the buttons. Those parts are the checked from-parts (or the single from-part) and the checked back-parts (or the single back-part). One part reads "4410297 is kept in place. Swap anyway?"; several read "4410297 and 4410300 are kept in place. Swap anyway?" (Oxford-free "A, B and C"). Swap stays enabled. The kept mark is left unchanged; the server already keeps it (FR-32).
- Swap sends `{type:"swap", from, to, parts, back_parts}`. Put together sends `{type:"put_together", from, to, parts}`. Both use checked parts in list order (from-location order and `target_parts` order), through `usePlanCommands(planId).sendWithEvents`. As in 12.2, the dialog closes on every outcome except `busy`.
- Toasts after a confirmed command. Swap: "Swapped <from> ↔ <to> · N manual moves, round R.", where N = the `swap_made` event's `move_numbers.length` and R its `round`. Put together: `dragMoveToast(events, {from, to})` (one move uses the manual move wording, several use "Moved N parts…"). Both get the Undo action of the **last** move event (`lastMoveEvent` + `moveUndoAction`).
- Every checkbox and button works by keyboard. New strings go in `lib/copy`. Tests carry FR/UX-DR IDs (`fr51_`, `fr32_`, `fr33_`, `uxdr50_`, `uxdr10_`, `nfr10_`). The e2e spec imports `test`/`expect` from `e2e/support/test.ts` and runs in chromium, firefox and msedge (epic-10 retro item 92).

**Never:**
- No backend change, no new endpoint, no `schema.ts` change. The client never works out occupancy or what a move does; the back-part list comes from the preview's `target_parts`.
- No change to the empty-target path (12.2's send at once / "Move to" dialog), Manual move…, undo, or the move list (swap marks are Story 12.4).
- No drag outside One aisle. No keyboard drag.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| occupied, one part each side | F holds A; T holds C | dialog "T is occupied", no checkbox groups, Swap / Put together / Cancel | — |
| Swap | as above, press Swap | `swap {parts:[A], back_parts:[C]}`; toast "Swapped F ↔ T · 2 manual moves, round R." with Undo; A at T, C at F | rejection/409 → the command flow's existing message |
| Put together | as above, press Put together | `put_together {parts:[A]}`; toast "Moved A: F → T (Manual, round R)."; T holds A and C, "M" marker | — |
| several on both sides | F holds A,B (A dragged); T holds C,D | from group: A checked, B unchecked; back group: C, D checked | — |
| no part to move | from group all unchecked | Swap and Put together aria-disabled "Choose at least one part to move." | press does nothing |
| no back-part | back group all unchecked | Swap aria-disabled "Choose at least one part to move back."; Put together enabled | — |
| kept part in the swap | C kept in place | warning "C is kept in place. Swap anyway?"; Swap enabled; after Swap C is still kept | — |
| kept part unchecked | D kept, D unchecked in the back group | no warning for D | — |
| cancel | `Esc` / Cancel / outside press | nothing sent; focus on the dropped-on cell | — |
| saving | a command unconfirmed | both buttons aria-disabled with the saving reason | — |
| refused occupied preview | preview `allowed: false` | no hint, no dialog (unchanged from 12.2) | — |

</intent-contract>

## Code Map

- `frontend/modules/locations/drag/drag.ts` -- `dropAction(preview, fromPartCount)` (line ~55) today returns `"none"` for occupied. Add an `"occupied"` result for `allowed` + `target:"occupied"`, whatever the part count. Add `swapToast(events, drop)` (or extend `dragMoveToast`) that reads the `swap_made` event (`CommandEvent` with `type:"swap_made"`, fields `move_numbers`, `round`, `from_location`, `to_location`). `lastMoveEvent` already skips `swap_made` (it filters by `moveEventStep`).
- `frontend/modules/locations/drag/drag-context.tsx` -- `onDragEnd` (line ~150) awaits the preview and branches on `dropAction`. Add the `"occupied"` branch: open the occupied dialog with `{from, to, dragged, parts: entry.parts, targetParts: answer.target_parts, anchor}`. `send` (line ~140) is `move_parts`-only today: generalise it to take the command plus a toast builder. `canDrag` already blocks a drag while any dialog is open (`dialog === null`), so it must cover the new dialog too (one `dialog` state with a `kind`, or a second state included in `canDrag`).
- `frontend/modules/locations/drag/drop-dialog.tsx` -- the 12.2 dialog: `DropDialogBody` (pure, renderable without a DOM), `DropDialog` (Radix `Popover` + `Anchor virtualRef`, `onCloseAutoFocus` → anchor). Move the popover shell into a shared component (e.g. `DropPopover`) and the checkbox rows into a shared `PartCheckboxes` (legend + rows). Both dialogs use them (DRY). Keep `dropMoveReason` and `checkedInOrder` working.
- New `frontend/modules/locations/drag/occupied-dialog.tsx` -- `OccupiedDialogBody` (pure props: titleId, from, to, parts, targetParts, checked, checkedBack, toggles, savingReason, onSwap, onPutTogether, onCancel) and `OccupiedDialog` (state + the popover shell, initial focus as in Boundaries). Pure helpers there (or in `drag.ts`): `putTogetherReason(checked, saving)`, `swapReason(checked, checkedBack, saving)`, `keptInSwap(...)` → part numbers.
- `frontend/lib/api/plans.ts` -- `MovePreview.target_parts: TargetPart[]` (`components["schemas"]["TargetPart"]`: part, description, movement_class `| null`, picks `| null`, stock, kept_in_place). Export a `TargetPart` alias here if needed. `WallPart.kept_in_place` covers the from side.
- `frontend/components/common/button.tsx` -- `variant: "secondary"`, `disabledReason`. `components/common/icons.tsx` -- `Icon name="warning"` (see `components/common/input.tsx:57` for the icon + sentence pattern; here the sentence is ink, not error colour). `components/common/class-glyph.tsx` -- `ClassGlyph`.
- `frontend/lib/copy/index.ts` (~line 1006, the drag block) -- add `CHOOSE_PART_TO_MOVE_BACK = "Choose at least one part to move back."`, `occupiedDialogTitle(to)`, `partsToMoveBackTo(from)`, `keptSwapWarning(parts)`, `swappedToast(from, to, moves, round)`, `SWAP = "Swap"`, `PUT_TOGETHER = "Put together"`. Fix the `SWAP_OR_PUT_TOGETHER` doc comment ("Story 12.3 adds…"). The stats line for a null class: `dropPartStats` takes `MovementClass` and needs a variant for `null`.
- `frontend/lib/commands/undo.ts` -- `moveUndoAction(event, send, notify)`. `components/common/toast.tsx` -- `showToast`.
- `frontend/tests/drag.test.tsx` -- `fr51_drop_action_for_each_matrix_row` asserts `dropAction(occupied) === "none"`. Update it to `"occupied"` (also with several from-parts). Pattern for static markup: `DropDialogBody` tests further down.
- `frontend/e2e/drag.spec.ts` -- lines ~183-191 ("A drop on an occupied location changes nothing in this story"): change to "opens the dialog; `Esc` closes it, nothing sent". Reuse its helpers (`wallOf`, `targetFor`, `startDrag`, `dragOver`, `onePartLocations`, `cellOf`). `postCommand(... {type:"set_keep", part})` sets a keep mark (see `e2e/locations-wall.spec.ts:343`). `postCommand(... {type:"put_together", ...})` builds two-part locations (the sample data has none).
- Retro items: epic-10 item 92 (run each UI story's e2e in Firefox and msedge before done) applies. Item 89's remaining parts and item 72 (swap membership, Story 12.4) are not touched.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/copy/index.ts` -- the new strings and the null-class stats helper.
- `frontend/modules/locations/drag/drag.ts` -- the `"occupied"` drop action and the swap toast.
- `frontend/modules/locations/drag/drop-dialog.tsx` -- extract the shared popover shell and checkbox rows. The 12.2 dialog's behaviour stays the same.
- `frontend/modules/locations/drag/occupied-dialog.tsx` -- the occupied dialog per Boundaries.
- `frontend/modules/locations/drag/drag-context.tsx` -- open the occupied dialog; send `swap`/`put_together` with toasts and Undo; block drags while it is open.
- `frontend/tests/drag.test.tsx` -- `fr51_`/`uxdr50_`/`uxdr10_`/`fr32_` tests: drop action for occupied, swap toast text and count, reasons for every matrix row (saving first), kept warning text for one/several/unchecked parts, `OccupiedDialogBody` static markup (title, groups shown only when several, back group all checked, button order Swap/Put together/Cancel with no primary, the reasons via `aria-describedby`, the warning sentence), null-class row.
- `frontend/e2e/drag.spec.ts` -- update the 12.2 occupied step. Add `uj1 drops a bin on an occupied location to swap or put it together` at 1440×900 on fresh sample plans, covering: the dialog title and no groups for one-part sides; `Esc` closes with nothing sent and focus on the cell; the kept warning for a target part set kept by API; Swap by keyboard (toast text, parts swapped by API, the kept mark still set, version +1); Put together (toast, both parts at the target, "M" marker on the wall); with two parts on both sides (set up by API), the groups, all back-parts checked, the two disabled reasons, and a Swap with one chosen part and one back-part moves only those. Run in chromium, firefox and msedge.

**Acceptance Criteria:**
- Given a drag dropped on an occupied location, when the dialog opens, then it is titled "<to> is occupied" and shows the from group only when the from-location holds several parts (dragged checked) and the back group only when the target holds several (all checked), then Swap and Put together (both secondary, neither focused) and Cancel. Nothing changes until one is chosen; `Esc`/Cancel closes it with nothing changed and focus on the wall cell.
- Given no part to move checked, or Swap with no back-part checked, then the button is aria-disabled with "Choose at least one part to move." / "Choose at least one part to move back.".
- Given a kept-in-place part in the swap, then the triangle and "<part> is kept in place. Swap anyway?" sit above the buttons, Swap stays enabled, and after the swap the part is still kept.
- Given Put together confirmed, then each chosen part has its own Manual move into the location and the wall shows the bins with "M" markers.
- Given Swap confirmed, then the chosen parts sit at the target and the chosen back-parts at the from-location, and the toast reads "Swapped <from> ↔ <to> · N manual moves, round R." with Undo.
- Given the existing suites, then `locations-wall.spec.ts`, `best-locations-wall.spec.ts` and the rest of `drag.spec.ts` pass, and the 12.2 empty-target behaviour is unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 24 findings — high 0, medium 0, low 17, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` (verification-gap) Put together from a several-part from-location was never sent from the dialog, so sending unchecked parts would go unnoticed. The e2e now drags host1 onto host2 again after the 2+2 swap, leaves only the dragged part checked, presses Put together and asserts by API that only that part moved (version +1).
  - `[low]` `[reject]` (verification-gap) the provider's `disabledReason` reaching the occupied dialog is not tested end to end. Holding a command unconfirmed needs request interception. The 12.2 dialog has the same wiring, rejected on the same grounds in its review. The body and pure reason tests pin the rule.
  - `[low]` `[patch]` (intent) multi-part Put together is not exercised at this story's surface. Same patch as the verification-gap row above. The same-part stock merge is the server's rule and is pinned by 12.1's `test_fr51_fr33_put_together_adds_stock_of_the_same_part`.
  - `[low]` `[reject]` (intent) epic-10 item 89 (move `wallOf` and the wall fixtures to `e2e/support`) was not acted on. The move touches `locations-wall.spec.ts`, `best-locations-wall.spec.ts` and `drag.spec.ts`, far beyond this story's change. Item 89 stays an open retro action item with its own owner. The harm is developer-only duplication, which no user meets.
  - `[false]` `[reject]` (intent) there is no evidence of firefox/msedge runs. `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge` ran in this build and passed (see Auto Run Result).
  - `[false]` `[reject]` (blind) Put together moves a kept part without a warning. FR-51 and UX-DR50 word the kept warning for a swap only ("Swap anyway?"), and 12.1 accepts a kept part in every drag command (FR-32).
  - `[low]` `[patch]` (blind) the kept warning was not linked to Swap for screen readers. The warning now has an id, Swap's `aria-describedby` includes it, and Vitest asserts this.
  - `[false]` `[reject]` (blind) an allowed occupied preview with empty `target_parts` would leave Swap disabled. The server sets `target = "occupied"` only when `not is_empty` (some stock > 0), and `target_parts` lists exactly the parts with stock > 0 (`views/move_preview.py`), so the list is never empty.
  - `[low]` `[reject]` (blind) the dialog keeps a stale preview after the plan version changes. This needs a change from another tab or an Undo during the open dialog. The server validates the command (AD-3) and a rejection shows through the command flow. The same case was rejected for 12.2's dialog.
  - `[false]` `[reject]` (blind) the swap toast's Undo leaves a half swap behind a misleading toast. FR-35 and the epic specify undoing a swap one move at a time, latest first ("two undos for a two-part swap"). The Undo wording comes from `undo_preview` ("Undo move n: …").
  - `[low]` `[patch]` (blind) the `swapToast` fixture put `swap_made` last, while the server returns it first. The fixture is reordered to match `drag.py` `swap()`.
  - `[low]` `[patch]` (blind) no test rendered one from-part with several target parts. A markup case now asserts that only the back group shows, all checked.
  - `[low]` `[reject]` (blind) "Cancel" is a literal, not in `lib/copy`. It is not a new string: the 12.2 dialog and other components already use the literal, and `lib/copy` has no `CANCEL`. Introducing one is a repo-wide change.
  - `[low]` `[patch]` (blind) `drop-dialog.tsx` re-exported `checkedInOrder` only for the test. The re-export is deleted and the test imports from `drop-popover`.
  - `[low]` `[reject]` (blind) the e2e depends on fixed setup (7 one-part locations in view, 3 "M" markers). The sample data is fixed synthetic data, and a failure would point at the setup. This was rejected on the same grounds in 12.2.
  - `[false]` `[reject]` (blind) firefox/msedge runs are not evidenced. Same refutation as the intent row: they ran and passed.
  - `[low]` `[reject]` (blind) `PartCheckboxes` changed the 12.2 glyph wrapper markup. The fixed 9px slot keeps rows aligned when a target part has no class. This is cosmetic, and the 12.2 e2e and Vitest pass unchanged.
  - `[false]` `[reject]` (edge) a confirmed swap without `swap_made` shows no toast. `drag.py` `swap()` always returns `[made, *events]`, so a confirmed swap always carries `swap_made`.
  - `[low]` `[reject]` (edge) a second drag while the first drop awaits its preview can race. This is the same race recorded and rejected in 12.2: it needs a drop inside the preview latency, and the second send meets the command flow's `busy`.
  - `[low]` `[reject]` (edge) a dialog replaced with the same `from>to` key keeps stale checked state. This is reachable only through the race above, because `canDrag` blocks every drag while a dialog is open.
  - `[low]` `[reject]` (edge) the dialog is not closed on a version change. Duplicate of the blind stale-preview row; same reason.
  - `[false]` `[reject]` (edge) an occupied preview with empty `target_parts`. Same refutation as the blind row: occupied implies at least one part with stock.
  - `[low]` `[patch]` (edge) the warning "… Swap anyway?" showed while no swap was possible (no part or no back-part chosen). The kept list is now computed only when both sides have a choice, with Vitest cases.
  - `[low]` `[reject]` (edge) a missing anchor cell after the preview await does nothing silently. This needs an aisle switch inside the preview round-trip. Nothing is sent, so nothing changes. It was rejected the same way in 12.2.

## Design Notes

- The back group lists the preview's `target_parts`, not `WallLocation.parts` of the target cell. Both say the same thing, but the preview is what the server checked for this drop (AD-3).
- The occupied dialog does not share a body with the "Move to" dialog. It shares only the popover shell and the checkbox rows: the two have different titles, buttons and rules, so one body with flags would be harder to read than two small ones.
- Put together's toast reuses 12.2's wording: one part gives "Moved A: F → T (Manual, round R).", several give "Moved N parts: …". The UX spec words only the swap toast.

## Verification

**Commands:**
- `npm run lint` and `npm run typecheck` -- expected: clean.
- `npm run test:web` -- expected: all pass, incl. `tests/drag.test.tsx` and `tests/module-boundaries.test.ts`.
- `npm test` -- expected: backend and web green (backend unchanged).
- `npm run e2e -- --project=chromium` -- expected: all specs pass.
- `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge` -- expected: pass.

## Auto Run Result

**Summary:** A drop on an occupied location on the One aisle wall now opens a dialog titled "<to> is occupied" instead of doing nothing (FR-51, UX-DR50).
- **Parts to move:** the dialog lists "Parts to move from <from>" only when the from-location holds several parts, with the dragged part checked.
- **Parts to move back:** it lists "Parts to move back to <from>" only when the target holds several parts, all checked. That list comes from the server preview's `target_parts`.
- **Buttons:** **Swap** and **Put together** (both secondary, neither the default) and **Cancel**.
- **Disabled reasons (UX-DR10):**
  - While a command is still unconfirmed, both buttons show the saving reason.
  - With no part to move checked, both show "Choose at least one part to move."
  - With no part to move back checked, Swap alone shows "Choose at least one part to move back."
- **Kept-in-place warning (FR-32):** when a part in the swap is kept in place, a warning triangle and "<part> is kept in place. Swap anyway?" show above the buttons. Swap stays enabled, and screen readers reach the warning through Swap's `aria-describedby`.
- **What gets sent:** Swap sends `swap` and Put together sends `put_together`, both through the command flow.
- **Toasts:** a swap shows "Swapped F ↔ T · N manual moves, round R." Put together reuses the drop toast. Both offer Undo of the last move.
- **Cancelling:** `Esc` or Cancel closes the dialog with nothing sent, and focus returns to the cell.

**Files changed:**
- `frontend/lib/copy/index.ts`: the occupied-dialog strings, the swap toast and the kept warning; `dropPartStats` accepts a null class.
- `frontend/modules/locations/drag/drag.ts`: the `"occupied"` drop action and `swapToast`.
- `frontend/modules/locations/drag/drop-popover.tsx` (new): the popover shell, focus handling and checkbox rows that both drop dialogs share.
- `frontend/modules/locations/drag/drop-dialog.tsx`: the 12.2 "Move to" dialog now uses the shared shell. Its behaviour is unchanged.
- `frontend/modules/locations/drag/occupied-dialog.tsx` (new): the occupied dialog and its pure rules.
- `frontend/modules/locations/drag/drag-context.tsx`: opens the occupied dialog, sends `swap`/`put_together` with toasts, and blocks drags while any dialog is open.
- `frontend/tests/drag.test.tsx`: Vitest tests named `fr51_`, `fr32_`, `fr33_`, `uxdr50_` and `uxdr10_` for the rules, toasts, reasons, warning and markup.
- `frontend/e2e/drag.spec.ts`: the 12.2 occupied step is updated, and a new UJ-1 test `uj1 drops a bin on an occupied location to swap or put it together` is added.

**Review:** 24 findings: 0 high, 0 medium, 17 low, 7 false.
- **Patched (6 entries, all low):**
  - an e2e Put together from a two-part location that moves only the checked part
  - the kept warning linked to Swap via `aria-describedby`
  - the warning shown only when a swap is possible
  - the `swapToast` fixture put in the server's event order
  - a markup test for a dialog with the back group only
  - the `checkedInOrder` re-export removed
- **Deferred:** none.
- **Rejected:** every rejected row and its reason are in the triage log:
  - saving-reason wiring not tested end to end
  - epic-10 item 89 helpers left as they are
  - a stale dialog after a version change
  - the "Cancel" literal
  - fragile e2e setup
  - the glyph-slot markup change
  - the drop race and the replaced-dialog key
  - a missing anchor cell
  - 7 false findings: firefox/msedge evidence ×2, Put together kept warning, empty `target_parts` ×2, swap Undo wording, missing `swap_made`

**Follow-up review:** not recommended (`false`). This pass patched 0 high, 0 medium and 6 low.

**Verification (after the patches):**
- `npm run lint` and `npm run typecheck`: clean.
- `npm test`: backend 996 passed and 2 skipped; web 39 files, 712 tests passed.
- `npm run e2e -- --project=chromium`: 129 passed.
  - The first run, before the patches, had one failure in `delete-plan.spec.ts:63`, the known flake from epic-4 item 37 and epic-11 item 98. It passed when rerun alone.
- `npm run e2e -- e2e/drag.spec.ts --project=firefox --project=msedge`: 8 passed.

**Residual risks:**
- A dialog opened from a preview stays open if the plan changes elsewhere. The server rejects a stale command.
- The saving-reason wiring into either drop dialog has no end-to-end test.
- The rest of epic-10 item 89 (shared wall helpers in `e2e/support`) is still open. `drag.spec.ts` keeps its local helpers.
