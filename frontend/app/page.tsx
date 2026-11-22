// The start page (FR-8, AD-20): `/` opens the saved-plans list. A server redirect keeps `/` out
// of the client bundle and lets the browser Back button skip it.

import { redirect } from "next/navigation";

import { SAVED_PLANS_HREF } from "@/lib/view-state/urls";

export default function HomePage() {
  redirect(SAVED_PLANS_HREF);
}
