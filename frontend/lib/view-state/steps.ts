// The eight steps of the plan flow, in order (UX-DR6). URL helpers arrive beside this in Story 1.9.

export const FLOW_STEPS = [
  { key: "overview", number: 1, name: "Overview" },
  { key: "parts", number: 2, name: "Parts" },
  { key: "locations", number: 3, name: "Locations" },
  { key: "pick-groups", number: 4, name: "Pick groups" },
  { key: "best-locations", number: 5, name: "Best locations" },
  { key: "recommendations", number: 6, name: "Recommendations" },
  { key: "before-after", number: 7, name: "Before/after" },
  { key: "move-list", number: 8, name: "Move list" },
] as const;

export type FlowStep = (typeof FLOW_STEPS)[number];
export type StepKey = FlowStep["key"];
