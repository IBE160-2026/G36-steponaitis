"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { showToast, Toaster } from "@/components/common/toast";
import { handleQueryError, type QueryErrorEffects } from "@/lib/api/query-errors";
import { CommandsProvider } from "@/lib/commands";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The same effects for failed GETs and failed commands: toast, then navigate.
  const effects: QueryErrorEffects = { notify: (m) => showToast(m), navigate: (h) => router.replace(h) };
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
        // One shared hook for every GET (AD-12): a deleted plan goes back to New Plan.
        queryCache: new QueryCache({
          onError: (error) => handleQueryError(error, effects),
        }),
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <CommandsProvider effects={effects}>{children}</CommandsProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
