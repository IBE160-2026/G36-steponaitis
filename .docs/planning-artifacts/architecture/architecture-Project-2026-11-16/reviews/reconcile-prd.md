---
title: 'Reconcile: ARCHITECTURE-SPINE.md against prd.md'
reviewed: .docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md
source: .docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md
date: 2026-11-16
---

# Reconcile: architecture spine against the PRD

**Verdict.** The spine lands almost all of the PRD, including the quiet parts: FR-9's undo history, run times/users and swap membership (AD-4, AD-5, AD-16), FR-12 deleting the import with the last plan (AD-4), FR-36 (frozen import plus replay), the settings snapshot (Config convention), view state kept in the browser, milestone 1 using the same data model, and `planner` in milestone 1 (AD-10). One requirement has no architectural home: FR-31's "was empty when the run was made". Several medium gaps would let two stories built separately diverge. None of the findings needs FR detail restated. Each asks for one owning rule.

Findings are ordered by severity. Each has: PRD reference, what is missing or contradicted, and a suggested fix.

## High

### R-1. FR-31 "must have been empty when the run was made" has no stored source

- **PRD:** FR-31 (the other location "must have been empty when the run was made"); FR-9 (reopen identical).
- **Gap:** AD-4 says a run stores its round, created at/by, recommendations and "no space" entries. Nothing records which locations were empty at run time. The state can't be rebuilt either. Steps have no timestamp, and manual moves after a run share its round number. So `replay` cannot tell which steps already existed when the run was made. An `apply_other_location` story will either drop the run-time condition and check only "empty now", or invent its own snapshot.
- **Fix:** In AD-4/AD-5, have each run store the step-log boundary at run time (`next_move_number` when the run was made). Then "empty at run time" = `replay(import, steps with move_number < boundary)`, which is valid because any undo since the run outdates every open recommendation (AD-7). The alternative is to store the run's empty-location set. Name the rule in AD-7 so the `apply_other_location` validation and the "Other location ▾" options list use the same source.

## Medium

### R-2. FR-2 must recompute the analysis, but the spine only describes computing it on upload

- **PRD:** FR-2 ("computed with the current settings"); FR-18; A-13.
- **Gap:** AD-4 says `analysis` is "computed once at creation", and AD-8 describes the one creation transaction only for uploaded files. Nothing stops an FR-2 story from copying the source plan's `analysis` row, which is wrong once `analysis.toml` has changed. Copying it also hides a bug if the store never loads `transactions` again.
- **Fix:** Add to AD-4: a plan created from an existing import recomputes `analysis` from the stored import (`transactions` included) with the current `analysis.toml`, and never copies another plan's `analysis` or `state`. Both creation paths call one `app/plans.create(import, settings)` function.

### R-3. Data-as-of date and period: one definition, computed once, stored

- **PRD:** Glossary "Data-as-of date", "Period"; FR-7; FR-16; FR-18 (shows period start and end).
- **Gap:** AD-4 puts the data-as-of date on the import row, but doesn't say how it is computed or that classification must use the stored value. The import story could take max(Date) over all rows (Issue Part and ignored types included, as the glossary says "newest transaction date in the Transactions file"). The classify story could instead take max over Move to Repair lines, or over in-period lines, and the two would give different periods. Period start and end are shown (FR-18) but are not listed in `analysis`, so the overview could recompute them in the frontend.
- **Fix:** In AD-8/AD-4, state: data-as-of = max date over every data row of the Transactions file (all types, time ignored), computed once in `domain.import_` and stored on the import. `domain.classify` takes it as an argument. `analysis` stores the computed period start and end next to the settings snapshot.

### R-4. Readers of the settings snapshot, and who owns the reason text

- **PRD:** FR-18 ("reopens with identical results even if the settings change later"); FR-28 (reason with threshold, e.g. "(24 or more)", "(5 or more)").
- **Gap:** The Config convention says settings are copied into the plan, but doesn't say that everything later must read them from there. Recommendation reasons, "no space" reasons, the part panel's "picks and threshold" and the plan overview all show thresholds. One story might format them from `analysis.toml`, or from frontend constants. It is also open whether the reason sentence (EXPERIENCE.md shows full sentences) is built by the backend (AD-11 says "backend messages are final copy", but only for errors) or by the frontend from structured fields.
- **Fix:** Add one line: every value derived from settings after creation (thresholds in reasons, period, class limits) comes from `plan.analysis`, and `analysis.toml` is read only by plan creation. Also decide who owns the reason text. Suggestion: the domain returns structured reason fields plus the threshold from the snapshot, and the copy is built in one place, either backend `domain/reasons.py` or one frontend formatter, never per screen.

### R-5. FR-23 "a run replaces earlier recommendations": what a run deletes is unstated

- **PRD:** FR-23 ("replaces all recommendations and 'no space' parts from earlier runs that were not applied"); FR-30 ("Apply all ... of the latest run"); FR-9.
- **Gap:** AD-4 keeps a list of runs, each with its recommendations. AD-7 says `outdated` is sticky "until the next run". The spine never says what a run does to earlier runs' recommendations. Options include deleting the non-applied ones, keeping them as outdated, or keeping them open and applicable. The recommendations tabs (Open/Outdated/No space), Apply all and the reopen test could each take a different reading.
- **Fix:** In AD-7, state: `run` removes every non-applied recommendation (open or outdated) and every "no space" entry from earlier runs. It keeps applied recommendations and the run's metadata, because steps and FR-9 refer to them. Only the latest run's `open` recommendations can be applied.

### R-6. NFR-4: the git-ignore list doesn't cover everything the spine stores locally

- **PRD:** NFR-4 ("The database, uploaded files and real exports ... are git-ignored and never committed").
- **Gap:** The spine puts the DB at `var/swp.db` and says it is git-ignored. The current `.gitignore` ignores `*.db`, which does not match SQLite's `swp.db-wal`, `swp.db-shm` or `swp.db-journal`. Those files hold plan and import rows, and `var/` itself is not ignored. The spine also never names the ignore set, so the scaffold story may not touch it.
- **Fix:** Add to the Data convention: `var/` is git-ignored as a whole, along with `data/private/*`, `.env*` except the examples, and the Playwright outputs. The scaffold story checks `.gitignore` against this list. (Today only `var/` and the SQLite sidecar files are missing.)

### R-7. FR-40 and AD-12: an expired session drops the edit instead of sending the user to login

- **PRD:** FR-40 (every page except login, create account and the demo front page requires login; log out goes to the login page or, on the public deployment, the demo front page); FR-10.
- **Gap:** AD-12 handles every 4xx with "drop the command, show `message`, refetch". A 401 `unauthenticated` (for example after the 30-day JWT expires, or after `JWT_SECRET` rotates on Vercel) therefore loses the change silently, and nothing sends the user to login. AD-2 forbids server-side calls to the backend, but the spine doesn't say how pages are guarded. The auth story and the queue story will each improvise.
- **Fix:** In AD-12, add a rule for `unauthenticated`: pause the queue, send the user to login (or to the demo front page on the public deployment), and either keep or drop the pending command (say which). In AD-10, state the page guard: client-side `GET /api/auth/me` on app routes, and optionally a Next.js middleware cookie-presence check that never calls the backend.

### R-8. NFR-2 (no network at runtime) vs the fonts and the dev tooling

- **PRD:** NFR-2 ("no ... external services or network calls at runtime").
- **Gap:** DESIGN.md uses Barlow Semi Condensed, a Google font, and technology.md mentions `geist`. The default Next.js route, `next/font/google`, downloads the font when the dev server compiles, and Next.js telemetry calls home by default. An offline examiner run of `npm run dev` then degrades or makes network calls. The spine says nothing about this.
- **Fix:** Add to the Stack or Config convention: fonts are self-hosted, from files in the repo via `next/font/local` or an npm font package, never `next/font/google` or a CDN. The root dev script sets `NEXT_TELEMETRY_DISABLED=1`. The SM-2 README run is done offline once.

## Low

### R-9. NFR-9 lists three browsers including print, but the tests name none

- **PRD:** NFR-9 (current Chrome, Edge, Firefox, including their print function); FR-38; UJ-3 (the new generated-at time tells printouts apart).
- **Gap:** Tests say only "Playwright ... locally before each milestone gate". The print view is a client-fetched route (AD-2). If the query is cached, "Generated at" can be stale, or the page can print before the data loads.
- **Fix:** Playwright projects for `chromium`, `firefox` and `msedge` (channel), each with a print-media check of the move list. The print route always refetches its view on open (no cached data) and shows the lines only after the server response.

### R-10. NFR-8 has no measuring point, and the spine's own design adds per-request cost

- **PRD:** NFR-8 (import + classes + pick groups < 10 s; run < 5 s; other actions < 1 s).
- **Gap:** AD-5 replays the whole step log, and AD-3 refetches every `['plan', id]` query after each command. Each view therefore loads the import JSON and replays again. That is fine at `data/sample/` size (2,000 locations, 1,625 inventory rows, 20,000 transactions), but nothing checks it. The Deferred item "Measured at the milestone 1 gate" gives no owner.
- **Fix:** Name one timing test (for example `backend/tests/app/test_nfr8_timing.py` on `data/sample/`) that covers import, run and one command followed by the plan views. Note that plan views never load `transactions`, which AD-4 already implies.

### R-11. Step order and transaction for `apply_all` (FR-30)

- **PRD:** FR-30; glossary "Move number"; FR-35 (undo latest first).
- **Gap:** AD-16 fixes the expansion order, the single transaction and the single version bump for drags only. The order in which Apply all creates steps decides the move numbers shown ("move N") and the undo order, and the spine leaves it open.
- **Fix:** Add `apply_all` to AD-16's rule. It expands to one step per applicable recommendation, in server recommendation order (AD-14), in one transaction with one version bump.

### R-12. Milestone 1: start route and `MAX_PLANS` without Delete

- **PRD:** FR-8 milestone-1 consequence (open the most recently edited plan, or New Plan; New Plan always creates a new plan); §7.1 (FR-12 is milestone 2).
- **Gap:** The frontend route list doesn't say what `/` does in milestone 1. AD-18's `MAX_PLANS = 50` applies locally too, but milestone 1 has no Delete, so a dev or examiner install can get stuck at `limit_reached` with no way out in the UI.
- **Fix:** State the milestone-1 `/` behaviour (redirect to the most recently edited plan, else `plans/new`), served by the same list endpoint FR-8 uses later. Either raise or disable `MAX_PLANS` when `FEATURE_DEMO` is off, or note the CLI way out.

### R-13. Whether FR-34 folding is in `replay` from milestone 1

- **PRD:** §7.1 ("milestone 2 adds screens, not a new data model"); FR-33 (m1) vs FR-34 (m2).
- **Gap:** If the milestone-1 `replay` doesn't fold FR-34 and milestone 2 adds it, plans saved in milestone 1 will show different moves and move-list lines after the upgrade. That changes "reopen identical" across releases (the public demo included).
- **Fix:** State that `domain.planning.replay` implements FR-34 from its first story, or accept the reflow and say so.

### R-14. `created_by` is plain text, but the ER diagram draws a relationship

- **PRD:** FR-11 (`planner` in milestone 1, the logged-in user from milestone 2); FR-39 (unique usernames).
- **Gap:** AD-10 says `created_by` and `last_edited_by` store the username as text. The ER diagram draws `USER ||--o{ PLAN`, which a store story may turn into a foreign key that milestone-1 rows (`planner`) break. Usernames are unique ignoring case, so it is also unclear which spelling is stored. A sign-up named `planner` would also take over attribution of the milestone-1 plans.
- **Fix:** Label the ER edge "text, no FK" and store the username as it was entered at sign-up. Optionally reserve `planner` as a username.

### R-15. Concurrent delete of the last plan and FR-2 create from its import

- **PRD:** FR-12 (the import is deleted when no remaining plan uses it); FR-2.
- **Gap:** AD-6 locks the plan row only. If Delete removes the last plan and its import while another user creates a plan from that import, the new plan can point at a deleted import. Two deletes of the last two plans can also leave the import orphaned. On the shared demo this is reachable, although rare.
- **Fix:** `plan.import_id` is a foreign key. Delete and FR-2 create both lock the import row (`SELECT … FOR UPDATE`) and count its plans inside that lock.

### R-16. Upload date: which clock and which time zone

- **PRD:** FR-7; glossary "Data-as-of date" (shown with the upload date).
- **Gap:** The convention says the upload date is a plain `YYYY-MM-DD` date, but not whether it is the server's UTC date or the planner's local date. Near midnight in Norway the two differ by a day, and the move-list header and the plans list could disagree if one formats a timestamp and the other a date.
- **Fix:** Store `uploaded_at` as a UTC timestamp (like the other timestamps) and show it as a date in the viewer's time zone, or state that the upload date is the UTC date. Pick one.

### R-17. FR-6 merged inventory vs FR-36 "identical to what was uploaded"

- **PRD:** FR-6 (duplicate rows merged, quantities added); FR-36; FR-37 ("before" is the import).
- **Gap:** AD-4 stores "the parsed inventory" without saying whether it is stored merged. If the import stores raw rows and `replay` merges them (or the reverse), the before/after "before" side and the FR-36 test compare different shapes.
- **Fix:** State that the stored `inventory` is the normalized form (FR-6 merge applied), and that FR-36 means this stored form never changes.

### R-18. Demo lockout can block FR-50

- **PRD:** FR-50 (Demo version goes straight to the saved-plans list, with no password).
- **Gap:** AD-18 locks a username for 60 s after 5 failed logins. Anyone can lock `demo` by typing wrong passwords, and if `POST /api/auth/demo` checks the same throttle, Demo version fails for every visitor.
- **Fix:** State that `/api/auth/demo` bypasses the login throttle. Optionally, exempt `demo` from the lockout.

### R-19. FR-41 semantics vs the command model

- **PRD:** FR-41 ("the user's version of the whole plan is saved and the other user's changes since then are lost"); UJ-3 edge case.
- **Gap:** With AD-6, commands merge on the server, so a "continue" never overwrites another user's changes. The behaviour is better, but it contradicts FR-41's text. The spine's Deferred note says only that FR-41 "adds the check".
- **Fix:** Add a line under Deferred: FR-41 will warn and then apply the command on top of the current state (no whole-plan overwrite), and offer this as a PRD wording update, like the existing UJ-2 and FR-29 notes.

### R-20. AD-14 user-sort wording, and FR-15 search

- **PRD:** FR-13 (sort by picks); FR-15 (partial text, ignoring case).
- **Gap:** AD-14 says a user-picked sort "(FR-13 picks, FR-14 filters) compares strings". But picks are integers, FR-14 has filters rather than sorts, and the tie order is unstated. FR-15 doesn't say whether search runs on the server or the client, and Python and JS case-folding can differ.
- **Fix:** Reword: user sorts compare numbers numerically and text with `<`/`>`, and ties keep server order. Say whether search is a server endpoint (Python `casefold`) or filters client-side over the loaded lists.

### R-21. FR-39 "letters and numbers" vs `[A-Za-z0-9]`

- **PRD:** FR-39.
- **Gap:** AD-10 limits usernames to ASCII, which rejects Norwegian names with æ, ø or å. That is a narrower reading of "letters".
- **Fix:** Keep the rule but mark it as a deliberate narrowing (and put it in the sign-up error copy), or allow Unicode letters with `str.isalnum()` and fold case consistently.

## Side note (not a PRD reconcile item)

- **AD-10 and bcrypt 5.0.0.** bcrypt 5 raises `ValueError` for passwords longer than 72 bytes. AD-10 allows up to 64 *characters*, and non-ASCII characters can take more than 72 bytes, which gives a 500. Limit the password by its UTF-8 byte length (≤ 72), or pre-hash it.
