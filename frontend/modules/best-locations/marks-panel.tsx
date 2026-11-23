"use client";

// The Best locations step's marks panel (FR-21, FR-22, Story 3.4; shared by the table and the
// marking wall in Story 10.7): the "N best · M empty" counts (a polite live region) and the plan's
// marks in server order, each with a ≥24px remove button. Marks and counts come only from the
// server; this panel never computes them.

import { useId } from "react";

import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import type { BestMark } from "@/lib/api/plans";
import { markLabel } from "@/lib/copy";

import { bestCountsLine } from "./marks";

export const NO_MARKS = "No best locations yet. The tool never guesses: mark a whole aisle, a level or single locations.";

export function MarksPanel({
  marks,
  best,
  emptyBest,
  disabledReason,
  onRemove,
}: {
  /** The plan's marks in server order (`mark_order`). */
  marks: readonly BestMark[];
  /** The server's best-location counts. */
  best: number;
  emptyBest: number;
  /** "Saving the last change…" while a command is unconfirmed (lib/commands). */
  disabledReason?: string;
  onRemove: (mark: BestMark) => void;
}) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1 lg:self-start">
      <h2 id={heading} className="type-section-title">
        Marks
      </h2>
      <p className="type-body text-ink" aria-live="polite" data-testid="best-counts">
        {bestCountsLine(best, emptyBest)}
      </p>
      {marks.length === 0 ? (
        <p className="type-body text-ink-secondary">{NO_MARKS}</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label="Best-location marks">
          {marks.map((mark) => {
            const label = markLabel(mark);
            return (
              <li key={label} className="flex items-center justify-between gap-2 type-body text-ink">
                <span>{label}</span>
                <Button
                  variant="tertiary"
                  size="sm"
                  className="w-control-sm min-w-control-sm px-0"
                  aria-label={`Remove mark ${label}`}
                  disabledReason={disabledReason}
                  onClick={() => onRemove(mark)}
                >
                  <Icon name="close" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
