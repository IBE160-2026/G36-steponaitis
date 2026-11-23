"use client";

// Create account (Story 9.1, FR-39, UX-DR53): a 380px card with Username (and its hint), Password
// with Show, Repeat password, a full-width primary submit and a link to Log in. The server checks
// the fields on submit; each failing field shows its InputError and the first one gets focus. On
// success the session is refreshed and the saved-plans list opens. With FEATURE_AUTH off the page
// does not exist.

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useId, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { Input, InputError } from "@/components/common/input";
import { SESSION_KEY, useSession } from "@/lib/api/session";
import { LOGIN_HREF, SAVED_PLANS_HREF } from "@/lib/view-state/urls";

import {
  runSignup,
  SIGNUP_TITLE,
  type SignupField,
  type SignupFieldErrors,
  type SignupForm,
  USERNAME_HINT,
} from "./api";
import { PasswordInput } from "./password-input";

const SUBMITTING_REASON = "Creating the account.";

export type SignupFieldRefs = Record<SignupField, RefObject<HTMLInputElement | null>>;

/** Move focus to `field`'s input (the first failing field after a rejected submit). */
export function focusField(refs: SignupFieldRefs, field: SignupField): void {
  refs[field].current?.focus();
}

export type SignupCardProps = {
  values: SignupForm;
  errors: SignupFieldErrors;
  /** One message for the whole form (an error that names no field). */
  formError?: string | null;
  passwordShown: boolean;
  busy?: boolean;
  usernameRef?: RefObject<HTMLInputElement | null>;
  passwordRef?: RefObject<HTMLInputElement | null>;
  passwordRepeatRef?: RefObject<HTMLInputElement | null>;
  onChange?: (field: SignupField, value: string) => void;
  onPasswordShownChange?: (shown: boolean) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

/** The card itself, without state: the page owns the values, errors and Show. */
export function SignupCard({
  values,
  errors,
  formError = null,
  passwordShown,
  busy = false,
  usernameRef,
  passwordRef,
  passwordRepeatRef,
  onChange = () => {},
  onPasswordShownChange = () => {},
  onSubmit,
}: SignupCardProps) {
  const id = useId();
  const ids = {
    username: `${id}-username`,
    password: `${id}-password`,
    password_repeat: `${id}-password-repeat`,
  } satisfies Record<SignupField, string>;
  const errorId = (field: SignupField) => (errors[field] ? `${ids[field]}-error` : undefined);
  const hintId = `${id}-username-hint`;
  const titleId = `${id}-title`;

  return (
    <div className="flex justify-center px-page-gutter py-10">
      <section
        aria-labelledby={titleId}
        className="flex w-full max-w-[380px] flex-col gap-5 rounded-lg border border-border bg-surface p-6"
      >
        <h1 id={titleId} className="type-page-title text-ink">
          {SIGNUP_TITLE}
        </h1>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.username} className="type-body-strong text-ink">
              Username
            </label>
            <Input
              ref={usernameRef}
              id={ids.username}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="h-[40px]!"
              value={values.username}
              aria-describedby={hintId}
              errorId={errorId("username")}
              onChange={(event) => onChange("username", event.currentTarget.value)}
            />
            <p id={hintId} className="text-ink-secondary type-caption">
              {USERNAME_HINT}
            </p>
            {errors.username && <InputError id={`${ids.username}-error`}>{errors.username}</InputError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.password} className="type-body-strong text-ink">
              Password
            </label>
            <PasswordInput
              ref={passwordRef}
              id={ids.password}
              name="password"
              autoComplete="new-password"
              value={values.password}
              shown={passwordShown}
              onShownChange={onPasswordShownChange}
              errorId={errorId("password")}
              onChange={(event) => onChange("password", event.currentTarget.value)}
            />
            {errors.password && <InputError id={`${ids.password}-error`}>{errors.password}</InputError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.password_repeat} className="type-body-strong text-ink">
              Repeat password
            </label>
            <Input
              ref={passwordRepeatRef}
              id={ids.password_repeat}
              name="password_repeat"
              type="password"
              autoComplete="new-password"
              className="h-[40px]!"
              value={values.password_repeat}
              errorId={errorId("password_repeat")}
              onChange={(event) => onChange("password_repeat", event.currentTarget.value)}
            />
            {errors.password_repeat && (
              <InputError id={`${ids.password_repeat}-error`}>{errors.password_repeat}</InputError>
            )}
          </div>
          {formError && (
            <p role="alert" className="flex items-start gap-2 text-ink type-body">
              <Icon name="warning" size={16} className="mt-px text-error" />
              <span>{formError}</span>
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabledReason={busy ? SUBMITTING_REASON : undefined}
          >
            {SIGNUP_TITLE}
          </Button>
        </form>
        <p className="text-ink-secondary type-body">
          Have an account?{" "}
          <Link href={LOGIN_HREF} className="text-ink underline underline-offset-2">
            Log in
          </Link>
        </p>
      </section>
    </div>
  );
}

const EMPTY_FORM: SignupForm = { username: "", password: "", password_repeat: "" };

export function SignupPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [values, setValues] = useState<SignupForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<SignupFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordShown, setPasswordShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordRepeatRef = useRef<HTMLInputElement>(null);

  // The flag comes from the backend at runtime (AD-10): with auth off there is no Create account.
  // Nothing renders until the session answers, so the form never flashes before a 404; a failed
  // session read still shows the form (the submit then reports any error).
  if (session.data && !session.data.feature_auth) notFound();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFormError(null);
    const outcome = await runSignup(values, {
      invalidateSession: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
      navigate: () => router.push(SAVED_PLANS_HREF),
    });
    if (outcome.kind === "signed-up") return; // Stays busy while the saved-plans list opens.
    inFlight.current = false;
    setBusy(false);
    if (outcome.kind === "field-errors") {
      setErrors(outcome.errors);
      focusField(
        { username: usernameRef, password: passwordRef, password_repeat: passwordRepeatRef },
        outcome.focus,
      );
    } else {
      setErrors({});
      setFormError(outcome.message);
    }
  }

  if (session.isPending) return null;

  return (
    <SignupCard
      values={values}
      errors={errors}
      formError={formError}
      passwordShown={passwordShown}
      busy={busy}
      usernameRef={usernameRef}
      passwordRef={passwordRef}
      passwordRepeatRef={passwordRepeatRef}
      onChange={(field, value) => {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
        setFormError(null);
      }}
      onPasswordShownChange={setPasswordShown}
      onSubmit={submit}
    />
  );
}
