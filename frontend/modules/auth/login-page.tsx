"use client";

// Log in (Story 9.2, FR-40, UX-DR53): the 380px card with "Log in", the lead, Username, Password
// with Show, a full-width primary submit and a link to Create account. A wrong login shows one
// pale-red alert with the server's message, keeps the username and clears, hides and focuses the
// password. On success the session is refreshed and the saved-plans list opens. With FEATURE_AUTH
// off the page does not exist. With FEATURE_DEMO on, a full-width tertiary Demo version button with a
// play glyph sits under an "or" rule and logs in as `demo` (Story 9.5, FR-50).

import { useQueryClient } from "@tanstack/react-query";
import { notFound, useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useId, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { Input } from "@/components/common/input";
import { SESSION_KEY, useSession } from "@/lib/api/session";
import { SIGNUP_HREF } from "@/lib/view-state/urls";

import {
  afterLoginHref,
  DEMO_VERSION_LABEL,
  LOGIN_LEAD,
  LOGIN_TITLE,
  type LoginForm,
  type LoginOutcome,
  runDemo,
  runLogin,
  SIGNUP_TITLE,
} from "./api";
import { AuthAlert, AuthCard } from "./auth-card";
import { PasswordInput } from "./password-input";

const SUBMITTING_REASON = "Logging in.";

export type LoginCardProps = {
  values: LoginForm;
  /** One message for the whole form: a wrong login or another error. */
  formError?: string | null;
  passwordShown: boolean;
  /** A Log in or Demo version request is in flight: both buttons are disabled. */
  busy?: boolean;
  /** FEATURE_DEMO is on: show the "or" rule and Demo version under the link row. */
  demo?: boolean;
  usernameRef?: RefObject<HTMLInputElement | null>;
  passwordRef?: RefObject<HTMLInputElement | null>;
  onChange?: (field: keyof LoginForm, value: string) => void;
  onPasswordShownChange?: (shown: boolean) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  onDemo?: () => void;
};

/** The "or" rule and the full-width Demo version button under the Log in card's link row. */
function DemoFooter({ busy, onDemo }: { busy: boolean; onDemo: () => void }) {
  return (
    <div className="flex flex-col gap-4" data-demo-footer="">
      <div className="flex items-center gap-3 text-ink-muted type-caption">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>or</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="tertiary"
        className="w-full"
        disabledReason={busy ? SUBMITTING_REASON : undefined}
        onClick={onDemo}
      >
        <Icon name="play" />
        {DEMO_VERSION_LABEL}
      </Button>
    </div>
  );
}

/** The card itself, without state: the page owns the values, the alert and Show. */
export function LoginCard({
  values,
  formError = null,
  passwordShown,
  busy = false,
  demo = false,
  usernameRef,
  passwordRef,
  onChange = () => {},
  onPasswordShownChange = () => {},
  onSubmit,
  onDemo = () => {},
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
      footer={demo ? <DemoFooter busy={busy} onDemo={onDemo} /> : undefined}
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

  const effects = {
    invalidateSession: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
    navigate: (user: string) => router.push(afterLoginHref(user)),
  };

  /** Log in or Demo version: one request at a time, both buttons disabled while it runs. */
  async function send(request: () => Promise<LoginOutcome>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setForm((current) => ({ ...current, formError: null }));
    const outcome = await request();
    if (outcome.kind === "logged-in") return; // Stays busy while the next page opens.
    inFlight.current = false;
    setBusy(false);
    setForm((current) => afterFailedLogin(current, outcome));
    focusAfterFailedLogin(outcome, passwordRef);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(() => runLogin(form.values, effects));
  }

  if (session.isPending) return null;

  return (
    <LoginCard
      values={form.values}
      formError={form.formError}
      passwordShown={form.passwordShown}
      busy={busy}
      demo={session.data?.feature_demo === true}
      usernameRef={usernameRef}
      passwordRef={passwordRef}
      onChange={(field, value) =>
        setForm((current) => ({ ...current, values: { ...current.values, [field]: value } }))
      }
      onPasswordShownChange={(shown) => setForm((current) => ({ ...current, passwordShown: shown }))}
      onSubmit={submit}
      onDemo={() => void send(() => runDemo(effects))}
    />
  );
}
