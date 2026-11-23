---
title: 'Story 11.2: Key colours as live CSS variables kept in the browser'
type: 'feature'
created: '2026-11-23'
baseline_revision: 'd90ab8527de6f2190fa7c06047d6577613233e74'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-11-context.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The six Key colours are fixed Tailwind theme hex values, so a colour the planner picks (Story 11.3) has nowhere to go: nothing applies it everywhere at once, nothing keeps it across a reload, and a stored colour would flash the default on load.

**Approach:** Make eight `:root` CSS variables (`--colour-fast`, `--colour-medium`, `--colour-slow`, `--colour-dead`, `--colour-best`, `--colour-best-on-light`, `--colour-selection`, `--colour-selected-tint`) the single source the existing theme tokens alias, add a browser-only key-colours store in `lib/colours` (localStorage `swp:colours` inside try/catch, memory fallback), and an inline script in the root layout that applies stored colours before first paint.

## Boundaries & Constraints

**Always:**
- Defaults equal DESIGN.md: fast `#D85144`, medium `#F0B323`, slow `#417DDC`, dead `#8C939A`, best `#3DAE6B`, best-on-light `#267A4B`, selection `#9466F0`, selected-tint `#F3EFFD`; a fresh browser renders exactly as today.
- Every wall, mini-wall, crop, class swatch, best rail/frame/tag, selection frame, arrow, marker ring and selected-row bar keeps its current token (`--color-class-*`, `--color-best`, `--color-best-on-light`, `--color-accent`, `--color-selected-tint`); those theme tokens become `var(--colour-…)` aliases, so components need no change.
- Fixed tokens stay hex and never alias the variables: focus ring, `input-border`, plan plate edge, round chip, "You are here" tag, `brand-mark` (`#F0B323`), print tokens. The print stylesheet stays black on white.
- Every localStorage access is in try/catch; an invalid value (non-JSON, non-object, a non-`#RRGGBB` value) is ignored per variable and the default used. Values are only ever validated before reaching `checkContrast`/`similarPairs` (they throw `RangeError` on non-hex).
- Derived pairs stay consistent: `best`+`best-on-light` and `selection`+`selected-tint` are applied together or both fall back to default.
- Nothing about colours is sent to the server; no backend, command or plan-version change.
- Test names reference FR-42 (SM-7); e2e names the journey (`uj4 …`) and imports `test`/`expect` from `frontend/e2e/support/test.ts`.

**Never:**
- No Key buttons, popover, warnings UI or hook into the Key (Story 11.3). No new npm dependency. No edit under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`.
- No duplicated parsing logic between the inline script and the store: the script is generated from the same self-contained parser function.
- No import from `frontend/modules/*` in `lib/colours`; no refactor of WallGrid/AisleMode (retro item 89 concerns wall component structure, which this story does not touch).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nothing stored | no `swp:colours` | no inline variable set; defaults from CSS | — |
| Valid stored | `{"slow":"#378CBE"}` | `--colour-slow` = `#378CBE` on `<html>` before paint | — |
| Stored best | `{"best":"#2F9A5C","best-on-light":"#…"}` both valid | both applied | — |
| Pair broken | best valid, best-on-light missing/invalid | both ignored, defaults | — |
| Invalid value | `{"fast":"red","slow":"#378cbe"}` | fast ignored; slow applied (normalised uppercase) | — |
| Corrupt JSON / array / null | `"{oops"`, `"[1]"`, `"null"` | all defaults | no throw |
| Storage throws on read | getItem throws | all defaults, page renders | caught |
| Set colour | `setKeyColour('best', '#2F9A5C')` | `--colour-best` and derived `--colour-best-on-light` update; stored; subscribers notified | invalid hex throws `RangeError`, nothing changes |
| Reset | `resetKeyColour('best')` | best → `#3DAE6B`, best-on-light → `#267A4B` | — |
| Storage blocked on write | setItem throws | change applies in memory; `isColourStorageAvailable()` false | caught |

</intent-contract>

## Code Map

- `frontend/app/globals.css:24,58-67` -- `@theme` hex for `--color-selected-tint`, `--color-class-*`, `--color-accent`, `--color-best`, `--color-best-on-light`; turn these eight into `var(--colour-…)` and add a plain `:root { --colour-…: hex }` block with the defaults. `--color-brand-mark` (line 80), focus and print tokens stay hex. Print block at the end stays as is.
- `frontend/app/layout.tsx` -- root layout (server component); add `<head>` with the inline boot script and `suppressHydrationWarning` on `<html>` (the script adds a `style` attribute). Read `frontend/AGENTS.md` / Next 16 docs in `node_modules/next/dist/docs` for inline scripts in the App Router.
- `frontend/lib/colours/{maths,presets,checks,index}.ts` -- Story 11.1 API: `normaliseHex`, `isHexColour`, `KEY_COLOUR_ENTRIES`, `DEFAULT_COLOURS`, `DEFAULT_BEST_ON_LIGHT`, `DEFAULT_SELECTED_TINT`, `deriveBestOnLight`, `deriveSelectedTint`, `COLOUR_PRESETS` (slow shade 6 = `#378CBE`). `index.ts` header says "no storage"; update it.
- `frontend/lib/view-state/storage.ts` -- try/catch `readStored`/`writeStored` pattern (swallow errors); the colour store needs to know a write failed, so it does its own try/catch.
- `frontend/lib/copy/index.ts` -- shared UI strings; add the storage-blocked sentence.
- `frontend/tests/design-tokens.test.ts:56-75` -- `declares()` checks `--color-<key>: <hex>;` for every DESIGN.md colour; must resolve a `var(--colour-x)` alias through the `:root` default.
- Token consumers (unchanged, for the e2e/assertions): `components/common/wall/class-fill.ts`, `wall-panel.tsx` (best rail/frame/tag), `key.tsx` (`SELECTED_FRAME`), `moves-layer.tsx` (`MOVE_ARROW`), `modules/locations/warehouse-view.tsx`, `modules/recommendations/detail.tsx`, `components/common/data-table.tsx:161` (selected-row bar). Fixed ones already avoid editable tokens: `app-shell/product-mark.tsx` (brand-mark), `plan-plate.tsx`, round chip `recommendations-page.tsx:598`, `launcher.tsx:279` tag.
- `frontend/e2e/locations-wall.spec.ts`, `e2e/support/sample-plan.ts` (`createSamplePlan`), `e2e/support/plan-api.ts` (`planVersion`), `e2e/move-list-print.spec.ts` (print-media pattern on `/plans/{id}/print`).
- Open retro items: epic-10 item 89 (split WallGrid…) — not touched, components are unchanged. No other open item concerns this code.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/colours/storage.ts` -- `COLOURS_STORAGE_KEY`, `COLOUR_VARIABLES` (8 suffixes), `DEFAULT_COLOUR_VARIABLES`, self-contained `parseStoredColours(raw)` (no outer references), `COLOURS_BOOT_SCRIPT` built from `parseStoredColours.toString()`, and the store: `getKeyColours()`, `setKeyColour(entry, hex)`, `resetKeyColour(entry)`, `subscribeKeyColours(listener)`, `isColourStorageAvailable()`; applies to `document.documentElement.style`, writes all eight values to storage, memory fallback; SSR-safe (no `document` at import).
- `frontend/lib/colours/index.ts` -- export the storage API; fix header comment.
- `frontend/lib/copy/index.ts` -- `COLOURS_NOT_KEPT = "Colours can't be kept in this browser; changes last until you reload or close this page."` (Story 11.3's popover shows it).
- `frontend/app/globals.css` -- variables and aliases as in Code Map, with a comment naming FR-42.
- `frontend/app/layout.tsx` -- inline boot script in `<head>`; `suppressHydrationWarning` on `<html>`.
- `frontend/tests/design-tokens.test.ts` -- resolve aliases; assert the eight editable tokens alias `--colour-*` and the fixed ones (focus, input-border, brand-mark, print) do not.
- `frontend/tests/fr42_key_colours_storage.test.ts` -- I/O matrix rows (store with a fake storage and fake root style; boot script string run with `new Function` against fake globals gives the same result as `parseStoredColours`).
- `frontend/e2e/key-colours.spec.ts` -- `uj4 …`: stored slow `#378CBE` (via `addInitScript` before first load) → a slow bin's computed fill on the Locations wall, a mini-wall/crop in the recommendation detail if reachable, and the class swatch use it, ▼ glyph unchanged; reload keeps it; the served HTML `<head>` contains the boot script; invalid stored value → default; plan version unchanged; no request body or URL contains `#378CBE`/`swp:colours`; `/plans/{id}/print` in print media has no element whose computed colour/fill is the stored colour.

**Acceptance Criteria:**
- Given default storage, when any page renders, then computed `--colour-*` equal the DESIGN.md defaults and all existing Vitest and Playwright tests pass unchanged (apart from the design-tokens alias update).
- Given `swp:colours` with a valid slow, when the Locations wall loads, then slow bins, the Key swatch and other walls use the stored colour on first paint and after reload, with ▼ unchanged.
- Given `setKeyColour`, when called, then every element reading the aliased tokens changes at once without re-render, and with blocked storage the change still applies and `isColourStorageAvailable()` is false.
- Given a stored colour change, when the plan is reloaded or printed, then the plan version is unchanged and the print view is black and white.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 25 findings — high 0, medium 3, low 16, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` (verification-gap) `useLayoutEffect(applyKeyColours)` in Providers is untested — dev-server only (production is covered end to end by the boot script); pinning it needs a dev-mode Playwright run or a Providers render test, neither pattern exists.
  - `[false]` `[reject]` (intent) the popover's blocked-storage message is not rendered — the epic gives the popover to Story 11.3; this story ships `COLOURS_NOT_KEPT` and `isColourStorageAvailable()` for it.
  - `[low]` `[reject]` (intent) only Slow-moving is checked on screen — every listed surface reads the aliased theme tokens and no component changed; the design-tokens test pins all eight aliases.
  - `[false]` `[reject]` (intent) aliasing recolours unlisted accent/selected-tint uses (menus, launcher, flow bar) — DESIGN.md: "A changed colour replaces the token everywhere it is drawn" and `selected-tint` follows `accent`; the "You are here" tag (`launcher.tsx:278`) is ink on surface and stays fixed.
  - `[medium]` `[patch]` (intent) no test shows stored colours apply before first paint — same root as the blind/edge rows below; fixed by the e2e `slowAtBody` probe.
  - `[low]` `[reject]` (intent) print is checked negatively (no stored colour) rather than as black and white — `move-list-print.spec.ts` already asserts black on white; the stored-colour check is the delta this story adds.
  - `[low]` `[reject]` (intent) BEST text, frame shapes, import and analysis not asserted — no component, backend or command changed; plan version unchanged is asserted.
  - `[low]` `[reject]` (intent) plate edge, round chip and "You are here" tag not tested as fixed — verified by reading: they use `ink`/`surface` only, never an aliased token.
  - `[low]` `[patch]` (blind) two tabs: `setKeyColour` writes stale cached values over another tab's stored colour — `setKeyColour` now merges into what `swp:colours` holds now (memory only when the read throws); Vitest for the two-tab case.
  - `[low]` `[reject]` (blind) storing all eight values freezes today's defaults for planners who changed a colour — only matters if DESIGN.md defaults change; fix adds filtering branches.
  - `[low]` `[reject]` (blind) a stored pair is not checked against the derivation — only hand-edited storage reaches it; both halves are still valid hex and the pair rule holds.
  - `[low]` `[patch]` (blind) CSS `:root` defaults and `DEFAULT_COLOUR_VARIABLES` can drift — design-tokens test now builds the expected defaults from `DEFAULT_COLOUR_VARIABLES`.
  - `[medium]` `[patch]` (blind) boot script built from `toString()` is only proven in Vitest's build; a broken production script would be masked — e2e now records `--colour-slow` when `<body>` first appears (before app JS) and asserts `#378CBE`.
  - `[false]` `[reject]` (blind) `getKeyColours` server/client difference causes hydration mismatch — nothing renders it yet; Story 11.3 adds the `useSyncExternalStore` consumer and its server snapshot.
  - `[low]` `[patch]` (blind) Providers comment says "a no-op in production" — reworded: it sets the same values again, harmless in production.
  - `[false]` `[reject]` (blind) aliases in `@theme`, not `@theme inline`, so a per-element preview would not reach utilities — previews are on the real wall via the root variables (epic); popover swatches set their own fill.
  - `[low]` `[patch]` (blind) unit-test gaps — added `resetKeyColour("selection")` and unknown-entry `RangeError` tests; the remaining listed gaps are small branches covered indirectly.
  - `[low]` `[reject]` (blind) e2e request scan only matches the hex text; print check exact RGB; `apply_all` mid-test — the store has no network code at all; the apply is needed for print lines and the version check is re-based after it.
  - `[low]` `[reject]` (blind) `suppressHydrationWarning` on `<html>` hides other attribute mismatches — one level only, documented, the Next 16 guide's own pattern.
  - `[false]` `[reject]` (blind) spec missing from the diff; `COLOURS_NOT_KEPT` unused — the spec is excluded from review by design; the string is for Story 11.3.
  - `[low]` `[patch]` (edge) another tab changes `swp:colours` and this tab overwrites it — same root as the blind two-tab row; fixed by the same merge.
  - `[low]` `[reject]` (edge) a throwing listener stops later listeners — listeners are React store callbacks; guard adds complexity for an unshown case.
  - `[low]` `[reject]` (edge) read works but write throws, so availability is true until the first change — blocked site data throws on read too; probing with a write on load adds a storage write for a rare case.
  - `[false]` `[reject]` (edge) hydration mismatch from `getKeyColours` during render — no renderer exists yet (same as the blind row).
  - `[medium]` `[patch]` (edge) Providers re-apply masks a broken boot script in e2e — same root as the boot-script rows; fixed by the `slowAtBody` probe.

## Design Notes

Storage format: one JSON object keyed by the eight variable suffixes, written whole by the store (derived values come from `deriveBestOnLight`/`deriveSelectedTint`, so the inline script needs no colour maths). The boot script, roughly:

```js
try{var v=(PARSER_SOURCE)(localStorage.getItem("swp:colours"));
for(var k in v)document.documentElement.style.setProperty("--colour-"+k,v[k])}catch(e){}
```

`parseStoredColours` must be written in plain syntax with every constant inside its body so `toString()` survives compilation; the Vitest runs the generated string to prove it. The store's first `getKeyColours()` reads storage with the same parser, so script and store agree.

## Verification

**Commands:**
- `npm run test:web` -- all Vitest suites pass.
- `npm run lint` and `npm run typecheck` -- no errors.
- `npm run e2e -- --project=chromium` -- all specs pass, including `key-colours.spec.ts`.

## Auto Run Result

**Summary:** The eight Key colours are now `:root` variables (`--colour-fast` … `--colour-selected-tint`) with the DESIGN.md defaults; the theme tokens `--color-class-*`, `--color-best`, `--color-best-on-light`, `--color-accent`, `--color-selected-tint` alias them, so every wall, mini-wall, crop, swatch, best mark and selection follows one change. A browser-only store in `lib/colours/storage.ts` sets, resets and stores them in localStorage `swp:colours` (try/catch, memory fallback), and an inline `<head>` script built from the same parser applies stored colours before first paint. No backend, component or plan change.

**Files changed:**
- `frontend/app/globals.css` -- `:root` `--colour-*` defaults; eight theme tokens alias them; fixed tokens stay hex.
- `frontend/app/layout.tsx` -- inline boot script in `<head>`, `suppressHydrationWarning` on `<html>`.
- `frontend/app/providers.tsx` -- re-applies stored colours once after hydration (dev remount of `<html>`).
- `frontend/lib/colours/storage.ts` -- parser, boot script, store (`get/set/resetKeyColour`, subscribe, availability, apply).
- `frontend/lib/colours/index.ts` -- exports the storage API.
- `frontend/lib/copy/index.ts` -- `COLOURS_NOT_KEPT` for Story 11.3's popover.
- `frontend/tests/design-tokens.test.ts` -- resolves aliases; FR-42 alias/fixed-token test.
- `frontend/tests/fr42_key_colours_storage.test.ts` -- I/O matrix, boot script vs parser, store, two-tab merge.
- `frontend/e2e/key-colours.spec.ts` -- UJ-4: stored Slow-moving shade 6 before first paint, walls, Key, mini-walls, crops, reload, print, invalid value, nothing sent to the server.

**Review findings:** 25 (medium 3, low 16, false 6). Patched: 1 medium group (boot script proven before app JS in e2e) and 5 low (two-tab merge, defaults from one constant, Providers comment, two unit tests). Deferred: none. Rejected: 6 false and 11 low, reasons in the triage log.

**Follow-up review recommended:** false — one medium entry patched (test-only), no high.

**Verification:** `npm run test:web` 37 files / 673 tests passed; `npm run lint` clean; `npm run typecheck` clean; `npm run e2e -- --project=chromium` 124 passed (an earlier pre-patch run had one unnamed failure among 124, not reproduced in two later full runs). Firefox and msedge were not run.

**Residual risks:** no live cross-tab repaint (another tab's colour shows after reload); the Providers re-apply is untested in dev mode; `isColourStorageAvailable()` stays true until the first write when reads work but writes fail; open retro item epic-10 #89 (split WallGrid) is untouched since no wall component changed.
