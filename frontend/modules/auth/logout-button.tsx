"use client";

// Log out (Story 9.2, FR-40): a toolbar button, shown only with FEATURE_AUTH on and a user. It
// posts logout, clears every cached query, marks the session logged out and opens Log in. Passed
// into the toolbar as a slot by app/layout.tsx (Story 9.3 moves it into the avatar user menu).

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { showToast } from "@/components/common/toast";
import { type Session, SESSION_KEY, useSession } from "@/lib/api/session";
import { LOGIN_HREF } from "@/lib/view-state/urls";

import { LOGOUT_LABEL, runLogout } from "./api";

const LOGGING_OUT = "Logging out.";

export function LogoutButton() {
  const session = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  if (!session.data?.feature_auth || !session.data.user) return null;

  async function logOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const outcome = await runLogout({
      // Every query but the session goes; the session stays cached, set to logged out, so the
      // guard hides the app at once instead of waiting for a refetch.
      clearCache: () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] }),
      setLoggedOut: () =>
        queryClient.setQueryData<Session>(SESSION_KEY, (current) => (current ? { ...current, user: null } : current)),
      // Replace, as the guard does: the guarded page leaves no history entry behind.
      navigate: () => router.replace(LOGIN_HREF),
    });
    inFlight.current = false;
    setBusy(false);
    if (outcome.kind === "failed") showToast(outcome.message);
  }

  return (
    <Button variant="secondary" size="sm" disabledReason={busy ? LOGGING_OUT : undefined} onClick={logOut}>
      {LOGOUT_LABEL}
    </Button>
  );
}
