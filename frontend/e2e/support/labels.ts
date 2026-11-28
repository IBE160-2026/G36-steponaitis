import { getJson } from "./plan-api";
import type { APIRequestContext, Locator } from "./test";

// Shared by the specs that read a plan's location labels (labels-print.spec.ts,
// user-journeys.spec.ts): the labels JSON (FR-48) and the label cards on the page.

/** One label: its location, and the part number its QR code encodes. */
export type Label = { location: { code: string }; part: string };
export type LabelsBody = { version: number; aisles: { aisle: string; labels: Label[] }[] };

/** A label as `[location code, part number]`. */
export type LabelPair = [code: string, part: string];

export function labelsOf(request: APIRequestContext, planId: string): Promise<LabelsBody> {
  return getJson<LabelsBody>(request, `/api/plans/${planId}/labels`);
}

/** The labels of `aisle` as pairs, in the server's order; none for an aisle the server does not list. */
export function aislePairs(labels: LabelsBody, aisle: string): LabelPair[] {
  const entry = labels.aisles.find((candidate) => candidate.aisle === aisle);
  return (entry?.labels ?? []).map((label) => [label.location.code, label.part]);
}

/** The `[data-label, data-label-part]` of every card of `cards`, in page order. */
export function cardPairs(cards: Locator): Promise<(string | null)[][]> {
  return cards.evaluateAll((elements) =>
    elements.map((element) => [element.getAttribute("data-label"), element.getAttribute("data-label-part")]),
  );
}
