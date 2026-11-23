---
title: 'Story 11.3: Change a colour from the Key'
type: 'feature'
created: '2026-11-23'
baseline_revision: '70b251d53194b910380bd89743ae910fd1954b0a'
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

**Problem:** The Key under every wall is plain text, so a planner who cannot read a colour (UJ-4, an old office monitor) has no way to change it, although Story 11.2 already applies and keeps colours through `lib/colours/storage.ts`.

**Approach:** Make the six colour entries of the shared `Key` buttons that open a non-modal colour popover (presets radiogroup, Default chip, hex field with native picker, warnings, Reset this colour, Done). The popover previews the pending pick live on the real wall through the `--colour-*` variables and commits it with `setKeyColour` on Done or a click outside; `Esc` restores the colour from when it opened.

## Boundaries & Constraints

**Always:**
- Entries fast, medium, slow, dead, best, selected (→ colour entry `selection`) are `<button>`s with accessible name "<KEY_LABELS name>, change colour", `aria-haspopup="dialog"`, `aria-expanded`; Empty and 2 parts stay plain text; order and `data-key-entry` unchanged; the visible text stays the glossary name only (the Locations e2e reads list-item text). Hover: `bg-selected-tint`, rounded, and a 14px `palette` Icon in `text-ink-secondary` after the label (aria-hidden). Focus: the global fixed `:focus-visible` ring (no override).
- Popover: radix `Popover` (non-modal, `side="top"`, flips/shifts with `collisionPadding`), `role="dialog"`, `aria-labelledby` its title, width `min(264px, calc(100vw - 32px))`, surface/border/`rounded-lg`/`shadow-overlay`. Title = label + the entry's miniature/glyph as a decorative SVG + "colour" (accessible name "Fast-moving colour"; no Unicode glyphs anywhere in markup).
- Presets: `COLOUR_PRESETS[entry]` as a radix `RadioGroup` of 8 round 22px swatches with 24px hit area in two rows of 4; each radio named "<label> shade N of 8", the one equal to `DEFAULT_COLOURS[entry]` named "Default"; the radio equal to the pending pick is checked and ringed (2px ink ring + check icon). Arrow keys move and preview live. Default chip beside them: "Default" + 16px swatch + hex.
- Hex field (104px, shared `Input`) holds the pending text; `#RRGGBB` (any case) previews at once (normalised uppercase); anything else sets `aria-invalid` with InputError "Enter a colour as #RRGGBB" and leaves the last valid preview. A 22px swatch `<input type="color">` (name "<label>, pick a colour") previews on input.
- Warnings, only for failing checks of the pending pick, inside an always-present `role="status"` container whose id is in the hex field's `aria-describedby`: one per failing contrast pair and one per too-alike pair that includes this entry (other five = current colours). Defaults give none.
- Done or outside click: `setKeyColour(entry, pick)` (stores, notifies), and if the pick differs from the open-time colour a polite live region in the Key announces "<label> colour changed". `Esc` (also from inside the hex field: the field must not clear itself first) restores the open-time colour without storing. Both return focus to the entry button (`onCloseAutoFocus` → trigger). Reset this colour sets the pick to `DEFAULT_COLOURS[entry]` (popover stays open; Done keeps it, Esc undoes it); best's paper shade follows `#267A4B` through `deriveBestOnLight`. Nothing resets every colour.
- When `isColourStorageAvailable()` is false the popover shows `COLOURS_NOT_KEPT`.
- Current colours are read with `useSyncExternalStore(subscribeKeyColours, getKeyColours, () => DEFAULT_COLOURS)`.
- All new strings in `lib/copy`; English, sentence case, no colour words or hex in accessible names, no emoji or "!". Test names carry FR-42; e2e names `uj4 …` and imports `test`/`expect` from `e2e/support/test.ts`.

**Never:**
- No backend, command, plan-version or server request change; nothing about colours sent to the server. No colours page or Settings entry. No new npm dependency (radix-ui, lucide-react exist).
- No import of `@/modules/*` from `components/` or `lib/`. The popover lives with the shared `Key` in `components/common/wall/` (the epic's `modules/key-colours` would be imported by four modules, which the module-boundary lint forbids; shared code goes to common).
- No change to WallGrid, AisleMode, focus ring, print stylesheet, glyphs, BEST text or frame shapes. Open retro items: epic-10 #89 (split WallGrid/AisleMode) is not touched since neither file changes; epic-10 #88 R10 (Key shows only the entries a surface draws) is not done here because this story's AC requires the six colour entries under every wall — keep `Key` able to take that later (no new props required now).
- No edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Defaults | fresh browser, open Slow-moving | default radio checked and focused, no warning, no storage note | — |
| Arrow preview | ArrowRight on presets | next shade checked; `--colour-slow` on `<html>` = that shade; nothing stored yet | — |
| Done | pick shade 6, Done | `swp:colours` slow `#378CBE`; announced "Slow-moving colour changed"; focus on entry | — |
| Esc | open at A, preview B, Esc | `--colour-slow` back to A, storage unchanged, focus on entry | — |
| Invalid hex | `#12345` | `aria-invalid="true"`, "Enter a colour as #RRGGBB", preview stays last valid | no throw |
| Custom hex | `#222222` (fails wall contrast) | previews; warning "Slow-moving on the wall: 1.2:1 (3:1 or more recommended)" and "Slow-moving on an open slot: 1.1:1 (3:1 or more recommended)"; Done still keeps it | — |
| Alike | slow pick `#9466F0` | "Slow-moving and Selection look alike (ΔE 0). Bins and the selection frame may be hard to tell apart." | — |
| Reset best | best = custom, Reset, Done | best `#3DAE6B`, best-on-light `#267A4B` stored | — |
| Storage blocked | setItem throws | change applies; popover shows `COLOURS_NOT_KEPT` | caught by store |
| Pick not a preset | current `#222222`, open | no radio checked; focus starts on the hex field | — |

</intent-contract>

## Code Map

- `frontend/components/common/wall/key.tsx` -- `Key` (lines 74-89) renders `KEY_ORDER` as `<li data-key-entry>` with `KeySwatch`; turn the six colour entries into popover triggers, add the polite live region. `KeySwatch`/`Frame`/`SELECTED_FRAME` reused for the title cue and swatches. Used by `modules/locations/locations-page.tsx:284`, `modules/locations/warehouse-view.tsx:244`, `modules/recommendations/crops.tsx:217`, `modules/best-locations/marking-wall.tsx:304` (no change needed there).
- `frontend/components/common/wall/index.ts` -- export any new public pieces.
- `frontend/components/common/other-location.tsx:136-200` -- radix `Popover` pattern to follow (`Popover.Anchor`/`Content`, `collisionPadding`, `onOpenAutoFocus`/`onCloseAutoFocus` with `preventDefault` + manual focus, `shadow-overlay`).
- `frontend/components/common/{icons.tsx (palette, check, warning), input.tsx (Input/InputError; its own Esc clears the field unless `onKeyDown` calls `preventDefault`), button.tsx (tertiary/primary, size md/sm)}`.
- `frontend/lib/colours/storage.ts` -- `getKeyColours`, `setKeyColour`, `subscribeKeyColours`, `isColourStorageAvailable`, private `apply`/`load`; add the preview function here. `index.ts` re-exports.
- `frontend/lib/colours/{presets,checks,maths}.ts` -- `COLOUR_PRESETS`, `DEFAULT_COLOURS`, `KEY_COLOUR_ENTRIES`, `checkContrast` (pairs with `against`, `ratio`, `threshold`, `pass`), `similarPairs`, `deriveBestOnLight`, `isHexColour`/`normaliseHex` (accepts no-`#` too: the field must require the `#`).
- `frontend/lib/copy/index.ts:434-452` -- `KEY_TITLE`, `COLOURS_NOT_KEPT`, `KEY_LABELS`, `KEY_ORDER`, `KeyEntry`; add the popover copy here.
- `frontend/app/globals.css:316-332` -- global fixed `:focus-visible` ring; `--color-selected-tint`, `--shadow-overlay`, `--color-error-tint`.
- `frontend/tests/wall.test.tsx:196-215` -- `fr42_wall_key_lists_entries_in_order_without_colour_words` asserts no `<button>`; update to the six buttons. Tests run in Vitest `node` env with `renderToStaticMarkup` (no DOM): interaction goes to Playwright.
- `frontend/e2e/key-colours.spec.ts` -- Story 11.2 UJ-4 test (stored value, crops, mini-walls, print check, request scan); helpers `expectSlowBin`, `rootSlow`; `e2e/locations-wall.spec.ts:92` reads Key list-item text.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/colours/storage.ts` (+ `index.ts`) -- add `previewKeyColour(entry, hex: string | null)`: a hex applies the entry and its derived partner to `<html>` without storing or notifying (`RangeError` on non-hex); `null` re-applies the committed values for that entry and partner.
- `frontend/lib/colours/warnings.ts` (+ `index.ts`) -- pure `colourWarnings(entry, pick, current)` returning failing contrast pairs and too-alike pairs that include `entry` (pick substituted for `current[entry]`).
- `frontend/lib/copy/index.ts` -- `keyEntryButtonName`, `colourPopoverTitle` parts, `presetName(label, n)` / "Default", "Default" chip label, hex field and picker names, `HEX_INVALID = "Enter a colour as #RRGGBB"`, `RESET_THIS_COLOUR`, `DONE`, `colourChanged(label)`, and warning sentences. Contrast: `"<Name> <where>: R:1 (T:1 or more recommended)"`, R floored to 1 decimal; where = "on the wall", "on an open slot", "under BEST text", "on its casing", "on white". Alike: `"<A> and <B> look alike (ΔE n). <X> may be hard to tell apart."`, n floored, names in Key order, warning names use "Selection" for the selection entry; X = "Bins" (class–class: "Bins of the two classes"), "Bins and the best-location frame", "Bins and the selection frame", "The best-location frame and the selection frame".
- `frontend/components/common/wall/colour-popover.tsx` -- the popover per Boundaries; pending pick state, open-time colour, Esc vs keep handling, focus start (checked radio, else hex field).
- `frontend/components/common/wall/key.tsx` -- buttons as triggers, hover/palette styling, live region; update header comment.
- `frontend/tests/fr42_key_colour_popover.test.ts(x)` -- Vitest: `colourWarnings` (defaults none; `#222222` slow; alike pair; best ink-text pair), copy builders, `previewKeyColour` with fake root style (applies, not stored, `null` restores, best partner), static render of `Key` (six buttons with names/aria attrs, Empty/2 parts plain) and of the popover body if it renders without a DOM.
- `frontend/tests/wall.test.tsx` -- update the Key test for the six buttons.
- `frontend/e2e/key-colours.spec.ts` -- new test `uj4 fr42 change Slow-moving to shade 6 from the Key …`: open from the Locations Key, dialog name, 8 radios, Default checked and focused; ArrowRight previews (root variable and a slow bin fill change, storage untouched); Esc restores and refocuses the entry; reopen, pick shade 6 (checked), invalid hex shows `aria-invalid` + message, `#222222` shows a warning in the status region, then shade 6 again and Done → announced, focus on entry, stored; reload → wall, Key swatch, whole-warehouse mini-wall and crop slow fills are shade 6, ▼ path unchanged, print view in print media has no shade-6 colour; Reset this colour + Done brings default back; blocked storage (init script making `setItem` throw) shows `COLOURS_NOT_KEPT` and still recolours; popover box inside the viewport at a 640×450 viewport (200% zoom of 1280×900); no request carries the colour.

**Acceptance Criteria:**
- Given any wall's Key, when it renders, then the six colour entries are buttons with the specified names and ARIA, Empty and 2 parts are plain text, and the Locations Key list-item text is unchanged.
- Given a click, `Enter` or `Space` on an entry, when the popover opens above it, then it matches UX-DR49 (title, 8 named radios with the current checked, Default chip, hex field and picker, Reset this colour, Done) and focus is on the current preset.
- Given the full journey in UJ-4, when Slow-moving is changed to shade 6 and the page reloaded, then wall, mini-walls and crops use the shade, ▼ is unchanged, and the print preview has no colour.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 34 findings — high 0, medium 4, low 25, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) click outside as a keep gesture is never exercised — e2e step added: pick, click the page heading, stored, announced, entry focused.
  - `[low]` `[patch]` (verification-gap) "announce only when changed" has no negative check — e2e step added: Done unchanged, announcer empty, nothing stored.
  - `[low]` `[patch]` (verification-gap) `previewKeyColour("selection", null)` restoring the tint is never asserted — unit assertion added.
  - `[low]` `[reject]` (verification-gap, other) blocked-write storage note missing on the first open — the code meets the spec (`isColourStorageAvailable()` false → note); a write probe adds a storage write on load, already rejected in Story 11.2 for the same rare read-works-write-fails case.
  - `[low]` `[reject]` (blind) same blocked-write first-open note — same as the row above.
  - `[low]` `[patch]` (blind) every keep writes storage and notifies even when unchanged — unchanged keep now restores the preview and skips `setKeyColour`.
  - `[medium]` `[patch]` (blind) preview leaks on `<html>` if the button unmounts while open — unmount cleanup restores the kept colour.
  - `[low]` `[patch]` (blind) `setKeyColour` JSDoc sits above `requireEntry` — moved back.
  - `[low]` `[patch]` (blind) Home/End move focus in the presets without previewing — Home/End added to the keyboard-moved keys.
  - `[low]` `[reject]` (blind) Done with an invalid hex keeps the last valid pick — the wall previews exactly that pick and the field shows the error; blocking or rewriting adds branches for a cosmetic mismatch.
  - `[low]` `[reject]` (blind) "Selected" vs "Selection" naming — the AC's own warning example uses "Selection"; changing it edits the spec.
  - `[low]` `[patch]` (blind) Esc from inside the hex field untested — e2e step added (restored, dialog hidden, entry focused).
  - `[low]` `[patch]` (blind) native picker and Space-to-open untested — e2e steps added.
  - `[low]` `[patch]` (blind) invalid hex field's `aria-describedby` not checked for the error id — unit assertion added.
  - `[low]` `[patch]` (blind) wall-crop slice unguarded when the Key is missing — index asserted before slicing.
  - `[low]` `[reject]` (blind) "colour changed" announced though the write failed — the not-kept note shows on the next open; a separate announcement adds a branch for the rare blocked case.
  - `[low]` `[reject]` (blind) the new e2e test is long — same single-journey pattern as Story 11.2's UJ-4 test; splitting multiplies plan setup for no defect.
  - `[medium]` `[patch]` (edge) unmount while open leaves the preview — same root as the blind unmount row; same fix.
  - `[low]` `[reject]` (edge) outside click or Tab yanks focus back to the entry — the AC requires "Either way focus returns to the Key entry".
  - `[low]` `[reject]` (edge) keep with invalid hex stores the last valid pick — same as the blind invalid-hex row.
  - `[low]` `[patch]` (edge) unchanged keep writes storage — same root as the blind row; same fix.
  - `[low]` `[reject]` (edge) blocked-write note on first open — same as the verification-gap other row.
  - `[false]` `[reject]` (edge) Esc restores from memory, not `latest()` — Esc restores the colour this tab had when the popover opened, which is the in-memory value; reading another tab's value would break that rule.
  - `[false]` `[reject]` (edge) alike sentence order not enforced — `similarPairs` iterates `KEY_COLOUR_ENTRIES` (classes, best, selection), so `a` is always the earlier entry.
  - `[low]` `[patch]` (edge) recommendations e2e tab-stop check narrowed to `[data-crop]` — now all of `[data-crops]` minus the Key.
  - `[medium]` `[patch]` (intent) click outside untested — same root as the verification-gap row.
  - `[low]` `[patch]` (intent) Space untested — same as the blind picker/Space row.
  - `[low]` `[reject]` (intent) hover tint and focus ring not exercised — classes are static (`hover:bg-selected-tint`, palette `group-hover:visible`) and the ring is the unchanged global `:focus-visible` rule; a visual test adds no defect coverage.
  - `[false]` `[reject]` (intent) Default chip is not interactive — DESIGN.md describes it as a label, swatch and hex; choosing the default is the "Default" radio or Reset.
  - `[false]` `[reject]` (intent) accessible title lacks the ▲ character — UX-DR3 forbids Unicode glyphs; the glyph is the decorative SVG, as the spec decides.
  - `[low]` `[reject]` (intent) 200% zoom tested by a 640×450 viewport — the same CSS-pixel space as 200% zoom of 1280×900.
  - `[low]` `[reject]` (intent) "defaults show no warning" checked in the browser for Slow-moving only — unit test covers all six entries with the same pure function.
  - `[low]` `[reject]` (intent) only one arrow press tested — the Radix arrow workaround is exercised; Home/End now share it.
  - `[false]` `[reject]` (intent) open retro items not addressed — the spec took them into account: #89 touches WallGrid/AisleMode, which this story does not change; #88 R10 conflicts with the AC's six entries under every wall.

## Design Notes

Preview vs commit: the popover is one editing session. Arrow keys, hex input, picker and Reset only preview (`previewKeyColour`), so `Esc` can always restore the open-time colour without touching storage, and only Done / outside click stores (one write, one notify). Detect `Esc` with `onEscapeKeyDown` setting a ref before radix calls `onOpenChange(false)`; every other close keeps.

```tsx
<Popover.Root open={open} onOpenChange={(next) => (next ? start() : finish(escaped.current ? "restore" : "keep"))}>
  <Popover.Trigger asChild><button aria-label={keyEntryButtonName(label)} …/></Popover.Trigger>
  <Popover.Portal><Popover.Content side="top" collisionPadding={16} aria-labelledby={titleId}
    onEscapeKeyDown={() => (escaped.current = true)} onCloseAutoFocus={(e) => { e.preventDefault(); trigger.current?.focus(); }} …/>
```

## Verification

**Commands:**
- `npm run test:web` -- all Vitest suites pass.
- `npm run lint` and `npm run typecheck` -- no errors.
- `npm run e2e -- --project=chromium` -- all specs pass, including both tests in `key-colours.spec.ts`.

## Auto Run Result

**Summary:** The six colour entries of the shared Key (Fast-moving, Medium-moving, Slow-moving, Dead stock, Best location, Selected) are now buttons ("Slow-moving, change colour", `aria-haspopup="dialog"`, `aria-expanded`, selected-tint hover with a palette icon) that open a non-modal radix colour popover above the entry. It has a title with the entry's miniature, eight named preset radios, a Default chip, a `#RRGGBB` colour-code field with a native picker, contrast and likeness warnings in a `role="status"` region linked to the field, the blocked-storage note, **Reset this colour** and **Done**. Arrow keys, Home/End, the field, the picker and Reset only preview through the new `previewKeyColour`. Done or a click outside stores a changed pick with `setKeyColour` and announces "<label> colour changed". An unchanged pick stores and announces nothing. `Esc` restores the open-time colour. Focus returns to the entry. Empty and 2 parts stay plain text. Nothing reaches the server.

**Files changed:**
- `frontend/components/common/wall/colour-popover.tsx` -- new: `KeyColourButton`, `ColourPopoverBody`, `KeyColourAnnouncer`.
- `frontend/components/common/wall/key.tsx` -- six entries as popover buttons, `KEY_COLOUR_OF`, live region.
- `frontend/components/common/wall/index.ts` -- exports.
- `frontend/lib/colours/storage.ts` -- `previewKeyColour(entry, hex | null)`; `setKeyColour` shares `changeFor`.
- `frontend/lib/colours/warnings.ts` -- new pure `colourWarnings`.
- `frontend/lib/colours/index.ts` -- exports.
- `frontend/lib/copy/index.ts` -- popover names, labels and warning sentences.
- `frontend/tests/fr42_key_colour_popover.test.tsx` -- new: warnings, copy, preview, Key and body markup.
- `frontend/tests/wall.test.tsx`, `frontend/tests/wall-crop.test.tsx` -- Key now has six buttons; crops still none.
- `frontend/e2e/key-colours.spec.ts` -- new UJ-4 journey test covering:
  - opening with click, Enter and Space;
  - arrow preview; Esc from the presets and from the field;
  - Done with no change, invalid and failing colour codes, keeping a failing colour, focus on the field for a non-preset colour, the picker;
  - shade 6 kept and reloaded across the wall, Key, mini-walls and crops; print with no colour;
  - Reset for slow and best, with best's paper shade;
  - click outside keeps; 200% zoom; blocked storage; no server traffic.
- `frontend/e2e/recommendations-page.spec.ts` -- the crops add no tab stops apart from the six Key buttons.

**Review findings:** 34 (high 0, medium 4, low 25, false 5).
- Patched: two medium entries (unmount preview leak, from blind and edge; click-outside untested, from verification-gap and intent) and the low entries:
  - unchanged keep skips the write;
  - Home/End preview;
  - JSDoc placement;
  - slice guard;
  - crops tab-stop selector;
  - selection restore and `aria-describedby` unit checks;
  - e2e for no-change Done, Space, Esc in the field and the picker.
- Deferred: none.
- Rejected: 5 false and 11 low, with reasons in the triage log:
  - blocked-write note on first open (×3, consistent with Story 11.2's rejection);
  - invalid-hex keep (×2);
  - Selected/Selection naming (the AC's own example);
  - announcement after a failed write;
  - long e2e test;
  - focus return on outside click (the AC requires it);
  - hover and focus visuals;
  - viewport as 200% zoom;
  - browser no-warning check for one entry;
  - one arrow press.

**Follow-up review recommended:** false. Two medium entries were patched, which meets the first-pass threshold. Both fixes are small and each is pinned: the click-outside path by a new e2e step and the unmount cleanup by a three-line effect. No specific unverified risk remains that a second pass would target.

**Verification** (after patches):
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm run lint:py`: all checks passed.
- `npm run lint:imports`: 5 contracts kept.
- `npm test`: pytest 956 passed, 2 skipped; Vitest 38 files and 687 tests passed.
- `npm run e2e -- --project=chromium`: 124 passed and 1 failed. The failure was `delete-plan.spec.ts:63`: under parallel load, focus went to the wrong row of the saved-plans list. That page has no Key. The spec passed 6/6 on a re-run alone, and the pre-patch full run passed 125/125.
- `npm run e2e -- --project=chromium` (re-run): 125 passed.
- `npm run e2e -- --project=firefox --project=msedge key-colours`: 4 passed.

**Residual risks:**
- With storage that can be read but not written, the "can't be kept" note first shows after the first failed write.
- Done while the field holds an invalid value keeps the last valid colour, the one the wall previews.
- Open retro items epic-10 #89 (split WallGrid and AisleMode) and #88 R10 (Key shows only the entries a surface draws) remain open. This story's AC requires the six entries under every wall.
- The recommendation detail now has six more tab stops (the Key buttons).
