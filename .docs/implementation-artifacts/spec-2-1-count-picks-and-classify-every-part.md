---
title: 'Story 2.1: Count picks and classify every part'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_revision: '8cdc6b71e04964032dfdb93fe7523253b79f90ff'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      Part numbers are joined on exact text, so a part written as text with leading zeros in one file and as a number cell in another (0100 vs 100) would get 0 picks.
    evidence: |-
      Pre-existing import normalization (Epic 1, _parse_identifier turns numeric cells into str(int)). Unverified whether real exports mix text and numeric part cells; settle by checking an xlsx export whose Part column holds numeric cells in one file and text in the other.
    location: >-
      backend/swp/domain/import_.py:134
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** A new plan stores an empty `analysis.parts`, so no part has picks or a movement class and the overview shows 0 in every class. Epic 1's retro (item 8) also found that the slice-independence rule for domain slices is not enforced, and Epic 2 adds the second domain slice.

**Approach:** Add the pure `swp/domain/classify.py` slice. It counts the Move to Repair picks in the plan period and classifies every Inventory part with the limits from the settings snapshot. `app.plans.create` stores the result in `analysis.parts`, so the summary and overview show real counts. Before that, move the normalized-import model types out of the `import_` slice into a new kernel module, so both slices can use them. Then add an import-linter `independence` contract over the domain slices.

## Boundaries & Constraints

**Always:**
- One pick = one `move_to_repair` line with `period_start <= date <= period_end`, whatever its quantity. Other transaction types never count. Only the stored date counts; the time of day was already dropped at import.
- The classified parts are exactly the distinct `part` values of `ImportData.inventory`, including parts whose only rows have stock 0 (`1008614-00`). Do not use `ImportData.parts`, which only holds parts that have a description. Parts that appear only in Transactions (`9999`) get no entry.
- Class limits come from `analysis.settings` (the snapshot): picks `>= fast_min_picks` → `fast`, `>= medium_min_picks` → `medium`, `>= slow_min_picks` → `slow`, otherwise `dead`. The period comes from `analysis.period_start/period_end`.
- `analysis.parts` keys are in part-number `str` (code-point) order, so the stored JSON is deterministic.
- The domain stays pure (stdlib + pydantic only). A domain slice imports only the kernel. Every test name carries its FR or NFR.
- The stored `Analysis` shape is unchanged (`parts: dict[str, PartAnalysis]` already exists), so `schema_version` stays 1 and no upcaster is needed.

**Never:**
- No pick groups (Story 2.2), no `ordering.py`/`planning.py` (Story 2.3), no new endpoints or frontend modules.
- `analysis.toml` is never read inside the domain, and limits are never hard-coded.
- No re-export shim for the moved types: update every importer.
- Never edit `data/sample/` or `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Period start boundary | data_as_of 2026-09-30; Move to Repair on 2025-09-30 (incl. 09:00) and on 2025-10-01 | 2025-09-30 not counted; 2025-10-01 counted | No error expected |
| Period end boundary | Move to Repair on 2026-09-30 | counted | No error expected |
| Quantity ignored | one Move to Repair line, Quantity 7 | 1 pick | No error expected |
| Other types | Issue Part / Return to Stock / Receipt lines in period | 0 picks from them | No error expected |
| Class limits | picks 0, 1, 5, 6, 23, 24 with 24/6/1 limits | dead, slow, slow, medium, medium, fast | No error expected |
| Limits from snapshot | same picks, settings fast 10 / medium 3 / slow 2 | the classes follow the snapshot (e.g. 1 → dead, 6 → medium, 23 → fast) | No error expected |
| Transactions-only part | `9999` only in Transactions | no entry in `parts` | No error expected |
| Zero-stock Inventory part | part whose rows all have Quantity 0 | classified like any part | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/import_.py` -- the slice that checks and normalizes imports. Lines 59-60 hold `TransactionType`, and lines 451-482 hold the `LocationData`, `InventoryLine`, `TransactionLine`, `ImportData` and `NormalizedImport` models. These move to the kernel. `TRANSACTION_TYPES`/`SHELF_TYPES` and the check logic stay.
- `backend/swp/domain/analysis.py` -- kernel: `AnalysisSettings`, `PartAnalysis(picks, movement_class)`, `Analysis`, `period_for`, `build_analysis(data_as_of, settings)`. Reuse these and leave them unchanged.
- `backend/swp/app/plans.py:57-87` -- `create()` builds `analysis=build_analysis(...)` and is the place to fill in `parts`. It imports `NormalizedImport` from `import_` (line 13).
- Other importers of the moved types: `backend/swp/app/imports/__init__.py:8` (`NormalizedImport`), `backend/swp/store/plans.py:10` (`ImportData`), `backend/tests/domain/test_import_normalize.py:10`.
- `backend/swp/domain/views/summary.py:79-83` -- `class_counts(analysis)` already counts `analysis.parts`. No change is needed.
- `backend/.importlinter` -- four contracts. Add the fifth (independence).
- `backend/tests/rules/test_layer_rules.py:80-125` -- the `LAYER_VIOLATIONS` dict and the parametrized `test_nfr1_import_linter_rejects_layer_violations`, which writes a violation file into a copy of `swp`. Extend it with slice-to-slice cases.
- `backend/tests/app/test_plan_summary.py:50` and `frontend/e2e/plan-overview.spec.ts:71-74` -- currently assert class counts of 0 on `data/sample/`. Real counts are fast 80, medium 249, slow 580, dead 636 (1,545 Inventory parts).
- `frontend/modules/overview/overview-page.tsx:3-4` -- its comment says class counts stay 0 until Epic 2. Update the comment; the rendering is unchanged.
- `data/answer-key/{Locations,Inventory,transactions}.csv` plus `expected.json` `parts` (27 parts; classes written as `fast-moving`/`medium-moving`/`slow-moving`/`dead stock`) and `not_classified: ["9999"]`. The CSVs hold str cells. `check_file` parses ISO dates that include a time.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/import_data.py` -- NEW kernel module. Move `TransactionType`, `LocationData`, `InventoryLine`, `TransactionLine`, `ImportData` and `NormalizedImport` here unchanged (same field order, so the stored JSON is identical). Give it a docstring saying it is the normalized import model shared by slices. -- Two slices need these types (DRY kernel rule).
- `backend/swp/domain/import_.py` -- import those names from `swp.domain.import_data` and delete the local definitions. -- Single definition.
- `backend/swp/app/plans.py`, `backend/swp/app/imports/__init__.py`, `backend/swp/store/plans.py`, `backend/tests/domain/test_import_normalize.py` -- import the moved names from `swp.domain.import_data`. -- No re-export shim.
- `backend/swp/domain/classify.py` -- NEW slice. Add `count_picks(transactions, start, end) -> dict[str, int]`, `movement_class(picks, settings) -> MovementClass`, and `classify_parts(data: ImportData, analysis: Analysis) -> dict[str, PartAnalysis]` (Inventory parts only, keys sorted). Import only kernel modules. -- FR-16, FR-17, FR-18.
- `backend/swp/app/plans.py` -- in `create()`, build the analysis and then set `parts=classify_parts(imported.data, analysis)` (for example with `model_copy(update=...)`) before storing it. -- AD-4: computed once at creation.
- `backend/.importlinter` -- add `[importlinter:contract:domain-slices]`, `type = independence`, with modules `swp.domain.import_`, `swp.domain.classify` and `swp.domain.views.summary`. Add a comment saying that each new slice is added here and that the epics' allowed exceptions use `ignore_imports`. -- Retro item 8.
- `backend/tests/rules/test_layer_rules.py` -- add `test_nfr1_import_linter_rejects_slice_imports`, parametrized over two cases: append `import swp.domain.import_\n` to the copied `swp/domain/classify.py`, and append `import swp.domain.classify\n` to the copied `swp/domain/import_.py`. Assert that `lint-imports` fails, that its output contains "BROKEN", and that it names the domain-slices contract. -- NFR-1 proof that the contract bites.
- `backend/tests/domain/answer_key.py` -- NEW helper, `answer_key_import() -> NormalizedImport`. It reads the three answer-key CSVs with stdlib `csv` into `RawSheet`s (blank → None) and runs `check_file`, `check_import` and `normalize_import`. -- Reused by Story 2.2. The domain tests stay domain-only.
- `backend/tests/domain/test_classify.py` -- NEW. Add `test_fr16_period_boundaries` (synthetic lines on 2025-09-30, 2025-10-01 and 2026-09-30), `test_fr16_only_move_to_repair_counts`, `test_fr17_class_limits` (0/1/5/6/23/24), `test_fr18_limits_from_settings_snapshot`, `test_fr17_answer_key_classes` (all 27 parts' picks and classes equal `expected.json`, with the class names mapped; the key set equals the `expected.json` parts; `9999` is absent) and `test_fr17_zero_stock_part_classified`. -- I/O matrix.
- `backend/tests/app/test_create_plan.py` -- add `test_fr18_create_stores_classes`: a plan from the answer-key CSVs stores `analysis.parts` equal to the expected picks and classes. Also add `test_fr18_reopen_keeps_classes_after_settings_change`: create a plan with the default settings, then monkeypatch `plans.ANALYSIS_SETTINGS_PATH` (or pass other settings to a second `create`) and assert that the first plan's summary counts are unchanged. -- FR-18, AD-4.
- `backend/tests/app/test_plan_summary.py` -- in `test_fr7_summary_from_sample_files`, expect `class_counts == {"fast": 80, "medium": 249, "slow": 580, "dead": 636}`. -- The API returns real counts.
- `frontend/e2e/plan-overview.spec.ts` -- in `uj1 opens the overview after import`, expect the class rows `Fast-moving80`, `Medium-moving249`, `Slow-moving580` and `Dead stock636`. -- A visible result in UJ-1.
- `frontend/modules/overview/overview-page.tsx` -- drop "Class counts stay 0 until Epic 2" from the header comment. -- Accuracy.
- `.docs/implementation-artifacts/sprint-status.yaml` -- set action item `epic-1-retro-item-8-add-an-import-linter-independence-contra` to `status: done`. -- Retro follow-through.

**Acceptance Criteria:**
- Given a plan created from `data/sample/` through `POST /api/plans`, when `GET /api/plans/{id}` is called, then `class_counts` is `{fast: 80, medium: 249, slow: 580, dead: 636}`, and the overview page lists those four numbers.
- Given the answer-key dataset, when the domain tests run, then every part's picks and class equal `expected.json`, including `9000` (0), `0100` (1), `0500` (5), `0600` (6), `2300` (23), and `10240`/`2400` (24), and `9999` is not classified.
- Given a stored plan, when `analysis.toml` changes later, then the plan's summary shows the same classes.
- Given a domain slice that imports another slice, when `npm run lint:imports` runs, then the `domain-slices` contract is BROKEN; on the real tree, all five contracts are kept.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 8, false 5, maybe-false 1
- findings:
  - `[low]` `[patch]` Stale "classes arrive in Epic 2" docstrings in analysis.py — reworded both docstrings.
  - `[false]` `[reject]` model_copy(update=) skips validation and splits analysis composition — classify_parts returns validated PartAnalysis objects; the kernel may not import a slice, so composition in app.plans is the designed seam.
  - `[low]` `[reject]` Plans stored before this change keep parts == {} and show 0 counts — only local dev databases hold Epic 1 plans (deployment is deferred); a recompute upcaster needs the import and is more than a direct fix.
  - `[low]` `[patch]` CLASS_NAMES and expected.json parsing duplicated in tests — moved CLASS_NAMES into tests/domain/answer_key.py; both tests use it and expected().
  - `[low]` `[patch]` Settings-change test ends with a weak `!= before` — now asserts exact counts {fast 17, medium 6, slow 0, dead 4}, derived from expected.json picks.
  - `[low]` `[patch]` A new domain module not listed in the independence contract goes unprotected — added test_nfr1_every_domain_module_is_kernel_or_independent_slice.
  - `[false]` `[reject]` classify_parts ignores AD-14 ordering.py — stored dict key order is not a rule-defined display order; ordering.py belongs to Story 2.3 per the epic.
  - `[false]` `[reject]` No NFR-8 performance check — the epics put the NFR-8 import budget in Story 2.2's ACs; the sample-file app tests run in about 8 s total.
  - `[low]` `[patch]` picks.get(part, 0) evaluated twice — bound once per part.
  - `[false]` `[reject]` Spec missing from the reviewed diff — the spec is excluded from the review diff by design and is committed at finalize.
  - `[low]` `[reject]` E2E asserts fused label+count strings, no thousands-separator check; sprint-status item lacks a commit ref — matches the existing test pattern, counts are under 1,000; extra checks add complexity for an unlikely defect.
  - `[low]` `[reject]` (edge) Older plans show 0 counts with no "not classified" marker — same root cause as the stored-before-change finding; rejected for the same reason.
  - `[maybe-false]` `[defer]` (edge) Part-number text mismatch between files (0100 vs 100) gives silent 0 picks — pre-existing import normalization; recorded in deferred.
  - `[low]` `[reject]` (verification-gap, other) Epic 1 plans keep stale zero counts — same root cause as above; rejected for the same reason.
- intent-alignment audit: descriptive; the diff implements the vertical reading (domain + app storage + API/overview counts) and the kernel-extraction reading of the retro item; no divergence routed.

## Design Notes

The classify functions take the `Analysis` built by `build_analysis`, so period and limits come from one snapshot:

```python
analysis = build_analysis(imported.data_as_of, settings)
analysis = analysis.model_copy(update={"parts": classify_parts(imported.data, analysis)})
```

`analysis.py` stays slice-free, because the kernel never imports a slice. The composition happens in the app layer.

## Verification

**Commands:**
- `npm run lint:py` -- expected: no ruff errors
- `npm run lint:imports` -- expected: 5 kept, 0 broken
- `npm run test:py` -- expected: all pass (SQLite locally; Postgres runs in CI)
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass

## Auto Run Result

Status: done

**Summary:** New pure slice `domain/classify.py` counts Move to Repair picks in the plan period and classifies every Inventory part with the snapshot limits; `app.plans.create` stores the result in `analysis.parts`, so `GET /api/plans/{id}` and the overview show real class counts (sample data: fast 80, medium 249, slow 580, dead 636). The normalized-import models moved to the new kernel module `domain/import_data.py`, and an import-linter `independence` contract (`domain-slices`) now enforces that domain slices never import each other (epic 1 retro item 8, marked done).

**Files changed:**
- `backend/swp/domain/import_data.py` -- new kernel module with the normalized import models.
- `backend/swp/domain/classify.py` -- new slice: count_picks, movement_class, classify_parts.
- `backend/swp/domain/import_.py` -- uses the kernel models; local definitions removed.
- `backend/swp/domain/analysis.py` -- docstrings updated.
- `backend/swp/app/plans.py` -- create() stores classified parts.
- `backend/swp/app/imports/__init__.py`, `backend/swp/store/plans.py` -- import models from the kernel.
- `backend/.importlinter` -- new domain-slices independence contract.
- `backend/tests/domain/answer_key.py`, `backend/tests/domain/test_classify.py` -- answer-key helper and FR-16/17/18 domain tests.
- `backend/tests/app/test_create_plan.py`, `backend/tests/app/test_plan_summary.py`, `backend/tests/domain/test_import_normalize.py`, `backend/tests/rules/test_layer_rules.py` -- storage, reopen, summary, contract tests.
- `frontend/e2e/plan-overview.spec.ts` -- UJ-1 overview shows real class counts.
- `frontend/modules/overview/overview-page.tsx` -- stale comment removed.
- `.docs/implementation-artifacts/sprint-status.yaml` -- retro item 8 done.
- `.docs/implementation-artifacts/epic-2-context.md` -- compiled epic 2 context.

**Review:** 14 findings. Patches applied: 5 (all low). Deferred: 1 (part-number text mismatch, medium unverified). Rejected: 8 (5 false, 3 low; reasons in the triage log).

**Follow-up review recommended:** false (patched: high 0, medium 0, low 5).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept, 0 broken; `npm run test:py` 213 passed (SQLite; Postgres runs in CI); `npm run lint` and `npm run typecheck` pass; `npm run test:web` 96 passed; `npm run e2e -- --project=chromium` 29 passed.

**Residual risks:** plans stored before this change keep empty `analysis.parts` (0 counts) until recreated; Postgres-backed app tests run only in CI.
