---
title: 'Story 15.1: Warn when someone else saved the plan'
type: 'feature'
created: '2026-11-24'
status: 'done'
baseline_revision: '772c5a97ec92f3d944f06c2de4a44925a85e4d85'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-15-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A command built on an older plan version is silently applied on top of changes another planner saved meanwhile, so the planner builds on a picture of the plan that is no longer true (FR-41).

**Approach:** The command service rejects a command whose `base_version` is behind the plan's `version` with a new error `plan_changed` (409) before applying it (after the idempotency lookup). The client keeps the command and asks in a dialog: **Reload plan** drops it and refetches; **Keep going** refetches and resends the same command (same `command_id`) with the new `base_version`, so it is applied on top of the current state.

## Boundaries & Constraints

**Always:**
- Check order in `_run`: stored result for a repeated `command_id` first, then the version check, then `apply`. The check runs inside the write lock on the version read there, so a lost race re-read also warns.
- Error: code `plan_changed`, HTTP 409, message `Someone saved this plan after you opened it.`, details `[{"current_version": int, "last_edited_by": str, "last_edited_at": ISO datetime}]` (AD-11 details are a list). Added to `STATUS_BY_CODE` and to the AD-11 table in the spine in the same change.
- `base_version` equal to or above `version` applies as before. A command applied after Keep going that no longer fits gets `command_rejected` like any other.
- Dialog copy exact: "Someone saved this plan after you opened it. Reload it to see their changes, or keep going and your change is added on top of theirs." Buttons **Reload plan** (cancel position, tertiary, default focus) and **Keep going** (primary, non-destructive). Escape or closing = Reload plan. While the dialog is open the plan's command stays `pending` ("Saving the last change…").
- Client `base_version` = max(highest cached `['plan', planId]` version, last version the client saw confirmed or reported for that plan), so a failed refetch after the client's own command never causes a false warning.
- Tests carry FR-41 in their names; the skipped `uj3 fr41 …` placeholder becomes a real passing Playwright test.

**Never:**
- No whole-plan overwrite, no merge UI, no polling or live notification of other edits.
- Do not change the behaviour of other error branches (transient retries, `unauthenticated`, `plan_not_found`, other 4xx, 500).
- No new command types, no migration, no new dependency.
- `lib/` never imports `components/`; `swp.api` never imports `swp.store`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current base | `base_version == version` | 200, applied, version+1 | No error |
| Stale base | `base_version < version` (B saved) | 409 `plan_changed`, details current_version/last_edited_by/last_edited_at; state, version, `last_edited_*` unchanged | Client shows dialog, keeps command |
| Retry of applied command | same `command_id`, stale base | stored result returned (200) | never warned |
| Keep going | resend same command_id with new base | applied on top of B's change | if no longer fits: `command_rejected` toast, drop, refetch |
| Reload plan / Escape | dialog dismissed | command dropped, all plan queries refetched, notice cleared | none |
| Warned again | another save between refetch and resend | dialog again | same flow |

</intent-contract>

## Code Map

- `backend/swp/app/commands.py` -- `_run` loop: insert version check after `_stored_result`; raise `DomainError("plan_changed", …)`.
- `backend/swp/store/plans.py:198-293` -- `LockedPlan` / `plan_for_update` select only id, version, state; add `last_edited_by`, `last_edited_at` to the select and dataclass.
- `backend/swp/api/errors.py:20` -- `STATUS_BY_CODE`: add `"plan_changed": 409`.
- `backend/swp/domain/commands.py` -- every command has `base_version: int`; no change.
- `backend/tests/app/*` -- many tests send hardcoded `base_version` (e.g. `"base_version": 1` for several sequential commands); fix failing ones by sending the plan's current version (helpers `_send` in `test_reuse_import.py:44` already read it; reuse that pattern), never by weakening the check.
- `backend/tests/api/test_api_errors.py` -- pattern for an own `client` fixture over `database_path`; `tests/app/test_who_edited.py` shows two-user setup with `FEATURE_AUTH`, `auth.signup`, `_login`, `plans.create`.
- `frontend/lib/commands/client.ts` -- `CommandClient.sendWithEvents` loop and `reject`; `baseVersion()`; add the `plan_changed` branch and the last-seen-version tracking.
- `frontend/lib/api/query-errors.ts` -- `QueryErrorEffects`; add optional `planChanged?: () => Promise<"reload" | "keep">` (absent → behave as reload).
- `frontend/app/providers.tsx` -- builds effects; wire `planChanged` to the dialog host and render the host.
- `frontend/components/common/confirm-dialog.tsx` -- Cancel label hardcoded; add optional `cancelLabel` and `onCancel` props (defaults unchanged).
- `frontend/lib/copy` -- home of UI copy constants (e.g. `RESET_TITLE`); add the plan-changed title/text/labels.
- `frontend/tests/commands.test.tsx` -- unit tests of the command client; extend with fr41 cases.
- `frontend/e2e/user-journeys.spec.ts:1422` -- skipped placeholder `uj3 fr41 …` to replace.
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md` -- AD-6 Service sentence (line ~130), AD-11 table (~211), AD-12 rules (~226), Deferred FR-41 bullet (~477) and Stage 2 bullet's "Story 15.1 (…)" tail (~478).
- `.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/EXPERIENCE.md:409` -- UJ-3 failure path still says "the last save wins".

## Tasks & Acceptance

**Execution:**
- `backend/swp/store/plans.py` -- add `last_edited_by`, `last_edited_at` to `LockedPlan` and its select -- the error details need them under the lock.
- `backend/swp/api/errors.py` -- add `plan_changed: 409` -- closed code list (AD-11).
- `backend/swp/app/commands.py` -- version check after the stored-result lookup; update module docstring -- FR-41.
- `backend/tests/api/test_fr41_plan_changed.py` -- new: stale base → 409 envelope with details and nothing saved; current base applies; repeated `command_id` with stale base returns stored result; Keep-going resend with new base applies on top of the other user's change (two logged-in users, `last_edited_by` in details); resend whose recommendation went outdated → `command_rejected`.
- `backend/tests/app/*` -- update tests broken by enforcement to send the current version.
- `frontend/components/common/confirm-dialog.tsx` -- optional `cancelLabel`, `onCancel`.
- `frontend/lib/copy/*` -- plan-changed copy constants.
- `frontend/lib/api/query-errors.ts` -- optional `planChanged` effect.
- `frontend/lib/commands/client.ts` -- `plan_changed`: await `effects.planChanged`; reload → drop + refetch + `dropped`; keep → refetch, rebuild `base_version` as max(details.current_version, baseVersion), resend same `command_id`, continue the loop. Track last seen version per plan (confirmed result and `current_version`) and use it in `base_version`.
- `frontend/components/common/plan-changed-dialog.tsx` -- new host component + promise-returning `askPlanChanged()` (module-level, like toast), built on `ConfirmDialog`.
- `frontend/app/providers.tsx` -- wire effect and render host.
- `frontend/tests/commands.test.tsx` (and a dialog test) -- `fr41_` cases: reload drops and refetches; keep resends same id with new base; second warning; no effect → reload; dialog copy, button order and default focus.
- `frontend/e2e/user-journeys.spec.ts` -- replace skip with `uj3 fr41 …` test: two browser contexts on one plan; B changes plan via UI, A changes it → dialog; Keep going adds A's change after B's; then a second round where Reload plan shows B's change without A's.
- `ARCHITECTURE-SPINE.md` -- AD-6 sentence describes enforcement; AD-11 row `plan_changed | 409 | details: [{current_version, last_edited_by, last_edited_at}]`; AD-12 bullet for `plan_changed`; Deferred FR-41 bullet removed/replaced by "built in Story 15.1"; Stage 2 tail sentence updated.
- `EXPERIENCE.md:409` -- "and the last save wins" → "and a continued change is added on top of theirs".

**Acceptance Criteria:**
- Given two sessions on one plan, when B saves a change and A then changes the plan in the UI, then A sees the dialog with the exact copy, focus on Reload plan.
- Given the dialog, when A clicks Keep going, then A's change appears after B's and both are visible; when A clicks Reload plan instead, then B's change is visible and A's is not.
- Given `npm run trace`, then FR-41 lists the new tests.
- Given `npm run e2e`, then chromium, firefox and msedge pass with 0 failed, 0 flaky, 0 skipped for this story's test.

## Spec Change Log

## Review Triage Log

### 2026-11-24 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 17, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) Escape/overlay close of the plan-changed dialog never tested — added a third round to `uj3 fr41` that presses Escape and checks dialog gone, A's change not saved, no "Saving the last change…", version only B's; passes 6/6 (3 browsers, repeat-each=2).
  - `[low]` `[reject]` (intent) "Someone else" is version-based, same account in another tab is warned too — the story AC defines the check as `base_version` behind `version`; distinguishing users adds branches for a rare case.
  - `[low]` `[reject]` (intent) FR-10 lost-race path now ends in `plan_changed` — inherent to the AC (check on the version read under the lock); AD-6 and the docstring already say a lost race is refused.
  - `[low]` `[reject]` (intent) `details` is a one-element list, not an object — AD-11 fixes `details` as a list; spine row documents it.
  - `[false]` `[reject]` (intent) dialog checks only in unit tree / e2e — the AC surfaces (dialog copy, focus, Keep going, Reload) are all asserted in the real-browser `uj3 fr41` test.
  - `[low]` `[reject]` (intent) a refetch between B's save and A's change means no warning — A then already sees B's change; the AC is "base_version behind".
  - `[false]` `[reject]` (intent) EXPERIENCE/spine/traceability changes — consistent with PRD 2026-11-16 decision; no divergence.
  - `[low]` `[reject]` (blind) stale no-op gets the dialog — the AC says the stale command is rejected before it is applied; harmless (Keep going then no-ops).
  - `[low]` `[reject]` (blind) dialog does not name who saved — the AC fixes the exact copy.
  - `[low]` `[reject]` (blind) retry wording in docstring/AD-6 — same root as the FR-10 row; text already states a lost race is refused.
  - `[low]` `[reject]` (blind) host second-ask/unmount/Radix click order untested — Keep going order is exercised by e2e; the rest are unreachable in normal use and need a DOM test setup the repo lacks.
  - `[low]` `[reject]` (blind) global host vs several plans — the modal blocks the UI, so a second plan's command cannot start while it is open.
  - `[medium]` `[patch]` (blind) Escape not tested — same root as the verification-gap row; fixed by the same e2e round.
  - `[low]` `[reject]` (blind) no test for `base_version` above `version` — client never sends one above the highest seen; adding it buys little.
  - `[false]` `[reject]` (blind) other e2e specs may now hit the dialog — full `npm run e2e`: 438 passed, 0 failed, 0 flaky, only the Epic 16 placeholder skipped.
  - `[low]` `[reject]` (blind) `planChanged` on `QueryErrorEffects`, choice type repeated — cosmetic; the effects object is shared by design.
  - `[low]` `[reject]` (blind) copy repeated in tests — intentional: tests pin the exact mandated copy.
  - `[low]` `[reject]` (blind) Reload drops silently — spec says notice cleared; the refetched plan is what the planner chose to see.
  - `[false]` `[reject]` (blind) story docs missing from the diff — they were excluded from the review diff on purpose and are committed with the change.
  - `[low]` `[reject]` (blind) concurrency test does not pin which thread's mark is saved — minor; the version and count assertions catch double-apply.
  - `[low]` `[reject]` (edge) stale no-op 409 instead of 200 — same as the blind no-op row.
  - `[false]` `[reject]` (edge) `base_version` above `version` should be refused — the spec says equal or above applies as before.
  - `[false]` `[reject]` (edge) missing `current_version` causes endless dialog — the server always sends it, and each resend needs a user click.
  - `[false]` `[reject]` (edge) `baseFor` throws on the Keep going rebuild — it only reads the query cache and a Map; no throwing path shown.
  - `[low]` `[reject]` (edge) second plan's ask resolves the first as reload — same as the blind global-host row.

## Design Notes

The dialog title is not given by the story; use "This plan has changed" (the body copy carries the meaning). The command stays `pending` while the dialog is open so other plan-changing controls stay disabled; one dialog at a time follows from one command at a time per plan. `details` is a one-element list because AD-11 fixes `details: []`.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean
- `npm run lint && npm run typecheck` -- expected: clean
- `npm test` -- expected: all pass
- `npm run trace` -- expected: FR-41 covered
- `npm run e2e` -- expected: 0 failed, 0 flaky; only the unrelated Epic 16 placeholder skipped

## Auto Run Result

Status: done

**Summary:** FR-41 is built. The command service refuses a command whose `base_version` is behind the plan's `version` with `plan_changed` (409, details `[{current_version, last_edited_by, last_edited_at}]`), after the repeated-`command_id` lookup and before apply. The client holds the command and shows a dialog: Reload plan drops it and refetches; Keep going refetches and resends the same `command_id` with the new `base_version`. The skipped `uj3 fr41` placeholder is now a real passing Playwright test.

**Files changed:**
- `backend/swp/app/commands.py` -- version check and `plan_changed` error.
- `backend/swp/store/plans.py` -- `LockedPlan` carries `last_edited_by` / `last_edited_at`.
- `backend/swp/api/errors.py` -- `plan_changed: 409`.
- `backend/tests/api/test_fr41_plan_changed.py` -- new API tests (two users).
- `backend/tests/app/test_commands.py` -- send current versions; old stale-applies tests rewritten for FR-41.
- `frontend/lib/commands/client.ts` -- `plan_changed` branch, last-seen version tracking.
- `frontend/lib/api/query-errors.ts` -- optional `planChanged` effect.
- `frontend/components/common/plan-changed-dialog.tsx` -- new dialog host and `askPlanChanged()`.
- `frontend/components/common/confirm-dialog.tsx` -- optional `cancelLabel` / `onCancel`.
- `frontend/lib/copy/index.ts` -- dialog copy.
- `frontend/app/providers.tsx` -- wires effect and host.
- `frontend/tests/commands.test.tsx`, `frontend/tests/plan-changed-dialog.test.tsx` -- fr41 unit tests.
- `frontend/e2e/user-journeys.spec.ts` -- `uj3 fr41` journey (Keep going, Reload plan, Escape rounds).
- `frontend/e2e/recommendations-page.spec.ts` -- clicks Keep going before the expected `command_rejected`.
- `scripts/traceability.py` -- FR-41 listed (not gated).
- `ARCHITECTURE-SPINE.md` -- AD-6, AD-11 row, AD-12 bullet, Deferred note.
- `EXPERIENCE.md` -- UJ-3 failure path wording.

**Review:** 25 findings; 1 patch entry (medium: Escape round in `uj3 fr41`), 0 deferred, all others rejected with reasons in the triage log. Patched counts: high 0, medium 1, low 0.

**Follow-up review recommended:** false (one medium patched, no high).

**Verification:**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports`, `npm run lint`, `npm run typecheck` -- clean.
- `npm test` -- pytest 1145 passed, 2 skipped; Vitest 763 passed.
- `npm run trace` -- OK; FR-41 lists 22 tests.
- `npm run e2e` (chromium, firefox, msedge) -- 438 passed, 0 failed, 0 flaky, 3 skipped (the Epic 16 placeholder only).
- After the review patch: `npm run e2e -- -g "uj3 fr41" --repeat-each=2` -- 6 passed.

**Residual risks:** the same account in two tabs also sees the "Someone saved" dialog (check is version-based); the dialog host's open/close logic is covered only by e2e.
