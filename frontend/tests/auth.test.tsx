import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toolbar } from "@/components/common/app-shell/toolbar";
import { ApiError } from "@/lib/api/errors";
import { type Session, SESSION_KEY } from "@/lib/api/session";
import { isAuthPath, LOGIN_HREF, SAVED_PLANS_HREF, SIGNUP_HREF } from "@/lib/view-state/urls";
import {
  afterLoginHref,
  fieldErrorsOf,
  firstFailingField,
  LOGIN_LEAD,
  LOGIN_TITLE,
  postLogin,
  postLogout,
  postSignup,
  runLogin,
  runLogout,
  runSignup,
  SIGNUP_TITLE,
  type SignupForm,
  USERNAME_HINT,
} from "@/modules/auth/api";
import { AuthGuard, followGuard, guardDecision } from "@/modules/auth/auth-guard";
import { afterFailedLogin, focusAfterFailedLogin, LoginCard, type LoginFormState } from "@/modules/auth/login-page";
import { PasswordInput } from "@/modules/auth/password-input";
import { focusField, SignupCard, type SignupFieldRefs } from "@/modules/auth/signup-page";
import { avatarInitials, UserMenu } from "@/modules/auth/user-menu";
import { SessionExpiry } from "@/lib/api/session-expiry";

// Story 9.1: Create account (FR-39, UX-DR53). Story 9.2: Log in, Log out and the page guard (FR-40).
// Story 9.3: the avatar user menu (UX-DR4) and the return to the open page after Log in (FR-40).

// The guard, Log out and the toolbar read the path and the session through hooks; these stand in.
const nav = vi.hoisted(() => ({
  pathname: "/plans",
  session: { isPending: false, data: undefined as unknown },
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/api/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/session")>()),
  useSession: () => nav.session,
}));

afterEach(() => {
  nav.pathname = "/plans";
  nav.session = { isPending: false, data: undefined };
  nav.replace.mockReset();
  nav.push.mockReset();
});

const html = renderToStaticMarkup;
const FORM: SignupForm = { username: "Kari7", password: "secret", password_repeat: "secret" };
// Server copy (AD-18); the frontend adds none, it shows the message it is sent.
const ACCOUNT_LIMIT = "The demo has reached its account limit. Use Demo version instead.";
const LOGIN_LOCKED = "Too many failed logins for this username. Wait a minute and try again.";
const TAKEN = "That username is taken. Try another.";
const MISMATCH = "The passwords don’t match.";

function validationError(details: { field: string; message: string }[]): ApiError {
  return new ApiError(422, "validation_failed", details[0].message, details);
}

function inputTag(markup: string, name: string): string {
  const match = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  expect(match, `input ${name}`).not.toBeNull();
  return match![0];
}

describe("fr39 auth urls", () => {
  it("fr39_signup_and_login_are_auth_paths", () => {
    expect(SIGNUP_HREF).toBe("/signup");
    expect(LOGIN_HREF).toBe("/login");
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/signup/")).toBe(true);
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/plans")).toBe(false);
    expect(isAuthPath("/")).toBe(false);
    expect(isAuthPath("/signup/x")).toBe(false);
  });
});

describe("fr39 create account card", () => {
  it("fr39_card_shows_title_fields_hint_submit_and_login_link", () => {
    const markup = html(<SignupCard values={FORM} errors={{}} passwordShown={false} />);
    expect(markup).toContain("max-w-[380px]");
    expect(markup).toContain(`<h1`);
    expect(markup.match(new RegExp(SIGNUP_TITLE, "g"))).toHaveLength(2); // title and submit
    expect(USERNAME_HINT).toBe("Letters and numbers. Must not be taken.");
    expect(markup).toContain(USERNAME_HINT);
    expect(markup).toContain(">Username</label>");
    expect(markup).toContain(">Password</label>");
    expect(markup).toContain(">Repeat password</label>");
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*w-full/);
    expect(markup).toContain(`href="${LOGIN_HREF}"`);
    expect(markup).toContain(">Log in</a>");
    expect(markup).toContain(">Show</button>");
    expect(markup).toMatch(/<form noValidate/i);
    for (const name of ["username", "password", "password_repeat"]) {
      expect(inputTag(markup, name)).not.toContain("aria-invalid");
    }
  });

  it("fr39_field_errors_render_as_input_error_with_aria_invalid", () => {
    const errors = { username: TAKEN, password_repeat: MISMATCH };
    const markup = html(<SignupCard values={FORM} errors={errors} passwordShown={false} />);

    const username = inputTag(markup, "username");
    expect(username).toContain('aria-invalid="true"');
    const describedBy = username.match(/aria-describedby="([^"]+)"/)![1].split(" ");
    expect(describedBy).toHaveLength(2); // the hint and the error
    const errorId = describedBy[1];
    expect(markup).toContain(`<p id="${errorId}"`);
    expect(markup).toContain(TAKEN);

    expect(inputTag(markup, "password")).not.toContain("aria-invalid");
    expect(inputTag(markup, "password_repeat")).toContain('aria-invalid="true"');
    expect(markup).toContain("don’t match.");
  });

  it("fr39_form_error_is_one_alert", () => {
    const markup = html(
      <SignupCard values={FORM} errors={{}} formError="Something went wrong. Try again." passwordShown={false} />,
    );
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(markup).toMatch(/role="alert"[^>]*border-error bg-error-tint/);
    expect(markup).toContain("Something went wrong. Try again.");
  });
});

describe("fr39 password show", () => {
  it("fr39_show_toggles_the_password_type", () => {
    const hidden = html(<PasswordInput id="p" name="password" shown={false} onShownChange={() => {}} />);
    expect(inputTag(hidden, "password")).toContain('type="password"');
    expect(hidden).toContain(">Show</button>");

    const shown = html(<PasswordInput id="p" name="password" shown onShownChange={() => {}} />);
    expect(inputTag(shown, "password")).toContain('type="text"');
    expect(shown).toContain(">Hide</button>");
  });

  it("fr39_show_button_flips_shown", () => {
    const onShownChange = vi.fn();
    const element = PasswordInput({ id: "p", shown: false, onShownChange });
    // The second child is the Show button; its click asks for the opposite state.
    const button = (element.props.children as { props: { onClick: () => void } }[])[1];
    button.props.onClick();
    expect(onShownChange).toHaveBeenCalledWith(true);

    const shownElement = PasswordInput({ id: "p", shown: true, onShownChange });
    (shownElement.props.children as { props: { onClick: () => void } }[])[1].props.onClick();
    expect(onShownChange).toHaveBeenLastCalledWith(false);
  });
});

describe("fr39 signup errors", () => {
  it("fr39_field_errors_are_read_from_validation_details", () => {
    const error = validationError([
      { field: "username", message: TAKEN },
      { field: "password_repeat", message: MISMATCH },
    ]);
    expect(fieldErrorsOf(error)).toEqual({ username: TAKEN, password_repeat: MISMATCH });
    expect(fieldErrorsOf(new ApiError(500, "internal", "x", [{ field: "username", message: "y" }]))).toEqual({});
    expect(fieldErrorsOf(validationError([{ field: "other", message: "z" }]))).toEqual({});
  });

  it("fr39_first_failing_field_is_in_form_order", () => {
    expect(firstFailingField({ password_repeat: MISMATCH, username: TAKEN })).toBe("username");
    expect(firstFailingField({ password_repeat: MISMATCH, password: "Use at least 4 characters." })).toBe("password");
    expect(firstFailingField({})).toBeNull();
  });

  it("fr39_focus_goes_to_the_first_failing_field", async () => {
    const error = validationError([
      { field: "password", message: "Use at least 4 characters." },
      { field: "password_repeat", message: MISMATCH },
    ]);
    const outcome = await runSignup(FORM, {
      post: async () => Promise.reject(error),
      invalidateSession: vi.fn(),
      navigate: vi.fn(),
    });
    expect(outcome).toEqual({
      kind: "field-errors",
      errors: { password: "Use at least 4 characters.", password_repeat: MISMATCH },
      focus: "password",
    });

    const focus = { username: vi.fn(), password: vi.fn(), password_repeat: vi.fn() };
    const refs = Object.fromEntries(
      Object.entries(focus).map(([field, fn]) => {
        const ref = createRef<HTMLInputElement>();
        (ref as { current: unknown }).current = { focus: fn };
        return [field, ref];
      }),
    ) as SignupFieldRefs;
    if (outcome.kind === "field-errors") focusField(refs, outcome.focus);
    expect(focus.password).toHaveBeenCalledOnce();
    expect(focus.username).not.toHaveBeenCalled();
  });

  it("fr39_other_errors_are_one_form_message", async () => {
    const navigate = vi.fn();
    const outcome = await runSignup(FORM, {
      post: async () => Promise.reject(new TypeError("network")),
      invalidateSession: vi.fn(),
      navigate,
    });
    expect(outcome).toEqual({ kind: "failed", message: "Something went wrong. Try again." });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("fr39_full_demo_limit_reached_is_one_form_message", async () => {
    const navigate = vi.fn();
    const invalidateSession = vi.fn();
    const outcome = await runSignup(FORM, {
      post: async () =>
        Promise.reject(new ApiError(409, "limit_reached", ACCOUNT_LIMIT, [{ limit: "max_accounts" }])),
      invalidateSession,
      navigate,
    });
    expect(outcome).toEqual({ kind: "failed", message: ACCOUNT_LIMIT });
    expect(navigate).not.toHaveBeenCalled();
    expect(invalidateSession).not.toHaveBeenCalled();
  });
});

describe("fr39 signup success", () => {
  it("fr39_success_invalidates_the_session_then_opens_saved_plans", async () => {
    const calls: string[] = [];
    const outcome = await runSignup(FORM, {
      post: async () => ({ user: "Kari7" }),
      invalidateSession: async () => {
        calls.push("invalidate");
      },
      navigate: () => calls.push("navigate"),
    });
    expect(outcome).toEqual({ kind: "signed-up", user: "Kari7" });
    expect(calls).toEqual(["invalidate", "navigate"]);
    expect(SESSION_KEY).toEqual(["session"]);
    expect(SAVED_PLANS_HREF).toBe("/plans");
  });

  it("fr39_post_signup_sends_json_once", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ user: "Kari7" }), { status: 201 }));
    await expect(postSignup(FORM, fetchImpl)).resolves.toEqual({ user: "Kari7" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method]).toEqual(["/api/auth/signup", "POST"]);
    expect(JSON.parse(init.body as string)).toEqual(FORM);
  });

  it("fr39_post_signup_rejects_with_the_envelope", async () => {
    const body = JSON.stringify({
      error: { code: "validation_failed", message: TAKEN, details: [{ field: "username", message: TAKEN }] },
    });
    const fetchImpl = vi.fn(async () => new Response(body, { status: 422 }));
    const error = await postSignup(FORM, fetchImpl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("validation_failed");
    expect(fieldErrorsOf(error as ApiError)).toEqual({ username: TAKEN });
  });
});

// ---- Story 9.2 (FR-40) ----

const WRONG_LOGIN = "Wrong username or password. Check both and try again.";
const AUTH_ON: Session = { user: null, feature_auth: true, feature_demo: false, max_upload_bytes: 1 };

function withQueryClient(node: ReactNode): string {
  return html(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);
}

describe("fr40 log in card", () => {
  it("fr40_card_shows_title_lead_fields_show_submit_and_create_account_link", () => {
    const markup = html(<LoginCard values={{ username: "", password: "" }} passwordShown={false} />);
    expect(markup).toContain("max-w-[380px]");
    expect(markup.match(new RegExp(`>${LOGIN_TITLE}<`, "g"))).toHaveLength(2); // title and submit
    expect(LOGIN_LEAD).toBe("Plans are shared by everyone who logs in.");
    expect(markup).toContain(LOGIN_LEAD);
    expect(markup).toContain(">Username</label>");
    expect(markup).toContain(">Password</label>");
    expect(markup).toContain(">Show</button>");
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*w-full/);
    expect(markup).toContain("No account?");
    expect(markup).toContain(`href="${SIGNUP_HREF}"`);
    expect(markup).toContain(">Create account</a>");
    expect(markup).not.toContain('role="alert"');
  });

  it("fr40_wrong_login_shows_one_alert_keeps_username_and_hides_the_cleared_password", () => {
    const before: LoginFormState = {
      values: { username: "Kari7", password: "nope" },
      formError: null,
      passwordShown: true,
    };
    const after = afterFailedLogin(before, { kind: "wrong-login", message: WRONG_LOGIN });
    expect(after).toEqual({ values: { username: "Kari7", password: "" }, formError: WRONG_LOGIN, passwordShown: false });

    const markup = html(
      <LoginCard values={after.values} formError={after.formError} passwordShown={after.passwordShown} />,
    );
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(markup).toMatch(/role="alert"[^>]*border-error bg-error-tint/);
    expect(markup).toContain(WRONG_LOGIN);
    // The alert sits above the fields.
    expect(markup.indexOf('role="alert"')).toBeLessThan(markup.indexOf('name="username"'));
    expect(inputTag(markup, "username")).toContain('value="Kari7"');
    expect(inputTag(markup, "password")).toContain('value=""');
    expect(inputTag(markup, "password")).toContain('type="password"');
  });

  it("fr40_wrong_login_focuses_the_password", () => {
    const focus = vi.fn();
    const ref = createRef<HTMLInputElement>();
    (ref as { current: unknown }).current = { focus };
    focusAfterFailedLogin({ kind: "wrong-login", message: WRONG_LOGIN }, ref);
    expect(focus).toHaveBeenCalledOnce();
    focusAfterFailedLogin({ kind: "failed", message: "x" }, ref);
    expect(focus).toHaveBeenCalledOnce();
  });

  it("fr40_other_errors_keep_both_fields", () => {
    const before: LoginFormState = { values: { username: "Kari7", password: "secret" }, formError: null, passwordShown: true };
    expect(afterFailedLogin(before, { kind: "failed", message: "Something went wrong. Try again." })).toEqual({
      ...before,
      formError: "Something went wrong. Try again.",
    });
  });
});

describe("fr40 log in requests", () => {
  it("fr40_unauthenticated_is_a_wrong_login_and_never_navigates", async () => {
    const navigate = vi.fn();
    const invalidateSession = vi.fn();
    const outcome = await runLogin(
      { username: "Kari7", password: "nope" },
      {
        post: async () => Promise.reject(new ApiError(401, "unauthenticated", WRONG_LOGIN)),
        invalidateSession,
        navigate,
      },
    );
    expect(outcome).toEqual({ kind: "wrong-login", message: WRONG_LOGIN });
    expect(navigate).not.toHaveBeenCalled();
    expect(invalidateSession).not.toHaveBeenCalled();

    const other = await runLogin(
      { username: "Kari7", password: "nope" },
      { post: async () => Promise.reject(new TypeError("network")), invalidateSession, navigate },
    );
    expect(other).toEqual({ kind: "failed", message: "Something went wrong. Try again." });
  });

  it("fr40_login_locked_is_one_alert_and_keeps_both_fields", async () => {
    const navigate = vi.fn();
    const invalidateSession = vi.fn();
    const outcome = await runLogin(
      { username: "Kari7", password: "secret" },
      {
        post: async () => Promise.reject(new ApiError(429, "login_locked", LOGIN_LOCKED)),
        invalidateSession,
        navigate,
      },
    );
    expect(outcome).toEqual({ kind: "failed", message: LOGIN_LOCKED });
    expect(navigate).not.toHaveBeenCalled();
    expect(invalidateSession).not.toHaveBeenCalled();

    const before: LoginFormState = { values: { username: "Kari7", password: "secret" }, formError: null, passwordShown: false };
    const after = afterFailedLogin(before, { kind: "failed", message: LOGIN_LOCKED });
    expect(after).toEqual({ ...before, formError: LOGIN_LOCKED });
    const markup = html(
      <LoginCard values={after.values} formError={after.formError} passwordShown={after.passwordShown} />,
    );
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(markup).toContain(LOGIN_LOCKED);
    expect(inputTag(markup, "username")).toContain('value="Kari7"');
    expect(inputTag(markup, "password")).toContain('value="secret"');
  });

  it("fr40_success_awaits_the_session_refetch_then_opens_saved_plans", async () => {
    const calls: string[] = [];
    const outcome = await runLogin(
      { username: "kari7", password: "secret" },
      {
        post: async () => ({ user: "Kari7" }),
        invalidateSession: async () => {
          await Promise.resolve();
          calls.push("invalidate");
        },
        navigate: () => calls.push("navigate"),
      },
    );
    expect(outcome).toEqual({ kind: "logged-in", user: "Kari7" });
    expect(calls).toEqual(["invalidate", "navigate"]);
  });

  it("fr40_post_login_and_logout_send_json_once", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ user: "Kari7" }), { status: 200 }));
    await expect(postLogin({ username: "kari7", password: "secret" }, fetchImpl)).resolves.toEqual({ user: "Kari7" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method]).toEqual(["/api/auth/login", "POST"]);

    const logoutFetch = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(postLogout(logoutFetch)).resolves.toBeUndefined();
    expect(logoutFetch).toHaveBeenCalledOnce();
    expect((logoutFetch.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe("/api/auth/logout");
  });
});

describe("fr40 page guard", () => {
  const user: Session = { ...AUTH_ON, user: "Kari7" };

  it("fr40_guard_decides_per_path_and_session", () => {
    expect(guardDecision("/plans", { isPending: true })).toBe("wait");
    expect(guardDecision("/plans", { isPending: false, data: AUTH_ON })).toBe("redirect");
    expect(guardDecision("/", { isPending: false, data: AUTH_ON })).toBe("redirect");
    expect(guardDecision("/plans", { isPending: false, data: user })).toBe("render");
    expect(guardDecision("/plans", { isPending: false, data: { ...AUTH_ON, feature_auth: false } })).toBe("render");
    expect(guardDecision("/plans", { isPending: false, data: undefined })).toBe("render"); // session failed
    for (const path of [LOGIN_HREF, SIGNUP_HREF]) {
      expect(guardDecision(path, { isPending: true })).toBe("render");
      expect(guardDecision(path, { isPending: false, data: AUTH_ON })).toBe("render");
    }
  });

  it("fr40_guard_replaces_to_login_only_on_redirect", () => {
    const router = { replace: vi.fn() };
    followGuard("render", router);
    followGuard("wait", router);
    expect(router.replace).not.toHaveBeenCalled();
    followGuard("redirect", router);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(LOGIN_HREF);
  });

  it("fr40_guard_renders_nothing_without_a_session_and_children_otherwise", () => {
    const app = (
      <AuthGuard>
        <p>app</p>
      </AuthGuard>
    );
    nav.session = { isPending: true, data: undefined };
    expect(html(app)).toBe("");
    nav.session = { isPending: false, data: AUTH_ON };
    expect(html(app)).toBe("");
    nav.session = { isPending: false, data: user };
    expect(html(app)).toBe("<p>app</p>");
    nav.session = { isPending: false, data: { ...AUTH_ON, feature_auth: false } };
    expect(html(app)).toBe("<p>app</p>");
    nav.session = { isPending: false, data: AUTH_ON };
    nav.pathname = LOGIN_HREF;
    expect(html(app)).toBe("<p>app</p>");
  });
});

describe("fr40 log out", () => {
  it("fr40_logout_clears_the_cache_marks_logged_out_then_opens_login", async () => {
    const calls: string[] = [];
    const outcome = await runLogout({
      post: async () => {
        calls.push("post");
      },
      clearCache: () => calls.push("clear"),
      setLoggedOut: () => calls.push("logged-out"),
      navigate: () => calls.push("navigate"),
    });
    expect(outcome).toEqual({ kind: "logged-out" });
    expect(calls).toEqual(["post", "clear", "logged-out", "navigate"]);
  });

  it("fr40_failed_logout_keeps_the_session", async () => {
    const navigate = vi.fn();
    const clearCache = vi.fn();
    const outcome = await runLogout({
      post: async () => Promise.reject(new TypeError("network")),
      clearCache,
      setLoggedOut: vi.fn(),
      navigate,
    });
    expect(outcome).toEqual({ kind: "failed", message: "Something went wrong. Try again." });
    expect(clearCache).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("fr40_avatar_initials_are_the_first_two_letters_upper_cased", () => {
    expect(avatarInitials("demo")).toBe("DE");
    expect(avatarInitials("a")).toBe("A");
    expect(avatarInitials("Kari7")).toBe("KA");
    // A capital that expands ("ß" to "SS") still leaves two letters.
    expect(avatarInitials("ßa")).toBe("SS");
    // By code point: a letter outside the BMP is one character, not two halves.
    expect(avatarInitials("\u{1D49C}bc")).toBe("\u{1D49C}B");
  });

  it("fr40_user_menu_shows_the_ink_avatar_only_with_auth_and_a_user", () => {
    nav.session = { isPending: false, data: { ...AUTH_ON, user: "Kari7" } };
    const markup = withQueryClient(<UserMenu />);
    expect(markup).toContain('aria-label="User menu"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toMatch(/class="[^"]*size-\[34px\][^"]*rounded-full[^"]*bg-ink[^"]*text-white[^"]*"[^>]*>KA<\/button>/);
    expect(markup).not.toContain("Log out");
    nav.session = { isPending: false, data: AUTH_ON };
    expect(withQueryClient(<UserMenu />)).toBe("");
    nav.session = { isPending: false, data: { ...AUTH_ON, user: "Kari7", feature_auth: false } };
    expect(withQueryClient(<UserMenu />)).toBe("");
  });

  it("fr40_toolbar_puts_the_account_slot_at_the_right_end_off_auth_pages", () => {
    const account = <button type="button">Account</button>;
    nav.pathname = SAVED_PLANS_HREF;
    expect(withQueryClient(<Toolbar account={account} />)).toMatch(/ml-auto[^>]*><button type="button">Account/);
    nav.pathname = LOGIN_HREF;
    expect(withQueryClient(<Toolbar account={account} />)).not.toContain("Account");
  });
});

describe("fr40 return after Log in", () => {
  it("fr40_login_success_opens_the_restored_page_else_saved_plans", () => {
    const expiry = new SessionExpiry();
    expect(afterLoginHref(expiry)).toBe(SAVED_PLANS_HREF);
    void expiry.expire("/plans/p1/locations?aisle=A");
    expect(afterLoginHref(expiry)).toBe("/plans/p1/locations?aisle=A");
    expect(afterLoginHref(expiry)).toBe(SAVED_PLANS_HREF);
  });
});
