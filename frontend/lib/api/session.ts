"use client";

// GET /api/session (Story 1.7): the signed-in user, feature flags and the upload limit.

import { useQuery } from "@tanstack/react-query";

import { parseErrorBody } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Session = components["schemas"]["Session"];

/** The query key of GET /api/session; invalidated after Create account (Story 9.1). */
export const SESSION_KEY = ["session"] as const;

export async function fetchSession(): Promise<Session> {
  const response = await fetch("/api/session");
  if (!response.ok) throw parseErrorBody(response.status, await response.text());
  return (await response.json()) as Session;
}

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: Infinity });
}
