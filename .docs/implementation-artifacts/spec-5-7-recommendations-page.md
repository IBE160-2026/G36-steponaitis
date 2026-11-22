---
title: 'Story 5.7: Recommendations page'
type: 'feature'
created: '2026-11-22'
baseline_revision: '32ef1d65bcc00eb731dbf12121bc994c313f6050'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The run, apply, apply all, reasons and outdated status exist only on the wire (Stories 5.1–5.6); `/plans/{id}/recommendations` still shows the "not built yet" placeholder, so the planner cannot run, read or apply recommendations in the UI, and the mark toast's **View** link (`?tab=outdated`) lands nowhere (FR-23–FR-30, UX-DR8, UX-DR13, UX-DR31–35, UX-DR57).

**Approach:** Build the Recommendations step as a new frontend slice `modules/recommendations` (header, state tabs, rule-banded listbox, detail panel with Apply and Manual move…, Apply all confirm popover, empty/edge states), driven only by `GET /api/plans/{id}/recommendations` plus the plan summary as one version-consistent set. Extend the view rows with the display facts the rows need (description, class, picks, BEST of from/to) so the client never computes them (AD-3).

## Boundaries & Constraints

**Always:**
- **View additions** (`backend/swp/domain/recommendations.py`, same replay as today): `RecommendationRow` gains `description: str`, `movement_class: MovementClass | None`, `picks: int | None`, `from_best: bool`, `to_best: bool`; `NoSpaceRow` gains `description: str`, `movement_class`, `picks`, `from_location: str | None` (current location in the replayed copy) and `from_best: bool`. Class/picks from `analysis.parts`, description from `data.parts` (`""` if missing), BEST via kernel `is_best(replayed.copy, code, state.best_marks)`. No other view change; `npm run gen:api` regenerates `schema.ts`.
- **Route:** `frontend/app/plans/[planId]/recommendations/page.tsx` renders `RecommendationsPage`; the `[step]` placeholder then serves only Move list.
- **Data:** `usePlanRecommendations` (key `[...planRootKey, "recommendations"]`) in `lib/api/plans.ts`; the page renders `useConsistentPlanQueries([summary, recommendations])`. All commands via `usePlanCommands(planId).sendWithEvents`; every plan-changing button takes `disabledReason` while saving.
- **Header:** title "Recommendations", round chip "Round {run.round}" ("Round 0" without a run); with a run, the line "Run {YYYY-MM-DD HH:MM} by {created_by} · {n} recommendations · {m} no space" (n = all rows of the run, m = no-space entries, `formatNumber`, singular forms) and "The next run starts round {round+1} and uses the planning copy as it is then."; **Run recommendations** (secondary); **Apply all ({summary.apply_all_count})** (secondary), disabled at 0 with reason "No open recommendations to apply.", opening a Radix `Popover` with the question "Apply {n} recommendation(s) from round {r}? Undo reverses them one move at a time.", **Cancel** (focused first) and **Apply all**; confirm sends `apply_all` and on `apply_all_done` toasts "Applied {k} recommendation(s) from round {r}." plus " {s} skipped." when skipped is non-empty.
- **Run:** sends `run`; while in flight the button reads "Running…" with `disabledReason`, and the list area is `inert` and dimmed. On `confirmed`: tab Open is selected (URL `?tab=open`), focus moves to the first visible row, and a polite live region says "Recommendations, round {r}, {n} recommendations, {m} no space" (from `run_done`). On `dropped`: the page shows "The run stopped before it finished. Nothing changed: still round {r}. Run recommendations to try again." and refocuses the button. `busy` does nothing.
- **Tabs** (Radix `Tabs`, arrow keys move): Open · Applied · Outdated · No space; each trigger shows its count (incl. 0) and its accessible name is "Open, 13 recommendations" / "No space, 31 parts" (singular for 1). The tab comes from `?tab=` (`open|applied|outdated|no-space`, default `open`, parsed in `lib/view-state/urls.ts`); changing it replaces the URL. Empty tabs: "No open recommendations." / "No applied recommendations." / "No outdated recommendations." / "No “no space” parts in this run."
- **List:** per tab one `role="listbox"` (single-select, `aria-controls` = detail panel id, label "Recommendations") with one `role="group"` per rule in rule order 1, 2, 3 (no band for a rule without rows), labelled by its band: rule tag "Rule N", name and ordering note (rule 1 "Fast-moving parts into best locations" · "Most picks first · best locations in location-code order"; rule 2 "Slow-moving and dead parts out of best locations" · "Fewest picks first · locations in location-code order"; rule 3 "Pick groups into one aisle" · "Most shared jobs first · the part with fewer picks moves"). Rows keep server order. Open/Applied/Outdated show 5 rows per rule, then a button "Show {N} more under rule {X}". No space collapses each run of consecutive rows with the same rule and `noSpaceText(cause)` into its first row plus a button "{N} more like this" that expands in place. Options use a roving tabindex (one tab stop); ↑/↓/Home/End move and select, click selects; the key handler acts only when `event.target` is the option itself (retro item 15's lesson: never steal keys from buttons inside the list).
- **Rows:** number (recommendations), `BinSwatch` of the class, part over description, from → to codes as plain text with a "BEST" tag on a best target, picks right-aligned. Selected: tinted, ink outline, accent bar, `aria-selected`. Outdated: hatched, struck-through target, clock icon, "Outdated" and `outdatedText`. Applied: check icon and "Applied · move N, round R". No space: no number, a "NO SPACE" chip in the to-place and `noSpaceText`. Each option's accessible name includes number, part, from, to and its state words (e.g. "outdated", "no space" + cause).
- **Selection:** kept by id (rec id, or `nospace:{part}`) across tabs when visible, else the first visible row of the tab; none when the tab is empty.
- **Detail panel** (`id` referenced by `aria-controls`): eyebrow "SELECTED · #{n} · RULE {r}" ("SELECTED · NO SPACE · RULE {r}" for no-space), part and description, the reason from a new `reasonSegments` in `lib/copy` rendered with numbers in `<strong>`, the move line from → to with BEST tags. Actions: **Apply** (primary; disabled with `outdatedText` on outdated rows; disabled with the saving reason while saving) and **Manual move…** (tertiary, opens the shared `ManualMoveDialog` with `usePlanPart` detail; disabled "Loading the part…" until loaded, or `manualMoveReason`). Applied rows show "Applied · move N, round R" and no actions; no-space rows show the cause and only Manual move…. `Alt+A`/`⌥A` (`event.altKey && event.code === "KeyA"`) inside the list or detail region applies the selected open row, never when the target is an input, textarea, select or contenteditable.
- **Apply:** sends `apply {recommendation_id}`; on `move_made` toasts "Applied · move {move_number}, round {round} · {part} {from} → {to}" with no action (Undo is Epic 7). A 409 `command_rejected` already shows the server message through the client's `notify` and refetches; the page then shows the row in its new tab state.
- **Edge states:** `summary.best_locations === 0` → note "Rule 1 and rule 2 need best locations. Rule 3 runs without them." (Run stays enabled); no run → "No run yet. Run recommendations to start round 1 on the planning copy as it is now." instead of tabs; run with no rows and no no-space → "Round {r} found no recommendations and no “no space” parts. The rules have nothing more to suggest for these best-location marks."
- Wording of reasons, causes, apply/apply-all toasts lives in `lib/copy`; the module never imports another module. Layout: list and detail side by side at ≥1280px (`xl:grid-cols-[640px_minmax(0,1fr)]`), stacked below; no horizontal page scroll.
- Tests name their FR/UX-DR (`test_fr28_*`, `fr29_*`, `ux_dr33_*`). New e2e spec imports `test`/`expect` from `frontend/e2e/support/test.ts` and names UJ-1.
- Retro items: item 15 (DataTable Enter guard) — DataTable is not changed; the listbox follows the same guard. Item 26 — 5.2 handed over the Apply button, its toast, the 409 path and views refreshing after apply: all four are in the e2e. Name both in the Auto Run Result and commit message; leave statuses to the retro.

**Never:** No Kept in place tab, Keep in place, Other location ▾, Undo, Reset or "⋯" menu (Epic 7); no wall crops or "Show on the Locations wall" (Epic 10); no launcher. No change to rules, revalidate, apply/apply_all semantics or the command client. No client-side computing of status, BEST, class or order. Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`, action-item statuses, or anything under `.logs/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No run | fresh sample plan | "Round 0", no-run message, Run enabled, Apply all (0) disabled | No error expected |
| No marks | no best marks | best-locations note shown; Run enabled | No error expected |
| Run | marks aisle A, click Run | "Running…" then Open tab, focus on first row, live text "Recommendations, round 1, …" | dropped → failed-run message, button refocused |
| Apply | open row selected, Apply or Alt+A | toast "Applied · move N, round 1 · …"; row moves to Applied with "Applied · move N, round 1"; counts update | 409 → server message toast, views refetched |
| Outdated row | row outdated | Apply disabled, reason = cause sentence | No error expected |
| Apply all | n > 0, confirm | toast "Applied k recommendations from round r."; Apply all (0) disabled | Cancel sends nothing |
| Empty run | run with no rows/no-space | "Round r found no recommendations …" | No error expected |
| `?tab=outdated` | View link from the mark toast | Outdated tab selected | unknown tab → Open |

</intent-contract>

## Code Map

- `backend/swp/domain/recommendations.py:267-480` -- `RunMeta`, `RecommendationRow`, `NoSpaceRow`, `_no_space_row`, `build_recommendations_view` (one `replay`; add fields here). Kernel helpers `is_best`, `current_location` in `backend/swp/domain/planning.py:365,415`; `state.best_marks`; `analysis.parts[part].movement_class/.picks`; `data.parts[part]` = description.
- `backend/tests/app/test_recommendations_api.py`, `backend/tests/domain/test_*recommend*` -- extend with the new fields (answer key: 1100 → A-01-01-03 is `to_best` with aisle A marked).
- `frontend/lib/api/plans.ts` -- add `planRecommendationsKey`, `fetchPlanRecommendations`, `usePlanRecommendations`; types `RecommendationRow`, `NoSpaceRow`, `ApplyAllDoneEvent` exist.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- `frontend/lib/copy/index.ts` -- `reasonText`, `noSpaceText`, `outdatedText`, `CLASS_LABELS`; add `reasonSegments`, `appliedToast(move_made)`, `applyAllToast`, `applyAllQuestion`, `runAnnouncement`, `runLine`.
- `frontend/lib/view-state/urls.ts` -- `RecommendationsTab`, `recommendationsTabHref`; add `parseRecommendationsTab`; update the header comment.
- `frontend/lib/commands/react.tsx` -- `usePlanCommands`, `useConsistentPlanQueries`; `client.ts` `SendResult` (`confirmed|dropped|busy`), `reject` notifies 409 messages and refetches.
- `frontend/modules/best-locations/best-locations-page.tsx` -- page/view split pattern (`XPage` loads, `XView` renders, `PlanLoadError`/`PlanOpening`).
- `frontend/components/common/` -- `button.tsx` (`disabledReason`), `toast.tsx` (`showToast`), `manual-move-dialog.tsx` (`ManualMoveDialog{planId, detail, open, onOpenChange, returnFocusRef}`), `part-panel.tsx` (`manualMoveReason`, `MANUAL_MOVE_LABEL`), `bin-swatch.tsx`, `icons.tsx` (`clock`, `check`), `plan-status.tsx`. Radix via `import { Tabs, Popover } from "radix-ui"`.
- `frontend/components/common/data-table.tsx` -- read-only reference for the roving-tabindex pattern (retro item 15 concerns it; not changed).
- `frontend/app/plans/[planId]/[step]/page.tsx` -- placeholder; `frontend/e2e/plan-overview.spec.ts:203` uses Recommendations as the unbuilt step → switch to Move list. `frontend/e2e/support/warm-routes.ts` -- list comment/entries.
- `frontend/e2e/recommendations-outdated.spec.ts` -- after **View**, also assert the Outdated tab is selected and lists outdated rows. `frontend/e2e/apply-all.spec.ts`, `support/plan-api.ts`, `support/sample-plan.ts` -- command-API helper pattern.
- `frontend/tests/*.test.tsx` -- Vitest + Testing Library patterns (e.g. `best-locations.test.tsx`); fixtures typed from `lib/api/plans`.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/recommendations.py` -- add the row fields -- AD-3 (no client computing).
- `backend/tests/app/test_recommendations_api.py` (+ domain view test) -- `test_fr28_view_rows_carry_display_facts` (description, class, picks, `to_best`/`from_best`, no-space `from_location`).
- `frontend/lib/api/schema.ts`, `frontend/lib/api/plans.ts` -- regenerated types and the query hook.
- `frontend/lib/copy/index.ts`, `frontend/lib/view-state/urls.ts` -- copy helpers and tab parsing.
- `frontend/modules/recommendations/recommendations-page.tsx` (+ small helper files in the same folder if needed, e.g. `list.ts` for grouping/collapsing) -- the page.
- `frontend/app/plans/[planId]/recommendations/page.tsx` -- route.
- `frontend/tests/recommendations.test.tsx` (new), `frontend/tests/copy.test.ts` -- grouping (5 per rule, Show N more), no-space collapse, tab counts and names, tab parse, row states, selection by keys, Alt+A guard (ignored in an input), detail Apply disabled with cause, empty/edge messages, copy wording.
- `frontend/e2e/recommendations-page.spec.ts` (new) -- `uj1 runs, reads and applies recommendations`: sample plan, mark aisle A via API, open page → "Round 0" + no-run text; click Run → round chip "Round 1", Open tab selected, first option focused, ↓ selects the second and the detail eyebrow follows; select #1, press Apply → toast "Applied · move 1, round 1 · …" with no Undo, row appears in Applied tab with "Applied · move 1, round 1", Open count dropped by 1 (views refreshed); 409 path: apply the next open rec via the command API, then press Apply in the UI on it → server message "Recommendation #N is already applied." toast and the row shows as applied after refetch; Apply all (n) → popover question → Apply all → toast, Apply all (0) disabled, flow bar Recommendations done.
- `frontend/e2e/recommendations-outdated.spec.ts`, `frontend/e2e/plan-overview.spec.ts`, `frontend/e2e/support/warm-routes.ts` -- Outdated tab after View; placeholder test uses Move list.

**Acceptance Criteria:**
- Given `GET /api/plans/{id}/recommendations`, when it is called, then it returns the latest run's metadata, rows with status, number, reason data, applied move/round, the display facts above, and no-space entries in server order with `version`.
- Given the page, when a run, apply, 409 or apply all happens, then header, tab counts, rows and detail all come from the refetched, version-consistent views (no optimistic change).
- Given the repo, when `npm run lint:py`, `npm run lint:imports`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass and `npm run gen:api` leaves `schema.ts` unchanged after the commit.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 32 findings — high 0, medium 2, low 22, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` (intent) 409 for an outdated cause is not reached from the UI in e2e, only the already-applied 409 — the UI disables Apply on outdated rows (unit-tested), and every 409 takes the same command-client path (toast + refetch) that the already-applied e2e step drives.
  - `[low]` `[reject]` (intent) "views refreshing" is checked only on the recommendations page — the other views share the `['plan', id]` refetch the e2e exercises, and they load fresh on navigation; `views-follow-planning-copy.spec.ts` already pins that refetch after a move.
  - `[low]` `[patch]` (intent) keyboard behaviour (Alt+A, Show more) tested only as pure functions — grouped with the verification-gap rows; e2e steps added (Alt+A, Enter on Show more).
  - `[low]` `[patch]` (intent) retro item 15's guard in the listbox is not exercised — e2e now presses Enter on a focused "Show N more" button inside the listbox and asserts it expands.
  - `[false]` `[reject]` (intent) the GET contract is not re-verified — Story 5.5's view tests still run and pass (530 pytest), and the new fields have their own domain and API tests.
  - `[false]` `[reject]` (intent) failed-run copy tested with "still round 0" rather than 1 — same sentence format from `failedRunText`, which a unit test pins with round 1.
  - `[low]` `[patch]` (blind) `run()` leaves "Running…" stuck if `onSend` throws — wrapped in try/finally.
  - `[false]` `[reject]` (blind) `run()` handles only `confirmed`/`dropped` — `busy` doing nothing is the spec's rule; the client returns no other outcome.
  - `[medium]` `[patch]` (blind) focus after a run uses the pre-run version, so focus can land on an old row that then unmounts — focus requests now carry a minimum version and tab; a run waits for old version + 1 on Open.
  - `[medium]` `[patch]` (blind) focus after apply checked before the applied row unmounts (and the Apply button swaps element while saving), so focus falls to body — after a confirmed apply, focus is requested at old version + 1 when focus was on body or in the list/detail grid.
  - `[low]` `[patch]` (blind) "Show N more" / "N more like this" drop keyboard focus when they remove themselves — the first newly shown row is selected and focused.
  - `[low]` `[patch]` (blind) `expanded` is never reset between runs — cleared after a confirmed run.
  - `[low]` `[reject]` (blind) the listbox holds band headers and buttons — the story's AC asks for one listbox with rule bands and "Show N more" under each rule; the buttons stay tab-reachable and named. A grid or tree pattern is a design change; recorded as a residual risk.
  - `[low]` `[patch]` (blind) option names omit the from-location's BEST — " BEST" now follows a best from code (recommendation and no-space rows), with unit expectations. Description, class and picks stay out of the name on purpose (short names for scanning).
  - `[low]` `[patch]` (blind) Alt+A gates on `disabledReason` instead of `savingReason` — now uses `savingReason`, the same reason as the Apply button.
  - `[false]` `[reject]` (blind) page wording outside `lib/copy` — `lib/copy` is the place for wording server data (reasons, causes, events); page labels and rule band names live in the module as the spec says.
  - `[false]` `[reject]` (blind) schema.ts and the spec are not in the reviewed diff — left out on purpose: schema.ts is generated (`gen:api` leaves it unchanged) and the spec goes only to the edge-case layer.
  - `[low]` `[reject]` (blind) backend fallback branches (missing description/class, no current location) untested — unreachable from the rules: rule 1/2/3 skip parts without a current location and every listed part has analysis facts; the fallbacks are defensive.
  - `[low]` `[reject]` (blind) the saving-disables test only counts reason occurrences — test-strength suggestion; `disabledReason` wiring is shared `Button` behaviour covered elsewhere, and the e2e drives the real buttons.
  - `[false]` `[reject]` (blind) tab changes use `replaceState`, no history — the spec says changing the tab replaces the URL; `usePartPanel` uses the same pattern with Next's `useSearchParams`, and the e2e asserts the URL and tab follow.
  - `[low]` `[patch]` (blind) comments past wrap width and a placeholder comment that will go stale — rewrapped; the placeholder comment no longer names the remaining steps.
  - `[low]` `[patch]` (verification) Alt+A handler never driven — e2e step presses Alt+A on a focused option and asserts the toast and the Open count.
  - `[low]` `[patch]` (verification) Show-more / more-like-this click wiring untested — e2e step expands a rule with more than 5 rows by keyboard and asserts the option count grows.
  - `[low]` `[patch]` (verification) Manual move… in the detail never rendered by a test — e2e step opens it from a no-space row and checks the dialog name.
  - `[low]` `[reject]` (verification) a 4xx-rejected run shows the failed-run message — the run command has no 4xx rejection (no version check; `plan_not_found` redirects away; 503 is retried and then really failed).
  - `[low]` `[reject]` (verification) the no-space `from_location=None` branch is untested — same unreachable-fallback reason as the blind row.
  - `[low]` `[patch]` (edge) focus request dropped when a run starts from another tab — fixed by the minimum-version + tab request (grouped with the blind focus row).
  - `[low]` `[patch]` (edge) Alt+A from the portalled ManualMoveDialog bubbles into the region handler — the handler now returns unless `currentTarget.contains(target)`.
  - `[low]` `[reject]` (edge) dropped 4xx run shows the failed-run text — same as the verification row: unreachable for `run`.
  - `[false]` `[reject]` (edge) a row with status applied/outdated but null info shows an enabled Apply — `_status` always sets `applied` with "applied" and `outdated` with "outdated".
  - `[low]` `[patch]` (edge) expanded state not reset after a run — same root cause as the blind row; cleared after a confirmed run.
  - `[false]` `[reject]` (edge) Manual move… state from `usePlanPart` is outside the consistent set — the dialog's preview and the server check every move; the button only needs the part's current location, which the 5.x views keep consistent after refetch. No wrong command can be sent.

## Design Notes

- **Display facts on the wire.** Rows need class, picks, description and BEST of the target; joining the parts and locations views client-side would mean four consistent queries and client logic about "best". Adding them to the one view keeps AD-3 and the single replay.
- **One listbox with rule groups.** The AC asks for a single listbox; bands are `role="group"` labels inside it. The "Show N more" / "N more like this" buttons sit inside their group; the option key handler ignores events from anything but the option (the DataTable Enter bug of retro item 15).
- **No space collapse** groups only consecutive identical lines, so server order (AD-14) is never changed; the 5-row limit does not apply in that tab.
- **409** stays the command client's job (toast with the server message + refetch); the page adds nothing, so every command behaves alike.

## Verification

**Commands:**
- `npm run lint:py` and `uv run --directory backend --locked ruff format --check` -- expected: clean
- `npm run lint:imports` -- expected: every contract kept
- `npm run gen:api && git diff --exit-code -- frontend/lib/api/schema.ts` (after committing) -- expected: no diff
- `npm run typecheck` and `npm run lint` -- expected: clean
- `npm test` -- expected: pytest and Vitest pass
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://…` against a local `postgres:17` container -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass, including the new spec

## Auto Run Result

Status: done

**Summary:** The Recommendations step is built (FR-23–FR-30, UX-DR8, UX-DR13, UX-DR31–35, UX-DR57). The new slice `modules/recommendations` has:
- **Header:** round chip, run line, next-run line, Run recommendations ("Running…", list inert and dimmed, focus on the first row and a polite announcement after a run, failed-run message with the button refocused) and Apply all (n) with a confirm popover and toast.
- **Tabs:** Open · Applied · Outdated · No space, with counts in the names and `?tab=` in the URL.
- **List:** one listbox with rule groups, 5 rows per rule plus "Show N more", and "N more like this" for consecutive identical no-space lines.
- **Detail:** reason with bold numbers, from → to with BEST, Apply (Alt+A/⌥A, never from a text field) and Manual move… through the shared dialog.
- **Edge states:** no best locations, no run, empty run.

The backend view rows gained display facts (description, class, picks, BEST of from/to, a no-space part's current location), so the client computes nothing (AD-3).

Retro items:
- Item 15 (DataTable Enter guard): DataTable is unchanged. The listbox applies the same guard (option keys act only on the option itself), and the e2e presses Enter on a "Show N more" button inside the listbox.
- Item 26: the Apply button, its toast, the 409 path and the views refreshing after apply, handed over by Story 5.2, are all in `frontend/e2e/recommendations-page.spec.ts`.
- Statuses are left to the retro.

**Files changed:**
- `backend/swp/domain/recommendations.py` -- display facts on `RecommendationRow`/`NoSpaceRow`.
- `backend/tests/domain/test_recommendations.py`, `backend/tests/app/test_recommendations_api.py` -- `test_fr28_view_rows_carry_display_facts`.
- `frontend/lib/api/schema.ts` (regenerated), `frontend/lib/api/plans.ts` -- `usePlanRecommendations`.
- `frontend/lib/copy/index.ts` -- `reasonSegments`, apply/apply-all/run wording.
- `frontend/lib/view-state/urls.ts` -- `parseRecommendationsTab`.
- `frontend/modules/recommendations/list.ts`, `recommendations-page.tsx` (new) -- the page.
- `frontend/app/plans/[planId]/recommendations/page.tsx` (new), `[step]/page.tsx` (comment) -- route.
- `frontend/tests/recommendations.test.tsx` (new), `frontend/tests/copy.test.ts` -- unit tests.
- `frontend/e2e/recommendations-page.spec.ts` (new) -- `uj1 runs, reads and applies recommendations`.
- `frontend/e2e/recommendations-outdated.spec.ts`, `plan-overview.spec.ts`, `support/warm-routes.ts` -- Outdated tab after View; the placeholder test uses Move list.

**Review findings:** 32 findings: high 0, medium 2, low 22, false 8.
- Patched: 2 medium (focus after a run and after an apply landing on an unmounting row) and 14 low:
  - run try/finally;
  - focus on Show more;
  - expansions reset after a run;
  - from-BEST in option names;
  - Alt+A gated on the saving reason and ignoring portal events;
  - comments;
  - e2e steps for Alt+A, Enter on Show more, and Manual move… from the detail.
- Deferred: 0.
- Rejected: 8 low and 8 false, each with its reason in the triage log:
  - 8 low: outdated-cause 409 and other views not driven in e2e (same client path, covered elsewhere); the listbox containing buttons (mandated by the AC); unreachable fallbacks; test-strength suggestions; the 4xx run message being unreachable;
  - 8 false: wording location, `replaceState` per spec, schema/spec out of the diff on purpose, the server always pairing status and info, the GET contract already tested, failed-run copy, `busy` handling and the part query.

Before the review, the matrix test audit added two e2e steps (failed run with the button refocused, Apply all Cancel sends nothing). It also fixed the refocus, which was lost because a disabled `Button` is a different element.

**Follow-up review:** recommended (`true`). Two medium entries were patched: the focus handling after a run and after an apply, which now waits for a minimum version and tab. The unverified risk is focus after a re-run from round 1 to round 2 and after Apply by click. The e2e drives the first run and Alt+A, but not a second run or the focus target after a click-Apply.

**Verification (after the patches):**
- `npm run lint:py`: all checks passed.
- `ruff format --check`: 129 files formatted.
- `npm run lint:imports`: 5 contracts kept.
- `npm run typecheck` and `npm run lint`: clean.
- `npm test`: pytest 530 passed, Vitest 248 passed.
- `pytest tests/app --database-url postgresql+psycopg://…` on a temporary `postgres:17` container: 118 passed, 1 skipped (backend unchanged since).
- `npm run e2e -- --project=chromium`: 52 passed.
- `npm run gen:api`: checked after the commit.

**Residual risks:**
- The listbox contains band headers and "Show more" buttons, which ARIA does not allow inside a listbox. Screen readers may announce them poorly, although they are reachable with Tab.
- The 409 e2e relies on the page not refetching between the API-side apply and the click.
- Focus after a second run is not driven by a test.
