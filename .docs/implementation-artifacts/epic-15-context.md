# Epic 15 Context: Concurrent-edit warning

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Plans are shared, so two planners can have the same plan open at once. Today a command is applied on top of whatever the plan is now, and nobody is told. This epic adds a warning: when a planner's change is based on an older version of a plan that someone else has saved since, the change is held and the planner chooses to reload the plan and see the other changes, or to keep going so their change is added on top. A whole plan is never overwritten by an older copy. This covers the failure path of the "continue a saved plan" journey. The epic was first scheduled as "if time allows" and is now being built.

## Stories

- Story 15.1: Warn when someone else saved the plan

## Requirements & Constraints

- A user who changes a plan that someone else has saved since they opened it is warned. The warning says the plan has changed and offers to reload it.
- If the user continues, their change is applied to the plan as it is now, including the other user's changes. There is no whole-plan save, so "last save wins" does not apply even though older UX journey text still says it.
- A retried command that was already applied (same `command_id`) must return its stored result first and never trigger the warning.
- If the command no longer fits the newer state (for example its recommendation is now outdated), it fails with the normal `command_rejected` error and message, like any other command.
- Traceability: name tests with the requirement ID (`tests/api/test_fr41_*`, and an e2e test using two browser sessions). The e2e gate runs chromium, firefox and msedge with 0 failed, 0 flaky and 0 skipped.

## Technical Decisions

- **Single write path.** Plan changes go only through `POST /api/plans/{id}/commands` with body `{command_id, base_version, type, …}`, and the response is `{version, events[]}`. The service reads the plan, applies the command and revalidates, then saves with an optimistic `UPDATE … WHERE version = :read_version`, retrying up to 3 times. `base_version` is already recorded but not checked. This epic adds the check.
- **Check order on the server.** First the idempotency lookup (`recent_commands` by `command_id`), then the version check. If `base_version` is behind the current `version`, reject before applying anything.
- **New error code.** `plan_changed`, HTTP 409, with details `{current_version, last_edited_by, last_edited_at}`. Add it to the closed code list in `swp/api/errors.py` and to the error-contract table (AD-11) in the architecture spine in the same change. In the same change, replace the spine's Deferred note on FR-41 and the "`base_version` is recorded but not enforced" sentence in AD-6 so they describe the check that is now built. Error envelope: `{"error": {"code", "message", "details": []}}`. The `message` is final English copy with no date or time in it. The frontend branches only on `code`.
- **Plan row fields used.** `version`, `last_edited_by` (username as text) and `last_edited_at`. A no-op command does not bump `version` or `last_edited_*`.
- **Client command flow** (`frontend/lib/commands`, one command at a time per plan). `plan_changed` is a new case. Unlike the generic "other 4xx: drop the command" rule, the command is **kept** until the user chooses:
  - **Reload plan:** drop the command and refetch every `['plan', planId]` query.
  - **Keep going:** refetch the plan, then resend the same command with the new `base_version`.
- Views carry the plan `version` they were computed from, and the client renders a set of plan queries only when their versions agree. The frontend never computes plan state itself.
- Layers: `api > app > store > domain`. `swp.api` never imports `swp.store`. Domain errors are raised as `DomainError(code, message, details)` and turned into HTTP only in `swp/api`. API types are generated, with snake_case on the wire.

## UX & Interaction Patterns

- A modal dialog on any plan surface, with this exact copy: "Someone saved this plan after you opened it. Reload it to see their changes, or keep going and your change is added on top of theirs."
- Actions: **Reload plan** and **Keep going**. Default focus is on Reload plan, in the Cancel position. Use the shared ConfirmDialog: the modal stack is at most one deep and focus returns to the control that opened it.
- While the command is held, the standard "Saving the last change…" disabled state applies to the controls that change the plan.

## Cross-Story Dependencies

- Builds on work from earlier epics: the command service with idempotency and the `version` and `last_edited_*` fields, the client command flow and its error hooks, the shared ConfirmDialog, and login with the edited-by username.
- It must not change how the other error branches behave: retries for network errors and 5xx, `unauthenticated`, and `plan_not_found`.
