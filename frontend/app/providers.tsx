"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { showToast, Toaster } from "@/components/common/toast";
import { handleQueryError, type QueryErrorEffects } from "@/lib/api/query-errors";
import { type Session, SESSION_KEY } from "@/lib/api/session";
import { sessionExpiry } from "@/lib/api/session-expiry";
import { CommandsProvider } from "@/lib/commands";
import { LOGIN_HREF } from "@/lib/view-state/urls";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Built once: the QueryCache hook closes over these effects, and the effects reach the
  // QueryClient through the variable they are built beside.
  const [{ queryClient, effects }] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
      // One shared hook for every GET (AD-12): a deleted plan goes back to the saved-plans list,
      // an ended session to Log in.
      queryCache: new QueryCache({
        onError: (error) => handleQueryError(error, shared),
      }),
    });
    // The same effects for failed GETs and failed commands: toast, then navigate.
    const shared: QueryErrorEffects = {
      notify: (m) => showToast(m),
      navigate: (h) => router.replace(h),
      // A 401 (Story 9.3, FR-40): remember this page, set the cached session to logged out (as Log
      // out does, so the guard hides plan data at once) and open Log in. Resolves after Log in.
      sessionExpired: () => {
        const restored = sessionExpiry.expire(window.location.pathname + window.location.search);
        client.setQueryData<Session>(SESSION_KEY, (current) => (current ? { ...current, user: null } : current));
        router.replace(LOGIN_HREF);
        return restored;
      },
    };
    return { queryClient: client, effects: shared };
  });
  return (
    <QueryClientProvider client={queryClient}>
      <CommandsProvider effects={effects}>{children}</CommandsProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
