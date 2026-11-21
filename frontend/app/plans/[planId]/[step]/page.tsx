// Steps 2 to 8 until their epics build them; an unknown step is a 404.

import { notFound } from "next/navigation";

import { FLOW_STEPS } from "@/lib/view-state/steps";

export default async function Page({ params }: { params: Promise<{ planId: string; step: string }> }) {
  const { step } = await params;
  const flowStep = FLOW_STEPS.find((candidate) => candidate.key === step && candidate.key !== "overview");
  if (!flowStep) notFound();
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <h1 className="type-page-title">{flowStep.name}</h1>
      <p className="type-body text-ink-secondary">This step is not built yet.</p>
    </div>
  );
}
