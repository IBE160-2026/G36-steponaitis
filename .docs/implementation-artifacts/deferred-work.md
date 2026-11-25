
- source_spec: `.docs/implementation-artifacts/spec-16-0-production-hardening-before-going-public.md`
  summary: A busy lock in the login-throttle write (`login_attempts.reserve`) surfaces as a 500 instead of `unavailable` (503), and since Story 16.0 every login goes through that write.
  evidence: ARCHITECTURE-SPINE.md:130 lists the login-throttle writes under `write_transaction` but only maps 55P03 to 503 for commands, New Plan, Delete and category writes; `reserve` has no `is_busy` mapping. Contention needs a lock held over 3 s (Postgres) or 5 s (SQLite), which the tiny transaction makes unlikely; a concurrent-login load test on Postgres would settle it.
- source_spec: `.docs/implementation-artifacts/spec-16-0-production-hardening-before-going-public.md`
  summary: The Recommendations page ignores Alt+A (and Alt+K, Alt+O) without feedback while a change is saving.
  evidence: `recommendations-page.tsx` `onRegionKeyDown` returns when `savingReason` is set; the e2e flake at `recommendations-page.spec.ts:25` (2/20 on baseline) was this. The test now waits for Apply to be enabled; the shortcut itself still gives no feedback.
