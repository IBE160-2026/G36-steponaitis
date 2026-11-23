# Epic 9 Context: Accounts, login and the public demo

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Anyone can create an account and log in, and plans record the logged-in user instead of the fixed `planner`. With the demo flag on, a demo front page offers Log in, Create account and Demo version, and Demo version opens the app as the seeded `demo` account. This turns the single-user milestone 1 tool into a multi-user milestone 2 app that examiners can try. The epic owns `app/auth`, `api/routers/auth`, `modules/auth` and `modules/front-page`. It turns `FEATURE_AUTH` and `FEATURE_DEMO` on without changing any other slice's code paths. Real deployment to Vercel and Supabase is deferred to Story 16.2 and is out of scope here.

## Stories

- Story 9.1: Create an account
- Story 9.2: Log in, log out and the page guard
- Story 9.3: Plans record the logged-in user, the user menu and session expiry
- Story 9.4: Login throttle and account limits
- Story 9.5: Seeded demo account and Demo version
- Story 9.6: Demo front page
- Story 9.7: Production-like auth configuration, README and secrets

## Requirements & Constraints

- **Accounts:** a unique username (letters and numbers) and a password typed twice. Passwords are hashed. There is no email, no roles, no admin and no password reset.
- **Login:** users log in and log out. Every page needs login except Log in, Create account and, on the public deployment, the demo front page. After login the user lands on the saved-plans list. Log out returns to Log in, or to the demo front page when the demo flag is on. Plans record the logged-in user.
- **Demo version (public deployment only):** it opens the saved-plans list as `demo`, with no password. Created by and edited by then show `demo`, plans stay shared, no plan is preloaded, and Log out works as for any user. A local install has no front page and no Demo version button. There, the README account `demo`/`demo` is used.
- **Milestone 1 compatibility:** with `FEATURE_AUTH` off, every request still acts as `planner`. Existing plans keep showing `planner` and open unchanged.
- **Secrets:** they come only from env vars. `.env.example` files hold placeholder values only. Commit only synthetic data. The demo account is the only seed.
- **README:** it covers env setup for a local run with auth on and the demo account `demo`/`demo`. It says the public deployment holds synthetic data only and links the public URL.
- **Acceptance journey (examiner on the public demo):** the front page shows, Demo version opens the saved-plans list as `demo`, and the avatar reads "DE". The examiner works through the flow, and Log out in the avatar menu returns to the front page. Story 9.7 proves this with a Playwright run against a local production-like build.
- **Tests:** they use the `test_fr39_*` and `test_fr40_*` naming. Account tests run on both SQLite and Postgres. The throttle test uses an injected clock and never sleeps.

## Technical Decisions

- **Store:** only `swp.store` imports SQLAlchemy. Use only portable types: `Uuid`, `JSON` and `UtcDateTime`, which returns aware UTC times. Alembic migrations run with `render_as_batch=True` and are expand-only:
  - one migration adds `users` (`id`, `username` as registered, unique casefolded `username_key`, `password_hash`, `created_at`);
  - one migration adds `login_attempts` (`username_key`, `failures`, `locked_until`).
  - Neither migration changes an existing table or JSON document.
- **Bootstrap:** `swp.app.bootstrap(upgrade, seed)` is the only path that migrates or seeds. The CLI `swp db upgrade` calls it, and the lifespan calls it only when `APP_ENV=local`. CI also runs `tests/app` on Postgres 17.
- **Flags:** `FEATURE_AUTH` and `FEATURE_DEMO` are backend env vars. The frontend reads them at runtime from `GET /api/session`, which returns `{user | null, feature_auth, feature_demo, max_upload_bytes}`. There are no `NEXT_PUBLIC_FEATURE_*` vars. With auth off, every `/api/auth/*` route returns `not_found`.
- **Usernames:** `str.isalnum`, 1–32 characters, unique by casefold, stored as registered. `planner` and `demo` are reserved.
- **Passwords:** 4–64 characters and at most 72 UTF-8 bytes. They are hashed with **bcrypt 5.0.0**.
- **Session:** an HS256 JWT made with **PyJWT 2.15.1**, with `sub` set to the user's UUID and valid for 30 days. It is sent in the httpOnly `SameSite=Lax` cookie `swp_session`, which is `Secure` in production. The user is loaded from the database on every request.
- **Endpoints:**
  - `POST /api/auth/signup`, `/login`, `/logout`, and `/demo`. The demo endpoint takes no password, skips the throttle and returns 404 when its flag is off.
  - With auth on and no session, every `/api/*` route except `health`, `session` and `auth/*` returns `unauthenticated`.
- **Startup check:** in production the backend refuses to start when `JWT_SECRET` is empty or default, or when `VERCEL` is set and `APP_ENV` is not. It logs a clear line, and each case has a test.
- **Who edited:** `CommandContext.user` is the logged-in username. `created_by` and `last_edited_by` store it as text with no FK, and run lines read "by <username>".
- **Demo seed:** the seed is idempotent and treats an integrity error as success. It takes the password from `DEMO_PASSWORD` (default `demo`) and does not count toward `MAX_ACCOUNTS`.
- **Error envelope:** every error is `{"error": {code, message, details}}`. The frontend branches only on `code`, and the backend writes `message` as final English copy with no dates or times in it. Codes used here:
  - `validation_failed` 422, with `[{field, message}]`
  - `unauthenticated` 401
  - `login_locked` 429
  - `limit_reached` 409, for plans and accounts
  - `not_found` 404
  - `forbidden_origin` 403
- **Limits:** they are env-configurable and enforced in `swp.app`. `MAX_ACCOUNTS` (200) and `MAX_PLANS` (50) apply only when `FEATURE_DEMO` is on.
- **Login throttle:** failures are counted per casefolded submitted username, whether or not the account exists. After 5 failures, logins for that name are blocked for 60 s with `login_locked`, and a successful login after the lock resets the count. Demo version bypasses the throttle.
- **Same-origin guard:** there is no CORS. Middleware rejects POST, PUT, PATCH and DELETE with `forbidden_origin` unless `Sec-Fetch-Site` is `same-origin`, or, when that header is absent, `Origin` matches the host. This covers the auth POSTs too, and `test_nfr6_cross_site_post_rejected` is extended to `/api/auth/login`. Bodies are JSON only, and no GET request writes.
- **Session expiry on the client:** when a command gets `unauthenticated`, `lib/commands` keeps it, opens Log in, then resends it with the same `command_id` and reopens the plan where it was. The shared TanStack Query error hook sends a 401 on a GET to Log in in the same way.
- **API schemas:** auth and session shapes belong in `swp/api/schemas`, and the frontend uses the generated types.

## UX & Interaction Patterns

- **Log in and Create account pages:**
  - A graphite header holds only the logo and name. Below it, a 380px surface card on the ground colour has a border and `rounded.lg` corners, with the title in `page-title`.
  - Fields are 40px inputs with labels above. A password field has an underlined "Show" link inside it. The submit is a full-width primary button, with a link to the other page.
  - With the demo flag on, Log in also has a full-width tertiary **Demo version** button with a play glyph under an "or" rule.
- **Wrong login:** it shows one pale-red alert, "Wrong username or password. Check both and try again." The username stays, and the password is cleared and focused.
- **Lockout copy:** "Too many failed logins for this username. Wait a minute and try again." Demo version still works during a lockout.
- **Create account:** the username hint is "Letters and numbers. Must not be taken." Errors are checked on submit and shown as `InputError` with `aria-invalid`, and focus moves to the first failing field. Messages include "That username is taken. Try another." and "The passwords don’t match." On success the saved-plans list opens.
- **Demo limit copy:** "The demo has reached its account limit. Use Demo version instead." and "The demo holds at most 50 plans. Delete a plan to make room."
- **Avatar:** it sits at the right end of the toolbar as a 34px ink disc. It shows the first two letters of the username in upper case and white, so `demo` reads "DE" and a one-letter name shows one letter. It opens a white popover user menu with "Logged in as", the username in Barlow bold and Log out. The menu works by keyboard, and `Esc` returns focus to the avatar.
- **Demo front page:** it appears only when the demo flag is on and there is no session.
  - The header holds the logo, the name, a "How it works" link that scrolls to the panels, and a Log in button outlined in on-dark.
  - The hero has the headline "Every move comes with a reason." in `display-hero` and a one-line `lead` summary. Its buttons are Log in (primary), Create account (secondary) and Demo version (tertiary, play glyph).
  - Beside the hero, a short bin wall uses 56px bins with FST/MED/SLW/DED codes, one lifted bin, an accent arrow to a dashed best-location target, and a reason card.
  - The section "One part, start to finish" has four numbered panels hung from a graphite rail. They follow one demo part from its export row, to its movement class, to Apply / Keep in place, to its printed move-list line.
  - The page has no synthetic-data notice, no README or demo-data links, no footer text and no claims about customers, savings or distances.
- **Copy rules:** English, sentence case, no exclamation marks and no emoji.

## Cross-Story Dependencies

- Story 9.1 adds the `users` table, the cookie and `/api/session`, and every later story builds on them.
- Story 9.2 adds the guard and the login flow. Story 9.6 changes where Log out goes, to the front page when the demo flag is on.
- Story 9.3 depends on the command flow and `CommandContext` from earlier epics, which built the milestone 1 `planner` default and the retry handling in `lib/commands`.
- Story 9.4's throttle and limits must leave Demo version from Story 9.5 working.
- Story 9.6's front-page bins reuse `components/common` Bin and ClassGlyph from Epic 10 if they exist. Otherwise it uses an inline SVG built from the DESIGN.md tokens.
- Story 9.7 closes the epic with an end-to-end proof of the examiner journey. Setting the Vercel and Supabase variables belongs to Story 16.2.
- The same-origin guard and the error envelope already exist from Epic 1 and are extended, not rebuilt.
