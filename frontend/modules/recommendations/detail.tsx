"use client";

// The selected recommendation's detail (Story 5.7, FR-28–FR-32, UX-DR33/34; moved here from
// recommendations-page.tsx, retro item 46): the eyebrow, the part, its reason, from → to and the
// actions. For a recommendation (any status) it also shows the wall crops and Show on the Locations
// wall (Story 10.5, render props the page fills with the layout and wall hooks) and the planning
// copy's last moves. "No space" and kept-part items keep the plain detail.

import type { ReactNode } from "react";

import { BinSwatch } from "@/components/common/bin-swatch";
import { Button } from "@/components/common/button";
import { Icon } from "@/components/common/icons";
import { KeepInPlaceButton, KeptInPlaceMark } from "@/components/common/keep-in-place";
import type { RecentMove, RecommendationRow, UndoPreview } from "@/lib/api/plans";
import { applyReason } from "@/lib/commands/apply";
import { appliedText, KEPT_IN_PLACE, noSpaceText, outdatedText, reasonSegments } from "@/lib/copy";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { RecentMoves } from "./crops";
import { effectiveTo, isKept, type ListItem, ruleNumber, showsKeepLink } from "./list";

/** The detail eyebrow: "SELECTED · #1 · RULE 1", "SELECTED · NO SPACE · RULE 3" or "SELECTED · KEPT IN PLACE". */
export function eyebrowText(item: ListItem): string {
  if (item.kind === "kept-part") return `SELECTED · ${KEPT_IN_PLACE.toUpperCase()}`;
  const rule = `RULE ${ruleNumber(item.row.rule)}`;
  return item.kind === "rec" ? `SELECTED · #${formatNumber(item.row.number)} · ${rule}` : `SELECTED · NO SPACE · ${rule}`;
}

export function BestTag() {
  return (
    <span className="rounded-xs border border-best-on-light px-1 py-0.5 text-best-on-light type-tag">BEST</span>
  );
}

export function NoSpaceChip() {
  return <span className="rounded-xs bg-ink px-1 py-0.5 text-surface type-tag">NO SPACE</span>;
}

export type DetailProps = {
  id: string;
  item: ListItem | undefined;
  savingReason: string | undefined;
  onApply: (row: RecommendationRow) => void;
  onKeep: (item: ListItem) => void;
  manualMove: (part: string) => ReactNode;
  /** The Other location ▾ action of an open recommendation (between Apply and Keep in place). */
  otherLocation: (row: RecommendationRow) => ReactNode;
  /** The wall crops of a recommendation (Story 10.5); nothing when its ends are not on the wall. */
  crops?: (row: RecommendationRow) => ReactNode;
  /** The eyebrow row's Show on the Locations wall link of a recommendation (Story 10.5). */
  showOnWall?: (row: RecommendationRow) => ReactNode;
  /** The planning copy's last effective moves, newest first (the server's `recent_moves`). */
  recentMoves?: readonly RecentMove[];
  /** The plan's undo preview: "Undo reverses move N first" under the recent moves. */
  undoPreview?: UndoPreview | null;
};

export function Detail({
  id,
  item,
  savingReason,
  onApply,
  onKeep,
  manualMove,
  otherLocation,
  crops = () => null,
  showOnWall = () => null,
  recentMoves = [],
  undoPreview = null,
}: DetailProps) {
  if (!item) {
    return <section id={id} aria-label="Selected recommendation" className="min-w-0" />;
  }
  const row = item.row;
  const keepLink = showsKeepLink(item) ? (
    <KeepInPlaceButton
      kept={isKept(item)}
      savingReason={savingReason}
      keyShortcut="Alt+K"
      onClick={() => onKeep(item)}
    />
  ) : null;
  const keptLine = isKept(item) ? <KeptInPlaceMark label={KEPT_IN_PLACE} size={16} className="type-body text-ink" /> : null;
  const wallPart =
    item.kind === "rec" ? (
      <>
        {crops(item.row)}
        <RecentMoves moves={recentMoves} undoPreview={undoPreview} />
      </>
    ) : null;
  return (
    <section
      id={id}
      aria-label="Selected recommendation"
      className="flex min-w-0 flex-col gap-3 self-start rounded-lg border border-border bg-surface p-panel-padding"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="type-marker tracking-wide text-ink-secondary" data-testid="detail-eyebrow">
          {eyebrowText(item)}
        </p>
        {item.kind === "rec" && showOnWall(item.row)}
      </div>
      <div className="flex items-center gap-2">
        {row.movement_class && <BinSwatch movementClass={row.movement_class} />}
        <h2 className="type-section-title text-ink">{row.part}</h2>
      </div>
      {row.description && <p className="-mt-2 type-body text-ink-secondary">{row.description}</p>}
      {item.kind !== "kept-part" && item.row.reason && (
        <p className="type-body text-ink" data-testid="detail-reason">
          {reasonSegments(item.row.reason).map((segment, index) =>
            segment.strong ? <strong key={index}>{segment.text}</strong> : <span key={index}>{segment.text}</span>,
          )}
        </p>
      )}
      {wallPart}
      <p className="inline-flex flex-wrap items-center gap-2 type-code text-ink">
        <span>{row.from_location ?? "No current location"}</span>
        {row.from_best && <BestTag />}
        {item.kind !== "kept-part" && (
          <>
            <span aria-hidden="true">→</span>
            <span className="sr-only">to</span>
          </>
        )}
        {item.kind === "rec" ? (
          <>
            <span className={cn(item.row.status === "outdated" && "line-through")}>
              {effectiveTo(item.row).location}
            </span>
            {effectiveTo(item.row).best && <BestTag />}
          </>
        ) : item.kind === "no-space" ? (
          <NoSpaceChip />
        ) : null}
      </p>
      {item.kind === "kept-part" ? (
        <>
          {keptLine}
          <div className="flex flex-wrap items-center gap-2">
            {keepLink}
            {manualMove(row.part)}
          </div>
        </>
      ) : item.kind === "no-space" ? (
        <>
          {keptLine}
          <p className="type-body text-ink">{noSpaceText(item.row.cause)}</p>
          <div className="flex flex-wrap items-center gap-2">
            {keepLink}
            {manualMove(row.part)}
          </div>
        </>
      ) : item.row.status === "applied" && item.row.applied ? (
        <>
          <p className="inline-flex items-center gap-1 type-body text-ink">
            <Icon name="check" />
            {appliedText(item.row.applied)}
          </p>
        </>
      ) : (
        <>
          {item.row.status === "outdated" && item.row.outdated && (
            <p className="inline-flex items-center gap-1 type-body text-ink">
              <Icon name="clock" />
              Outdated · {outdatedText(item.row.part, item.row.outdated)}
            </p>
          )}
          {keptLine}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              aria-keyshortcuts="Alt+A"
              disabledReason={applyReason(item.row, savingReason)}
              onClick={() => onApply(item.row)}
            >
              Apply
            </Button>
            {otherLocation(item.row)}
            {keepLink}
            {manualMove(row.part)}
          </div>
        </>
      )}
    </section>
  );
}
