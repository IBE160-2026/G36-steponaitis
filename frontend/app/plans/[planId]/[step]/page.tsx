// Every flow step has its own route, which takes precedence over this one. Move list's route is
// `print` (Story 8.3), so its old URL `/plans/<id>/move-list` redirects there; any other step here
// is unknown and a 404.

import { notFound, redirect } from "next/navigation";

import { planStepHref } from "@/lib/view-state/urls";

export default async function Page({ params }: { params: Promise<{ planId: string; step: string }> }) {
  const { planId, step } = await params;
  if (step === "move-list") redirect(planStepHref(planId, "move-list"));
  notFound();
}
