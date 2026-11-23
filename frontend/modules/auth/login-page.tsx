"use client";

// Log in (Story 9.2, FR-40, UX-DR53): the 380px card with "Log in", the lead, Username, Password
// with Show, a full-width primary submit and a link to Create account. A wrong login shows one
// pale-red alert with the server's message, keeps the username and clears, hides and focuses the
// password. On success the session is refreshed and the saved-plans list opens. With FEATURE_AUTH
// off the page does not exist.

import { useQueryClient } from "@tanstack/react-query";
import { notFound, useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useId, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { SESSION_KEY, useSession } from "@/lib/api/session";
import { SAVED_PLANS_HREF, SIGNUP_HREF } from "@/lib/view-state/urls";

import { LOGIN_LEAD, LOGIN_TITLE, type LoginForm, type LoginOutcome, runLogin, SIGNUP_TITLE } from "./api";
import { AuthAlert, AuthCard } from "./auth-card";
import { PasswordInput } from "./password-input";

const SUBMITTING_REASON = "Logging in.";

export type LoginCardProps = {
  values: LoginForm;
  /** One message for the whole form: a wrong login or another error. */
  formError?: string | null;
  passwordShown: boolean;
  busy?: boolean;
  usernameRef?: RefObject<HTMLInputElement | null>;
  passwordRef?: RefObject<HTMLInputElement | null>;
  onChange?: (field: keyof LoginForm, value: string) => void;
  onPasswordShownChange?: (shown: boolean) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

/** The card itself, without state: the page owns the values, the alert and Show. */
export function LoginCard({
  values,
  formError = null,
  passwordShown,
  busy = false,
  usernameRef,
  passwordRef,
  onChange = () => {},
  onPasswordShownChange = () => {},
  onSubmit,
}: LoginCardProps) {
  const id = useId();
  const usernameId = `${id}-username`;
  const passwordId = `${id}-password`;

  return (
    <AuthCard
      title={LOGIN_TITLE}
      lead={LOGIN_LEAD}
      linkPrompt="No account?"
      linkHref={SIGNUP_HREF}
      linkLabel={SIGNUP_TITLE}
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {formError && <AuthAlert message={formError} />}
        <div className="flex flex-col gap-1">
          <label htmlFor={usernameId} className="type-body-strong text-ink">
            Username
          </label>
          <Input
            ref={usernameRef}
            id={usernameId}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="h-[40px]!"
            value={values.username}
            onChange={(event) => onChange("username", event.currentTarget.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={passwordId} className="type-body-strong text-ink">
            Password
          </label>
          <PasswordInput
            ref={passwordRef}
            id={passwordId}
            name="password"
            autoComplete="current-password"
            value={values.password}
            shown={passwordShown}
            onShownChange={onPasswordShownChange}
            onChange={(event) => onChange("password", event.currentTarget.value)}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabledReason={busy ? SUBMITTING_REASON : undefined}
        >
          {LOGIN_TITLE}
        </Button>
      </form>
    </AuthCard>
  );
}

const EMPTY_FORM: LoginForm = { username: "", password: "" };

export type LoginFormState = { values: LoginForm; formError: string | null; passwordShown: boolean };

/**
 * The form after a failed login: one alert with the server's message. A wrong login keeps the
 * username and clears and hides the password (then focused); any other error keeps
 * both fields as typed.
 */
export function afterFailedLogin(
  state: LoginFormState,
  outcome: Exclude<LoginOutcome, { kind: "logged-in" }>,
): LoginFormState {
  if (outcome.kind === "wrong-login") {
    return { values: { ...state.values, password: "" }, formError: outcome.message, passwordShown: false };
  }
  return { ...state, formError: outcome.message };
}

/** Focus the password after a wrong login (the field was just cleared). */
export function focusAfterFailedLogin(
  outcome: Exclude<LoginOutcome, { kind: "logged-in" }>,
  passwordRef: RefObject<HTMLInputElement | null>,
): void {
  if (outcome.kind === "wrong-login") passwordRef.current?.focus();
}

export function LoginPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState<LoginFormState>({ values: EMPTY_FORM, formError: null, passwordShown: false });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // As on Create account: the flag comes from the backend at runtime (AD-10), nothing renders
  // until the session answers, and a failed session read still shows the form.
  if (session.data && !session.data.feature_auth) notFound();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setForm((current) => ({ ...current, formError: null }));
    const outcome = await runLogin(form.values, {
      invalidateSession: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
      navigate: () => router.push(SAVED_PLANS_HREF),
    });
    if (outcome.kind === "logged-in") return; // Stays busy while the saved-plans list opens.
    inFlight.current = false;
    setBusy(false);
    setForm((current) => afterFailedLogin(current, outcome));
    focusAfterFailedLogin(outcome, passwordRef);
  }

  if (session.isPending) return null;

  return (
    <LoginCard
      values={form.values}
      formError={form.formError}
      passwordShown={form.passwordShown}
      busy={busy}
      usernameRef={usernameRef}
      passwordRef={passwordRef}
      onChange={(field, value) =>
        setForm((current) => ({ ...current, values: { ...current.values, [field]: value } }))
      }
      onPasswordShownChange={(shown) => setForm((current) => ({ ...current, passwordShown: shown }))}
      onSubmit={submit}
    />
  );
}
