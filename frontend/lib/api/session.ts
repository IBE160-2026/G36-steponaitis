"use client";

// GET /api/session (Story 1.7): the signed-in user, feature flags and the upload limit.

import { useQuery } from "@tanstack/react-query";

import { parseErrorBody } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

export type Session = components["schemas"]["Session"];

export async function fetchSession(): Promise<Session> {
  const response = await fetch("/api/session");
  if (!response.ok) throw parseErrorBody(response.status, await response.text());
  return (await response.json()) as Session;
}

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: Infinity });
}
