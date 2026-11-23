"use client";

// On the demo front page `/` (Story 9.6) the shell steps aside: the page owns its header, skip link
// and `<main id="content">`, so the banner landmark stays top-level. Every other path gets the full
// shell. `/` with no front page (demo off, or logged in) renders nothing while it opens the
// saved-plans list, so it needs no shell either.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isFrontPagePath } from "@/lib/view-state/urls";

export function BareOnFrontPage({ page, children }: { page: ReactNode; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return isFrontPagePath(pathname) ? page : children;
}
