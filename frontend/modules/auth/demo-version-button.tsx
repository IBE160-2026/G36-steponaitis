"use client";

// Demo version on the demo front page (Story 9.6, FR-50): a tertiary button with a play glyph that
// logs in as `demo` with no password, as the Log in page's Demo version does (Story 9.5): the
// session is refreshed, then the saved-plans list opens. Disabled with a reason while the request
// runs; a failure is a toast with the server's message and the button works again. Reaches the
// front page as a slot from app/page.tsx, so modules/front-page never imports this module.

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { showToast } from "@/components/common/toast";
import { SESSION_KEY } from "@/lib/api/session";

import { afterLoginHref, DEMO_VERSION_LABEL, type DemoEffects, type LoginOutcome, runDemo } from "./api";

export const DEMO_VERSION_BUSY_REASON = "Logging in.";

export type DemoVersionButtonEffects = DemoEffects & {
  /** Disable (true) or re-enable (false) the button. */
  setBusy: (busy: boolean) => void;
  /** Show one message (a toast). */
  notify: (message: string) => void;
};

/**
 * One Demo version press: busy while the request runs. On success the button stays busy while the
 * saved-plans list opens; a failure re-enables it and shows the message.
 */
export async function pressDemoVersion(effects: DemoVersionButtonEffects): Promise<LoginOutcome> {
  effects.setBusy(true);
  const outcome = await runDemo(effects);
  if (outcome.kind !== "logged-in") {
    effects.setBusy(false);
    effects.notify(outcome.message);
  }
  return outcome;
}

/** The button itself, without state. */
export function DemoVersionButtonView({
  busy = false,
  className,
  onClick,
}: {
  busy?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="tertiary"
      className={className}
      disabledReason={busy ? DEMO_VERSION_BUSY_REASON : undefined}
      onClick={onClick}
    >
      <Icon name="play" />
      {DEMO_VERSION_LABEL}
    </Button>
  );
}

export function DemoVersionButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function press() {
    if (inFlight.current) return;
    inFlight.current = true;
    const outcome = await pressDemoVersion({
      invalidateSession: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
      // Replace: `/` also replaces itself with the saved-plans list once the session has a user.
      navigate: () => router.replace(afterLoginHref()),
      setBusy,
      notify: (message) => showToast(message),
    });
    if (outcome.kind !== "logged-in") inFlight.current = false;
  }

  return <DemoVersionButtonView busy={busy} className={className} onClick={() => void press()} />;
}
