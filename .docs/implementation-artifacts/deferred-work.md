
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
