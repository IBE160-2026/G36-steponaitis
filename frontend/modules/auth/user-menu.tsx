"use client";

// The avatar user menu (Story 9.3, UX-DR4, FR-40): at the right end of the toolbar, shown only with
// FEATURE_AUTH on and a user. A 34px ink disc with the username's first two letters opens a white
// menu with "Logged in as", the username and Log out. Keyboard is radix's: Enter, Space or
// ArrowDown open it, the arrows move, `Esc` closes it and returns focus to the avatar. Log out
// posts logout, clears every cached query, marks the session logged out and opens Log in (the demo
// front page with FEATURE_DEMO on, Story 9.6). Passed into the toolbar as a slot by app/layout.tsx.

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useRef } from "react";

import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from "@/components/common/menu-styles";
import { showToast } from "@/components/common/toast";
import { type Session, SESSION_KEY, useSession } from "@/lib/api/session";

import { LOGOUT_LABEL, type LogoutOutcome, logoutHref, runLogout } from "./api";
import { leaveTo } from "./auth-guard";

export const USER_MENU_LABEL = "User menu";
export const LOGGED_IN_AS = "Logged in as";

/**
 * The avatar's letters: the username's first two characters (by code point), upper-cased, and
 * still at most two after upper-casing ("ß" becomes "SS").
 */
export function avatarInitials(username: string): string {
  return Array.from(Array.from(username).slice(0, 2).join("").toUpperCase()).slice(0, 2).join("");
}

export type LogOutDeps = {
  /** The session as it was before Log out (its `feature_demo` picks the page to open). */
  session: Session | undefined;
  queryClient: Pick<QueryClient, "removeQueries" | "setQueryData">;
  router: { replace: (href: string) => void };
  post?: () => Promise<void>;
};

/**
 * Log out from the avatar menu: post, clear every cached query but the session, mark the session
 * logged out and open Log in, or the demo front page with FEATURE_DEMO on (Story 9.6).
 */
export function logOutAndLeave({ session, queryClient, router, post }: LogOutDeps): Promise<LogoutOutcome> {
  const target = logoutHref(session);
  return runLogout({
    post,
    // Every query but the session goes; the session stays cached, set to logged out, so the
    // guard hides the app at once instead of waiting for a refetch.
    clearCache: () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] }),
    // The guard leaves the page being left to Log out's own navigation (Story 9.6).
    setLoggedOut: () => {
      leaveTo(target);
      queryClient.setQueryData<Session>(SESSION_KEY, (current) => (current ? { ...current, user: null } : current));
    },
    // Replace, as the guard does: the guarded page leaves no history entry behind.
    navigate: () => router.replace(target),
  });
}

export function UserMenu() {
  const session = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const inFlight = useRef(false);

  const user = session.data?.feature_auth ? session.data.user : null;
  if (!user) return null;

  async function logOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    const outcome = await logOutAndLeave({ session: session.data, queryClient, router });
    inFlight.current = false;
    if (outcome.kind === "failed") showToast(outcome.message);
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={USER_MENU_LABEL}
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-ink type-button text-white"
        >
          {avatarInitials(user)}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={16} className={MENU_CONTENT_CLASS}>
          <div className="px-2 pt-1 type-caption text-ink-secondary">{LOGGED_IN_AS}</div>
          <div className="max-w-60 truncate px-2 pb-1 font-code font-bold">{user}</div>
          <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
          <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => void logOut()}>
            {LOGOUT_LABEL}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
