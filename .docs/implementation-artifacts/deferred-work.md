
- source_spec: `.docs/implementation-artifacts/spec-16-0-production-hardening-before-going-public.md`
  summary: A busy lock in the login-throttle write (`login_attempts.reserve`) surfaces as a 500 instead of `unavailable` (503), and since Story 16.0 every login goes through that write.
  evidence: ARCHITECTURE-SPINE.md:130 lists the login-throttle writes under `write_transaction` but only maps 55P03 to 503 for commands, New Plan, Delete and category writes; `reserve` has no `is_busy` mapping. Contention needs a lock held over 3 s (Postgres) or 5 s (SQLite), which the tiny transaction makes unlikely; a concurrent-login load test on Postgres would settle it.
  resolved: 2026-11-28 — `spec-epic-16-retro-fixes.md` (Epic 16 retro item 1): `login_attempts.reserve` and `clear` raise `LoginAttemptsBusy` on a busy lock and `auth.login` answers `unavailable` (503); `clear` now runs in `write_transaction`, so the 3 s `lock_timeout` applies there too.
- source_spec: `.docs/implementation-artifacts/spec-16-0-production-hardening-before-going-public.md`
  summary: The Recommendations page ignores Alt+A (and Alt+K, Alt+O) without feedback while a change is saving.
  evidence: `recommendations-page.tsx` `onRegionKeyDown` returns when `savingReason` is set; the e2e flake at `recommendations-page.spec.ts:25` (2/20 on baseline) was this. The test now waits for Apply to be enabled; the shortcut itself still gives no feedback.

- source_spec: `.docs/implementation-artifacts/spec-16-1-live-on-the-public-vercel-url.md`
  summary: Unverified (would be medium): the `api` service's `functions."swp/main.py".excludeFiles` in `vercel.json` may resolve against the repo root instead of the service root, so `backend/tests/` and `backend/var/` (local SQLite files) could be bundled into the Vercel function.
  evidence: Vercel's Services docs do not say what a service's `functions` key is relative to; the first Production build log (function bundle contents and size) settles it.
  resolved: 2026-11-28 — verified on the live Production deployment: the function's Output tree in the Vercel dashboard has no `tests/` or `var/` folder, so `excludeFiles` resolves against the service root.

- source_spec: `.docs/implementation-artifacts/spec-epic-16-retro-fixes.md`
  summary: `POST /api/auth/login` and `POST /api/auth/demo` can answer 503 `unavailable` since the Epic 16 retro fixes, but their routes do not declare 503, so the OpenAPI document and `frontend/lib/api/schema.ts` omit it.
  evidence: `backend/swp/api/routers/auth.py:67,91` list `error_responses(401, 403, 404, 422, 429)` and `(403, 404)`; every other busy-capable route lists 503. Adding it needs `npm run gen:api` (CI diffs `schema.ts`), which the spec's "no frontend source change" boundary excluded. Nothing user-visible depends on it: the forms show any error's message.
  resolved: 2026-11-28 — `spec-epic-16-retro-followups.md`: both routes list 503 in `error_responses(...)`, `frontend/lib/api/schema.ts` is regenerated with `npm run gen:api`, and `test_fr40_login_and_demo_routes_declare_503` checks the OpenAPI document.
- source_spec: none
  summary: Change the location labels (Story 14.1, FR-48) so the QR code gives the part number the plan puts in the location: one label per part, no label for an empty location.
  evidence: Split from the 2026-11-28 follow-up intent by Justas ("Two builds, then bookkeeping"); it is built as its own spec right after the Log in and deploy fixes.
  resolved: 2026-11-28 — `840f90e`, `spec-14-1-label-qr-gives-the-part-number.md`; the hand check of the new print waits for Justas.
- source_spec: none
  summary: Bookkeeping without code: reword the Story 16.1 criterion at `epics.md:2722` as built (Epic 16 retro item 7) and reconcile the 53 older open retro items in `sprint-status.yaml` against `issue-triage-2026-11-26.md` (retro item 8).
  evidence: Split from the 2026-11-28 follow-up intent by Justas; done by hand after the two builds.
  resolved: 2026-11-28 — `3216ab5`: the Story 16.1 criterion is reworded as built, and 17 of the 53 older items are set to `done` in `sprint-status.yaml` with evidence (35 stay open; the list is in the session log of 2026-11-28).
- source_spec: `.docs/implementation-artifacts/spec-epic-16-retro-followups.md`
  summary: Unverified until the push (would be medium): the `arn1` function region in `vercel.json` may not be honoured by Vercel on a `services` project, leaving the function in `iad1`.
  evidence: Vercel's docs do not say whether a top-level `regions` or a service function's `regions` applies with `services`; the JSON schema accepts both. After the push, `curl -s -o /dev/null -D - https://g36steponaitis.vercel.app/api/health | grep -i x-vercel-id` must show `arn1` as the second field, and the Keep-alive workflow now checks the same.
  resolved: 2026-11-28 — verified after the push of `3329131`: `/api/health` answers with `x-vercel-id: arn1::arn1::…`, and Keep-alive run 46168932492 is green (`pdx1::arn1::…` from the runner). `/api/health` takes 0.6–0.75 s (was 1.04 s) and `GET /api/plans` as `demo` 0.63–0.75 s (was 1.9 s).
- source_spec: `.docs/implementation-artifacts/spec-epic-16-retro-followups.md`
  summary: Create account answers 500, not 503, when the database lock is busy.
  evidence: `backend/swp/store/users.py:24-39` (`insert_user`) catches only `IntegrityError` and runs in `transaction()`, so a SQLite "database is locked" `OperationalError` is not mapped to `unavailable` the way Log in, Demo version and the seed are. Pre-existing; found by the review of the Log in follow-ups.
  resolved: 2026-11-28 — `spec-create-account-busy-lock-answers-503.md`: `insert_user` runs in `write_transaction` and raises `UsersBusy` on a busy lock, `auth.signup` answers `unavailable` (503), the route declares 503, and `test_fr39_real_write_lock_is_unavailable` holds a real lock.
- source_spec: `.docs/implementation-artifacts/spec-epic-16-retro-followups.md`
  summary: `epics.md:1995` (Story 9.7) still says "Demo version still works while `demo` is locked by the throttle", but since 2026-11-28 Log in as `demo` is not throttled while Demo version is on.
  evidence: The spec's boundary kept `epics.md` out of the build; the wording is corrected in the bookkeeping pass that follows the two builds (with `epics.md:2722`).
  resolved: 2026-11-28 — `3216ab5`: the Story 9.7 line now says a lock row left for `demo` blocks nothing and Log in as `demo` is not throttled while Demo version is on.
- source_spec: `.docs/implementation-artifacts/spec-14-1-label-qr-gives-the-part-number.md`
  summary: Label Print does not refetch before printing as the move list does (AD-17), so a save by another planner is on the labels only after the next refetch.
  evidence: `frontend/modules/labels/labels-page.tsx` disables Print while its query fetches or after a failed refetch, but calls `window.print()` on the cached data otherwise; `usePrintAfterRender` in `frontend/modules/move-list/move-list-page.tsx:76` is private to that module and would have to move to a common folder first.
