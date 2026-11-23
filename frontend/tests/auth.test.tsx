import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { SESSION_KEY } from "@/lib/api/session";
import { isAuthPath, LOGIN_HREF, SAVED_PLANS_HREF, SIGNUP_HREF } from "@/lib/view-state/urls";
import {
  fieldErrorsOf,
  firstFailingField,
  postSignup,
  runSignup,
  SIGNUP_TITLE,
  type SignupForm,
  USERNAME_HINT,
} from "@/modules/auth/api";
import { PasswordInput } from "@/modules/auth/password-input";
import { focusField, SignupCard, type SignupFieldRefs } from "@/modules/auth/signup-page";

// Story 9.1: Create account (FR-39, UX-DR53).

const html = renderToStaticMarkup;
const FORM: SignupForm = { username: "Kari7", password: "secret", password_repeat: "secret" };
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
    expect(markup).toContain('role="alert"');
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
