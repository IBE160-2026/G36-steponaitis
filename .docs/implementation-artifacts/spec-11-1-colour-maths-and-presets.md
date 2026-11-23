---
title: 'Story 11.1: Colour maths and presets'
type: 'feature'
created: '2026-11-23'
baseline_revision: '0b956a1fcf5e04aefc1e3c4ba270da3af8a9f052'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-11-context.md'
  - '{project-root}/AGENTS.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic 11 lets the planner recolour the six Key colours, but the app has no code that knows whether a colour stays readable where it is drawn, whether two colours are too alike, how the derived tokens follow a chosen colour, or which preset shades to offer.

**Approach:** Add a pure, framework-free shared library `frontend/lib/colours` with WCAG 2 contrast, CIELAB ΔE (CIE76) likeness, the per-entry contrast checks from DESIGN.md, the derived tokens (`best-on-light`, `selected-tint`), the six defaults and the DESIGN.md `colour-presets`, all covered by `frontend/tests/fr42_colours.test.ts`.

## Boundaries & Constraints

**Always:**
- Pure TypeScript functions and constants only: no React, no DOM, no `localStorage`, no network. Hex in and out as uppercase `#RRGGBB`.
- The six entries are keyed `fast`, `medium`, `slow`, `dead`, `best`, `selection`. Defaults: `#D85144`, `#F0B323`, `#417DDC`, `#8C939A`, `#3DAE6B`, `#9466F0`.
- Check pairs (FR-42): movement class vs wall `#30353A` and open slot `#141719` (3:1 each); best vs wall, open slot (3:1) and ink `#1B1E22` text on it (4.5:1); selection vs casing `#141719` and white `#FFFFFF` (3:1). Each pair result carries its background name, ratio, threshold and pass flag so Story 11.3 can word warnings.
- Too alike: ΔE (CIE76, D65, sRGB) strictly below 20.
- Presets are the eight DESIGN.md shades per entry, in DESIGN.md order (lightest first), and contain the entry default.
- Every test name references FR-42 (SM-7).

**Never:**
- No CSS variables, storage, Key buttons or popover (Stories 11.2 and 11.3). No change to `app/globals.css`, any wall component, the backend, or planning artifacts / DESIGN.md.
- No new npm dependency (colour maths is written by hand).
- No import from `frontend/modules/*` inside `lib/colours`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Contrast | `contrastRatio('#D85144', '#30353A')` | ≈ 3.05; symmetric in its arguments | No error expected |
| Lowercase / no `#` | `'d85144'`, `'#d85144'` | Parsed like `#D85144` | — |
| Invalid hex | `'#12345'`, `'red'`, `'#GGGGGG'` | `parseHex` returns `null`; `isHexColour` false | Maths functions given invalid hex throw `RangeError` |
| Failing colour | `checkContrast('slow', '#20304A')` | Pair results with `pass: false`; `passes` false | Warning only, never throws |
| Too alike | two colours with ΔE < 20 | `tooAlike` true; `similarPairs(colours)` lists that pair with its ΔE | — |
| Default best | `deriveBestOnLight('#3DAE6B')` | `#267A4B` (fixed DESIGN.md default) | — |
| Chosen best | any other best hex | same hue, darkened until white on it ≥ 4.5:1 (hence ≥ 3:1 on white) | already-dark input returned unchanged if it passes |
| Default selection | `deriveSelectedTint('#9466F0')` | `#F3EFFD` (fixed DESIGN.md default) | — |
| Chosen selection | any other hex | 10% of the colour over white | — |

</intent-contract>

## Code Map

- `frontend/lib/` -- shared kernel folders (`format/index.ts`, `sort/index.ts`) are the pattern: one folder, `index.ts` exports. Add `lib/colours/`.
- `frontend/vitest.config.ts` -- includes `tests/**/*.test.{ts,tsx}`, node environment, `@` alias to `frontend/`.
- `frontend/tests/design-tokens.test.ts:8-31` -- reads the DESIGN.md front matter by path (`frontMatterBlock`); reuse the same approach (copy the small front-matter reader into the new test; `frontend/tests/support/` does not exist) to cross-check the presets constant against DESIGN.md `components.colour-presets` (indented under `components:`, 4-space keys `fast:` … `selection:`, space-separated hex).
- `frontend/app/globals.css:24,58-…` -- current fixed tokens (`--color-class-*`, `--color-best*`, `--color-accent`, `--color-selected-tint`): read-only here; 11.2 wires variables.
- `.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/DESIGN.md` (front matter `colors`, `components.colour-presets`; prose "Key colours" table) -- source of all values; read-only.
- Pre-checked numbers (Python, same formulas): every preset passes its entry's check; default ΔE minimum is slow/selection ≈ 37.2; pure HSL darkening of `#3DAE6B` reaches 4.5:1 at about `#2F8653`; 10% mix of `#9466F0` is `#F4F0FE`.
- Open retro items: none concern `lib/colours` (new code). epic-10 item 89 (split WallGrid etc. before Epics 11-12) touches wall components this story does not change; left for 11.2/11.3.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/colours/maths.ts` -- `parseHex`, `isHexColour`, `toHex`, `relativeLuminance`, `contrastRatio`, `toLab`, `deltaE`, `mixOverWhite`, HSL helpers -- the colour maths, pure.
- `frontend/lib/colours/presets.ts` -- `KEY_COLOUR_ENTRIES` (order fast, medium, slow, dead, best, selection), `DEFAULT_COLOURS`, `COLOUR_PRESETS` (8 shades each, DESIGN.md order), fixed backgrounds (`WALL`, `OPEN_SLOT`, `INK`, `WHITE`), `DEFAULT_BEST_ON_LIGHT = '#267A4B'`, `DEFAULT_SELECTED_TINT = '#F3EFFD'`.
- `frontend/lib/colours/checks.ts` -- `checkContrast(entry, hex)` returning `{ entry, pairs: {against, ratio, threshold, pass}[], passes }`; `tooAlike(a, b)`, `similarPairs(colours)` with `LIKENESS_THRESHOLD = 20`; `deriveBestOnLight(best)`, `deriveSelectedTint(selection)`.
- `frontend/lib/colours/index.ts` -- re-export the public API.
- `frontend/tests/fr42_colours.test.ts` -- the epic ACs plus the I/O matrix rows (named `fr42 …`).

**Acceptance Criteria:**
- Given the six defaults, when `checkContrast` runs, then every pair passes with ratios within ±0.02 of fast 3.05/4.44, medium 6.59/9.58, slow 3.06/4.45, dead 3.98/5.79, best 4.40/6.40/5.95, selection 4.65/3.88.
- Given the presets, when loaded, then each entry has eight distinct valid shades whose relative luminance never increases, which include the default, equal DESIGN.md `colour-presets` exactly (parsed from the file), and each passes its own entry's `checkContrast`.
- Given any two of the six defaults, when ΔE is computed, then it is ≥ 37 and `similarPairs(DEFAULT_COLOURS)` is empty; given two colours ΔE < 20 apart, then they are flagged.
- Given the default best, when derived, then `best-on-light` is `#267A4B`; given the uncapped derivation of `#3DAE6B` and of every best preset, then the result keeps the input hue (±2°), white on it is ≥ 4.5:1 and it is ≥ 3:1 on white, as `#267A4B` is.
- Given the default selection, then `selected-tint` is `#F3EFFD`; given another selection colour, then each channel is within 1 of 10% over white.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 28 findings — high 0, medium 1, low 19, false 8, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) `toHsl`/`fromHsl` run only on green inputs; red/blue/magenta branches untested — added an HSL round-trip `it.each` over one hex per sector plus a grey, and `darkenForWhiteText` hue/contrast cases on the fast, slow and selection defaults.
  - `[low]` `[patch]` (verification-gap other) "likeness threshold is strict" test does not test strictness — renamed to "identical colours are too alike and black and white are not" (exact ΔE 20 is not reachable from hex inputs).
  - `[low]` `[patch]` (blind) DESIGN.md preset rule "at least ΔE 22 from the other five defaults" untested — added an `it.each` (pre-checked minimum ΔE 23.1).
  - `[low]` `[patch]` (blind) strictness test misnamed — same root cause as the verification-gap row; fixed by the rename.
  - `[low]` `[patch]` (blind) `similarPairs` repeats the `< LIKENESS_THRESHOLD` comparison — both now use a private `isTooAlike(distance)`.
  - `[low]` `[reject]` (blind) best-on-light jumps between the default (`#267A4B`) and a one-step-off pick (about `#2F8653`) — real but follows the recorded Design Notes reading (fixed token for the default); both meet every constraint, and a near-default hex pick is rare; changing it is a design decision, not a direct correction.
  - `[low]` `[patch]` (blind) invalid-hex tests skip the higher-level API — added `checkContrast`, `deriveBestOnLight`, `deriveSelectedTint`, `darkenForWhiteText` to the `RangeError` cases.
  - `[false]` `[reject]` (blind) 3-digit shorthand / whitespace hex not handled — the spec and Story 11.3 define the input as `#RRGGBB` ("Enter a colour as #RRGGBB"), so rejecting shorthand is intended; trimming is harmless.
  - `[low]` `[patch]` (blind) HSL helpers lack direct tests — same root cause as the verification-gap row; covered by the round-trip test.
  - `[low]` `[reject]` (blind) `mixOverWhite` does not validate `amount` — the only caller passes the constant 0.1; a guard adds a branch for an unreachable input.
  - `[low]` `[reject]` (blind) `background` field name misleading for `ink-text`; no `CASING` constant — the field is documented as "the other colour of the pair" and `against` carries the meaning; renaming is cosmetic.
  - `[low]` `[patch]` (blind) `COLOUR_PRESETS` inner arrays not frozen — each array now `Object.freeze`d.
  - `[low]` `[reject]` (blind) DESIGN.md front-matter reader copied from `design-tokens.test.ts` — test-only helper, copied by spec decision; extracting a shared test helper is a refactor beyond a direct correction, and DESIGN.md has LF endings.
  - `[false]` `[reject]` (blind) default's position among presets untested — the exact-equality test against DESIGN.md pins the whole order, including the default.
  - `[low]` `[reject]` (edge) `toHex` with NaN channels yields an invalid string — no caller can pass NaN (channels come from parsed hex or finite HSL); guard would be for an unreachable state.
  - `[low]` `[reject]` (edge) `mixOverWhite` amount out of range / NaN — same as the blind row; only caller passes 0.1.
  - `[low]` `[reject]` (edge) `fromHsl` with NaN or out-of-range input — internal callers pass `toHsl` output and clamped lightness; unreachable.
  - `[low]` `[reject]` (edge) `similarPairs` throws on one invalid stored colour — no caller yet; Story 11.2 must ignore invalid stored values before they reach this (its AC), so the guard belongs there.
  - `[false]` `[reject]` (edge) `tooAlike` throws on non-hex — the I/O matrix makes `RangeError` on invalid hex the intended contract for maths functions.
  - `[low]` `[reject]` (edge) test reader breaks on CRLF DESIGN.md — the repo file is LF; unlikely and test-only.
  - `[low]` `[patch]` (edge) strictness test never probes ΔE 20 — same root cause as the verification-gap row; fixed by the rename.
  - `[low]` `[reject]` (edge) near-grey bests drift in hue (e.g. `#817D7C` → `#797575`, 12°) after 8-bit rounding — hue is ill-defined at low saturation and the perceptual change is tiny; fixing needs a different colour space.
  - `[low]` `[reject]` (edge) spec under-describes `checkContrast` result shape (extra `colour`, `background`) — superset with no functional harm; fix would edit this spec.
  - `[false]` `[reject]` (intent) derived-token tests check a short-circuit, not the rule — descriptive; the reading is the recorded Design Notes choice (DESIGN.md fixes `#267A4B`/`#F3EFFD` as defaults restored by Reset) and the rule is tested separately.
  - `[false]` `[reject]` (intent) "warned before I pick" not shown at the UI surface — the epic splits the popover warnings into Story 11.3; this story's ACs are the library and Vitest surface.
  - `[false]` `[reject]` (intent) presets are a code literal rather than loaded from DESIGN.md — the AC's surface is the presets as loaded by the app; a test asserts exact equality with DESIGN.md.
  - `[false]` `[reject]` (intent) DESIGN.md ΔE 22 preset property not asserted — same as the blind row, now asserted.
  - `[false]` `[reject]` (intent) retro items — none concern the new `lib/colours`; descriptive, no divergence.

## Design Notes

"`#267A4B`-compatible" is read as: the default best maps to the fixed token `#267A4B` (DESIGN.md: Reset restores the fixed `best-on-light` default), and the darkening rule, applied to `#3DAE6B`, yields a colour that satisfies the same constraints `#267A4B` does (same hue, white text ≥ 4.5:1, ≥ 3:1 on white). The same default short-circuit applies to `selected-tint`, so a fresh browser renders exactly the DESIGN.md tokens. Export the uncapped derivation (e.g. `darkenForWhiteText`) so the test can exercise it on the default too.

Darkening: keep HSL hue and saturation, lower lightness in small steps (≤ 0.005) until `contrastRatio(white, c) >= 4.5`; return the first passing colour (input itself if it already passes).

## Verification

**Commands:**
- `npm run test:web` -- expected: all Vitest suites pass, including `fr42_colours.test.ts`.
- `npm run lint` -- expected: no errors.
- `npm run typecheck` -- expected: no errors.
- `npm run e2e -- --project=chromium` -- expected: existing specs stay green (no user-visible change, so no new Playwright test).

## Auto Run Result

**Summary:** Added the pure FR-42 colour library `frontend/lib/colours` (WCAG 2 contrast, CIELAB ΔE CIE76, per-entry contrast checks against the DESIGN.md pairs, likeness flag below ΔE 20, derived `best-on-light` and `selected-tint`, six defaults and the DESIGN.md presets) with `frontend/tests/fr42_colours.test.ts` (68 tests). No UI, CSS, backend or planning-artifact change.

**Files changed:**
- `frontend/lib/colours/maths.ts` -- hex parsing/normalising, luminance, contrast, CIELAB, ΔE, mix over white, HSL helpers.
- `frontend/lib/colours/presets.ts` -- entries, defaults, frozen presets, fixed backgrounds and derived-token defaults.
- `frontend/lib/colours/checks.ts` -- `checkContrast`, `tooAlike`, `similarPairs`, `darkenForWhiteText`, `deriveBestOnLight`, `deriveSelectedTint`.
- `frontend/lib/colours/index.ts` -- public exports.
- `frontend/tests/fr42_colours.test.ts` -- epic ACs, I/O matrix rows, DESIGN.md preset cross-check.
- `.docs/implementation-artifacts/epic-11-context.md` -- compiled epic 11 context.

**Review findings:** 28 findings (medium 1, low 19, false 8). Patched 1 medium + low entries: HSL round-trip and non-green darkening tests, renamed likeness test, ΔE 22 preset test, wider invalid-hex tests, shared `isTooAlike` predicate, frozen preset arrays. Deferred: none. Rejected: 8 false and 11 low (unreachable NaN/amount inputs, cosmetic naming, test-helper duplication, near-grey hue drift, default-vs-near-default best jump per Design Notes, spec-shape note) — reasons in the triage log.

**Follow-up review recommended:** false — one medium entry patched (test-only), no high.

**Verification:** `npm run test:web` 36 files / 645 tests passed; `npm run lint` clean; `npm run typecheck` clean; `npm run e2e -- --project=chromium` 123 passed. No user-visible change, so no new Playwright test.

**Residual risks:** `best-on-light` jumps from the fixed `#267A4B` (default) to about `#2F8653` for a best one step off the default; Story 11.2 must drop invalid stored colours before calling `similarPairs`/`checkContrast`, which throw `RangeError` on non-hex.
