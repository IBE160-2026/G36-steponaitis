---
title: 'Story 1.4: App shell and design foundation'
type: 'feature'
created: '2026-11-21'
baseline_revision: '1f18e0690f8bf60b31be9a03278c67ca3a044607'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/DESIGN.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred:
  - summary: >-
      ToastBody's pause-on-hover/focus timer, remaining-time bookkeeping, one-at-a-time replacement and reduced-motion appearance are not exercised by any test.
    evidence: |-
      Only toastDurationMs is unit-tested (tests/components.test.tsx); no page shows a toast yet and Vitest has no DOM. Settle with a Playwright check when Story 1.8 shows the "<name> created" toast (hover and focus pause, reduced motion).
    location: >-
      frontend/components/common/toast.tsx
    severity: medium
  - summary: >-
      Input's Esc behaviour (clear a non-empty field, then blur) is not exercised by any test.
    evidence: |-
      tests/components.test.tsx checks only aria-invalid/aria-describedby; no consumer exists yet. Settle in Story 1.8's Playwright test of the plan name field.
    location: >-
      frontend/components/common/input.tsx
    severity: low
  - summary: >-
      ConfirmDialog's Cancel-first-and-focused, onConfirm and focus-return behaviour is checked only through the CONFIRM_BUTTON_ORDER constant.
    evidence: |-
      radix portals render nothing in renderToStaticMarkup; no page opens the dialog yet. Settle in the Playwright test of the first story that opens a confirm dialog (Reset… or Delete…).
    location: >-
      frontend/components/common/confirm-dialog.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The frontend is a bare walking-skeleton page with shadcn's neutral defaults. Every later screen (New Plan 1.8, Overview 1.9, all later epics) needs the DESIGN.md look, a toolbar with the eight-step flow bar, a fixed focus ring and a shared component set, and none of it exists.

**Approach:** Replace the shadcn theme in `frontend/app/globals.css` with the DESIGN.md tokens as the Tailwind 4 theme, self-host the two fonts via `@fontsource`, build the shared components in `frontend/components/common/` and `frontend/lib/format/`, and wrap every page in an app shell (64px graphite toolbar with product mark, name and the flow bar in the no-plan state). Verify with Vitest unit tests and a Playwright test of the shell.

## Boundaries & Constraints

**Always:**
- Story 1.4 acceptance criteria in `.docs/planning-artifacts/epics/epics-Project-2026-11-17/epics.md` (lines 511–541) are the target; DESIGN.md values are copied exactly (hex, px, line heights, weights).
- New deps pinned exactly as the spine Stack says: `sonner@2.0.8`, `@fontsource/figtree@5.3.0`, `@fontsource/barlow-semi-condensed@5.3.0` in `frontend/package.json` `dependencies`; `package-lock.json` updated with `npm install` from the repo root. No other new dependency.
- Use what is installed: `radix-ui` (1.8.1) primitives for Popover and AlertDialog, `lucide-react` for the outline UI icons, `cn` from `@/lib/utils`.
- Fonts: import `@fontsource/barlow-semi-condensed/{500,600,700}.css` and `@fontsource/figtree/{400,500,600,700}.css` in `app/layout.tsx`; never `next/font/google`, never a CDN or any runtime network request.
- Light theme only; tabular numbers everywhere; no screen text below 11px; every animation/transition ≤ 200 ms, and none (no slide) under `prefers-reduced-motion: reduce`.
- Focus ring (UX-DR2), fixed, never recoloured: on paper `box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #1B1E22`; on graphite `0 0 0 2px #141719, 0 0 0 4px #FFFFFF`; applied to every `:focus-visible` element (paper by default, graphite inside any element marked `data-surface="graphite"`), with `outline: 2px solid transparent` kept for forced-colours mode.
- Frontend modules rule stays: nothing under `modules/`; shared code in `components/common/` and `lib/`. All UI text English, sentence case, glossary terms verbatim, no emoji or Unicode symbols as icons (▾ is the chevron icon, not a character).
- Every test names its FR/NFR (e.g. `nfr10 …`); the Playwright test names its journey (`uj1 …`).
- Existing tests stay green: `frontend/e2e/skeleton.spec.ts` (heading "Smart Warehouse Planner", "Backend: ok" / "Backend: unreachable") and `frontend/tests/module-boundaries.test.ts`.

**Never:**
- No plan plate, launcher button, avatar, `/` redirect, `lib/view-state` URL builder, New Plan page or API calls beyond the existing health query (Stories 1.8/1.9 and later). No dark mode.
- No shadcn CLI runs (they fetch from the network and rewrite files); write components by hand.
- Never touch `data/`, the backend, `.github/`, or planning artifacts. Never push.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Date only | `formatDate("2026-09-30")` | `"2026-09-30"` (never shifted by time zone) | — |
| Instant → local date/time | `formatDate` / `formatTime` of `"2026-09-30T22:30:00Z"` with `TZ=Europe/Oslo` | `"2026-10-01"` / `"00:30"` | Invalid input → throws `RangeError` |
| Thousands | `formatNumber(1584)`, `formatNumber(2000000)`, `formatNumber("12345.5")`, `formatNumber(-1234)`, `formatNumber(0)` | `"1,584"`, `"2,000,000"`, `"12,345.5"`, `"-1,234"`, `"0"` (string input keeps its decimals exactly) | Non-numeric string → throws `RangeError` |
| Toast duration | message of 40 chars / 300 chars | 10,000 ms / longer than 10,000 ms (grows with length) | — |
| Collapsed flow bar, no plan | viewport < 1024px, no current step | trigger reads "Plan steps" + chevron icon; popover lists the 8 steps | — |
| Collapsed flow bar, current step | `currentStep="recommendations"` | trigger reads "Step 6 of 8 · Recommendations" + chevron icon | — |
| Disabled button | `<Button disabledReason="No moves to undo">` | `aria-disabled="true"`, focusable, click does nothing, reason element linked by `aria-describedby`, shown on hover and focus | — |

</intent-contract>

## Code Map

- `frontend/app/globals.css` -- currently shadcn neutral oklch vars + `.dark`; keep `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`; replace the rest.
- `frontend/app/layout.tsx` -- root layout, already says fonts come from @fontsource in 1.4; wraps `Providers`.
- `frontend/app/providers.tsx` -- client QueryClient provider; add the Toaster here or in the shell.
- `frontend/app/page.tsx` -- skeleton health page with `<h1>Smart Warehouse Planner</h1>` and `role="status"` line; keep both (e2e depends on them), restyle with tokens, `<main id="content">`.
- `frontend/lib/utils.ts` -- `cn` re-export (package `cn`).
- `frontend/vitest.config.mts` -- `include: tests/**/*.test.ts`, `environment: node`, no `@` alias. Must add `.tsx` tests, `resolve.alias` `@` → frontend root, and `test.env.TZ = "Europe/Oslo"`.
- `frontend/playwright.config.ts` -- baseURL `http://localhost:3000`, webServer runs root `npm run dev`. New spec files in `frontend/e2e/` are picked up automatically.
- `frontend/eslint.config.mjs` -- module-boundary rules; `components/` and `lib/` unrestricted.
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` -- read per `frontend/AGENTS.md` before touching fonts/layout (Next 16).
- sonner 2.0.8 facts (checked in its dist): the Toaster `<section>` has `aria-live="polite"`; its timer pauses on hover and pointer-down but **not on keyboard focus**; default transitions are 400 ms; it ships its own `prefers-reduced-motion` rule removing transitions.
- Testing without a DOM: Vitest runs in `node`; render components with `react-dom/server` `renderToStaticMarkup` and assert on the markup (no jsdom/testing-library — not in the Stack).

## Tasks & Acceptance

**Execution:**
- `frontend/package.json`, `package-lock.json` -- add the three pinned deps (`npm install --workspace frontend --save-exact …` from root).
- `frontend/app/globals.css` -- `@theme` with: every DESIGN.md `colors` key as `--color-<key>` (same name, exact hex) plus `--color-brand-mark: #F0B323` (fixed, independent of `class-medium`); `--font-sans` = Figtree + fallback `'Helvetica Neue', Helvetica, Arial, sans-serif`, `--font-code` = Barlow Semi Condensed + fallback `'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`; every typography entry as `--text-<key>` with `--line-height` and `--font-weight` sub-vars, plus an `@utility type-<key>` setting family, size, weight and line height; `rounded` as `--radius-xs/sm/md/DEFAULT(--radius)/lg/xl/full`; spacing `1..5` and each named size (`page-gutter`, `toolbar-height`, `control-lg`, … `marker-size`) as `--spacing-<key>`. Map shadcn semantic vars (`--background` → ground, `--foreground` → ink, `--primary` → ink, `--border`, `--input` → input-border, `--ring` → focus-on-light, `--destructive` → ink, `--popover`/`--card` → surface, `--radius` → 4px) so future shadcn components fit; delete `.dark` and the dark custom variant. Base layer: `html` Figtree, `font-variant-numeric: tabular-nums` on `html`, body `bg-ground text-ink` at body typography; focus ring rules (Boundaries); `[data-sonner-toast]` transitions capped at 200 ms; `@media (prefers-reduced-motion: reduce)` setting `animation-duration`/`transition-duration` to `0.01ms !important` and `scroll-behavior: auto` on everything.
- `frontend/app/layout.tsx` -- font CSS imports; body renders `<Providers><AppShell>{children}</AppShell></Providers>`.
- `frontend/lib/format/index.ts` -- `formatDate`, `formatTime`, `formatNumber` per the matrix; instants formatted in the viewer's zone (`Intl.DateTimeFormat` with `hourCycle: "h23"` or manual parts), date-only `YYYY-MM-DD` strings returned unchanged after validation; `formatNumber` for strings formats only the integer part.
- `frontend/lib/view-state/steps.ts` -- `FLOW_STEPS`: ordered `{ key, number, name }` for overview "Overview", parts "Parts", locations "Locations", pick-groups "Pick groups", best-locations "Best locations", recommendations "Recommendations", before-after "Before/after", move-list "Move list"; type `StepKey`. (1.9 adds URL helpers beside it.)
- `frontend/components/common/class-glyph.tsx` -- `ClassGlyph({ movementClass: "fast"|"medium"|"slow"|"dead", size = 9, label? })`: filled SVG paths in `currentColor` default `var(--color-glyph)` (triangle up, diamond, triangle down; dead = ring + 45° slash, 1.6 stroke); `aria-hidden` unless `label` given (then `role="img"` + `aria-label`).
- `frontend/components/common/icons.tsx` -- `Icon({ name, size = 16, label? })` over lucide (`Search`, `LayoutGrid`→grid, `Lock`, `Clock`, `Pin`, `Palette`, `TriangleAlert`→warning, `Check`, `Link`, `ChevronDown`→chevron, `Plus`, `X`→close) with `strokeWidth={1.6} absoluteStrokeWidth`, round caps/joins; `IconName` union of the 12 names.
- `frontend/components/common/button.tsx` -- `Button` variants `primary | secondary | tertiary | link | destructive` (DESIGN.md button-* specs, radius lg, heights control-lg/md/sm via `size` `lg|md|sm`); `disabledReason?: string` → `aria-disabled="true"`, stays focusable, `onClick` suppressed, disabled look (surface-disabled / ink-disabled / border), reason in a `role="tooltip"` element (`useId`) referenced by `aria-describedby` and shown on hover and focus. Never sets native `disabled` when a reason is given.
- `frontend/components/common/input.tsx` -- `Input` (surface, 1px input-border, radius lg, placeholder ink-muted, control-lg height) and `InputError({ id, children })` (16px warning icon in `error` + caption sentence in ink). `Input` prop `errorId?: string` → `aria-invalid="true"`, `aria-describedby` includes it, 1.5px `error` border. `Esc`: non-empty → clears (native value setter + `input` event so React `onChange` fires); empty → blurs. `Enter` keeps native form submit.
- `frontend/components/common/toast.tsx` -- `Toaster` (sonner, `position="bottom-left"`, `offset={24}`, `visibleToasts={1}`, `duration={Infinity}`, unstyled) and `showToast(message, { action?: { label, onClick }, icon?: IconName })`: dismisses any current toast first (one at a time), renders via `toast.custom` a `ToastBody` (ink strip ≤560px, min 44px, 14px side padding, body typography weight 500, icon in on-dark, ≤1 underlined action) that owns its timer: `toastDurationMs(message)` = max(10,000, 100 ms × characters); timer paused while hovered or while focus is inside, resumed after; dismisses itself at the end.
- `frontend/components/common/global-notice.tsx` -- `GlobalNotice({ children })`: full-width strip, surface, 2px ink bottom rule, warning icon, body-strong text, `role="status"`.
- `frontend/components/common/confirm-dialog.tsx` -- `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm })` on radix `AlertDialog`: ink scrim 45%, surface, radius xl, overlay shadow, title in `type-rank`; buttons right-aligned, `AlertDialog.Cancel` "Cancel" (tertiary) rendered first and focused on open, then confirm as `destructive`; focus returns to the opener (radix default). Fade only, ≤150 ms.
- `frontend/components/common/app-shell/product-mark.tsx` -- medium bin in miniature (≈24×26px SVG): brand-mark yellow body, darker top lip, white label window with the diamond glyph; `aria-hidden`.
- `frontend/components/common/app-shell/flow-bar.tsx` -- `FlowBar({ currentStep?, doneSteps = [], hrefFor? })` inside `<nav aria-label="Plan steps">`. ≥1024px (`lg`): an `<ol>` of the 8 steps in the flow-track (38px, radius xl, 1px flow-track-edge); each step: 14px ring + number (`type-tag`) and label (button type, weight 500, on-dark-nav); not reached = ring in on-dark-muted; done = on-dark-nav disc with ink check icon + visually hidden ", done"; current = white 30px pill, ink text, `aria-current="step"`. Accessible name per step "Overview, step 1" (+ ", done"). A step is a `<Link>` only when `hrefFor` is given, else a non-interactive `<span>`. <1024px: a radix Popover trigger (button, graphite) reading "Step N of 8 · <name>" or "Plan steps" with no current step, plus chevron icon; popover content (surface, radius lg, border, overlay shadow, fade ≤150 ms, no slide/zoom classes) lists the same 8 steps.
- `frontend/components/common/app-shell/toolbar.tsx` + `index.tsx` (`AppShell`) -- skip link "Skip to content" (`href="#content"`, visually hidden until focused, paper styling, before the header); `<header data-surface="graphite">` min-height 64px, louvre background (shell with shell-slat 11×3 slats radius 1.5 on an 18×12 tile, inline SVG data URI), 1px shell-edge bottom, `flex-wrap` so it never overflows at 320px; sticky top 0 only `@media (min-height: 500px)`, else static; left: home `<Link href="/">` with product mark + "Smart Warehouse Planner" (Barlow 15px, white); then `FlowBar` with no props. Below: `children`.
- `frontend/app/page.tsx` -- keep content and texts; `<main id="content" tabIndex={-1}>` with page gutter, h1 in `type-page-title`.
- `frontend/vitest.config.mts` -- include `tests/**/*.test.{ts,tsx}`, alias, `TZ`.
- `frontend/tests/design-tokens.test.ts` -- parse DESIGN.md front matter (`colors`, `typography` fontSize/weight/lineHeight, `rounded`, `spacing`) with simple line regexes and assert each appears with its exact value in `globals.css` (`nfr10 theme defines every DESIGN.md token`); assert no `--text-*` size below 11px and no `text-[<11px]` class in `app/`, `components/`, `lib/` sources; assert no `fonts.googleapis`, `fonts.gstatic` or `next/font/google` anywhere in those sources (`nfr2 fonts are self-hosted`).
- `frontend/tests/format.test.ts` -- every format row of the matrix (`ux` copy rule under NFR-11: name `nfr11 …`).
- `frontend/tests/components.test.tsx` -- `renderToStaticMarkup` checks: ClassGlyph renders an `<svg>` with `<path>`/`<circle>` and no text glyph characters for all four classes; Icon renders 12 names; Button disabled-reason row of the matrix; Input `errorId` → `aria-invalid`/`aria-describedby`; FlowBar both collapsed-label rows, `aria-current="step"` on the current step, ", done" hidden text on done steps, no links without `hrefFor`; `toastDurationMs` row; ConfirmDialog rendered `open` lists Cancel before the confirm button (if radix renders nothing server-side, assert via a small exported `confirmButtons` order constant instead and note it).
- `frontend/e2e/app-shell.spec.ts` -- journey UJ-1 (the app opens before New Plan), Chromium; see Acceptance Criteria.

**Acceptance Criteria:**
- Given the app at `/` at 1280×800, when it renders, then the banner is 64px tall with the shell colour `rgb(38, 42, 46)` among its background, the product mark and the link "Smart Warehouse Planner" are visible, the navigation "Plan steps" lists exactly Overview, Parts, Locations, Pick groups, Best locations, Recommendations, Before/after, Move list in that order with no `aria-current`, no text "Data as of" exists, the toolbar's computed `position` is `sticky`, and "Backend: ok" still shows (`uj1 opens the app shell with the eight-step flow bar`).
- Given that page, when fonts settle (`document.fonts.ready`), then `document.fonts.check('700 16px "Barlow Semi Condensed"')` and `('400 13px Figtree')` are true, no request left `localhost`, every visible text element has computed `font-size` ≥ 11px, and `body` has `font-variant-numeric` `tabular-nums`.
- Given keyboard focus, when Tab lands on the skip link (paper) and then on the home link (graphite), then their computed `box-shadow` shows white 2px + ink `rgb(27, 30, 34)` 4px, and `rgb(20, 23, 25)` 2px + white 4px respectively.
- Given a 1280×450 viewport, when the page renders, then the toolbar's `position` is `static`.
- Given a 900px-wide viewport, when the page renders, then the eight-step list is hidden and the button "Plan steps" shows; clicking it opens a popover listing the eight steps; with `reducedMotion: "reduce"` emulated, the popover's computed `animation-duration` and `transition-duration` are ≤ 0.01s; without it, both are ≤ 0.2s.
- Given a 320px-wide viewport, when the page renders, then `document.documentElement.scrollWidth` ≤ 320.
- Given the frontend, when `npm run build --workspace frontend` runs, then it succeeds.

## Spec Change Log

## Review Triage Log

### 2026-11-21 — Review pass
- verdicts: 46 findings — high 0, medium 6, low 29, false 9, maybe-false 2
- findings:
  - `[medium]` `[defer]` (intent-alignment) Toast, ConfirmDialog, Button and Input behaviours in use are tested only through static markup or constants — real; grouped with the verification-gap toast/confirm/input rows; the button part is patched (see V1 row); the rest has no consumer yet (no DOM test env in the Stack) and is deferred to the first story that renders them (1.8 toast and input).
  - `[low]` `[defer]` (intent-alignment) Reduced motion is exercised for the popover only, not for a toast — real gap; no page can show a toast yet; the global reduced-motion rule and sonner's own rule cover it; grouped with the toast deferral.
  - `[low]` `[reject]` (intent-alignment) Tokens are checked as CSS source text, not as Tailwind output — the AC says "the theme defines"; the e2e test checks computed colour, fonts, sizes and focus ring at the rendered surface, and `next build` compiles the theme.
  - `[false]` `[reject]` (intent-alignment) Glossary use is not checked at any surface — the only UI copy is the eight step names, the product name and "Skip to content"; the e2e asserts the step names verbatim against the glossary list.
  - `[medium]` `[patch]` (verification-gap) Disabled Button "click does nothing" untested — patched: `nfr10 ignores clicks and drops native disabled` walks the rendered element tree, calls the button's `onClick` with a fake event and asserts the caller's spy is not called.
  - `[medium]` `[defer]` (verification-gap) ToastBody pause-on-hover/focus, remaining-time bookkeeping and one-at-a-time are untested — real; needs a DOM (jsdom is not in the Stack) or a page that shows a toast; deferred to Story 1.8, whose success toast gets a Playwright check.
  - `[low]` `[defer]` (verification-gap) Input Esc clear/blur untested — real; no consumer yet; deferred to Story 1.8 (plan name field).
  - `[medium]` `[defer]` (verification-gap) ConfirmDialog test checks only a constant — real; no consumer yet; deferred to the first story that opens a confirm dialog (Reset…/Delete…), to be checked in Playwright (Cancel first and focused, focus returns).
  - `[low]` `[patch]` (verification-gap) formatNumber exponent branch never runs — patched: rows `1e21` and `1e-7` added; both pass.
  - `[low]` `[patch]` (verification-gap other) Disabled-branch `{...rest}` overrides the tooltip-reset `onBlur` — patched: rest spread first, caller `onBlur` composed with the reset.
  - `[medium]` `[patch]` (blind) Skip link target `#content` exists only on `/` (404 and future pages have none) — patched: AppShell wraps every page in `<main id="content" tabIndex={-1}>`; page.tsx outer element is a div; e2e now presses Enter on the skip link and asserts `#content` is focused.
  - `[low]` `[patch]` (blind) Sticky toolbar can cover focused or scrolled-to content (WCAG 2.4.11) — patched: `scroll-padding-top: var(--spacing-toolbar-height)` on html under `min-height: 500px`.
  - `[low]` `[patch]` (blind) Removing the dark variant brings back Tailwind's prefers-color-scheme `dark:` — patched: `@custom-variant dark (&:is(.dark *))` restored (no `.dark` is ever set) and `color-scheme: light` on html.
  - `[low]` `[reject]` (blind) shadcn `--accent`/`--accent-foreground`, sidebar and chart mappings missing — no shadcn component is used and the spec forbids CLI runs; `accent` is the DESIGN.md selection token by name; remapping adds surface for a case not met in everyday use.
  - `[low]` `[patch]` (blind) Focus ring hard-codes hex instead of the focus tokens — patched: uses `var(--color-focus-*)`; computed values unchanged (e2e passes). The ring on `<main tabIndex=-1>` after the skip link is the intended focus indicator, so that part is rejected.
  - `[low]` `[reject]` (blind) Sonner child rule sets 200 ms on `transition-property: all` children — every resulting transition is still ≤200 ms, which is the rule; no wrong outcome named.
  - `[false]` `[reject]` (blind) Toast has no close button or tests — UX-DR14 specifies at most one action and timed dismissal with pause, not a close button; the test part is grouped with the deferred toast row.
  - `[false]` `[reject]` (blind) Confirm test circular; destructive looks like primary — the test part is deferred above; DESIGN.md `button-destructive` says "same look as button-primary … never red".
  - `[low]` `[patch]` (blind) `document.fonts.check` passes when no face exists — patched: e2e now requires loaded FontFace entries for Barlow Semi Condensed 700 and Figtree 400.
  - `[low]` `[patch]` (blind) Popover dialog has no accessible name and will not close on navigation once steps are links — patched: `aria-label="Plan steps"` on the content and links wrapped in `Popover.Close`; `aria-current` on a span is never rendered without a plan (no current step), so that part is false.
  - `[false]` `[reject]` (blind) Arbitrary sizes/colours bypass tokens — each value is from DESIGN.md (name "Barlow 15px white", flow-step-current height 30, flow-bar height 38, step ring 1.2px, input-error 1.5px).
  - `[false]` `[reject]` (blind) Spacing overrides mix two scales — `--spacing-1..4` equal Tailwind's 4px base; only `5` = 24px, which is DESIGN.md's scale on purpose; half steps stay on the same 4px base.
  - `[maybe-false]` `[reject]` (blind) Esc in Input may be swallowed by radix dismissable layers — no Input sits in a radix layer yet; would need a test inside a dialog; if true it is low.
  - `[low]` `[patch]` (blind) Disabled Button lets caller `onBlur`/`disabled` override — same root cause as the verification-gap other row; same patch (native `disabled` dropped in the disabled branch). Escape for hover-only tooltip: rejected low, fix adds a document listener.
  - `[false]` `[reject]` (blind) GlobalNotice not wired, role too weak — the story only asks for the component; EXPERIENCE.md says save status uses `aria-live="polite"`, which `role="status"` gives.
  - `[low]` `[reject]` (blind) formatNumber float noise, no fixed decimals, Intl formatter per call — API quantities arrive as decimal strings; unlikely in everyday use; fixes add options or caching.
  - `[false]` `[reject]` (blind) Unused Barlow 500 weight — DESIGN.md Typography lists Barlow Semi Condensed 500/600/700.
  - `[low]` `[patch]` (edge-case) Caller `onBlur`/`disabled` override the disabled branch — same root cause as the verification-gap other row; same patch.
  - `[low]` `[patch]` (edge-case) Invisible tooltip still takes layout and can widen the page — patched: `hidden`, shown with `block` on hover/focus.
  - `[low]` `[reject]` (edge-case) Empty `disabledReason` gives an empty tooltip — callers pass fixed copy; the proposed guard would silently enable a button the caller disabled.
  - `[low]` `[patch]` (edge-case) Esc clears a readOnly/disabled input — patched: early return.
  - `[low]` `[patch]` (edge-case) Esc during IME composition wipes the field — patched: early return on `nativeEvent.isComposing`.
  - `[low]` `[patch]` (edge-case) A throwing toast action leaves the toast forever — patched: `try { … } finally { toast.dismiss(id) }`.
  - `[maybe-false]` `[reject]` (edge-case) Focus drops to body after a toast action unmounts — sonner's section restores the last focused element on blur; whether blur fires on unmount needs a browser check; if true it is low.
  - `[low]` `[reject]` (edge-case) Toast timer keeps running in a hidden tab — no toast exists yet; fix adds a visibilitychange listener.
  - `[low]` `[patch]` (edge-case) Popover stays open after navigating from a step link — same root cause as the blind popover row; same patch.
  - `[low]` `[reject]` (edge-case) Popover stays open when the window widens past 1024px — rare; fix adds controlled state and a media listener.
  - `[low]` `[reject]` (edge-case) Focus ring replaces the popover's overlay shadow when the content is keyboard-focused — the focused element shows the required focus indicator; cosmetic; fix adds an exception rule.
  - `[low]` `[patch]` (edge-case) Skip link target scrolls under the sticky toolbar — same root cause as the blind 2.4.11 row; same patch.
  - `[medium]` `[patch]` (edge-case) Skip link target missing on other pages — same root cause as the blind skip-link row; same patch.
  - `[false]` `[reject]` (edge-case) Unknown movementClass renders an empty svg — the prop is a TypeScript union; no runtime caller passes API strings yet.
  - `[low]` `[reject]` (edge-case) Exponent numbers below 1e-20 round to 0 — no such quantities exist; fix adds a branch.
  - `[false]` `[reject]` (edge-case) CRLF DESIGN.md breaks the token test — the test then fails loudly, which is correct; the file is LF in git.
  - `[low]` `[reject]` (edge-case) Unknown font family silently maps to --font-code — DESIGN.md has exactly two families; test-only; fix adds a branch.
  - `[low]` `[patch]` (edge-case) Removed dark variant (deletion) — same root cause as the blind dark-variant row; same patch.
  - `[low]` `[reject]` (edge-case) Removed accent/sidebar/chart mappings (deletion) — same as the blind shadcn-mapping row; rejected for the same reason.

## Design Notes

- No-plan flow bar: with no plan there is no URL to link to, so steps render as non-interactive text in the not-reached style, and the collapsed trigger reads "Plan steps" (the nav's name) because "Step N of 8" needs a current step. `hrefFor` and `currentStep` are props so 1.9 only passes them in.
- The skip link is the one paper focus target on a plan-less page; it also satisfies WCAG 2.4.1.
- Toast timing lives in `ToastBody`, not in sonner, because sonner does not pause on keyboard focus (UX-DR14 requires it).
- Tokens test reads DESIGN.md so a token change in the design spine fails CI until the theme follows.

## Verification

**Commands:**
- `npm install` (root) -- exit 0, lockfile updated.
- `npm run lint && npm run typecheck` -- exit 0.
- `npm run test:web` -- all Vitest tests pass (module-boundaries + 3 new files).
- `npm run test:py && npm run lint:py && npm run lint:imports` -- unchanged, exit 0.
- `npm run build --workspace frontend` -- exit 0.
- `CI=true npm run e2e -- --project=chromium` (no dev server running) -- skeleton + app-shell specs pass.

## Auto Run Result

Status: done

**Summary:** The DESIGN.md tokens are the Tailwind 4 theme (every colour, the typography ramp with `type-*` utilities, radii, spacing and fixed sizes, plus a fixed `brand-mark` yellow); Barlow Semi Condensed and Figtree are self-hosted from `@fontsource`; tabular numbers everywhere; a fixed focus ring (paper default, graphite inside `data-surface="graphite"`); a reduced-motion rule and a 200 ms cap on toast transitions. Every page sits in an app shell: skip link, 64px louvre-graphite toolbar (sticky only from 500px height) with the product mark, the home link "Smart Warehouse Planner" and the flow bar with its eight steps in the not-reached style (collapsing below 1024px to a "Plan steps" popover), then `<main id="content">`. Shared components and `lib/format` are in place for Stories 1.8 and 1.9.

**Files changed:**
- `frontend/package.json`, `package-lock.json` -- `sonner@2.0.8`, `@fontsource/figtree@5.3.0`, `@fontsource/barlow-semi-condensed@5.3.0`.
- `frontend/app/globals.css` -- DESIGN.md theme, shadcn variable mapping, focus ring, motion rules, scroll padding, light-only.
- `frontend/app/layout.tsx`, `frontend/app/providers.tsx`, `frontend/app/page.tsx` -- font imports, AppShell, Toaster, restyled skeleton page.
- `frontend/components/common/app-shell/{index,toolbar,flow-bar,product-mark}.tsx` -- the app shell.
- `frontend/components/common/{button,input,toast,global-notice,confirm-dialog,class-glyph,icons}.tsx` -- shared components.
- `frontend/lib/format/index.ts` -- `formatDate`, `formatTime`, `formatNumber`.
- `frontend/lib/view-state/steps.ts` -- `FLOW_STEPS`, `StepKey`.
- `frontend/vitest.config.mts` -- `.tsx` tests, `@` alias, `TZ=Europe/Oslo`.
- `frontend/tests/{design-tokens,format}.test.ts`, `frontend/tests/components.test.tsx` -- unit tests.
- `frontend/e2e/app-shell.spec.ts` -- UJ-1 app-shell journey (7 tests, Chromium).

**Review:** 46 findings (high 0, medium 6, low 29, false 9, maybe-false 2). Patched entries: disabled Button (click suppression test, caller onBlur/disabled, tooltip layout), Input Esc guards (readOnly/disabled, IME), toast action try/finally, skip-link target on every page, scroll padding under the sticky toolbar, light-only dark variant and `color-scheme`, focus ring via tokens, popover name and close-on-select, formatNumber exponent rows, loaded-font e2e check. Deferred (frontmatter `deferred`): toast timer/reduced motion, Input Esc, ConfirmDialog behaviour, all lacking a consumer until 1.8 or later. Rejected, with reasons in the Review Triage Log: shadcn accent/sidebar/chart mappings, sonner child transition, toast close button, destructive styling, arbitrary values from DESIGN.md, spacing scale, radix Esc (maybe-false), GlobalNotice wiring and role, formatNumber float noise, Barlow 500, empty disabledReason, toast focus restore (maybe-false), hidden-tab pause, popover on widen, focus ring on popover, unknown movementClass, tiny exponents, CRLF, unknown family, token text checks, glossary check.

**Follow-up review recommendation:** true -- two medium entries were patched (patched counts: high 0, medium 2, low 10). Named risk: the disabled Button's click suppression is verified only on the React element tree, not by a real click in a browser, because no page renders a disabled Button yet.

**Verification (after patches):** `npm install` up to date; `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run test:web` 4 files, 48 passed; `npm run test:py` 36 passed; `npm run lint:py` exit 0; `npm run lint:imports` 4 kept, 0 broken; `npm run build --workspace frontend` compiled; `CI=true npm run e2e -- --project=chromium` 10 passed (3 skeleton + 7 app-shell).

**Residual risks:** between 1024px and about 1100px wide the full flow bar does not fit beside the product name, so the toolbar wraps to two rows (about 97px at 1024px; 64px is asserted at 1280px only). Toast, ConfirmDialog and Input behaviour have not run in a browser (deferred). The app-shell e2e tests run in Chromium only.
