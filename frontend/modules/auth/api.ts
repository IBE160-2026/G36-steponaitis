// Create account (Story 9.1, FR-39, UX-DR53): POST /api/auth/signup and what the page does with
// its answer. The server checks every field and writes the copy; the page only shows each
// field's message, focuses the first failing field, and on success refreshes the session and
// opens the saved-plans list.

import { ApiError, internalError, parseErrorBody } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type SignupForm = components["schemas"]["SignupRequest"];
export type SignupResponse = components["schemas"]["SignupResponse"];

export type SignupField = keyof SignupForm;

/** The form's fields in form order: the first failing one gets focus. */
export const SIGNUP_FIELDS: readonly SignupField[] = ["username", "password", "password_repeat"];

export type SignupFieldErrors = Partial<Record<SignupField, string>>;

export const SIGNUP_TITLE = "Create account";
export const USERNAME_HINT = "Letters and numbers. Must not be taken.";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** POST the form; resolves with the new username, rejects with an `ApiError`. Never retried. */
export async function postSignup(form: SignupForm, fetchImpl: FetchLike = fetch): Promise<SignupResponse> {
  let response: Response;
  try {
    response = await fetchImpl("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  } catch {
    throw internalError();
  }
  const text = await response.text();
  if (!response.ok) throw parseErrorBody(response.status, text);
  try {
    return JSON.parse(text) as SignupResponse;
  } catch {
    throw internalError(response.status);
  }
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

export type SignupOutcome =
  | { kind: "signed-up"; user: string }
  | { kind: "field-errors"; errors: SignupFieldErrors; focus: SignupField }
  | { kind: "failed"; message: string };

export type SignupEffects = {
  post?: (form: SignupForm) => Promise<SignupResponse>;
  /** Refetch GET /api/session so the app knows the new user. */
  invalidateSession: () => Promise<unknown>;
  /** Open the saved-plans list. */
  navigate: () => void;
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
  effects.navigate();
  return { kind: "signed-up", user: created.user };
}
