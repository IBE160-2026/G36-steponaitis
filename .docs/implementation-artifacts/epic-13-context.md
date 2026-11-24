# Epic 13 Context: Category check

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Stage 2, started only after the milestone 2 gate. The planner keeps one global, ordered list of keyword rules (a keyword in the part description gives a category) and assigns categories to aisles. The category check then lists every part whose category is not among its aisle's categories in the planning copy, so the planner finds parts put away in aisles meant for other kinds of parts. Starter rules and aisle categories for the synthetic demo data make the check run with no manual setup when the README is followed.

## Stories

- Story 13.1: Keyword rules are stored globally and give each part a category
- Story 13.2: Manage keyword rules and aisle categories
- Story 13.3: Run the category check on the planning copy
- Story 13.4: Starter categories for the demo data

## Requirements & Constraints

- **Keyword rules (FR-43):** create, edit, delete, reorder. One rule = one keyword → one category (e.g. "filter" → Filters). Global: the same list in every plan. Empty keyword or category → `validation_failed`; duplicate keyword → `validation_failed` with "That keyword already has a rule."
- **Part category (FR-44):** comes only from the part description, never from the part number (part numbers change). Whole-word match ignoring case (`casefold`): "oil" matches "Engine oil", not "Coil spring"; punctuation and hyphens are word boundaries. First matching rule in the planner's order wins ("Oil filter" is a filter only if "filter" comes before "oil"). No match → no category.
- **Aisle categories (FR-45):** one or more categories per aisle, global, matched by the Aisle text so they apply to every plan with that aisle.
- **Category check (FR-46):** every part whose category is not assigned to the aisle of its current location in the planning copy. Not checked: parts without a category, parts with no current location, aisles without categories. Deterministic, no AI: same plan state + rules + aisle categories → same result. Recommendations never use categories; a recommendation applied into an aisle of another category shows up in the check.
- **Starter categories (FR-47):** demo setup includes keyword rules and aisle categories; following the README after importing `data/sample/`, the check lists parts with no manual setup (`test_fr47_starter_categories_check_runs`).
- **Synthetic data only (NFR-4):** the starter list is drafted with AI (Claude Code) from `data/sample/` only, checked by the author before commit; the session log records both facts.
- **Accessibility (NFR-10):** reordering has a keyboard path (Move up / Move down buttons).
- **Tests:** name with IDs (`test_fr44_*`, etc.) so `npm run trace` maps them; `tests/app` cover endpoints on SQLite and Postgres.

## Technical Decisions

- **Storage (AD-9, decided and recorded in the spine by Story 13.1):** keyword rules and aisle categories are global tables owned by `swp/store`, not part of any plan's `state`. Migrations are expand-only: the first stage 2 migration creates only `keyword_rules` (`id`, `position`, `keyword`, `category`, `updated_at`); `aisle_categories` (`aisle`, `category`, unique together) follows in its own expand-only migration in Story 13.2. Portable types only (SQLite + Postgres).
- **Domain slice:** new pure module `domain/categories.py` (stdlib + pydantic only) for categorising parts and `check`. The check endpoint runs one `replay` then `domain.categories.check`.
- **API:** `api/routers/categories.py`, JSON, behind the same-origin guard and login. `GET/POST /api/keyword-rules`, `PATCH/DELETE /api/keyword-rules/{id}`, `PUT /api/keyword-rules/order` (full ordered id list); `GET/PUT /api/aisle-categories/{aisle}` (sets the aisle's full list); `GET /api/plans/{id}/category-check`. `swp.api` never imports `swp.store` directly.
- **Errors (AD-11):** closed envelope `{"error": {code, message, details}}`; backend writes final English `message`.
- **Views (AD-3):** the check view carries the plan `version`; client refetches it after every move, undo and reset like other plan views; frontend computes nothing.
- **Ordering (AD-14):** check rows come in domain order from `domain/ordering.py`; the frontend shows server order.
- **Wire types (AD-13):** regenerate `frontend/lib/api/schema.ts` from `swp openapi`; CI fails on diff.
- **Seeding (AD-9):** `swp.app.bootstrap(seed)` is the only seed path. It loads `backend/settings/starter_categories.toml` idempotently only when both category tables are empty (never overwrites). This makes starter categories a second seed beside the demo account; Story 13.4 updates the spine's "demo account is the only seed" convention.

## UX & Interaction Patterns

- **Launcher (UX-DR7):** the stage 2 slot **CAT** becomes active (no "Coming in stage 2", no `aria-disabled`) and opens the Categories page (`modules/categories`) with tabs Keyword rules and Aisle categories.
- **Keyword rules tab:** data table (UX-DR18: single tab stop, `↑/↓` rows, numbers right-aligned) of position, keyword, category; per row Edit, Delete… (confirm dialog, Cancel first and focused, UX-DR16), Move up / Move down. Changes show only after server confirmation.
- **Aisle categories tab:** aisles of the open plan's import, each with categories as removable chips and a picker of categories existing in the keyword rules. A category kept on an aisle that no rule gives any more stays, shown with "no keyword rule gives this category" — nothing removed silently.
- **Category check page** (`/plans/{id}/categories/check`): data table with part number, description, category, current location, aisle, aisle's categories; count line like "12 parts outside their aisle's categories · 4 aisles without categories"; each part opens the PartPanel (UX-DR24); empty result "Every checked part is in an aisle meant for its category."
- **Copy (UX-DR56):** glossary terms verbatim, sentence case, thousands separators, no exclamation marks or praise; show the data-as-of date on plan surfaces.

## Cross-Story Dependencies

- 13.1 (done: `keyword_rules` table, domain matching, rule API, schema, spine storage decision) is the base for 13.2–13.4.
- 13.2 adds the `aisle_categories` table and API that 13.3 and 13.4 need.
- 13.3 relies on `replay` and the planning copy, the PartPanel and the plan-view refetch pattern from earlier epics.
- 13.4 needs both tables and the check; its README step joins the SM-2 demo flow.
- Epic 13 starts only after the milestone 2 gate (Story 12.5).
