---
title: 'Story 6.5: Launcher: jump to any step, action or saved plan'
type: 'feature'
created: '2026-11-22'
baseline_revision: '5fffb0e6df8ed17531e36257df813b88c1610ebd'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The Apply all confirm (page and launcher) promises undo before FR-35 ships (epic-5 retro item 41).
    evidence: |-
      lib/copy applyAllQuestion says "Undo reverses them one move at a time."; the launcher reuses it. The wording change is an open decision owned by Justas.
    location: >-
      frontend/lib/copy/index.ts applyAllQuestion
    severity: low
---

<intent-contract>

## Intent

**Problem:** Inside a plan the planner can only move through the flow bar and the plan plate. There is no keyboard-first map of the flow with live counts, actions and saved plans (UX-DR7, UX-DR8, UJ-8).

**Approach:** A new frontend slice `modules/launcher` renders the toolbar grid button and the flow map drawer, a modal dialog opened by the button or `Ctrl+K` / `⌘K`. Everything the drawer lists that is not a flow step comes from data lists in `lib/launcher`: registered actions, band entries and keyboard shortcuts. Epic 7 adds Undo last move and Reset… to that action list without touching the launcher's code. Frontend only: no backend change, no new dependency.

## Boundaries & Constraints

**Always:**
- **Slice and mount.** `modules/launcher/launcher.tsx` exports `Launcher`. It imports only `components/*` and `lib/*`. `AppShell` gets an optional `launcher?: ReactNode` prop that it passes to `Toolbar`. `Toolbar` renders it after the flow bar, only on plan paths. `app/layout.tsx` passes `<Launcher />`. No component under `components/` imports a module.
- **`lib/launcher/index.ts`** (pure, no React components) holds:
  - `STEP_CODES`: `overview` OVR, `parts` PRT, `locations` LOC, `pick-groups` GRP, `best-locations` BST, `recommendations` REC, `before-after` B/A, `move-list` MOV.
  - `LauncherContext`: `{ planId, summary: PlanSummary, savingReason?: string, navigate(href), send(body): Promise<SendResult>, notify(text) }`.
  - `LauncherAction`: `{ id, column: StepKey, label(ctx), keywords?: string[], disabledReason?(ctx), confirm?(ctx) => { title, description, confirmLabel, destructive: boolean }, run(ctx) }`.
  - `LAUNCHER_ACTIONS`, the registered action list:
    - `run-recommendations` in column REC. Its label is `Run round <current_round + 1>` and its keywords are ["run recommendations"]. It is disabled with `savingReason`. Its run navigates to `planStepHref(planId,"recommendations")`, sends `{type:"run"}`, and on `confirmed` with a `run_done` event notifies `runAnnouncement(event)`.
    - `apply-all` in column REC. Its label is `Apply all (<apply_all_count>)…`. It is disabled with `NO_OPEN_TO_APPLY` when the count is 0, otherwise with `savingReason`. Its confirm is `{title:"Apply all", description: applyAllQuestion(count, round), confirmLabel:"Apply all", destructive:false}`. Its run navigates to Recommendations, sends `{type:"apply_all"}`, and on `confirmed` with `apply_all_done` notifies `applyAllToast(event, round)`.
  - `BAND_ENTRIES`, each a code, a name, a description and `href(planId)`:
    - SAV "Saved plans" → `SAVED_PLANS_HREF`
    - NEW "New Plan" → `NEW_PLAN_HREF`
    - NEW "New Plan from this import" → `newPlanFromHref(planId)`
    - SET "Settings" → `planSettingsHref(planId)`
  - `STAGE2_PLATES`: CAT "Category check" and LBL "Location labels".
  - `KEYBOARD_SHORTCUTS`: `Ctrl K` open this menu, `Ctrl /` search the page, `Alt A` apply, `Esc` close, plus the note "⌘ and ⌥ on a Mac."
  - `stepState(step, currentStep, summary)`:
    - "You are here" for the current step;
    - else "Output" for before-after and move-list;
    - else "Done" when the summary step is `checked`;
    - else "Not done yet".
  - `stepCountLines(step, summary)` → string[], from the summary only (AD-3):
    - OVR: `Data as of <date>`, `round <n>`;
    - PRT: `<count> parts`, `<fast> fast-moving`;
    - LOC: `<count> locations`;
    - GRP: `<count> pick groups`;
    - BST: `<best> best · <empty> empty`;
    - REC: `Round <n> · <apply_all_count> to apply`;
    - B/A and MOV: none.
    Numbers use `formatNumber` and dates use `formatDate`.
  - `launcherResults(query, {steps, actions, plans})` → groups `[{label:"Steps"|"Actions"|"Saved plans", items}]`, with empty groups dropped:
    - The trimmed query is matched case-insensitively as a substring against a step's code and name, against an action's label and keywords and against band entries' code and name (band entries are listed under Actions), and against a saved plan's name.
    - Items keep their list order: steps in flow order, then the registered actions, then the band entries, then plans in server order.
    - A blank query → `null` (the columns show).
  - `NO_MATCH(query)` = `No feature or saved plan matches “<query>”.`, and `SEARCH_PLACEHOLDER` = "Search features, actions and plans".
- Move `NO_OPEN_TO_APPLY` to `lib/copy` and import it from there in the recommendations page and its test. Its value does not change.
- **Opening:**
  - The grid button: 36px square, `grid` icon, `aria-label="Open the launcher"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-keyshortcuts="Control+K Meta+K"`. It is shown pressed while the drawer is open.
  - A `keydown` listener on `window` in the capture phase opens the drawer on `Ctrl+K` or `⌘K` (`key` k/K, Ctrl or Meta, no Alt) and calls `preventDefault`. It works inside text fields too, and only while a plan path is open.
  - When the drawer is already open, the shortcut focuses its search field. It is ignored while another modal dialog (`[role=dialog][aria-modal=true]` or `[role=alertdialog]`) is open.
- **Drawer:**
  - A radix `Dialog` (modal), labelled "Launcher", drawn under the toolbar over an ink scrim. It opens with an empty search, and focus starts in the search field.
  - While it is open, `#content` and the toolbar `<header>` carry the `inert` attribute.
  - `Esc` (from anywhere in the drawer, including a non-empty search field) closes it. Closing removes `inert` and returns focus to the grid button.
  - Activating any entry closes the drawer first and then navigates or runs.
- **Columns** (blank query):
  - Eight groups (`role="group"`, labelled with the step name), in flow order. Each holds:
    - the step link (code and name) to `planStepHref(planId, step)`;
    - the state line;
    - the count lines;
    - the registered actions whose `column` is that step, in list order.
  - The current step's column is tinted with an ink frame and has the "You are here" tag.
  - Each column is one tab stop (roving tabindex): `Tab`/`Shift+Tab` move between groups and `↑`/`↓` move within one, without wrapping.
  - The band follows as more groups:
    - Plans: the open plan as a non-interactive card (name, `Data as of … · round n`), the other saved plans (`usePlans`, the open plan excluded, at most `RECENT_PLANS_MAX`) linking to `planOpenHref`, and the `BAND_ENTRIES`.
    - Stage 2: CAT and LBL plates with a dashed outline, the lock icon, "Coming in stage 2" and `aria-disabled="true"`. They can be focused but do nothing on `Enter` or click.
    - The Keyboard box, which is static text and not focusable.
- **`Enter`** (or a click) opens the focused step or plan, runs the focused action, or opens the band entry.
  - An action with a `disabledReason` uses `aria-disabled` and shows the reason as its description, and nothing runs.
  - An action with `confirm` opens the shared `ConfirmDialog` after the drawer closes, and `run` happens only on confirm.
  - `ConfirmDialog` gains an optional `destructive` prop, default `true`. `false` gives the primary button variant. Existing uses do not change.
- **Search:**
  - Typing replaces the columns with one listbox of the grouped results, and the first item is highlighted. Focus stays in the search field (combobox with `aria-activedescendant`). `↑`/`↓` move the highlight.
  - `Enter` activates the highlighted item. On a disabled action it does nothing.
  - No match shows `NO_MATCH(query)`.
  - Clearing the text brings the columns back.
- The launcher gets the summary through `usePlanSummary`, the plans through `usePlans`, `send`/`disabledReason` through `usePlanCommands(planId).sendWithEvents`, `navigate` through `useRouter().push`, and `notify` through `showToast`. Before the summary loads, the columns show the step links and states without counts or actions.
- Every test names its UX-DR, FR or journey (SM-7). New e2e specs import `test`/`expect` from `frontend/e2e/support/test.ts` and name UJ-8.
- Do not change any `action_items` status in `sprint-status.yaml`.

**Never:**
- No backend or API change, no new dependency, and no single-character shortcuts.
- No Undo or Reset actions (Epic 7), and no other per-step actions beyond Run and Apply all.
- No edits under `.docs/planning-artifacts/`, `data/`, or `.logs/`. No session logs. Do not commit or push; the orchestrator does that.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Jump by code | type "REC", `Enter` | Recommendations opens; drawer closed | — |
| Case and partial | "mov" | Steps: MOV Move list highlighted first | — |
| Action match | "run" | Actions: Run round N | — |
| Plan match | part of another plan's name | Saved plans: that plan; `Enter` opens `planOpenHref` | — |
| No match | "xyz" | "No feature or saved plan matches “xyz”." | `Enter` does nothing |
| Apply all with 0 open | `apply_all_count` 0 | action `aria-disabled`, reason "No open recommendations to apply." | nothing sent |
| Apply all confirmed | count > 0 | confirm → `apply_all` sent, toast, on Recommendations | Cancel sends nothing |
| Saving | command pending | Run and Apply all disabled with "Saving the last change…" | — |
| Off a plan | `/plans` | no grid button; `Ctrl+K` does nothing | — |
| Stage 2 | `Enter` on CAT | nothing happens; drawer stays open | — |

</intent-contract>

## Code Map

- `frontend/components/common/app-shell/index.tsx`: `AppShell`; add the `launcher` prop. `toolbar.tsx`: `Toolbar` and `PlanToolbarParts` (the plan path from `parsePlanPath`); render the slot after `FlowBar` on plan paths only.
- `frontend/app/layout.tsx`: pass `<Launcher />` (app may import modules).
- `frontend/components/common/app-shell/plan-plate.tsx`: `RECENT_PLANS_MAX`; reuse it. Also see its Esc and focus-return pattern.
- `frontend/components/common/app-shell/flow-bar.tsx`: the step disc and check visuals to mirror; `FLOW_STEPS` lives in `lib/view-state/steps.ts`.
- `frontend/lib/view-state/urls.ts`: `planStepHref`, `planOpenHref`, `planSettingsHref`, `SAVED_PLANS_HREF`, `NEW_PLAN_HREF`, `newPlanFromHref`, `parsePlanPath`. Use these and build no URL by hand.
- `frontend/lib/api/plans.ts`: `usePlanSummary`, `usePlans`, `PlanSummary` (`steps[].checked/count`, `class_counts`, `best_locations`, `empty_best_locations`, `apply_all_count`, `current_round`, `data_as_of`).
- `frontend/lib/commands/react.tsx` `usePlanCommands`: `sendWithEvents`, `disabledReason`. `lib/commands/client.ts`: `SendResult`, `CommandBody`, `SAVING_REASON`.
- `frontend/lib/copy/index.ts`: `applyAllQuestion`, `applyAllToast`, `runAnnouncement` (reuse); add `NO_OPEN_TO_APPLY`.
- `frontend/modules/recommendations/recommendations-page.tsx:78`: `NO_OPEN_TO_APPLY` moves out. Its `run()`/`applyAll()` (~:540–577) show how the events are read (`findEvent`). `tests/recommendations.test.tsx:26` imports it.
- `frontend/components/common/confirm-dialog.tsx`: add `destructive`. `components/common/button.tsx`: the variants. `components/common/icons.tsx`: `grid`, `lock`, `check` exist. `components/common/toast.tsx`: `showToast`.
- `frontend/components/common/input.tsx`: its Esc clears the field. Either do not use it for the launcher search, or make Esc close the drawer before it clears.
- `frontend/components/common/search-field.tsx:27`: the modifier-shortcut pattern.
- `frontend/app/globals.css`: tokens (`launcher-rail*`, `stage2-*`, `slot-empty`, `flow-track`); add only the missing ones from DESIGN.md.
- `frontend/eslint.config.mjs`: the module-boundary rule picks up `modules/launcher` automatically.
- `frontend/app/plans/[planId]/[step]/page.tsx`: the Move list step is a placeholder whose `h1` is "Move list".
- e2e:
  - `frontend/e2e/support/sample-plan.ts` `createSamplePlan(request, name)`;
  - `e2e/support/test.ts` `toasts(page)`;
  - `e2e/app-shell.spec.ts`: the toolbar assertions, which may need the new button;
  - `e2e/recommendations-page.spec.ts`: the run and apply-all assertions to mirror.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/launcher/index.ts`: the data lists and pure helpers above.
- `frontend/lib/copy/index.ts` and `frontend/modules/recommendations/recommendations-page.tsx`: move `NO_OPEN_TO_APPLY`.
- `frontend/components/common/confirm-dialog.tsx`: the `destructive` prop.
- `frontend/modules/launcher/launcher.tsx` (and helpers in `modules/launcher/` if needed): the button, shortcut, drawer, columns, band, search, keyboard and `inert` handling. It takes an optional `actions` prop, default `LAUNCHER_ACTIONS`.
- `frontend/components/common/app-shell/index.tsx`, `toolbar.tsx` and `frontend/app/layout.tsx`: the slot.
- `frontend/tests/launcher.test.tsx` (new, Vitest):
  - `launcherResults` grouping, order, case and keywords, plus blank → null;
  - `NO_MATCH`;
  - `stepState` for all four states;
  - `stepCountLines` for every step;
  - Apply all disabled reasons and confirm text;
  - Run label and keywords;
  - the launcher rendered with an extra test action in column REC lists it in the REC column and in search results, which proves registration needs no launcher change;
  - `ConfirmDialog` with `destructive={false}`.
- `frontend/e2e/launcher.spec.ts` (new, UJ-8, Chromium) on a sample plan:
  1. `uj8 ctrl+k opens the launcher and esc returns focus`: on Parts, focus the page search field and press `Control+k`. The dialog "Launcher" is visible, the search field (placeholder "Search features, actions and plans") is focused, `#content` has `inert`, eight step groups show, the current Parts column shows "You are here", and the counts show (`… parts`). CAT shows "Coming in stage 2" with `aria-disabled="true"`. `Esc` closes it, the grid button is focused, and `#content` has no `inert`.
  2. `uj8 types mov and opens the move list with the keyboard only`: `Control+k`, type "mov", the first option is highlighted, `Enter` → URL `/move-list`, heading "Move list".
  3. `uj8 types rec and opens recommendations`, plus "xyz" shows the no-match sentence.
  4. `uj8 tabs to the recommendations column and runs a round`: open from the grid button. `Tab` to the REC group, `↓` to "Run round 1", `Enter`. The URL is Recommendations, the round chip reads "Round 1", and a toast shows.
  5. `uj8 opens another saved plan`: create two plans, type part of the other's name, `Enter`. The URL is that plan.
- `frontend/e2e/app-shell.spec.ts` and others: update only if the new button breaks an assertion.

**Acceptance Criteria:**
- Given an open plan, when the planner presses the grid button or `Ctrl+K`/`⌘K` (also inside a text field), then the modal drawer opens with the page behind `inert` and focus in the search field. `Esc` closes it and returns focus to the grid button.
- Given the open drawer, when it renders, then it shows the eight step columns with name, state, live counts and actions, the current column marked "You are here", and the band with the open plan, other saved plans, SAV, NEW and SET, the inert CAT and LBL plates, and the Keyboard box.
- Given the drawer has focus, when the planner uses `Tab`, `↑`/`↓` and `Enter`, then focus moves between and within columns, and `Enter` opens the step or plan or runs the action.
- Given the planner types, when the text matches, then grouped results replace the columns with the first match highlighted, and `Enter` opens it. A non-match shows the no-match sentence.
- Given a new entry appended to `LAUNCHER_ACTIONS`, when the launcher renders, then it appears in its column and in search with no change to `modules/launcher`.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 28 findings — high 0, medium 1, low 23, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` (edge) Unmounting the launcher with the drawer open (Back/Forward to another plan or `/plans`) left the toolbar header `inert`, because `button.current` is null in the passive-effect cleanup. Fixed: the header is kept in `headerRef` and the cleanup clears `inert` through it.
  - `[low]` `[patch]` (edge) Non-Latin layouts never matched `key === "k"`. Fixed: `isLauncherShortcut` also matches `code === "KeyK"`; unit test with Cyrillic "л".
  - `[low]` `[patch]` (edge) Ctrl+Shift+K (Firefox web console) was hijacked. Fixed: the shortcut requires `!shiftKey`; unit test.
  - `[low]` `[patch]` (edge) Enter that commits an IME composition activated a result. Fixed: `onSearchKeyDown` returns on `isComposing`.
  - `[low]` `[patch]` (edge) Modified clicks and middle-clicks on launcher links were swallowed. Fixed: `preventAnd` keeps the browser default for them.
  - `[low]` `[patch]` (edge) Ctrl+K while another modal is open was ignored but not prevented, so the browser search bar took focus. Fixed: `preventDefault()` in that branch.
  - `[low]` `[reject]` (edge) The Apply all confirm uses the context captured at activation; a later saving state or count change is not re-checked. The confirm is modal, so no command can start in this tab while it is open; only another tab could change the count, and fixing it adds re-resolution logic.
  - `[low]` `[reject]` (edge) The drawer `top` is measured only on open, so a resize while open can offset it. Rare, and the fix needs a ResizeObserver.
  - `[low]` `[reject]` (blind) The launcher's Run skips the page's "Running…", tab reset and failed-run message. The spec chose to send the same command through the shared client (Design Notes); navigation goes to the Open tab, and a dropped command shows the global save notice.
  - `[false]` `[reject]` (blind) No feedback on dropped or busy. A dropped command shows the shared save notice (`components/common/app-shell/save-status.tsx`), and busy cannot happen because both actions are disabled while a command is pending.
  - `[low]` `[reject]` (blind) Stale confirm context. Same root cause as the edge row; same reason.
  - `[low]` `[patch]` (blind) Modifier clicks swallowed. Same root cause as the edge row; fixed there.
  - `[low]` `[patch]` (blind) The highlighted result was not scrolled into view. Fixed: an effect scrolls the option into view with `block: "nearest"`.
  - `[low]` `[reject]` (blind) `otherModalOpen()` misses non-modal radix menus and popovers (plate menu `modal={false}`, flow-bar popover, Apply all popover). They are non-modal and close when focus moves into the launcher; the saved-plans menu is off plan paths, where there is no launcher.
  - `[low]` `[patch]` (blind) The state strings "You are here" and "Done" were duplicated in the module. Fixed: they are exported from `lib/launcher` and `StepDisc` takes `StepStateText`.
  - `[low]` `[reject]` (blind) The Keyboard box does not say where each shortcut works. It matches the mockup's Keyboard box; copy only.
  - `[low]` `[reject]` (blind) The drawer position is not updated on resize. Duplicate of the edge row; same reason.
  - `[low]` `[patch]` (blind) Untested spec behaviours. Esc with a non-empty search field is now tested in e2e. The rest (click paths, Shift+Tab, band activation, ⌘K listener) are covered by the same code paths as tested keyboard routes or by unit tests; not worth more e2e time.
  - `[low]` `[reject]` (blind) The before-summary unit test is weak, and the Tab×6 e2e is brittle. Both pass and assert the AC outcome; hardening them adds test code for no found defect.
  - `[low]` `[reject]` (blind) A search for "saved" can show the SAV entry under Actions and plans under "Saved plans". The groups are the ones the AC names; rare and harmless.
  - `[false]` `[reject]` (blind) The heading structure skips levels. Radix `Dialog.Title` renders an `h2`, so the `h3` boxes sit under it.
  - `[low]` `[patch]` (verification-gap) Ctrl+K being ignored over the manual-move dialog (`aria-modal`) had no test. Fixed: new e2e "uj8 ctrl+k is ignored while the manual move dialog is open".
  - `[low]` `[patch]` (verification-gap) Enter on a disabled action from search had no test. Fixed: new e2e "uj8 a disabled action does not run from the keyboard".
  - `[low]` `[reject]` (intent) The launcher re-creates the Run and Apply all follow-up instead of calling the page. Reading C was chosen by the spec; the module isolation rule forbids importing the page.
  - `[low]` `[defer]` (intent) Retro item 41: the Apply all question promises undo before FR-35 ships, and the launcher confirm reuses that string. The wording is Justas's open decision (owner Justas); the launcher picks up any change through `applyAllQuestion`.
  - `[false]` `[reject]` (intent) Retro item 42's no-op Apply all toast is copied. Apply all is disabled in the launcher when nothing is open, so a no-op cannot start there.
  - `[false]` `[reject]` (intent) Undo and Reset have no step column. EXPERIENCE.md places Reset… and Undo last move in the launcher's Recommendations column, which `column: "recommendations"` covers.
  - `[low]` `[reject]` (intent) "Not done yet" is a fourth state line beyond the AC's three. An unchecked step that is neither current nor output needs a line; the spec chose this wording.

## Design Notes

- **Actions as data.** The launcher never imports the recommendations page. Run and Apply all go through the same command client and copy as the page, so the effect is the same: one command, the same toast wording, and the page refetches on the confirmed version. Apply all keeps its confirm (UX-DR16) through the generic `confirm` field, which Epic 7's Reset… reuses with `destructive: true`.
- **Inert, then focus.** `inert` on `#content` and the toolbar makes the background unreachable for every input. It must be removed before focus returns to the grid button, because the button sits inside the inert header. Do this in `onCloseAutoFocus` (`preventDefault`, drop `inert`, focus the button).

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm run lint:py && npm run lint:imports`: all pass.
- `npm test`: pytest and Vitest pass.
- `npm run e2e -- --project=chromium`: all pass, including `launcher.spec.ts`.

## Auto Run Result

Status: done

**Summary.** Inside a plan, the toolbar grid button or `Ctrl+K` / `⌘K` (also inside text fields) opens the launcher (UX-DR7, UX-DR8, UJ-8).
- **The drawer:** a modal flow map drawer with the page behind made `inert`, and focus in "Search features, actions and plans". `Esc` closes it and returns focus to the grid button.
- **Columns and band:** eight step columns with state, live counts from the plan summary and actions (Run round N, Apply all (N)…). A band holds the open plan, other saved plans, SAV/NEW/SET, the inert CAT and LBL plates and the Keyboard box.
- **Keyboard:** `Tab` moves between columns and `↑`/`↓` move within one. Typing gives grouped results (Steps / Actions / Saved plans) with the first one highlighted, and `Enter` opens it.
- **Extensibility:** actions, band entries and shortcuts are data in `lib/launcher`, so Epic 7 appends Undo and Reset to `LAUNCHER_ACTIONS` without touching the launcher.

**Files changed**
- `frontend/lib/launcher/index.ts` (new): the action registry, band, stage-2 and shortcut lists, plus the pure state, count, search and shortcut helpers.
- `frontend/modules/launcher/launcher.tsx` (new): the grid button, the shortcut, the drawer, the columns, the band, the search, the confirm and the `inert` handling.
- `frontend/components/common/app-shell/index.tsx`, `toolbar.tsx`, `frontend/app/layout.tsx`: the launcher slot, shown on plan paths only.
- `frontend/components/common/confirm-dialog.tsx`: the `destructive` prop (default true).
- `frontend/components/common/manual-move-dialog.tsx`: `aria-modal="true"`, so `Ctrl+K` is ignored while it is open.
- `frontend/lib/copy/index.ts`, `modules/recommendations/recommendations-page.tsx`, `tests/recommendations.test.tsx`: `NO_OPEN_TO_APPLY` moved to `lib/copy`.
- `frontend/tests/launcher.test.tsx` (new, Vitest), `frontend/e2e/launcher.spec.ts` (new, 9 UJ-8 tests).

**Review findings.** 28 findings: 1 medium, 23 low and 4 false.
- **Patched (10 root causes):** 1 medium (`inert` left on the header after an unmount) and 9 low (non-Latin K, Ctrl+Shift+K, IME Enter, modified clicks, `preventDefault` under another modal, scroll into view, shared state strings, and three new e2e checks).
- **Deferred (1):** retro item 41 wording, which is Justas's decision.
- **Rejected:** every other finding; each one and its reason is in the Review Triage Log.

**Follow-up review recommended: false.** Only one medium entry was patched and no high.

**Verification** (after the patches)
- `npm run lint:py`, `lint:imports` (5 contracts kept), `lint`, `typecheck` and `ruff format --check`: pass.
- `npm test`: pytest 578 passed, 12 skipped. Vitest 310 passed.
- `npm run gen:api`: no diff; there is no backend change, so no Postgres run was needed.
- `npm run e2e -- --project=chromium`: 74 passed.
  - An earlier full run had one failure in `delete-plan.spec.ts` (the focus row after a delete). It passed alone and in the next two full runs. It is the parallel-reorder race already logged in Story 6.4 (other specs edit plans while it runs).

**Residual risks**
- Firefox and Edge e2e were not run.
- While the drawer is open, the grid button is inert, so its pressed state shows only visually.
- Activation runs from `onCloseAutoFocus`. If radix ever skipped that callback, the activation would be lost.
- `delete-plan.spec.ts` can flake when parallel specs reorder the saved-plans list (retro item 37 territory).
- The Apply all confirm still promises undo (retro item 41, deferred).
