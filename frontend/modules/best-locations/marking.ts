"use client";

// The Best locations step's shared marking controls and commands (FR-21, FR-29, Story 3.4; shared
// by the table and the marking wall since Story 10.7): the Marking mode and Level scope options,
// the remembered mode, and `sendMarkChange` with the Epic 3 toast rules.

import { showToast, type ToastOptions } from "@/components/common/toast";
import type { CommandEvent } from "@/lib/api/plans";
import type { CommandBody, SendResult } from "@/lib/commands";
import { marksChangedText, VIEW_LABEL } from "@/lib/copy";
import { bestLocationsModeKey, readStored } from "@/lib/view-state/storage";

import type { LevelScope, MarkingMode } from "./marks";

export const MODES: readonly { value: MarkingMode; label: string }[] = [
  { value: "aisle", label: "Whole aisle" },
  { value: "level", label: "Level" },
  { value: "single", label: "Single location" },
];

export const SCOPES: readonly { value: LevelScope; label: string }[] = [
  { value: "aisle", label: "in this aisle" },
  { value: "all", label: "in all aisles" },
];

/** The plan's remembered marking mode; Whole aisle when none is stored or storage fails. */
export function readMode(planId: string): MarkingMode {
  const stored = readStored(bestLocationsModeKey(planId));
  return MODES.find((mode) => mode.value === stored)?.value ?? "aisle";
}

/** How many recommendations a command outdated: the sum of its `recommendations_outdated` counts. */
export function outdatedCount(events: readonly CommandEvent[]): number {
  return events.reduce((sum, event) => (event.type === "recommendations_outdated" ? sum + event.count : sum), 0);
}

/**
 * Sends one mark change; the toast shows only for a confirmed change that produced events
 * ("dropped"/"busy" and a confirmed no-op show none). When the change outdated recommendations,
 * the toast counts them and offers **View** (`onView`, the Outdated tab); there is no Undo.
 */
export async function sendMarkChange(
  send: (body: CommandBody) => Promise<SendResult>,
  body: CommandBody,
  notify: (message: string, options?: ToastOptions) => void = showToast,
  onView?: () => void,
): Promise<SendResult> {
  const result = await send(body);
  if (result.outcome === "confirmed" && result.events.length > 0) {
    const count = outdatedCount(result.events);
    const options = count > 0 && onView ? { action: { label: VIEW_LABEL, onClick: onView } } : undefined;
    notify(marksChangedText(count), options);
  }
  return result;
}
