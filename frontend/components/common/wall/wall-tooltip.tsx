// WallTooltip (Story 10.3, FR-42, UX-DR43, WCAG 1.4.13): what one wall location holds. As a
// tooltip it is `aria-hidden` (the cell's name and description say the same); pinned (`Enter` or
// a click) the same box is a non-modal dialog named by the code, with its actions: one button per
// part line (opens the PartPanel), Manual move… and Show recommendation #n. It never shows capacity
// or distance. Presentational: the grid owns when it shows and where; the page owns the actions.

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode, Ref } from "react";

import { BinSwatch } from "@/components/common/bin-swatch";
import { KeptInPlaceMark } from "@/components/common/keep-in-place";
import type { RecommendationRow, WallLocation, WallPart } from "@/lib/api/plans";
import {
  BEST_TAG,
  levelName,
  markSourceText,
  occupancyText,
  partnerStripText,
  partStatsText,
  showRecommendationLabel,
  walkPathText,
} from "@/lib/copy";

/** A rule 3 recommendation's partner, shown as a strip on the cells it touches. */
export type WallPartner = { id: string; partner: string; sharedJobs: number; number: number };

/** A pinned tooltip's Show recommendation #n link. */
export type WallRecommendationLink = { id: string; label: string; href: string };

/**
 * The latest run's recommendations, only when their version is the wall's (AD-12): until the two
 * agree, the wall shows no recommendation links and no partner strips.
 */
export function recommendationsAtVersion<T>(
  view: { version: number; recommendations: readonly T[] } | undefined,
  version: number,
): readonly T[] | undefined {
  return view !== undefined && view.version === version ? view.recommendations : undefined;
}

/** The latest run's recommendations whose from- or to-location is `code`, in server order. */
export function cellRecommendations<T extends Pick<RecommendationRow, "from_location" | "to_location">>(
  rows: readonly T[],
  code: string,
): T[] {
  return rows.filter((row) => row.from_location === code || row.to_location === code);
}

/** The partner strips of `rows`: each rule 3 (pick group) recommendation, in server order. */
export function partnerStrips(rows: readonly Pick<RecommendationRow, "id" | "number" | "rule" | "reason">[]): WallPartner[] {
  return rows.flatMap((row) =>
    row.rule === "rule_3" && row.reason?.kind === "pick_group"
      ? [{ id: row.id, partner: row.reason.partner, sharedJobs: row.reason.shared_jobs, number: row.number }]
      : [],
  );
}

/** Show recommendation #n for each of `rows`, in server order. */
export function recommendationLinks(
  rows: readonly Pick<RecommendationRow, "id" | "number" | "status">[],
  href: (row: Pick<RecommendationRow, "id" | "status">) => string,
): WallRecommendationLink[] {
  return rows.map((row) => ({ id: row.id, label: showRecommendationLabel(row.number), href: href(row) }));
}

function PartLine({ part }: { part: WallPart }) {
  return (
    <span className="flex items-start gap-2 text-left">
      <BinSwatch movementClass={part.movement_class} className="mt-0.5" />
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="type-code-table text-ink">{part.part}</span>
          <span className="type-caption text-ink">{part.description}</span>
        </span>
        <span className="type-meta text-ink-secondary">{partStatsText(part)}</span>
        {part.kept_in_place && <KeptInPlaceMark size={12} className="type-meta text-ink" />}
      </span>
    </span>
  );
}

export type WallTooltipProps = {
  location: WallLocation;
  /** Pinned: a non-modal dialog with actions; otherwise an `aria-hidden` tooltip. */
  pinned: boolean;
  /** The id of the code line, which names the pinned dialog. */
  labelId: string;
  partners?: readonly WallPartner[];
  /** A move target's "From G-14-04-02 (aisle G)" lines (Story 10.4). */
  fromLines?: readonly string[];
  links?: readonly WallRecommendationLink[];
  /** A part line's button (pinned only): opens that part's PartPanel. */
  onOpenPart?: (part: string) => void;
  /** The pinned dialog's Manual move… action. */
  manualMove?: ReactNode;
  /** Marking (Story 10.7): the mark a click sets or removes, shown as the first line. */
  preview?: string;
  tipRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPointerEnter?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLDivElement>) => void;
};

export function WallTooltip({
  location,
  pinned,
  labelId,
  partners = [],
  fromLines = [],
  links = [],
  onOpenPart,
  manualMove,
  preview,
  tipRef,
  style,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
}: WallTooltipProps) {
  const code = location.location.code;
  return (
    <div
      ref={tipRef}
      role={pinned ? "dialog" : undefined}
      aria-labelledby={pinned ? labelId : undefined}
      aria-hidden={pinned ? undefined : true}
      data-wall-tooltip={code}
      data-pinned={pinned ? "" : undefined}
      onKeyDown={onKeyDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={style}
      className="fixed z-40 flex w-max max-w-80 flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-ink shadow-overlay"
    >
      {preview !== undefined && (
        <p className="type-body-strong text-ink" data-tip-mark-preview="">
          {preview}
        </p>
      )}
      <p id={labelId} className="type-code text-ink">
        {code}
      </p>
      <p className="flex items-center gap-2 type-caption text-ink">
        <span>{levelName(location.location.level)}</span>
        {location.location.is_best && (
          <span className="rounded-xs bg-best-on-light px-1 type-tag text-surface" data-tip-best="">
            {BEST_TAG}
          </span>
        )}
      </p>
      <p className="type-caption text-ink" data-tip-occupancy="">
        {occupancyText(location.occupied, location.parts.length)}
      </p>
      {location.covering_marks.map((mark, index) => (
        <p key={index} className="type-meta text-ink-secondary" data-tip-mark="">
          {markSourceText(mark)}
        </p>
      ))}
      <p className="type-meta text-ink-secondary" data-tip-walk-path="">
        {walkPathText(location.walk_path)}
      </p>
      {location.parts.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-hairline pt-1.5">
          {location.parts.map((part) => (
            <li key={part.part} data-tip-part={part.part}>
              {pinned ? (
                <button
                  type="button"
                  onClick={() => onOpenPart?.(part.part)}
                  className="w-full rounded-sm p-1 hover:bg-ground"
                >
                  <PartLine part={part} />
                </button>
              ) : (
                <PartLine part={part} />
              )}
            </li>
          ))}
        </ul>
      )}
      {fromLines.map((line, index) => (
        <p key={`from-${index}`} className="type-caption text-ink" data-tip-from="">
          {line}
        </p>
      ))}
      {partners.map((partner) => (
        <p key={partner.id} className="rounded-sm bg-band px-2 py-1 type-meta text-ink" data-partner-strip={partner.partner}>
          {partnerStripText(partner.partner, partner.sharedJobs, partner.number)}
        </p>
      ))}
      {pinned && (
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-2">
          {manualMove}
          {links.map((link) => (
            <Link key={link.id} href={link.href} className="type-button text-ink underline underline-offset-2" data-tip-rec={link.id}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
