---
title: 'Story 2.2: Find pick groups'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_revision: 'd2b121362bac0da9b9cda081f38dc075c5e4e6ec'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      Only the exact text code "0" is treated as no job; a Transaction Code written as text "00", "000" or "0.0" would form one large fake job.
    evidence: |-
      Import normalization (Epic 1, _parse_identifier) turns numeric cells into str(int) but only strips text cells. Unverified whether real exports ever hold zero codes as padded text; settle by checking the Transaction Code cells of a real xlsx export for text-typed zero variants.
    location: >-
      backend/swp/domain/pick_groups.py:16
    severity: medium (unverified)
  - summary: >-
      count_shared_jobs builds every pair of a job's parts, so one abnormally large job (thousands of parts) grows quadratically and could exceed the NFR-8 budget.
    evidence: |-
      On data/sample/ pick groups take about 8 ms. Unverified whether real exports have very large jobs under one code other than 0; settle by measuring the largest distinct-part count per Issue Part transaction code in a real export.
    location: >-
      backend/swp/domain/pick_groups.py:37
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** A new plan stores an empty `analysis.pick_groups`, so no plan knows which parts are used together on the same jobs, and the summary's pick-groups step count is always 0. The later views (Story 2.5) and rules (Epic 5) need these groups.

**Approach:** Add the pure `swp/domain/pick_groups.py` slice. It builds jobs from the Issue Part lines in the plan period and pairs Inventory parts that share at least the snapshot minimum of jobs. Add the kernel module `swp/domain/ordering.py` with the AD-14 pick-group order. `app.plans.create` stores the ordered groups in `analysis.pick_groups`.

## Boundaries & Constraints

**Always:**
- A job is the set of distinct parts on `issue_part` lines with `period_start <= date <= period_end` that share one `transaction_code`. The code `"0"` (exact text, as normalized at import) never forms a job. A part counts once per job.
- Only parts in `ImportData.inventory` (distinct `part` values, including zero-stock rows) are considered. Other parts are dropped from the jobs before pairs are counted.
- The shared jobs of two parts is the number of jobs on which both appear. A pair is a pick group when shared jobs `>= analysis.settings.pick_group_min_shared_jobs`. The minimum is never hard-coded.
- Each stored `PickGroup` has `part_a < part_b` in `str` (code-point) order, so each part is the other's partner and the pair is stored once. A part can be in several groups.
- The stored list is in the AD-14 order from `domain/ordering.py`: most shared jobs first, then `part_a`, then `part_b`, in `str` order.
- The stored `Analysis` shape is unchanged (`pick_groups: list[PickGroup]` already exists), so `schema_version` stays 1.
- The domain stays pure (stdlib + pydantic). `pick_groups.py` imports only the kernel (never `classify`). Every test name carries its FR or NFR.

**Never:**
- No endpoints, views, frontend modules or `planning.py` (Stories 2.3–2.5). No other orders in `ordering.py` yet.
- Never read `analysis.toml` in the domain. Never edit `data/sample/` or `data/answer-key/`.
- No change to `classify.py` or the import slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Exactly the minimum | P and Q share 5 jobs, min 5 | group (P, Q, 5) | No error expected |
| One below | P and Q share 4 jobs, min 5 | no group | No error expected |
| Repeated part on a job | P twice on code J | J counts once for P | No error expected |
| Code 0 | P and Q on code `0` | not a job, adds nothing | No error expected |
| Out of period | job dated 2025-09-30 (period from 2025-10-01) | not counted; 2025-10-01 and 2026-09-30 count | No error expected |
| Other types | Move to Repair / Receipt / Return to Stock lines sharing a code | not a job | No error expected |
| Transactions-only part | `9999` shares 6 jobs with `6100` | no group | No error expected |
| Minimum from snapshot | same data, `pick_group_min_shared_jobs = 4` | the 4-job pair becomes a group | No error expected |
| Part in several groups | `8100` with `8200` and `8300` | two groups | No error expected |

</intent-contract>

## Code Map

- `backend/swp/domain/analysis.py` -- kernel. `PickGroup(part_a, part_b, shared_jobs)` and `Analysis.pick_groups` already exist; reuse them unchanged. The module and `build_analysis` docstrings say "pick groups arrive in Story 2.2": reword them.
- `backend/swp/domain/classify.py` -- the pattern to follow: pure functions taking `ImportData` plus the `Analysis` snapshot; keys/lists in `str` order.
- `backend/swp/domain/import_data.py` -- kernel models. `TransactionLine(type, part, transaction_code: str, date)`; `TransactionType` value `"issue_part"`. Numeric code cells were normalized to `str(int)`, so code zero is `"0"`.
- `backend/swp/app/plans.py:64-66` -- `create()` builds the analysis and sets `parts` with `model_copy(update=...)`. Add `pick_groups` there (the kernel must not import a slice; composition stays in the app layer).
- `backend/swp/domain/views/summary.py:95-99` -- the pick-groups step count is already `len(analysis.pick_groups)`. No change.
- `backend/.importlinter` -- `domain-slices` independence contract lists `import_`, `classify`, `views.summary`. Add `swp.domain.pick_groups`.
- `backend/tests/rules/test_layer_rules.py:129-173` -- `SLICE_IMPORTS` cases and `KERNEL_MODULES` set; `test_nfr1_every_domain_module_is_kernel_or_independent_slice` fails until `ordering` is in `KERNEL_MODULES` and `pick_groups` is in the contract.
- `backend/tests/domain/answer_key.py` -- `answer_key_import()` and `expected()`; `expected()["pick_groups_in_order"]` lists 10 groups as `{"parts": [a, b], "shared_jobs": n}` in AD-14 order; `not_pick_groups` holds `6100`–`6200` (4) and `6100`–`9999`.
- `backend/tests/domain/test_classify.py:17-45` -- `SETTINGS`, `_line`, `_data` helpers to mirror for synthetic data (use `kind="issue_part"` and an explicit code).
- `backend/tests/app/test_create_plan.py:120-130` -- `test_fr18_create_stores_classes` pattern (answer-key CSVs through `read_import(_data_files("answer-key", "csv"))`, row read from `PlanRow`). `_data_files("sample", "xlsx")` gives the sample files.
- `backend/tests/app/test_plan_summary.py:55` -- asserts `counts["pick-groups"] == 0` on `data/sample/`; it becomes the real count.
- Frontend: the step counts are not rendered anywhere and `Analysis` is not a wire type, so there is no user-visible change, no `schema.ts` change and no new Playwright test; the existing e2e suite must stay green.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- NEW kernel module. Docstring: the home of every rule-defined order (AD-14); text is `str` code-point order. Add `pick_group_order(groups: Iterable[PickGroup]) -> list[PickGroup]`, sorted by `(-shared_jobs, part_a, part_b)`. -- AD-14.
- `backend/swp/domain/pick_groups.py` -- NEW slice. Add `build_jobs(transactions, parts: Set[str], start, end) -> dict[str, frozenset[str]]` (code → distinct considered parts; skip code `"0"`, non-`issue_part` lines, out-of-period dates and parts not in `parts`), `count_shared_jobs(jobs) -> dict[tuple[str, str], int]` (keys `(a, b)` with `a < b`), and `find_pick_groups(data: ImportData, analysis: Analysis) -> list[PickGroup]` (Inventory parts, snapshot period and minimum, returned through `pick_group_order`). Import only kernel modules. -- FR-19, FR-18.
- `backend/swp/app/plans.py` -- in `create()`, set `pick_groups=find_pick_groups(imported.data, analysis)` in the same `model_copy` update; mention pick groups in the docstring. -- AD-4.
- `backend/swp/domain/analysis.py` -- reword the two "pick groups arrive in Story 2.2" docstrings. -- Accuracy.
- `backend/.importlinter` -- add `swp.domain.pick_groups` to `domain-slices`. -- AD-1.
- `backend/tests/rules/test_layer_rules.py` -- add `"swp.domain.ordering"` to `KERNEL_MODULES`; add the `SLICE_IMPORTS` case `"pick_groups imports classify": ("domain/pick_groups.py", "import swp.domain.classify\n")`. -- NFR-1.
- `backend/tests/domain/test_pick_groups.py` -- NEW. `test_fr19_answer_key_pick_groups` (list equals `pick_groups_in_order`, mapped to `(part_a, part_b, shared_jobs)`, including `8100` in two groups and the exactly-5 pairs), `test_fr19_traps_do_not_count` (`6100`–`6200` has exactly 4 shared jobs in `count_shared_jobs` and no group; no group contains `9999`), and synthetic tests for every I/O-matrix row: `test_fr19_five_shared_jobs_form_a_group_four_do_not`, `test_fr19_repeated_part_counts_once`, `test_fr19_code_zero_is_not_a_job`, `test_fr19_period_boundaries`, `test_fr19_only_issue_part_lines_form_jobs`, `test_fr19_only_inventory_parts`, `test_fr18_pick_group_minimum_from_settings_snapshot`. Plus `test_fr19_pick_group_order` on `pick_group_order` (ties by `part_a` then `part_b`, `"30400" < "3050"`). -- I/O matrix, FR-19, AD-14.
- `backend/tests/app/test_create_plan.py` -- add `test_fr19_create_stores_pick_groups` (answer-key plan: stored `row.analysis["pick_groups"]` equals the expected list as dicts `{part_a, part_b, shared_jobs}` in order, and `plans.get` returns the same) and `test_nfr8_sample_plan_within_import_budget` (time `read_import` + `plans.create` on the sample xlsx files with `time.perf_counter`; assert under 10 s and that `analysis.pick_groups` is non-empty). -- AD-4, NFR-8.
- `backend/tests/app/test_plan_summary.py` -- replace `counts["pick-groups"] == 0` with the real sample count (compute it once from `find_pick_groups` on the sample import and pin the number). -- Summary shows real counts.

**Acceptance Criteria:**
- Given the answer-key dataset, when the domain tests run, then the pick groups equal `expected.json` `pick_groups_in_order` exactly (content and order), and `6100`–`6200` and `6100`–`9999` are not groups.
- Given a plan created through `app.plans.create`, when its row is read back, then `analysis.pick_groups` holds every group (both parts and shared jobs) in AD-14 order, and `GET /api/plans/{id}` on a sample plan reports that number as the pick-groups step count.
- Given the sample files, when a plan is created with classes and pick groups, then it takes under 10 s.
- Given `pick_groups.py` importing another slice, when `lint-imports` runs, then the `domain-slices` contract is BROKEN; on the real tree all contracts are kept.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 19 findings — high 0, medium 0, low 11, false 4, maybe-false 4
- findings:
  - `[false]` `[reject]` (blind) NFR-8 test starts the timer after read_import — `read_import(files)` is an argument of the `plans.create(...)` call on the line after `started = time.perf_counter()`, so it runs inside the timed block.
  - `[low]` `[reject]` (blind) Wall-clock NFR-8 assertion can be flaky on slow runners — the run takes about 1.2 s against a 10 s budget (8x margin); the story's AC requires the budget check.
  - `[low]` `[reject]` (blind) Summary test pins 127 with no traceable source — sample data is generated deterministically and `test_fr18_analysis_toml_matches_answer_key` pins the settings; deriving the number from `find_pick_groups` would make the check circular.
  - `[false]` `[reject]` (blind) A job crossing the period boundary is split — FR-19 defines a job as the Issue Part lines in the period that share a code, so per-line date filtering is the rule, not a defect.
  - `[low]` `[patch]` (blind) Zero-stock Inventory parts never tested — added `test_fr19_zero_stock_inventory_part_is_considered`.
  - `[low]` `[reject]` (blind) Part at several locations untested — the considered set is a set comprehension over Inventory rows; a dedicated test adds little for an unlikely defect.
  - `[maybe-false]` `[defer]` (blind) Text zero codes ("00", "0.0") form a real job — recorded in deferred (medium unverified); settle by checking real exports for text-typed zero codes.
  - `[maybe-false]` `[defer]` (blind) No cost guard for very large jobs — recorded in deferred (medium unverified); sample takes about 8 ms; settle by measuring the largest job in a real export.
  - `[low]` `[reject]` (blind) Empty inputs not tested — empty transactions or inventory return [] by construction; extra tests for a defect nobody is likely to meet.
  - `[low]` `[reject]` (blind) Layer test covers one direction for the new slice — the independence contract is symmetric and the existing reverse cases prove it bites; ordering is a kernel module covered by the kernel/slice listing test.
  - `[low]` `[reject]` (blind) PickGroup does not validate part_a < part_b or shared_jobs >= 1 — the only producer is count_shared_jobs, which sorts pairs; validators add complexity to a kernel model for no demonstrated state.
  - `[low]` `[reject]` (blind) count_shared_jobs re-deduplicates frozensets — negligible cost; it keeps the function correct for list inputs.
  - `[low]` `[reject]` (blind) Answer-key test repeats facts already in the expected list — the AC names those facts (8100 in two groups, exactly-5 pairs) explicitly; asserting them makes a failure readable.
  - `[maybe-false]` `[defer]` (edge) CSV code "00"/"0.0" kept verbatim forms a fake job — same root cause as the blind text-zero-code row; shares its deferred item.
  - `[maybe-false]` `[defer]` (edge) One job with thousands of parts grows quadratically — same root cause as the blind large-job row; shares its deferred item.
  - `[low]` `[reject]` (edge) Plans stored before this change show 0 pick groups — only local dev databases hold such plans (deployment deferred); same reasoning as Story 2.1's stored-before-change finding.
  - `[low]` `[reject]` (edge) Timing test flaky on shared CI — same reasoning as the blind-hunter flakiness row.
  - `[low]` `[reject]` (edge) Pinned 127 breaks if analysis.toml changes — the toml is pinned by `test_fr18_analysis_toml_matches_answer_key`, so a settings change already fails loudly there.
  - `[false]` `[reject]` (verification-gap, other) NFR-8 test times only plans.create — same refutation as the first row: read_import is evaluated inside the timed call.
- intent-alignment audit: descriptive; the diff implements the literal domain + stored-analysis reading (R1) the epic's split assigns to this story; its noted divergences (timer scope — refuted above; implicit partner symmetry — by design, one stored pair per group; pinned 127 — rejected above) are covered by the rows above. No divergence routed.

## Design Notes

Count pairs per job rather than per part pair, so the cost follows the job sizes:

```python
counts: Counter[tuple[str, str]] = Counter()
for parts in jobs.values():
    counts.update(itertools.combinations(sorted(parts), 2))
```

`sorted` gives `a < b` for every key, which is also the stored `part_a`/`part_b` order.

## Verification

**Commands:**
- `npm run lint:py` -- expected: no ruff errors
- `npm run lint:imports` -- expected: 5 kept, 0 broken
- `npm run test:py` -- expected: all pass (SQLite locally; Postgres runs in CI)
- `npm run lint && npm run typecheck && npm run test:web` -- expected: pass
- `npm run e2e -- --project=chromium` -- expected: all pass (no new test; no user-visible change)

## Auto Run Result

Status: done

**Summary:** New pure slice `domain/pick_groups.py` builds jobs from the Issue Part lines in the plan period (code `0` excluded, a part counted once per job, Inventory parts only), counts shared jobs per part pair, and keeps pairs that reach the snapshot minimum. New kernel module `domain/ordering.py` holds the AD-14 pick-group order. `app.plans.create` stores the ordered groups in `analysis.pick_groups`, so the summary's pick-groups step count is real (127 on `data/sample/`). The answer-key groups match `expected.json` exactly, including order and the traps.

**Files changed:**
- `backend/swp/domain/pick_groups.py` -- new slice: build_jobs, count_shared_jobs, find_pick_groups.
- `backend/swp/domain/ordering.py` -- new kernel module: pick_group_order (AD-14).
- `backend/swp/app/plans.py` -- create() stores pick groups.
- `backend/swp/domain/analysis.py` -- docstrings updated.
- `backend/.importlinter` -- pick_groups added to the domain-slices contract.
- `backend/tests/domain/test_pick_groups.py` -- FR-19/FR-18/AD-14 domain tests (answer key, traps, every I/O-matrix row, zero-stock part, ordering).
- `backend/tests/app/test_create_plan.py` -- stored pick groups and NFR-8 sample timing.
- `backend/tests/app/test_plan_summary.py` -- sample pick-groups count 127.
- `backend/tests/rules/test_layer_rules.py` -- ordering as kernel; pick_groups slice-import case.

**Review:** 19 findings. Patches applied: 1 (low: zero-stock part test). Deferred: 2 (text zero codes, very large jobs; both medium unverified). Rejected: 16 (4 false, 12 low; reasons in the triage log).

**Follow-up review recommended:** false (patched: high 0, medium 0, low 1).

**Verification:** `npm run lint:py` pass; `npm run lint:imports` 5 kept, 0 broken; `npm run test:py` 228 passed (SQLite; Postgres runs in CI); `npm run lint` and `npm run typecheck` pass; `npm run test:web` 96 passed; `npm run e2e -- --project=chromium` 29 passed. No user-visible change, so no new Playwright test.

**Residual risks:** plans stored before this change keep empty `analysis.pick_groups` until recreated; Postgres-backed app tests run only in CI; the two deferred items depend on real export data.
