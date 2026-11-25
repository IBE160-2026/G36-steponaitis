// Create account (Story 9.1, FR-39) and Log in / Log out (Story 9.2, FR-40), UX-DR53: the
// /api/auth/* POSTs and what the pages do with their answers. The server checks every field and
// writes the copy; the pages only show it. Create account focuses the first failing field; a wrong
// login clears and focuses the password. Success refreshes the session and opens the saved-plans
// list, or the page that was open when the session ended (Story 9.3); Log out clears the cached
// data and opens Log in, or the demo front page when FEATURE_DEMO is on (Story 9.6). Demo version
// (Story 9.5, FR-50) logs in as `demo` with no password.

import { ApiError, internalError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { type FetchLike, sendJson } from "@/lib/api/send-json";
import type { Session } from "@/lib/api/session";
import { sessionExpiry } from "@/lib/api/session-expiry";
import { FRONT_PAGE_HREF, LOGIN_HREF, SAVED_PLANS_HREF } from "@/lib/view-state/urls";

export type SignupForm = components["schemas"]["SignupRequest"];
export type SignupResponse = components["schemas"]["SignupResponse"];
export type LoginForm = components["schemas"]["LoginRequest"];
export type LoginResponse = components["schemas"]["LoginResponse"];

export type SignupField = keyof SignupForm;

/** The form's fields in form order: the first failing one gets focus. */
export const SIGNUP_FIELDS: readonly SignupField[] = ["username", "password", "password_repeat"];

export type SignupFieldErrors = Partial<Record<SignupField, string>>;

export const SIGNUP_TITLE = "Create account";
export const USERNAME_HINT = "Letters and numbers. Must not be taken.";
export const LOGIN_TITLE = "Log in";
export const LOGIN_LEAD = "Plans are shared by everyone who logs in.";
export const LOGOUT_LABEL = "Log out";
export const DEMO_VERSION_LABEL = "Demo version";

/** POST the form; resolves with the new username, rejects with an `ApiError`. Never retried. */
export function postSignup(form: SignupForm, fetchImpl: FetchLike = fetch): Promise<SignupResponse> {
  return sendJson<SignupResponse>("POST", "/api/auth/signup", form, fetchImpl);
}

/** POST the credentials; resolves with the stored username, rejects with an `ApiError`. */
export function postLogin(form: LoginForm, fetchImpl: FetchLike = fetch): Promise<LoginResponse> {
  return sendJson<LoginResponse>("POST", "/api/auth/login", form, fetchImpl);
}

/** POST /api/auth/demo (FR-50): log in as `demo` with no password; rejects with an `ApiError`. */
export function postDemo(fetchImpl: FetchLike = fetch): Promise<LoginResponse> {
  return sendJson<LoginResponse>("POST", "/api/auth/demo", {}, fetchImpl);
}

/** POST /api/auth/logout: the server clears the session cookie (204). */
export async function postLogout(fetchImpl: FetchLike = fetch): Promise<void> {
  await sendJson<undefined>("POST", "/api/auth/logout", {}, fetchImpl);
}

function isSignupField(value: unknown): value is SignupField {
  return typeof value === "string" && (SIGNUP_FIELDS as readonly string[]).includes(value);
}

/** The per-field messages of a `validation_failed` error; empty for any other error. */
export function fieldErrorsOf(error: ApiError): SignupFieldErrors {
  const errors: SignupFieldErrors = {};
  if (error.code !== "validation_failed") return errors;
  for (const detail of error.details) {
    const { field, message } = detail;
    if (isSignupField(field) && typeof message === "string" && errors[field] === undefined) {
      errors[field] = message;
    }
  }
  return errors;
}

/** The first field in form order that has an error, or null. */
export function firstFailingField(errors: SignupFieldErrors): SignupField | null {
  return SIGNUP_FIELDS.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Where a successful Log in or Create account goes: the page that was open when the session ended,
 * else the saved-plans list. Restoring also lets every command held for the login go (Story 9.3):
 * it is sent again only when `user` (who just logged in) is the user whose session ended, and
 * dropped otherwise (Story 16.0). Null (unknown, or a new account) always drops.
 */
export function afterLoginHref(
  user: string | null,
  expiry: { restore: (user: string | null) => string | null } = sessionExpiry,
): string {
  return expiry.restore(user) ?? SAVED_PLANS_HREF;
}

export type SignupOutcome =
  | { kind: "signed-up"; user: string }
  | { kind: "field-errors"; errors: SignupFieldErrors; focus: SignupField }
  | { kind: "failed"; message: string };

export type SignupEffects = {
  post?: (form: SignupForm) => Promise<SignupResponse>;
  /** Refetch GET /api/session so the app knows the new user. */
  invalidateSession: () => Promise<unknown>;
  /** Open the next page (`afterLoginHref`) as `user`, who just logged in or signed up. */
  navigate: (user: string) => void;
};

/**
 * Send the form once. On success the session is refreshed, then the saved-plans list opens. A
 * `validation_failed` answer names the fields to mark and the first one to focus; any other error
 * is one message for the whole form.
 */
export async function runSignup(form: SignupForm, effects: SignupEffects): Promise<SignupOutcome> {
  const post = effects.post ?? ((body: SignupForm) => postSignup(body));
  let created: SignupResponse;
  try {
    created = await post(form);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : internalError();
    const errors = fieldErrorsOf(apiError);
    const focus = firstFailingField(errors);
    if (focus !== null) return { kind: "field-errors", errors, focus };
    return { kind: "failed", message: apiError.message };
  }
  await effects.invalidateSession();
  effects.navigate(created.user);
  return { kind: "signed-up", user: created.user };
}

export type LoginOutcome =
  | { kind: "logged-in"; user: string }
  /** `unauthenticated`: the page keeps the username and clears, hides and focuses the password. */
  | { kind: "wrong-login"; message: string }
  | { kind: "failed"; message: string };

export type LoginEffects = {
  post?: (form: LoginForm) => Promise<LoginResponse>;
  /** Refetch GET /api/session (awaited) so the guard knows the user before the list opens. */
  invalidateSession: () => Promise<unknown>;
  /** Open the next page (`afterLoginHref`) as `user`, who just logged in or signed up. */
  navigate: (user: string) => void;
};

/** Send the credentials once; on success refresh the session, then open the saved-plans list. */
export async function runLogin(form: LoginForm, effects: LoginEffects): Promise<LoginOutcome> {
  const post = effects.post ?? ((body: LoginForm) => postLogin(body));
  let loggedIn: LoginResponse;
  try {
    loggedIn = await post(form);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : internalError();
    if (apiError.code === "unauthenticated") return { kind: "wrong-login", message: apiError.message };
    return { kind: "failed", message: apiError.message };
  }
  await effects.invalidateSession();
  effects.navigate(loggedIn.user);
  return { kind: "logged-in", user: loggedIn.user };
}

export type DemoEffects = Omit<LoginEffects, "post"> & { post?: () => Promise<LoginResponse> };

/**
 * Demo version (FR-50): POST once; on success refresh the session, then open the same page as a
 * successful Log in. Any error is one message for the whole form.
 */
export async function runDemo(effects: DemoEffects): Promise<LoginOutcome> {
  const post = effects.post ?? (() => postDemo());
  let loggedIn: LoginResponse;
  try {
    loggedIn = await post();
  } catch (error) {
    return { kind: "failed", message: (error instanceof ApiError ? error : internalError()).message };
  }
  await effects.invalidateSession();
  effects.navigate(loggedIn.user);
  return { kind: "logged-in", user: loggedIn.user };
}

/**
 * Where Log out goes (FR-40, Story 9.6): the demo front page when FEATURE_DEMO is on, else Log in.
 * An unknown session (a failed read) counts as demo off.
 */
export function logoutHref(session: Pick<Session, "feature_demo"> | null | undefined): string {
  return session?.feature_demo === true ? FRONT_PAGE_HREF : LOGIN_HREF;
}

export type LogoutOutcome = { kind: "logged-out" } | { kind: "failed"; message: string };

export type LogoutEffects = {
  post?: () => Promise<void>;
  /** Drop every cached query, so no plan data outlives the session. */
  clearCache: () => void;
  /** Set the cached session to logged out (the guard then hides the app). */
  setLoggedOut: () => void;
  /** Open Log in, or the demo front page with FEATURE_DEMO on (`logoutHref`). */
  navigate: () => void;
};

/**
 * Log out: POST, then clear the cache, mark the session logged out and open Log in, or the demo
 * front page with FEATURE_DEMO on (`logoutHref`).
 */
export async function runLogout(effects: LogoutEffects): Promise<LogoutOutcome> {
  const post = effects.post ?? (() => postLogout());
  try {
    await post();
  } catch (error) {
    return { kind: "failed", message: (error instanceof ApiError ? error : internalError()).message };
  }
  effects.clearCache();
  effects.setLoggedOut();
  effects.navigate();
  return { kind: "logged-out" };
}
