---
title: 'Story 14.1: Print location labels for an aisle'
type: 'feature'
created: '2026-11-24'
status: 'done'
baseline_revision: 'a2d3bed6ca37f89cf0523980ef079c2335355ead'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-14-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-8-4-paper-layout-and-print-check-in-every-browser.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** FR-48 is unbuilt: the launcher's stage 2 plate **LBL** is inert ("Coming in stage 2"), and there is no way to print a label with a scannable QR code for each location of an aisle. The UJ-2 placeholder `uj2 fr48 location labels with QR codes printed from a plan` in `frontend/e2e/user-journeys.spec.ts` is still `test.skip`. Epic 14 was once marked as dropped, but the user has reversed that and wants it built.

**Approach:** Add a vertical slice. On the backend, a pure domain view `swp.domain.labels` lists every aisle's locations in Walk Path order, and an import-scoped, immutable `GET /api/imports/{import_id}/labels` serves it. On the frontend, `modules/labels` adds the print view `/plans/{id}/labels?aisle=A` with an aisle picker, a paper preview and **Print**. QR codes are drawn by the bundled npm package `uqr` with no network call. The LBL plate becomes an active link.

## Boundaries & Constraints

**Always:**
- **The server owns aisle membership and order.** Labels follow Walk Path order (numeric), with ties broken by code in `str` order. Aisles follow `aisle_order`. Virtual locations are never labels: they are not in `ImportData.locations`. The frontend renders lists in response order and never sorts, filters or parses codes.
- **The QR code encodes exactly the location code:** no prefix, URL or whitespace. It is drawn as inline SVG from `uqr`'s module matrix: black modules on white, with a quiet zone of 4 modules. The SVG has `role="img"` and `aria-label="QR code <code>"`.
- **The import query key is `['import', importId, 'labels']`,** with `staleTime: Infinity` and `gcTime: Infinity`, like `importLayoutQueryOptions`. The response carries `Cache-Control: private, max-age=31536000, immutable`.
- **Print rules (NFR-9):**
  - In print media only the paper shows: the app shell, toolbar, aisle picker, heading and buttons are hidden, and the paper is pure black on white.
  - Labels sit in a fixed grid: 3 columns, each label a fixed 36mm tall with a 1px black cut border.
  - Each row of 3 is a block with `break-inside: avoid`, so a label is never split across pages.
  - Nothing relies on printed backgrounds.
  - The A4 `@page` rule in `globals.css` stays shared.
- The code text uses Barlow Semi Condensed bold (`font-code`), 20pt, no wrap, above the QR code (about 24mm square).
- **Print** is the only primary button. It calls `window.print()`. No refetch is needed, because an import never changes.
- **Test names carry their IDs** (SM-7): `test_fr48_…`, `it("test_fr48_qr_encodes_exact_code")`, and e2e titles `uj2 …`.
- **Spine updates in the same change:**
  - Stack table: `uqr` 0.1.3 (bundled QR encoder) and `jsqr` 1.4.0 (test-only decoder).
  - The Deferred note "QR library is still decided…" is resolved.
  - The capability map's stage 2 row names `domain/labels` and `modules/labels` for FR-48.
- Exact versions are pinned in `frontend/package.json`: `uqr` as a dependency, `jsqr` as a devDependency.

**Never:**
- No QR web service, CDN or runtime network call. No `qrcode.react`, canvas or PNG generation.
- No PDF or CSV export, and no record of what was printed.
- No reading of `data/private/`.
- No editing of `data/sample/` or `data/answer-key/`.
- No import from another frontend module.
- No change to the move-list print view's behaviour.
- No claim that the phone-camera scan was done: it awaits the author's hand check.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | `/plans/{id}/labels?aisle=A`, sample import | One label per aisle A location in Walk Path order; the picker shows every aisle in server order, with A selected | none |
| No or unknown aisle | `/plans/{id}/labels` or `?aisle=ZZ` | The first aisle is shown, and the URL is replaced with `?aisle=<first>` | none |
| Pick another aisle | The user selects B in the picker | The URL becomes `?aisle=B` (router replace) and B's labels render | none |
| Walk Path ties | Two codes with the same Walk Path | Ordered by code (`str`) | none |
| Virtual location | Issue Part on `FLSKRS` | Not on any label | none |
| Unknown import | `GET /api/imports/<unknown or non-UUID>/labels` | 404 `not_found` | AD-11 error shape |
| Plan load fails | The summary or labels fetch errors | `PlanLoadError` with the message; no paper | shared 401/404 hook |

</intent-contract>

## Code Map

- `backend/swp/domain/layout.py` -- the closest model: an import-scoped pure view built from `ImportData`, using the `LocationRef` model via `_ref`. Do not import it: the domain slices are independent.
- `backend/swp/domain/ordering.py` -- the kernel of all orders. Add `walk_path_order(codes, locations)`, keyed on (walk_path, code).
- `backend/swp/domain/import_data.py:17,46` -- `LocationData`. `virtual_locations` is kept apart from `locations`.
- `backend/swp/app/layout.py`, `backend/swp/api/routers/layout.py` -- the service and router pattern to copy: `parse_import_id`, `IMPORT_NOT_FOUND`, the `IMMUTABLE` header, `error_responses(404, 422)`.
- `backend/swp/api/app.py:66-82` -- the guarded router list; add `labels.router`.
- `backend/.importlinter:100-123` -- `domain-slices` independence list; add `swp.domain.labels`.
- `backend/tests/app/test_layout_api.py`, `backend/tests/domain/test_layout.py` -- test patterns: `_sample_import`, the `empty_tables` fixture, domain fixtures.
- `frontend/lib/api/imports.ts` -- `importRootKey` and `importLayoutQueryOptions`; add the labels key, fetch, options and hook. The types come from `lib/api/schema.ts`, regenerated with `npm run gen:api`.
- `frontend/modules/move-list/move-list-page.tsx` -- the print view pattern: toolbar `print:hidden`, `[data-paper]` with `print:p-0 print:shadow-none`, Primary **Print**, `PlanLoadError` and `PlanOpening`. Copy the pattern; do not import it.
- `frontend/modules/locations/locations-page.tsx:319-333` -- how a plan page gets `import_id` (`usePlanSummary(planId).data.import_id`) and `?aisle=` (`parseLocationParams(useSearchParams())`).
- `frontend/modules/best-locations/best-locations-page.tsx:163-177` -- the native `<select>` styling to reuse for the aisle picker. Label it "Aisle".
- `frontend/lib/view-state/urls.ts:210-241` -- add `planLabelsHref(planId, aisle?)` next to `planCategoriesHref`. `parsePlanPath` already yields view `labels`. `rememberPlanView` ignores the view, since it is not a flow step.
- `frontend/app/plans/[planId]/categories/page.tsx` -- the route pattern (await `searchParams`). Add `frontend/app/plans/[planId]/labels/page.tsx`.
- `frontend/lib/launcher/index.ts:214-230` -- `CATEGORIES_ENTRY`, `SEARCH_BAND_ENTRIES`, `STAGE2_PLATES`, `STAGE2_TEXT`.
- `frontend/modules/launcher/launcher.tsx:368-410` -- `Stage2Band`: it renders CAT as a link and LBL as an inert button.
- `frontend/lib/copy` -- the home of UI strings. Add the labels copy here.
- `frontend/app/globals.css:376-398` -- the print block. Generalise its comment to cover labels; keep `@page`.
- **Tests that assert LBL is inert, and must flip to active:**
  - `frontend/tests/launcher.test.tsx:144,340-357`
  - `frontend/e2e/launcher.spec.ts:48-60`
  - `frontend/e2e/user-journeys.spec.ts:1194-1214`
- `frontend/e2e/user-journeys.spec.ts:1373` -- the skipped placeholder to make real. Leave the uj3 and uj5 placeholders alone.
- `frontend/e2e/move-list-print.spec.ts` -- the print-check template: emulated print media, colour walk, chromium PDF A4 MediaBox, Firefox screenshot attach.
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md:338-374,468,475` -- the Stack table, the capability row and the Deferred note.

## Tasks & Acceptance

**Execution:**
- `backend/swp/domain/ordering.py` -- add `walk_path_order`.
- `backend/swp/domain/labels.py` -- add the models and the builder:
  - `LabelsView{aisles: list[AisleLabels]}`, where `AisleLabels{aisle: str, locations: list[LocationRef]}` (`is_best=False`).
  - `build_labels(data)` -- every aisle in `aisle_order`, each aisle's codes in `walk_path_order`.
- `backend/.importlinter` -- add `swp.domain.labels` to `domain-slices`.
- `backend/swp/app/labels.py` and `backend/swp/api/routers/labels.py` -- the service (`not_found` for an unknown import) and `GET /imports/{import_id}/labels` with the immutable header. Register the router in `api/app.py`.
- `backend/tests/domain/test_labels.py` -- cover:
  - `test_fr48_labels_in_walk_path_order` (including a tie broken by code)
  - `test_fr48_labels_exclude_virtual_locations`
  - `test_fr48_labels_list_every_aisle`
- `backend/tests/app/test_labels_api.py` -- cover:
  - `test_fr48_labels_endpoint_on_demo_data`: sample import, aisle list, count equals the Locations rows, immutable header.
  - `test_fr48_labels_unknown_import_is_not_found`: unknown id and non-UUID.
- `frontend/package.json` and `package-lock.json` -- `npm install --workspace frontend --save-exact uqr@0.1.3` and `npm install --workspace frontend --save-exact -D jsqr@1.4.0`. Read `node_modules/uqr/dist/index.d.ts` for the `encode` API.
- `frontend/lib/api/schema.ts` -- regenerate with `npm run gen:api`.
- `frontend/lib/api/imports.ts` -- add `importLabelsKey`, `fetchImportLabels`, `importLabelsQueryOptions` and `useImportLabels`.
- `frontend/lib/view-state/urls.ts` -- add `planLabelsHref`.
- `frontend/lib/copy` -- add the labels strings:
  - title "Location labels"
  - "Aisle"
  - the heading "Location labels · Aisle A"
  - a count line "123 labels"
  - the load-failed text
- `frontend/modules/labels/qr-code.tsx` -- `QrCode({value})`: encode with `uqr` (ECC `M`, border 4). Render one `<svg>` with one `<path>` whose `d` is `M{x} {y}h1v1h-1z` per dark module. `viewBox` is the matrix size; the fill is `print-ink`; the background is a white `rect`.
- `frontend/modules/labels/labels-page.tsx` -- build the page from three components:
  - `LabelsView` (pure, testable): toolbar with Primary **Print**, a link back to the overview (tertiary or link), the `<select>` aisle picker, an h1 and the count, all `print:hidden`. Then `[data-paper]` with `[data-label-row]` rows of 3 `[data-label="<code>"]`.
  - `LabelsPage`: summary, then `useImportLabels`, aisle choice, and `router.replace` for a missing or unknown aisle.
- `frontend/app/plans/[planId]/labels/page.tsx` -- the route.
- `frontend/app/globals.css` -- update the print comment only, unless the labels need a rule that has no component handle.
- `frontend/lib/launcher/index.ts` and `frontend/modules/launcher/launcher.tsx` -- add `LABELS_ENTRY` (code LBL, "Location labels", "Print a QR label for every location in an aisle", keywords `labels`, `qr`), render it as an active link like CAT, and add it to `SEARCH_BAND_ENTRIES`. Remove `STAGE2_PLATES` and `STAGE2_TEXT` once nothing uses them.
- `frontend/tests/labels.test.tsx` -- cover:
  - `it("test_fr48_qr_encodes_exact_code")`: render `LabelsView` with several codes, including mixed patterns and lowercase. Parse every `path d`, rasterise it at 4px per module, decode with `jsqr`, and expect it to equal the label's code.
  - `fr48` labels render in response order, one per location.
  - `fr48` Print calls `window.print`.
  - `fr48` `planLabelsHref` builds the expected URLs.
  - `fr48` aisle choice (a pure exported helper in `modules/labels`): a valid `?aisle=` wins; a missing or unknown one falls back to the first server aisle.
  - `fr48` a load error renders `PlanLoadError` with its message and no `[data-paper]`.
  - The e2e spec covers picking another aisle (`?aisle=B`) and the backend tests cover ties, virtual locations and unknown imports.
- `frontend/tests/launcher.test.tsx` -- flip LBL to an active link with href `/plans/<id>/labels`, and find it in search.
- `frontend/e2e/labels-print.spec.ts` -- `uj2 nfr9 fr48 prints location labels for an aisle on A4 in black and white`, in every project. Check:
  - the API aisle count and order equal the `[data-label]` codes in DOM order
  - in emulated print media, the shell, toolbar, picker and Print are hidden
  - the colour walk finds only black and white
  - rows have `break-inside: avoid`
  - each QR `svg` is visible
  - chromium: PDF A4 MediaBox, attached
  - otherwise: a full-page screenshot, attached
- `frontend/e2e/launcher.spec.ts` and `frontend/e2e/user-journeys.spec.ts` -- the LBL assertions become an active link. Replace the skipped uj2 fr48 placeholder with a real test: open the launcher, open LBL, check the URL `/labels`, pick aisle B, check that the URL has `?aisle=B`, that the first and last label codes equal the API's B list, and that the QR `aria-label` matches, then check that Print is visible and is the one primary button. Update the header comment ("Epics 15–16").
- `ARCHITECTURE-SPINE.md` -- add the Stack rows, the capability row and the Deferred note.

**Acceptance Criteria:**
- Given an open plan, when the launcher opens, then the LBL plate is an active link (no "Coming in stage 2", no `aria-disabled`) and Enter or a click opens `/plans/{id}/labels` with the aisle picker listing the import's aisles.
- Given aisle A of the sample, when the view renders, then the `[data-label]` codes equal the API's aisle A list exactly, and each label shows its code in Barlow bold and a QR code.
- Given every rendered QR code, when it is decoded with jsQR in Vitest, then it equals its label's code.
- Given print media in chromium, firefox and msedge, when the labels page prints, then only the black-on-white label grid shows and no label row can break across pages.
- Given the full gate, when it runs, then all checks are green, and the tests this story owns run with 0 failed, 0 flaky and 0 skipped.

## Spec Change Log

## Review Triage Log

### 2026-11-24 — Review pass
- verdicts: 30 findings — high 0, medium 7, low 16, false 5, maybe-false 2
- findings:
  - `[low]` `[patch]` (blind) `test_fr48_labels_exclude_virtual_locations` cannot fail: FLSKRS is never in the fixture's locations — patched: `test_fr48_labels_endpoint_on_demo_data` now asserts `"FLSKRS" not in codes` on the sample import, whose transactions reference FLSKRS.
  - `[low]` `[reject]` (blind) `walk_path_order` has no direct test — covered through `build_labels` (numeric Walk Path, code tie-break); a dedicated test adds no behaviour coverage a user would meet.
  - `[low]` `[reject]` (blind) the labels router imports `IMMUTABLE` from the layout router and the API test imports helpers from other test modules — both responses deliberately share the one immutable policy; moving it means a new shared module for no named breakage.
  - `[low]` `[reject]` (blind) the printed sheet carries no aisle marker — the intent requires the heading to be hidden in print media ("only the paper shows"), so it is excluded by the intent.
  - `[low]` `[reject]` (blind) long codes could clip under `overflow-hidden` + `nowrap` — the longest sample code is 10 characters, far inside the ~62mm column at 20pt; a shrink-to-fit rule adds complexity for an unseen case.
  - `[medium]` `[patch]` (blind) Enter on the LBL plate is no longer tested though the AC names "Enter or a click" — patched: `launcher.spec.ts` reopens the launcher, focuses LBL, presses Enter and expects `/plans/<id>/labels?aisle=…`.
  - `[medium]` `[patch]` (blind) the `?aisle=ZZ` redirect (matrix row) is never exercised in a browser — patched: new e2e `uj2 fr48 an unknown aisle shows the first server aisle and replaces the URL` in `labels-print.spec.ts`.
  - `[false]` `[reject]` (blind) the stage2 colour tokens are unused — they are DESIGN.md tokens that `frontend/tests/design-tokens.test.ts` requires in `globals.css`; removing them is a UX-document decision, not dead code.
  - `[low]` `[patch]` (blind) `aria-label` on the role-less `[data-paper]` div is ignored by assistive tech — patched: attribute removed (matches the move-list paper).
  - `[false]` `[reject]` (blind) labels-fetch errors bypass `showsLoadError` — `showsLoadError` only filters `plan_not_found`, which the import-scoped labels endpoint never returns, so behaviour is identical.
  - `[low]` `[reject]` (blind) the payload carries `LocationRef` fields the page never reads — the spec chose `LocationRef`; the extra bytes on an immutable, cached response hurt no one.
  - `[low]` `[reject]` (blind) `LabelsView` names a component, a generated type and a backend model — the frontend imports the type as `LabelsData`; no caller is confused.
  - `[false]` `[reject]` (blind) the labels route exports no `metadata` title — no route under `app/plans` exports metadata; the page is consistent with every other plan view.
  - `[low]` `[reject]` (blind) nothing records the pending phone-scan check — its fix is a spec edit; the pending hand check is recorded under Auto Run Result.
  - `[low]` `[reject]` (edge) long codes clip at 20pt nowrap — same as the blind finding above; sample codes are 10 characters.
  - `[maybe-false]` `[reject]` (edge) non-ASCII codes may not round-trip — sample codes are ASCII; would be low if true. Settled by adding a non-ASCII code to the jsQR test.
  - `[maybe-false]` `[reject]` (edge) an empty aisle name yields `?aisle=` — would be low if true; settled by checking whether the Locations reader accepts a blank aisle.
  - `[low]` `[reject]` (edge) a year-long immutable cache could serve an old payload shape after a schema change — the spec mandates the same policy as the layout endpoint; deployment is out of scope.
  - `[false]` `[reject]` (edge) the stage2 tokens and `lock` icon are orphaned — DESIGN.md tokens enforced by `design-tokens.test.ts`, and `lock` is in the icon set tested by `components.test.tsx`.
  - `[medium]` `[patch]` (edge) Enter activation of LBL is unverified — grouped with the Enter finding above; same patch.
  - `[medium]` `[patch]` (edge) the "Enter" half of the AC is unverified — grouped with the Enter finding above; same patch.
  - `[medium]` `[patch]` (verification-gap) the QR background fill is never checked, so a black rect would pass every test — patched: the print-media block of `labels-print.spec.ts` asserts the first QR `rect` fill `rgb(255, 255, 255)` and `path` fill `rgb(0, 0, 0)`.
  - `[false]` `[reject]` (verification-gap, other) leftover stage2 styling in `globals.css` — see the DESIGN.md/token-test refutation above.
  - `[medium]` `[patch]` (intent) the rendered QR is not verified in a browser — grouped with the QR fill gap; same patch.
  - `[low]` `[patch]` (intent) the virtual-location row is exercised only by construction — grouped with the first finding; same patch.
  - `[medium]` `[patch]` (intent) `?aisle=ZZ` never loaded in a browser; replace-vs-push not asserted — grouped with the ZZ finding; same patch.
  - `[low]` `[reject]` (intent) 20pt and ~24mm QR size are asserted only as class names — the classes are fixed Tailwind values; a computed-size check is brittle across browsers for no user-visible gain.
  - `[low]` `[reject]` (intent) the `LabelsPage` error wiring has no test — `LabelsLoadFailed` is tested; the wiring is two plain branches.
  - `[low]` `[reject]` (intent) Print is never clicked in a browser — a real print dialog blocks headless runs; the handler is unit-tested against a stubbed `window.print`.
  - `[low]` `[reject]` (intent) the API test does not check Walk Path order on the sample — order is covered by the domain tests and by the e2e DOM-order equality with the API.

## Design Notes

**Why `uqr`:** it has zero dependencies, ships ESM with TypeScript types, and returns a boolean module matrix. That lets the app draw plain SVG, which prints crisply and needs no canvas. `qrcode` pulls in `pngjs` and `yargs`, and `qrcode.react` hides the matrix.

**Why one path:** drawing the QR as one `path` of `M x y h1v1h-1z` squares keeps the DOM small, about 200 labels per aisle, and lets the Vitest test rasterise the exact rendered output without a DOM, since the environment is `node`:

```ts
for (const [, x, y] of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) fill(+x, +y); // then jsQR(rgba, w, h)
```

**Hand check:** a QR code printed from Chrome must scan to its code with a standard phone camera app. This is checked by hand. It is recorded here as awaiting the author's hand check, not as done.

## Verification

**Commands:**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports` -- expected: clean
- `npm run lint && npm run typecheck` -- expected: clean
- `npm test` -- expected: pytest and Vitest all pass
- `npm run trace` -- expected: FR-48 lists its tests, exit 0
- `npm run e2e` (chromium, firefox and msedge; port 3000 free; one run at a time) -- expected: 0 failed and 0 flaky. The only skipped tests are the unowned uj3 and uj5 placeholders.

**Manual checks:**
- Scan a QR code printed from Chrome (`labels-print.spec.ts` attaches the PDF) with a phone camera: it should read back as the location code. This awaits the author's hand check.

## Auto Run Result

**Summary:** FR-48 is built as a vertical slice. The backend has a pure view `swp.domain.labels` (every aisle in `aisle_order`, each aisle's locations in the new `walk_path_order`) served by the immutable, import-scoped `GET /api/imports/{import_id}/labels`. The frontend `modules/labels` adds the print view `/plans/{id}/labels?aisle=A`: an aisle picker, a paper of 3-column, 36mm labels, each with its code in Barlow bold and an inline-SVG QR code drawn from the bundled `uqr`, and **Print** as the only primary button. LBL is now an active launcher link and is found by search. The UJ-2 placeholder is a real journey test.

**Files changed:**
- `backend/swp/domain/ordering.py` -- `walk_path_order` (Walk Path numeric, ties by code).
- `backend/swp/domain/labels.py` -- `LabelsView`/`AisleLabels` and `build_labels`.
- `backend/swp/app/labels.py`, `backend/swp/api/routers/labels.py`, `backend/swp/api/app.py` -- the service, the endpoint with the immutable header, and its registration.
- `backend/.importlinter` -- `swp.domain.labels` added to `domain-slices`.
- `backend/tests/domain/test_labels.py`, `backend/tests/app/test_labels_api.py` -- FR-48 domain and API tests.
- `frontend/package.json`, `package-lock.json` -- `uqr` 0.1.3 and `jsqr` 1.4.0 (dev), pinned exactly.
- `frontend/lib/api/schema.ts`, `frontend/lib/api/imports.ts` -- regenerated types; the labels key, fetch, query options and hook.
- `frontend/lib/view-state/urls.ts`, `frontend/lib/copy/index.ts` -- `planLabelsHref` and the labels copy.
- `frontend/modules/labels/qr-code.tsx`, `frontend/modules/labels/labels-page.tsx`, `frontend/app/plans/[planId]/labels/page.tsx` -- the QR component, the print view and its route.
- `frontend/lib/launcher/index.ts`, `frontend/modules/launcher/launcher.tsx` -- `LABELS_ENTRY` and `STAGE2_ENTRIES`; `STAGE2_PLATES` and `STAGE2_TEXT` removed.
- `frontend/app/globals.css` -- the print comment now covers labels (comment only).
- `frontend/tests/labels.test.tsx`, `frontend/tests/launcher.test.tsx` -- jsQR round-trip and view tests; LBL flipped to active.
- `frontend/e2e/labels-print.spec.ts`, `frontend/e2e/launcher.spec.ts`, `frontend/e2e/user-journeys.spec.ts`, `frontend/e2e/support/warm-routes.ts` -- the print check, the unknown-aisle check, LBL by click and Enter, the real `uj2 fr48` journey, and route warm-up.
- `.docs/planning-artifacts/architecture/architecture-Project-2026-11-16/ARCHITECTURE-SPINE.md` -- Stack rows, the FR-48 capability row and the resolved Deferred note.

**Review findings:** 30 findings (high 0, medium 7, low 16, false 5, maybe-false 2).
- Patches applied (5 entries; 3 medium, 2 low):
  - QR background and module fills asserted in print media (medium).
  - `?aisle=ZZ` fallback and URL replace checked end to end (medium).
  - Enter on LBL opens the labels view (medium).
  - FLSKRS asserted absent on the sample import (low).
  - Invalid `aria-label` removed from the paper `div` (low).
- Deferred: none.
- Rejected: every rejected finding and its reason is in the Review Triage Log above. In short:
  - Five false: the stage2 tokens are DESIGN.md tokens enforced by a test (3 rows); `showsLoadError` only filters `plan_not_found`; no plan route exports metadata.
  - Two maybe-false that would be low: non-ASCII codes and a blank aisle.
  - Eleven low rejected as negligible, spec-chosen or excluded by the intent.

**Follow-up review recommendation:** `false`. This first pass patched 3 medium entries, which would normally make it `true`. But every patch is a test assertion or a one-attribute removal, and the full gate re-ran green after them, so no unverified risk can be named.

**Verification (after patches):**
- `npm run lint:py && uv run --directory backend --locked ruff format --check && npm run lint:imports`: clean, 5 contracts kept.
- `npm run lint && npm run typecheck`: clean.
- `npm test`: pytest 1139 passed and 2 skipped (both pre-existing, not FR-48); Vitest 752 passed in 42 files.
- `npm run trace`: exit 0, and FR-48 lists its tests.
- `npm run e2e` (chromium, firefox, msedge): 435 passed, 0 failed, 0 flaky, 6 skipped. The 6 skipped are only the unowned uj3 and uj5 placeholders, counted in each browser. `uj2 nfr9 fr48 prints location labels…`, `uj2 fr48 an unknown aisle…` and `uj2 fr48 location labels with QR codes printed from a plan` passed in all three browsers.
- The run before the patches was also green: 432 passed, 0 failed, 0 flaky, 6 skipped.

**Residual risks:**
- **Phone-camera scan:** scanning a QR code printed from Chrome (the chromium run attaches `location-labels.pdf`) **awaits the author's hand check**. It has not been done.
- **Code fit:** long or non-ASCII location codes are untested. Sample codes are 10 ASCII characters.
- **Leftover tokens:** the stage2 colour tokens and the `lock` icon stay because DESIGN.md still declares them. Removing them is a UX-document decision.
