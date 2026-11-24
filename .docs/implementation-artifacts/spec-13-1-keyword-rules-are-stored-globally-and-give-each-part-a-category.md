---
title: 'Story 13.1: Keyword rules are stored globally and give each part a category'
type: 'feature'
created: '2026-11-24'
status: 'done'
baseline_revision: '4b95570c22ec44da2709163e96e61a2032cf0b43'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-13-context.md'
  - '{project-root}/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stage 2's category check needs a part category that comes from the part description, never from the part number (FR-44), and a single global, ordered list of keyword rules the planner can maintain (FR-43). Nothing stores such rules yet, and the spine still defers the stage 2 storage decision.

**Approach:** Record the storage decision in the spine's Deferred section; add the pure domain slice `swp/domain/categories.py` (whole-word, casefold, first-rule-wins matching plus rule validation); add an expand-only migration `0004` creating only `keyword_rules`; add a store repository, an app service and a JSON router `api/routers/categories.py` with `GET/POST /api/keyword-rules`, `PATCH/DELETE /api/keyword-rules/{id}` and `PUT /api/keyword-rules/order`; regenerate `frontend/lib/api/schema.ts`. No UI in this story (13.2 builds the screens).

## Boundaries & Constraints

**Always:**
- Layers (AD-1, AD-9): `swp.domain.categories` imports only stdlib/pydantic and no other domain slice; add it to the `domain-slices` independence contract in `backend/.importlinter`. SQLAlchemy only in `swp.store`; `swp.api` never imports `swp.store`.
- Keyword rules are global (not in any plan's `state`, no plan id, no user column). Migration `0004_keyword_rules.py` (`down_revision="0003"`) is expand-only and creates only `keyword_rules` with columns in this order: `id` (Uuid PK), `position` (Integer, not null), `keyword` (String, not null), `category` (String, not null), `updated_at` (UtcDateTime, not null). Portable types only.
- Matching (FR-44): words are maximal runs of characters where `str.isalnum()` is true; everything else (spaces, punctuation, hyphens, underscores) is a boundary. A rule matches when the casefolded word sequence of its keyword appears as a contiguous run in the casefolded word sequence of the description. Rules are tried in `position` order; the first match wins; no match → no category (`None`). The part number is never read.
- Validation (all `validation_failed` 422, `details` `[{field, message}]` in order keyword, category, `message` = first detail): keyword and category are stripped of surrounding whitespace before checks and storage; empty keyword "Enter a keyword."; keyword with no letter or digit "Use letters or numbers in the keyword."; empty category "Enter a category."; either field over 64 characters "Use at most 64 characters."; duplicate keyword "That keyword already has a rule." Duplicate means the same casefolded word sequence as another rule's keyword ("Oil", " oil ", "OIL" are duplicates); a PATCH of a rule never conflicts with itself. The duplicate check runs only when the keyword's own format is valid.
- Positions are 0..n-1 with no gaps: POST appends at the end; DELETE closes the gap; `PUT /api/keyword-rules/order` with body `{"ids": [...]}` must list every existing rule id exactly once, else `validation_failed` with field `ids` and message "List every keyword rule exactly once." Every write sets `updated_at` (caller-supplied `now`, UTC) on each row it changes.
- Writes are serialized: each write runs in `store.db.write_transaction()` and on Postgres first takes `LOCK TABLE keyword_rules IN EXCLUSIVE MODE`, so the duplicate check and positions cannot race.
- Responses: a rule is `{id, position, keyword, category, updated_at}` (`updated_at` ISO 8601 `Z`). `GET` → 200 `{"rules": [...]}` in position order; `POST` → 201 the new rule; `PATCH` (body `{keyword?, category?}`; an omitted field keeps its stored value, and the merged pair is validated like a POST) → 200 the rule; `DELETE` → 204; `PUT /order` → 200 `{"rules": [...]}`. Unknown or malformed id on PATCH/DELETE → 404 `not_found` "That keyword rule no longer exists."
- The router is mounted in the `guarded` list in `swp/api/app.py` (login when auth is on); writes pass the existing same-origin guard (AD-19). Errors use the AD-11 envelope; `error_responses(...)` documents them.
- Tests carry their IDs: domain `test_fr44_*`; endpoints `test_fr43_*` in `backend/tests/app/` (run on SQLite, and locally on Postgres 17 via `--database-url`).

**Never:** no `aisle_categories` table or endpoint (13.2), no category check (13.3), no starter seed or TOML (13.4), no frontend screen, launcher change or e2e spec; no change to existing tables, JSON documents or plan `state`; no categories in recommendations; no edits to planning artifacts other than the spine's Deferred section; no edits under `data/sample/`, `data/answer-key/`; no session logs; no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Whole word | rule oil→Oils; "Engine oil", "Coil spring" | Oils; None | — |
| Case | rule "OIL"; "engine Oil" | Oils | — |
| Boundaries | rule oil; "oil-filter", "Oil, 5L", "(oil)" | Oils each | — |
| Multi-word keyword | rule "brake pad"; "Front brake-pad set" / "Brake disc pad" | match / None | — |
| First rule wins | [filter→Filters, oil→Oils] vs [oil, filter]; "Oil filter" | Filters / Oils | — |
| No rules / no match | "Bolt M8" | None | — |
| Create | POST `{keyword:" filter ", category:"Filters"}` | 201, keyword "filter", position = previous count | — |
| Empty fields | POST `{keyword:"", category:" "}` | 422, details keyword then category | no row |
| Duplicate | POST "FILTER" when "filter" exists; PATCH rule B to "filter" | 422 "That keyword already has a rule." | no change |
| Self edit | PATCH rule "filter" → keyword "Filter" | 200 | — |
| Delete | delete position 1 of 3 | 204; remaining positions 0,1 | unknown id → 404 |
| Reorder | PUT ids reversed | 200 list in new order | missing/duplicate/unknown id → 422 field `ids` |
| Cross-site write | `Sec-Fetch-Site: cross-site` POST | 403 `forbidden_origin` | no row |
| Auth on, no session | GET | 401 `unauthenticated` | — |

</intent-contract>

## Code Map

- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md:475` -- the Stage 2 Deferred bullet; replace its "keyword rules and aisle categories" part with the decision (global tables owned by `swp/store`, not in plan `state`; first stage 2 migration expand-only, only `keyword_rules (id, position, keyword, category, updated_at)`; `aisle_categories` follows in 13.2), keeping the QR / 13.4 / 15.1 remainder. Only this section.
- `backend/swp/domain/accounts.py` -- pattern for a pure rules module with the `FieldError` TypedDict and copy constants; move `FieldError` into the kernel `swp/domain/errors.py` and import it from there in both `accounts` and `categories` (a slice may not import another slice).
- `backend/swp/domain/import_data.py` -- `ImportData.parts: dict[str, str]` (part number → description); `categories.part_categories(parts, rules)` takes that mapping.
- `backend/swp/store/models.py` -- add `KeywordRuleRow`; docstring "migrations 0001 to 0003" → 0004.
- `backend/swp/store/migrations/versions/0003_login_attempts.py` -- pattern for `0004_keyword_rules.py`.
- `backend/swp/store/users.py`, `store/db.py` -- `transaction()` / `write_transaction()` pattern; new `backend/swp/store/keyword_rules.py` returns frozen dataclasses (`StoredKeywordRule`).
- `backend/swp/app/auth/__init__.py:_validation_failed` -- pattern for turning field errors into `DomainError`; new `backend/swp/app/categories.py` service (create/edit/delete/reorder/list, takes `now`).
- `backend/swp/api/routers/auth.py`, `api/schemas/auth.py` -- JSON router + pydantic request/response pattern; new `api/routers/categories.py`, `api/schemas/categories.py`; mount in `api/app.py` `guarded` tuple.
- `backend/swp/api/errors.py` -- envelope, `error_responses`.
- `backend/tests/app/conftest.py` -- `empty_tables` must also delete `KeywordRuleRow` (Postgres shares one DB).
- `backend/tests/app/test_create_plan.py:58` (`test_nfr12_migration_creates_exactly_...`) and `backend/tests/test_cli.py:19` -- table-set assertions; add `keyword_rules` (rename the nfr12 test accordingly).
- `backend/tests/app/test_signup.py` -- `SAME_ORIGIN`, `_error`, `auth_on` fixture patterns for API tests.
- `backend/tests/rules/test_layer_rules.py:189` -- fails if the new slice is missing from `domain-slices`.
- `package.json` `gen:api` -- regenerates `frontend/lib/api/schema.ts`.

## Tasks & Acceptance

**Execution:**
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md` -- record the stage 2 storage decision in Deferred -- story AC 1.
- `backend/swp/domain/errors.py` + `backend/swp/domain/accounts.py` -- move `FieldError` to the kernel, re-export/import in accounts -- DRY for the second slice using it.
- `backend/swp/domain/categories.py` -- `KeywordRule` model, `words()`, `keyword_key()`, `category_of(description, rules)`, `part_categories(parts, rules)`, `rule_errors(keyword, category, taken_keys)` with the copy constants -- FR-44, FR-43 validation.
- `backend/.importlinter` -- add `swp.domain.categories` to `domain-slices`.
- `backend/swp/store/models.py`, `backend/swp/store/migrations/versions/0004_keyword_rules.py`, `backend/swp/store/keyword_rules.py` -- table, migration, repository (list, insert, update, delete+renumber, reorder; Postgres table lock) -- AD-9.
- `backend/swp/app/categories.py` -- service: strip, validate via domain, raise `validation_failed`/`not_found`, call store -- FR-43.
- `backend/swp/api/schemas/categories.py`, `backend/swp/api/routers/categories.py`, `backend/swp/api/app.py` -- endpoints and mounting -- FR-43, AD-11, AD-19.
- `backend/tests/domain/test_categories.py` -- `test_fr44_*` for the matrix's matching rows plus `rule_errors` cases.
- `backend/tests/app/test_fr43_keyword_rules_api.py` -- migration columns, CRUD, validation, duplicates, positions, reorder errors, 404, cross-site 403, auth-on 401; `backend/tests/app/conftest.py`, `test_create_plan.py`, `backend/tests/test_cli.py` updated.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.

**Acceptance Criteria:**
- Given the spine, when this story is done, then its Deferred section states that keyword rules and aisle categories are global tables owned by `swp/store`, not part of any plan's `state`, and that the first stage 2 migration is expand-only and creates only `keyword_rules` (`id`, `position`, `keyword`, `category`, `updated_at`) (AD-9).
- Given two plans and a rule created over the API, when `GET /api/keyword-rules` is called, then the same single list is returned regardless of any plan (FR-43).
- Given a migrated database on SQLite or Postgres 17, when `tests/app` run, then `keyword_rules` exists with exactly the five columns and the endpoint tests pass on both.
- Given the regenerated `schema.ts`, when `npm run typecheck` runs, then it passes and `npm run gen:api` produces no diff.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean.
- `npm run test:py` -- expected: all pass (SQLite).
- `uv run --directory backend --locked pytest tests/app --database-url postgresql+psycopg://...` against a local `postgres:17` container -- expected: all pass.
- `npm run gen:api && git diff --exit-code frontend/lib/api/schema.ts` after committing the regenerated file -- expected: no diff; `npm run typecheck`, `npm run lint`, `npm run test:web` -- expected: pass.
- `npm run trace` -- expected: OK, FR-43 and FR-44 listed with tests.
- `npm run e2e -- --project=chromium` -- expected: existing suite stays green (no user-visible change).

## Spec Change Log

## Review Triage Log

### 2026-11-24 — Review pass
- verdicts: 24 findings — high 0, medium 5, low 11, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) DELETE omits 422 from `error_responses`, so `schema.ts` gains FastAPI's `HTTPValidationError` that contradicts the AD-11 envelope — added 422 to DELETE, regenerated; `HTTPValidationError` no longer in `schema.ts`.
  - `[low]` `[reject]` (blind) the database does not enforce length, position order or unique keywords — the spec fixes the five columns; `swp.app.categories` is the only writer and writes under a table lock; adding constraints is extra complexity with no reachable bypass today.
  - `[medium]` `[patch]` (blind) the 503 test mocks `_write_rules`, so the real write lock is never exercised — added `test_fr43_real_write_lock_is_unavailable` holding a real lock (SQLite BEGIN IMMEDIATE; Postgres LOCK TABLE → 55P03), passes on both.
  - `[low]` `[patch]` (blind) same-origin and login guards tested only on POST / GET — both tests now cover every route.
  - `[medium]` `[patch]` (blind) `updated_at` only checked with `>=` — strict checks with explicit times; new edit/delete/reorder tests show moved rows get `now` and unmoved rows keep their time.
  - `[low]` `[patch]` (blind) the "global across plans" test could not fail — now asserts each plan's id, version and state are unchanged by rule writes.
  - `[false]` `[reject]` (blind) request bodies failing schema validation are untested — the shared `_request_validation` handler maps them to the AD-11 envelope and is covered by `tests/api/test_api_errors.py`; nothing route-specific changes it.
  - `[low]` `[patch]` (blind) `reorder_rules` builds one `DomainError` per call and raises it from two places — replaced by an `_order_invalid()` factory.
  - `[low]` `[patch]` (blind) `TOO_LONG` hard-codes 64 beside `TEXT_MAX` — now `f"Use at most {TEXT_MAX} characters."`.
  - `[false]` `[reject]` (blind) values are stripped twice — `strip()` is idempotent; the app strips for storage and the domain function is safe on its own; no wrong outcome.
  - `[false]` `[reject]` (blind) `_rules` takes `Iterable[object]` — `KeywordRule.model_validate` validates every item at runtime and the API tests cover the shape; no defect reachable.
  - `[false]` `[reject]` (blind) the FR-44 matcher has no caller and the decision is not cross-referenced from AD-9 — the story limits 13.1 to the domain function (13.3 is the first consumer) and asks for the record in the Deferred section only.
  - `[medium]` `[patch]` (edge) NUL or a lone surrogate in keyword/category reaches the database and returns 500 — `rule_errors` now rejects unstorable text per field with "Use letters, numbers and ordinary symbols only."; domain and API tests added.
  - `[low]` `[patch]` (edge) DELETE 422 documented as `HTTPValidationError` — same root cause as the first row; fixed there.
  - `[medium]` `[patch]` (verification-gap) write lock is not shown to be taken — same root cause as the mocked-busy row; real-lock test added.
  - `[medium]` `[patch]` (verification-gap) `updated_at` on changed rows not pinned — same root cause as the `updated_at` row; fixed there.
  - `[low]` `[patch]` (verification-gap, other) DELETE contract documents `HTTPValidationError` — same root cause as the first row.
  - `[false]` `[reject]` (intent) categories never reach a part outside pure functions — the story's ACs place FR-44 in `domain/categories.py` with domain tests; 13.3 adds the check endpoint.
  - `[low]` `[patch]` (intent) "global" shown only structurally — same root cause as the "global across plans" row; fixed there.
  - `[false]` `[reject]` (intent) rules beyond the story text (64-character limit, multi-word keywords, partial PATCH, 404/`ids` errors) — these are spec-level choices inside FR-43/FR-44 and AD-11, recorded in the intent contract; no defect.
  - `[low]` `[patch]` (intent) the Postgres lock path was not tested under contention — same root cause as the mocked-busy row; the real-lock test runs on Postgres too.
  - `[low]` `[patch]` (intent) guards tested per method only on POST/GET — same root cause as the guard row; fixed there.
  - `[false]` `[reject]` (intent) out-of-scope changes (`FieldError` moved to the kernel, trace script table, table-set tests) — the move is required by the slice-independence rule (DRY), the trace table only lists FR-43–FR-48, and the table-set tests must change with any new table.
  - `[false]` `[reject]` (intent) no frontend surface — the screens are Story 13.2; 13.1 has no user-visible change by its ACs.

## Auto Run Result

Status: done

**Summary.** Stage 2 storage for keyword rules is decided and recorded in the spine's Deferred section. A new pure slice `swp/domain/categories.py` gives a part a category from its description: whole words (runs of `isalnum` characters), casefolded, multi-word keywords as a contiguous run, first rule in position order wins, no match gives no category (FR-44). Migration `0004` creates only the global `keyword_rules` table; `swp/store/keyword_rules.py` rewrites the ordered list under a write lock (BEGIN IMMEDIATE on SQLite, `LOCK TABLE ... IN EXCLUSIVE MODE` on Postgres); `swp/app/categories.py` validates and maps a held lock to 503 `unavailable`; `api/routers/categories.py` serves `GET/POST /api/keyword-rules`, `PATCH/DELETE /api/keyword-rules/{id}` and `PUT /api/keyword-rules/order` behind login and the same-origin guard (FR-43). `schema.ts` regenerated. No UI (Story 13.2).

**Files changed.**
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md` -- Deferred: stage 2 storage decision.
- `backend/.importlinter` -- `swp.domain.categories` in the domain-slices contract.
- `backend/swp/domain/errors.py`, `domain/accounts.py`, `app/auth/__init__.py` -- `FieldError` moved to the kernel.
- `backend/swp/domain/categories.py` -- matching and rule validation (new).
- `backend/swp/store/models.py`, `store/migrations/versions/0004_keyword_rules.py`, `store/keyword_rules.py` -- table, migration, repository.
- `backend/swp/store/db.py`, `store/plans.py` -- `is_busy` shared from `db.py`.
- `backend/swp/app/categories.py`, `api/schemas/categories.py`, `api/routers/categories.py`, `api/app.py` -- service and endpoints.
- `backend/tests/domain/test_categories.py`, `tests/app/test_fr43_keyword_rules_api.py` (new); `tests/app/conftest.py`, `tests/app/test_create_plan.py`, `tests/test_cli.py` -- new table in fixtures and table-set checks.
- `scripts/traceability.py` -- lists stage 2 FRs (FR-43–FR-48) without failing.
- `frontend/lib/api/schema.ts` -- regenerated.

**Review.** 24 findings: 15 rows patched in 8 entries (3 medium: real-lock test, `updated_at` pinning, NUL/surrogate validation; 5 low: DELETE 422 docs, guard coverage on all routes, plan-untouched check, `_order_invalid()` factory, `TOO_LONG` from `TEXT_MAX`), 0 deferred, 9 rejected (1 low: no DB-level constraints, the service is the only writer under a lock; 8 false — see the triage log for each reason).

**Follow-up review recommended: true** (3 medium entries patched, 0 high). Unverified risk: the patch round added the `_storable` text check and the real-lock tests (Postgres `LOCK TABLE` waiting out the 3 s `lock_timeout`) without a fresh review pass.

**Verification.**
- `npm run lint:py`, `ruff format --check`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` (SQLite) -- 1075 passed, 2 skipped.
- `pytest tests/app --database-url postgresql+psycopg://...` on local `postgres:17` -- 353 passed, 3 skipped.
- `npm run gen:api` twice -- identical output; no `HTTPValidationError`.
- `npm run typecheck`, `npm run lint` -- pass; `npm run test:web` -- 713 passed.
- `npm run trace` -- OK, FR-43 28 tests, FR-44 9 tests.
- `npm run e2e -- --project=chromium` -- 139 passed, 4 skipped (existing placeholders for later epics), 0 failed. No user-visible change, so no new e2e spec and no firefox/msedge run for a new spec.

**Residual risks.** Keyword-rule writes take an exclusive table lock on Postgres; at demo scale this is fine, but a slow writer makes others wait up to 3 s and then answer 503. Categories compare as entered (stripped, case kept); 13.2/13.3 decide how aisle categories match them.
