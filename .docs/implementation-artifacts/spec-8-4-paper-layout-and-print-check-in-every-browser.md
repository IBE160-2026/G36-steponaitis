---
title: 'Story 8.4: Paper layout and print check in every browser'
type: 'feature'
created: '2026-11-23'
baseline_revision: '164a68f6ac9eb53f6f37d7321bc8da471b0be750'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      A band row's break-after: avoid may be ignored by Firefox, so a Firefox printout could leave a ROUND band, or a band with one line, at the bottom of a page.
    evidence: |-
      maybe-false. Firefox reports the computed value as avoid in the e2e, but whether its paginator honours avoid between table rows is unclear. Settle it by printing a list of several pages to PDF from desktop Firefox (Playwright's Firefox has no page.pdf) and checking every page end. The spec treats this as best effort.
    location: >-
      frontend/modules/move-list/move-list-page.tsx (RoundBody break utilities)
    severity: medium (unverified)
  - summary: >-
      Printing from the browser menu (Ctrl/Cmd+P) skips the Print button's refetch, so the printout carries the generated time of the last fetch.
    evidence: |-
      AD-17's refetch-then-print runs only from the Print button (Story 8.3). A beforeprint handler cannot wait for a fetch, so a menu print can be up to one view old. This is a pre-existing print-route behaviour, not caused by the stylesheet.
    location: >-
      frontend/modules/move-list/move-list-page.tsx (usePrintAfterRender)
    severity: low
  - summary: >-
      Hiding the toast list in print ([data-sonner-toaster] display none) is checked only as stylesheet text, never with a toast on screen.
    evidence: |-
      sonner renders the toaster element only while a toast exists. The new e2e shows no toast, so a renamed attribute would go unnoticed. A check needs a journey that ends in a toast and then navigates to the print route, then asserts toasts(page) is display none in print media.
    location: >-
      frontend/app/globals.css (@media print)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The print route `/plans/{id}/print` (Story 8.3) renders the move list on screen, but there is no print stylesheet: printing would carry the graphite toolbar, the preview buttons, the grey page ground and the paper's shadow, with no A4 page rule, no page-break rules and no page numbers. No Playwright project checks the printed list.

**Approach:** Add the print layer: a `@media print` section in `frontend/app/globals.css` (A4 portrait `@page`, best-effort "Page X of Y" margin box, white page, toasts hidden) and `print:` utilities on the app shell, the preview actions and the paper (hidden chrome, no gutter/shadow, band break rules, 1.5px tick box). Add a cross-browser e2e (`chromium`, `firefox`, `msedge`) that emulates print media on the sample plan and saves a PDF (Chromium-based) or a full-page screenshot as a test attachment.

## Boundaries & Constraints

**Always:**
- In print media: the skip link, the toolbar `<header>` (with flow bar, plate, launcher), the save-status region, the toast list, the preview actions row (Print, Back to Recommendations) and any fetch-error alert above the paper are `display: none`. Only the paper (header block, table, footnotes) prints.
- Paper in print: A4 portrait (`@page { size: A4 portrait; margin: … }`), page/body background white, paper without gutter, max-width, padding or shadow. Every glyph and rule inside the paper computes to `rgb(0, 0, 0)`; no element inside the paper has a background other than transparent or white. Nothing relies on printed backgrounds (`print-color-adjust: exact` may be set but is not required).
- Rules: lines 1px black bottom rule; ROUND band 2px black rules above and below and a 1.5px black box around "ROUND N"; tick box 14px × 14px with a 1.5px black border (DESIGN.md `print-move-list.tick-box`) — the 1.5px border applies on screen too.
- Type (existing tokens): part, from, to and the swap "A ↔ B" in `type-print-code` (Barlow Semi Condensed 700, 16px ≈ 12pt); other text in `type-print-body` (Figtree 13.5px ≈ 10pt); plan name 14pt bold Barlow.
- Pagination: header block and column heads stay in the table's `<thead>` (repeats per page, `display: table-header-group`). Every line row and the band row have `break-inside: avoid`; the band row has `break-after: avoid`, and when the round has two or more lines the first line row has `break-after: avoid` too (band keeps at least two lines). "Page X of Y" via an `@page` margin box (`counter(page)` / `counter(pages)`), best effort (Firefox may not render it).
- Screen view unchanged apart from the tick box border: no visible change to the screen layout of other pages.
- E2E: new spec `frontend/e2e/move-list-print.spec.ts`, importing `test`/`expect` from `./support/test`, using `createSamplePlan` and the shared `postCommand`; it runs in every Playwright project (no project filter) and is named for UJ-2 and NFR-9.
- Tests name their FR/NFR/UX-DR (`nfr9`, `uxdr52`, `fr38`).

**Never:**
- No backend change, no `schema.ts` change, no change to move-list order, data or copy semantics; no PDF/CSV export feature in the app.
- No new npm or Python dependency (no PDF parser); no colour, grey tone, tint or bin swatch in the printed paper.
- Do not edit `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`. No session logs or `.logs/`. No deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Print media, plan with moves | sample plan, aisle A best, run, apply all; `/print` with `emulateMedia({media:"print"})` | toolbar/actions hidden; header lines visible; band count = "N rounds"; line count = summary `move_count`; all paper text black, no non-white backgrounds | No error expected |
| Screen media again | same page, `emulateMedia({media:"screen"})` | toolbar and Print visible again | No error expected |
| Round with one line | band + 1 line | band row `break-after: avoid`; the single line carries no extra `break-after` | No error expected |
| Chromium-based project | `chromium`, `msedge` | `page.pdf({ preferCSSPageSize: true })` succeeds (bytes start `%PDF`), attached as `move-list.pdf` | — |
| Firefox project | `firefox` (no `page.pdf`) | full-page screenshot in print media attached as `move-list-print.png` | — |

</intent-contract>

## Code Map

- `frontend/app/globals.css` -- tokens `--color-print-ink`/`--color-print-paper`, utilities `type-print-body|code|round` (lines ~76, ~153, ~261); add a `@media print` section at the end (`@page`, body/html white, `[data-sonner-toaster]` hidden). Tailwind 4: `print:` variant is built in; `break-after-avoid`/`break-inside-avoid` utilities exist. `tests/design-tokens.test.ts` parses this file — keep token lines untouched.
- `frontend/components/common/app-shell/index.tsx` -- skip link `<a>` and `<main>`; add `print:hidden` to the skip link.
- `frontend/components/common/app-shell/toolbar.tsx:56` -- `<header>` root; add `print:hidden`.
- `frontend/components/common/app-shell/save-status.tsx:16` -- `SaveStatusView` live-region `<div>`; add `print:hidden`.
- `frontend/components/common/toast.tsx:23` -- sonner `Toaster` (portal; hidden via the CSS rule, not a prop).
- `frontend/modules/move-list/move-list-page.tsx` -- `MoveListView` wrapper `px-page-gutter py-5` (→ `print:p-0`), actions row and `PlanLoadError` above the paper (→ `print:hidden`), `Paper` (`max-w-[210mm] px-8 py-8 shadow-overlay` → `print:max-w-none print:p-0 print:shadow-none`), `RoundBody` band `<tr data-round-band>` and lines `<tr data-move-line>` (break utilities), tick box `<span … border border-print-ink>` (→ `border-[1.5px]`). Keep all data attributes; 8.3 tests query them.
- `frontend/tests/move-list.test.tsx` -- Vitest on static markup (`html(view)` helper, `VIEW` fixture); extend.
- `frontend/e2e/move-list.spec.ts` -- 8.3 journey; pattern for plan setup (`createSamplePlan`, `postCommand` set_best_mark aisle A / run / apply_all, `getJson` summary `move_count`). Must stay green in all three projects.
- `frontend/e2e/support/test.ts`, `support/plan-api.ts`, `support/sample-plan.ts` -- shared e2e helpers (retro epic-7 #64: reuse `postCommand`, no new local poster).
- `frontend/playwright.config.ts` -- projects `chromium`, `firefox`, `msedge` (macOS `--disable-gpu`); no change needed.
- Retro items: epic-7 #64 (shared e2e command poster) followed by reusing `postCommand`; epic-6 #54 (copy in `lib/copy`) — no new React strings; the "Page X of Y" text lives in CSS `content` and cannot come from `lib/copy`; epic-4 #37 / epic-5 #47 (e2e robustness, three-browser local gate) — the new spec waits on visible state, not timeouts, and the three-browser run is part of verification. No other open item concerns the changed code.

## Tasks & Acceptance

**Execution:**
- `frontend/app/globals.css` -- add the `@media print` section: `@page { size: A4 portrait; margin: 12mm 12mm 16mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 13.5px Figtree, sans-serif; color: #000 } }`, `html, body { background: var(--color-print-paper) }`, `[data-sonner-toaster] { display: none !important }`; comment it as Story 8.4 / UX-DR52 / AD-17.
- `frontend/components/common/app-shell/index.tsx`, `toolbar.tsx`, `save-status.tsx` -- `print:hidden` on the skip link, header and save-status region.
- `frontend/modules/move-list/move-list-page.tsx` -- print utilities per Code Map; update the header comment (stylesheet now present).
- `frontend/tests/move-list.test.tsx` -- `uxdr52_*` Vitest: actions row and error are `print:hidden`; paper has `print:shadow-none`/`print:p-0`; band row has break-inside/after avoid; first line of a ≥2-line round has break-after avoid, a 1-line round's line does not; tick box `size-[14px]` with `border-[1.5px]`. A `nfr9_*` test that `globals.css` contains `@media print`, `size: A4 portrait`, `counter(pages)` and hides `[data-sonner-toaster]`.
- `frontend/e2e/move-list-print.spec.ts` -- `uj2 nfr9 prints the move list on A4 in black and white`: sample plan via API, `set_best_mark` aisle A, `run`, `apply_all`; summary `move_count`; open `/plans/{id}/print`, wait for lines; `emulateMedia({ media: "print" })`; assert header `banner` and Print/Back controls hidden, title/"Data as of"/"Generated" visible; band count equals N from the data line; line count equals `move_count`; every element inside `[data-paper]` computes `color` `rgb(0, 0, 0)` and background transparent/white (one `page.evaluate`); body background white; a band's tag has 1.5px border, band row 2px top/bottom; a line row 1px bottom; tick box 14px; part cell `font-weight` 700, `font-size` 16px, family contains "Barlow"; description cell 13.5px Figtree; `thead` `display: table-header-group`; band row `break-after: avoid`. Then attach the artifact: Chromium-based → `page.pdf({ preferCSSPageSize: true, printBackground: false })`, assert `%PDF` and at least one `/Type /Page` object, attach `move-list.pdf`; Firefox → `page.screenshot({ fullPage: true })` attach `move-list-print.png`. Finally `emulateMedia({ media: "screen" })` and assert the Print button is visible again.

**Acceptance Criteria:**
- Given the print route of a plan with moves, when it is printed (print media), then the app shell, toolbar and preview buttons are hidden, the page is A4 portrait, and the paper is pure black on white with 1px line rules, 14px tick boxes and boxed ROUND bands, codes Barlow bold ~12pt and text Figtree ~10pt, with nothing depending on printed backgrounds.
- Given a list longer than one page, when it is printed, then the `<thead>` header and column heads repeat per page, a band keeps at least two lines with it, and "Page X of Y" shows where supported.
- Given Playwright projects `chromium`, `firefox` and `msedge`, when `npm run e2e` runs, then `move-list-print.spec.ts` and `move-list.spec.ts` pass in all three and each project attaches a PDF (Chromium-based) or screenshot.
- Given the repo, when `npm run lint`, `npm run typecheck`, `npm run lint:py`, `npm run lint:imports`, `npm test` and `npm run e2e -- --project=chromium` run, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 30 findings — high 0, medium 0, low 25, false 3, maybe-false 2
- findings:
  - `[low]` `[patch]` (blind) the PDF is never checked for A4 or page numbers — the Chromium/Edge branch now asserts an A4 `/MediaBox` (595 x 842 pt). Page numbers stay in the manual check (no PDF text extraction without a new dependency).
  - `[low]` `[patch]` (blind) no test covers a list longer than one page — the PDF branch now asserts at least 2 `/Type /Page` objects, so the sample list prints on several pages (11 in Chromium). The repeated header on later pages is still checked by eye.
  - `[low]` `[reject]` (blind) the Firefox screenshot is not a paginated print — Playwright's Firefox has no `page.pdf`, and AC3 prescribes a screenshot for Firefox. The print-media computed checks still run there.
  - `[low]` `[reject]` (blind) print checks run at a 1440px viewport — the computed rules do not depend on width, and the real A4 layout is in the PDF artifact. Narrowing the viewport adds nothing the PDF lacks.
  - `[low]` `[reject]` (blind) the colour sweep skips opacity, SVG fill/stroke, outline, text-decoration and pseudo-elements — the paper has no SVG, no opacity utility and no pseudo-element content, so nobody meets this today; extending the sweep adds branches for a hypothetical.
  - `[low]` `[patch]` (blind) the wrapper's `print:p-0` is not asserted — the e2e asserts the paper's parent has 0px left and top padding in print, and the Vitest asserts the wrapper carries `print:p-0`.
  - `[low]` `[patch]` (blind) a round with exactly two lines is untested — new Vitest `uxdr52_band_keeps_both_lines_of_a_two_line_round` on a copy of `VIEW`.
  - `[low]` `[reject]` (blind) the `@page` footer hardcodes 13.5px Figtree and #000 instead of tokens — custom properties do not reliably reach the page margin context across browsers. The values match the tokens today, and drift would only change the page-number type.
  - `[low]` `[defer]` (blind) a Ctrl/Cmd+P print skips the refetch, so the generated time can be stale — this is pre-existing Story 8.3 print-route behaviour; a `beforeprint` handler cannot wait for a fetch. Recorded in `deferred`.
  - `[low]` `[patch]` (blind) the loading, error and empty states have no print rules — the empty message was grey (`text-ink-secondary`) and now has `print:text-print-ink`, covered by Vitest `uxdr52_empty_message_prints_black`. The loading/error part is rejected with the edge row below.
  - `[low]` `[reject]` (blind) `print:hidden` sits mid-string in the class lists — cosmetic, no behaviour difference, and the class order follows the repo's formatter.
  - `[low]` `[reject]` (edge) the loading notice or load error prints during a menu print before the view arrives — what prints is an accurate status, nobody prints a page that has not loaded in normal use, and the fix adds wrappers.
  - `[low]` `[patch]` (edge) the empty state prints grey — same as the blind empty-state row; same patch.
  - `[low]` `[reject]` (edge) the colour sweep gaps (outline, decoration, opacity, pseudo) — same as the blind colour-sweep row.
  - `[low]` `[patch]` (edge) the unit test reads source CSS, not the build — the e2e PDF `/MediaBox` assertion now runs the built `@page` size. Same patch as the A4 row.
  - `[maybe-false]` `[defer]` (edge) Firefox may not honour `break-after: avoid` between rows — Firefox reports the computed value as avoid; settling it needs a paginated Firefox printout. Medium if true; recorded in `deferred`.
  - `[low]` `[patch]` (edge) multi-page header repeat and band breaks are never exercised — same as the blind multi-page row; same patch.
  - `[low]` `[patch]` (verification-gap) A4 page size is not verified — same as the blind A4 row; same patch.
  - `[low]` `[defer]` (verification-gap) toast hiding in print is never checked with a toast shown — filed disposition `defer`. It needs a toast-then-navigate journey; recorded in `deferred`.
  - `[low]` `[patch]` (verification-gap) the wrapper's gutter removal is checked nowhere — same as the blind wrapper row; same patch.
  - `[low]` `[patch]` (verification-gap) `back` is asserted hidden without first being seen visible — added `await expect(back).toBeVisible()` before print emulation.
  - `[false]` `[reject]` (verification-gap) CI runs only chromium — AC3 says the three-browser checks "run locally before the milestone 2 gate", and they were run locally in this story (all three pass).
  - `[low]` `[patch]` (intent) A4 is checked only as CSS text — same as the blind A4 row; same patch.
  - `[low]` `[patch]` (intent) the header repeat is tested only as `table-header-group` — the multi-page patch proves pagination happens. The repeat itself is checked by eye in the attached PDF, as AC3 intends.
  - `[maybe-false]` `[defer]` (intent) "a band never ends a page alone" is a hard rule implemented best effort — same root cause as the Firefox break-after row; deferred.
  - `[low]` `[reject]` (intent) page numbers are not inspected in the PDF — the AC itself says "best effort", and reading them needs a PDF text parser (a new dependency). The Chromium PDF showed "Page 1 of 11" on manual review.
  - `[low]` `[patch]` (intent) the "list longer than one page" precondition is never established — same as the blind multi-page row; same patch.
  - `[false]` `[reject]` (intent) the shell is hidden in print on every page, not only the print route — this is intended: the shell is print chrome everywhere, and no other page is meant for printing.
  - `[false]` `[reject]` (intent) there is no evidence of the local three-browser run — `npm run e2e -- e2e/move-list-print.spec.ts e2e/move-list.spec.ts` passed 9/9 in chromium, firefox and msedge in this run.
  - `[low]` `[reject]` (intent) import, run and apply-all go through the API, not the UI — the UI import is covered by the UJ-1 specs, and AC3's subject is the print check. Driving the whole setup through the UI in three browsers adds minutes and flakiness without testing print.

## Design Notes

**Why `print:` utilities plus one CSS section:** hiding chrome and adjusting the paper belong to the components that own them (vertical slices); only things with no component handle — `@page`, the page background and the sonner portal — live in `globals.css`. `@page` is global: the move list is the only page meant for printing, so A4 portrait everywhere is harmless.

**Band keeps two lines:** browsers honour `break-after: avoid` between table rows unevenly (Chromium LayoutNG yes, Firefox partly), so this is best effort like the page numbers; the e2e asserts the computed rules, and the PDF/screenshot attachment is for the manual check.

## Verification

**Commands:**
- `npm run lint` -- expected: no ESLint errors
- `npm run typecheck` -- expected: no errors
- `npm run lint:py` and `npm run lint:imports` -- expected: pass (no backend change)
- `npm test` -- expected: pytest and Vitest pass
- `npm run e2e -- --project=chromium` -- expected: all pass
- `npm run e2e -- e2e/move-list-print.spec.ts e2e/move-list.spec.ts` -- expected: pass in chromium, firefox and msedge

**Manual checks (if no CLI):**
- Open the attached `move-list.pdf` (test-results) and check A4 portrait, black on white, header and column heads on each page, page numbers.

## Auto Run Result

Status: done

**Summary:** The move list now prints as the paper UX-DR52 describes (NFR-9, AD-17).
- **Hidden in print:** the skip link, the graphite toolbar, the save-status region, toasts, the preview actions (Print, Back to Recommendations) and any fetch error. Only the paper prints.
- **Page:** `@page` sets A4 portrait with 12/12/16 mm margins and a best-effort "Page X of Y" margin box. The page ground is white.
- **Paper:** no gutter, max-width or shadow in print, and every glyph and rule is black.
- **Breaks:** band rows and lines avoid breaking inside. A band keeps its first line, and the first line keeps the second when the round has two or more lines.
- **Tick box:** now has a 1.5px border.

A new cross-browser e2e checks the print-media render on the sample plan in chromium, firefox and msedge:
- the chrome is hidden;
- the header lines are present;
- the band count equals "N rounds" and the line count equals `move_count`;
- everything is black on white;
- the rule widths, tick box, Barlow/Figtree sizes, `thead` and break rules are as specified.

It attaches an A4 PDF of two or more pages in the Chromium-based projects, or a print-media screenshot in Firefox. Retro items: epic-7 #64 was followed by reusing the shared `postCommand`/`getJson`. epic-6 #54 needed nothing: there are no new React strings, and the page-number text has to live in CSS. epic-4 #37 and epic-5 #47 were followed by waiting on visible state and running the three-browser local check; AGENTS.md is untouched. No other open item concerns this code.

**Files changed:**
- `frontend/app/globals.css` -- `@media print`: A4 `@page` with page numbers, white page, hidden toasts.
- `frontend/components/common/app-shell/index.tsx`, `toolbar.tsx`, `save-status.tsx` -- `print:hidden` on the skip link, toolbar and save status.
- `frontend/modules/move-list/move-list-page.tsx` -- print utilities on the wrapper, actions, error and paper; band and line break rules; 1.5px tick box; the empty message prints black.
- `frontend/tests/move-list.test.tsx` -- `uxdr52_*` and `nfr9_*` Vitest for the print classes and the stylesheet.
- `frontend/e2e/move-list-print.spec.ts` -- new UJ-2/NFR-9 print check for every Playwright project, with a PDF or screenshot attachment.

**Review findings:** 30 findings: high 0, medium 0, low 25, false 3, maybe-false 2.
- **Patched (6 entries, all low):**
  - A4 `/MediaBox` in the PDF;
  - a PDF of two or more pages;
  - the wrapper's print padding;
  - a two-line-round Vitest;
  - the empty message printing black;
  - Back to Recommendations seen visible before the print check.
- **Deferred (3):**
  - Firefox `break-after` between rows (medium, unverified);
  - menu-print stale generated time (pre-existing, low);
  - toast hiding not tested with a live toast (low).
- **Rejected:** the rest, each with its reason in the triage log.

**Follow-up review:** not recommended (`false`): the patched entries were 0 high, 0 medium and 6 low.

**Verification (after the review patches):**
- `npm run lint:py`: all checks passed.
- `npm run lint:imports`: 5 contracts kept.
- `uv run --directory backend --locked ruff format --check .`: 150 files already formatted.
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm run gen:api`: `schema.ts` unchanged.
- `npm test`: pytest 694 passed, 2 skipped; Vitest 399 passed.
- `npm run e2e -- --project=chromium`: 82 passed.
- `npm run e2e -- e2e/move-list-print.spec.ts e2e/move-list.spec.ts`: 9 passed (chromium 3, firefox 3, msedge 3).
- Manual (implementation run): the Chromium PDF is A4 at 595 x 842 pt, 11 pages, black on white, with no chrome and "Page 1 of 11".

**Residual risks:**
- Computed 1.5px borders read back as 1px in Chromium and Firefox, so the e2e checks the class plus a 1px or 1.5px width.
- Only page 1 of the PDF was checked by eye, so the repeated header on later pages is unconfirmed.
- Firefox page numbers and the band-keeps-two-lines rule are unverified on real Firefox paper (best effort, deferred).
