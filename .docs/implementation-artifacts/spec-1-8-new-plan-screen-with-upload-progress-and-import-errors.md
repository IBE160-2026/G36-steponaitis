---
title: 'Story 1.8: New Plan screen with upload progress and import errors'
type: 'feature'
created: '2026-11-21'
baseline_revision: '09c529202655e95477ceb2dc039b193773c93271'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 1.7 added `POST /api/plans` and `GET /api/session`, but there is no screen to call them: a planner cannot name a plan, choose the three exports, watch the upload, or see which file failed and why (FR-1, FR-3 to FR-7, UX-DR19, UX-DR20, AD-6).

**Approach:** Add the `modules/new-plan` slice behind a thin `/plans/new` route: a name field, three file tiles, one primary New Plan button, a browser size pre-check against `max_upload_bytes`, a two-stage progress line (XHR upload with Cancel, then one server step without Cancel), the import error panel with per-tile pass/fail marks, and on success navigation to `/plans/{id}/overview` with the toast. Shared pieces (API error parsing, session query, megabyte formatting, plan URL helper) go to `lib/`; a placeholder overview route exists only so the success navigation lands (Story 1.9 fills it).

## Boundaries & Constraints

**Always:**
- Route `frontend/app/plans/new/page.tsx` only renders the module's page component; all logic lives in `frontend/modules/new-plan/`, which imports only `@/components/*`, `@/lib/*` and `./`.
- Page: heading "New Plan"; a labelled name `Input` ("Plan name"); three file tiles in order Locations, Inventory, Transactions, each a labelled file input (accept `.xlsx,.csv`) showing the chosen file name and size; exactly one primary button "New Plan" (shared `Button`).
- Submit with a blank (trimmed) name sends nothing and shows `InputError` "Give the plan a name." linked to the field; a missing file sends nothing and shows "Choose the <Role> file." on that tile. Names need not be unique.
- Size pre-check: when the chosen files total more than `max_upload_bytes` (from `GET /api/session`; skipped until it loads), the page shows "These files are 5.2 MB together. One New Plan can upload at most 4 MB." (total rounded **up** to one decimal, limit to as many decimals as needed, both without a trailing `.0`; 1 MB = 1,000,000 bytes), and New Plan is disabled via `disabledReason` (same sentence) until a file is replaced.
- Upload uses one `XMLHttpRequest` `POST /api/plans` with `FormData` fields `name`, `locations`, `inventory`, `transactions`, wrapped in a TanStack Query `useMutation` with `retry: 0`. Stage 1 status line: "Uploading 3 files · 1.2 of 2.8 MB" (both one decimal, from `upload.onprogress`) with a "Cancel" button that aborts the request and returns the form to its previous state with files still chosen and no message. When the upload body is fully sent (`upload.onload`), stage 2: "Checking files and computing classes and pick groups…" with no Cancel. Status line is `role="status"` `aria-live="polite"`. While in flight New Plan is disabled with reason "The plan is being created." and file/name inputs are disabled; the request is never retried.
- Errors are read from the AD-11 envelope `{error:{code,message,details}}`; a non-envelope or network failure becomes `internal` "Something went wrong. Try again." The UI branches only on `code`:
  - `import_invalid`: a `role="alert"` panel (`error-tint` background, 1px `error` border, warning triangle) whose first line is bold "Import stopped: nothing was saved."; then per file with `status: "failed"`, its `errors[].message` in order (≤20, as sent) and, when `more_count > 0`, "and N more in this file" (N with thousands separators). The failing tile gets a red outline + warning triangle + "Failed. Choose a corrected file." and `aria-describedby` pointing at the panel; `passed` tiles show a check and "Passed"; `not_checked` tiles show "Not checked. Fix the other files first." Files stay chosen; choosing a new file for a tile clears that tile's mark (the panel stays until the next submit).
  - `validation_failed` with a detail `field: "name"` → the name `InputError` with the detail message; other `validation_failed`, `limit_reached`, `forbidden_origin`, `internal` → the same alert panel style with just the server `message` (no file list).
- Success (201): show the toast "<name> created. Data as of <data_as_of>." via `showToast`, then `router.push` to `planStepHref(id, "overview")` = `/plans/<id>/overview`, built only in `frontend/lib/view-state`.
- Every new test names its FR/NFR/UJ. Copy is sentence case, English, no exclamation marks.

**Never:**
- No backend change; no `GET /api/plans*`, plan plate, flow-bar links, overview content or `/` redirect (Story 1.9); no "reuse an import" option (FR-2, later).
- No `fetch`-based retry, no automatic re-submit; no column-mapping screen; no new npm dependency.
- A module never imports another module; no server component, route handler or server action calls the backend.
- Never read `data/private/`; never edit `data/sample/` or `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sample import | name "Demo", `data/sample/*.xlsx` | stage text shown, URL `/plans/<uuid>/overview`, toast "Demo created. Data as of 2026-09-30." | none |
| Blank name | name "  ", three files | "Give the plan a name." under the field, no request | — |
| Missing file | name, two files | "Choose the Transactions file." on that tile, no request | — |
| Too large | files totalling 5,200,000 B, limit 4,000,000 | "These files are 5.2 MB together. One New Plan can upload at most 4 MB.", New Plan aria-disabled, no request | replacing a file re-checks |
| Rounding | total 4,000,001 B | "4.1 MB" (rounded up), limit "4 MB"; limit 1,500,000 → "1.5 MB" | — |
| Import errors | Inventory CSV without Quantity | alert panel "Import stopped: nothing was saved." + Inventory's message; Inventory tile failed; Locations passed; Transactions passed | files stay chosen |
| More than 20 | `more_count: 37` | 20 lines then "and 37 more in this file" | — |
| Not checked | Locations failed, others `not_checked` | Locations failed tile, others "Not checked. Fix the other files first." | — |
| Row limit / other | 413 `limit_reached` message | alert panel with the server message | — |
| Name rejected by server | 422 `validation_failed` detail field `name` | InputError with the detail message | — |
| Non-envelope / network | 502 HTML or XHR error | panel "Something went wrong. Try again." | — |
| Cancel | Cancel during stage 1 | XHR aborted, status line gone, form re-enabled, files kept, no panel | nothing saved |

</intent-contract>

## Code Map

- `frontend/app/page.tsx`, `frontend/app/providers.tsx` -- route pattern (`"use client"`, TanStack Query); `QueryClient` defaults `retry: false`; `<Toaster />` lives in root providers so a toast survives `router.push`.
- `frontend/components/common/button.tsx` -- `Button` with `disabledReason` (aria-disabled, focusable, reason tooltip); `type="submit"` passes through.
- `frontend/components/common/input.tsx` -- `Input` (`errorId` → `aria-invalid` + border) and `InputError` (warning icon + sentence).
- `frontend/components/common/icons.tsx` -- `Icon` names `warning`, `check`, `close`, `plus`.
- `frontend/components/common/toast.tsx` -- `showToast(message)`.
- `frontend/lib/format/index.ts` -- `formatDate`, `formatNumber`; add megabyte formatting here.
- `frontend/lib/view-state/steps.ts` -- `StepKey`; add `planStepHref` beside it (AD-20: one helper builds plan URLs).
- `frontend/lib/api/schema.ts` -- generated; `components["schemas"]["CreatedPlan"]`, `["Session"]`, `["ErrorEnvelope"]`. Do not edit by hand.
- `frontend/app/globals.css` -- tokens `--color-error`, `--color-error-tint`, `--color-best-on-light`, type utilities (`type-page-title`, `type-body`, `type-caption`, `type-button`, `type-panel-title`), `px-page-gutter`.
- `backend/swp/domain/import_.py:28,77-90` -- `IMPORT_STOPPED`, `CellError{row,column,message}`, `FileCheck{file_role,file_name,status,errors,more_count}`; messages are final ("<file> · row N · column X: “v” …"), so the frontend shows `message` verbatim.
- `backend/swp/api/routers/plans.py` -- multipart fields `name`, `locations`, `inventory`, `transactions`; 201 `CreatedPlan`.
- `frontend/eslint.config.mjs` -- module-boundary rule (auto-applies to `modules/new-plan`).
- `frontend/vitest.config.mts` -- node environment (no DOM), `tests/**/*.test.{ts,tsx}`, TZ Europe/Oslo; component tests use `renderToStaticMarkup`.
- `frontend/playwright.config.ts` -- starts `npm run dev` with `backend/var/e2e.db`; `frontend/e2e/app-shell.spec.ts` shows the `uj1 …` naming and chromium-only skip.
- `data/sample/{Locations,Inventory,transactions}.xlsx` -- ~1.1 MB together; used read-only by the e2e test.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/api/errors.ts` -- `ApiError {status, code, message, details}`, `parseErrorBody(status, text)` (envelope → ApiError; anything else → `internal` "Something went wrong. Try again.") -- shared by every slice.
- `frontend/lib/api/session.ts` -- `useSession()` TanStack Query on `GET /api/session` typed from `schema.ts`.
- `frontend/lib/format/index.ts` -- `megabytesRoundedUp(bytes)` (one decimal, rounded up, no trailing `.0`: "5.2", "4.1", "4") and `megabytesOneDecimal(bytes)` (nearest, always one decimal: "1.2", "0.0") -- shared formatting.
- `frontend/lib/view-state/urls.ts` -- `planStepHref(planId, step)` → `/plans/${encodeURIComponent(id)}/${step}`.
- `frontend/modules/new-plan/selection.ts` -- pure logic: `ROLES`, role labels, `totalBytes`, `oversizeMessage(total, max)`, `validateForm(name, files)`, `tileStatesFrom(details)`, `importErrorGroups(details)` (failed files with lines and "and N more" text).
- `frontend/modules/new-plan/upload.ts` -- `uploadPlan(form, {onProgress, onServerStep, signal})` with XHR: resolves `CreatedPlan` on 201, rejects `ApiError` on other statuses/network, rejects an `AbortError`-marked error on Cancel.
- `frontend/modules/new-plan/file-tile.tsx`, `import-error-panel.tsx`, `new-plan-page.tsx` -- the UI described above.
- `frontend/app/plans/new/page.tsx` -- thin route rendering `NewPlanPage`.
- `frontend/app/plans/[planId]/overview/page.tsx` -- placeholder: heading "Overview" only (Story 1.9 replaces it).
- `frontend/tests/new-plan.test.tsx` -- `fr1_*` (validation, oversize message/rounding, success toast text), `fr3_fr4_*` (error groups, "and N more", tile states incl. not_checked), `fr1_upload_*` (fake XHR: progress text, server-step switch, abort, 201, envelope and non-envelope errors), `nfr10_*` (panel markup `role="alert"`, failing tile `aria-describedby`), plus `planStepHref` and megabyte formatting tests.
- `frontend/e2e/new-plan.spec.ts` -- chromium-only: `uj1 imports the sample files` (URL + toast), `uj1 shows import errors and keeps passed files` (in-memory CSV Inventory missing Quantity with valid CSV Locations/Transactions buffers or the sample xlsx for the other two; panel text, tile states, other two still chosen), `uj1 asks for a plan name`, `uj1 blocks files over the upload limit` (in-memory buffers totalling > 4 MB; message, aria-disabled button, no `/api/plans` request).

**Acceptance Criteria:**
- Given `/plans/new`, when it opens, then it shows the "Plan name" field, three tiles Locations, Inventory, Transactions, and exactly one primary button "New Plan".
- Given the sample files and a name, when New Plan is clicked in Chromium through the real Next.js rewrite, then the browser lands on `/plans/<uuid>/overview` and the toast "<name> created. Data as of 2026-09-30." is visible.
- Given an upload in flight, when the request is pending, then New Plan has `aria-disabled="true"` and exactly one `POST /api/plans` request is made per click.
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm run test:web`, `npm run lint:py`, `npm run lint:imports`, `npm run test:py` and `CI=true npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 39 findings — high 0, medium 5, low 24, false 10, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) Leaving the page mid-upload lets `onSuccess` toast and `router.push` the planner back — unmount cleanup now aborts the request and skips toast/navigation when unmounted.
  - `[low]` `[reject]` (blind) 201 body not validated before use — the only server is ours and always returns `CreatedPlan`; a guard covers an unreachable case.
  - `[medium]` `[patch]` (blind) Re-choosing the same corrected file fires no `change` — `FileTile` now clears the native input value after reading; e2e asserts tile file names instead of `input.files`.
  - `[low]` `[patch]` (blind) Stale name error after typing — the name `onChange` clears `errors.name`; the panel staying until the next submit is the spec's rule.
  - `[low]` `[reject]` (blind) Focus not moved to the first invalid field — errors are linked with `aria-describedby`/`aria-invalid`; focus management adds refs and effects for no spec rule.
  - `[low]` `[reject]` (blind) Oversize warning not announced — the button's `aria-describedby` carries the same reason; a second live region would also make `role="status"` ambiguous.
  - `[low]` `[reject]` (blind) Progress status floods screen readers — a ≤4 MB local upload emits few progress events; throttling adds state.
  - `[low]` `[reject]` (blind) Failed `/api/session` skips the pre-check silently — the server's 413 `limit_reached` still stops the upload and its message is shown.
  - `[low]` `[reject]` (blind) "Try again." after a server-step network failure may duplicate a plan — rare (local server); stage-specific wording adds a branch.
  - `[false]` `[reject]` (blind) No client check for file type or empty files — the server reports unreadable and empty files per tile ("can't be read as .xlsx or .csv", "has no data rows"), so the planner still gets a precise error.
  - `[low]` `[patch]` (blind) `isUploadCancelled` matches any `AbortError` — now `instanceof UploadCancelled`.
  - `[low]` `[patch]` (blind) Test gaps: page guard, sync `posts` check, `checkBytes` — the misleading sync `posts` assertion was removed (grouped with the verification-gap "other" row); page-level gaps grouped with the verification-gap rows; `checkBytes` range errors are unreachable from the UI.
  - `[low]` `[reject]` (blind) e2e relies on `data/sample/` and the 4 MB default — both are committed, specified fixtures (answer key 2026-09-30, `MAX_UPLOAD_BYTES` 4,000,000).
  - `[low]` `[reject]` (blind) `selection.ts` too broad; `ImportErrorGroup.fileName` unused — no named harm; each message already starts with the file name.
  - `[false]` `[reject]` (edge-case) `formatDate` throwing in `onSuccess` locks the form — the backend always returns a valid `YYYY-MM-DD` `data_as_of`.
  - `[low]` `[reject]` (edge-case) 201 body not a `CreatedPlan` — same as the blind row; unreachable.
  - `[low]` `[reject]` (edge-case) Cancel clicked before `controller` is set is ignored — Cancel renders only after the re-render that follows `mutate`, by which time `mutationFn` has run; moving the controller adds plumbing for a near-impossible race.
  - `[medium]` `[patch]` (edge-case) Unmount during upload hijacks navigation — grouped with the blind row; fixed there.
  - `[medium]` `[patch]` (edge-case) Same-path re-choose fires no change — grouped with the blind row; fixed there.
  - `[low]` `[reject]` (edge-case) Session failure skips the pre-check — same as the blind row.
  - `[false]` `[reject]` (edge-case) Non-integer `max_upload_bytes` crashes render — the backend field is a validated int.
  - `[false]` `[reject]` (edge-case) Duplicate `file_role` in details — the backend sends exactly one FileCheck per role.
  - `[false]` `[reject]` (edge-case) `import_invalid` with no failed file — `check_import` raises only when a file did not pass, and a `not_checked` file implies Locations failed.
  - `[false]` `[reject]` (edge-case) `more_count` coercion — the backend sends an int.
  - `[low]` `[reject]` (edge-case) Empty envelope message renders an empty panel — backend messages are final non-empty copy.
  - `[false]` `[reject]` (edge-case) Empty file name in FormData — browser `File`s from a file input always carry a name.
  - `[false]` `[reject]` (edge-case) Success status other than 201 — `POST /api/plans` is declared and tested as 201.
  - `[low]` `[reject]` (edge-case) `/api/session` 200 non-JSON throws a raw `SyntaxError` — the query error only disables the pre-check; unreachable with this backend.
  - `[low]` `[patch]` (verification-gap) Re-choosing a file after a rejected import not tested to clear the mark — e2e now re-chooses Inventory and asserts `data-state="none"`, Failed text gone, panel still visible.
  - `[low]` `[patch]` (verification-gap) Disabled inputs in flight not asserted — sample e2e asserts name and three file inputs disabled before release.
  - `[low]` `[patch]` (verification-gap) Cancel during the server step not caught — new e2e "uj1 offers no Cancel during the server step" with an XHR stub.
  - `[medium]` `[patch]` (verification-gap) Page-level handling of non-import errors untested (matrix rows) — new e2e tests for 413 `limit_reached`, 422 `validation_failed`/name (incl. clearing on typing) and 502 HTML.
  - `[low]` `[patch]` (verification-gap, other) Sync `posts` check after the forced click proves nothing — removed; the post-navigation count remains.
  - `[low]` `[reject]` (intent-alignment) Cancel "saves nothing" not verified server-side — an aborted XHR never delivers a complete multipart body, so the endpoint never runs; a server-side test would need a slow-network harness.
  - `[low]` `[reject]` (intent-alignment) Row-level error format and the 20 cap not exercised e2e — owned and tested by Stories 1.5/1.6 backend tests; the panel relays messages verbatim (unit-tested).
  - `[false]` `[reject]` (intent-alignment) e2e expects "5.3 MB" not "5.2 MB" — the e2e total is 5.25 MB, rounded up per the spec; the exact 5.2 sentence is unit-tested.
  - `[low]` `[patch]` (intent-alignment) Sample e2e status regex does not tell stages apart — grouped with the verification-gap Cancel row; fixed there.
  - `[low]` `[reject]` (intent-alignment) Red outline not asserted visually — `border-error` class is unit-tested and the state is also text + icon.
  - `[false]` `[reject]` (intent-alignment) One primary / non-unique names not tested — the e2e counts the single "New Plan" button; the frontend has no uniqueness check to test and the backend never enforced one.

## Design Notes

- XHR instead of `fetch`: only XHR exposes upload progress (`xhr.upload.onprogress`) and an upload-complete event, which the two-stage status needs; the mutation wrapper keeps TanStack Query as the only client path and `retry: 0` enforces AD-6.
- Cancel after the server step begins is not offered because the server may already be saving; aborting during the upload means the server never receives a complete multipart body, so nothing is saved.
- The overview placeholder is the smallest landing target; it keeps 1.8's e2e journey honest (real URL) without pulling 1.9's summary endpoint forward.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass.
- `npm run lint:py && npm run lint:imports && npm run test:py` -- expected: pass (no backend change).
- `CI=true npm run e2e -- --project=chromium` -- expected: all specs pass, including `frontend/e2e/new-plan.spec.ts`.

## Auto Run Result

Status: done

**Summary:** The New Plan screen is live at `/plans/new` (`modules/new-plan`). It has a "Plan name" field, three file tiles (Locations, Inventory, Transactions) and one primary New Plan button. A browser size pre-check against `max_upload_bytes` from `GET /api/session` disables submit with "These files are X MB together. One New Plan can upload at most 4 MB.". The upload is one XHR `POST /api/plans` inside a `useMutation` with `retry: 0`: stage 1 "Uploading 3 files · a of b MB" with Cancel, then stage 2 "Checking files and computing classes and pick groups…" without Cancel. `import_invalid` shows a `role="alert"` panel ("Import stopped: nothing was saved.", the server's lines, "and N more in this file") and marks tiles Failed / Passed / Not checked, keeping files chosen. Other codes show the server message; a server name error goes under the field. Success shows the toast "<name> created. Data as of <date>." and opens `/plans/<id>/overview` (placeholder until Story 1.9).

**Files changed:**
- `frontend/app/plans/new/page.tsx` -- thin route for the New Plan page.
- `frontend/app/plans/[planId]/overview/page.tsx` -- placeholder landing route (heading "Overview").
- `frontend/modules/new-plan/{new-plan-page,file-tile,import-error-panel}.tsx` -- the screen, tiles and error panel.
- `frontend/modules/new-plan/selection.ts` -- pure form logic, copy, error-view routing.
- `frontend/modules/new-plan/upload.ts` -- XHR upload with progress, server-step switch and Cancel.
- `frontend/lib/api/errors.ts`, `frontend/lib/api/session.ts` -- shared AD-11 envelope parsing and the session query.
- `frontend/lib/format/index.ts` -- megabyte formatters.
- `frontend/lib/view-state/urls.ts`, `steps.ts` -- `planStepHref` (AD-20).
- `frontend/tests/new-plan.test.tsx` -- unit tests (FR-1, FR-3/FR-4, NFR-10).
- `frontend/e2e/new-plan.spec.ts` -- UJ-1 Chromium journeys (sample import, import errors, name, oversize, cancel, server step, 413/422/502).

**Review:** 39 findings (high 0, medium 5, low 24, false 10, maybe-false 0). Patched: unmount abort + no redirect, same-file re-choose, name error clears on typing, `isUploadCancelled` via `instanceof`, e2e tests for re-choose clearing the mark, disabled inputs in flight, no Cancel in the server step, 413/422-name/502 handling, and removal of a meaningless sync assertion. Deferred: none. Rejected, with reasons in the Review Triage Log: unvalidated 201 body, focus management, oversize live region, progress announcement rate, session-failure notice, server-step failure wording, client file-type/empty checks (false), test fixture coupling, `selection.ts` size, unreachable backend-shape cases (false), Cancel/controller race, server-side cancel proof, row-level format e2e (owned by 1.5/1.6), visual outline, 5.3 vs 5.2 (false), primary/unique checks (false).

**Follow-up review recommendation:** true -- three medium entries were patched (patched counts: high 0, medium 3, low 6). Unverified risk: the unmount cleanup (abort + skip navigation, flag reset for Strict Mode double mount) has no test, and the same-path re-choose fix is covered only by re-choosing a different file in e2e, not the identical path.

**Verification (after patches):** `npm run lint` clean; `npm run typecheck` clean; `npm run test:web` 77 passed; `npm run lint:py` all checks passed; `npm run lint:imports` 4 kept, 0 broken; `npm run test:py` 186 passed (SQLite; Postgres in CI); `CI=true npm run e2e -- --project=chromium` 20 passed.

**Residual risks:** the real upload is fast locally, so stage 1 progress is only observed through the XHR stub; progress totals include multipart overhead, so "b MB" can be slightly above the file sum; the overview route is a placeholder until Story 1.9.
