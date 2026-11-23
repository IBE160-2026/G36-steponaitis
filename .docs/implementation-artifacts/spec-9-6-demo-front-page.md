---
title: 'Story 9.6: Demo front page'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: 'a47d30871eed948f11ed686d789a93d96463c04e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-9-context.md'
  - '{project-root}/AGENTS.md'
  - '{project-root}/frontend/AGENTS.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** On the public deployment (`FEATURE_DEMO` on) a visitor without a session lands on Log in and never sees what the tool does; Log out also returns to Log in instead of a front page (NFR-5, FR-40, FR-50, UX-DR54).

**Approach:** `/` becomes a client page that reads `GET /api/session`: with `feature_demo` on and no user it renders the demo front page from a new `modules/front-page` slice (own graphite header, hero with three actions and a static bin wall, four "One part, start to finish" panels); otherwise it replaces itself with the saved-plans list as today. The page guard lets `/` through for that case, the app toolbar steps aside on `/`, and Log out goes to `/` when `feature_demo` is on.

## Boundaries & Constraints

**Always:**
- URLs (`frontend/lib/view-state/urls.ts`): `FRONT_PAGE_HREF = "/"` and `isFrontPagePath(pathname)` (true for `/` only). `logoutHref(session)` lives in `modules/auth/api.ts`: `FRONT_PAGE_HREF` when `session?.feature_demo` is true, else `LOGIN_HREF`.
- Guard (`modules/auth/auth-guard.tsx` `guardDecision`): after the pending check, `isFrontPagePath(pathname) && session.data?.feature_demo === true` → `"render"`. Every other rule is unchanged (demo off + auth on + no user on `/` still redirects to `/login`; Story 9.2).
- `app/page.tsx` (no longer a server redirect): renders `<HomePage demoAction={<DemoVersionButton />} />`. `HomePage` (in `modules/front-page`) uses `useSession`: pending → `null`; `homeDecision(session)` returns `"front-page"` when `data.feature_demo && data.user == null`, else `"saved-plans"`, which does `router.replace(SAVED_PLANS_HREF)` in an effect and renders `null`. A failed session read counts as `"saved-plans"`.
- App shell (`components/common/app-shell`): on `isFrontPagePath` the shell renders only its children (no skip link, no toolbar, no save status, no `<main>` wrapper), because the front page owns its header, skip link and `<main id="content" tabIndex={-1}>`. Make the switch with a small client wrapper using `usePathname`; `AppShell` keeps its props. Other paths are unchanged.
- `modules/auth`: export `DemoVersionButton({ className? })` — a `Button variant="tertiary"` with `<Icon name="play" />` and `DEMO_VERSION_LABEL` that calls `runDemo` with the same effects as the Log in page (invalidate session, then `router.push(afterLoginHref())`), is disabled with a reason while in flight, and on `failed` shows `showToast(message)` and re-enables. The Log in page's `DemoFooter` stays as it is (it shares busy state with Log in).
- Log out (`modules/auth/user-menu.tsx`): `navigate` uses `router.replace(logoutHref(session.data))`. Session expiry (401) still opens Log in.
- Front page (`modules/front-page/front-page.tsx`, all copy as constants in `modules/front-page/copy.ts`; the module imports only `components/*`, `lib/*` and `./`; actions come in as the `demoAction` slot):
  - Header: `data-surface="graphite"` `<header>` with `bg-louvre-shell`, the `ProductMark` and "Smart Warehouse Planner" (same look as the toolbar; not a link), an on-dark link "How it works" to `#how-it-works`, and a Log in link to `LOGIN_HREF` styled as an outlined button (border and text `on-dark`, transparent fill). A skip link "Skip to content" before it.
  - Hero (`<main id="content">`, ground colour): `<h1>` "Every move comes with a reason." in `type-display-hero` (smaller below 640px so nothing scrolls sideways at 320px); the lead in `type-lead` text-ink-secondary: "Smart Warehouse Planner reads your warehouse exports and suggests which parts to move where. You decide each one."; then Log in (`buttonClassName("primary")` link to `/login`), Create account (`buttonClassName("secondary")` link to `/signup`) and the `demoAction` slot; a caption under them: "Demo version skips the login and opens the app with a demo account."
  - Beside the hero (stacks under it on narrow screens): an inline SVG bin wall, `role="img"` with an `aria-label` describing it ("A shelf wall in aisle G, section 14: part 4410281 lifted out of level 4 and moved to an empty best location on level 1."), drawn from DESIGN.md tokens via CSS variables (`--color-wall`, `--color-wall-slat`, `--color-slot-empty`, `--color-class-*`, `--color-label-window`, `--color-best`, `--color-accent`, `--color-on-dark`): label "Aisle G · Section 14", four levels L4–L1, 56px bins whose label windows show the class glyph (reuse `ClassGlyph` inside the SVG) and the code FST/MED/SLW/DED, BEST tags on L2 and L1, one bin lifted above its slot on L4, an accent arrow to a dashed empty target on L1; and a reason card (surface, border) beside or under it: "RULE 1 · MOVE 1", **4410281** Brake pads, front, "61 picks in 12 months", "sits on L4, not best", "→ G-14-01-04, best location". Move-codes come from a `CLASS_CODES` map in `copy.ts`.
  - Section `id="how-it-works"` with `<h2>` "One part, start to finish": a graphite rail with four surface panels hung from it, as an ordered list numbered 1–4, each with a title and subtitle: 1 "In your export" / "The row you already have" (a small table Part · Location · Picks: 3301877 B-07-04-03 9; 4410281 G-14-04-02 61 highlighted; 5520114 C-03-03-01 33; 6612040 D-11-04-01 2); 2 "Classified fast" / "24 picks or more is fast" (a fast bin with FST, "61", "picks in the last 12 months"); 3 "You decide" / "Apply it, or keep in place" (4410281 · Brake pads, front, G-14-04-02 → G-14-01-04 with BEST, static non-interactive "Apply" and "Keep in place" chips, "Nothing changes until you apply it."); 4 "On the move list" / "Printed, one walk per round" ("Move list · Spring re-slot 2026", a ROUND 1 band "one walk", lines 4410281 G-14-04-02 → G-14-01-04, 5520114 C-03-03-01 → A-02-01-02, 3301877 B-07-04-03 → A-03-02-01). Static illustrations: nothing in the panels is a control.
  - Nothing else: no footer, no synthetic-data notice, no README or demo-data links, no claims about customers, savings or distances. English, sentence case, no exclamation marks, no emoji.
- Every test names its FR/NFR (`fr40`, `fr50`, `nfr5`); new e2e tests import `test`/`expect` from `frontend/e2e/support/test.ts` and name the journey (UJ-5).

**Never:** no backend change (flags, endpoints and seed exist from 9.1–9.5); no `FEATURE_DEMO` in the Playwright server env (it would cap the suite at 50 plans; tests rewrite `GET /api/session` in the browser as in `demo-version.spec.ts`); no change to where the guard or session expiry sends a logged-out visitor on other pages; no imports between `modules/front-page` and `modules/auth`; no new shared Bin component (Epic 10); no README, `.env.example` or production checks (9.7); no edits under `.docs/planning-artifacts/`, `data/sample/`, `data/answer-key/`; no session logs; no deployment.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Public, logged out | `/`, `feature_demo` on, user null | front page with header, hero, wall, four panels; no app toolbar | — |
| Public, logged in | `/`, demo on, user `demo` | replaced by `/plans` | — |
| Local, logged out | `/`, auth on, demo off, no user | `/login` (Story 9.2) | — |
| Auth off | `/`, auth off | `/plans` as `planner` | — |
| Session pending | `/` before the session answers | nothing renders | — |
| Session read fails | `/`, `GET /api/session` 500 | `/plans` (the API guard protects data) | — |
| Other page, demo on, no user | `/plans` | `/login` (unchanged) | — |
| How it works | click header link | page scrolls to the panels section | — |
| Front-page Demo version | click | `POST /api/auth/demo`, session refreshed, saved-plans list as `demo` | failure: toast with the server message, button enabled again |
| Log out, demo on | avatar menu → Log out | `/` front page | failure: toast (unchanged) |
| Log out, demo off | avatar menu → Log out | `/login` (unchanged) | — |

</intent-contract>

## Code Map

- `frontend/app/page.tsx` -- today a server `redirect(SAVED_PLANS_HREF)`; becomes the composition point (`HomePage` + `DemoVersionButton` slot). `app/` may import modules; modules may not import each other (ESLint `moduleBoundaries` in `frontend/eslint.config.mjs`).
- `frontend/app/layout.tsx` -- wraps every page in `AuthGuard` → `AppShell` (toolbar, account slot `UserMenu`).
- `frontend/components/common/app-shell/index.tsx` -- `AppShell` (skip link, `Toolbar`, `RememberPlanView`, `PlanSaveStatus`, `<main id="content">`); a server component today. `toolbar.tsx` -- header look to mirror (`data-surface="graphite"`, `bg-louvre-shell`, `min-h-toolbar-height`, `ProductMark`, name in `font-code text-[15px] font-bold text-white`). `product-mark.tsx` -- `ProductMark`.
- `frontend/lib/view-state/urls.ts` -- `SAVED_PLANS_HREF`, `LOGIN_HREF`, `SIGNUP_HREF`, `isAuthPath`; add `FRONT_PAGE_HREF`, `isFrontPagePath`.
- `frontend/modules/auth/auth-guard.tsx` -- `guardDecision(pathname, session)`, `followGuard`, `AuthGuard`.
- `frontend/modules/auth/user-menu.tsx` -- `logOut()` → `runLogout({ ..., navigate: () => router.replace(LOGIN_HREF) })`.
- `frontend/modules/auth/api.ts` -- `DEMO_VERSION_LABEL`, `runDemo(effects)`, `afterLoginHref()`, `runLogout`; `login-page.tsx` -- `DemoFooter` and the `effects` object to mirror in `DemoVersionButton`.
- `frontend/lib/api/session.ts` -- `useSession`, `Session` (`user`, `feature_auth`, `feature_demo`).
- `frontend/components/common/button.tsx` -- `Button` (`variant`, `disabledReason`), `buttonClassName(variant, size, isDisabled, className)` for links styled as buttons; `icons.tsx` -- `Icon name="play"`; `class-glyph.tsx` -- `ClassGlyph` (SVG, usable nested); `bin-swatch.tsx` -- bin drawing pattern (lip, bottom line, label window, ink outline) to scale up; `toast.tsx` -- `showToast`.
- `frontend/app/globals.css` -- tokens: `--color-ground`, `--color-wall`, `--color-wall-slat`, `--color-wall-edge`, `--color-slot-empty`, `--color-class-{fast,medium,slow,dead}`, `--color-label-window`, `--color-best`, `--color-accent`, `--color-on-dark`, `--color-on-dark-secondary`; utilities `type-display-hero`, `type-lead`, `bg-louvre-shell`; `[data-surface="graphite"] :focus-visible` ring.
- `frontend/lib/copy/index.ts` -- `MovementClass`, `CLASS_LABELS`.
- `frontend/tests/auth.test.tsx` -- `guardDecision`, `isAuthPath`, `runLogout`, `UserMenu` Vitest patterns (`AUTH_ON` session fixture).
- `frontend/e2e/demo-version.spec.ts` -- logged-out `test.use({ storageState: ... })`, `page.route("**/api/session")` rewrite to `feature_demo: true`, `**/api/auth/demo` forward to a real `demo`/`demo` login; `frontend/e2e/login.spec.ts:39,95` and `frontend/e2e/saved-plans.spec.ts:49` -- existing `/` expectations that must stay green.
- Reference mock (spines win): `.docs/planning-artifacts/ux-designs/ux-Project-2026-11-11/mockups/landing.svg`; DESIGN.md "Demo front page" and "Bin" entries.

## Tasks & Acceptance

**Execution:**
- `frontend/lib/view-state/urls.ts` -- `FRONT_PAGE_HREF`, `isFrontPagePath`.
- `frontend/modules/auth/auth-guard.tsx` -- front-page rule in `guardDecision`.
- `frontend/modules/auth/api.ts`, `frontend/modules/auth/user-menu.tsx` -- `logoutHref`; Log out uses it.
- `frontend/modules/auth/demo-version-button.tsx` (new) -- `DemoVersionButton`.
- `frontend/components/common/app-shell/index.tsx` (+ a small client wrapper file if needed) -- bare shell on `/`.
- `frontend/modules/front-page/copy.ts`, `front-page.tsx`, `bin-wall.tsx`, `home-page.tsx` (new) -- `homeDecision`, `HomePage`, `FrontPage`, the SVG wall and the panels.
- `frontend/app/page.tsx` -- compose `HomePage` with the `DemoVersionButton` slot.
- `frontend/tests/front-page.test.tsx` (new) and `frontend/tests/auth.test.tsx` -- Vitest: `homeDecision` for every matrix state; `guardDecision("/")` demo on/off, pending, logged in; `logoutHref`; `UserMenu` Log out navigates to `/` with demo on and `/login` with demo off; `FrontPage` renders the headline, lead, the three actions with their hrefs and the slot, the wall image with its label and the reason card, the four numbered panels in order, the How it works anchor target, and no footer/README/synthetic-data text; `DemoVersionButton` success navigates after invalidating, failure toasts and re-enables; the shell renders no toolbar on `/`.
- `frontend/e2e/front-page.spec.ts` (new, logged out, session rewritten to `feature_demo: true`, demo POST forwarded as in `demo-version.spec.ts`) -- `nfr5 uj5 the demo front page shows the flow and its three ways in` (header banner with name, How it works, Log in; h1 text; buttons; wall image; four panels; How it works scrolls the panels section into view; no horizontal scroll at 375px wide); `fr50 uj5 Demo version from the front page opens the saved-plans list as demo, and Log out returns to the front page` (avatar "DE", Log out → URL `/` and the h1 visible); `fr40 uj5 Log in and Create account on the front page open their pages`. The existing local-install test in `demo-version.spec.ts` (Log out → `/login` with demo off) stays.

**Acceptance Criteria:**
- Given `feature_demo` on and no session, when `/` is opened, then the front page renders with its own graphite header (logo, name, How it works, outlined Log in), the hero with "Every move comes with a reason.", Log in, Create account and Demo version, the bin wall with the reason card, and the four panels; the app toolbar and avatar are absent.
- Given `feature_demo` off, when `/` is opened, then no front page renders and `/` behaves as in Story 9.2 (Log in without a session, saved-plans list with one).
- Given a logged-in user with `feature_demo` on, when they log out from the avatar menu, then the demo front page shows; with `feature_demo` off they land on Log in.
- Given the full suites, then ESLint, typecheck, Vitest, pytest and Playwright chromium pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 30 findings — high 0, medium 0, low 19, false 11, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind: Demo version on `/` releases a remembered page and held commands from an expired session under `demo` — same `afterLoginHref()` path as the Log in page's Demo version and any other login since 9.3/9.5; needs a 401 then a manual visit to `/` in the same tab; a fresh-start path adds a branch.
  - `[low]` `[reject]` Blind: the Log out hold has no exit if the navigation never lands — `router.replace` to `/` or `/login` lands within one render; Back pressed inside that window is not everyday use; a timeout or origin tracking adds state and branches.
  - `[low]` `[reject]` Blind: `followGuardAfterLogout`'s boolean return is unused outside tests — harmless; no caller diverges.
  - `[low]` `[reject]` Blind: Log out tests can leak the module hold if an assertion fails first — only affects diagnostics of an already failing run.
  - `[false]` `[reject]` Blind: a rejected session refresh leaves Demo version stuck busy — `queryClient.invalidateQueries` resolves on a failed refetch unless `throwOnError` is set (query-core `queryClient.js`), so `runDemo` does not reject there.
  - `[false]` `[reject]` Blind: no test that `/` opens the saved-plans list — `e2e/login.spec.ts:95` and `e2e/saved-plans.spec.ts:49` (logged in → `/plans`) and `login.spec.ts:39` (demo off → `/login`) run against the new client page; `homeDecision` covers the failed read.
  - `[low]` `[reject]` Blind: local users get a blank render and a client redirect on `/` instead of a server redirect — the spec's Design Notes choice: flags are known only at runtime from `GET /api/session` (AD-10).
  - `[low]` `[patch]` Blind: the narrow-screen check ran at 375px while the spec says 320px — patched: the e2e overflow check runs at 320px.
  - `[low]` `[patch]` Blind: `LogoutEffects.navigate` and `runLogout` docs still say Log out opens Log in — patched: both name Log in or the demo front page (`logoutHref`).
  - `[low]` `[patch]` Blind: edited header comments break the 100-column wrapping (api.ts, auth-guard.tsx, user-menu.tsx) — patched: re-wrapped.
  - `[low]` `[patch]` Blind: skip-link markup and text copied from the shell into the front page — patched: one `SkipLink` in `components/common/app-shell/skip-link.tsx` used by both.
  - `[low]` `[reject]` Blind: the header Log in is hand-rolled with no hover style — focus uses the `[data-surface="graphite"] :focus-visible` ring; a missing hover tint is cosmetic and a new button variant adds surface.
  - `[low]` `[reject]` Blind: "24 picks or more is fast" is hard-coded while thresholds are per plan — a static illustration of one example from the approved mock and DESIGN.md wording; no plan data is shown.
  - `[low]` `[reject]` Blind: bin-wall SVG coordinates partly literal and fixed SVG ids — a static picture rendered once per page; no caller re-lays it out.
  - `[false]` `[reject]` Blind: the spec is not in the reviewed diff — by design, the spec goes only to the edge-case layer.
  - `[low]` `[reject]` Edge: Log out hold never clears if navigation lands elsewhere — same as the Blind hold row.
  - `[false]` `[reject]` Edge: trailing-slash pathname never matches the hold — Next.js `usePathname` gives `/` and `/login` exactly for `router.replace("/")`/`("/login")` (no `trailingSlash` config).
  - `[low]` `[reject]` Edge: the hold is module-level shared state — one `AuthGuard` per app; same reasoning as the Blind hold row.
  - `[low]` `[patch]` Edge: Demo success races HomePage's `replace("/plans")` with the button's `push`, leaving a duplicate history entry — patched: the button navigates with `router.replace(afterLoginHref())`.
  - `[low]` `[patch]` Edge: with `FEATURE_DEMO` on and `FEATURE_AUTH` off, `/` shows the front page forever (user always null) — patched: `homeDecision` and the guard's front-page rule also require `feature_auth`; Vitest cases added.
  - `[low]` `[patch]` Edge: the guard lets `/` through with demo on and auth off — same root cause and patch as the row above.
  - `[low]` `[reject]` Edge: after a successful Demo version the button stays busy if navigation never completes — intended (as on Log in); the page is being left.
  - `[false]` `[reject]` Edge: UserMenu's wiring to `logOutAndLeave` is untested — `e2e/front-page.spec.ts` logs out through the real avatar menu and asserts `/` with the headline; `demo-version.spec.ts` asserts `/login` with demo off.
  - `[false]` `[reject]` Edge: the shell is bare on `/` in every mode — by design: outside the front page `/` renders nothing and replaces itself with `/plans` (or the guard sends it to `/login`), so no shell is lost.
  - `[false]` `[reject]` Intent (a): tests fake `feature_demo` in the browser — the spec's stated choice (the server flag caps the suite at 50 plans); the endpoint is proven by 9.5's backend tests and Story 9.7 runs the journey with both flags on.
  - `[false]` `[reject]` Intent (b): the page ships in the bundle with demo off — "does not exist" is met: it never renders and `/` follows Story 9.2, asserted by the existing `/` e2e tests.
  - `[low]` `[reject]` Intent (c): stale Log out hold — same as the Blind hold row.
  - `[low]` `[reject]` Intent (d): logged-in `/` is now a client redirect — same as the Blind local-redirect row.
  - `[false]` `[reject]` Intent (e): bins mix branches — the AC's "otherwise inline SVG" branch applies because no common Bin exists; reusing `ClassGlyph` is allowed.
  - `[false]` `[reject]` Intent (f): retro item epic-1 R5 ("Give / a retry ... when GET /api/plans fails") — it concerns the saved-plans list's failed load, which now lives at `/plans` and is untouched; `/` no longer fetches plans.

## Design Notes

`/` stays one route for both modes because the flags are only known at runtime from `GET /api/session` (AD-10, no `NEXT_PUBLIC_FEATURE_*`), so a server redirect cannot choose. The front page owns its `<header>` and `<main>` so the banner landmark stays top-level; the shell therefore renders bare on `/`. Demo version reaches the front page as a slot (as `UserMenu` reaches the toolbar) to keep `modules/front-page` free of `modules/auth`. The wall is a static picture: Epic 10 has not built a shared large Bin, so an inline SVG reuses `ClassGlyph` and the token variables.

Retro items checked: no open item names `app/page.tsx`, the guard, the user menu or the shell. Epic-6 item 54 (copy into `lib/copy`) stays open; front-page copy lives in its own module like auth copy in 9.1–9.5.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: clean.
- `npm run test:web` -- expected: all pass.
- `npm run lint:py && npm run lint:imports && npm run test:py` -- expected: clean and all pass (no backend change).
- `npm run e2e -- --project=chromium` -- expected: all pass.

## Auto Run Result

Status: done

**Summary:** Demo front page (NFR-5, FR-40, FR-50, UX-DR54). `/` is now a client page: with `feature_auth` and `feature_demo` on and no user it renders `modules/front-page` — its own graphite header (logo, name, How it works, outlined Log in), the hero ("Every move comes with a reason.", lead, Log in, Create account, Demo version with a play glyph), an inline-SVG bin wall with 56px FST/MED/SLW/DED bins, a lifted bin, accent arrow to a dashed BEST target and a reason card, and "One part, start to finish" with four numbered panels on a graphite rail; otherwise it replaces itself with `/plans`. The guard lets `/` through in that case, the shell renders bare on `/`, and Log out goes to `/` with the demo flag on (`/login` otherwise). Demo version reaches the front page as a slot from `app/page.tsx`.

**Files changed:**
- `frontend/app/page.tsx` -- composes `HomePage` with the `DemoVersionButton` slot.
- `frontend/lib/view-state/urls.ts` -- `FRONT_PAGE_HREF`, `isFrontPagePath`.
- `frontend/components/common/app-shell/index.tsx`, `bare-on-front-page.tsx` (new), `skip-link.tsx` (new) -- bare shell on `/`, shared skip link.
- `frontend/modules/auth/auth-guard.tsx` -- front-page rule; Log out hold (`leaveTo`, `followGuardAfterLogout`) so the guard does not race Log out to `/login`.
- `frontend/modules/auth/api.ts`, `user-menu.tsx` -- `logoutHref`, `logOutAndLeave`.
- `frontend/modules/auth/demo-version-button.tsx` (new) -- `DemoVersionButton`.
- `frontend/modules/front-page/copy.ts`, `bin-wall.tsx`, `front-page.tsx`, `home-page.tsx` (new) -- the slice.
- `frontend/tests/front-page.test.tsx` (new), `frontend/tests/auth.test.tsx` -- Vitest.
- `frontend/e2e/front-page.spec.ts` (new) -- UJ-5 journeys.

**Review findings:** 30 (high 0, medium 0, low 19, false 11). Patches applied: 6 entries (all low: replace instead of push, `feature_auth` required for the front page, 320px overflow check, Log out doc comments, comment wrapping, shared `SkipLink`). Deferred: 0. Rejected: 22 -- see the Review Triage Log (Log out hold edge cases: navigation lands in one render; expired-session restore via Demo version: same as Log in since 9.3/9.5; client redirect on `/`: runtime flags; static-picture literals and copy; 11 false).

**Follow-up review recommendation:** false. Patched counts: high 0, medium 0, low 6.

**Verification (after the review patches):**
- `npm run lint`, `npm run typecheck` -- clean.
- `npm run test:web` -- 458 passed.
- `npm run lint:py`, `npm run lint:imports` -- clean (5 contracts kept).
- `npm run test:py` -- 868 passed, 2 skipped.
- `npm run e2e -- --project=chromium` -- 102 passed.

**Residual risks:** the front page and the front-page Demo version are proven only with `feature_demo` rewritten in the browser (Story 9.7 runs it with the real flag); the Log out hold is module state that stays set if Log out's navigation is interrupted; the implementer reports that `components/common/bin-swatch.tsx` builds `var(--color-class-${...})` dynamically, which Tailwind 4 may not emit, so swatches elsewhere may render black (not verified, not in scope); firefox and msedge e2e were not run.
