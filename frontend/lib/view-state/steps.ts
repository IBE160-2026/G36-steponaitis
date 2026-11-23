// The eight steps of the plan flow, in order (UX-DR6). URL helpers live beside this in urls.ts.
// A step's route segment is its key, except Move list, whose route is `print` (AD-17, Story 8.3).

export const FLOW_STEPS = [
  { key: "overview", number: 1, name: "Overview", segment: "overview" },
  { key: "parts", number: 2, name: "Parts", segment: "parts" },
  { key: "locations", number: 3, name: "Locations", segment: "locations" },
  { key: "pick-groups", number: 4, name: "Pick groups", segment: "pick-groups" },
  { key: "best-locations", number: 5, name: "Best locations", segment: "best-locations" },
  { key: "recommendations", number: 6, name: "Recommendations", segment: "recommendations" },
  { key: "before-after", number: 7, name: "Before/after", segment: "before-after" },
  { key: "move-list", number: 8, name: "Move list", segment: "print" },
] as const;

export type FlowStep = (typeof FLOW_STEPS)[number];
export type StepKey = FlowStep["key"];

/** The route segment of `step` (`/plans/<id>/<segment>`): `print` for Move list, else its key. */
export function stepSegment(step: StepKey): FlowStep["segment"] {
  return FLOW_STEPS.find((candidate) => candidate.key === step)?.segment ?? "overview";
}

/** The step a route segment opens (`print` → `move-list`); undefined for any other segment. */
export function stepFromSegment(segment: unknown): StepKey | undefined {
  return FLOW_STEPS.find((step) => step.segment === segment)?.key;
}

/** The step named by its key (the stored last view keeps keys); undefined for anything else. */
export function stepFromKey(key: unknown): StepKey | undefined {
  return FLOW_STEPS.find((step) => step.key === key)?.key;
}
