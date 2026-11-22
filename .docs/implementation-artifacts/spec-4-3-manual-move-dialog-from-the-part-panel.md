---
title: 'Story 4.3: Manual move dialog from the part panel'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'a00d2f9c5845855369810fecf42df905dc1c7f8c'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 4.2 gave the server a `manual_move` command and a read-only preview, but the planner has no way to use them: the part panel has no **Manual move…**, the client flow does not hand the command's events back (so no toast can name the move), and the locations table cannot open a part's panel (FR-15, FR-33, FR-34, UX-DR24, UX-DR26, NFR-10).

**Approach:** A shared `ManualMoveDialog` in `components/common/`, opened from the part panel, drives itself from `GET /moves/preview` and sends `manual_move` through `lib/commands`, which now returns `{outcome, events}`. While touching the command flow, close the epic 3 retro items 19 (proxy 500 without envelope retries), 21 (command built inside `try`, UUID fallback), 23 (Playwright 503-after-apply retry) and 24 (marks toast only when events exist).

## Boundaries & Constraints

**Always:**
- `lib/commands/client.ts`: new `sendWithEvents(planId, body): Promise<SendResult>` with `SendResult = {outcome: SendOutcome; events: CommandEvent[]}` (`events` is the confirmed response's events, `[]` otherwise); `send` stays and returns `(await sendWithEvents(...)).outcome`. `usePlanCommands` exposes `sendWithEvents` too. `CommandEvent = CommandResult["events"][number]` exported from `lib/api/plans.ts`.
- Retro 21: the whole `{...body, command_id, base_version}` build is inside the `try`; if it throws, the send goes the `fail` path (`"dropped"`, notice `failed`, never stuck pending). Default id = exported `newCommandId()`: `crypto.randomUUID()` when it is a function, else an RFC 4122 v4 UUID from `crypto.getRandomValues`.
- Retro 19: a 500 whose body is not the AD-11 envelope (`isErrorEnvelope(text)` false) is `"transient"` (same id, 1/2/4/8 s, "Trying again", then failed). A 500 with the envelope keeps the fail path. `isErrorEnvelope` lives in `lib/api/errors.ts` and `parseErrorBody` uses the same check.
- Retro 24: `sendMarkChange` uses `sendWithEvents` and shows "Best-location marks changed." only when confirmed **and** `events.length > 0`.
- `lib/api/plans.ts`: `MovePreview`, `MoveEffect` types; `planMovePreviewKey(planId, part, from, to)` under `planRootKey` (so commands invalidate it); `fetchMovePreview` → `GET /api/plans/{id}/moves/preview?part=&from=&to=`; `useMovePreview(planId, part, from, to)` enabled only when `to.trim() !== ""` and `from !== ""`, query on the trimmed `to`, `placeholderData: keepPreviousData`.
- `components/common/manual-move-dialog.tsx` exports `ManualMoveDialog({planId, detail: PartDetail, open, onOpenChange})` plus pure helpers (tested in Vitest):
  - `fromChoices(detail)`: current location then other locations (codes). One → shown as text "From {code}"; several → a labelled native `<select>` ("From-location"), current preselected.
  - To-location: `Input` with label "To-location", ARIA combobox (`role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) over the Locations file codes from `usePlanLocations` in server (AD-14) order. `matchLocations(codes, typed, limit = 8)`: codes whose upper-cased text starts with the upper-cased trimmed input, in given order; empty input → none. ↓/↑ move the highlight, `Enter` on a highlighted option picks it (else `Enter` confirms when allowed), `Esc` closes an open list first (then `Input` clears, then the dialog closes). Options are rows in `{typography.code}` with the highlighted row `bg-selected-tint`.
  - The preview runs on the to-value debounced 200 ms. Refused → `InputError` with the server's `refusal_message` linked via `errorId` (`aria-invalid="true"`, `aria-describedby`). Allowed → `effectLine(preview, part, to)` below the field:
    - `new` + `empty` → "to an empty location"; `new` + `occupied` → "to an occupied location: {target_parts joined ', '} stays there too" (parts plural "stay there too" when 2+);
    - `adds_to_stock` → "to an occupied location: stock is added together";
    - `combines_with(n)` → "This combines with move {n} into one move.";
    - `removes_move(n)` → "This undoes move {n}: {part} returns to {to} and the move is removed."
  - Confirm button: primary, label **Move**, or **Remove move** for `removes_move`; `disabledReason` (first that applies): command pending → "Saving the last change…"; blank to → "Enter a to-location."; preview not yet for the current value → "Checking the move…"; refused → the refusal sentence. Cancel (tertiary) first. Radix `Dialog` with title "Manual move · {part}" and the part description.
  - On confirm: `sendWithEvents({type: "manual_move", part, from, to: trimmed})`; `confirmed` → close and `showToast(moveToast(events))`; otherwise the dialog stays open (the flow already toasted/refetched).
  - `moveToast(events)` (first move event): `move_made` → "Moved {part}: {from} → {to} (Manual, round {round})."; `moves_combined` → "Combined into one move: {from} → {to} (Manual)."; `move_removed` → "Removed move {n}: {part} returns to {location}."; no move event → null (no toast).
- Part panel: a tertiary **Manual move…** button under the facts in `PartPanel` (not in `PartFacts`); `disabledReason` = `NO_CURRENT_LOCATION` when `current_location` is null, else the commands' `disabledReason`. Opening the dialog keeps the panel; closing returns focus to the button (radix).
- Locations table: optional `onOpenPart?: (part, opener) => void` on `LocationsTable`; when set, each part number in the Parts cell is a button (`data-open-part`) that opens the part panel. The Locations page passes `panel.open`; Best locations does not.
- e2e (Chromium, `frontend/e2e/manual-move.spec.ts`, sample plan via `createSamplePlan`, data picked through the API):
  - `uj1 makes a manual move from the part panel and moves it back`: keyboard only from Ctrl+/ search → part panel → Manual move… → type the from-location (error sentence, `aria-invalid`), type `ZZ-99` (not-in-Locations sentence), pick an empty location via ↓ + Enter, "to an empty location", Enter confirms → toast "Moved …(Manual, round 0).", panel's current location chip shows the target; reopen, target = first from → undo sentence, button **Remove move** → toast "Removed move 1: …".
  - `uj7 a part with no stock cannot be moved`: panel shows the no-stock sentence and **Manual move…** is `aria-disabled` with that reason.
  - `uj7 opens a part from the locations table and moves it`: open a part button in a location row, Manual move… reachable from its panel.
  - `ad12 retries a command after a proxy 500 without the error envelope` (retro 19): first command POST fulfilled `500` text/plain, "The last change was not saved yet. Trying again." visible, then the move confirms (toast).
  - `ad12 a 503 after the server applied the command retries to one version bump` (retro 23): first POST goes to the server (`route.fetch`) and is answered 503 to the page; the retry gets the stored result; plan summary version = before + 1 and one move toast.
- Tests name their FR/NFR/AD/UX-DR. UI text English.

**Never:** No backend change (the server side is Story 4.2); no new dependency; no client-side computation of the planning copy, occupancy or move effect (the preview owns it); no keep-in-place toggle (Epic 7); no change to view contents (Story 4.4); no edits to `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`. Retro item 20 (refetch by highest version seen) is not in scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One location | part with current only | "From B-01-03-02" text, no select | — |
| Several locations | current + 1 other | select, current preselected | — |
| No stock | `current_location` null | Manual move… aria-disabled, reason "No current location (no stock above zero)" | — |
| Blank to | "" | no preview request, no error shown, confirm reason "Enter a to-location." | — |
| Refused | to = from / virtual / unknown | InputError with server sentence, confirm disabled with it | — |
| Empty target | preview new/empty | "to an empty location", button Move | — |
| Holds the part | adds_to_stock | "to an occupied location: stock is added together" | — |
| Move back | removes_move(1) | undo sentence, button Remove move, toast "Removed move 1: …" | — |
| Combine | moves_combined event | toast "Combined into one move: A → C (Manual)." | — |
| Proxy 500 | 500 non-envelope | retry with same command_id, "Trying again" | after 4 retries: failed |
| Envelope 500 | 500 `{error:{code:"internal"}}` | fail path (no retry) | failed notice |
| randomUUID missing/throws | non-secure context / throwing randomId | v4 UUID fallback / `dropped`, not stuck pending | failed notice |
| No-op marks | confirmed, `events: []` | no marks toast | — |

</intent-contract>

## Code Map

- `frontend/lib/commands/client.ts` -- `CommandClient.send` (builds command before `try`, line ~103), `post` (`TRANSIENT_STATUSES`, `parseErrorBody`), `fail`, `reject`, `refetchConsistent`; `randomId` default `crypto.randomUUID()`.
- `frontend/lib/commands/react.tsx` -- `usePlanCommands` returns state + `send` + `disabledReason`.
- `frontend/lib/api/errors.ts` -- `parseErrorBody`, `internalError`; backend 500s always carry the envelope (`backend/swp/api/errors.py:_unexpected`), so a non-envelope 500 comes from the proxy.
- `frontend/lib/api/plans.ts` -- query keys under `planRootKey`, `getJson`, `usePlanSearch` (enabled + `keepPreviousData` pattern), `Command`, `CommandResult`; schema types `MovePreview`, `NewMove|AddsToStock|CombinesWith|RemovesMove`, `MoveMade|MovesCombined|MoveRemoved`, `TargetPart` already in `lib/api/schema.ts`.
- `frontend/components/common/part-panel.tsx` -- `PartPanel` (fetches `usePlanPart`), `PartFacts` (static, used by Vitest), `NO_CURRENT_LOCATION`.
- `frontend/components/common/input.tsx` -- `Input` (`errorId` → `aria-invalid` + `aria-describedby`, Esc clears) and `InputError`.
- `frontend/components/common/confirm-dialog.tsx` -- radix (`radix-ui` 1.8.1) dialog styling to copy (overlay, `shadow-overlay`, `rounded-xl`, Cancel first); use `Dialog` (not AlertDialog).
- `frontend/components/common/button.tsx` -- `disabledReason` (aria-disabled, focusable, reason via aria-describedby).
- `frontend/components/common/toast.tsx` -- `showToast`.
- `frontend/components/common/locations-table.tsx:74-106` -- `LOCATION_COLUMNS` Parts cell; `LocationsTable` props. `modules/locations/locations-page.tsx:76-95` passes `panel.open` to `SearchField`; `usePartPanel.open(part, from)`.
- `frontend/modules/best-locations/best-locations-page.tsx:77-85,105` -- `sendMarkChange`, `onSend` prop; caller passes `usePlanCommands().send`.
- `frontend/components/common/search-field.tsx` -- search → `onOpenPart`.
- Tests: `frontend/tests/commands.test.tsx` (harness `setup()`, `mockFetch`, `json`, `bodyOf`, `randomId` option), `tests/best-locations.test.tsx:259-272` (`fr21_toast_only_after_a_confirmed_change`), `tests/part-panel.test.tsx` (static markup only; Vitest has no DOM), `frontend/e2e/part-panel-search.spec.ts` (search → panel journey), `e2e/parts-roster.spec.ts:58` (no-stock row), `e2e/support/sample-plan.ts`.
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro items 19, 21, 23, 24.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/api/errors.ts` -- `isErrorEnvelope`.
- `frontend/lib/api/plans.ts` -- `CommandEvent`, preview types, key, fetch, hook.
- `frontend/lib/commands/client.ts`, `react.tsx` -- `SendResult`, `sendWithEvents`, `newCommandId`, build inside `try`, non-envelope 500 transient.
- `frontend/components/common/manual-move-dialog.tsx` (new) -- dialog and helpers per Always.
- `frontend/components/common/part-panel.tsx` -- Manual move… button + dialog in `PartPanel`.
- `frontend/components/common/locations-table.tsx`, `modules/locations/locations-page.tsx` -- `onOpenPart` part buttons.
- `frontend/modules/best-locations/best-locations-page.tsx` -- `sendMarkChange` on events.
- `frontend/tests/commands.test.tsx` -- `ad12_proxy_500_without_envelope_is_transient`, `ad12_envelope_500_is_not_retried` (keep existing), `ad12_command_id_failure_does_not_stick_pending`, `ad12_uuid_fallback_without_random_uuid`, `fr33_send_with_events_returns_events`.
- `frontend/tests/best-locations.test.tsx` -- toast only for confirmed with events (`fr21_…`).
- `frontend/tests/manual-move.test.tsx` (new) -- `fromChoices`, `matchLocations`, `effectLine` for each effect/target, `moveToast` for each event, static render of the panel's disabled Manual move… (`uxdr24_…`), refusal markup (`aria-invalid`, describedby) where static rendering allows.
- `frontend/e2e/manual-move.spec.ts` (new) -- the five journeys above.
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro items 19, 21, 23, 24 → `done`.

**Acceptance Criteria:**
- Given the part panel of a part with stock, when the planner presses Manual move…, then the dialog opens with focus in the to-location field and the from-location preselected (or a choice).
- Given a typed to-location, when the preview refuses it, then the field shows the server sentence as an input error and confirm is aria-disabled with that sentence.
- Given a confirmed move, when the command succeeds, then the toast names it, the panel and the Locations table show the new location after the refetch, and while unconfirmed every plan-changing control is aria-disabled with "Saving the last change…".
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 32 findings — high 0, medium 3, low 17, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` (blind) refused preview with null `refusal_message` leaves "Checking the move…" — `check_manual_move` (Story 4.2) returns a sentence for every refusal; `refusal_message` is null only when allowed.
  - `[false]` `[reject]` (blind) failed preview filtered by `showsLoadError` stays checking — `showsLoadError` filters only `plan_not_found`, whose shared hook navigates to New Plan; a query error drops placeholder data, so `previewError` shows.
  - `[low]` `[reject]` (blind) Enter within the 200 ms debounce does nothing — Move is aria-disabled with "Checking the move…" as its described reason; the planner presses again a moment later; flushing adds a branch.
  - `[low]` `[patch]` (blind) a cached, invalidated preview counts while it refetches and can briefly enable Move — `current` now also requires `!preview.isFetching`.
  - `[low]` `[reject]` (blind) fields stay editable while a move saves, effect text mixes old preview and new code — needs editing mid-save (well under a second normally); the server checks again.
  - `[false]` `[reject]` (blind) occupied target with empty `target_parts` gives an ungrammatical line — `target` is `occupied` exactly when the planning copy has stock > 0 at `to` (`move_preview.py:61`), and `target_parts` are those parts.
  - `[low]` `[reject]` (blind) no loading/error state for the autocomplete codes; locations view is heavy — the field still works by typing; the locations view is the AD-14-ordered Locations file already used by two steps.
  - `[false]` `[reject]` (blind) move-removed toast unspecified; combined toast hard-codes Manual — the spec's Always defines the removed toast; FR-34 combines only manual moves, and UX gives "(Manual)".
  - `[low]` `[reject]` (blind) columns array rebuilt each render — the extra-columns path already did; DataTable is not memoized on columns and focus is by `rowKey`; no harm shown.
  - `[low]` `[reject]` (blind) part buttons add tab stops, bare-number name, no keyboard test — same pattern as the Best locations Mark buttons; the button sits in its row next to the description; the e2e opens it with Enter.
  - `[low]` `[reject]` (blind) risky paths untested (combine, adds_to_stock, select, saving reason, answer-key journeys) — select and saving reason patched via the verification-gap rows; effects and toasts are pinned in Vitest and the server effects in 4.2's domain tests.
  - `[false]` `[reject]` (blind) spec missing from the diff; epic-context rewrite — the workflow withholds the spec from this layer; `epic-4-context.md` was regenerated by the workflow's compile step because the spine changed in 4.2.
  - `[low]` `[reject]` (blind) bare-500 retry not in the architecture doc; a plain-text backend 500 now waits ~15 s — every backend exception goes through the envelope handler (`api/errors.py:_unexpected`); planning artifacts are not edited by this story.
  - `[false]` `[reject]` (blind) retro item 22 still open — it is `done` (`sprint-status.yaml:314`, Story 4.2).
  - `[false]` `[reject]` (blind) a confirmed no-op mark change is silent — that is retro item 24's ask; the Mark buttons are disabled for marks already set.
  - `[low]` `[patch]` (edge) lowercase code is matched by the autocomplete but refused by the server — new `locationCode(codes, typed)` sends the exact Locations code for a case-insensitive match; Vitest + the new e2e type lowercase.
  - `[low]` `[patch]` (edge) a second Enter during a send gets "busy" and clears `sentWith` — `confirm()` returns on `busy` without touching state.
  - `[low]` `[reject]` (edge) Enter during IME composition — location codes are ASCII; not met in use.
  - `[false]` `[reject]` (edge) occupied with empty `target_parts` — same refutation as the blind row.
  - `[false]` `[reject]` (edge) preview error filtered by `showsLoadError` — same refutation as the blind row.
  - `[false]` `[reject]` (edge) refusal with null message — same refutation as the blind row.
  - `[medium]` `[patch]` (verification-gap) "Saving the last change…" on Manual move… and Move never checked — the ad12 proxy-500 e2e now holds the retry and asserts both buttons aria-disabled with that description.
  - `[medium]` `[patch]` (verification-gap) changing the From-location select is untested — new e2e "uj1 moves a part from a chosen other location" selects `other_locations[0]` and asserts toast and chip.
  - `[low]` `[reject]` (verification-gap) 409 on submit keeps the dialog on a fresh preview — narrow race (preview allowed, then refused); the stale state is harmless because the server refuses again; covering it needs a new routed e2e.
  - `[false]` `[reject]` (intent) extra behaviour (removed toast, new/combines lines, Esc order) — each is in the spec's Always; none contradicts the story.
  - `[low]` `[reject]` (intent) adds-to-stock and merge toast only unit-tested — pure `effectLine`/`moveToast` are what render them; the server effects are pinned in 4.2.
  - `[medium]` `[patch]` (intent) in-flight aria-disabled not seen in a browser — same root cause as the verification-gap saving-reason row; same patch.
  - `[false]` `[reject]` (intent) autocomplete order not shown to be AD-14 / the Locations file — the locations view lists every Locations-file code once in `ordering.location_order` (`views/locations.py:77`).
  - `[low]` `[reject]` (intent) pick-groups refetch untested — refetch of every active `['plan', id]` query is existing, unit-tested `lib/commands` behaviour (`ad12_confirm_refetches_only_plan_queries…`).
  - `[low]` `[reject]` (intent) opening a location does not itself open a part panel — the story's path is part → panel; the row's part buttons give it from the Locations table.
  - `[low]` `[reject]` (intent) retro item 20 left open — it concerns `refetchConsistent`, which this story does not change.
  - `[low]` `[reject]` (intent) `epic-4-context.md` rewrite outside the story — regenerated by the workflow because the spine changed; not part of the story code.

## Design Notes

**Why `sendWithEvents` instead of changing `send`.** The move toast needs the events; mark toasts now need them too (retro 24). Keeping `send` returning the outcome string leaves ~30 existing tests and callers intact while both new callers read events.

**Why a non-envelope 500 is transient.** The backend answers every 500 with the AD-11 envelope; only the `/api` rewrite answers a plain 500 when the backend is unreachable (retro R1). Retrying it is safe because commands are idempotent per `command_id`.

## Verification

**Commands:**
- `npm run lint` and `npm run typecheck` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass
- `npm run lint:py` and `npm run lint:imports` -- expected: pass (no backend change)
- `npm run e2e -- --project=chromium` -- expected: all pass, including `e2e/manual-move.spec.ts`

## Auto Run Result

Status: done

**Summary:** The part panel now has **Manual move…** (disabled with "No current location (no stock above zero)" for a part without stock, and with "Saving the last change…" while a command is unconfirmed). It opens the shared `ManualMoveDialog` (`components/common/`): from-location as text or a select, a to-location combobox over the Locations file in server order, a debounced server preview that shows refusals as input errors and the effect line ("to an empty location", "stock is added together", the FR-34 undo sentence with **Remove move**), and a toast that names the move. Part numbers in the Locations table open the part panel. `lib/commands` gained `sendWithEvents`; epic 3 retro items 19 (bare proxy 500 retries), 21 (command built inside `try`, UUID fallback), 23 (503-after-apply e2e) and 24 (marks toast only with events) are closed.

**Files changed:**
- `frontend/components/common/manual-move-dialog.tsx` (new) -- dialog, combobox and pure helpers (`fromChoices`, `matchLocations`, `locationCode`, `effectLine`, `moveToast`, `confirmReason`).
- `frontend/components/common/part-panel.tsx` -- `ManualMoveButton`, `manualMoveReason`, dialog in `PartPanel`.
- `frontend/components/common/locations-table.tsx`, `modules/locations/locations-page.tsx` -- `onOpenPart` part buttons.
- `frontend/lib/api/plans.ts` -- preview types, key, fetch and hook; `CommandEvent`.
- `frontend/lib/api/errors.ts` -- `isErrorEnvelope`.
- `frontend/lib/commands/client.ts`, `react.tsx` -- `SendResult`, `sendWithEvents`, `newCommandId`, build inside `try`, bare 500 transient.
- `frontend/modules/best-locations/best-locations-page.tsx` -- marks toast only when events exist.
- Tests: `tests/manual-move.test.tsx` (new, 15), `tests/commands.test.tsx`, `tests/best-locations.test.tsx`, `e2e/manual-move.spec.ts` (new, 6 journeys).
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro items 19, 21, 23, 24 `done`; `epic-4-context.md` -- regenerated (spine changed in 4.2).

**Review findings:** 32 findings (high 0, medium 3, low 17, false 12). Patched: 5 entries (2 medium: saving-reason e2e check, from-select e2e journey; 3 low: stale cached preview, case-insensitive code, busy double-press). Deferred: 0. Rejected: 27, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`). Two medium entries were patched, but both were test gaps now closed by passing tests; no unverified risk can be named.

**Verification:** `npm run lint` clean; `npm run typecheck` clean; `npm run lint:py` all checks passed; `npm run lint:imports` 5 contracts kept; `npm test` pytest 399 passed, Vitest 205 passed; `npm run e2e -- --project=chromium` 41 passed.

**Residual risks:** Esc handling (radix document listener vs the field) verified only in Chromium; a server refusal on submit after an allowed preview is untested in the browser; the autocomplete loads the whole locations view.
