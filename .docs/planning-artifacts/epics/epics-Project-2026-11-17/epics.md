---
stepsCompleted: [1, 2, 3, 4]
status: final
inputDocuments:
  - .docs/planning-artifacts/prds/prd-Project-2026-11-01/prd.md
  - .docs/planning-artifacts/prds/prd-Project-2026-11-01/addendum.md
  - .docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md
  - .docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/DESIGN.md
  - .docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/EXPERIENCE.md
  - .docs/planning-artifacts/briefs/brief-Project-2026-09-27/addendum.md
  - PRODUCT.md
  - data/answer-key/README.md
excludedDocuments:
  - .docs/planning-artifacts/architecture/technology.md (reference from another project; the spine is binding)
  - review-*.md, reconcile-*.md, tilbakemelding-*.md, research/ (already folded into the final documents)
created: 2026-11-17
updated: 2026-11-19
---

# Smart Warehouse Planner - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Smart Warehouse Planner, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

PRD glossary terms (§3) and IDs (FR-n, NFR-n, UJ-n, AD-n) are used verbatim. Where the PRD and the brief's addendum differ, the PRD wins (PRD §10); for example, the addendum's red/green warehouse view and "no self-registration" are superseded.

**Scope tags:** `[M1]` core milestone 1 · `[M2]` core milestone 2 · `[S2]` stage 2 (after the milestone 2 gate) · `[ITA]` if time allows · `[DEPLOY]` the public deployment, done last. FR-49 was withdrawn and its ID is not reused.

**Deployment deferred (user decision 2026-11-19):** nothing is deployed to Vercel or Supabase while the app is built. The app is built and checked locally through Epics 1–12; the public deployment is Epic 16 and starts only after the user has approved the website. Former Story 1.3 is now Story 16.1, and the production parts of Stories 9.7 and 12.5 are now Story 16.2.

## Requirements Inventory

### Functional Requirements

**4.1 New Plan and import**

- FR-1 `[M1]`: The planner can start a New Plan by giving it a name and uploading a Locations file, an Inventory file and a Transactions file. `.xlsx`, or `.csv` in UTF-8 with a header row and `,` or `;` delimiter, is accepted; there is no column-mapping screen. A plan is created only when all three files pass FR-3–FR-5, and it opens with movement classes and pick groups already computed. New Plan on `data/sample/` succeeds without errors.
- FR-2 `[M2]`: The planner can start a New Plan that reuses the import of an existing plan. The new plan has the same import and none of the chosen plan's best-location marks, keep-in-place marks, moves or recommendations; it is computed with the current settings (same classes, pick groups and first-run recommendations when settings and marks are unchanged). Starting from another plan's planning copy is out of scope.
- FR-3 `[M1]`: Before saving anything, each file is checked for its required columns — Locations: Location, Walk Path, Aisle, Level; Inventory: Part, Part Description, Quantity, Location; Transactions: Transaction Type, Part, Location, Transaction Code, Date. Names match ignoring case and surrounding spaces. A missing column gives a message naming the file and column, and nothing from the import is saved.
- FR-4 `[M1]`: The import is rejected, with a message naming file, row and column, when a required cell is blank, Quantity is not a number or is negative, Walk Path is not a number, Date cannot be read, or a location code appears twice in the Locations file. A file that can't be read as `.xlsx`/`.csv` is rejected naming the file. Nothing from a rejected import is saved.
- FR-5 `[M1]`: Every inventory row and shelf line (Move to Repair, Return to Stock, Receipt) must refer to a location in the Locations file, else the import is rejected naming file, row and location. Issue Part lines at a virtual location (e.g. `FLSKRS`) are accepted. Other transaction types are accepted and ignored.
- FR-6 `[M1]`: Part numbers and location codes are stored as text exactly as in the files (leading zeros and suffixes kept); several location-code patterns are accepted; inventory rows repeating the same part in the same location are merged with quantities added; a Warehouse column with more than one value rejects the import naming the file.
- FR-7 `[M1]`: Each plan records the data-as-of date (newest transaction date) and the upload date, shown on the plan, in the saved-plans list and on the move list.

**4.2 Saved plans**

- FR-8 `[M2]`: The saved-plans list shows every plan (name, data-as-of date, created by/at, last edited by/at), most recently edited first, with New Plan. It is the start page (after login from M2; behind the demo front page on the public deployment). In M1, before the list exists, the app opens the most recently edited plan, or New Plan when there is none; New Plan always creates a new plan and leaves earlier ones stored.
- FR-9 `[M2]`: A reopened plan has identical best-location marks, keep-in-place marks, moves (rules, rounds, move numbers), recommendations (incl. outdated), "no space" parts, current round, everything Undo needs (step order, combined-move state), each run's round/time/user and each swap's membership. View choices live in the browser; opening or viewing a plan is not a change and does not update last edited. A plan stays editable after printing; no locking.
- FR-10 `[M1]`: Every change (best-location mark, keep-in-place mark, run, applied recommendation, move, undo, reset) is saved automatically without a Save button; a reload shows it.
- FR-11 `[M1]`: Every plan records who created and last edited it — the fixed value `planner` in M1, the logged-in user from M2.
- FR-12 `[M2]`: The planner can delete a plan after confirming (cancel leaves it unchanged). Delete is permanent, with no archive; other plans, including those reusing its import, are unchanged; the stored import is deleted when no remaining plan uses it.

**4.3 Parts, locations and search**

- FR-13 `[M1]`: Parts list: every part in the Inventory file with part number, description, total stock, current location, other locations, movement class, picks, number of pick groups and kept-in-place; filter by movement class and sort by picks. Shows the planning copy.
- FR-14 `[M1]`: Locations list: every location with code, aisle, level, Walk Path, occupied/empty, best or not, and each part stored with its stock. A location whose inventory rows all have stock 0 is empty and can be suggested. Occupied/empty counts and occupancy per aisle and for the whole warehouse. Filter by aisle, occupied/empty and best location.
- FR-15 `[M1]`: One search field matches part numbers, part descriptions and location codes, as partial text ignoring case; a result opens the part or location, from where a manual move can be made.

**4.4 Movement classification**

- FR-16 `[M1]`: Each Move to Repair line in the period counts as one pick whatever its quantity; Issue Part, Return to Stock and Receipt never count; lines outside the period don't count (a line on the newest date counts; one on the same date a year earlier does not). Dates only; time of day ignored.
- FR-17 `[M1]`: Every part in the Inventory file gets exactly one class: ≥24 fast-moving, 6–23 medium-moving, 1–5 slow-moving, 0 dead stock. The answer-key dataset gets exactly its expected classes, incl. boundaries 0, 1, 5, 6, 23, 24. Parts only in the Transactions file are not classified or shown.
- FR-18 `[M1]`: Period length, class limits and pick-group minimum are settings in a configuration file, separate from rule logic. Each plan stores and shows the settings it was computed with (period start/end, class limits, pick-group minimum), so it reopens with identical results if settings change later.

**4.5 Pick-together analysis**

- FR-19 `[M1]`: Two parts appearing together on ≥5 jobs in the period form a pick group (4 do not). A part appearing several times on one job counts once; a zero transaction code (`0`, or text such as `00`, `0.0`, `0,0` or `-0`, after trimming) never forms a job; a job with more than 100 distinct parts adds no pairs (`MAX_JOB_PARTS`, a guard against quadratic pair counting on the public demo); only parts in the Inventory file are considered. The answer-key dataset gets exactly its expected pick groups, incl. a part in several groups.
- FR-20 `[M1]`: Pick groups list: both parts (number and description), shared jobs, the aisle of each part's current location in the planning copy, and same aisle or not; sorted by shared jobs, most first.

**4.6 Best locations**

- FR-21 `[M1]`: The planner can mark/unmark a whole aisle, a level in all aisles, a level in one aisle, or a single location. A location covered by any mark is best; removing one mark leaves it best if another still covers it. Marks are stored in the plan, never in the import. A mark that covers no location of the import is refused with `validation_failed` (422) and changes nothing, and the Best locations step is ticked only when the marks cover at least one location. In M1 marks are set from the locations list; from M2 also on the warehouse view.
- FR-22 `[M1]`: The locations list, warehouse view and before/after table show which locations are best; the plan shows the number of best locations and of empty best locations.

**4.7 Recommendations**

- FR-23 `[M1]`: The planner can run the recommendations at any time. Each run starts a new round (1, 2, …; round 1 again after a reset), replaces all unapplied recommendations and "no space" parts from earlier runs, and uses the planning copy's current locations and occupancy plus the current best-location and keep-in-place marks; classes and pick groups come from the import. Two runs on the same state give the same recommendations in the same order.
- FR-24 `[M1]`: Rule 1 — a fast-moving part whose current location is not best gets a recommendation to an empty best location. Parts by most picks first, ties in part-number order; empty best locations offered in location-code order.
- FR-25 `[M1]`: Rule 2 — a slow-moving or dead-stock part whose current location is best gets a recommendation to an empty non-best location. Parts by fewest picks first, then part-number order; locations in location-code order. A best location freed by rule 2 is offered to rule 1 only in a later round.
- FR-26 `[M1]`: Rule 3 — when a pick group's parts are in different aisles, the part with fewer picks (on a tie, the later in part-number order) gets a recommendation to an empty location in its partner's aisle, in location-code order. Pick groups by most shared jobs, ties by lower then higher part number. A slow/dead part is never offered a best location (if every empty location there is best → "no space" under rule 3). No recommendation and no "no space" when: the mover sits in a best location; the mover is already in the aisle of another partner it shares at least as many jobs with (that partner's aisle after this run's earlier rule-3 moves, so a weaker group never pulls a part away from a stronger partner just moved to it, issue 115); the partner already has a recommendation this run; either part has no current location, or the mover is kept in place. The partner is never moved instead.
- FR-27 `[M1]`: Rules apply in order 1, 2, 3. Only empty locations in the planning copy are suggested, never virtual ones. Parts with no current location or kept in place are skipped. At most one recommendation per part per run (a part that has one is skipped silently by later rules and its other pick groups); each empty location suggested to at most one part. When a rule applies but no empty location fits, the part is listed once as "no space" with that rule and later rules skip it. The answer-key dataset gets exactly its expected recommendations and "no space" parts in rounds 1 and 2.
- FR-28 `[M1]`: Each recommendation shows part, description, current location, suggested location, rule and the reason in numbers — rules 1/2: class, picks and threshold ("fast-moving: 31 picks in the period (24 or more)"); rule 3: partner, partner's aisle and shared jobs ("pick group with 2007060: 12 shared jobs (5 or more)"). "No space" parts show the rule and the same reason.
- FR-29 `[M1]`: A recommendation becomes outdated, first cause shown, when: its part was moved by another move in the same round; its suggested location is no longer empty; a mark change means its rule no longer holds; (rule 3) the partner is no longer in the suggested location's aisle; or after any undo. Nothing else outdates it. An applied recommendation whose move was removed by a move-back (FR-34) shows as outdated with "moved back"; undoing the move-back shows it applied again. Outdated recommendations can't be applied and stay outdated until the next run.

**4.8 Planning copy and moves**

- FR-30 `[M1]`: The planner can apply one recommendation, creating a move with its rule and its run's round, or "Apply all" — every recommendation of the latest run that is neither applied nor outdated, skipping "no space" parts and parts kept in place.
- FR-31 `[M2]`: The planner can apply a recommendation with another location that is empty now, was empty when the run was made, and fits the rule (best for rule 1; not best for rule 2; in the partner's aisle for rule 3, and not best for a slow/dead part). The move keeps the rule and round; the choice is not stored as an edit of the recommendation. Any other placement is a manual move.
- FR-32 `[M2]`: The planner can mark a part "keep in place" from a recommendation or from the part, and remove it again. A kept part gets no recommendation and no "no space" in later runs, and Apply all skips it. Kept parts are listed with their count; a kept part can still be moved manually.
- FR-33 `[M1]`: The planner can move a part from one of its locations to any location in the Locations file (empty or occupied). The move gets rule Manual and the current round (0 before the first run), moves all the part's stock at the from-location (never split), leaves its other locations unchanged; a virtual location or the from-location itself can't be the to-location; stock is added together if the to-location already holds the part.
- FR-34 `[M2]`: When a part is moved again in the same round from the to-location of its earlier move, and that location held none of the part before, the two become one Manual move from the first from-location to the new to-location; moved back to its first from-location, the move is removed. Otherwise moves stay separate. (Architecture AD-5 implements this in `replay` from its first story.)
- FR-35 `[M2]`: Undo reverses the most recent move (an applied recommendation, a manual move, or the second step of a combination, restoring the state before it), repeatable back to the first; no move in the middle can be removed alone. Undo does not reverse runs or marks. After any undo every unapplied recommendation of the latest run becomes outdated and an undone recommendation does not return until the next run. A swap is undone one move at a time. Reset confirms, then removes all moves, recommendations and "no space" parts; current round becomes 0; marks are kept.
- FR-36 `[M1]`: No action in a plan changes the import: after any sequence of moves, undo and reset the import is identical to what was uploaded; movement classes and pick groups don't change when moves are made.

**4.9 Before/after table**

- FR-37 `[M1]`: For each aisle and the whole warehouse, the import ("before") next to the planning copy ("after"): parts that move in and out per aisle; fast-moving parts in best locations before and after (a part counts once, in its current location's aisle); pick groups with both parts' current locations in the same aisle, per aisle and total. Both sides use the current marks. Updates after every move, undo and reset.

**4.10 Move list**

- FR-38 `[M2]`: A browser print view of exactly the plan's moves (after FR-34). Each line: round, part, description, from, to, rule, tick box. Ordered by round; within a round a line into a location comes after every line in that round moving a part out of it, otherwise Walk Path of the from-location then part-number order; cycles follow Walk Path order. Swap lines (FR-51) follow each other where allowed and are marked "Swap 1/2 · A ↔ B" only while every move of that swap is still intact. Header: plan name, data-as-of date, upload date, number of rounds, generated time. A plan with no moves says there are no moves to print. No PDF/CSV export.

**4.11 Accounts and login**

- FR-39 `[M2]`: Anyone can create an account with a unique username (letters and numbers) and a password typed twice; passwords are hashed; no email, roles, admin or password reset.
- FR-40 `[M2]`: Users log in and out. Every page except login, create account and (public deployment) the demo front page requires login. After login the user lands on the saved-plans list; Log out returns to login (public deployment: the demo front page). Plans record the logged-in user. The README lists a seeded demo account.
- FR-50 `[M2]`: On the public deployment, **Demo version** on the demo front page and the login page opens the saved-plans list as the seeded demo account, with no login page or password. Created/edited by show that account; Log out works as for any user; plans stay shared; no plan is preloaded. A local install has no demo front page and no Demo version.
- FR-41 `[ITA]`: A user who changes a plan that someone else saved since it was opened is warned, with an offer to reload; continuing applies the change on top of the current plan (never overwriting with an older copy).

**4.12 Warehouse view**

- FR-42 `[M2]`: All aisles drawn by section and level, one place per location. Occupancy by shape and text (filled bin vs open place, tooltip "occupied/empty"), never red/green. Colour is reserved for movement class, always paired with a symbol. Best locations get a green rail or frame plus the text BEST. Each location has a keyboard-openable tooltip (code, level, best, parts with class, picks, stock). Occupancy per aisle and whole warehouse as % and counts. From a recommendation, the part's current and suggested locations can be seen on the view. Shows the planning copy and updates after every move, undo and reset. A key names each class with colour and symbol, plus best, selection and empty; clicking a colour entry opens a colour chooser for that colour (6 colours), shown at once; symbols and text never change; contrast (<3:1) and likeness warnings, which the planner can override; reset per colour. Colours are kept in the browser, survive a reload, change no plan/import/analysis; the print stays black and white.
- FR-51 `[M2]`: In the warehouse view the planner can drag a part (mouse only) from its location onto another, on the planning copy only. When the from-location holds several parts, the planner chooses which (≥1). Drop on empty → one manual move per chosen part. Drop on occupied → always asks Swap / Put together / Cancel, nothing changes until chosen. Put together = manual moves into the location. Swap = chosen parts there and chosen back-parts (≥1, when several) to the from-location. Every moved part gets its own Manual move in the current round; FR-33 and FR-34 apply. Virtual locations are not drop targets; dropping on its own location does nothing. A swap involving a kept-in-place part warns and keeps the mark. Undo one move at a time; swap lines marked on the move list.

**4.13 Category check (stage 2)**

- FR-43 `[S2]`: The planner can create, edit, delete and reorder global keyword rules (one keyword → one category).
- FR-44 `[S2]`: Each part gets the category of the first keyword rule matching its description (whole words, ignoring case); no match → no category.
- FR-45 `[S2]`: The planner can assign one or more categories to each aisle; aisle categories are global.
- FR-46 `[S2]`: Category check lists every part whose category is not assigned to its current aisle in the planning copy; parts without a category and aisles without categories are not checked; deterministic; recommendations don't use categories.
- FR-47 `[S2]`: The demo setup ships starter keyword rules and aisle categories so the check runs on the demo data via the README without manual setup.

**4.14 Location labels (stage 2)**

- FR-48 `[S2]`: Print a label for every location in a chosen aisle from a browser print view, in Walk Path order: location code in large text and a QR code encoding exactly that code, scannable by a standard phone camera.

### NonFunctional Requirements

- NFR-1: Classification, pick groups, recommendations, rounds and move-list order are separate pure modules (data and settings in, no DB/file/network, deterministic), tested directly against the answer-key dataset without the UI.
- NFR-2: Installs and runs on a laptop with no paid accounts, API keys, external services or runtime network calls. The README gives install and start steps, a step-by-step import of `data/sample/`, how to run the tests, and the demo account.
- NFR-3: No language model or AI service at runtime.
- NFR-4: Public repo; only synthetic data committed (`data/generate_demo_data.py` output and the answer-key dataset). DB, uploads and real exports (`data/private/`) git-ignored; no real part numbers, files or screenshots anywhere.
- NFR-5: The public deployment (Vercel, linked from the README) holds synthetic demo data only. It opens on a demo front page (what the tool does, the flow from import to printed move list, Log in / Create account / Demo version), with no claims about customers, savings or distances and no synthetic-data notice (the README says it). A local install opens on the login page.
- NFR-6 `[M2]`: Secrets (e.g. the session key) come from environment variables and are never committed; the README explains local setup with an example file holding no real values.
- NFR-7: Up to about 10 users in total, a few at a time; no special scaling work.
- NFR-8: On a typical laptop: importing the demo data and computing classes and pick groups < 10 s; a run < 5 s; other actions < 1 s.
- NFR-9: Current desktop Chrome, Edge and Firefox, including print. No phones or handhelds in v1.
- NFR-10: No information by colour alone; forms and buttons keyboard-usable. Drag (FR-51) is mouse-only, with every move it makes also possible via keyboard manual moves (FR-33).
- NFR-11: The UI is in English.
- NFR-12: Plans, imports and accounts persist across restarts through one storage layer that rule modules never touch. Local storage needs no external service; the public deployment may use a hosted DB chosen by env config. Persistence tests run against local storage. An import may be kept as parsed rows as long as FR-36 holds.

### Additional Requirements

From `ARCHITECTURE-SPINE.md` (AD-1 to AD-20, conventions, stack, structural seed). Greenfield: no `backend/` or `frontend/` exists yet.

**Starter / scaffold (affects Epic 1 Stories 1.1–1.2 and, deferred, Story 16.1)**

- No third-party starter template. The first story is a **walking skeleton**: scaffold `backend/` (uv, Python 3.12 pinned in `.python-version`, FastAPI, `swp` package with `domain/ app/ store/ api/`, `config.py`, `cli.py`, `main.py`) and `frontend/` (Next.js 16 App Router, React 19, TS 5.9, Tailwind 4, `shadcn init -b radix`, TanStack Query), a root `package.json` whose `npm run dev` starts both with concurrently, `vercel.json` with Vercel Services (frontend + backend `swp.main:app`, `/api/(.*)` → backend), and `GET /api/health` (runs `SELECT 1`) plus one page. Deploying them to Vercel (preview deployments off for the whole project) is deferred to Story 16.1.
- The scaffold story checks `.gitignore` against: `backend/var/` (incl. SQLite `-wal/-shm/-journal`), `data/private/*`, `.env*` except examples, test and Playwright outputs.
- CI (GitHub Actions) on every push: ruff, import-linter, pytest on SQLite, `tests/app` against Postgres 17, frontend typecheck, Vitest, and the OpenAPI schema diff. `keep-alive.yml` does a daily `GET /api/health`. Playwright runs locally before each milestone gate.
- Exact stack versions are pinned in the spine's Stack table (FastAPI 0.163.1, SQLAlchemy 2.1.8, Alembic 1.20.1, Next.js 16.4.6, React 19.3.1, etc.).

**Layering and purity**

- AD-1: `swp/domain` is pure (stdlib + pydantic only); no DB/file/network/clock/randomness — `uuid4`, `datetime.now`, `random` banned via ruff `banned-api`. Time and user come in as `CommandContext(now, user)`; IDs are `uuid5(command_id, "<kind>:<n>")`. Shared facts (`current_location`, `is_empty`, `stock_at`, `aisle_of`, `covering_marks`, `run_baseline`) live only in `domain/planning.py`. Answer-key tests in `backend/tests/domain/` call the domain directly.
- Layer import rules (domain → store → app → api → frontend) enforced by `import-linter` contracts in CI; only `swp.store` imports SQLAlchemy.
- AD-2: Two deployables, one origin. Backend owns all logic and persistence; browser calls relative `/api/*` only; every router mounted under `/api`; local Next.js rewrite to `127.0.0.1:8000/api/:path*`; client-side fetching with TanStack Query only (no server components/route handlers/server actions calling the backend). Fallback: two Vercel projects with a rewrite.

**Plan state, commands and views**

- AD-3: Server-authoritative plan state. Frontend never computes rules, planning copy, occupancy, outdated status, before/after, move-list order, wall layout, search or move effects. Every plan view carries `version`; after each command the client refetches every `['plan', planId]` query and renders only version-consistent sets (≤2 refetches). Import-scoped data under `['import', importId]` is immutable-cached. `GET /api/plans/{id}` is the plan summary (plate data, step check states and counts, `apply_all_count`, `undo_preview`, current round). `GET /api/plans/{id}/moves/preview` returns `{allowed, refusal_message?, effect}` without writing. `GET /api/plans/{id}/search?q=` (casefold, AD-14 order). No cross-request cache; one `replay` per request.
- AD-4: Plan row = id, name, `import_id` (FK `ON DELETE RESTRICT`), created/last-edited by/at, `version`, plus JSON `analysis` (settings snapshot, period, classes, pick groups) and `state` (`PlanState`: best marks as values, keep marks, runs, step log, `next_move_number`, `recent_commands` last 50). `current_round` derived. Import row = `uploaded_at`, `data_as_of` (newest date over all transaction rows), normalized `data` (locations, merged inventory incl. zero-stock, parts with first non-blank description, reduced transactions); frozen; file bytes never stored. `app.plans.create(import, settings)` is the only creation path (FR-1 and FR-2), always recomputing analysis from `analysis.toml`. Each JSON doc carries `schema_version`, with pure upcasters in `domain/state_migrations.py` and a fixture per version; GET never saves. Delete and FR-2 create lock the import row; the import is deleted with its last plan.
- AD-5: Moves are an append-only step log (move number, part, from, to, rule, round, recommendation id, `swap_id`). Planning copy, effective moves (FR-34) and current locations always come from `domain.planning.replay(import, steps)`, never stored. Round invariant asserted in `domain.apply`. `run_baseline` = replay of steps with round < k. Undo deletes the last step and carries `expected_move_number`; `undo_preview` is `{move_number, part, from, to, effect: reverts_move | splits_combined_move | restores_removed_move}`. Reset deletes all steps and runs, resets `next_move_number` to 1, keeps marks.
- AD-6: Every change is one idempotent, serialized command via `POST /api/plans/{id}/commands` `{command_id, base_version, type, …}`. Closed type list: `set_best_mark`, `remove_best_mark`, `set_keep`, `remove_keep`, `run`, `apply`, `apply_all`, `apply_other_location`, `manual_move`, `move_parts`, `put_together`, `swap`, `undo`, `reset`. Response `{version, events[]}` with a closed event union. Repeated `command_id` returns the stored result; no-ops return 200 with no events and no version bump. Optimistic `UPDATE … WHERE version=` with up to 3 retries; SQLite `BEGIN IMMEDIATE`. `base_version` recorded, not enforced. Apply all = one fold, one transaction, one version bump. Only other writes: `POST /api/plans` (multipart, not idempotent, submit disabled in flight) and `DELETE /api/plans/{id}`.
- AD-7: Recommendation `id = "<run_id>:<n>"`, `number = n` in AD-14 order, never renumbered; "no space" keyed by `(run_id, part)`. Stored status only `open` / `outdated(cause)`; `applied` derived from the step log; `moved_back` derived. Revalidate order: `moved`, `filled` (records location and move number), `marks`, `partner_aisle`. Undo outdates every open recommendation and the undone step's one. A run deletes unreferenced earlier recommendations and "no space" entries, keeps run metadata. Kept-in-place recommendations show under Kept in place, not applicable. `domain.recommendations.other_locations` is the only FR-31 implementation.

**Import**

- AD-8: Readers in `swp/app/imports/readers.py` → `RawSheet`. `.xlsx` via openpyxl + defusedxml, read-only, first sheet, reject >50 MB uncompressed, stop at `MAX_ROWS_PER_FILE+1`, 100 columns, 1,000 chars/cell; floats → `Decimal(repr(f))`. `.csv` UTF-8 with BOM stripped; delimiter = the more frequent of `,`/`;` in the header. Validation in `domain.import_`: header = first non-blank row, trimmed case-insensitive names, duplicate required column rejected, blank rows skipped, spreadsheet row numbers (header = 1); text trimmed incl. NBSP; identifier cells integral → integer text, non-integral rejected; numbers accept `.`/`,` decimals, reject thousands separators, Quantity ≥ 0; dates as date cells, `YYYY-MM-DD` or `DD.MM.YYYY` (+optional time discarded), others rejected; empty files rejected; >1 Warehouse within or across files rejected. Error details per file `{file_role, file_name, status: passed|failed|not_checked, errors (≤20), more_count}`. Saving is all-or-nothing in one transaction (import + plan + analysis). Import UI = upload progress, then one server step; Cancel only while uploading.

**Storage, identity, errors, client**

- AD-9: SQLAlchemy 2.1 sync ORM + Alembic (`render_as_batch=True`); portable types only (`Uuid`, `JSON`, `UtcDateTime`); JSON written whole via `model_dump(mode="json")`; decimals as `domain.values.Dec` normalized strings. Local SQLite default `backend/var/swp.db`; demo Supabase Postgres via transaction pooler (6543, `NullPool`, `prepare_threshold=None`, URL rewritten to `postgresql+psycopg://`), migrations via `MIGRATION_DATABASE_URL`. `swp.app.bootstrap(upgrade, seed)` is the only migrate/seed path (CLI `swp db upgrade`; lifespan only when `APP_ENV=local`). Expand-only migrations. CI runs `tests/app` on Postgres 17 too.
- AD-10: `FEATURE_AUTH` / `FEATURE_DEMO` backend env flags read by the frontend from `GET /api/session` (`{user, feature_auth, feature_demo, max_upload_bytes}`). Auth off (M1): every request is user `planner`. Auth on: usernames `isalnum`, 1–32 chars, unique by casefold, `planner` and `demo` reserved; passwords 4–64 chars and ≤72 UTF-8 bytes, bcrypt; HS256 JWT (PyJWT) in httpOnly `SameSite=Lax` cookie `swp_session` (Secure in prod), 30 days; `POST /api/auth/logout`. Backend refuses to start in production with empty/default `JWT_SECRET`, or when `VERCEL` is set and `APP_ENV` isn't. Client layout guard via `/api/session`. `created_by`/`last_edited_by` are username text, no FK. Demo: `POST /api/auth/demo` (404 when flag off, no throttle), idempotent seed of `demo` (password from `DEMO_PASSWORD`, default `demo`), not counted in `MAX_ACCOUNTS`.
- AD-11: Error envelope `{"error": {code, message, details}}` with the closed code list (`import_invalid` 422, `validation_failed` 422, `command_rejected` 409, `plan_not_found` 404, `not_found` 404, `unauthenticated` 401, `forbidden_origin` 403, `login_locked` 429, `limit_reached` 413/409, `internal` 500). Backend writes final English `message` with no dates/times. Reasons, outdated causes and events are structured data worded only in `frontend/lib/copy`. Frontend branches only on `code`; non-envelope responses → `internal`.
- AD-12: `frontend/lib/commands` sends one command at a time per plan; plan-changing controls `aria-disabled` "Saving the last change…" while unconfirmed. Network error/502–504: retry same `command_id` after 1, 2, 4, 8 s ("The last change was not saved yet. Trying again."), then drop, refetch, "The change was not saved. Try again." (`run` → "Run failed" state). `unauthenticated`: keep command, log in, resend. `plan_not_found`: "This plan was deleted." → saved-plans list (M1: New Plan). Other 4xx: drop, show message, refetch. One TanStack Query error hook for GETs.
- AD-13: Command union (`swp/domain/commands.py`) and views (`swp/domain/views/`) are the wire models; `swp/api/schemas` only for session, auth, saved-plans rows, errors. `openapi-typescript` generates `frontend/lib/api/schema.ts` from `swp openapi`; CI fails on diff. snake_case JSON. zod for form input only. Test helpers map "apply 1100" to a recommendation id; no part-based command.
- AD-14: Every rule-defined order (recommendations, "no space", pick groups, move list, aisles, levels, wall cells, search) comes from `domain/ordering.py`: Python `str` code-point order; all-digit identifier columns (Level, Section, Position) sort numerically. User-picked table sorts (FR-13): `<`/`>` for text (never `localeCompare`), numbers numerically, decimals by server `sort_rank`, ties keep server order.
- AD-15: `domain/layout.py` builds each aisle's logical cells (run, row, column, gap), the two-run section split and end-cap Walk Path — from Section/Position columns, else code pattern `<aisle>-<section>-<level>-<position>`, else one run per level in Walk Path order. Virtual locations never on the wall. Views use `LocationRef {code, aisle, level, section?, position?, is_best}`. Frontend owns pixels, crops and route lines only.
- AD-16: A drop sends one command (`move_parts`, `put_together`, `swap`); the backend expands it into Manual steps in the current round (chosen parts from→to, then back-parts to→from), sharing one `swap_id`; one transaction and version bump; a part chosen on both sides → `command_rejected`.
- AD-17: `domain/move_list.py` builds lines, order and swap marks. Header "rounds" = distinct rounds with a move; round numbers printed as stored (gaps kept), round 0 labelled "before the first run". Swap group marked only when intact. Print route refetches on mount and before printing, never reorders; repeating `<thead>`; "Page X of Y" best effort; black and white, A4 portrait. `generated_at` is the server instant, formatted client-side.
- AD-18: Limits (env, enforced in `swp.app`): `MAX_UPLOAD_BYTES` 4,000,000 (frontend pre-checks), `MAX_ROWS_PER_FILE` 25,000 (a test on a generated max-size import keeps every view < 4 MB), `MAX_PLANS` 50 and `MAX_ACCOUNTS` 200 only when `FEATURE_DEMO` is on. Login throttle per casefolded username: 5 failures → 60 s `login_locked`; demo bypasses it.
- AD-19: No CORS. Middleware rejects POST/PUT/PATCH/DELETE with `forbidden_origin` unless `Sec-Fetch-Site: same-origin`, or (header absent) `Origin` matches the host. JSON bodies only, except multipart `POST /api/plans`. No GET writes. Test `test_nfr6_cross_site_post_rejected`.
- AD-20: URL is the source of what is shown/selected: `/plans/{id}/{step}?aisle=&loc=&rec=&move=&part=`, built only by `frontend/lib/view-state`. localStorage only for last view per plan (`swp:plan:<id>:view`) and Key colours (`swp:colours`), wrapped in try/catch, colours applied before first paint by an inline script, memory fallback. In M1, `/` redirects to the most recently edited plan or `/plans/new` using the FR-8 list endpoint.

**Conventions**

- Naming: glossary terms verbatim; values `fast/medium/slow/dead`, `rule_1/rule_2/rule_3/manual`, causes `moved/filled/marks/partner_aisle/undo` (+ derived `moved_back`); package `swp`; plural API paths under `/api`; module `import_` not `import`.
- IDs: UUIDs for plan, import, run, user; recommendation `<run_id>:<n>`. Quantities and Walk Path are `Dec` as normalized decimal strings.
- Dates: instants stored in UTC, sent as ISO 8601 with `Z`, formatted only in the frontend in the viewer's zone; `data_as_of`, `period_start`, `period_end` as `YYYY-MM-DD`.
- Errors: domain raises `DomainError(code, message, details)`, which only `swp/api` turns into HTTP.
- Config: `swp/config.py` (pydantic-settings), zero env vars needed locally; analysis settings in `backend/settings/analysis.toml`, read only by `app.plans.create`; `.env.example` files hold no real values.
- Logging: stdlib logging to stdout, one line per request (method, path, status, ms), full traceback for `internal`.
- Fonts self-hosted via `@fontsource/figtree` and `@fontsource/barlow-semi-condensed`, never `next/font/google` or a CDN; `NEXT_TELEMETRY_DISABLED=1` in dev scripts; no runtime network calls locally.
- Tests: every test names its FR/NFR (SM-7), e.g. `test_fr26_partner_with_recommendation_waits`. Locations: `backend/tests/domain`, `backend/tests/app` (SQLite + Postgres in CI), `backend/tests/api` (TestClient), Vitest, Playwright `frontend/e2e` with projects chromium, firefox, msedge, each with a move-list print check, on `data/sample/`. One timing test `tests/app/test_nfr8_timing.py` (import, run, a command plus plan views).
- Data: only synthetic data in tests, fixtures and seeds; the demo account is the only seed; no preloaded plan.
- Keyboard path: every drag command has a keyboard path via `manual_move`.

**Environments and deployment**

- `local`: SQLite, bootstrap in lifespan, `FEATURE_DEMO` off, `FEATURE_AUTH` follows the milestone.
- `production` (Vercel, deferred to Epic 16): `APP_ENV=production`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET` scoped to Production. M1: auth and demo flags off (no front page). M2: both on. Run `uv run swp db upgrade` by hand before deploying a schema change.

**Milestone gates (PRD §7.1, SM-1, SM-2)**

- M1 build order: import → classification → pick groups → best locations → rule 1 → planning copy and before/after → rule 2 and rounds → rule 3. Gate: answer-key tests for M1 FRs pass and the README demo flow runs on `data/sample/`.
- M2 gate: SM-1 (all answer-key tests, incl. FR-2, FR-9, FR-12, FR-14, FR-29–FR-35, FR-51, FR-37, FR-38) and SM-2 (README demo flow from a clean checkout) pass in full.
- Answer-key dataset (`data/answer-key/`, `expected.json` → `steps`) is already made; import rejections, reset, reopen, delete and FR-31 use their own small fixtures.
- README must cover install/start, step-by-step demo import, running tests, the demo account (`demo`/`demo`), env setup (NFR-6), and that the public deployment holds synthetic data only.

### UX Design Requirements

From `DESIGN.md` (visual tokens and components) and `EXPERIENCE.md` (behaviour, states, journeys UJ-1–UJ-8). Milestone tags follow the PRD scope of the surface.

**Design tokens and foundations**

- UX-DR1 `[M1]`: Implement DESIGN.md's tokens as the Tailwind 4 theme: all colours (paper, graphite, class, meaning, focus, print), typography ramp (Barlow Semi Condensed for codes/counts, Figtree for reading; tabular numbers everywhere), radii (xs 1 → xl 8, full), spacing scale and fixed sizes (toolbar 64, controls 36/28/24, rule band 34, recommendation row 58, table row 24, bin 27×29, slot pitch 30, level pitch 40, section pitch 96, marker 17). Fonts self-hosted via @fontsource with the stated fallbacks. Light theme only; nothing below 11px on screen.
- UX-DR2 `[M1]`: Fixed focus ring component: on graphite a 2px `#141719` inner ring then 2px white outer ring, drawn above neighbours; on paper a 2px white gap then 2px ink ring. Never recoloured by Key colours, never confused with selection.
- UX-DR3 `[M1]`: Glyph set as filled SVG paths (▲ fast, ◆ medium, ▼ slow, slashed ring dead) at 9px in bins and 8px in swatches, plus the outline UI icon set (search, grid, lock, clock, pin, palette, warning triangle, check, link, chevron, plus, ×) at 1.6px stroke; no emoji or Unicode symbols. A class swatch on paper always sits in a 1.2–1.5px ink outline (yellow is never text or the only edge on white).

**Shell and navigation**

- UX-DR4 `[M1]`: App toolbar (64px louvre-pattern graphite, sticky except below ~500px viewport height): product mark (medium bin in fixed brand yellow), name, plan plate, flow bar, launcher button; from M2 the avatar (two initials on a 34px ink disc) opening the user menu ("Logged in as", username, Log out).
- UX-DR5 `[M1]`: Plan plate (≥214×42, 6px ink bar): plan name, "Data as of YYYY-MM-DD · round N" (round 0 before the first run), chevron; upload date in its tooltip; click/`Enter` opens the plan menu (M1: only New Plan; M2: up to five other recent plans, All saved plans, New Plan from this import; the plain New Plan item is gone from M2, Story 6.3).
- UX-DR6 `[M1]`: Flow bar with eight steps (Overview, Parts, Locations, Pick groups, Best locations, Recommendations, Before/after, Move list) as navigation, not a wizard; current step `aria-current="step"` as a white pill; check rules: steps 1–4 done once the plan exists, Best locations when ≥1 mark exists, Recommendations when the latest run has no open recommendation, Before/after and Move list never; the check is also visually hidden text ("Overview, step 1, done"). Below 1024px it collapses to "Step 6 of 8 · Recommendations ▾".
- UX-DR7 `[M2]`: Launcher (flow map drawer) on the grid button and `Ctrl+K`/`⌘K`: modal, page `inert`, focus in a search field; eight step columns (code OVR/PRT/LOC/GRP/BST/REC/B/A/MOV, state Done / You are here / Output / Not done yet, live counts, step actions); a band with the open plan, up to five other saved plans, SAV/NEW/SET, stage-2 plates (CAT, LBL: inert with "Coming in stage 2" and `aria-disabled` until Epics 13 and 14 made them links to Categories and Location labels) and the Keyboard box (Ctrl K, Ctrl /, Alt A, Esc, with "⌘ and ⌥ on a Mac."). The grid button and the launcher show only on plan paths. Typing replaces columns with one result list grouped Steps / Actions / Saved plans; `Enter` opens; no-match copy; `Esc` returns focus to the grid button. `Tab` between columns, `↑/↓` within.
- UX-DR8 `[M1]`: Keyboard shortcuts with modifiers only (no single-character shortcuts): `Ctrl/⌘+K` launcher (M2), `Ctrl/⌘+/` focuses the page search, `Alt/⌥+A` apply, `Alt/⌥+O` other location (M2), `Alt/⌥+K` keep in place (M2), `Esc` closes the topmost layer (tooltip → popover → dialog → panel → launcher). `Alt` shortcuts never fire in text fields.
- UX-DR9 `[M1]`: URL-driven view state (`/plans/{id}/{step}?aisle=&loc=&rec=&move=&part=`) through one `lib/view-state` helper; Back button behaves the same on every step; last view per plan restored from localStorage for bare URLs.

**Controls and feedback**

- UX-DR10 `[M1]`: Button hierarchy: one primary per surface (ink fill), secondary (ink outline) for repeatable commits, tertiary (border outline) for reversible/navigational, link (underlined ink), destructive (looks like primary, never red, only inside a confirm with Cancel focused). Disabled buttons keep their label, stay focusable with `aria-disabled="true"`, and show their reason on hover and focus via `aria-describedby`. Labels end with "…" when a dialog follows.
- UX-DR11 `[M1]`: Input (1px `#8A9097` boundary, paper focus ring, `Enter` submits, `Esc` clears then blurs) and input error (1.5px error boundary, warning icon and sentence, `aria-invalid`, `aria-describedby`). Plan name required: "Give the plan a name."; names need not be unique.
- UX-DR12 `[M1]`: Segmented control as a radio group with arrow keys; selection persists per plan (One aisle | Whole warehouse, Wall | List, Whole aisle | Level | Single location).
- UX-DR13 `[M1]`: Tabs with count pills (counts always visible incl. 0 and part of the tab name; arrow keys between tabs).
- UX-DR14 `[M1]`: Toast (sonner): ink strip ≤560px, bottom-left, one at a time, ≥10 s, paused on hover/focus, ≤1 action, `aria-live="polite"`, no slide under reduced motion. Undo appears only when Undo last move would reverse exactly what the toast reports; mark toasts never offer Undo (they offer View).
- UX-DR15 `[M1]`: Global notice strip under the toolbar (save failed, storage unavailable) with warning triangle and body-strong text.
- UX-DR16 `[M1]`: Dialog and confirm popover (Reset…, Delete…, Apply all): Cancel first and default-focused, modal stack at most one deep, focus returns to the opener.
- UX-DR17 `[M1]`: Listbox and menu pattern (Other location ▾, plan plate menu, row menu, manual-move autocomplete): rows 28px, highlighted row selected-tint plus ink left bar, codes in Barlow.
- UX-DR18 `[M1]`: Data table pattern (saved plans, pick groups, before/after, Open as list, Moves touching aisle): column heads in ink-secondary, hairline dividers, numbers right-aligned and tabular; each table a single tab stop with `↑/↓` between rows, `Enter` to open, `Tab` into the row's actions. Before/after cells read "Before → After" with the after value in body-strong when it differs.

**Import, plans, parts**

- UX-DR19 `[M1]`: New Plan screen: name field, three file tiles (Locations, Inventory, Transactions) or (M2) "Or reuse the import of a saved plan"; browser pre-check of total size ("These files are 5.2 MB together. One New Plan can upload at most 4 MB.", submit disabled); two-stage progress ("Uploading 3 files · 1.2 of 2.8 MB" with Cancel, then "Checking files and computing classes and pick groups…" with no Cancel); success opens the overview with the toast "<name> created. Data as of <date>."
- UX-DR20 `[M1]`: Import error panel (pale red, red border, warning triangle, bold "Import stopped: nothing was saved."), per-file lines "file · row N · column X: “value” …", up to 20 per file then "and N more in this file"; failing tile outlined red with the triangle, passed tiles show a check and stay selected; `role="alert"` linked to the failing tile. Exact copy for missing column, invalid value, unknown location, unreadable file, two warehouses, too many rows.
- UX-DR21 `[M1]`: Plan overview: data-as-of and upload dates, period, settings, counts per movement class, best and empty-best counts, parts kept in place.
- UX-DR22 `[M1]`: Read-only Settings view (analysis settings the plan was computed with; "changed in the config file, not in the app"); no colour settings there.
- UX-DR23 `[M1]`: Parts ranked roster: rank, miniature bin swatch, part number + description, why-line (class, picks, most relevant fact), right-hand columns for total stock, other locations, pick-group count, kept in place; ties in part-number order; class filter glyph chips; user-picked sorts follow AD-14.
- UX-DR24 `[M1]`: Part panel (400px side panel): number, description, class with glyph, picks and threshold, total stock, current and other locations (as chips), pick groups (partner, shared jobs, aisle), keep-in-place toggle (M2), Manual move…, Undo last move; focus moves to its heading on open, `Esc` returns focus to the opener. A part with no stock shows "No current location (no stock above zero)" and Manual move… disabled with that reason.
- UX-DR25 `[M1]`: Search field (Parts, Locations and wall headers; not the launcher): one field over part numbers, descriptions and location codes, results listed separately for parts and locations; a part result opens the part panel (M2: and selects its location on the wall); a location result opens the Locations table filtered to its aisle with the row focused (M2: opens the wall at that bin); no-match copy.
- UX-DR26 `[M1]`: Manual move dialog: from-location preselected when the part has one, to-location autocomplete over the Locations file; inline refusals for the from-location and virtual locations ("This is the from-location. Choose another." / "FLSKRS is a virtual location, not a shelf."); "to an occupied location: stock is added together"; driven by the server preview (AD-3). Shipped in M1 with Story 4.3 (not only from M2): the move-back case says "This undoes move 4: … and the move is removed." with confirm **Remove move**, and an FR-34 merge toast "Combined into one move: … (Manual)."
- UX-DR27 `[M1]`: Locations table (M1 page, later Open as list): FR-14 columns, aisle / occupied-empty / best filters, per-aisle and whole-warehouse occupancy line.
- UX-DR28 `[M1]`: Best-location marking on the table (M1): Whole aisle | Level | Single location mode, Level picker with "in this aisle | in all aisles", Mark/Unmark per row in Single mode, list of marks with remove buttons (≥24px, "Remove mark Level 1 in aisle A"), live "best · empty" counts; mark change toast "Best-location marks changed · N recommendations are now outdated" with View.
- UX-DR29 `[M1]`: Pick groups data table: part A, part B, shared jobs, each part's aisle, "Same aisle" (ink with link glyph) / "Different aisles"; server order; empty-state copy.
- UX-DR30 `[M2]`: Saved-plans list: rows (name, data-as-of, upload date, created/edited by and at) open the plan; row menu with Delete… and New Plan from this import; delete confirm dialog copy; empty state "No plans yet…" with "Demo files: data/sample/"; New Plan primary.

**Recommendations**

- UX-DR31 `[M1]`: Recommendations page as list (640px) + detail: header with round chip, run line ("Run 2026-11-11 09:42 by planner · 19 recommendations · 31 no space") and next-run line; Run recommendations (secondary; "Running…", disabled, list inert and dimmed, focus to first row afterwards); Apply all (n) with confirm popover; Undo last move (M2); "⋯" menu with Reset… (M2).
- UX-DR32 `[M1]`: State tabs Open · Applied · Kept in place (M2) · Outdated · No space, each grouped under rule bands (rule tag, rule name, ordering note) in rule order; recommendations numbered 1, 2, 3… across the round from the server; first 5 rows per rule then "Show N more under rule X"; identical no-space lines collapse ("30 more like this").
- UX-DR33 `[M1]`: Recommendations list is a single-select `listbox` with `aria-controls` to the detail; rows show number, class swatch, part, from → to (BEST tag on a best target), picks; selected row tinted with ink outline and 5px accent bar; outdated row hatched, struck-through target, clock + "Outdated" + cause; applied row ink check + "Applied · move N, round R"; no-space row with NO SPACE chip and plain cause.
- UX-DR34 `[M1]`: Recommendation detail panel: eyebrow "SELECTED · #1 · RULE 1", part, reason as plain sentences with numbers in bold (copy from `lib/copy`), move line from → to as codes with BEST (M1); M2 adds the From/To wall crops (`role="img"`, text name), "Show on the Locations wall" and "Moves in the planning copy" (last 3). Action bar: Apply (primary), Other location ▾ (M2), Keep in place (M2), Manual move…; outdated → Apply disabled with reason.
- UX-DR35 `[M1]`: Empty and edge states: no best locations ("Rule 1 and rule 2 need best locations. Rule 3 runs without them.", run still enabled); no run yet (Round 0 copy); run failed (all-or-nothing copy, button refocused); no moves found; empty Kept/Outdated/No space tabs.
- UX-DR36 `[M2]`: Other location ▾ listbox: the FR-31 allowed set from the server in location-code order with aisle, level, best; arrows only move the highlight, `Enter`/click applies; empty copy "No other location fits rule 1 right now."; no free text.
- UX-DR37 `[M2]`: Keep in place link (detail action bar, part panel, roster row): sets the mark at once, row moves to Kept in place, toast "<part> is kept in place. Remove the mark from the part or the Kept in place tab."; reads "Remove keep in place" when set; pin glyph + "kept in place" in roster and the wall tooltip (Epic 10); count on the overview.
- UX-DR38 `[M2]`: Undo last move whose tooltip, launcher action and toast all render the server `undo_preview` wording ("Undo move 3: …", "Undo splits move 3: …", "Undo restores move 4: …"); undo toast "Undid move 3. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue."; disabled "No moves to undo". Reset… confirm dialog with exact copy, **Reset plan** / **Cancel** (default), and reset toast.
- UX-DR39 `[M1]`: All outdated-cause copy in `lib/copy`: "A-11-02-02 was filled by a manual move." / "4410281 has been moved." / "The best-location marks changed." / "Partner 2007060 is no longer in aisle D." / "4410281 was moved back, so move 16 was removed." / "Outdated after undo."

**Warehouse wall (milestone 2)**

- UX-DR40 `[M2]`: Bin-wall rendering from the server layout (AD-15): graphite wall panel (louvre pattern, beams, uprights), levels top-down (L1 at bottom), two runs (first ⌈n/2⌉ sections on top), end cap "End of aisle A · Walk Path N →"; bin (class colour, lip shading, white label window with glyph; split label for two parts; three-plus shows the top part's glyph and a "+" tick; FST/MED/SLW/DED only at ≥56px); open slot (dark recess with rim, the occupancy cue); hatched no-location cell; bins ≥27px wide, scaling up to ~35px at 1440; wall panel scrolls in 2D inside itself.
- UX-DR41 `[M2]`: Best-location drawing on the wall by mark kind: level/whole-aisle marks → 4px green rail + BEST tag on level labels (aisle marks also tag the aisle tab and card); single marks → 2px green frame + "BEST n" on the level label; `#3DAE6B` on graphite, `#267A4B` on paper.
- UX-DR42 `[M2]`: Wall as `role="grid"` with exactly one tab stop: arrow keys across positions and levels (crossing runs), Page Up/Down between runs, Home/End and Ctrl+Home/End; no-location cells non-focusable and skipped; each cell's accessible name (code, level, best, occupied/empty with class, move state) and part lines as `aria-describedby`; focused cell scrolled into view clear of toolbar, notices and toasts.
- UX-DR43 `[M2]`: Location tooltip (WCAG 1.4.13): on focus or 150 ms hover; dismissible (`Esc`), hoverable, persistent; content = code, "Level N", BEST tag, Occupied · N parts / Empty, mark source(s), Walk Path, one line per part (swatch, number, description, class · picks · stock), partner strip; visual tooltip `aria-hidden`. `Enter`/click pins it as a non-modal dialog with actions (open part panel, Manual move… for the location's top part (most picks), Show recommendation #n).
- UX-DR44 `[M2]`: Moves on the wall: lifted bin (33×34, the only content shadow) with numbered marker for every latest-run recommendation whose from-location is on the wall; dashed targets with plus glyph; incoming-from-other-aisle target tooltip; markers for applied (ink disc + check), manual ("M"), outdated (grey dashed, no lift); only the selected move draws the cased violet arrow and hover note; selection linked both ways between list row, marker, lifted bin and drawer row; bin lift ≤200 ms, instant under reduced motion.
- UX-DR45 `[M2]`: Locations view chrome: One aisle | Whole warehouse switch (per plan); aisle tabs A–I (letter plate, %, moves) as a tab list plus the whole-warehouse figure; open-aisle header line ("86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270"), Open as list, Edit best-location marks; Whole warehouse view = four figures and nine aisle cards (3×3) with decorative mini-walls and the selected move as one route; selecting a card opens that aisle; opens on the last aisle or A.
- UX-DR46 `[M2]`: "Moves touching aisle A · Round 1 · N moves · N to decide" drawer under the Key: collapsed shows the selected move with Apply · Other location · Keep in place; "Show all N" opens the full table (Rule, Part, Class · picks, From, To, Status, Action) and "Open round 1".
- UX-DR47 `[M2]`: Best-location marking on the wall: Whole aisle | Level (with "in this aisle | in all aisles") | Single location modes; hover/focus previews ("Mark level 1 in aisle A", or "Unmark …" when that exact mark exists); level labels are buttons and the rail hit area is the whole level row (≥24px); marks list with remove buttons; live counts; same outdated toast as UX-DR28.
- UX-DR48 `[M2]`: Key under every wall, always visible, in fixed order with miniature graphics in current colours and glossary names (never colour words); six colour entries are buttons ("Fast-moving, change colour", `aria-haspopup="dialog"`, hover tint + palette icon); Empty and 2 parts are plain text. Every Key shows all six colour buttons, whether or not the wall draws that entry (decided 2026-11-26).
- UX-DR49 `[M2]`: Colour popover (non-modal dialog, 264px): title with glyph, 8 preset shades as a radiogroup (from DESIGN.md `colour-presets`, default marked), Default chip with hex, hex field (`#RRGGBB` validation) plus native picker button, live preview while arrowing, contrast warnings per pair (classes vs wall and open slot; best vs wall, slot and ink text 4.5:1; selection vs casing and white) and "too alike" warning at CIELAB ΔE76 < 20, announced via `role="status"`; Reset this colour; Done / click outside keeps, `Esc` restores; focus returns to the entry; flips to stay in viewport at 200% zoom. Best's paper shade derived by darkening; selected tint derived from selection. Stored in localStorage `swp:colours`, applied before first paint; storage-blocked note "Colours can't be kept in this browser; changes last until you reload or close this page."
- UX-DR50 `[M2]`: Drag on the wall (One aisle only, mouse-only, @dnd-kit): drag starts after >4px; dragged bin drawn lifted, vacated slot dashed; split label → the half under the pointer, three-plus → most picks; target feedback ("Move here" plus glyph / "Swap or put together" ⇄), no target on virtual, hatched or own slot; `Esc` or drop outside cancels; stays inside the open aisle. Drop on empty with one part → immediate move + toast "Moved 4410281: G-14-04-02 → G-14-01-04 (Manual, round 1)." (several parts moved: "Moved 2 parts: G-14-04-02 → G-14-01-04 (Manual, round 1)."). Otherwise the drop dialog popover: "Parts to move from …" checkboxes (when several), "Parts to move back to …" (Swap only, when several, all checked), Move / Swap / Put together / Cancel with disabled reasons, keep-in-place warning "4410297 is kept in place. Swap anyway?"; keyboard-operable; swap toast "Swapped A ↔ B · 2 manual moves, round 1."; previews and targets come from the server preview.

**Before/after, move list, auth, demo**

- UX-DR51 `[M1]`: Before/after page: per-aisle and total rows, moves in/out lists, fast-moving in best locations and pick groups in the same aisle as "Before → After"; "No moves yet: before and after are the same." note.
- UX-DR52 `[M2]`: Move list print view at `/plans/{id}/print` (the flow-bar step key stays `move-list`; `/plans/{id}/move-list` redirects there): screen preview with Print (primary) and "Back to Recommendations", app shell hidden in `@media print`; only the Print button refetches before printing, so a browser menu print (Ctrl/⌘+P) prints the view last fetched; A4 portrait, pure black on white, no reliance on printed backgrounds; repeating header "Move list · <plan>", "Data as of … · uploaded … · N rounds", "Generated YYYY-MM-DD HH:MM · Smart Warehouse Planner" (to the minute, so two printouts made within the same minute have the same header; the plan `version` is not printed); boxed ROUND N bands with "one walk · from-location before to-location" (ROUND 0 "before the first run"), kept with at least two lines through `break-after: avoid` (best effort: the browser decides, unchecked in Firefox); line = tick box · Round · Part · Description · From · To · Rule · Note (blank); swap lines "Manual · Swap 1/2" with "A ↔ B" under it and the swap footnote; order footnote; codes Barlow bold 12pt, text ~10pt; "There are no moves to print." with Print disabled and a link to Recommendations; "Page X of Y" best effort.
- UX-DR53 `[M2]`: Log in page (380px card): username, password with Show, submit, link to Create account, Demo version under an "or" rule (public deployment); one alert for wrong details (keeps username, clears and focuses password); lockout copy. Create account: username with hint "Letters and numbers. Must not be taken.", password with Show, Repeat password; errors checked on submit with focus to the first ("That username is taken. Try another." / "The passwords don’t match."); demo account-limit copy.
- UX-DR54 `[M2]`: Demo front page (public deployment only): graphite header (logo, name, "How it works", Log in), hero headline "Every move comes with a reason." with Log in (primary), Create account (secondary), Demo version (tertiary, play glyph), a large-scale bin wall with one lifted bin, arrow and reason card; "One part, start to finish" with four numbered panels following one demo part from export row to printed line; no synthetic-data notice, no README links, no footer text, no claims.
- UX-DR55 `[M1]`: Save and error states: plan-changing controls `aria-disabled` "Saving the last change…" while a command is unconfirmed; "Saved automatically" in the plate tooltip; retry notice then failure notice (AD-12); "Opening <plan>…" as text while loading (no spinner); "This plan was deleted." toast + redirect; (M2) session expired → Log in then resend; (M2) demo limits copy.
- UX-DR56 `[M1]`: Voice and copy rules: glossary terms verbatim, sentence case, digits with thousands separators, dates `YYYY-MM-DD` and times `HH:MM`, no exclamation marks, emoji or praise; "Recommended", never "Required"; never claims live stock, distance, capacity or savings; every plan surface shows the data-as-of date.

**Accessibility and responsive**

- UX-DR57 `[M1]`: WCAG 2.2 AA floor: no information by colour alone (class, occupancy, best, rule, outdated, no space, applied, selection each with shape/text); targets ≥24×24 (17px markers have equivalents); page announces its surface ("Recommendations, round 1, 19 recommendations, 31 no space"); run results, toasts and save status `aria-live="polite"`; import errors `role="alert"`; nothing hover-only; focus never trapped except in modals; text-spacing overrides grow rather than clip; reduced motion respected; animations ≤200 ms.
- UX-DR58 `[M1]`: Responsive reflow (desktop only): ≥1440 as drawn; 1280–1439 aisle tabs drop %, crops show 2 sections; 1024–1279 detail stacks under the list, part panel overlays; <1024 down to 320 one column, flow bar collapses, only the wall panel, crops and wide tables scroll in 2D inside themselves; the page never scrolls sideways; no "too narrow" notice.

### FR Coverage Map

| FR | Epic | What |
| --- | --- | --- |
| FR-1 | Epic 1 | New Plan from uploaded files |
| FR-2 | Epic 6 | New Plan from an existing plan's import |
| FR-3 | Epic 1 | Missing required columns |
| FR-4 | Epic 1 | Invalid values |
| FR-5 | Epic 1 | Locations in the import |
| FR-6 | Epic 1 | Normalize the imported data |
| FR-7 | Epic 1 | Data-as-of and upload dates |
| FR-8 | Epic 6 | Saved-plans list (Epic 1 has the M1 start redirect) |
| FR-9 | Epic 6 | Reopen with identical state |
| FR-10 | Epic 3 | Autosave: the command pipeline arrives with the first command |
| FR-11 | Epic 1 | Created by / last edited by (`planner` in M1; Epic 9 switches to the logged-in user) |
| FR-12 | Epic 6 | Delete a plan |
| FR-13 | Epic 2 | Parts list |
| FR-14 | Epic 2 | Locations list and occupancy |
| FR-15 | Epic 2 | Search |
| FR-16 | Epic 2 | Picks in the period |
| FR-17 | Epic 2 | Movement classes |
| FR-18 | Epic 1 | Settings snapshot (Epic 2 adds class and pick-group results to it) |
| FR-19 | Epic 2 | Find pick groups |
| FR-20 | Epic 2 | Show pick groups |
| FR-21 | Epic 3 | Mark and unmark best locations (on the wall: Epic 10) |
| FR-22 | Epic 3 | Show best locations (on the wall: Epic 10) |
| FR-23 | Epic 5 | Run the recommendations, rounds |
| FR-24 | Epic 5 | Rule 1 |
| FR-25 | Epic 5 | Rule 2 |
| FR-26 | Epic 5 | Rule 3 |
| FR-27 | Epic 5 | Limits and "no space" |
| FR-28 | Epic 5 | Reasons in numbers |
| FR-29 | Epic 5 | Outdated recommendations (the undo cause is completed in Epic 7) |
| FR-30 | Epic 5 | Apply and Apply all |
| FR-31 | Epic 7 | Apply with another suggested location |
| FR-32 | Epic 7 | Keep in place |
| FR-33 | Epic 4 | Manual moves |
| FR-34 | Epic 4 | Combine two moves (in `replay` from the start, AD-5) |
| FR-35 | Epic 7 | Undo and reset |
| FR-36 | Epic 4 | The import never changes |
| FR-37 | Epic 4 | Before/after table |
| FR-38 | Epic 8 | Move list print |
| FR-39 | Epic 9 | Create an account |
| FR-40 | Epic 9 | Log in and out |
| FR-41 | Epic 15 | Concurrent-edit warning (if time allows) |
| FR-42 | Epic 10 (wall) · Epic 11 (Key colours) | Warehouse view |
| FR-43 | Epic 13 | Keyword rules (stage 2) |
| FR-44 | Epic 13 | Categories for parts (stage 2) |
| FR-45 | Epic 13 | Aisle categories (stage 2) |
| FR-46 | Epic 13 | Category check (stage 2) |
| FR-47 | Epic 13 | Starter categories (stage 2) |
| FR-48 | Epic 14 | Location labels (stage 2) |
| FR-50 | Epic 9 | Demo version |
| FR-51 | Epic 12 | Drag to move or swap |

## Epic Design: Vertical Slices with a Shared Kernel

User decision 2026-11-17: each epic is a **vertical slice** whose code is as isolated as possible, and shared code lives in common folders (DRY). This refines the architecture's Structural Seed; it changes no AD.

**A slice owns, end to end:** its pure domain module(s) in `backend/swp/domain/<slice>.py`, its command types and views, its service in `backend/swp/app/<slice>/`, its router in `backend/swp/api/routers/<slice>.py`, its frontend module in `frontend/modules/<slice>/` (components, queries, route content), and its tests (`tests/domain/test_<slice>*`, `tests/app/…`, `tests/api/…`, `frontend/modules/<slice>/*.test.ts`, `frontend/e2e/<slice>.spec.ts`).

**Shared kernel and common folders (built once, reused by every slice):**

| Where | What lives there | Introduced by |
| --- | --- | --- |
| `backend/swp/domain/` kernel: `values.py`, `ordering.py`, `planning.py`, `state.py`, `state_migrations.py`, `commands.py`, `errors.py`, `views/common.py` | `Dec`, text order (AD-14), the shared facts and `replay` (AD-1, AD-5), `PlanState`, upcasters, the command union, `DomainError`, `LocationRef`/`PartRef` | Epic 1, extended by Epics 3–4 |
| `backend/swp/app/` shared: `plans.py`, `commands.py`, `bootstrap.py`, `limits.py` | plan creation (AD-4), the command service (AD-6), migrate/seed, limits | Epics 1, 3 |
| `backend/swp/store/` | the only persistence layer (AD-9) | Epic 1 |
| `backend/swp/api/` shared: `errors.py`, `deps.py`, `origin_guard.py`, `main.py` | error envelope (AD-11), dependencies, same-origin guard (AD-19) | Epic 1 |
| `frontend/components/ui/` | shadcn/Radix primitives | Epic 1 |
| `frontend/components/common/` | design-system components used by two or more slices: ClassGlyph, BinSwatch, LocationChip, BestTag, RuleTag, CountPill, DataTable, ConfirmDialog, GlobalNotice, PartPanel, ManualMoveDialog, SearchField, the wall primitives (Bin, Slot, WallGrid) | the first epic that needs each one |
| `frontend/lib/` | `api/` (generated schema and client), `commands/` (AD-12), `copy/` (AD-11), `view-state/` (AD-20), `format/` (dates, numbers) | Epics 1, 3 |
| `frontend/app/` | thin routes that mount a module | each slice |

**Isolation rules (enforced in CI):**
- A domain slice module imports only the domain kernel, never another slice module. Allowed exceptions, written into the import-linter config: `rules` reads `classify`/`pick_groups` result types; `recommendations` uses `rules`; `move_list` and `before_after` use `planning`. An `import-linter` independence contract covers the rest.
- A frontend module imports only `components/*` and `lib/*`, never another module (ESLint `no-restricted-imports`). Anything a second module needs moves to `components/common` or `lib` in the story that needs it. That move is part of the story, not a later refactor.
- Every plan change goes through the one command endpoint (AD-6). A slice adds its command types to `domain/commands.py` and their handlers to its own module. It adds no new endpoint for writes.

## Epic List

Epics run in this order. Epics 1–5 are milestone 1 (their last story is the M1 gate), Epics 6–12 are milestone 2 (Epic 12 ends with the M2 gate), Epics 13–14 are stage 2, Epic 15 is "if time allows", and Epic 16 (the public deployment) runs last, after the user has approved the website. Each epic builds on the earlier ones and never needs a later one.

### Epic 1: Start a plan from the warehouse's exports `[M1]`
The planner uploads the three export files, gets either a plan or an exact list of what is wrong with each file, and sees the plan overview with its data-as-of date and settings. Includes the local walking skeleton with CI (deployment comes in Epic 16), the design tokens and app shell (toolbar, plan plate, flow bar), the shared kernel and the M1 start redirect.
**FRs covered:** FR-1, FR-3, FR-4, FR-5, FR-6, FR-7, FR-11, FR-18
**Slice:** `domain/import_`, `app/imports` (readers), `app/plans`, `modules/new-plan`, `modules/overview`, `modules/settings` · **UX-DRs:** 1–6, 9–11, 15, 19–22, 55–58

### Epic 2: Explore parts, locations and pick groups `[M1]`
The planner sees every part with its movement class and picks, every location with occupancy, the pick groups, and can search for any part or location.
**FRs covered:** FR-13, FR-14, FR-15, FR-16, FR-17, FR-19, FR-20
**Slice:** `domain/classify`, `domain/pick_groups`, `domain/views/{parts,locations,pick_groups,search}`, `modules/{parts,locations,pick-groups}` · common: PartPanel, SearchField, DataTable, ClassGlyph · **UX-DRs:** 13, 18, 23–25, 27, 29

### Epic 3: Mark best locations `[M1]`
The planner marks whole aisles, levels and single locations as best from the locations table, and sees the best and empty-best counts. This is the first change to a plan, so it brings the command pipeline and autosave.
**FRs covered:** FR-21, FR-22, FR-10
**Slice:** `domain/marks`, `modules/best-locations` · shared: `app/commands`, `lib/commands`, the command endpoint · **UX-DRs:** 12, 14, 16, 28

### Epic 4: Try moves in the planning copy and compare before/after `[M1]`
The planner moves parts by hand in the planning copy (the import never changes) and sees, aisle by aisle, what moves in and out, fast-moving parts in best locations and pick groups in the same aisle.
**FRs covered:** FR-33, FR-34, FR-36, FR-37
**Slice:** `domain/planning` (step log, `replay`, preview), `domain/before_after`, `modules/before-after` · common: ManualMoveDialog · **UX-DRs:** 26, 51

### Epic 5: Get explained recommendations and apply them `[M1]`
The planner runs the recommendations in rounds (rule 1, then rule 2, then rule 3, with their limits and "no space"), reads the reason behind each in numbers, sees which recommendations are outdated and why, and applies them one at a time or all at once. It ends with the M1 gate: the answer-key tests and the README demo flow on `data/sample/`.
**FRs covered:** FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30
**Slice:** `domain/rules`, `domain/recommendations`, `modules/recommendations` · **UX-DRs:** 8 (Alt+A), 17, 31–35, 39

### Epic 6: Keep, reopen and manage saved plans `[M2]`
The planner sees all saved plans, reopens any of them exactly as it was left, starts a new plan from an existing import, deletes plans, and jumps anywhere with the launcher.
**FRs covered:** FR-2, FR-8, FR-9, FR-12
**Slice:** `app/plans` (list, delete, reuse), `modules/plans`, `modules/launcher` · **UX-DRs:** 7, 30

### Epic 7: Refine the plan: other location, keep in place, undo and reset `[M2]`
The planner applies a recommendation with another allowed location, declines one with keep in place, undoes moves one at a time with exact undo text, and resets the planning copy.
**FRs covered:** FR-31, FR-32, FR-35
**Slice:** commands `apply_other_location`, `set_keep`/`remove_keep`, `undo`, `reset` in `domain/recommendations` and `domain/planning`; extends `modules/recommendations` · **UX-DRs:** 36–38

### Epic 8: Print the move list for colleagues `[M2]`
The planner prints a black-and-white move list in round order, with moves out of a location before moves into it, swap lines marked, and a header with the plan, its data and the generated time. Colleagues can follow it without the app.
**FRs covered:** FR-38
**Slice:** `domain/move_list`, `app/plans/[id]/print`, `modules/move-list` · **UX-DRs:** 52

### Epic 9: Accounts, login and the public demo `[M2]`
Anyone can create an account and log in. Plans record the logged-in user. On the public deployment a demo front page offers Log in, Create account and Demo version.
**FRs covered:** FR-39, FR-40, FR-50
**Slice:** `app/auth`, `api/routers/auth`, `modules/auth`, `modules/front-page` · **UX-DRs:** 4 (avatar), 53, 54

### Epic 10: See and mark the warehouse as a bin wall `[M2]`
The planner sees each aisle as a shelf wall, and the whole warehouse at overview scale, with movement class, occupancy and best locations. The planner reads tooltips by keyboard or mouse, sees recommendations as lifted bins with crops in the recommendation detail, and marks best locations on the wall.
**FRs covered:** FR-42 (wall), FR-21 and FR-22 on the wall
**Slice:** `domain/layout`, `modules/locations` (wall), common wall primitives (Bin, Slot, WallGrid) reused by the crops and Best locations · **UX-DRs:** 40–47

### Epic 11: Change the Key colours `[M2]`
The planner changes any of the six Key colours from the wall's Key, gets contrast and likeness warnings, and keeps the choice in this browser.
**FRs covered:** FR-42 (Key colours)
**Slice:** frontend-only: `lib/colours` (contrast and ΔE checks, storage) plus the Key buttons and colour popover in `components/common/wall` (four modules draw the Key, and modules may not import each other) · **UX-DRs:** 48, 49

### Epic 12: Drag parts to move or swap them on the wall `[M2]`
The planner drags a part on the wall to an empty location, or onto an occupied one to swap or put together, and chooses which parts move. It ends with the M2 gate: SM-1 and SM-2 in full.
**FRs covered:** FR-51
**Slice:** commands `move_parts`/`put_together`/`swap` (AD-16), `modules/locations/drag` · **UX-DRs:** 50

### Epic 13: Category check `[S2]`
The planner maintains keyword rules and aisle categories and sees every part sitting in an aisle that is not meant for its category. Starter rules for the demo data are included.
**FRs covered:** FR-43, FR-44, FR-45, FR-46, FR-47

### Epic 14: Location labels with QR codes `[S2]`
The planner prints a label with a scannable QR code for every location in an aisle.
**FRs covered:** FR-48

### Epic 15: Concurrent-edit warning `[ITA]`
A planner who changes a plan that someone else saved meanwhile is warned and can reload or continue on top.
**FRs covered:** FR-41

### Epic 16: Go live on the public URL `[DEPLOY]`
After the user has approved the website locally, the app is deployed to the public Vercel URL against Supabase Postgres, first as the skeleton check and then with login and the demo on, so examiners can use it there.
**FRs covered:** none new; it ships FR-40 and FR-50 to production (NFR-5, NFR-6) · **Not part of the autonomous run:** it needs the user's Vercel and Supabase accounts.

## Epic 1: Start a plan from the warehouse's exports

The planner uploads the three export files and gets either a plan or an exact list of what is wrong with each file. The plan opens on its overview, which shows the data-as-of date and the settings. This epic also lays the walking skeleton, the shared kernel and the app shell that every later slice reuses.

### Story 1.1: Local walking skeleton

As the planner (and the author),
I want the app to start locally with one command, with the layer and slice rules checked from the first commit,
So that every later slice is built on a running base that keeps its boundaries.

**Acceptance Criteria:**

**Given** a clean checkout with Node 24, uv and Python 3.12 installed
**When** I run `npm install` and `npm run dev` in the repo root
**Then** concurrently starts `uvicorn swp.main:app` on :8000 and `next dev` on :3000 with `NEXT_TELEMETRY_DISABLED=1`
**And** `http://localhost:3000/api/health` is rewritten to the backend and returns 200 after `SELECT 1` on the local SQLite file `backend/var/swp.db` (created if missing), with zero env vars set (NFR-2).

**Given** the structural seed in the architecture spine
**When** the scaffold is created
**Then** `backend/` has `pyproject.toml`, `uv.lock`, `.python-version` (3.12), `alembic.ini`, `.importlinter` and the package `swp` with `domain/`, `app/`, `store/`, `api/`, `config.py` (pydantic-settings), `cli.py` and `main.py`, and every router is mounted under `/api`
**And** `frontend/` is Next.js 16 App Router with React 19, TypeScript 5.9, Tailwind 4, shadcn (`init -b radix`) in `components/ui/`, TanStack Query, and empty `components/common/`, `modules/` and `lib/` folders
**And** the versions match the spine's Stack table.

**Given** the layer rules (AD-1, AD-2) and the slice rules (Epic Design section)
**When** ruff, import-linter and ESLint run locally (one documented command each)
**Then** `swp.domain` may import only the stdlib and pydantic, only `swp.store` may import SQLAlchemy, `uuid4`, `datetime.now` and `random` are banned in `swp.domain` through ruff `banned-api`, and frontend modules may not import each other (ESLint `no-restricted-imports`)
**And** a deliberate violation of each rule makes its check fail.

**Given** the git-ignore convention
**When** the scaffold story ends
**Then** `.gitignore` covers `backend/var/` (with `-wal`/`-shm`/`-journal`), `data/private/*`, `.env*` except `.env.example` files, and the test and Playwright outputs (NFR-4)
**And** the README has the install, start and test commands
**And** no dependency calls a language model or AI service, and the app makes no runtime network calls locally (NFR-2, NFR-3).

### Story 1.2: CI on every push

As the author,
I want every push checked by GitHub Actions on SQLite and Postgres,
So that a broken rule, test or schema never reaches `main` unnoticed.

**Acceptance Criteria:**

**Given** a push to any branch
**When** GitHub Actions runs `ci.yml`
**Then** it runs ruff, import-linter, ESLint, pytest on SQLite, `tests/app` against a Postgres 17 service container, the frontend typecheck and Vitest, and the job is green on the skeleton
**And** a `tests/app` test runs the `/api/health` `SELECT 1` against Postgres, so the Postgres job tests something from day one.

**Given** the layer and slice checks from Story 1.1
**When** a deliberate violation is pushed in a throwaway branch
**Then** CI fails on it, and the branch is deleted afterwards
**And** the OpenAPI schema diff (AD-13) is added to `ci.yml` by the story that first generates `schema.ts`, not here.

Story 1.3 (the public Vercel deployment) was moved to Story 16.1 on 2026-11-19; deployment is deferred until the user has approved the website. The story numbers 1.4–1.9 are kept.

### Story 1.4: App shell and design foundation

As a planner,
I want the app to open in its own clear, consistent look with the toolbar and the eight-step flow,
So that I always see where I am and every later screen looks and behaves the same.

**Acceptance Criteria:**

**Given** the DESIGN.md tokens
**When** the frontend builds
**Then** the Tailwind 4 theme defines every colour, the typography ramp, radii, the spacing scale and the fixed sizes from DESIGN.md (UX-DR1), and Barlow Semi Condensed and Figtree load from `@fontsource` packages with their fallbacks, never from a CDN or `next/font/google`
**And** all numbers use tabular figures and no screen text is below 11px.

**Given** any focusable element
**When** it receives keyboard focus
**Then** it shows the fixed focus ring: on paper a 2px white gap and a 2px ink ring, on graphite a 2px `#141719` inner ring and a 2px white outer ring (UX-DR2).

**Given** the shared component set
**When** the story is done
**Then** `components/common/` holds ClassGlyph (▲ ◆ ▼ slashed ring as SVG paths), the UI icon set (search, grid, lock, clock, pin, palette, warning, check, link, chevron, plus, ×), Button (primary, secondary, tertiary, link, destructive, disabled with `aria-disabled` and a reason linked by `aria-describedby`), Input and InputError, Toast (sonner, bottom-left, one at a time, ≥10 s, paused on hover or focus, `aria-live="polite"`), GlobalNotice and ConfirmDialog (Cancel first and focused) (UX-DR3, UX-DR10, UX-DR11, UX-DR14–UX-DR16)
**And** all UI text is English and uses the PRD glossary terms verbatim (NFR-11)
**And** `lib/format` formats dates as `YYYY-MM-DD`, times as `HH:MM` in the viewer's zone, and numbers with thousands separators (UX-DR56).

**Given** the app is opened with no plan
**When** the page renders
**Then** the 64px graphite toolbar shows the product mark (fixed brand yellow), the name "Smart Warehouse Planner" and the flow bar with its eight steps (Overview, Parts, Locations, Pick groups, Best locations, Recommendations, Before/after, Move list) in the not-reached style, and no plan plate yet (UX-DR4, UX-DR6)
**And** the toolbar scrolls with the page below about 500px viewport height, and below 1024px the flow bar collapses to "Step N of 8 · <name> ▾" (UX-DR58).

**Given** reduced motion is requested
**When** a toast or popover appears
**Then** it appears without sliding, and nothing animates longer than 200 ms (UX-DR57).

### Story 1.5: Read the files and check their columns and values

As a planner,
I want each uploaded file read the same way and checked for required columns and valid values,
So that a bad export is stopped with the exact file, row and column instead of silently changing the results.

**Acceptance Criteria:**

**Given** a `.xlsx` file
**When** `app/imports/readers.py` reads it
**Then** it uses openpyxl with defusedxml, read-only and values-only, on the first worksheet only, rejects a file over 50 MB uncompressed before opening it, stops at row `MAX_ROWS_PER_FILE + 1`, after 100 columns and at 1,000 characters per cell, and turns a float into `Decimal(repr(f))` (AD-8)
**And** the result is a `RawSheet` of typed cells (`str | int | Decimal | datetime | date | None`).

**Given** a `.csv` file
**When** it is read
**Then** it must be UTF-8 (a BOM is stripped; anything else is rejected with the file name), and the delimiter is whichever of `,` and `;` appears more often in the header row
**And** any other extension, or a file that can't be read, is rejected with a message naming the file (FR-4).

**Given** three `RawSheet`s
**When** `domain.import_` validates them
**Then** the header is the first non-blank row, names match trimmed and ignoring case, fully blank rows are skipped, and rows are reported as spreadsheet rows with the header as row 1
**And** a missing required column (Locations: Location, Walk Path, Aisle, Level; Inventory: Part, Part Description, Quantity, Location; Transactions: Transaction Type, Part, Location, Transaction Code, Date) or a duplicated required column fails that file with a message naming the file and the column (FR-3).

**Given** required cells with values
**When** they are validated
**Then** a blank required cell, a Quantity that is not a number or is negative, a Walk Path that is not a number, a Date that is not a date cell, `YYYY-MM-DD` or `DD.MM.YYYY` (with an optional time that is discarded), a number with thousands separators, a non-integral identifier, or a location code that appears twice in the Locations file each give an error with file, row, column and value (FR-4)
**And** a file with no data rows is rejected.

**Given** a failing file
**When** the errors are returned
**Then** they are `import_invalid` details per file: `{file_role, file_name, status: passed | failed | not_checked, errors: [{row, column, message}] (at most 20), more_count}`, and every error in every file is reported, not just the first
**And** domain tests named `test_fr3_*` and `test_fr4_*` cover each rejection with small synthetic fixtures.

### Story 1.6: Check locations, normalize the data and find the data-as-of date

As a planner,
I want the import to check that every shelf line points to a real location, to keep codes exactly as exported and to merge duplicates,
So that the plan is built on data I can trust and I know how current it is.

**Acceptance Criteria:**

**Given** a valid set of three files
**When** `domain.import_` checks locations
**Then** an inventory row or a shelf line (Move to Repair, Return to Stock, Receipt) whose location is not in the Locations file fails with file, row and location, an Issue Part line at a virtual location such as `FLSKRS` is accepted, and lines of other transaction types are accepted and ignored (FR-5)
**And** Transaction Type matches the four known names ignoring case.

**Given** text and identifier cells
**When** they are normalized
**Then** text is trimmed (non-breaking spaces included) and keeps its case, an integral numeric identifier becomes integer text without `.0`, and part numbers and location codes are kept as text exactly as in the file, for example `0100`, `1008614-00`, `A-01-01-01-A1` and `06-01-30-D1` (FR-6)
**And** inventory rows that repeat the same part in the same location are merged with their quantities added, and zero-stock rows are kept.

**Given** a Warehouse column
**When** it holds more than one distinct value, within one file or across the three files
**Then** the import is rejected with a message naming the file (FR-6).

**Given** a passing import
**When** the normalized import is built
**Then** it holds `locations` keyed by code, the merged `inventory`, `parts` with the first non-blank description in file order, the `transactions` reduced to the fields the analysis needs, `schema_version`, and `data_as_of` = the newest date over every data row of the Transactions file (FR-7, AD-4)
**And** the answer-key files in `data/answer-key/` pass and give `data_as_of` 2026-09-30.

### Story 1.7: Create and store a plan from three files

As a planner,
I want a plan to be created and saved only when all three files pass,
So that a plan never rests on a half-imported file and is still there after a restart.

**Acceptance Criteria:**

**Given** the store layer
**When** the first Alembic migration runs (through `swp.app.bootstrap`, from the lifespan locally and `swp db upgrade` in production)
**Then** it creates only the `imports` and `plans` tables: the import row (`id`, `uploaded_at`, `data_as_of`, `data` JSON) and the plan row (`id`, `name`, `import_id` FK `ON DELETE RESTRICT`, `created_by/at`, `last_edited_by/at`, `version`, `analysis` JSON, `state` JSON), using only portable types (`Uuid`, `JSON`, `UtcDateTime`) (AD-4, AD-9)
**And** `PlanState.new()` declares every state field with defaults (marks, keep marks, runs, steps, `next_move_number`, `recent_commands`) and `schema_version`, with an upcaster chain in `domain/state_migrations.py` and a `state_v1` fixture.

**Given** `POST /api/plans` (multipart: name and three files)
**When** all three files pass
**Then** one transaction stores the import, the plan and its `analysis`, which `app.plans.create` computes from `backend/settings/analysis.toml` with the period start and end and the settings snapshot (FR-1, FR-18)
**And** `created_by` and `last_edited_by` are `planner`, and `last_edited_at` equals `created_at` (FR-11, AD-10 with auth off).

**Given** any file fails
**When** the request ends
**Then** the response is 422 `import_invalid` in the AD-11 envelope with the per-file details, and no import row or plan row exists afterwards (FR-1, FR-3–FR-5).

**Given** the limits
**When** a request is larger than `MAX_UPLOAD_BYTES` (4,000,000) or a file has more than `MAX_ROWS_PER_FILE` (25,000) rows
**Then** it is rejected with `limit_reached` (413) and a message such as "transactions.xlsx has more than 25,000 rows. One file can hold at most 25,000." (AD-18)
**And** `GET /api/session` returns `{user: null, feature_auth: false, feature_demo: false, max_upload_bytes}`.

**Given** the shared API pieces
**When** any error is raised
**Then** `swp/api/errors.py` returns the `{"error": {code, message, details}}` envelope, FastAPI request-validation errors become `validation_failed`, the same-origin guard rejects cross-site POST/PUT/PATCH/DELETE with `forbidden_origin` (`test_nfr6_cross_site_post_rejected`), and each request logs one line (method, path, status, ms) (AD-11, AD-19)
**And** `swp openapi` and `openapi-typescript` generate `frontend/lib/api/schema.ts`, and CI fails on a diff (AD-13).

**Given** the demo files in `data/sample/`
**When** they are posted
**Then** a plan is created within the NFR-8 budget (checked later by `test_nfr8_timing.py`), and after a backend restart the plan and its import are still there (NFR-12, `tests/app` on SQLite and on Postgres in CI).

### Story 1.8: New Plan screen with upload progress and import errors

As a planner,
I want to name a plan, choose the three files and see either the new plan or exactly what to fix,
So that I can start planning from a fresh export without guessing.

**Acceptance Criteria:**

**Given** the New Plan page (`/plans/new`, `modules/new-plan`)
**When** it opens
**Then** it shows a required name field, three file tiles (Locations, Inventory, Transactions) and New Plan as the one primary button
**And** submitting without a name shows "Give the plan a name." under the field; plan names need not be unique.

**Given** chosen files larger than `max_upload_bytes` together
**When** the total is computed in the browser
**Then** nothing is sent, the page says "These files are 5.2 MB together. One New Plan can upload at most 4 MB.", and submit stays disabled until a file is replaced.

**Given** a valid submit
**When** the upload runs
**Then** the page shows "Uploading 3 files · 1.2 of 2.8 MB" with Cancel, which stops the upload and saves nothing; then one server step "Checking files and computing classes and pick groups…" with no Cancel
**And** submit is disabled while the request is in flight and the request is never retried (AD-6).

**Given** the server returns `import_invalid`
**When** the errors are shown
**Then** a `role="alert"` panel starts with "Import stopped: nothing was saved." and lists each failing file's errors as "<file> · row N · column X: “value” …", up to 20, then "and N more in this file"
**And** the failing tile is outlined red with a warning triangle, passed tiles show a check and stay chosen, so only the failing file is re-chosen (UX-DR19, UX-DR20).

**Given** a successful import
**When** the plan is created
**Then** the plan's overview opens with the toast "<name> created. Data as of <date>."
**And** a Playwright test imports `data/sample/` in Chromium.

### Story 1.9: Plan overview, settings and the milestone 1 start

As a planner,
I want the plan to open on an overview of its data and settings, and the app to take me straight to my latest plan,
So that I can see what the plan is built on before I change anything.

**Acceptance Criteria:**

**Given** a stored plan
**When** `GET /api/plans/{id}` is called
**Then** it returns the plan summary (AD-3): name, data-as-of date, upload instant, current round (0), `version`, and each step's check state and counts; a GET never writes and never changes `last_edited_*` (FR-9).

**Given** the overview route `/plans/{id}/overview`
**When** it renders
**Then** it shows the data-as-of date, the upload date (the local date of `uploaded_at`), the period start and end, the settings, and the counts per movement class (zero until Epic 2 fills them) (FR-7, FR-18, UX-DR21)
**And** while loading it shows "Opening <name>…" as text, with no spinner.

**Given** an open plan
**When** the toolbar renders
**Then** the plan plate shows the name and "Data as of YYYY-MM-DD · round 0", with the upload date in its tooltip, and its menu holds only New Plan (UX-DR5)
**And** the flow bar marks the current step with `aria-current="step"` and checks steps 1–4 with visually hidden "done" text; every step link uses the `lib/view-state` URL helper (`/plans/{id}/{step}`) (UX-DR6, UX-DR9).

**Given** the Settings view
**When** it opens from the overview
**Then** it shows the plan's settings read-only with "Changed in the config file, not in the app." (UX-DR22).

**Given** `/`
**When** it is opened in milestone 1
**Then** it redirects to the most recently edited plan, or to `/plans/new` when there is none, using the list endpoint `GET /api/plans` (FR-8, AD-20)
**And** New Plan always creates a new plan and earlier plans stay stored.

**Given** any request returns `plan_not_found`
**When** the frontend handles it in the shared TanStack Query error hook
**Then** the toast "This plan was deleted." shows and New Plan opens (AD-12, UX-DR55).

## Epic 2: Explore parts, locations and pick groups

The planner sees every part with its movement class and picks, every location with its stock and occupancy, and every pick group with its shared jobs, and can find any part or location from one search field. Classes and pick groups are computed once at import from the frozen import, and every view reads the plan as it is now. This epic builds the classify and pick-groups slices, the read-only views, and the first shared list components.

### Story 2.1: Count picks and classify every part

As a planner,
I want every part classified by how often it was picked in the period,
So that I can see which parts are fast-moving, medium-moving, slow-moving or dead stock.

**Acceptance Criteria:**

**Given** a normalized import and the plan's settings snapshot
**When** `domain/classify.py` counts picks
**Then** each Move to Repair line dated in the period counts as one pick whatever its quantity, Issue Part, Return to Stock and Receipt lines never count, and a line counts by its date only, the time of day ignored (FR-16)
**And** the period is the 12 months up to and including `data_as_of`, starting the day after the same date one year earlier: a line on 2026-09-30 counts, and lines on 2025-09-30, including 2025-09-30 09:00, do not (`test_fr16_period_boundaries`).

**Given** the pick counts
**When** each part in the Inventory file is classified
**Then** it gets exactly one class: 24 or more picks → `fast`, 6–23 → `medium`, 1–5 → `slow`, 0 → `dead`, with the limits read from the settings snapshot, never hard-coded (FR-17, FR-18)
**And** parts that appear in the Transactions file but not in the Inventory file (such as `9999` in the answer key) are not classified.

**Given** the answer-key dataset in `data/answer-key/`
**When** the domain tests run
**Then** every part gets the picks and class in `expected.json`, including the boundary parts `9000` (0), `0100` (1), `0500` (5), `0600` (6), `2300` (23) and `10240`/`2400` (24) (`test_fr17_answer_key_classes`).

**Given** `app.plans.create`
**When** a plan is created from files (Story 1.7)
**Then** `analysis` now holds the movement class and picks of every part, computed from the stored import with the plan's settings snapshot, and the plan reopens with the same classes even if `analysis.toml` changes later (FR-18, AD-4)
**And** the overview's counts per movement class (left at zero in Story 1.9) show the real counts, and `GET /api/plans/{id}` returns them.

### Story 2.2: Find pick groups

As a planner,
I want the tool to find parts that are used together on the same jobs,
So that parts picked for the same work can later be placed in the same aisle.

**Acceptance Criteria:**

**Given** the Issue Part lines in the period
**When** `domain/pick_groups.py` builds jobs
**Then** a job is all Issue Part lines in the period that share a transaction code, a zero transaction code (`0`, `00`, `0.0`, `0,0`, `-0`, …) never forms a job, a job with more than 100 distinct parts adds no pairs, a part that appears several times on one job counts once for that job, and only parts in the Inventory file are considered (FR-19)
**And** the shared jobs of two parts is the number of jobs on which both appear.

**Given** two parts with shared jobs
**When** the pick-group minimum from the settings snapshot is applied
**Then** 5 or more shared jobs form a pick group and 4 do not, and each part is the other's partner (FR-19, FR-18).

**Given** the answer-key dataset
**When** the domain tests run
**Then** the pick groups are exactly those in `expected.json`, including a part in several pick groups (`8100` with `8200` and `8300`) and exactly-5 pairs (`30400`–`3050`, `0600`–`2300`) (`test_fr19_answer_key_pick_groups`)
**And** `6100`–`6200` is not a pick group despite its three traps (a repeated part on one job, a shared code `0`, a job dated 2025-09-30), and `9999`'s 6 shared jobs with `6100` form no pick group because `9999` is not in the Inventory file (`test_fr19_traps_do_not_count`).

**Given** `app.plans.create`
**When** a plan is created
**Then** `analysis` also holds every pick group (both parts and the shared jobs), in the rule-defined order from `domain/ordering.py`: most shared jobs first, ties by the lower part number, then by the higher, in text order (AD-14)
**And** creating a plan from `data/sample/` with classes and pick groups stays within the NFR-8 import budget (under 10 s).

### Story 2.3: Parts roster

As a planner,
I want a ranked list of every part with its class, picks, stock and locations,
So that I can see at a glance which parts move and where they sit, without combining three Excel files.

**Acceptance Criteria:**

**Given** the shared facts
**When** this story adds them to the domain kernel
**Then** `domain/planning.py` holds the only implementations of `planning_copy(import, state)` (in this epic the import itself, since no moves exist yet), `stock_at`, `is_empty`/occupied, `current_location` (the location with the most stock; on equal stock, the first in location-code order; none when no stock is above zero) and `aisle_of` (AD-1)
**And** domain tests cover `1200` (current location B-01-01-02, the larger stock), `4400` (equal stock, current A-01-03-02 by location-code order) and `1008614-00` (no current location) (`test_fr13_current_location`).

**Given** `GET /api/plans/{id}/parts` (`domain/views/parts.py`, router `api/routers/parts.py`)
**When** it is called
**Then** each part in the Inventory file has part number, description, total stock, current location, other locations, movement class, picks, number of pick groups and a kept-in-place flag (always false until keep in place exists), and the response carries the plan `version` (FR-13, AD-3)
**And** parts come in rule-defined order (most picks first, ties in part-number text order) from `domain/ordering.py`, with a server `sort_rank` for decimal columns (AD-14).

**Given** the Parts step (`/plans/{id}/parts`, `modules/parts`)
**When** it renders
**Then** each roster row shows the rank, a `BinSwatch` miniature bin with its `ClassGlyph` inside an ink outline, the part number in Barlow over the description, a why-line ("Fast-moving · 61 picks · G-14-04-02"), and right-hand columns for total stock, other locations, pick-group count and kept in place (UX-DR23)
**And** a part with no current location reads "No current location (no stock above zero)" in place of the code (UX-DR24).

**Given** the roster
**When** the planner filters or sorts
**Then** glyph chips (Fast-moving ▲, Medium-moving ◆, Slow-moving ▼, Dead stock) filter by movement class, and sorting by picks compares numbers numerically, text with `<`/`>` (never `localeCompare`), and keeps server order on ties (FR-13, AD-14)
**And** the roster is a table that is a single tab stop, with `↑`/`↓` between rows (UX-DR18).

**Given** list components now needed by more than one step
**When** they are built
**Then** `BinSwatch` and `DataTable` (column heads in ink-secondary, hairline dividers, numbers right-aligned and tabular, one tab stop, `↑`/`↓` rows, `Enter` opens) live in `components/common/`, and `modules/parts` imports nothing from another module (UX-DR18).

### Story 2.4: Locations table with occupancy

As a planner,
I want every location listed with the parts and stock in it, and the occupancy of each aisle and of the whole warehouse,
So that I can answer "what is in this aisle?" and "how full is it?".

**Acceptance Criteria:**

**Given** `GET /api/plans/{id}/locations` (`domain/views/locations.py`, router `api/routers/locations.py`)
**When** it is called
**Then** each location in the Locations file has its code, aisle, level, Walk Path, occupied or empty, best or not (always false until marks exist), and each part stored there with its stock, as a `LocationRef` plus its contents (FR-14, AD-15)
**And** locations, aisles and levels come in the order from `domain/ordering.py`, with all-digit Level values sorted numerically (AD-14).

**Given** a location whose inventory rows all have stock 0
**When** occupancy is computed with the shared `is_empty`
**Then** it is shown as empty and counts as empty (`A-01-01-03` in the answer key) (`test_fr14_zero_stock_location_is_empty`).

**Given** the locations view
**When** occupancy is summed
**Then** each aisle and the whole warehouse show occupied and empty counts and the occupancy percentage, matching the answer key before any move (A 8/1, B 8/4, C 6/3, D 6/3) (`test_fr14_occupancy_per_aisle`)
**And** on `data/sample/` the whole warehouse shows 1,584 occupied and 416 empty locations.

**Given** the Locations step (`/plans/{id}/locations`, `modules/locations`)
**When** it renders in milestone 1
**Then** it is the FR-14 table built on the common `DataTable`, with filters for aisle, occupied/empty and best location, and a line with the per-aisle and whole-warehouse occupancy, for example "86.8% occupied · 198 of 228 locations · 30 empty" (UX-DR27)
**And** occupancy is shown by the words "occupied"/"empty" and the counts, never by colour alone (NFR-10, UX-DR57).

**Given** a URL with `?aisle=` and `?loc=`
**When** the Locations step opens
**Then** the aisle filter is set and the row of that location is focused and scrolled into view, through the `lib/view-state` helper (AD-20, UX-DR9).

### Story 2.5: Pick groups table

As a planner,
I want to see every pick group with its shared jobs and whether the two parts sit in the same aisle,
So that I can check which parts are used together and where they are apart.

**Acceptance Criteria:**

**Given** `GET /api/plans/{id}/pick-groups` (`domain/views/pick_groups.py`, router `api/routers/pick_groups.py`)
**When** it is called
**Then** each pick group has both parts (part number and description), the shared jobs, the aisle of each part's current location in the planning copy (none when a part has no current location), and whether the two are in the same aisle (FR-20)
**And** the order is most shared jobs first, ties by the lower part number, then the higher, from `domain/ordering.py` (AD-14).

**Given** the answer-key dataset before any move
**When** the view is built
**Then** exactly one pick group is in the same aisle (`9100`–`9200`, aisle D), and `1008614-00`–`2300` shows no aisle for `1008614-00` (`test_fr20_same_aisle_from_planning_copy`).

**Given** the Pick groups step (`/plans/{id}/pick-groups`, `modules/pick-groups`)
**When** it renders
**Then** it is a `DataTable` with columns part A, part B, shared jobs, aisle of each part, and "Same aisle" (in ink with the link icon) or "Different aisles", in server order (UX-DR29)
**And** with no pick groups it says "No pick groups: no two parts share 5 or more jobs in the period."

### Story 2.6: Part panel and search

As a planner,
I want to open any part from the roster, a pick group or a search, and to search parts and locations from one field,
So that I can look up a part or a location in a few keystrokes.

**Acceptance Criteria:**

**Given** `GET /api/plans/{id}/parts/{part}`
**When** it is called
**Then** it returns the part number, description, class, picks and the class threshold from the settings snapshot, total stock, current location, other locations with their stock, and its pick groups (partner, shared jobs, partner's aisle) (FR-13, FR-20).

**Given** a roster row, a pick-group part or a part search result
**When** the planner activates it
**Then** the `PartPanel` (`components/common/`, 400px side panel) opens with that part: number, description, class with glyph, picks and threshold ("61 picks in the period (24 or more)"), total stock, current and other locations as `LocationChip`s (built here in `components/common/`: a code in Barlow, 24px high, ink outline, keyboard-activatable), and its pick groups (UX-DR24)
**And** focus moves to the panel heading, `Esc` closes it and returns focus to the control that opened it, the URL carries `?part=` through `lib/view-state`, and a location chip opens the Locations table filtered to that aisle with the row focused.

**Given** `GET /api/plans/{id}/search?q=` (`domain/views/search.py`)
**When** a query is sent
**Then** it matches part numbers, part descriptions and location codes as partial text, compared with Python `casefold`, and returns parts and locations as separate lists in the order from `domain/ordering.py` (FR-15, AD-3, AD-14).

**Given** the `SearchField` (`components/common/`) in the Parts and Locations headers
**When** the planner types "oil filter" or "a-01-01"
**Then** results list parts and locations apart; a part result opens the part panel, and a location result opens the Locations table filtered to that location's aisle with its row focused (FR-15, UX-DR25)
**And** no match shows "No part or location matches “xyz”."

**Given** a page with a search field
**When** the planner presses `Ctrl+/` (`⌘/` on macOS)
**Then** the search field gets focus; the shortcut never fires on a plain `/`, and `Esc` clears the field and then blurs it (UX-DR8, UX-DR11)
**And** a Playwright test searches for a part on `data/sample/`, opens its panel and closes it with `Esc`.

## Epic 3: Mark best locations

The planner marks whole aisles, levels and single locations as best from the locations table, removes marks again, and sees the best and empty-best counts. Marking is the first change to a plan, so this epic also builds the one command pipeline every later change uses: the command endpoint, idempotency and versioning on the server, and the one-command-at-a-time client flow with autosave.

### Story 3.1: Best-location marks in the domain

As a planner,
I want the tool to know exactly which locations my marks make best,
So that every count and every later rule uses the same answer.

**Acceptance Criteria:**

**Given** the plan state
**When** best-location marks are stored
**Then** they are a set of values in `PlanState`: `{kind: "aisle", aisle}`, `{kind: "level", level, aisle | null}` (null = in all aisles) or `{kind: "location", location}`, never indexes (AD-4)
**And** the marks never change the import (FR-21).

**Given** the domain kernel
**When** this story adds `covering_marks(location, marks)` and `is_best(location, marks)` to `domain/planning.py`
**Then** a location is best when a marked aisle, a marked level (in all aisles or in its aisle) or its own single mark covers it, and no other location is best (FR-21, AD-1)
**And** removing one mark leaves a location best while another mark still covers it (`test_fr21_overlapping_marks`).

**Given** the answer-key mark (the whole aisle A)
**When** the counts are computed
**Then** aisle A's 9 locations are best and 1 of them is empty (`A-01-01-03`), and nothing else is best (`test_fr22_answer_key_best_counts`).

**Given** the plan views
**When** they are built
**Then** the plan summary and the overview show the number of best locations and of empty best locations, and the locations view sets `is_best` on every `LocationRef` from `covering_marks`, so the Locations table's best column and best filter work (FR-22, AD-15)
**And** the locations view lists, for each best location, the marks that cover it.

### Story 3.2: The command endpoint with best-location mark commands

As a planner,
I want every mark I set or remove to be saved at once, exactly once,
So that a reload or a network retry never loses or doubles a change.

**Acceptance Criteria:**

**Given** `POST /api/plans/{id}/commands` with `{command_id, base_version, type, …}` (`swp/app/commands.py`, router `api/routers/commands.py`)
**When** a `set_best_mark` or `remove_best_mark` command naming a mark by value arrives
**Then** `swp.app` reads the plan, runs `domain.apply(state, command, ctx)` with `CommandContext(now, user)`, saves with `UPDATE … SET state=…, version=version+1, last_edited_by=…, last_edited_at=… WHERE id=:id AND version=:read_version`, and returns `{version, events: [mark_set | mark_removed]}` (FR-10, FR-21, AD-6)
**And** `last_edited_by` is `planner` (FR-11).

**Given** the closed command union in `domain/commands.py`
**When** this story is done
**Then** it holds only the two mark commands, and the event union only `mark_set` and `mark_removed`; later slices add their types to these files and their handlers to their own modules (AD-6, AD-13).

**Given** a command whose `command_id` is already in `recent_commands`
**When** it is sent again
**Then** the stored result is returned and nothing changes; `recent_commands` keeps the last 50 `(command_id, result)` pairs (AD-6) (`test_fr10_repeated_command_id_applies_once`).

**Given** setting a mark that already exists, or removing one that doesn't
**When** the command is applied
**Then** the response is 200 with no events, and neither `version` nor `last_edited_*` changes (AD-6) (`test_fr21_noop_mark_does_not_bump_version`).

**Given** two commands on the same plan at the same time
**When** the conditional update changes 0 rows
**Then** the service re-reads and re-applies up to 3 times, SQLite transactions use `BEGIN IMMEDIATE`, and both commands end up applied with versions one apart (`tests/app`, SQLite and Postgres)
**And** `base_version` is stored but not enforced.

**Given** an unknown plan or an invalid command
**When** it is sent
**Then** the response is `plan_not_found` (404) or `validation_failed` (422) in the AD-11 envelope, and a GET on the plan never writes (FR-9).

**Given** the API types
**When** the command and event unions change
**Then** `frontend/lib/api/schema.ts` is regenerated and the CI schema diff passes (AD-13).

### Story 3.3: Client command flow and autosave

As a planner,
I want each change to show only once it is saved, and to be told clearly when saving fails,
So that what I see is always what is stored, and I never lose track of an edit.

**Acceptance Criteria:**

**Given** `frontend/lib/commands`
**When** a slice sends a command
**Then** it sends one command at a time per plan with a new `command_id` and the current `base_version`, and until the response arrives every plan-changing control is `aria-disabled` with the reason "Saving the last change…" (AD-12, UX-DR55)
**And** "Saved automatically" shows in the plan plate's tooltip after every confirmed change; there is no Save button (FR-10).

**Given** a confirmed command
**When** the response returns
**Then** the client refetches every `['plan', planId]` query and renders a set of plan queries together only when their `version`s agree, refetching stale ones at most 2 times; `['import', importId]` queries are left alone (AD-3)
**And** nothing in the plan is shown as changed before the server confirms it.

**Given** a network error or a 502/503/504
**When** the command fails
**Then** it is retried with the same `command_id` after 1, 2, 4 and 8 s while the `GlobalNotice` says "The last change was not saved yet. Trying again."; after that, or after a 500, the command is dropped, the plan is refetched and the notice says "The change was not saved. Try again." (AD-12, UX-DR15)
**And** another 4xx drops the command, shows its `message` in a toast and refetches, and `plan_not_found` uses the shared handling from Story 1.9.

**Given** the save status
**When** it changes
**Then** it is announced with `aria-live="polite"` (UX-DR57)
**And** Vitest covers the retry schedule, the version-consistent refetch and the disabled-while-saving state with a mocked API.

### Story 3.4: Best locations step: mark and unmark from the table

As a planner,
I want to mark whole aisles, levels and single locations as best and remove marks again,
So that the tool knows which locations I consider best before any rule runs.

**Acceptance Criteria:**

**Given** the Best locations step (`/plans/{id}/best-locations`, `modules/best-locations`)
**When** it opens in milestone 1
**Then** it shows the Locations table in marking mode with a segmented control **Whole aisle | Level | Single location** that behaves as a radio group with arrow keys and keeps its selection per plan in the browser (UX-DR12, UX-DR28)
**And** beside the table it lists the current marks and the live "174 best · 7 empty" counts (FR-22).

**Given** Whole aisle mode
**When** the planner chooses an aisle in the aisle filter and marks it
**Then** a `set_best_mark` command `{kind: "aisle", aisle}` is sent through `lib/commands`, and every location in that aisle shows as best once the server confirms (FR-21).

**Given** Level mode
**When** the planner picks a level and "in this aisle" or "in all aisles" and marks it
**Then** a `{kind: "level", level, aisle | null}` mark is set; in Single location mode each row has a **Mark** / **Unmark** button that sets or removes `{kind: "location", location}` (FR-21).

**Given** the list of marks
**When** the planner activates a mark's remove button (at least 24 × 24px, × icon, labelled "Remove mark Level 1 in aisle A")
**Then** a `remove_best_mark` command removes it, and a location still covered by another mark stays best (FR-21, UX-DR28).

**Given** a confirmed mark change
**When** the response returns
**Then** a toast says "Best-location marks changed." with no Undo, since undo never reverses marks; Epic 5 adds the count of outdated recommendations and a **View** action (UX-DR14)
**And** the Locations table's best column and filter, the overview's best and empty-best counts, and the flow bar update, with the Best locations step checked once at least one mark exists (FR-22, UX-DR6).

**Given** the step with no marks
**When** it renders
**Then** it says "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations." (UX-DR35)
**And** a Playwright test marks aisle A and level 1 in all aisles on `data/sample/`, reloads, and sees both marks and the same counts (FR-10).

## Epic 4: Try moves in the planning copy and compare before/after

The planner moves parts by hand in the planning copy, and the import never changes. Aisle by aisle, the planner sees which parts move in and out, how many fast-moving parts sit in best locations and how many pick groups share an aisle, before and after. This epic lays the step log and `replay` (AD-5), which every later move, recommendation, undo and print builds on.

### Story 4.1: Step log, replay and the planning copy

As a planner,
I want every move kept as a step in the plan, with the warehouse rebuilt from the import plus those steps,
So that the planning copy can never drift from the moves and the import stays untouched.

**Acceptance Criteria:**

**Given** `PlanState` from Story 1.7
**When** the step type is defined in `domain/state.py`
**Then** a step holds its move number, part, from-location, to-location, rule (`rule_1 | rule_2 | rule_3 | manual`), round, recommendation id (or none) and `swap_id` (or none), and `next_move_number` starts at 1 (AD-5)
**And** if the stored shape changes, the next upcaster and a fixture `state_v<n>.json` are added in `domain/state_migrations.py` in the same change (AD-4).

**Given** an import and a list of steps
**When** `domain.planning.replay(import, steps)` runs
**Then** it returns the planning copy (stock per part and location), the effective moves and each part's current location; none of these are stored (AD-5)
**And** `current_location`, `is_empty`, `stock_at` and `aisle_of` in `domain/planning.py` take the planning copy, so every existing view and rule reads the same facts (AD-1)
**And** `planning_copy(import, state)` from Story 2.3 now returns `replay(import, state.steps)`'s planning copy; there is still exactly one implementation.

**Given** a step that moves a part from L1 to L2 in round *k*, and a later step in round *k* that moves the same part from L2 to L3, where L2 held none of the part before the first step
**When** `replay` folds them
**Then** they become one effective Manual move L1 → L3 that keeps the move number of the first step; if L3 is L1, the effective move is removed (FR-34)
**And** in every other case the moves stay separate (`test_fr34_combine_only_through_location_without_part`, `test_fr34_move_back_removes_move`).

**Given** the round invariant
**When** `domain.apply` adds a step
**Then** it asserts that the step's round is the current round (the highest run round, or 0 with no run), so no round-*k* step comes before run *k* (AD-5)
**And** `current_round` stays derived and is never stored (AD-4).

**Given** any sequence of steps
**When** `replay` runs
**Then** the import's locations, inventory and transactions are byte-for-byte equal to what was stored at upload, and the movement classes and pick groups in `analysis` are unchanged (FR-36)
**And** a property-style test `test_fr36_import_never_changes` applies random valid move sequences to the answer-key import and checks this.

### Story 4.2: Make a manual move (command and preview)

As a planner,
I want to move all of a part's stock from one of its locations to any other location, and to see before confirming what the move will do,
So that I can try my own placements in the planning copy.

**Acceptance Criteria:**

**Given** the closed command list (AD-6)
**When** the `manual_move` command `{part, from, to}` is sent to `POST /api/plans/{id}/commands`
**Then** one step is added with rule Manual, the current round (0 before the first run) and the next move number, which is never reused (FR-33, Move number)
**And** it moves all of the part's stock at the from-location, leaves its other locations unchanged and, when the to-location already holds the part, adds the stock together.

**Given** a to-location that is occupied by other parts
**When** the move is made
**Then** it is allowed, and both parts are stored there (FR-33).

**Given** a to-location that is the from-location, a virtual location, or not in the Locations file, or a part with no stock at the from-location
**When** the command is sent
**Then** it is rejected with `command_rejected` and a final English message such as "This is the from-location. Choose another." or "FLSKRS is a virtual location, not a shelf." (AD-11), and the plan `version` is unchanged.

**Given** `GET /api/plans/{id}/moves/preview?part=&from=&to=`
**When** it is called
**Then** it returns `{allowed, refusal_message?, effect: new | adds_to_stock | combines_with(n) | removes_move(n)}` computed by `domain.planning`, and it writes nothing (AD-3)
**And** the command checks the same rules again on submit.

**Given** a confirmed `manual_move`
**When** the response arrives
**Then** it is `{version, events}` with `move_made`, or `moves_combined` / `move_removed` for FR-34, and `last_edited_by/at` are updated (FR-10, FR-11)
**And** domain tests replay the answer-key manual moves: 9300 into C-01-01-01 after 1100 has left it, the 9100/9200 swap through an occupied location, and the combine of 0100 into one Manual move (`test_fr33_*`, `test_fr34_*`).

### Story 4.3: Manual move dialog from the part panel

As a planner,
I want a Manual move… dialog that refuses bad targets as I type and tells me what the move will do,
So that I can make a move with the keyboard and without surprises.

**Acceptance Criteria:**

**Given** the part panel from Epic 2
**When** I choose **Manual move…**
**Then** the ManualMoveDialog opens with the from-location preselected when the part has one location (a choice when it has several) and a to-location field with autocomplete over the Locations file in AD-14 order (UX-DR26)
**And** the dialog lives in `components/common/`, because the location tooltip (Epic 10) and the recommendation detail (Epic 5) reuse it.

**Given** a to-location typed in the field
**When** the server preview answers
**Then** a refusal shows as an input error (red boundary, warning icon, the server's sentence, `aria-invalid="true"`, linked by `aria-describedby`), an occupied target that already holds the part shows "to an occupied location: stock is added together", and confirm is disabled while the preview refuses.

**Given** the preview effect `removes_move(n)`
**When** the dialog shows it
**Then** it says "This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed." and the confirm button reads **Remove move** (UX-DR26).

**Given** a confirmed move
**When** the command succeeds
**Then** a toast names the move ("Moved 9300: B-01-03-02 → C-01-01-01 (Manual, round 0)."), or for an FR-34 merge "Combined into one move: G-14-04-02 → A-02-01-01 (Manual).", and the parts, locations and pick-groups views refetch through `lib/commands` (AD-3, AD-12)
**And** while the command is unconfirmed, every plan-changing control is `aria-disabled` with "Saving the last change…".

**Given** a part with no stock above zero anywhere
**When** its part panel opens
**Then** it shows "No current location (no stock above zero)" and Manual move… is disabled with that reason (UX-DR24).

**Given** search results and the locations table rows
**When** a part is opened there (a part search result, or a part-number button in a Locations row; opening a location itself opens no part panel)
**Then** Manual move… is reachable from the part panel, so search → move works with the keyboard alone (FR-15, NFR-10).

### Story 4.4: Views follow the planning copy

As a planner,
I want the parts list, locations list, occupancy and pick-group aisles to show the warehouse as the plan has it now,
So that every view agrees with the moves I have made.

**Acceptance Criteria:**

**Given** a plan with manual moves
**When** the parts, locations, pick-groups and search views are built
**Then** they use the current locations and occupancy from one `replay` per request, and each response carries the plan `version` (AD-3, FR-13, FR-14, FR-20)
**And** the client renders a set of plan queries only when their versions agree, refetching stale ones at most twice.

**Given** a move that empties a location
**When** the locations view refetches
**Then** the location shows as empty, and the per-aisle and whole-warehouse occupied/empty counts and occupancy change accordingly (FR-14).

**Given** a pick group whose mover was moved into its partner's aisle
**When** the pick-groups view refetches
**Then** the row shows "Same aisle", and the aisles shown are the current aisles in the planning copy (FR-20).

**Given** the movement classes and pick groups
**When** any move is made
**Then** they do not change, because they come from `analysis` (FR-36, `test_fr36_classes_and_groups_stable_after_moves`).

### Story 4.5: Before/after counts in the domain

As a planner,
I want the tool to compare the import with the planning copy for each aisle and for the whole warehouse,
So that I can judge a plan before anything is physically moved.

**Acceptance Criteria:**

**Given** `domain/before_after.py`
**When** it is given the import, the planning copy, the analysis and the current best-location marks
**Then** for each aisle it lists the parts that move in (stock in the aisle in the planning copy but not in the import) and the parts that move out (the reverse), in AD-14 order (FR-37)
**And** it imports only the domain kernel (`planning`, `ordering`, `values`), as the slice rules allow.

**Given** fast-moving parts
**When** they are counted before and after
**Then** a part counts once, in the aisle of its current location, and counts as in a best location when that location is best; both sides use the current marks (FR-37)
**And** a part with no current location is counted nowhere.

**Given** pick groups
**When** they are counted
**Then** a pick group counts in an aisle, before and after, when both parts' current locations are in that aisle, per aisle and in total (FR-37).

**Given** the occupied and empty counts
**When** they are computed
**Then** they are given per aisle, before and after.

**Given** the answer-key `before_after` section in `expected.json`
**When** the domain test replays the final moves of the scenario as steps
**Then** the counts match exactly: fast-moving in best locations 1 → 5, pick groups in one aisle 1 → 6, and each aisle's occupied/empty and in/out lists (`test_fr37_answer_key_before_after`).

### Story 4.6: Before/after page

As a planner,
I want a before/after table per aisle and in total,
So that I can see, at a glance, what my moves change.

**Acceptance Criteria:**

**Given** `GET /api/plans/{id}/before-after`
**When** it is called
**Then** it returns the FR-37 view with `version` and builds it from one `replay` (AD-3).

**Given** the Before/after step (`/plans/{id}/before-after`, `modules/before-after`)
**When** it renders
**Then** a data table shows a row per aisle in AD-14 order plus a total row, with fast-moving in best locations, pick groups in the same aisle and occupied/empty, each written "Before → After" with the after value in body-strong when it differs, and the parts moving in and out of each aisle (UX-DR18, UX-DR51)
**And** "best" appears as a word in the column head "Fast-moving in best locations", never as a colour; the table does not list which locations are best (NFR-10, FR-22).

**Given** a plan with no moves
**When** the page renders
**Then** it shows the table with equal values and "No moves yet: before and after are the same." (UX-DR51).

**Given** a move is made in another view
**When** the before/after page is shown again
**Then** it shows the new values, because every plan query refetches after a confirmed command (FR-37, AD-3)
**And** the flow bar never puts a check on Before/after, since it is an output (UX-DR6).

## Epic 5: Get explained recommendations and apply them

The planner runs the recommendations in rounds: rule 1, then rule 2, then rule 3, each with its limits and "no space". Every recommendation comes with its reason in numbers, and the planner can see which recommendations are outdated and why. Recommendations can be applied one at a time or all at once. Rule 1 is built first, as the teacher advised. The epic ends with the milestone 1 gate.

### Story 5.1: Run rule 1 and store the run

As a planner,
I want to run the recommendations and get rule 1's suggestions for fast-moving parts outside the best locations,
So that I start with one simple rule I can check by hand.

**Acceptance Criteria:**

**Given** `domain/rules.py` and the `run` command (AD-6)
**When** a run is made
**Then** it is stored in `state.runs` with its id (`uuid5(command_id, "run:<n>")`), round (1 for the first run, the previous highest + 1 after that), created at and by from `CommandContext`, its recommendations and its "no space" entries (FR-23, AD-1, AD-4)
**And** each recommendation gets `id = "<run_id>:<n>"` and `number = n` in AD-14 order, and is never renumbered (AD-7).

**Given** fast-moving parts whose current location is not best
**When** rule 1 runs
**Then** parts are taken by most picks first, ties in part-number text order, and each gets the first empty best location in location-code order that no earlier recommendation of this run took (FR-24, FR-27)
**And** a part with no free empty best location is listed once as "no space" under rule 1.

**Given** the shared limits
**When** any rule runs
**Then** only empty locations in the planning copy are suggested, never a virtual location; parts with no current location and parts in the state's keep-in-place set are skipped; each empty location goes to at most one part; and each part gets at most one recommendation (FR-27)
**And** the keep-in-place skip is tested with a state fixture (`test_fr27_kept_part_skipped`), because the keep command comes in Epic 7.

**Given** a new run
**When** it is stored
**Then** every earlier recommendation and "no space" entry that no step references is deleted, earlier runs' metadata is kept, and steps made after it get its round (FR-23, AD-7, AD-5)
**And** two runs on the same state give the same recommendations in the same order (`test_fr23_run_is_deterministic`).

**Given** the answer-key import with aisle A marked best
**When** run 1 is made
**Then** rule 1 gives 1100 → A-01-01-03 and lists 1200, 10240 and 2400 as "no space", in that order (`test_fr24_answer_key_round1`)
**And** the run finishes within the NFR-8 budget on `data/sample/`.

### Story 5.2: Apply a recommendation

As a planner,
I want to apply a recommendation and see it become a move in the planning copy,
So that I can try the tool's suggestion before deciding on the next one.

**Acceptance Criteria:**

**Given** an open recommendation of the latest run
**When** the `apply` command `{recommendation_id}` is sent
**Then** one step is added with the recommendation's part, from-location, suggested location, rule and its run's round, and with the recommendation id, and the response has a `move_made` event (FR-30, AD-6)
**And** the recommendation is shown as applied, derived from the step that references it; "applied" is never stored (AD-7).

**Given** a recommendation that is outside the latest run, already applied, or outdated
**When** `apply` is sent
**Then** it is rejected with `command_rejected` and the plan is unchanged (AD-7).

**Given** an applied recommendation
**When** the plan's views refetch
**Then** the part sits in the suggested location in the parts, locations and before/after views, and fast-moving parts in best locations goes up on the before/after table (FR-30, FR-37).

**Given** a manual move after a run
**When** it is made
**Then** it gets that run's round, as the round invariant requires (FR-33, AD-5).

### Story 5.3: Rule 2 and rounds

As a planner,
I want slow-moving and dead-stock parts suggested out of the best locations, with the freed locations offered to rule 1 in the next round,
So that best locations go to the parts that are picked most.

**Acceptance Criteria:**

**Given** slow-moving or dead-stock parts whose current location is best
**When** rule 2 runs after rule 1
**Then** parts are taken by fewest picks first, then in part-number text order, and each gets the first free empty location that is not best, in location-code order; no fit gives "no space" under rule 2 (FR-25, FR-27)
**And** a part that rule 1 already gave a recommendation or a "no space" entry is skipped.

**Given** a best location that a rule 2 recommendation would free
**When** the same run is made
**Then** rule 1 is not offered that location; it is offered only in a later run, after the rule 2 move is applied (FR-25).

**Given** `run_baseline(import, steps, k)`
**When** it is computed
**Then** it equals `replay` of the steps with a round below *k*, so it is the planning copy as it was when run *k* was made (AD-5).

**Given** the answer-key import
**When** run 1 is made and then the round 1 moves of steps 2–12 in `expected.json` are applied (with 0500's keep-in-place mark set in the state fixture)
**Then** run 1's rule 2 recommendations are 4400, 9000, 0100 and 0500 to the first empty locations in aisle B, and run 2 (round 2) gives rule 1: 1200 → A-01-01-01, 10240 → A-01-01-02, 2400 → A-01-03-02, with 0500 left alone (`test_fr25_answer_key_rounds`).

### Story 5.4: Rule 3 with its limits

As a planner,
I want parts used on the same jobs suggested into their partner's aisle, without moves that undo each other between rounds,
So that pick groups end up together and the plan settles.

**Acceptance Criteria:**

**Given** pick groups whose two parts have current locations in different aisles
**When** rule 3 runs after rules 1 and 2
**Then** groups are taken by most shared jobs first, ties by the lower part number and then the higher; the mover is the part with fewer picks (on a tie, the later in part-number order); it gets the first free empty location in its partner's aisle in location-code order (FR-26)
**And** a slow-moving or dead-stock mover is never offered a best location, and when every empty location in the partner's aisle is best, it is listed as "no space" under rule 3.

**Given** each limit in FR-26
**When** a pick group meets it
**Then** the group gets no recommendation and no "no space" entry: the mover sits in a best location; the mover is already in the aisle of another partner it shares at least as many jobs with (that partner's aisle after this run's earlier rule-3 moves, so a weaker group never pulls a part away from a stronger partner just moved to it, issue 115); the partner already has a recommendation in this run; either part has no current location; or the mover is kept in place
**And** the partner is never moved instead.

**Given** a part that already has a recommendation, or a "no space" entry from rule 1 or 2
**When** its pick groups are handled
**Then** they are skipped silently, with no block and no "no space" (FR-27).

**Given** the answer-key import
**When** run 1 and run 2 are made as in `expected.json`
**Then** rule 3 gives 8100 → C-01-03-01, 8500 → D-01-03-01 and 3050 → D-01-03-02 in round 1, lists 6600 as "no space", blocks 0600 (best location), 1008614-00–2300 (no current location) and 8400–8500 (partner has a recommendation), skips 8100–8300 and 2400–5000 silently, and gives 8400 → D-01-03-03 in round 2 while 8100–8300 is blocked by the loop limit (`test_fr26_*`, `test_fr27_*`).

### Story 5.5: Reasons and outdated recommendations

As a planner,
I want every recommendation to state its reason in numbers, and to see when a later change has made it invalid,
So that I only apply moves I understand and that still make sense.

**Acceptance Criteria:**

**Given** a recommendation or a "no space" entry
**When** its view is built
**Then** it carries structured reason data: for rules 1 and 2 the class, the picks and the threshold from `plan.analysis`; for rule 3 the partner, the partner's aisle and the shared jobs; for "no space" the rule and its plain cause (FR-28, AD-11)
**And** `frontend/lib/copy` words them from EXPERIENCE.md, for example "Fast-moving: 61 picks in the period (24 or more)", "Pick group with 2007060 (aisle D): 12 shared jobs (5 or more)" and "No space · no empty best location".

**Given** `domain.recommendations.revalidate`
**When** it runs after every command (AD-6)
**Then** an open recommendation of run *k* becomes outdated, sticky until the next run, by the first true cause in this order: `moved` (a step of its part in round *k* that doesn't reference it), `filled` (the suggested location is not empty, recording the location and the move number that filled it), `marks` (a mark condition of its rule fails), `partner_aisle` (rule 3: the partner's current aisle is not the suggested aisle) (FR-29, AD-7)
**And** nothing else makes a recommendation outdated, and an outdated recommendation cannot be applied.

**Given** an applied recommendation whose move FR-34 removed because the part was moved back to its first from-location
**When** its view is built
**Then** it is shown as outdated with the derived cause `moved_back` (FR-29).

**Given** the cause wording in `lib/copy`
**When** an outdated row is shown
**Then** it reads "A-11-02-02 was filled by a manual move." / "4410281 has been moved." / "The best-location marks changed." / "Partner 2007060 is no longer in aisle D." / "4410281 was moved back, so move 16 was removed." (UX-DR39)
**And** domain tests cover each cause and the order between them (`test_fr29_*`).

**Given** a best-location mark change that outdates recommendations
**When** the mark command succeeds
**Then** the mark toast from Epic 3 reads "Best-location marks changed · 3 recommendations are now outdated" with **View**, which opens the Outdated tab, and no Undo (UX-DR14, UX-DR28).

### Story 5.6: Apply all

As a planner,
I want to apply every open recommendation of the latest run at once,
So that I don't have to click through a long round one by one.

**Acceptance Criteria:**

**Given** the `apply_all` command
**When** it is sent
**Then** it folds over the latest run's recommendations in `number` order and applies each one that is open, whose part is not kept in place, and that still passes `revalidate` on the intermediate state, running `revalidate` again after each apply (FR-30, AD-6)
**And** the whole fold is one transaction and one version bump, and the event `apply_all_done{applied[], skipped[{number, cause}]}` lists what happened.

**Given** "no space" entries and kept-in-place parts
**When** Apply all runs
**Then** they are skipped (FR-30).

**Given** the plan summary
**When** it is built
**Then** it includes `apply_all_count` = open recommendations of the latest run, minus kept-in-place ones, and the flow bar checks Recommendations when the latest run has no open recommendation left (AD-3, UX-DR6).

**Given** the answer-key state after run 2
**When** Apply all is sent
**Then** it applies the four round 2 recommendations as four steps with round 2 (`test_fr30_apply_all`).

### Story 5.7: Recommendations page

As a planner,
I want a recommendations page with the round, a list grouped by rule and a detail panel for the selected recommendation,
So that I can work through a round with the mouse or the keyboard.

**Acceptance Criteria:**

**Given** `GET /api/plans/{id}/recommendations`
**When** it is called
**Then** it returns the latest run's metadata, its recommendations with status, number, reason data and, for applied ones, the move number and round, and its "no space" entries, in server order with `version` (AD-3, AD-7, AD-14).

**Given** the Recommendations step (`modules/recommendations`)
**When** it renders
**Then** the header shows the round chip ("Round 0" before the first run), the line "Run 2026-11-11 09:42 by planner · 19 recommendations · 31 no space" and "The next run starts round 2 and uses the planning copy as it is then.", **Run recommendations** (secondary) and **Apply all (n)** (secondary, confirm popover "Apply 15 recommendations from round 1? Undo reverses them one move at a time.", disabled at n = 0) (UX-DR31)
**And** while a run is in flight the button reads "Running…" and is disabled, and the list is dimmed and inert; afterwards focus moves to the first row, and the page announces "Recommendations, round 1, 19 recommendations, 31 no space" (UX-DR57).

**Given** the state tabs Open · Applied · Outdated · No space
**When** they render
**Then** each shows its count, including 0, as part of its name; Open is selected after a run; rows are grouped under rule bands in rule order (rule tag, rule name, ordering note); each rule shows its first 5 rows and then "Show N more under rule X"; identical "no space" lines collapse into "30 more like this" (UX-DR13, UX-DR32)
**And** empty tabs say "No outdated recommendations." / "No “no space” parts in this run.".

**Given** the list
**When** it is used
**Then** it is a single-select `listbox` with `aria-controls` pointing at the detail panel; rows show number, class swatch, part and description, from → to with a BEST tag on a best target, and picks; ↑/↓ select and fill the detail; selected rows are tinted with an ink outline and the accent bar; outdated rows are hatched with a struck-through target, a clock, "Outdated" and the cause; applied rows show an ink check with "Applied · move N, round R"; "no space" rows show the NO SPACE chip and the plain cause (UX-DR33).

**Given** the detail panel
**When** a row is selected
**Then** it shows "SELECTED · #1 · RULE 1", the part, the reason as plain sentences with the numbers in bold, and the move line from → to as codes with BEST; its action bar has **Apply** (primary, `Alt+A`/`⌥A`, never while a text field has focus) and **Manual move…** (the shared ManualMoveDialog); Apply on an outdated row is disabled with its cause as the reason (UX-DR8, UX-DR34)
**And** applying shows a toast "Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01" without Undo, which arrives in Epic 7.

**Given** the empty and edge states
**When** they occur
**Then** the page shows: no best locations ("Rule 1 and rule 2 need best locations. Rule 3 runs without them.", run still enabled); no run yet ("No run yet. Run recommendations to start round 1 on the planning copy as it is now."); a run with no results ("Round 3 found no recommendations and no “no space” parts. …"); and a failed run ("The run stopped before it finished. Nothing changed: still round 1. Run recommendations to try again.", button refocused) (UX-DR35).

### Story 5.8: Milestone 1 gate

As a planner (and the author),
I want the whole milestone 1 flow proven by the answer-key tests, the timing test, an end-to-end test and the README,
So that the core works and is finished before anything in milestone 2 starts (SM-C3).

**Acceptance Criteria:**

**Given** `data/answer-key/expected.json`
**When** the domain suite in `backend/tests/domain/` runs
**Then** it checks the classes, the pick groups, the occupancy and the zero-stock location, and replays `steps` 1–14 (runs 1 and 2, apply, the manual moves including the 9300 dependency and the 9100/9200 swap, and the rule 3 limits), with 0500's keep-in-place mark set in the state fixture; every test name carries its FR (SM-1, SM-7)
**And** the rule modules (`classify`, `pick_groups`, `rules`, `recommendations`, `planning`, `before_after`) are called directly with data and settings, with no database, file, network or UI involved, and import-linter keeps them free of `swp.store` and `swp.app` (NFR-1).
**And** steps 15–20 (undo after a later run, the 0100 combine after undo, run 3 and Apply all on it), and the full move list and final before/after, are marked as deferred to Epic 7 and Epic 8 with a skip reason that names the story.

**Given** `tests/app/test_nfr8_timing.py`
**When** it runs on `data/sample/`
**Then** import with classes and pick groups takes under 10 s, a run under 5 s, and one command plus the plan views under 1 s on a typical laptop (NFR-8).

**Given** a Playwright test in `frontend/e2e/sm2-flow.spec.ts` (built as `m1-flow.spec.ts`; Story 12.5 renamed it and extended it to the milestone 2 flow) (Chromium, Firefox, Edge)
**When** it runs locally
**Then** it goes New Plan with `data/sample/` → overview → parts → pick groups → mark aisle A and level 1 → run → apply one recommendation → one manual move → before/after, without errors.

**Given** the README
**When** someone follows only the README from a clean checkout
**Then** they can install, start the app, import `data/sample/` step by step, mark best locations, run and apply recommendations, see the before/after table and run the tests (SM-2 for milestone 1, NFR-2)
**And** the README states that the public deployment holds synthetic data only (NFR-5).

**Given** the gate
**When** all of the above pass
**Then** the author records it in the session log, and no milestone 2 story starts before then (PRD §7.1).

## Epic 6: Keep, reopen and manage saved plans

The planner sees every saved plan, reopens any of them exactly as it was left, starts a new plan from an existing import, deletes plans it no longer needs, and jumps to any step, action or saved plan with the launcher. Auth is still off in this epic: created by and last edited by stay `planner` until Epic 9.

### Story 6.1: Saved-plans list as the start page

As a planner,
I want one list of all saved plans, most recently edited first, as the place the app opens on,
So that I can find and continue any plan instead of only the latest one.

**Acceptance Criteria:**

**Given** stored plans
**When** `GET /api/plans` is called
**Then** each row returns `id`, name, data-as-of date, `uploaded_at`, `created_by`, `created_at`, `last_edited_by` and `last_edited_at`, ordered by `last_edited_at` descending, from an API-own schema in `swp/api/schemas` (AD-13)
**And** the list never loads import `data` or plan `state`, and the request does not write (FR-8, FR-9).

**Given** the saved-plans route `/plans` (`modules/plans`)
**When** it renders
**Then** it shows the shared DataTable with name, data-as-of date, upload date (the local date of `uploaded_at`), created by and at, last edited by and at, and New Plan as the one primary button (FR-7, FR-8, UX-DR30)
**And** the table is one tab stop: `↑`/`↓` move between rows, `Enter` or a click opens the plan on its last view, and `Tab` moves into the selected row's menu button (UX-DR18).

**Given** no plans are stored
**When** the list renders
**Then** it says "No plans yet. A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.", names "Demo files: data/sample/" and offers New Plan (UX-DR30).

**Given** `/`
**When** it is opened from milestone 2
**Then** it opens the saved-plans list; the milestone 1 redirect to the most recently edited plan is removed (FR-8, AD-20)
**And** the shared error hook now handles `plan_not_found` from any request with the toast "This plan was deleted." and opens `/plans` instead of New Plan (AD-12, UX-DR55).

**Given** a plan is opened or looked at
**When** the list is fetched again
**Then** its `last_edited_by` and `last_edited_at` are unchanged, and only a command that changes the plan moves it to the top (FR-9, FR-11)
**And** an API test `test_fr8_saved_plans_sorted_by_last_edit` and a Playwright test cover the order and the open action.

### Story 6.2: Reopen a plan exactly as it was left

As a planner,
I want a saved plan to reopen with every mark, move, recommendation and round exactly as I left it,
So that I can come back a week later and carry on without redoing anything.

**Acceptance Criteria:**

**Given** a plan with best-location marks, keep-in-place marks (stored in `state` even before Epic 7 adds their commands), several runs, applied and outdated recommendations, "no space" entries, manual moves, a combined move (FR-34) and steps that share a `swap_id` (built as a fixture state, since the swap command arrives in Epic 12)
**When** it is stored, the backend is restarted and the plan is read again
**Then** the marks, the steps (move numbers, rules, rounds, recommendation ids, `swap_id`), `next_move_number`, each run's id, round, `created_at` and `created_by`, the recommendations with their stored status and cause, the "no space" entries and the derived current round are identical (FR-9, NFR-12)
**And** `test_fr9_reopen_identical_state` runs in `tests/app` on SQLite, and on Postgres 17 in CI.

**Given** that reopened plan
**When** `replay` and the views are built from it
**Then** the planning copy, the effective moves, the before/after counts, the recommendation views and the plan summary's `undo_preview` equal those built before the restart, so the next undo would reverse the same step (FR-9, AD-5)
**And** opening the plan, or any GET on it, saves nothing and leaves `version`, `last_edited_by` and `last_edited_at` unchanged.

**Given** a `state` stored with an earlier `schema_version`
**When** the store reads it
**Then** it is upcast by `domain/state_migrations.py` without writing, and the next command saves it in the current version (AD-4)
**And** each stored fixture `tests/domain/fixtures/state_v<n>.json` still opens.

**Given** a planner switches step, aisle, recommendation or part in a plan
**When** they leave and later open the plan from the saved-plans list with a bare URL
**Then** `lib/view-state` fills the URL from `localStorage` key `swp:plan:<id>:view` (last step and its query values), read and written inside try/catch, and nothing of it is sent to the server (AD-20)
**And** with storage blocked the plan opens on its overview without an error.

**Given** a plan whose move list has been printed
**When** it is reopened
**Then** it is still fully editable; there is no locking (FR-9).

### Story 6.3: Start a New Plan from an existing plan's import

As a planner,
I want to start a new plan on the same import as a saved plan, with none of its marks or moves,
So that I can try a different set of best locations without losing the first plan.

**Acceptance Criteria:**

**Given** `POST /api/plans` with `name` and `import_id` instead of three files (still multipart, AD-6)
**When** the import exists
**Then** `app.plans.create_from_import` reads the stored import, computes `analysis` again from it with the current `analysis.toml`, and inserts the plan on that import while it holds the import row lock (only the insert runs under the lock; the import never changes, so the analysis is computed before it); it never copies the chosen plan's `analysis` or `state` (FR-2, AD-4)
**And** the new plan has no best-location marks, no keep-in-place marks, no moves, no runs and round 0.

**Given** unchanged settings
**When** the new plan is compared with the chosen plan
**Then** it has the same movement classes and pick groups, and with the same best-location marks and no moves its first run gives the same recommendations in the same order as the chosen plan's first run (`test_fr2_reuse_import_same_results`)
**And** with a changed setting in a test fixture, the new plan uses the new setting and the chosen plan keeps its stored one (FR-18).

**Given** an `import_id` whose import was deleted meanwhile
**When** the request is made
**Then** it fails with `not_found` and creates nothing.

**Given** the New Plan page
**When** the planner picks "Or reuse the import of a saved plan"
**Then** a listbox (the shared Listbox pattern, UX-DR17) lists saved plans with name and data-as-of date, the three file tiles are replaced by the chosen import, and New Plan creates the plan and opens its overview with the toast "<name> created. Data as of <date>." (UX-DR19)
**And** the saved-plans row menu has "New Plan from this import", which opens New Plan with that import chosen (`/plans/new?from=<planId>`: the URL carries the saved plan's id, not the import id).

**Given** an open plan
**When** the plan plate menu opens (click or `Enter`)
**Then** it lists up to five other recent plans (switching opens that plan), "All saved plans" (opens `/plans`) and "New Plan from this import"; the milestone 1 "New Plan" item is removed (UX-DR5)
**And** `Esc` closes the menu and returns focus to the plate.

### Story 6.4: Delete a plan

As a planner,
I want to delete a plan after confirming,
So that the list holds only plans that still matter, without touching anyone else's plans.

**Acceptance Criteria:**

**Given** `DELETE /api/plans/{id}`
**When** the plan exists
**Then** the plan is deleted permanently, with no archive, and the request goes through the same-origin guard (FR-12, AD-19)
**And** a plan that does not exist returns `plan_not_found`.

**Given** two plans share one import (FR-2)
**When** one of them is deleted
**Then** the other plan, its marks, moves, runs and recommendations, and the shared import are unchanged (`test_fr12_delete_keeps_other_plans`)
**And** when the last plan that uses an import is deleted, the import row is deleted in the same transaction, with the import row locked against a concurrent FR-2 create (AD-4)
**And** on Postgres every locking write transaction (not only delete) sets `lock_timeout = '3s'`, so a delete, command or reuse-create that waits longer for a row lock fails with `unavailable` (503) instead of waiting (AD-6).

**Given** the saved-plans row menu
**When** the planner chooses Delete…
**Then** a confirm dialog says "Delete “<name>”? The plan, its marks, moves and recommendations are deleted for everyone. There is no archive." with **Cancel** (default focus) and **Delete plan** (destructive) (UX-DR16, UX-DR30)
**And** Cancel or `Esc` leaves the plan unchanged and returns focus to the row's menu button.

**Given** Delete plan is confirmed
**When** the response arrives
**Then** the row disappears from the list after the refetch and focus moves to the next row, or to New Plan when the list is empty.

**Given** a plan is open in another tab when it is deleted
**When** that tab sends any request for it
**Then** it gets `plan_not_found`, shows "This plan was deleted." and opens the saved-plans list (AD-12).

### Story 6.5: Launcher: jump to any step, action or saved plan

As a planner,
I want one keyboard-first map of the flow with live counts, actions and saved plans,
So that I can get anywhere in the plan with `Ctrl+K` and a few letters.

**Acceptance Criteria:**

**Given** an open plan
**When** the planner presses the toolbar grid button, or `Ctrl+K` / `⌘K` (also inside text fields); the button and the launcher exist only on plan paths
**Then** the flow map drawer opens as a modal over the page, the page behind is `inert`, and focus moves to the search field "Search features, actions and plans" (UX-DR7, UX-DR8)
**And** `Esc` closes it and returns focus to the grid button.

**Given** the open drawer
**When** it renders
**Then** it shows eight step columns (OVR, PRT, LOC, GRP, BST, REC, B/A, MOV) with name, state (Done / You are here / Output / Not done yet), live counts from the plan summary (AD-3) and the step's actions, the current step tinted with the "You are here" tag
**And** a band below holds the open plan, up to five other saved plans, SAV, NEW and SET, the stage-2 plates CAT and LBL (dashed, lock icon, "Coming in stage 2", `aria-disabled="true"`, not activatable; Epics 13 and 14 later made them links) and the Keyboard box with four fixed entries (Ctrl K, Ctrl /, Alt A, Esc) and "⌘ and ⌥ on a Mac."

**Given** the drawer has focus
**When** the planner uses the keyboard
**Then** `Tab` moves between columns, `↑`/`↓` move within one, and `Enter` opens the focused step, runs the focused action or opens the focused plan
**And** actions only navigate or send commands through `lib/commands`; Run recommendations and Apply all are defined again in `lib/launcher` (sending the same `run` and `apply_all` commands), because the launcher module imports no other module, only `components/*` and `lib/*` (Epic Design isolation rules).

**Given** the planner types in the search field
**When** the text matches
**Then** the columns are replaced by one result list grouped as Steps, Actions and Saved plans, the first match is highlighted, and `Enter` opens it (typing "REC" then `Enter` opens Recommendations)
**And** no match shows "No feature or saved plan matches “xyz”." (UX-DR7).

**Given** the launcher has no actions that need later epics yet
**When** Epic 7 adds Undo last move and Reset…
**Then** they are registered through the same action list in `lib`, with no change to the launcher's own code.
**And** a Playwright test opens the launcher, types "mov" and opens the Move list step with the keyboard only.

## Epic 7: Refine the plan: other location, keep in place, undo and reset

The planner adjusts a plan without leaving the recommendations: applies a recommendation with another allowed location, declines one with keep in place, undoes moves one at a time with exact wording of what each undo does, and resets the planning copy when starting over.

### Story 7.1: Keep a part in place

As a planner,
I want to mark a part "keep in place" so its recommendations stop coming back,
So that a part I know will not fit is left alone by later runs and Apply all.

**Acceptance Criteria:**

**Given** the commands `set_keep` and `remove_keep` with a part number (AD-6)
**When** they are applied
**Then** the part is added to or removed from the plan's keep-in-place marks, a repeated set or a remove of an absent mark is a no-op (200, no events, no version bump), and the events are `keep_set` / `keep_removed` (FR-32)
**And** keep-in-place marks are not steps, so they never get a move number and undo never reverses them (FR-35).

**Given** a part kept in place
**When** the next run is made
**Then** it gets no recommendation and no "no space" entry, Apply all skips it, and an open recommendation of the latest run for that part shows under the **Kept in place** tab, not under Open or No space, and cannot be applied (FR-32, AD-7)
**And** the answer-key step "mark 0500 keep in place" gives the expected run 2 result with 0500 left alone (`test_fr32_kept_part_skipped_in_run_2`).

**Given** a kept part
**When** the planner makes a manual move of it
**Then** the move is allowed and the mark stays (FR-32).

**Given** the recommendation detail, the part panel and the roster row
**When** the planner activates **Keep in place** (or `Alt+K` / `⌥K` with focus in the recommendations list or detail)
**Then** the mark is set at once, the row moves to the Kept in place tab, and a toast says "<part> is kept in place. Remove the mark from the part or the Kept in place tab."; the link then reads "Remove keep in place" (UX-DR37, UX-DR8)
**And** `Alt+K` never fires while a text field has focus.

**Given** kept parts exist
**When** the roster, the part panel and the overview render
**Then** the roster row shows the pin glyph with "kept in place" text (the wall tooltip shows it from Story 10.3), the overview shows the count of kept parts, and the Kept in place tab shows its count, or "Nothing kept in place." when empty (FR-32, UX-DR35)
**And** the Kept in place tab sits between Applied and Outdated and shows also before the first run: it lists the kept recommendations, the kept "no space" rows and, in a trailing Kept band, each kept part with neither (the view's `kept_parts`), so every keep mark appears once; the No space tab and its count leave kept rows out.

### Story 7.2: Apply a recommendation with another location

As a planner,
I want to apply a recommendation to another location that still fits its rule,
So that I can follow the rule's idea when I know a better spot than the first one suggested.

**Acceptance Criteria:**

**Given** an open recommendation of the latest run
**When** `domain.recommendations.other_locations(data, analysis, state, recommendation_id, replayed=None)` is called
**Then** it returns, in location-code order, the locations that are empty in the planning copy now, were empty in `run_baseline` for that run, and fit the rule: best for rule 1; not best for rule 2; in the partner's aisle for rule 3 and not best for a slow-moving or dead-stock part; never a virtual location or the suggested location itself (FR-31, AD-5, AD-7)
**And** it returns `[]` (it does not reject) when the recommendation cannot be applied (not in the latest run, applied, outdated or kept)
**And** it is the only implementation of that set; tests `test_fr31_*` use small fixtures, including a location emptied by a manual move in the same round, which is not offered.

**Given** the command `apply_other_location` with the recommendation `id` and a location
**When** the location is in the allowed set
**Then** a step is made with the recommendation's rule and round and its recommendation id, the recommendation shows as applied with that step's effective move, and the recommendation itself is not edited (FR-31)
**And** a location outside the set, or a recommendation that is outdated or not in the latest run, is rejected with `command_rejected`.

**Given** the recommendation detail's action bar
**When** the planner opens **Other location ▾** (or `Alt+O` / `⌥O`)
**Then** a listbox shows the allowed locations from the server with aisle, level and best / not best; arrow keys and typing only move the highlight, and `Enter` or a click applies the highlighted location (UX-DR36, UX-DR8)
**And** an empty set says "No other location fits rule 1 right now.", and there is no free-text entry.

**Given** the apply succeeds
**When** the views refetch
**Then** the row shows "Applied · move N, round R", the toast names the move with its from- and to-location, and the before/after table and the wall-free move line in the detail show the chosen location.

### Story 7.3: Undo the last move

As a planner,
I want to undo the most recent move and be told exactly what that undo will do,
So that I can step back safely, one move at a time, without guessing what changes.

**Acceptance Criteria:**

**Given** the command `undo` with `expected_move_number`
**When** the last step has that move number
**Then** the last step is deleted, the planning copy is rebuilt by `replay`, and the event is `step_undone`; when the last step has another number, or there are no steps, the command is rejected with `command_rejected` (FR-35, AD-5)
**And** undo never reverses runs, best-location marks or keep-in-place marks.

**Given** a combined move (FR-34) or a move-back that removed a move
**When** its last step is undone
**Then** undo restores the state before that step: the combined move is split back into its first move, or the removed move is restored and its recommendation shows as applied again instead of `moved_back` (FR-29, FR-34, FR-35).

**Given** any undo
**When** the `undo` command is applied
**Then** the command itself stores `outdated(undo)` on every open recommendation of the latest run that no step references (kept parts included) and on the recommendation the undone step referenced (`revalidate` never produces `undo`), sticky until the next run, and an undone recommendation does not come back until the next run (FR-29, FR-35, AD-7)
**And** the answer-key step "apply 1200, undo it, then undo 0100's round 1 move" makes every run 2 recommendation outdated, and the following manual moves of 0100 combine into one Manual move A-01-01-01 → B-01-03-02 in round 2 (`test_fr35_undo_after_later_run`).

**Given** steps that share a `swap_id` (fixture state)
**When** undo is repeated
**Then** they are undone one at a time, latest first, like any other moves (FR-35).

**Given** the plan summary
**When** it is built
**Then** `undo_preview` is `{move_number, part, from_location, to_location, effect: {kind: reverts_move | splits_combined_move | restores_removed_move, move_number}}` from the last step, or null with no steps (AD-5)
**And** `lib/copy` words it once as "Undo move 3: 9723950 A-03-04-02 → A-05-01-03", "Undo splits move 3: 9723950 returns to A-05-01-03" or "Undo restores move 4: 4410281 G-14-04-02 → A-02-01-01".

**Given** **Undo last move** (tertiary) in the Recommendations header and the part panel, and the launcher action registered through the Epic 6 action list
**When** they render
**Then** each shows the `undo_preview` wording as its tooltip or label, and is `aria-disabled` with "No moves to undo" when the preview is null (UX-DR38, UX-DR10)
**And** after an undo the toast says "Undid move 3. Unapplied recommendations of round 1 are now outdated. Run recommendations to continue.", with "Split move 3." or "Restored move 4." as the first sentence for the other effects.

**Given** a toast that reports a move (apply, manual move, combined move)
**When** Undo last move would reverse exactly that move
**Then** the toast offers **Undo**, which sends `undo` with that move number; toasts about marks never offer Undo (UX-DR14).

### Story 7.4: Reset the planning copy

As a planner,
I want to reset a plan's moves and recommendations while keeping my marks,
So that I can start the rounds again from the import without rebuilding my best locations.

**Acceptance Criteria:**

**Given** the command `reset`
**When** it is applied
**Then** every step and every run (with their recommendations and "no space" entries) is deleted, `next_move_number` is set to 1, the current round becomes 0, and best-location marks and keep-in-place marks are kept; the event is `plan_reset{moves_removed}`, where `moves_removed` (like the summary's `move_count` in the dialog) counts effective moves, not raw steps (FR-35, AD-5); when there is nothing to reset, the command is a no-op with no event and no new version, and the toast says 0 moves (AD-6, decided 2026-11-26)
**And** a reset with nothing to reset (no steps, no runs) is a no-op: no event and no version bump; the client still toasts "Plan reset. 0 moves removed; marks kept. The next run is round 1."
**And** the next run is round 1 and the next move is move 1, and the import is unchanged (FR-36, `test_fr35_reset_keeps_marks`).

**Given** the Recommendations header
**When** the planner opens the "⋯" menu and chooses **Reset…**
**Then** a confirm dialog says "Reset removes all 18 moves, the recommendations and the no-space parts. Best-location marks and keep-in-place marks stay. The next run is round 1." with **Reset plan** (destructive) and **Cancel** (default focus) (UX-DR38, UX-DR16)
**And** the same action is registered in the launcher's Recommendations column through the Epic 6 action list.

**Given** Reset plan is confirmed
**When** the response arrives
**Then** the toast says "Plan reset. 18 moves removed; marks kept. The next run is round 1.", the round chip shows "Round 0", the empty "No run yet" state shows, and the before/after table shows "No moves yet: before and after are the same." (UX-DR35, UX-DR51)
**And** Cancel or `Esc` changes nothing and returns focus to the "⋯" button.

### Story 7.5: Answer-key scenario through run 3

As a planner (and the author),
I want the whole answer-key scenario to run through the domain and the API with the expected results,
So that milestone 2's refinements are proven against the hand-worked answer key, not just in isolated tests.

**Acceptance Criteria:**

**Given** `data/answer-key/` and every step in `expected.json` → `steps`
**When** a domain test replays them in order (run 1, apply 1100, the manual moves of 9300, 9100 and 9200, keep 0500, the rule 3 applies, 4400, 9000, 0100, run 2, apply and undo 1200, undo 0100's move, the two manual moves of 0100, run 3, Apply all)
**Then** after each step the recommendations, "no space" entries, outdated causes, rounds and move numbers equal `expected.json` (`test_sm1_answer_key_scenario`)
**And** answer-key helpers name recommendations by part only in the test and map them to recommendation `id`s (AD-13).

**Given** the final state
**When** the effective moves are built by `replay`
**Then** they are exactly the 14 moves in the answer key (part, from, to, rule, round), with 0100's undone round 1 move absent and its two round 2 moves combined into one; the printed order is checked in Epic 8
**And** the before/after counts equal the answer key (fast-moving in best locations 1 → 5; pick groups in one aisle 1 → 6; occupied/empty per aisle A–D) and the import is identical to what was uploaded (FR-36, FR-37).

**Given** the same scenario through `POST /api/plans/{id}/commands` in `tests/app/test_answer_key_api.py` (`test_ad6_answer_key_scenario_over_http`, next to the other command API tests)
**When** it is run on SQLite, and on Postgres 17 in CI
**Then** every response's events and `version` bumps match the domain run, and repeating the final command (Apply all) with the same `command_id` returns the stored result without applying twice (AD-6).

**Given** an extra run on the final state
**When** it is made in the domain test (`test_fr23_answer_key_settled_check`)
**Then** it gives no recommendations and only 6600 as "no space": the plan has settled
**And** the expected move numbers and the `undo` outdated cause are written in the test (`MOVE_NUMBERS`, `UNDONE`), because `expected.json` gives steps 15–16 only as prose, and `data/answer-key/` is never edited by hand.

## Epic 8: Print the move list for colleagues

The planner prints the plan's moves as a black-and-white list in round order. Within a round, moves out of a location come before moves into it, swap lines are marked, and the header names the plan, its data and the generated time. A colleague who has never seen the app can follow it top to bottom.

### Story 8.1: Move-list order and header in the domain

As a planner,
I want the move list built in a safe order with a header that says what it is,
So that a colleague never arrives at a location that a later line still has to empty.

**Acceptance Criteria:**

**Given** a plan's effective moves from `replay` (after FR-34)
**When** `domain/move_list.py` builds the lines
**Then** the list holds exactly those moves, no more and no fewer, each with round, part, part description, from-location, to-location, rule and move number (FR-38, AD-17).

**Given** lines in one round
**When** they are ordered
**Then** a line into a location comes after every line in that round that moves a part out of it; otherwise lines follow the Walk Path of the from-location, then part-number order (text order, `domain/ordering.py`); lines that form a cycle follow Walk Path order (FR-38, AD-14)
**And** a property test checks that within a round no line moves a part into a location that a later line in the same round empties, except inside a cycle (`test_fr38_out_before_in`, SM-6).

**Given** rounds with gaps (for example moves in rounds 0, 1 and 3)
**When** the view is built
**Then** rounds are in ascending order, printed as stored (the gap stays), round 0 is labelled "before the first run", and the header's round count is the number of distinct rounds that have a move (AD-17).

**Given** the answer-key final state from Story 7.5
**When** the move list is built
**Then** its 14 lines are in the answer key's order: 9300 after 1100 because it moves into the location 1100 leaves, 9100 and 9200 in Walk Path order as a cycle, and 0100's round 2 line as one combined Manual move (`test_fr38_answer_key_move_list`).

**Given** `GET /api/plans/{id}/move-list`
**When** it is called
**Then** it returns the plan `version`, the header (plan name, data-as-of date, `uploaded_at`, number of rounds, `generated_at` = the server instant of the request), the rounds with their lines in domain order, and an empty list when there are no moves; it never writes (AD-3, AD-17).

### Story 8.2: Mark the lines of a swap

As a planner,
I want the lines of a swap printed together and marked as a swap,
So that the colleague knows to set one bin aside first.

**Acceptance Criteria:**

**Given** steps that share a `swap_id` (fixture states; the swap command arrives in Epic 12)
**When** every step of that swap exists and is its own effective move
**Then** its lines follow each other where the FR-38 order allows, and each carries `swap {index, size, locations: [a, b]}` so it prints as "Swap 1/2 · A-02-01-01 ↔ G-14-04-02" (FR-38, FR-51, AD-17).

**Given** one step of a swap was undone, or combined with a later move (FR-34)
**When** the move list is built
**Then** the remaining lines of that swap print as ordinary Manual lines with no swap mark (`test_fr38_swap_mark_only_when_intact`).

**Given** a cycle made with plain manual moves (the answer key's 9100 ↔ 9200)
**When** the move list is built
**Then** it prints as ordinary Manual lines in Walk Path cycle order, without a swap mark (AD-17).

### Story 8.3: Move list print view

As a planner,
I want a print view that shows the list on screen first and prints it from the browser,
So that I can check the list and hand a fresh printout to a colleague.

**Acceptance Criteria:**

**Given** the Move list step and the print route `/plans/{id}/print` (`modules/move-list`; the step key stays `move-list`, a last view on `/print` is stored as `move-list`, and `/plans/{id}/move-list` redirects to `/print`)
**When** the page opens
**Then** it fetches the move-list view on mount, renders only after the response arrives, never re-sorts the lines, and shows a paper preview with **Print** (primary) and "Back to Recommendations" (AD-17, UX-DR52)
**And** pressing Print fetches the view again, re-renders it, and then calls `window.print()`, so a printout made with the Print button carries a fresh generated time and the latest moves
**And** a print from the browser menu (Ctrl/⌘+P) does not refetch: it prints the view last fetched, whose generated time can be older (AD-17).

**Given** the header data
**When** it renders
**Then** it shows "Move list · <plan name>", "Data as of YYYY-MM-DD · uploaded YYYY-MM-DD · N rounds" and "Generated YYYY-MM-DD HH:MM · Smart Warehouse Planner", with `generated_at` formatted in the viewer's zone (FR-7, FR-38, UX-DR56)
**And** the time is printed to the minute and the plan `version` is not printed, so two printouts made within the same minute have identical headers.

**Given** the lines
**When** they render
**Then** each round starts with a band "ROUND N" and "one walk · from-location before to-location" (ROUND 0 reads "before the first run"), and each line shows a tick box, Round, Part, Description, From, To, Rule and a blank Note space; every line prints its Round value even under its band (FR-38)
**And** a swap line's Rule cell reads "Manual · Swap 1/2" with "A ↔ B" under it, and the footnotes say "Lines follow Walk Path; moves out of a location come before moves into it, except in a swap." and, when a swap is present, "Swap: set one bin aside, move the other into its place, then put the first one in."

**Given** a plan with no moves
**When** the view opens
**Then** it says "There are no moves to print.", Print is `aria-disabled` with that reason, and a link goes to Recommendations (FR-38, UX-DR52).

**Given** the flow bar
**When** the Move list step is open
**Then** Move list is never checked (it is an output) and is `aria-current="step"` (UX-DR6).

### Story 8.4: Paper layout and print check in every browser

As a colleague,
I want the printed list to be legible in black and white on an office printer,
So that I can carry it into the aisles and tick off each line.

**Acceptance Criteria:**

**Given** the print stylesheet (`@media print`)
**When** the page is printed
**Then** the app shell, the toolbar and the preview buttons are hidden, the page is A4 portrait, everything is pure black on white with 1px line rules, 14px tick boxes and boxed ROUND bands (1.5px box, 2px rules above and below), and nothing depends on printed backgrounds, colour or grey tones (`print-color-adjust: exact` may be set, but nothing relies on it) (UX-DR52, NFR-9)
**And** codes and part numbers are Barlow bold at about 12pt and text Figtree at about 10pt.

**Given** a list longer than one page
**When** it is printed
**Then** the header and column heads repeat on every page from a repeating `<thead>`, a round band is kept with at least two lines (`break-inside: avoid` and `break-after: avoid` on the band, and `break-after: avoid` on the first line of a round with two or more lines; best effort, since the browser decides, and not checked in Firefox, whose Playwright build cannot save a PDF), and "Page X of Y" shows in the footer where the browser supports it (best effort) (AD-17).

**Given** Playwright projects `chromium`, `firefox` and `msedge`
**When** the e2e test imports `data/sample/`, marks best locations, runs, applies all and opens the print route
**Then** each project emulates print media, checks the header, the ROUND bands and that the line count equals the plan's moves, and saves a PDF (Chromium-based projects) or screenshot as an artifact for manual review (NFR-9, SM-2)
**And** these checks run locally before the milestone 2 gate.

## Epic 9: Accounts, login and the public demo

Anyone can create an account and log in, and plans record the logged-in user. On the public deployment a demo front page offers Log in, Create account and Demo version, which opens the app as the seeded demo account. The slice owns `app/auth`, `api/routers/auth`, `modules/auth` and `modules/front-page`; it switches `FEATURE_AUTH` and `FEATURE_DEMO` on without changing any other slice's code paths.

### Story 9.1: Create an account

As a person with access to the app,
I want to create an account with a username and a password typed twice,
So that I can use the app under my own name.

**Acceptance Criteria:**

**Given** the store layer
**When** the next expand-only Alembic migration runs through `swp.app.bootstrap`
**Then** it adds only a `users` table (`id` Uuid, `username` as registered, `username_key` = casefolded and unique, `password_hash`, `created_at` UtcDateTime), and no existing table or JSON document changes (AD-9, NFR-12).

**Given** `POST /api/auth/signup` with `{username, password, password_repeat}` and `FEATURE_AUTH` on
**When** the username is 1–32 characters, passes `str.isalnum`, is not taken by casefold and is not the reserved `planner` or `demo`, the password is 4–64 characters and at most 72 UTF-8 bytes, and both passwords match
**Then** the user is stored with a bcrypt hash (never plain text), an HS256 JWT (PyJWT, `sub` = user UUID, 30 days) is set in the httpOnly `SameSite=Lax` cookie `swp_session` (`Secure` in production), and `GET /api/session` returns that user (FR-39, AD-10)
**And** there is no email field, no role, no admin and no password reset.

**Given** an invalid signup
**When** it is rejected
**Then** the response is `validation_failed` with `[{field, message}]`: "That username is taken. Try another." / "The passwords don’t match." / the length and letters-and-numbers messages
**And** `FEATURE_AUTH` off returns `not_found` for every `/api/auth/*` route.

**Given** the Create account page (`/signup`, `modules/auth`)
**When** it renders
**Then** it is the 380px card on the graphite-header page with Username (hint "Letters and numbers. Must not be taken."), Password with Show, Repeat password, a full-width primary submit and a link to Log in (UX-DR53)
**And** errors are checked on submit, shown as `InputError` with `aria-invalid`, and focus moves to the first failing field; on success the saved-plans list opens.

**Given** the signup tests
**When** CI runs
**Then** `test_fr39_*` cover reserved names, casefold uniqueness, password byte limits and the hash never equalling the password, on SQLite and Postgres.

### Story 9.2: Log in, log out and the page guard

As a user,
I want to log in and out, and to be sent to Log in whenever I am not logged in,
So that the app knows who I am and nobody uses it anonymously.

**Acceptance Criteria:**

**Given** `POST /api/auth/login` with correct details
**When** it succeeds
**Then** the `swp_session` cookie is set as in Story 9.1, the user is loaded from the database on every request, and the client lands on the saved-plans list (FR-40, AD-10)
**And** wrong details return `unauthenticated` with the single message "Wrong username or password. Check both and try again.", never saying which was wrong.

**Given** `POST /api/auth/logout`
**When** it is called
**Then** the cookie is cleared and the client goes to Log in (FR-40); Story 9.6 later changes the destination to the demo front page when `feature_demo` is on.

**Given** `FEATURE_AUTH` on and no valid session
**When** any `/api/*` route other than `health`, `session` and `auth/*` is called
**Then** it returns `unauthenticated` (401), and the client layout guard, which reads `GET /api/session`, sends the visitor to `/login` (AD-10)
**And** with `FEATURE_AUTH` off every request still acts as `planner`, so milestone 1 behaviour is unchanged.

**Given** the Log in page (`/login`)
**When** it renders
**Then** it shows the 380px card with Username, Password with Show, a full-width primary Log in and a link to Create account (UX-DR53)
**And** a failed login shows one pale-red alert panel, keeps the username, clears the password and focuses it.

**Given** a local install with `FEATURE_AUTH` on and `FEATURE_DEMO` off
**When** `/` is opened without a session
**Then** Log in opens; after login `/` is the saved-plans list (NFR-5, FR-8)
**And** the same-origin guard still applies to the auth POSTs (`test_nfr6_cross_site_post_rejected` extended to `/api/auth/login`).

### Story 9.3: Plans record the logged-in user, the user menu and session expiry

As a user,
I want plans to show who created and last edited them, to see who I am logged in as, and to keep my change if my session runs out,
So that shared plans carry real names and no edit is lost.

**Acceptance Criteria:**

**Given** `FEATURE_AUTH` on
**When** a plan is created or a command changes it
**Then** `CommandContext.user` is the logged-in username, and `created_by` / `last_edited_by` hold it as text with no FK (FR-11, FR-40, AD-10)
**And** runs record that username as "by" in the round line ("Run 2026-11-11 09:42 by justas …").

**Given** existing plans made in milestone 1
**When** they are listed or opened
**Then** they still show `planner` and open unchanged (FR-9).

**Given** the toolbar with a logged-in user
**When** it renders
**Then** the avatar sits at the right end: the first two letters of the username in upper case ("DE" for `demo`, one letter for a one-letter name) in white on a 34px ink disc; it opens a user menu with "Logged in as", the username in Barlow bold and Log out (UX-DR4)
**And** the menu is keyboard-operable and `Esc` returns focus to the avatar.

**Given** a command that returns `unauthenticated` because the session expired
**When** `lib/commands` handles it
**Then** it keeps the command, opens Log in, and after a successful login resends it with the same `command_id` and reopens the plan where it was (AD-12, UX-DR55)
**And** the shared TanStack Query error hook sends 401 GETs to Log in the same way.

### Story 9.4: Login throttle and account limits

As the author running a public demo,
I want repeated wrong logins slowed down and the open demo capped,
So that one person can't lock out others or fill the database.

**Acceptance Criteria:**

**Given** the store layer
**When** the next expand-only migration runs
**Then** it adds only a `login_attempts` table keyed by the casefolded submitted username (`username_key`, `failures`, `locked_until` UtcDateTime) (AD-18).

**Given** 5 failed logins for one casefolded username, whether or not the account exists
**When** another login for that name arrives within 60 s
**Then** it returns `login_locked` (429) with "Too many failed logins for this username. Wait a minute and try again.", and a successful login after the lock resets the count (AD-18, UX-DR53)
**And** the time comes from `CommandContext.now`-style injection so `tests/app/test_fr40_login_throttle.py` runs without sleeping.

**Given** `FEATURE_DEMO` on
**When** an account would exceed `MAX_ACCOUNTS` (200) or a New Plan would exceed `MAX_PLANS` (50)
**Then** the request returns `limit_reached` (409) with "The demo has reached its account limit. Use Demo version instead." / "The demo holds at most 50 plans. Delete a plan to make room.", and the New Plan and Create account pages show it (AD-18, UX-DR55)
**And** with `FEATURE_DEMO` off neither limit applies.

### Story 9.5: Seeded demo account and Demo version

As an examiner or visitor,
I want a demo account I can use without creating one, and on the public demo a button that logs me in directly,
So that I can try the full flow in seconds.

**Acceptance Criteria:**

**Given** `swp.app.bootstrap(seed=True)` (lifespan locally, `swp db upgrade` in production)
**When** it runs, once or many times
**Then** it creates the user `demo` with the password from `DEMO_PASSWORD` (default `demo`) exactly once, treating an integrity error as success, and `demo` does not count toward `MAX_ACCOUNTS` (AD-10, FR-40)
**And** no plan is preloaded; the demo account is the only seed (FR-50, NFR-4).

**Given** `FEATURE_DEMO` on
**When** `POST /api/auth/demo` is called
**Then** it logs the visitor in as `demo` with no password and no throttle, and the client opens the saved-plans list; with the flag off it returns 404 (FR-50, AD-10)
**And** created by / last edited by then show `demo`, plans stay shared, and Log out works as for any user.

**Given** the Log in page with `feature_demo` on
**When** it renders
**Then** a full-width tertiary **Demo version** button with a play glyph sits under an "or" rule; with the flag off it is absent (FR-50, UX-DR53)
**And** Demo version still works while a throttle lock row exists for `demo`. Since 2026-11-28, Log in as `demo` is itself not throttled while Demo version is on (AD-18), so only a row left from before can exist.

**Given** a local install
**When** the README is followed
**Then** logging in as `demo`/`demo` works and there is no Demo version button (FR-50, NFR-2).

### Story 9.6: Demo front page

As a visitor to the public deployment,
I want a front page that shows in one minute what the tool does and how to get in,
So that I understand the flow before I log in.

**Acceptance Criteria:**

**Given** `feature_demo` on and no session
**When** `/` is opened
**Then** the demo front page renders (`modules/front-page`): a graphite header with only the logo and name, a "How it works" link that scrolls to the panels, and a Log in button outlined in on-dark (NFR-5, UX-DR54)
**And** with `feature_demo` off the page does not exist and `/` follows Story 9.2.

**Given** the hero
**When** it renders
**Then** it shows the headline "Every move comes with a reason." in display-hero, the one-line summary in lead, **Log in** (primary), **Create account** (secondary) and **Demo version** (tertiary, play glyph), and beside it a short bin wall at 56px bins with FST/MED/SLW/DED codes, one lifted bin, the accent arrow to a dashed best-location target and a reason card
**And** the bins reuse the `components/common` Bin and ClassGlyph from Epic 10 if they exist, otherwise the static picture is an inline SVG made from the DESIGN.md tokens.

**Given** the section "One part, start to finish"
**When** it renders
**Then** four numbered panels hung from a graphite rail follow one demo part from its export row, to its movement class, to Apply / Keep in place, to its line on the printed move list
**And** the page has no synthetic-data notice, no README or demo-data links, no footer text and no claims about customers, savings or distances (NFR-5).

**Given** a logged-in user on the public deployment
**When** they log out
**Then** they return to the demo front page (FR-40).

### Story 9.7: Production-like auth configuration, README and secrets

As the author,
I want the app to run with login and the demo on in a production-like local build, and the README to explain accounts and secrets,
So that examiners can follow the README locally, and the later deployment (Story 16.2) only has to set the variables.

**Acceptance Criteria:**

**Given** `APP_ENV=production`
**When** the backend starts with an empty or default `JWT_SECRET`, or with `VERCEL` set and `APP_ENV` unset
**Then** it refuses to start with a clear log line, and a test covers each case (AD-10, NFR-6)
**And** setting `JWT_SECRET`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DEMO_PASSWORD`, `FEATURE_AUTH` and `FEATURE_DEMO` on Vercel is Story 16.2, not this story.

**Given** the repo
**When** the story is done
**Then** `backend/.env.example` (and the frontend's, if any) lists every variable with placeholder values only, and no real secret is committed (NFR-6, NFR-4).

**Given** the README
**When** an examiner reads it
**Then** it explains setting the env vars for a local run with `FEATURE_AUTH` on, lists the demo account `demo`/`demo`, states that the public deployment holds synthetic data only, and links the public URL (FR-40, NFR-2, NFR-5).

**Given** a local production-like build (`next build` plus the backend, both flags on, a test `JWT_SECRET`)
**When** a Playwright run opens `/`
**Then** the front page shows, Demo version opens the saved-plans list as `demo`, the avatar reads "DE", and Log out returns to the front page (UJ-5).

## Epic 10: See and mark the warehouse as a bin wall

The planner sees each aisle as a shelf wall, and the whole warehouse at overview scale, with movement class, occupancy and best locations. Tooltips work by keyboard and mouse, recommendations show as lifted bins (with wall crops in the recommendation detail), and best locations are marked on the wall. The slice owns `domain/layout`, `domain/views/wall` and `modules/locations` (wall); the wall primitives (Bin, Slot, SlotNone, WallGrid, Key) go to `components/common` in the story that first reuses them.

### Story 10.1: Wall layout as an import-scoped domain view

As a planner,
I want every location placed on its aisle wall exactly as it sits on the shelf,
So that the wall I see matches the warehouse floor.

**Acceptance Criteria:**

**Given** a stored import
**When** `domain/layout.py` builds the layout
**Then** each aisle gets logical cells (run, row, column, gap) from the Section and Position columns when the Locations file has them; else from the code pattern `<aisle>-<section>-<level>-<position>`; else as one run per level in Walk Path order without section labels (AD-15, FR-42)
**And** a Section/Position or code-pattern source whose grid would hold more than twice as many cells as the aisle has locations (`MAX_GRID_PER_LOCATION`) is treated as unusable, and the aisle falls to the next source, so gap cells stay bounded
**And** levels sort with the highest on top and L1 at the bottom, all-digit Level, Section and Position values sort numerically, and other orders come from `domain/ordering.py` (AD-14).

**Given** an aisle with n sections
**When** it is laid out
**Then** the first ⌈n/2⌉ sections form the top run and the rest the bottom run, positions with no location become gap cells, and the end cap carries the aisle's last Walk Path ("End of aisle A · Walk Path 2,270 →")
**And** virtual locations are never on the wall, and every cell refers to its location as `LocationRef {code, aisle, level, section?, position?, is_best}`.

**Given** `GET /api/imports/{import_id}/layout`
**When** the frontend requests it
**Then** it is served under the `['import', importId]` query key with an immutable cache, and the refetch after a command never reloads it (AD-3).

**Given** the tests
**When** CI runs
**Then** `test_fr42_layout_*` cover all three layout sources (the answer-key codes, the demo data with Section/Position, and a fixture with other code patterns), the two-run split and the gap cells
**And** a test on a generated max-size import (25,000 locations rows within `MAX_ROWS_PER_FILE`) keeps the layout response under 4 MB (AD-18).

### Story 10.2: Draw one aisle as a bin wall with its Key

As a planner,
I want the Locations step to show the open aisle as a shelf wall with bins, open slots and best locations,
So that I can read occupancy, movement class and best locations at a glance.

**Acceptance Criteria:**

**Given** `GET /api/plans/{id}/wall?aisle=A` (a plan view carrying `version`)
**When** it is built from one `replay` of the planning copy
**Then** it returns, per location, occupied or empty, the parts stored there (number, description, class, picks, stock, kept in place), the part with the most picks, best or not with the covering marks, and the aisle's counts (occupied, empty, %, best, empty best), plus the plan's best-location marks (`marks`, in the same order as the locations view) (FR-42, FR-14, FR-22, AD-3).

**Given** the Locations step (`/plans/{id}/locations`)
**When** it opens in milestone 2
**Then** the wall is the default view and **Open as list** opens the milestone 1 FR-14 table filtered to the aisle; aisle tabs A → I in walk order show the letter plate, occupancy % and moves, followed by the whole-warehouse figure ("79.2% whole warehouse · 1,584 of 2,000 · 416 empty · 174 best") (UX-DR45)
**And** the open-aisle header reads "Aisle A" with "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270"; it opens on the aisle last opened in this plan, or A.

**Given** the wall primitives
**When** they are built in `components/common/wall/`
**Then** Bin (class colour, lip shading, white label window with the glyph; split label for two parts; three or more show the top part's glyph with a "+" tick; FST/MED/SLW/DED only at ≥56px), Slot (dark recess with rim, slat and base line), SlotNone (hatched) and the WallPanel (louvre graphite, beams, uprights, two runs, end cap) are drawn from DESIGN.md tokens via CSS variables (UX-DR40)
**And** bins stay ≥27px wide, scale to about 35px at 1440, and the wall panel scrolls in both directions inside itself instead of shrinking bins further.

**Given** best locations
**When** the wall draws them
**Then** a level or whole-aisle mark gives the level a 4px green rail and a BEST tag on its level label (a whole-aisle mark also tags the aisle tab), and a single-location mark draws a 2px green frame with "BEST n" on its level label; a location under a rail gets no frame; `#3DAE6B` on graphite, `#267A4B` on paper (FR-42, FR-22, UX-DR41).

**Given** the Key
**When** it renders under the wall
**Then** it is always visible and lists, in order, Fast-moving ▲, Medium-moving ◆, Slow-moving ▼, Dead stock ⊘, Empty, Best location, Selected, 2 parts, each as a miniature of the real graphic with its glossary name and never a colour word; in this epic the entries are plain text (Epic 11 makes six of them buttons) (UX-DR48)
**And** no information depends on colour alone: occupancy is shape plus text, class is colour plus glyph, best is green plus BEST (NFR-10, UX-DR57).

**Given** a move, undo or reset
**When** the command is confirmed
**Then** the wall refetches with the other `['plan', planId]` queries and renders only when versions agree (AD-3).

### Story 10.3: Navigate the wall by keyboard and read its tooltips

As a planner,
I want to move across the wall with the keyboard and read every location's details on focus or hover,
So that the wall works without a mouse and nothing is hover-only.

**Acceptance Criteria:**

**Given** the open wall
**When** it is rendered
**Then** it is one `role="grid"` with `aria-rowcount` and `aria-colcount`, each run a row group, level labels as row headers and section numbers as column headers, with exactly one cell in the tab order (UX-DR42).

**Given** focus in the wall
**When** I press keys
**Then** `←/→` move one position across section boundaries, `↑/↓` move one level (`↓` from L1 of the top run continues at the top level of the bottom run, and back), `Page Up/Page Down` jump between runs, `Home/End` go to the first or last location of the level in that run, `Ctrl+Home/Ctrl+End` to the first and last cell, and gap cells are skipped and never focusable
**And** the focused cell is scrolled into view clear of the toolbar, notices and toasts (WCAG 2.4.11).

**Given** a cell
**When** a screen reader reads it
**Then** its name is short and complete, for example "A-07-01-02, level 1, best location, occupied, fast-moving", with the part lines as its `aria-describedby` description.

**Given** focus on a cell, or a 150 ms hover
**When** the tooltip shows
**Then** it holds the code, "Level N" (from the Level column), the BEST tag, "Occupied · N parts" or "Empty", the mark source(s) ("Level 1 in aisle A (best-location mark)"), Walk Path, one line per part (swatch, number, description, class · picks · stock, "kept in place" with the pin glyph) and a partner strip when relevant; it never shows capacity or distance (FR-42, UX-DR43)
**And** it is dismissible with `Esc` without moving focus, hoverable, persistent until focus or pointer leaves both cell and tooltip, opens above the run so it never covers the next cell in the direction of travel, and is `aria-hidden` because the cell carries its content.

**Given** `Enter` or a click on a cell
**When** the tooltip is pinned
**Then** it becomes a non-modal `role="dialog"` labelled by the code, with actions: each part line opens the PartPanel, **Manual move…** opens the shared ManualMoveDialog for the location's top part (the part with the most picks) from that location (other parts of a multi-part location are moved from their PartPanel), and **Show recommendation #n** when one exists; focus moves to its first action and `Esc` returns it to the cell (`aria-haspopup="dialog"`, `aria-expanded`).

**Given** search in milestone 2
**When** a location result is chosen
**Then** the wall opens at that bin with its tooltip pinned; a part result opens the PartPanel and selects its current location on the wall; LocationChips everywhere open the wall at their location (UX-DR25, AD-20 `?aisle=&loc=`).

### Story 10.4: See recommendations and moves on the wall

As a planner,
I want each recommendation shown as a lifted bin with its number and target, and the selected one drawn with an arrow,
So that I can see where a part moves before I apply it.

**Acceptance Criteria:**

**Given** the wall view of the latest run
**When** it renders
**Then** every recommendation whose from-location is on this wall lifts its bin (33 × 34px, the only content shadow) with a 17px numbered marker showing the server `number`, the vacated slot shows a dashed white outline, and every target on this wall is a dashed slot with a plus glyph and the same number (UX-DR44, AD-7)
**And** a move from another aisle shows only its target, whose tooltip says "From G-14-04-02 (aisle G)" and adds "Recommendation 2 arrives here from G-14-04-02".

**Given** applied, manual and outdated moves of the current round
**When** they are drawn
**Then** applied moves show the ink disc with a white check, manual moves an "M" marker, and outdated recommendations the grey dashed marker with no lift (UX-DR44).

**Given** a selected move (`?rec=` or `?move=` in the URL)
**When** it is drawn
**Then** only that move draws the cased violet arrow, the lifted bin's violet frame, the solid target frame and the hover note ("Rule 1 · 8044172 Oil filter - Toyota Corolla / 33 picks (24 or more) · A-12-04-02 → A-14-02-01"), which flips side near the wall edge and never covers the from-bin or target
**And** selecting a marker, lifted bin, recommendation row or drawer row selects the same move everywhere and scrolls the other view into place (smoothly only without reduced motion); the bin lift animates ≤200 ms, instantly under reduced motion.

**Given** the drawer under the Key
**When** it renders
**Then** it reads "Moves touching aisle A · Round 1 · 7 moves · 4 to decide"; collapsed it shows only the selected move with Apply · Other location · Keep in place; **Show all 7** opens the table (Rule, Part, Class · picks, From, To, Status, Action) and "Open round 1" (UX-DR46)
**And** its Apply, Other location and Keep in place reuse the recommendation commands from Epics 5 and 7, and its table uses the shared DataTable keyboard model (UX-DR18).

**Given** the accessible names
**When** a cell is part of a move
**Then** its name states the move in text ("move 2 arrives here", "move 1, selected, leaves here"), never with `aria-selected`; the 17px markers meet the target-size rule through the row, lifted bin and drawer row equivalents (UX-DR42, UX-DR57).

### Story 10.5: Wall crops in the recommendation detail

As a planner,
I want the recommendation detail to show the from-aisle and to-aisle walls around the move,
So that I see the move in its shelf context without leaving Recommendations.

**Acceptance Criteria:**

**Given** a selected recommendation
**When** the detail panel renders in milestone 2
**Then** it shows a **From aisle** crop (the 3 sections around the from-location) over a **To aisle** crop (one crop when both ends are in the same aisle) at the same bin size, with "Rule 1 · round 1" between them, built from the shared wall primitives and the import layout (UX-DR34)
**And** in the fallback layout a crop is a window of N positions instead of sections.

**Given** a crop
**When** assistive technology reads it
**Then** it is `role="img"` with a text name ("From G-14-04-02, aisle G, level 4 → to A-02-01-01, aisle A, level 1, best location") and adds no tab stops.

**Given** the detail panel
**When** it renders
**Then** the eyebrow row has **Show on the Locations wall**, which opens the from-aisle with the move selected (`?aisle=&rec=`), and under the crops "Moves in the planning copy" lists the last 3 moves, newest first, with "Undo reverses move N first" (UX-DR34).

**Given** the viewport
**When** it is 1280–1439px wide
**Then** the crops show 2 sections instead of 3; at 1024–1279 the detail stacks under the list; below 1024 the crops scroll in two dimensions inside their own region (UX-DR58).

### Story 10.6: Whole warehouse view

As a planner,
I want to see all nine aisles at once with the selected move drawn across them,
So that I can judge the whole warehouse and cross-aisle moves at a glance.

**Acceptance Criteria:**

**Given** the Locations header
**When** I switch the **One aisle | Whole warehouse** segmented control (arrow keys, persisted per plan)
**Then** Whole warehouse shows four figures (occupied %, empty locations, best locations with how many are empty, recommendations in the current round) and the nine aisle cards in walk order in a 3 × 3 grid (UX-DR45, FR-42)
**And** clicking the whole-warehouse figure after the aisle tabs also switches to it.

**Given** an aisle card
**When** it renders
**Then** it shows the letter plate (with a BEST tag for a whole-aisle mark), %, "occupied of total · empty", the moves count and the aisle's whole wall at overview scale as a decorative (`aria-hidden`) picture without glyphs, tooltips, drag or marking; selecting the card opens that aisle in One aisle.

**Given** a selected move
**When** Whole warehouse is shown
**Then** the move is drawn as one route from its from-bin to its target, also across aisles; route lines between logical cells are drawn by the frontend from the layout (AD-15)
**And** `test_fr42_warehouse_endpoint_max_size_under_4_mb` keeps `GET /api/plans/{id}/warehouse` under 4 MB on a generated max-size import (AD-18).

**Given** narrower viewports
**When** the width is 1024–1279px
**Then** the cards show in two columns; below 1024 in one column (UX-DR58).

### Story 10.7: Mark best locations on the wall

As a planner,
I want to set and remove best-location marks directly on the wall,
So that I can mark aisles, levels and single locations where I can see them.

**Acceptance Criteria:**

**Given** the Best locations step in milestone 2
**When** it opens
**Then** the wall becomes the marking tool, with **Whole aisle | Level | Single location** and, in Level mode, "in this aisle | in all aisles"; the marks list with remove buttons (≥24 × 24px, "Remove mark Level 1 in aisle A") and the live "174 best · 7 empty" counts sit beside it; the milestone 1 table stays available as Open as list (FR-21, UX-DR47)
**And** **Edit best-location marks** on the Locations header opens this step with the same aisle.

**Given** a mode
**When** I hover or focus a cell
**Then** it previews the mark for that mode ("Mark level 1 in aisle A", "Mark aisle A", "Mark A-07-01-02", or "Unmark …" when that exact mark exists), and `Enter` or a click sends `set_best_mark` (or `remove_best_mark` for an existing exact mark) through `lib/commands`
**And** in Level mode the level labels are buttons and the rail's hit area is the whole level row (at least 24px tall).

**Given** a confirmed mark change
**When** recommendations become outdated
**Then** the toast "Best-location marks changed · 3 recommendations are now outdated" offers **View** (opens the Outdated tab) and no Undo, and the rails, frames, BEST tags and counts redraw from the server (FR-29, UX-DR14)
**And** no drag happens in this step: a click always means mark.

**Given** a Playwright run
**When** UJ-1 step 4 is followed (Whole aisle A, then Level 1 in all aisles)
**Then** the rails and BEST tags appear and the counts match the server, in Chromium, Firefox and Edge.

## Epic 11: Change the Key colours

The planner changes any of the six Key colours from the wall's Key, gets contrast and likeness warnings, and keeps the choice in this browser. The slice is frontend-only: `lib/colours` (colour maths and storage) and the Key buttons and colour popover in `components/common/wall` (`key.tsx`, `colour-popover.tsx`), not a `modules/key-colours` module, because four modules draw the Key and modules may not import each other. It changes no plan, import or analysis, and never touches focus or print.

### Story 11.1: Colour maths and presets

As a planner,
I want the app to know which colours stay readable on the wall and which are too alike,
So that I am warned before I pick a colour I can't read.

**Acceptance Criteria:**

**Given** `lib/colours`
**When** it computes contrast
**Then** it returns the WCAG 2 relative-luminance ratio and checks each Key colour against its pairs from DESIGN.md: each movement class against the wall `#30353A` and an open slot `#141719`; best location against the wall, an open slot and ink text on it (4.5:1); selection against its casing `#141719` and white `#FFFFFF`; the threshold is 3:1 except the 4.5:1 text pair (FR-42).

**Given** two of the six colours
**When** their likeness is checked
**Then** CIELAB ΔE (CIE76) below 20 flags them as too alike.

**Given** a chosen best colour or selection colour
**When** the derived tokens are computed
**Then** `best-on-light` darkens the same hue until white text on it reaches 4.5:1 and the colour reaches 3:1 on white, and `selected-tint` is the selection colour at about 10% on white (DESIGN.md, Colors).

**Given** the DESIGN.md `colour-presets`
**When** they are loaded
**Then** each of the six entries has its eight shades, lightest first, with the default among them.

**Given** Vitest
**When** the tests run
**Then** `fr42_colours.test.ts` checks that all six defaults pass every pair with the ratios in DESIGN.md (fast 3.05 / 4.44, medium 6.59 / 9.58, slow 3.06 / 4.45, dead 3.98 / 5.79, best 4.40 / 6.40 / 5.95, selection 4.65 / 3.88, within ±0.02), that every preset passes its own entry's check, that default pairs are at least ΔE 37 apart, and that the best default derives `#267A4B`-compatible values.

### Story 11.2: Key colours as live CSS variables kept in the browser

As a planner,
I want a colour I choose to show at once on every wall and to still be there tomorrow,
So that the wall stays readable for me without changing anyone's plan.

**Acceptance Criteria:**

**Given** the six Key colours
**When** the app renders
**Then** every wall, mini-wall, wall crop, class swatch, best rail, frame and tag, and every selection frame, arrow, marker ring and selected-row bar reads its colour from CSS variables (`--colour-fast`, `--colour-medium`, `--colour-slow`, `--colour-dead`, `--colour-best`, `--colour-best-on-light`, `--colour-selection`, `--colour-selected-tint`), so one change updates them all at once (FR-42); as built, the theme tokens in `globals.css` alias these variables, so components keep using the theme tokens unchanged
**And** because the accent and selected-tint tokens alias the selection variables, a changed Selected colour also recolours that UI chrome: menu and listbox highlights, the flow bar's current step on paper (not on the graphite toolbar), the launcher's current column and selected result, and the Manual move dialog's highlighted row (DESIGN.md: a changed colour replaces the token everywhere it is drawn)
**And** the focus ring, inputs, the plan plate edge, the round chip, the "You are here" tag and the product mark never read these variables, and the print stylesheet stays black and white.

**Given** stored colours in localStorage `swp:colours`
**When** a page loads
**Then** an inline script in the root layout reads them inside try/catch and sets the variables before first paint, so no default colour flashes (AD-20)
**And** an invalid stored value is ignored and the default is used.

**Given** browser storage is blocked (private window or blocked site data)
**When** a colour is changed
**Then** the change still applies from memory for the page's life, and the colour popover shows "Colours can't be kept in this browser; changes last until you reload or close this page." (UX-DR49)
**And** nothing about colours is ever sent to the server.

**Given** a colour change
**When** the plan is reloaded or printed
**Then** no plan, import or analysis has changed, the glyphs, BEST text and frame shapes are unchanged, and the printed move list is black and white (FR-42, NFR-10).

### Story 11.3: Change a colour from the Key

As a planner,
I want to click an entry in the Key, try shades on the real wall and keep the one I can read,
So that I can fix a hard-to-see colour in a few seconds (UJ-4).

**Acceptance Criteria:**

**Given** the Key under every wall
**When** it renders
**Then** the six colour entries (Fast-moving, Medium-moving, Slow-moving, Dead stock, Best location, Selected) are buttons named "<glossary name>, change colour" with `aria-haspopup="dialog"` and `aria-expanded`, show the selected tint and a palette icon on hover and the fixed focus ring on focus, and Empty and 2 parts stay plain text (FR-42, UX-DR48).

**Given** a click, `Enter` or `Space` on an entry
**When** the colour popover opens above it
**Then** it is a 264px non-modal `role="dialog"` labelled by its title ("Fast-moving ▲ colour", where ▲ is the entry's miniature drawn as a decorative SVG, so the accessible name is "Fast-moving colour"), with the eight presets as a `radiogroup` of named radios ("Fast-moving shade 3 of 8", the default named "Default") with the current one ringed and checked, a Default chip with the swatch and hex, a hex field with a swatch button that opens the native colour picker, **Reset this colour** (tertiary) and **Done** (primary) (UX-DR49)
**And** focus starts on the current preset, and the popover flips or shifts to stay inside the viewport, also at 200% zoom.

**Given** the presets
**When** I move between them with arrow keys
**Then** each shade previews live on the wall behind the popover.

**Given** a hex value
**When** it is not `#RRGGBB`
**Then** the field gets `aria-invalid` and "Enter a colour as #RRGGBB"; a valid value previews at once.

**Given** a colour that fails a check
**When** it is previewed
**Then** a warning under the presets names the colour and background ("Slow-moving on the wall: 2.1:1 (3:1 or more recommended)") or the alike pair ("Slow-moving and Selection look alike (ΔE 12). Bins and the selection frame may be hard to tell apart."), linked to the hex field with `aria-describedby` and announced with `role="status"`; the planner can still keep it
**And** a fresh browser with the defaults shows no warning.

**Given** the popover
**When** I press **Done** or click outside
**Then** the pick is kept, stored (Story 11.2), "Fast-moving colour changed" is announced, and focus returns to the Key entry
**And** `Esc` restores the colour the entry had when the popover opened and returns focus; **Reset this colour** restores that entry's DESIGN.md default (for best location also the fixed `#267A4B` paper shade); nothing resets every colour at once.

**Given** a Playwright run of UJ-4
**When** Slow-moving is changed to shade 6 and the page is reloaded
**Then** the wall, mini-walls and crops use the new shade, the ▼ glyph is unchanged, and the move list print preview has no colour.

## Epic 12: Drag parts to move or swap them on the wall

The planner drags a part on the wall onto an empty location to move it, or onto an occupied one to swap it or put it together with what is there, and chooses which parts move. Every drag becomes ordinary Manual moves on the server, so undo, combining and the move list treat them like any other move. The epic ends with the milestone 2 gate.

### Story 12.1: Drag commands expand into manual moves on the server

As a planner,
I want a drop on the wall to be saved as one command that the server turns into ordinary manual moves,
So that a swap is never saved as half its moves and every move it makes behaves like any other manual move.

**Acceptance Criteria:**

**Given** the closed command list (AD-6)
**When** this story is done
**Then** `domain/commands.py` holds `move_parts {from, to, parts[]}`, `put_together {from, to, parts[]}` and `swap {from, to, parts[], back_parts[]}`, their handlers live in the drag slice module (`domain/drag.py`) and use only the kernel (`planning.replay`, `stock_at`, `current_location`, `is_empty`), and `schema.ts` is regenerated (AD-13).

**Given** a valid `move_parts` or `put_together` command
**When** `domain.apply` runs it
**Then** it appends one Manual step per chosen part, from → to, in the current round (round 0 before the first run), in the order the parts are listed, with the next move numbers, and FR-33's rules hold for each step: all of the part's stock at the from-location moves, stock is added together if the to-location already holds the part (FR-51, FR-33)
**And** `move_parts` is rejected with `command_rejected` when the to-location is occupied, and `put_together` when it is empty.

**Given** a valid `swap` command
**When** `domain.apply` runs it
**Then** it appends first one Manual step per chosen part (from → to), then one per back-part (to → from), all in the current round and all with one new `swap_id` derived as `uuid5(command_id, "swap:1")` and the swap's step count as `swap_size` (AD-1, AD-5, AD-16)
**And** the whole command is one transaction and one version bump, and the response events are `swap_made` with the move numbers plus `move_made`, `moves_combined` or `move_removed` per step as `replay` reports them (FR-34 applies to each step).

**Given** an invalid drag command
**When** it is applied
**Then** it is rejected with `command_rejected` and nothing changes when: no part is chosen; a `swap` has no back-part; a part is chosen on both sides; a chosen part is not stored at its stated location; the from- or to-location is virtual or not in the Locations file; or from equals to (AD-16, FR-51)
**And** a part kept in place is accepted, and its keep-in-place mark stays (FR-51, FR-32).

**Given** the move preview (AD-3)
**When** `GET /api/plans/{id}/moves/preview?part=&from=&to=` is called for a drop target
**Then** it also returns `target: empty | occupied | none` and, for an occupied target, the parts stored there (number, description, class, picks, stock, kept in place), so the drop dialog never computes them itself; it writes nothing.

**Given** the answer-key case from PRD §7.3
**When** domain tests `test_fr51_*` run
**Then** a swap dragged from a location with two parts where only one is chosen moves only that part out and the chosen back-part in, the other part stays, both steps share one `swap_id`, and undoing the last step removes only the back-part's move
**And** a retried `swap` with the same `command_id` returns the stored result without adding steps (AD-6).

### Story 12.2: Drag a bin on the wall and drop it on an empty location

As a planner,
I want to drag a part with the mouse from its bin to an empty slot in the same aisle,
So that I can try a placement in one gesture instead of typing a location code.

**Acceptance Criteria:**

**Given** the Locations wall in **One aisle** (`modules/locations/drag`, @dnd-kit)
**When** I press on an occupied bin and move the pointer more than 4px
**Then** a drag starts: the bin is drawn as the lifted bin following the pointer and its slot shows the dashed vacated outline; a press without that movement stays a click (select, pin the tooltip) (UX-DR50)
**And** with a split label the part under the pointer is dragged, and with three or more parts the part with the most picks is.

**Given** a drag in progress
**When** I hover a location in the open aisle
**Then** an empty slot shows the plus glyph and "Move here", an occupied one shows ⇄ and "Swap or put together", using the server preview for the dragged part (AD-3); virtual locations, hatched no-location cells and the bin's own slot show no target and the not-allowed cursor
**And** previews are requested at most once per target per plan version, and the drag stays inside the open aisle: aisle tabs and cards are not drop targets.

**Given** a drag in progress
**When** I press `Esc` or drop outside the wall
**Then** the drag is cancelled and nothing changes.

**Given** the from-location holds one part
**When** I drop it on an empty location
**Then** no dialog opens: `move_parts` is sent, and after the server confirms the bin settles in its new slot with the "M" marker and the toast "Moved 4410281: G-14-04-02 → G-14-01-04 (Manual, round 1)." shows; FR-34 merges happen silently with the merge toast from the Manual move dialog (FR-51, UX-DR26)
**And** while the command is unconfirmed every plan-changing control is `aria-disabled` with "Saving the last change…" (AD-12).

**Given** the from-location holds several parts
**When** I drop on an empty location
**Then** the drop dialog popover opens anchored to that location, titled "Move to G-14-01-04", with a checkbox per part of the from-location (glyph, part number, description, class · stock), the dragged part checked, and **Move** (primary) and **Cancel**
**And** with no part checked Move is disabled with "Choose at least one part to move."; Move sends `move_parts` with the checked parts, and a move of several parts toasts "Moved 2 parts: G-14-04-02 → G-14-01-04 (Manual, round 1)."

**Given** the places drag is not allowed
**When** I press and move on the Whole warehouse view, the Best locations step, or a recommendation crop
**Then** no drag starts, and keyboard users keep **Manual move…** as the path for every move a drag makes (NFR-10).

### Story 12.3: Drop on an occupied location to swap or put together

As a planner,
I want a drop on an occupied location to ask whether to swap or put the parts together,
So that I decide what happens to the parts already there.

**Acceptance Criteria:**

**Given** a drag dropped on an occupied location
**When** the drop dialog opens
**Then** it is titled "G-14-01-03 is occupied", shows "Parts to move from G-14-04-02" only when the from-location holds several parts (dragged part checked), "Parts to move back to G-14-04-02" only when the dropped-on location holds several parts (all checked, Swap only), and **Swap** and **Put together** (both secondary, neither default) then **Cancel** (UX-DR50)
**And** nothing changes until I choose; `Esc` or Cancel closes it with nothing changed and returns focus to the wall.

**Given** the dialog buttons
**When** no part to move is checked, or Swap is chosen with no part to move back checked
**Then** the button is disabled with "Choose at least one part to move." / "Choose at least one part to move back." (UX-DR10).

**Given** a part in the swap is kept in place
**When** the dialog shows
**Then** a warning triangle and an ink sentence "4410297 is kept in place. Swap anyway?" sit above the buttons, Swap stays enabled, and after the swap the mark is still set (FR-51, FR-32).

**Given** I choose **Put together**
**When** the server confirms `put_together`
**Then** each chosen part has its own Manual move into the location, stock of the same part is added together, and the wall shows the bins with "M" markers (FR-51, FR-33).

**Given** I choose **Swap**
**When** the server confirms `swap`
**Then** the chosen parts sit in the dropped-on location, the chosen back-parts sit in the from-location, each has its own Manual move in the current round, and the toast "Swapped G-14-04-02 ↔ G-14-01-03 · 2 manual moves, round 1." shows (FR-51)
**And** the dialog's checkboxes and buttons work with the keyboard, and a Vitest test covers the disabled reasons and the warning.

### Story 12.4: Swaps through undo, outdated recommendations and the move list

As a planner,
I want a swap to undo one move at a time and to print as a marked swap,
So that the colleague knows to set one bin aside and the plan stays easy to reverse.

**Acceptance Criteria:**

**Given** a swap of two parts in the plan
**When** I use **Undo last move**
**Then** the first undo reverses only the back-part's move, with the `undo_preview` wording ("Undo move 8: …"), and a second undo reverses the other move (FR-35, FR-51)
**And** after each undo every unapplied recommendation of the latest run becomes outdated, as for any undo (FR-29).

**Given** an open recommendation whose part or suggested location a drag touched
**When** the drag commands are applied
**Then** it becomes outdated with `moved` or `filled` by the same `revalidate` as manual moves, and the wall and the list show it outdated (FR-29, AD-7).

**Given** an intact swap
**When** the move list print view opens
**Then** its lines follow each other where FR-38's order allows, each reads "Manual · Swap 1/2" with "G-14-01-03 ↔ G-14-04-02" under it, and the footnote "Swap: set one bin aside, move the other into its place, then put the first one in." appears (FR-38, UX-DR52)
**And** after one of its moves is undone or combined (FR-34), the remaining lines print as ordinary Manual lines: a swap is intact only while all of its `swap_size` steps are logged and each is its own effective move, all in one round and going both ways between one pair of locations, so a partly undone swap with several back-parts also loses its mark (AD-17)
**And** two Manual moves made with the keyboard (Manual move…) carry no `swap_id`, so a swap made that way prints as two ordinary Manual lines without the swap mark.

**Given** the answer-key swap case (PRD §7.3)
**When** the app-level test `tests/app/test_fr51_swap_move_list.py` runs through the command endpoint
**Then** a swap dragged from a location with two parts with one chosen gives exactly its two marked move-list lines, and undoing one of its moves leaves one unmarked Manual line.

**Given** Playwright in Chromium
**When** `e2e/drag.spec.ts` drags a part onto an occupied bin, chooses Swap, undoes once and opens the move list
**Then** the wall, the toasts, the undo text and the printed lines match the ACs above.

### Story 12.5: Milestone 2 gate

As the author,
I want the whole core proven locally by the answer-key tests and the README demo flow,
So that milestone 2 is finished and stable before any stage 2 or "if time allows" work starts (SM-C3); the public deployment is checked later in Story 16.2.

**Acceptance Criteria:**

**Given** the full test suite
**When** CI runs
**Then** SM-1 is green: answer-key and fixture tests cover import checks and integrity (FR-3–FR-6, FR-36), reusing an import (FR-2), reopening with identical state (FR-9), delete isolation (FR-12), occupancy including zero-stock locations (FR-14), picks and classes (FR-16–FR-17), pick groups (FR-19), best locations (FR-21), runs, rules, "no space" and outdated recommendations (FR-23–FR-27, FR-29), moves, keep in place, combined moves, undo and reset (FR-30–FR-35), swaps (FR-51), before/after counts (FR-37) and move-list content and order (FR-38)
**And** a script lists every core FR (FR-1–FR-40, FR-42, FR-50, FR-51) and NFR with the test names that carry its ID, and fails if a core FR has none (SM-7).

**Given** a clean checkout
**When** I follow only the README
**Then** install, start, the step-by-step import of `data/sample/`, best-location marks, recommendations, the planning copy, the before/after table and the move list run without errors, and the Playwright SM-2 flow passes in `chromium`, `firefox` and `msedge`, each with the move-list print check (SM-2, NFR-2, NFR-9)
**And** the README also covers running the tests, the demo account `demo`/`demo`, the env setup with `.env.example` holding no real values (NFR-6), and that the public deployment holds synthetic data only (NFR-5).

**Given** the performance and size checks
**When** `tests/app/test_nfr8_timing.py` and the max-size import test run
**Then** importing `data/sample/` with classes and pick groups takes under 10 s, a run under 5 s, a command plus the plan views under 1 s (NFR-8), and a generated import at `MAX_ROWS_PER_FILE` keeps every plan view response under 4 MB (AD-18)
**And** no scaling work beyond NFR-7 (about 10 users, a few at a time) is added; the optimistic-version retry (AD-6) is the only concurrency handling
**And** the gate is recorded in the session log; a run of the README flow by someone else is noted as still to be done before submission (SM-2).

## Epic 13: Category check

Stage 2, started only after the milestone 2 gate. The planner keeps a global list of keyword rules and aisle categories and sees every part that sits in an aisle not meant for its category. Starter rules make the check work on the demo data without setup.

### Story 13.1: Keyword rules are stored globally and give each part a category

As a planner,
I want keyword rules that turn a word in the part description into a category,
So that parts get a category from their description, never from their part number.

**Acceptance Criteria:**

**Given** the storage decision deferred by the spine (Deferred: stage 2 storage)
**When** this story starts
**Then** it records the decision in the spine's Deferred section: keyword rules and aisle categories are global tables owned by `swp/store`, not part of any plan's `state`, and the first stage 2 migration is expand-only and creates only `keyword_rules` (`id`, `position`, `keyword`, `category`, `updated_at`) (AD-9).

**Given** a new pure domain slice `domain/categories.py`
**When** it gives parts a category
**Then** a keyword matches whole words only, ignoring case (`casefold`), so "oil" matches "Engine oil" but not "Coil spring"; the first matching rule in the planner's order wins, so "Oil filter" is a filter only when the "filter" rule comes before the "oil" rule; a part with no matching rule has no category (FR-44)
**And** domain tests `test_fr44_*` cover whole-word matching, case, punctuation and hyphens as word boundaries, and first-rule-wins.

**Given** the keyword-rule API (`api/routers/categories.py`, JSON, behind the same-origin guard and login)
**When** I create, edit, delete or reorder rules
**Then** `GET/POST /api/keyword-rules`, `PATCH/DELETE /api/keyword-rules/{id}` and `PUT /api/keyword-rules/order` (the full ordered id list plus `base_ids`, the order the client saw; a stored order that differs from `base_ids` is `command_rejected` 409 and the client reloads the list) change the one global list shared by every plan, an empty keyword or category is `validation_failed`, and a duplicate keyword is `validation_failed` with "That keyword already has a rule." (FR-43, AD-11)
**And** `schema.ts` is regenerated and `tests/app` cover the endpoints on SQLite and Postgres.

### Story 13.2: Manage keyword rules and aisle categories

As a planner,
I want screens to edit the keyword rules in order and to give each aisle its categories,
So that the check follows how my warehouse is actually laid out.

**Acceptance Criteria:**

**Given** the launcher
**When** the stage 2 slot **CAT** is opened
**Then** it is now active (no "Coming in stage 2"), and opens the Categories page (`modules/categories`) with two tabs: Keyword rules and Aisle categories (UX-DR7).

**Given** the Keyword rules tab
**When** I add, edit, delete or reorder a rule
**Then** the rules show as a data table in their order (position, keyword, category), each row has Edit, Delete… (confirm dialog with Cancel focused) and Move up / Move down buttons as the keyboard path for reordering, and every change is saved through the 13.1 API and shown only after the server confirms it; Edit sends only the changed fields (FR-43, NFR-10, UX-DR16, UX-DR18).

**Given** aisle categories
**When** this story adds them
**Then** an expand-only migration creates `aisle_categories` (`aisle`, `category`, unique together), `GET/PUT /api/aisle-categories/{aisle}` sets the full category list of one aisle, and aisles are matched by their Aisle text, so the assignment applies to every plan with that aisle (FR-45)
**And** the Aisle categories tab lists the aisles of the open plan's import, each with its categories as removable chips and a picker of the categories that exist in the keyword rules; it reads them from `GET /api/plans/{plan_id}/aisle-categories` (every aisle of the plan's import with its categories, plus the rule categories to pick from), which writes nothing.

**Given** a category used by an aisle but no longer by any rule
**When** the tab renders
**Then** the category stays on the aisle and is shown with "no keyword rule gives this category", so nothing is removed silently.

### Story 13.3: Run the category check on the planning copy

As a planner,
I want a list of every part whose category is not one of its aisle's categories,
So that I find parts put away in aisles meant for other kinds of parts.

**Acceptance Criteria:**

**Given** a plan, the keyword rules and the aisle categories
**When** `GET /api/plans/{id}/category-check` is called
**Then** it runs one `replay` and `domain.categories.check`, and returns each part whose category is not assigned to the aisle of its current location in the planning copy, with part number, description, category, current location, aisle and the aisle's categories, in AD-14 order (FR-46)
**And** parts without a category, parts with no current location and aisles without categories are not checked, and the view carries the plan `version` (AD-3).

**Given** the same plan state, keyword rules and aisle categories
**When** the check runs twice
**Then** it gives the same result; recommendations never use categories, and a recommendation applied into an aisle of another category shows up in the check (FR-46).

**Given** the Category check page (`/plans/{id}/categories/check`)
**When** it renders
**Then** it shows the list as a data table with counts ("12 parts outside their aisle's categories · 4 aisles without categories"), each part opens the part panel, and an empty result says "Every checked part is in an aisle meant for its category." (UX-DR18, UX-DR24, UX-DR56)
**And** it updates after every move, undo and reset, like the other plan views.

### Story 13.4: Starter categories for the demo data

As an examiner following the README,
I want the demo setup to include keyword rules and aisle categories,
So that the category check runs on the demo data with no manual setup.

**Acceptance Criteria:**

**Given** the demo part descriptions in `data/sample/`
**When** the starter list is made
**Then** a keyword-rule list and aisle categories are drafted with AI (Claude Code) during development, checked by the author before commit, and stored as `backend/settings/starter_categories.toml`, built only from the synthetic demo data (NFR-4)
**And** the session log records that AI drafted it and the author checked it.

**Given** `swp.app.bootstrap(seed)`
**When** it runs and both category tables are empty
**Then** it loads the starter list idempotently (an existing list is never overwritten); this updates the "the demo account is the only seed" convention in the spine (FR-47, AD-9)
**And** there is no "already seeded" marker: when both tables are emptied again, the next bootstrap (local start or `swp db upgrade`) loads the starter list again, as the README states.

**Given** a clean checkout following the README
**When** the README's category step is followed after importing `data/sample/`
**Then** the category check runs and lists parts without any manual setup, and a test `test_fr47_starter_categories_check_runs` covers it (FR-47).

## Epic 14: Location labels with QR codes

Stage 2, started only after the milestone 2 gate. The planner prints a label for every location in an aisle, with the code in large text and a QR code a phone camera can read.

### Story 14.1: Print location labels for an aisle

As a planner,
I want to print a label for every location in a chosen aisle,
So that locations are easy to find and to scan with a phone.

**Acceptance Criteria:**

**Given** the launcher
**When** the stage 2 slot **LBL** is opened
**Then** it is now active and opens the label print view (`/plans/{id}/labels?aisle=A`, `modules/labels`) with an aisle picker of the import's aisles (UX-DR7).

**Given** a chosen aisle
**When** the view renders
**Then** it shows one label per location of that aisle in the Locations file, in Walk Path order from the server's import-scoped data (`['import', importId]`, AD-3, AD-14), virtual locations excluded
**And** each label shows the location code in large Barlow Semi Condensed bold text (for example `A-01-10-C1`) and a QR code that encodes exactly that code and nothing else (FR-48).

**Given** the QR library
**When** it is chosen in this story
**Then** it is an npm package bundled with the frontend that draws the code without any network call (NFR-2), its name and version are added to the spine's Stack table, and a Vitest test decodes every rendered QR code (with a bundled decoder such as jsQR) and checks it equals its location code (`test_fr48_qr_encodes_exact_code`).

**Given** the print
**When** I click **Print** (primary) on the screen preview
**Then** the app shell is hidden, labels print black on white on A4 in a fixed grid without splitting a label across pages, and nothing depends on printed backgrounds (NFR-9)
**And** a Playwright print check runs in `chromium`, `firefox` and `msedge`, and a QR code printed from Chrome scans to its location code with a standard phone camera app (checked by hand and noted in the session log).

## Epic 15: Concurrent-edit warning

If time allows, after the milestone 2 gate. A planner who changes a plan that someone else saved after it was opened is warned, and can reload or keep going on top of the other changes.

### Story 15.1: Warn when someone else saved the plan

As a planner,
I want a warning before my change is added to a plan someone else changed while I had it open,
So that I don't build on a picture of the plan that is no longer true.

**Acceptance Criteria:**

**Given** the command service (AD-6) and the spine's Deferred note on FR-41
**When** this story is done
**Then** a command whose `base_version` is behind the plan's current `version` is rejected with a new error code `plan_changed` (409), with details `{current_version, last_edited_by, last_edited_at}`, before it is applied; the code is added to the closed list in `swp/api/errors.py` and to AD-11 in the spine in the same change (FR-41)
**And** a repeated `command_id` still returns its stored result first, so a retry of a command that was already applied is never warned.

**Given** the client command flow (AD-12)
**When** a command gets `plan_changed`
**Then** the command is kept and a dialog says "Someone saved this plan after you opened it. Reload it to see their changes, or keep going and your change is added on top of theirs." with **Reload plan** and **Keep going** (Cancel-style default focus on Reload plan) (UX-DR16)
**And** Reload plan drops the command and refetches every `['plan', planId]` query.

**Given** I choose **Keep going**
**When** the client continues
**Then** it refetches the plan, resends the same command with the new `base_version`, and the server applies it on top of the current state, including the other user's changes; the whole plan is never overwritten by an older copy (FR-41)
**And** if the command no longer fits the new state (for example its recommendation is now outdated), it is rejected with `command_rejected` and its message, as any other command.

**Given** two browser sessions on one plan
**When** `tests/api/test_fr41_*` and a Playwright test change the plan in session B and then in session A
**Then** session A sees the warning, Keep going adds A's change after B's, and Reload plan shows B's change without A's.

## Epic 16: Go live on the public URL

Deployment was deferred on 2026-11-19: the app is built and checked locally first, and this epic starts only after the user has approved the website. It needs the user's Vercel and Supabase accounts, so it is not part of the autonomous run. The checks that used to sit in Story 1.3 and the production parts of Stories 9.7 and 12.5 are collected here. Story 16.0 (added 2026-11-25 when the open issues were triaged) closes the security and integrity gaps found by the Epic 9 and Epic 13 retrospectives before anything goes public.

### Story 16.0: Production hardening before going public

As the author,
I want the startup checks, the login throttle, the starter seed and the session-expiry handoff to hold up on a public URL,
So that the deployment can't start with unsafe settings or be guessed against, and nobody's change is saved under someone else's name.

**Acceptance Criteria:**

**Given** the startup checks (AD-10)
**When** the backend starts with `VERCEL` set and `APP_ENV` anything other than `production` (unset or `local`)
**Then** it refuses to start with one `Refusing to start: …` line, and a test covers both cases (Epic 9 retro, item 3).

**Given** an invalid setting such as a `DEMO_PASSWORD` the validator rejects
**When** the backend or `swp db upgrade` starts
**Then** it logs one `Refusing to start: …` line naming the setting and why, never its value, and prints no pydantic traceback (Story 9.7).

**Given** one username and the login throttle (FR-40, AD-18)
**When** many failed logins for that name arrive at the same time
**Then** at most 5 password checks run before the 60 s lock, because the attempt is counted before the password is verified, and a test sends the requests concurrently on SQLite and Postgres (Epic 9 retro, item 1).

**Given** the starter categories seed (FR-47)
**When** it runs at startup or in `swp db upgrade`
**Then** it reads `starter_categories.toml` only after checking that both the keyword rules and aisle categories are empty, a locked SQLite database doesn't crash startup, and the bootstrap docstring says what it does (Epic 13 retro, item 1).

**Given** a change held back because the session expired (Story 9.3)
**When** a different user logs in to continue
**Then** the held change is dropped with a message instead of being saved under the new user's name, and the same user logging in still saves it.

### Story 16.1: Live on the public Vercel URL

As the planner (and the author),
I want the approved app deployed to the public Vercel URL against Supabase Postgres,
So that it runs on the same origin it will be judged on.

**Acceptance Criteria:**

**Given** `vercel.json` with Vercel Services (frontend plus `swp.main:app`, `/api/(.*)` → backend) and preview deployments turned off
**When** `main` is deployed
**Then** the public URL serves the Next.js page and `/api/health` from the same origin against Supabase Postgres (transaction pooler, `NullPool`, `prepare_threshold=None`)
**And** `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `APP_ENV=production`, `JWT_SECRET` and `DEMO_PASSWORD` are set for Production only: Story 16.0's startup check refuses production without the two secrets, so they were set here (as built, decided 2026-11-25). The auth flags follow in Story 16.2.

**Given** the startup checks (AD-10, hardened in Story 16.0)
**When** the backend starts with `VERCEL` set and `APP_ENV` unset
**Then** it refuses to start, and a test covers it.

**Given** the deployed app and a maximum-size import (`MAX_ROWS_PER_FILE` = 25,000 locations, about 3.66 MB of wall layout uncompressed)
**When** the planner opens its Locations wall on the public URL
**Then** the wall loads, and the session log records whether Vercel's 4.5 MB response limit counts the gzipped or the uncompressed body; if it fails, the limit is lowered and AD-18 is updated (Story 12.5).

**Given** the deployed `/api/health`
**When** `keep-alive.yml` runs
**Then** it calls `GET /api/health` on the public URL once a day and can also be started by hand (`workflow_dispatch`)
**And** the README has the public URL and the steps for the manual `uv run swp db upgrade` before a schema change.

### Story 16.2: Production with login and the demo on

As the author,
I want the public deployment to run with login and the demo on,
So that examiners can use the app on the public URL with the demo account.

**Acceptance Criteria:**

**Given** Story 16.1 is live and Story 9.7's production-like build passes locally
**When** `JWT_SECRET`, `DATABASE_URL`, `MIGRATION_DATABASE_URL` and `DEMO_PASSWORD` are scoped to Production on Vercel, with `FEATURE_AUTH` and `FEATURE_DEMO` on, and `uv run swp db upgrade` has been run
**Then** the backend starts (the AD-10 checks pass) and no real secret is committed (NFR-6, NFR-4).

**Given** the production deployment of `main`
**When** the public URL is opened
**Then** it opens on the demo front page, Demo version and Log in work, the SM-2 flow runs there on `data/sample/`, and `GET /api/health` is green (NFR-5, FR-50)
**And** the result is recorded in the session log.
