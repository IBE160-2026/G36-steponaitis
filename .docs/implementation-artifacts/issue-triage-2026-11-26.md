# Issue triage — 2026-11-26

All 109 open items in `.logs/justas/issues.md` checked against the code at `163fa95`, plus specs, logs, git history and `sprint-status.yaml`. Read-only; no tests or browsers were run, so anything marked "unverified" is reasoned, not reproduced. "Line" = line number in `issues.md`.

Buckets: **STALE** (already fixed / no longer applies), **DECISION** (author's call), **BUG** (still in the code), **TESTGAP** (missing test, follow-up review not run, old flake), **HUMAN** (manual check), **POLISH** (minor UX/perf/a11y).

| Bucket | Count |
|---|---|
| STALE | 19 |
| DECISION | 24 |
| BUG | 11 |
| HUMAN | 12 |
| POLISH | 7 |
| TESTGAP | 36 |

## STALE — close (19)

| Line | Item | Evidence |
|---|---|---|
| 70 | Docker can't pull images; Postgres only in CI | Logs 880/881 ran tests on Postgres 17 in local Docker |
| 80 | Story 1.9 follow-up (Postgres risk) | CI on Postgres green many times; local Postgres run in log 880 |
| 109 | Reject manual_move if effect ≠ preview, or wait for FR-41 | FR-41 shipped (15.1): `app/commands.py:79` refuses stale `base_version`; AD-6. Close epic-4-retro-item-33 |
| 122 | Apply all copy promises a non-existent undo | Undo shipped in 7.3; `lib/copy/index.ts:205` now true. Close epic-5-retro-item-41 |
| 125 | 6.1 row menu checked only in Chromium | `saved-plans.spec.ts:82-97` passes in 3 browsers (log 880) |
| 129 | Flaky delete-plan focus test | Fixed in `6ee3f9e` (12.5), 345× repeat clean |
| 132 | Confirm seven earlier retro items | Verified in code (parse_plan_id, Try again, --no-access-log, enterOpensRow, lock_timeout, next_move_number); item 28 unverified. Set sprint items done |
| 145 | Enforce base_version before Epic 15 | Enforced (`app/commands.py:79`). Residual, unverified: an old move toast kept across a reset in the same tab could undo a reused move number 1. Close epic-7-retro-item-66 |
| 146 | Epic 7 retro bookkeeping, LAUNCHER_ACTIONS docs | LAUNCHER_ACTIONS documented in AGENTS.md (`041f288`); the rest is bookkeeping |
| 151 | Menu print shows older "Generated" time | Documented as designed in AD-17 |
| 155 | How M2 gate proves print in 3 browsers | AGENTS.md local 3-browser gate; ran at M2 (log 896). Close action item 73 |
| 165 | e2e never calls real POST /api/auth/demo | `e2e/production/demo-front-page.spec.ts` (9.7, `c4cf71b`) |
| 172 | FR-40 lock a hard guarantee? | 16.0 (`33e5e0f`) reserves under a row lock, tested on SQLite + Postgres. Close action item 76 |
| 175 | Epic 9 process items | e2e:production in AGENTS.md, real flags, 3-browser gates. Close action item 83 |
| 182 | Wall "Manual move…" moves only the top part | By design: UX-DR43, `epics.md:2148`; drag lets you pick parts |
| 200 | Vercel 4.5 MB gzipped or raw? | Duplicate of 239 |
| 205 | e2e steps for Epics 13–16 skipped | fr46/fr47/fr48/fr41 are real tests now; only uj5 deploy skip left (covered by 238/241) |
| 212 | Adapt uj1 fr46 after starter categories | Fixed in `46531e8` |
| 222 | Runbook: follow-up guard and human-AC rule | Both in AGENTS.md "Story workflow rules" (`041f288`) |

## DECISION — author's call (24)

Recommended answer first; most just need a line in the spine/epics and the item closed.

| Line | Question | Recommendation |
|---|---|---|
| 81 | Report unknown Transaction Types? `data_as_of` from kept rows only? | Keep both as built (ignore; all rows). Spine:95 already says so. Close action item 9 |
| 93 | Plan views load `transactions`, against AD-4 | Amend AD-4 to allow it (within NFR-8). Action item 16 |
| 94 | Process rule: test the user path when a fix changes reset timing | Close as n/a (no stories after Epic 16) |
| 95 | When to schedule the open Epic 1 action items | Close; this triage replaces it |
| 102 | `set_best_mark` reject marks that hit nothing (422)? | Yes, 422 (`domain/marks.py:14-22`, `views/summary.py:109`). Small build |
| 103 | Process rule: later spec lists inherited failure paths | Close as n/a |
| 105 | Confirm AD-11 `unavailable` 503 and `virtual_locations` in schema v2 | Confirm both; add a `virtual_locations` bullet to AD-4 |
| 115 | FR-26: may an earlier rule-3 partner be moved by a weaker group in the same run? | No: the partner stays put. Pin with a domain test, write in AD-7 (`domain/rules.py:160-167` probably already blocks it; unverified) |
| 119 | Allow `@testing-library/react` + `jsdom`? | No; static-markup tests and e2e cover DataTable |
| 121 | Applied recommendation whose part moves on: still applied? | Yes, show the effective move (spine:140). Add the view test |
| 123 | Rule-3 partner, Apply all carrying run_id, `kept` / no-op in AD-7 | FR-26 as in 115; Apply all does not carry run_id; record `kept` and no-op in AD-7 |
| 141 | Reset's "N moves" = effective moves? | Yes, keep |
| 142 | No-op reset emits no event | Accept (AD-6 no-op rule); amend the AC |
| 147 | Move list: A→B then B→C prints B→C first | Known limit in FR-38/AD-17; don't change the merge |
| 164 | Account/plan limits soft under concurrency | Accept a small overshoot; note in AD-18 |
| 174 | Write five as-built auth behaviours into AD-18 | Yes, one line each (covers 164). Action item 79 |
| 177 | Sparse-grid fallback for the wall layout | Keep; mark action item 90 decided |
| 191 | Custom best colour may get a lighter token than default #267A4B | Accept; still ≥4.5:1 |
| 197 | Key shows all six colour buttons or only drawn ones? | Always all six (as built); one sentence in UX-DR48 |
| 208 | CI on firefox/msedge? WallGrid 703 lines | Chromium-only CI (3 browsers run locally); waive the split |
| 231 | Before/after table marks best locations (FR-22)? | No; the column header is enough |
| 232 | Launcher Keyboard box: all shortcuts or four fixed? | Four fixed, as UX-DR7 says |
| 233 | Re-seed starter categories when both tables are empty? | Keep the re-seed; write it into AD-9 |
| 236 | 5+ concurrent correct logins can briefly lock | Accept; note in AD-18 |

## BUG — still in the code (11)

| Line | Bug | Sev. | Recommendation | Evidence |
|---|---|---|---|---|
| 138 | Undo toast names the move's old round, not the current one | low | DO if cheap | `lib/commands/undo.ts:62` → `lib/copy/index.ts:331` |
| 220 | Category picker doesn't mirror server `normalize_text` | low | DO (3-line helper) | `modules/categories/aisle-categories-tab.tsx:35-36` vs `domain/categories.py:60-68` |
| 85 | Zero transaction code as text "00"/"0.0" forms a job | low | DO (one-line fix) or waive | `domain/pick_groups.py:16,29` |
| 86 | One huge job makes pair counting quadratic | low | Consider a job-size cap for the public demo; otherwise waive | `pick_groups.py:41`; a crafted 25k-row file could do ~300M pairs |
| 163 | `login_attempts` rows with 1–4 failures never deleted, counted forever | low | Waive (needs a migration) | `store/models.py:61-66`, `domain/accounts.py:111` |
| 234 | Busy lock in `login_attempts.reserve` → 500 not 503 | low | Waive | `store/login_attempts.py:77-80` |
| 230 | Print may print a stale list if a command lands during refetch | low | Waive | `modules/move-list/move-list-page.tsx:56-71` (unverified race) |
| 90 | Part panel doesn't overlay below 1280 px (UX-DR58) | low | Waive (desktop demo) | `components/common/part-panel.tsx:209` |
| 84 | `0100` vs numeric `100` part numbers don't match | low | Waive; accepted in spine:163 | `import_.py:140-148` |
| 75 | Formula cell without cached value read as empty | low | Waive (rejected in 1.5 review) | `readers.py:105` |
| 76 | Text >1,000 chars / columns >100 cut silently | low | Waive (AD-8) | `readers.py:17-18,53,57` |

## HUMAN — manual checks (12)

| Line | Check |
|---|---|
| 238 / 62 | README Deploy 1–6; check `/` and `/api/health`; run keep-alive by hand (blocks the rest of 16.1) |
| 239 / 176 | Max-size import on the public URL; open the largest Locations wall; note gzipped vs raw 4.5 MB |
| 240 | Vercel build log: `excludeFiles`, frontend install |
| 241 | Set 16.1 to done after 238–240 are logged |
| 199 | Someone else runs the README flow before submission (SM-2) |
| 223 | Scan a Chrome-printed QR label with a phone (FR-48) |
| 150 + 153 | One multi-page Firefox print preview: ROUND band kept with its lines, header repeats, page numbers |
| 128 | After the demo, look in Vercel/Supabase logs for 503 / 55P03 lock timeouts |
| 88 | Optional: eye-check the Parts page against the mockups (or waive) |

## POLISH (7) — all recommended WAIVE

73 toolbar wraps at 1024–1100 px · 87 Parts page without virtualization · 98 plan creation ~20 s under parallel e2e load · 117 ARIA: headings/buttons inside a listbox on Recommendations · 160 held change lost on reload during re-login · 192 colour change in another tab needs a reload · 235 Alt+A/K/O silent while saving.

## TESTGAP (36) — recommended WAIVE as a batch

**Follow-up reviews never run** (`followup_review_recommended: true` in their specs; formally they block until run or waived): 64 (1.1), 77 (1.7), 79 (1.8), 111/113/116/120/124/133/134/137/143 (4.1, 4.4, 5.1, 5.7, 5.8, 6.1, 7.1, 7.2), 180/183/185/187/190 (10.3–10.6), 204 (12.5), 209 (13.1). Since then every gate has run the full e2e suite in three browsers (453 passed, 0 flaky, log 881). Recommendation: one explicit waiver, which unblocks under AGENTS.md.

**Old flakes, never seen again:** 108, 149, 193, 203.

**Missing tests, low risk:** 71, 72 (Story 1.4 toast/Esc/disabled button), 78 (origin guard through the real rewrite; one mutation on the public URL settles it), 104, 107, 127, 140 (undo of combined move / move back; the one worth doing if there is time), 152, 184, 186, 211, 218.

**Process bookkeeping:** 156.
