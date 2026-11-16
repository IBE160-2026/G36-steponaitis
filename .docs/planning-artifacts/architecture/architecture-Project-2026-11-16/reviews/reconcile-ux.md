# Reconciliation: UX spines against the architecture spine

Source: `.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/EXPERIENCE.md` (final, 2026-11-16) and `DESIGN.md` (tokens skimmed; prose read for architectural consequences), with `PRODUCT.md` and the PRD FRs they cite.
Checked against: `ARCHITECTURE-SPINE.md` (draft, 2026-11-16). Checked 2026-11-16.

Scope: only UX behaviours that need an architectural decision the spine does not make, or that the spine contradicts, where independently built stories could diverge. Pure visual details are left out.

## Verdict

The spine covers the big UX promises well: server-authoritative plan state (AD-3), one idempotent command path (AD-6), the step log that makes undo, reset and swaps exact (AD-5, AD-16), view state and Key colours in `localStorage`, the wall layout and move list as domain views (AD-15, AD-17), and demo/auth flags (AD-10). The gaps sit at the seams between the server and the screen. The spine never says what a command returns, so the many UX toasts and notices that report what a change did ("Combined into one move", "3 recommendations are now outdated", "Undid move 3") have no source the frontend may use without computing plan logic itself. The single-request import cannot honestly drive the UX's step list or its "Cancel saves nothing" promise. Undo is untargeted on shared, last-write-wins plans, so the toast's Undo can reverse a different move than the one it names. The retry queue (AD-12) contradicts the UX "Run failed" state and leaves "edits stay possible" undefined under no-optimistic rendering. Several smaller contracts (recommendation numbers, location references, deep links, previews in the Manual move dialog, 401 handling, fonts, print freshness) are left to stories that will each make their own choice. There are 18 findings: 5 high, 9 medium and 4 low.

## Findings

### 1. Import step list and Cancel cannot be built on a single synchronous request
- **Severity:** high
- **UX:** EXPERIENCE.md, State Patterns, "Import running": "A step list, not a percentage: Reading Locations.xlsx ✓ · Checking columns ✓ · Checking values… · Counting picks · Finding pick groups … Cancel is allowed and saves nothing." Also UJ-1 step 2, UJ-5 step 3.
- **Gap / contradiction:** AD-8 parses, checks and saves in one `POST /api/plans` and one transaction. The server reports no progress, so the step list has no real source: one story will fake a timed sequence, another will show a single "Importing…" line. Cancel is worse: aborting the fetch does not stop the server, which may still commit the plan after the user saw "nothing was saved". The plan then appears in the saved-plans list (or, in milestone 1, becomes the start plan), which contradicts the UX promise.
- **Fix:** Decide in the spine (AD-8 or a new AD):
  - The step list is honest about what the client knows: "Uploading files" (driven by upload progress), then one server step "Checking files and computing classes and pick groups…", then the result. Ticks for individual server phases are shown only from the response (e.g. which files passed, see finding 2), not from a timer. Offer this as a UX update to the step-list copy.
  - Cancel is allowed only while uploading. Once the request has been fully sent, Cancel is replaced by the running text. If Cancel must stay, `POST /api/plans` takes a client-generated `request_id`, and Cancel sends `DELETE /api/plans?request_id=…` after aborting, which deletes the plan if it was committed (idempotent if it was not).

### 2. Import error payload: per-file status, file role and the error cap are undefined
- **Severity:** medium
- **UX:** EXPERIENCE.md, Import error rows: "All errors in the failing file are listed by row, up to 20, then 'and 37 more in this file'"; Component Patterns, Import error: "The failing file's tile is marked. Passed files stay selected"; DESIGN.md, Import error: "Files that passed show a check"; Accessibility Floor: errors "linked to the failing file tile".
- **Gap:** AD-11 says only that import errors put file, row and column in `details`. The tiles are by role (Locations, Inventory, Transactions), but the uploaded file name is free ("Inventory.xlsx", "inv_export (2).csv"), so the client cannot map an error to a tile without a role field. Nothing says whether the server returns all errors (up to 50,000 rows × columns) or caps them, or how the client learns that a file passed versus was never checked (FR-5 needs Locations to parse before Inventory locations can be checked).
- **Fix:** Define the `import_invalid` details shape in AD-11: `details: [{file_role: "locations"|"inventory"|"transactions", file_name, status: "passed"|"failed"|"not_checked", errors: [{row, column, message}] (≤ 20), more_count}]`. The server caps at 20 per file and counts the rest. `message` is final copy per AD-11. Also give the `limit_reached` case on New Plan (AD-18, `MAX_UPLOAD_BYTES`, `MAX_ROWS_PER_FILE`, `MAX_PLANS`) UX copy and a place (the import-error panel), since EXPERIENCE.md has none.

### 3. Commands return nothing defined, but toasts and notices report what each command did
- **Severity:** high
- **UX:** EXPERIENCE.md toasts and notices: "Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01 · Undo"; "Combined into one move: G-14-04-02 → A-02-01-01 (Manual)."; "Moved 4410281: G-14-04-02 → G-14-01-04 (Manual, round 1)."; "Swapped G-14-04-02 ↔ G-14-01-03 · 2 manual moves, round 1."; "Best-location marks changed · 3 recommendations are now outdated · View"; "Undid move 3. Unapplied recommendations of round 1 are now outdated."; "Plan reset. 18 moves removed; marks kept."; Undo last move "afterwards … a notice says so"; Run "Afterwards the round chip, tabs and counts update, and focus moves to the first row".
- **Gap / contradiction:** AD-6 says a repeated `command_id` "returns the stored result", but the result is never defined. Without it, each story will reconstruct the message by diffing the refetched views before and after. That is the client computing outdated counts, FR-34 combination and removal, and move numbers, which AD-3 forbids, and different stories will diff differently. The diff is also wrong when another user changed the plan in between.
- **Fix:** Add to AD-6: the command response is `{version, events: [...]}`, where `events` is a closed union built by the domain from the applied command, e.g. `move_made {move_number, round, part, from, to, rule, recommendation_id?}`, `moves_combined {move_number, from, to}`, `move_removed {move_number}`, `swap_made {swap_id, from, to, move_numbers}`, `recommendations_outdated {count, cause}`, `step_undone {move_number, part, from, to}`, `plan_reset {moves_removed}`, `run_done {round, recommendations, no_space}`, `mark_set/removed {mark}`. The stored result for idempotent replay is this response. Toast and notice copy is chosen by event type in one frontend module (`lib/commands/messages`), so each screen does not invent its own.

### 4. Undo is untargeted, so the toast's Undo and the Undo tooltip can reverse a different move
- **Severity:** high
- **UX:** EXPERIENCE.md, Toast: "Undo appears only when Undo last move would reverse exactly what the toast reports"; Undo last move tooltip: "Undo move 3: 9723950 A-03-04-02 → A-05-01-03"; Recommendation detail: "'Moves in the planning copy' (the last 3, newest first, 'Undo reverses move 3 first')".
- **Gap / contradiction:**
  - The `undo` command has no target. Plans are shared and the last write wins (AD-6), so between showing a toast (≥ 10 s) or a tooltip and the click, another user, another tab, or a queued command of this user can add a step. Undo then reverses a move the planner never saw named.
  - Undo reverses a **step** (AD-5), but the UX names a **move**. With FR-34 combination, move 3 may be steps 3 and 5 combined; undo removes step 5, so the planner sees "Undo move 3" yet move 3 stays (with its earlier to-location). After an FR-34 removal by moving back, the last step belongs to no visible move at all. Stories that build the tooltip, the toast and the "Moves in the planning copy" panel will choose differently between steps and effective moves.
- **Fix:**
  - `undo` carries `expected_step_id` (or `expected_move_number` plus step sequence). The server rejects with `command_rejected` and final copy ("Someone made another move since. Undo now reverses move 7.") when it is not the last step.
  - Add a server view `undo_target` on the plan summary: the last step as it was made (move number, part, from, to, and whether it was part of a combined or removed move), worded by one rule. The tooltip, the toast's Undo and the panel's "Undo reverses …" line all use it.
  - Decide whether "Moves in the planning copy" lists effective moves (FR-34) or steps, and offer the UX a sentence for the combined case ("Undo reverses the second half of move 3 first").
  - The toast hides Undo as soon as any later command is confirmed.

### 5. Pending and retrying commands under "no optimistic rendering" are undefined; UX says edits stay possible
- **Severity:** high
- **UX:** EXPERIENCE.md, State Patterns, Save failed: "Retries automatically. Edits stay possible [ASSUMPTION]"; Drag, Drop on an empty location: "No dialog: the manual move is made at once … The bin settles into its new slot with the 'M' marker"; Best locations: "'174 best · 7 empty' updates live"; NFR-8: other actions within 1 s.
- **Gap / contradiction:** AD-3 shows nothing of plan state before the server confirms. AD-12 keeps one command in flight and holds later commands while retrying. The spine already notes that the "Save failed" copy changes (Deferred), but not the behaviour: if edits stay possible, a planner who clicks Apply on three rows during a retry sees nothing happen, and the three commands queue invisibly behind the failing one. Each command was also built against a screen that no longer matches what the server will apply. One story will disable plan controls while the queue is non-empty, another will accept clicks silently, a third will show a spinner (banned: "Running…" is text, not a spinner). The drag story must decide what the dropped bin does during the ≤ 1 s round trip.
- **Fix:** Add a rule to AD-12 or AD-3: while the plan's queue holds an unconfirmed command, every plan-changing control is `aria-disabled` with the reason "Saving the last change…" (and during retry, the AD-12 notice), and no further command is queued. Transient UI that is not plan state (the dragged ghost bin at its drop point, a dimmed source slot, "Running…") may show until the response arrives, then the refetch replaces it. Offer the UX update "Edits wait until the last change is saved".

### 6. "Run failed" contradicts the AD-12 retry policy; an `internal` error is retried forever
- **Severity:** high
- **UX:** EXPERIENCE.md, State Patterns, Run failed: "The run is all or nothing [ASSUMPTION]: 'The run stopped before it finished. Nothing changed: still round 1. Run recommendations to try again.' The list keeps the previous round; the button is enabled again and focused." Run recommendations: "While running (≤ 5 s): 'Running…', disabled, list inert".
- **Gap / contradiction:** AD-6's single transaction gives the all-or-nothing outcome, but AD-12 retries every network error or 5xx with the same `command_id` up to 30 s apart indefinitely, showing "The last change was not saved yet. Trying again." The UX instead stops, says nothing changed, and hands the retry to the planner. A deterministic domain bug that raises `internal` (500) would also be retried for ever while the list stays inert and every other command waits.
- **Fix:** Split AD-12 retries by cause: network errors and 502/503/504 are retried as now; `internal` (500) is not retried (or at most once) and is shown as a failure. For `run`, after the retry budget (e.g. 3 tries or 15 s) the queue drops the command, refetches, and the Recommendations screen shows the UX "Run failed" state. Because `run` is idempotent by `command_id`, a late success is still safe: the refetch shows the new round.

### 7. Recommendation numbers have no stored source
- **Severity:** medium
- **UX:** EXPERIENCE.md, Rule band: "Recommendations are numbered 1, 2, 3 … across the whole round, not per rule, so a number on the wall is never ambiguous"; lifted bins and markers ("Its number matches the row in the list"); move target tooltip "Recommendation 2 arrives here"; "Selected · #1 · Rule 1"; "Show recommendation #1"; drawer "with matching numbers".
- **Gap:** AD-7 stores recommendations with status but no number. If the frontend numbers rows by position, the numbers shift as rows move between the Open, Applied and Outdated tabs, and the wall, drawer, crops and tooltips (built in other modules) number differently.
- **Fix:** Add to AD-7 or AD-14: the domain assigns `number` at run time in the AD-14 order (rule 1, 2, 3; each rule in its own order), stored in the run, never renumbered while the round lives. "No space" entries are not numbered (or numbered in their own series; decide and tell UX). Every view that shows a recommendation carries its `number`.

### 8. Reason sentences and outdated causes: who renders the copy, and the partner-aisle cause has no UX copy
- **Severity:** medium
- **UX:** EXPERIENCE.md, Recommendation detail reason ("61 picks in the period, so it is fast-moving (24 or more). It sits on level 4, not a best location. Rule 1 lifts it to …"); Voice ("Pick group with 7181839 (aisle D): 7 shared jobs (5 or more)"); Outdated ("A-11-02-02 was filled by a manual move." / "4410281 has been moved." / "The best-location marks changed." / "Outdated after undo."); No space causes per rule; hover note, partner strip ("arrives with move 2").
- **Gap:** AD-11 makes backend messages final copy for errors only. Reasons and causes are shown in the list, the detail, the wall hover note, tooltips and the drawer, by different modules. Without a rule, one story sends sentences, another sends structured facts that the frontend words, and the wording drifts. The cause "filled by a manual move" also needs data the AD-7 cause list does not name (which location, and whether a manual move or an applied recommendation filled it). AD-7 adds a fourth cause (rule 3 partner's aisle changed) that EXPERIENCE.md has no copy for.
- **Fix:** Decide one of: (a) the domain returns structured `reason` and `outdated_cause` objects (closed unions with their numbers and codes) and one frontend module (`lib/copy`) words them; or (b) the domain returns final sentences plus the numbers to bold. (a) suits bold numbers and the hover note; either works if only one place words them. Extend the outdated cause with `{kind, location?, by: manual|recommendation|swap}`. Offer UX copy for the partner-aisle cause, e.g. "Partner 8044172 is no longer in aisle G."

### 9. Manual move dialog and drop dialog need pre-commit previews the client may not compute
- **Severity:** medium
- **UX:** EXPERIENCE.md, Manual move dialog: refuses the from-location and virtual locations inline ("FLSKRS is a virtual location, not a shelf."); shows "to an occupied location: stock is added together"; State Patterns, Move back removes it: "This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed." with **Remove move**; Drag targets: "Virtual locations, hatched positions and the bin's own slot show no target"; Drop dialog keep-in-place warning.
- **Gap / contradiction:** Knowing before Confirm that a move back removes move 4 is FR-34 planning logic, and knowing that the part already sits in the target needs the planning copy. AD-3 forbids the frontend computing either. Whether a location is virtual is not in AD-15's layout or any named view. Stories will either compute FR-34 in TypeScript or make the dialog lie until submit.
- **Fix:** Add a read-only preview endpoint (GET, writes nothing): `GET /api/plans/{id}/moves/preview?part=&from=&to=` returning `{allowed, refusal_message?, effect: "new"|"adds_to_stock"|"combines_with" {move_number}|"removes_move" {move_number}}`, computed by `domain.planning`. The dialog and drag targets use it; the command still re-checks on submit. Add `is_virtual` to the location data (finding 11).

### 10. Cross-step navigation and selection: URL, `localStorage`, or shared state?
- **Severity:** medium
- **UX:** EXPERIENCE.md: "Show on the Locations wall opens the from-aisle with the move selected"; location chip "opens that location on the wall with its tooltip pinned"; search "A location result opens the wall at that bin. A part result opens the part panel and selects its current location"; "Selecting a move anywhere … selects it everywhere"; "One selected row per list, kept when switching tabs"; Saved-plans row "Click opens the plan as it was left (FR-9)"; "Opening the Locations view shows the aisle last opened in this plan".
- **Gap / contradiction:** The seed routes `plans/[id]/…` put the step in the URL, while the View-state convention keeps "the open step, aisle, view mode" in `localStorage`. Nothing says which wins when a plan is opened from the list, nor how one module asks another to open a location, aisle, move or part (query params, a shared store, `localStorage` writes before navigating). Selection of a recommendation/move is in neither. Each of the recommendations, locations, search, part-panel and launcher stories will invent its own handoff.
- **Fix:** Add a navigation convention: the URL is the source for what is shown now (`/plans/{id}/{step}?aisle=A&loc=A-07-01-02&move=<recommendation or move id>&part=…`); `localStorage` keeps only the last values, used to fill a bare URL (e.g. opening a plan goes to its last step, or Overview). One typed helper in `lib/view-state` builds these links. Selection lives in the URL so "selects it everywhere" and the browser Back button behave the same in every module.

### 11. A location reference DTO, and the wall data AD-15 leaves out
- **Severity:** medium
- **UX:** EXPERIENCE.md, Warehouse wall: two runs ("the first ⌈n/2⌉ sections on top"), the end cap "End of aisle A · Walk Path 2,270 →", "Moves touching aisle A" (needs the aisle of each end), "From G-14-04-02 (aisle G)", crops "the 3 sections around the from-location" (2 at 1280–1439), crop names "aisle G, level 4", virtual locations as non-targets, Whole warehouse "selected move drawn as one route … also across aisles".
- **Gap / contradiction:** AD-15 forbids the frontend parsing codes and deriving geometry, yet:
  - most views reference a location only by code, while the UX needs its aisle, level, best status and virtual flag everywhere a code appears (drawer filtering, tooltips, crops, the search result);
  - the two-run split, the end cap's Walk Path and virtual locations are not in AD-15, so they will be done in the frontend by one story and in the domain by another;
  - the crop window ("3 sections") has no meaning for the fallback layout (one run per level, no sections);
  - drawing a route across aisle cards, or cropping sections, is geometry, which AD-15's wording forbids although the Deferred list leaves drawing to stories.
- **Fix:** Define `LocationRef {code, aisle, level, section?, position?, is_best, is_virtual}` as the shape every view uses for a location. Extend AD-15: the layout gives logical cells (run index, row, column, gap) including the two-run split, the end cap's Walk Path, and how virtual locations are treated (off the wall, or marked). Clarify that "geometry" means logical placement: pixel sizes, crops (a window of N sections, or N positions in the fallback layout) and route lines between logical cells are the frontend's. Split the data into an import-stable `layout` (cacheable for the import's life) and a per-plan `occupancy/moves` view.

### 12. Session expiry, auth gating and query-side 401/404 are not handled
- **Severity:** medium
- **UX:** EXPERIENCE.md, Log in "Reached from … any page while logged out"; FR-40 every page except login, create account and the demo front page requires login; Log out to the front page on the public deployment; AD-12's "This plan was deleted." for commands only.
- **Gap:** AD-2 forbids server components and route handlers calling the backend, so gating must happen in the client (or in Next.js middleware checking cookie presence); the spine picks neither. AD-12 treats `unauthenticated` as an ordinary 4xx (drop the command and show the message), so an expired 30-day session silently loses the change instead of sending the planner to Log in. A GET that returns 401 or `plan_not_found` (another user deleted the plan) has no rule at all.
- **Fix:** Add to AD-10/AD-12: one TanStack Query and command-queue error hook. `unauthenticated` from any request goes to Log in (keeping the return path), and in the queue the pending command is kept and resent after login. `plan_not_found` from any request shows "This plan was deleted." and opens the saved-plans list. Gating is a client layout guard on `GET /api/auth/me`; the middleware may only redirect on a missing cookie, never decide validity.

### 13. Login and account errors: lockout, field errors and limits have no contract or copy
- **Severity:** medium
- **UX:** EXPERIENCE.md, Log in: one alert "Wrong username or password. Check both and try again.", never saying which was wrong; Create account: "That username is taken. Try another." / "The passwords don't match.", focus to the first error; UJ-5 "Log in with the README's demo account (demo/demo)".
- **Gap / contradiction:**
  - AD-18 locks an account for 60 s after 5 failures, but there is no UX copy and no error code (`unauthenticated` 401? `limit_reached` 409? there is no 429), and the ER diagram ties attempts to USER, so a lockout message would only ever appear for existing usernames.
  - Anyone can lock the shared `demo` account for the examiners who follow the README's demo/demo path (Demo version is unaffected only if `POST /api/auth/demo` skips the throttle, which the spine does not say).
  - AD-10's password rule (4–64 characters) and username rule have no UX copy; AD-11's `details` shape for field errors (`validation_failed`) is undefined, so the "focus the first error" behaviour has no field key to use.
  - `MAX_ACCOUNTS` reached on Create account has no copy.
- **Fix:** Define `details: [{field, message}]` for `validation_failed`. Count attempts per submitted (lower-cased) username whether or not it exists, return the same `unauthenticated` code with one lockout message ("Too many tries. Wait a minute and try again."), and exempt `POST /api/auth/demo` and, optionally, the seeded demo account from the lock. Offer UX copy for the lockout, the password length, an invalid username, and the account limit.

### 14. Fonts are specified "on Google Fonts", but the local install may make no runtime network calls
- **Severity:** medium
- **UX:** DESIGN.md, Typography: "There are two families, both on Google Fonts: Barlow Semi Condensed … Figtree".
- **Gap:** NFR-2 forbids network calls at runtime on the local install. A story that adds a Google Fonts `<link>` breaks NFR-2; `next/font/google` also fetches at `next dev` start and at build. The spine's Stack is silent.
- **Fix:** Add to the Stack or Config convention: both families are self-hosted from committed files with `next/font/local` (or `@fontsource` packages installed at `npm install`); no font request leaves the origin. Both fonts are under the SIL Open Font License, which allows this.

### 15. Move list print: generated-at freshness and per-page header/footer in Firefox
- **Severity:** medium
- **UX:** EXPERIENCE.md, Move list print: header on every page with "Generated 2026-11-11 10:05"; "Reprint: the generated time is the only thing that tells two printouts apart (UJ-3)"; "Page 1 of 3" in the footer [ASSUMPTION]; column heads repeat; A4 portrait; NFR-9 includes Firefox print.
- **Gap:** AD-17 takes the generated time from the server request. With TanStack Query caching, a reprint from a preview that stayed open (or a cached query) prints last week's time, which defeats UJ-3. A header repeated on every page and "Page X of Y" need CSS paged-media features (margin boxes, `counter(pages)`) whose support differs between Chrome and Firefox; one story may build the header in `@page` margin boxes and fail Firefox.
- **Fix:** Add to AD-17: the print route fetches the move list with `staleTime: 0` on mount and refetches on `beforeprint` (or the Print button refetches, then calls `window.print()` after the data arrives). The repeating header and column heads go in a table `<thead>` (`display: table-header-group`), which every target browser repeats; "Page 1 of 3" is best effort and drops where unsupported (offer the UX update). Offer copy for round 0 on paper (AD-17 "before the first run"), which EXPERIENCE.md does not word.

### 16. Flow-bar checks, launcher counts and Apply all (n) need one server summary
- **Severity:** low
- **UX:** EXPERIENCE.md, Flow bar check rules ("Recommendations is checked when the latest run has no unapplied, non-outdated recommendation left"); Launcher: each step column shows "live counts from the open plan"; Apply all (n) with n defined by FR-30; Whole warehouse figures; plan plate round.
- **Gap:** These counts span every step. Without a named view, the toolbar and launcher either fetch every step's view (slow, and refetched after every command by AD-3) or compute counts and check states from partial data, which for Recommendations is outdated-status logic AD-3 assigns to the server.
- **Fix:** Name one `GET /api/plans/{id}` summary view (under the `['plan', id]` key) that carries the plate data, step check states, per-step counts, `apply_all_count`, the undo target (finding 4) and the round. The toolbar and launcher read only it.

### 17. Key colours "last until you close this tab" when storage is blocked
- **Severity:** low
- **UX:** EXPERIENCE.md, State Patterns, Key colours can't be kept: "Colours can't be kept in this browser; changes last until you close this tab."
- **Gap:** The spine keeps colours only in `localStorage` with try/catch. When it is blocked, an in-memory fallback is lost on reload, which is earlier than "until you close this tab"; `sessionStorage` is normally blocked too. With client rendering only, the stored colours also apply after first paint, so walls can flash default colours.
- **Fix:** Say the fallback is in memory for the page's life, and offer the UX copy "changes last until you reload or close this page". Apply stored colours as CSS custom properties from a small inline script in the root layout before first paint (inside try/catch).

### 18. Search, launcher plan search and "recent plans" have no named owner
- **Severity:** low
- **UX:** EXPERIENCE.md, Search field (FR-15: part numbers, descriptions and location codes, partial, case-insensitive, parts and locations listed apart; a part result selects its current location); Launcher typed search over Steps, Actions and Saved plans; plan plate menu "switch to a recent plan".
- **Gap:** Nothing says whether search runs on the server or in the client, how case is folded (Python `casefold` vs JS `toLowerCase`), or in what order results come (AD-14 owns ordering). "Recent plans" may mean the user's recently opened plans (browser) or the most recently edited (server, FR-8).
- **Fix:** Put part and location search in the domain behind `GET /api/plans/{id}/search?q=` with results in AD-14 order and the part's current location from the planning copy. Launcher plan search filters the saved-plans list client-side (≤ `MAX_PLANS`). Define "recent plans" as the saved-plans list's first five by last edited (server), so it needs no extra storage.

## Checked and consistent (no finding)

- Run all-or-nothing as an outcome: AD-6's one transaction per command gives it (finding 6 is only about retries).
- Toasts about marks never offering Undo: matches AD-5 ("Marks and runs are not steps").
- Per-plan view choices and Key colours in the browser, never in the plan: View-state convention and FR-9.
- Swap undone one move at a time, swap marks on the print only while intact: AD-16, AD-17.
- Demo front page, Demo version and Log out to the front page on the public deployment only: AD-10 flags.
- 1280px minimum and reflow to 320 CSS px: layout only; no architectural consequence.
- A4 portrait, black and white, order never re-sorted: AD-17, AD-14.
- Outdated is sticky until the next run, and kept-in-place rows return to open when unmarked: AD-7.
