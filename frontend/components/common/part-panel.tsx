"use client";

// PartPanel (FR-13, FR-20, UX-DR24): a 400px side panel with every fact about one part, read from
// GET /api/plans/{id}/parts/{part}. The server owns the class limits, current and other locations
// and the partners' aisles (AD-3); the panel only formats them. Opening moves focus to the heading;
// `Esc` inside the panel or the close button closes it and returns focus to the opener. The open
// part lives in the URL as `?part=` (through lib/view-state), handled by `usePartPanel` for every
// page that shows the panel. Opening and closing is pure client view state, so it goes through the
// native History API (which Next.js integrates with `useSearchParams`): the URL changes at once and
// the panel follows on the next client render, with no server render of the page. `useSearchParams`
// renders on the server only because each page route awaits `searchParams` (dynamic rendering); a
// static route would need a `<Suspense>` boundary around the page.

import { useSearchParams } from "next/navigation";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef } from "react";

import { CLASS_LABELS, ClassGlyph } from "@/components/common/class-glyph";
import { Icon } from "@/components/common/icons";
import { LocationChip } from "@/components/common/location-chip";
import { PlanLoadError, showsLoadError } from "@/components/common/plan-status";
import { type ClassThreshold, type PartDetail, usePlanPart } from "@/lib/api/plans";
import { formatNumber } from "@/lib/format";
import type { StepKey } from "@/lib/view-state/steps";
import { type LocationParams, parseLocationParams, planStepHref } from "@/lib/view-state/urls";

export const NO_CURRENT_LOCATION = "No current location (no stock above zero)";
export const NO_PICK_GROUPS = "No pick groups";
export const CLOSE_LABEL = "Close part panel";

/** "24 or more", "6–23", "1–5" or "0", from the server's limits (never hard-coded). */
export function thresholdText(threshold: ClassThreshold): string {
  const min = formatNumber(threshold.min_picks);
  if (threshold.max_picks === null) return `${min} or more`;
  if (threshold.max_picks === threshold.min_picks) return min;
  return `${min}–${formatNumber(threshold.max_picks)}`;
}

/** "61 picks in the period (24 or more)"; singular "pick" for 1. */
export function picksLine(picks: number, threshold: ClassThreshold): string {
  return `${formatNumber(picks)} ${picks === 1 ? "pick" : "picks"} in the period (${thresholdText(threshold)})`;
}

/** "8 shared jobs" (singular "1 shared job"). */
export function sharedJobsText(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? "shared job" : "shared jobs"}`;
}

/**
 * Reads the open part from the URL's `?part=`, records the opener, pushes `?part=` on open, and on
 * close replaces the URL without it (keeping `aisle`/`loc`).
 */
export function usePartPanel(planId: string, step: StepKey) {
  const opener = useRef<HTMLElement | null>(null);
  const { part, ...rest } = parseLocationParams(useSearchParams());
  const restKey = JSON.stringify(rest);

  const open = useCallback(
    (next: string, from?: HTMLElement | null) => {
      const active = typeof document === "undefined" ? null : document.activeElement;
      opener.current = from ?? (active instanceof HTMLElement ? active : null);
      const current = JSON.parse(restKey) as LocationParams;
      window.history.pushState(null, "", planStepHref(planId, step, { ...current, part: next }));
    },
    [planId, step, restKey],
  );

  const close = useCallback(() => {
    const current = JSON.parse(restKey) as LocationParams;
    window.history.replaceState(null, "", planStepHref(planId, step, current));
    const element = opener.current;
    opener.current = null;
    if (element && element.isConnected) element.focus();
  }, [planId, step, restKey]);

  return { part, open, close };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="type-column-head text-ink-secondary">{label}</dt>
      <dd className="type-body text-ink">{children}</dd>
    </div>
  );
}

/** The facts of a loaded part (no data fetching; rendered by `PartPanel`). */
export function PartFacts({ planId, detail }: { planId: string; detail: PartDetail }) {
  return (
    <>
      <p className="type-body text-ink">{detail.description}</p>
      <dl className="flex flex-col gap-3">
        <Fact label="Class">
          <span className="inline-flex items-center gap-1.5" data-class={detail.movement_class}>
            <ClassGlyph movementClass={detail.movement_class} size={10} />
            {CLASS_LABELS[detail.movement_class]}
          </span>
        </Fact>
        <Fact label="Picks">
          <span data-picks-line="">{picksLine(detail.picks, detail.class_threshold)}</span>
        </Fact>
        <Fact label="Total stock">
          <span className="tabular-nums">{formatNumber(detail.total_stock)}</span>
        </Fact>
        <Fact label="Current location">
          {detail.current_location ? (
            <LocationChip planId={planId} location={detail.current_location} />
          ) : (
            <span className="text-ink-secondary">{NO_CURRENT_LOCATION}</span>
          )}
        </Fact>
        <Fact label="Other locations">
          {detail.other_locations.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {detail.other_locations.map((other) => (
                <li key={other.location.code} className="flex items-center gap-2">
                  <LocationChip planId={planId} location={other.location} />
                  <span className="type-meta text-ink-secondary">stock {formatNumber(other.stock)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-ink-secondary">None</span>
          )}
        </Fact>
      </dl>
      <section className="flex flex-col gap-2" aria-label="Pick groups">
        <h3 className="type-column-head text-ink-secondary">Pick groups</h3>
        {detail.pick_groups.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {detail.pick_groups.map((group) => (
              <li key={group.partner.part} className="flex flex-col gap-0.5" data-partner={group.partner.part}>
                <span className="type-code-table text-ink">{group.partner.part}</span>
                <span className="type-body text-ink">{group.partner.description}</span>
                <span className="type-meta text-ink-secondary">
                  {sharedJobsText(group.shared_jobs)} ·{" "}
                  {group.partner.aisle === null ? "No current location" : `Aisle ${group.partner.aisle}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-ink-secondary">{NO_PICK_GROUPS}</p>
        )}
      </section>
    </>
  );
}

/** The panel frame: heading (focused on open), close button and `Esc` handling. */
export function PartPanelFrame({
  part,
  onClose,
  children,
}: {
  part: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [part]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    onClose();
  }

  return (
    <aside
      aria-labelledby={headingId}
      data-part-panel={part}
      onKeyDown={onKeyDown}
      className="sticky top-0 flex max-h-dvh w-[400px] shrink-0 flex-col gap-4 self-start overflow-y-auto border-l border-border bg-surface p-panel-padding"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={headingId} ref={heading} tabIndex={-1} className="type-section-title text-ink">
          {part}
        </h2>
        <button
          type="button"
          aria-label={CLOSE_LABEL}
          onClick={onClose}
          className="inline-flex size-control-md items-center justify-center rounded-sm text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {children}
    </aside>
  );
}

export function PartPanel({ planId, part, onClose }: { planId: string; part: string; onClose: () => void }) {
  const detail = usePlanPart(planId, part);
  return (
    <PartPanelFrame part={part} onClose={onClose}>
      {detail.data ? (
        <PartFacts planId={planId} detail={detail.data} />
      ) : showsLoadError(detail.error) ? (
        <PlanLoadError message={detail.error.message} />
      ) : (
        <p role="status" className="type-body text-ink-secondary">
          Loading part {part}…
        </p>
      )}
    </PartPanelFrame>
  );
}

/** A page with the part panel on its right while `part` is set. */
export function WithPartPanel({
  planId,
  part,
  onClose,
  children,
}: {
  planId: string;
  part: string | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start">
      <div className="min-w-0 flex-1">{children}</div>
      {part !== undefined && <PartPanel key={part} planId={planId} part={part} onClose={onClose} />}
    </div>
  );
}
