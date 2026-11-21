"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { showToast, Toaster } from "@/components/common/toast";
import { handleQueryError } from "@/lib/api/query-errors";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
        // One shared hook for every GET (AD-12): a deleted plan goes back to New Plan.
        queryCache: new QueryCache({
          onError: (error) => handleQueryError(error, { notify: (m) => showToast(m), navigate: (h) => router.replace(h) }),
        }),
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
