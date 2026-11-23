"use client";

// "Moves touching aisle A" (Story 10.4, FR-42, UX-DR46): the drawer under the Key. Its heading
// counts the server's entries ("Round 1 · 7 moves · 4 to decide", to decide = status open). Folded,
// it shows only the selected move with Apply · Other location ▾ · Keep in place (only for an open
// or kept recommendation whose row agrees with the wall's version, AD-12); **Show all N** opens the
// shared DataTable, where `Enter` or a click on a row selects that move everywhere. Every command
// reuses the Recommendations step's flows (lib/commands, the shared Other location and Keep in
// place); this adds no command.

import Link from "next/link";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { type DataTableColumn, DataTable } from "@/components/common/data-table";
import { Icon } from "@/components/common/icons";
import { KeepInPlaceButton, sendKeep } from "@/components/common/keep-in-place";
import type { OtherLocationActionProps } from "@/components/common/other-location";
import { showToast } from "@/components/common/toast";
import { moveKey, scrollBehavior } from "@/components/common/wall";
import type { LocationRef, RecommendationRow, WallMove } from "@/lib/api/plans";
import type { CommandBody, SendResult } from "@/lib/commands";
import { type ApplyNotify, applyCommand, applyOtherCommand, applyReason, sendApply } from "@/lib/commands/apply";
import {
  APPLY_LABEL,
  BEST_TAG,
  moveClassPicksText,
  moveLabel,
  MOVES_TABLE_COLUMNS,
  movesDrawerHeading,
  movesTableLabel,
  moveOutdatedStatusText,
  moveStatusText,
  NO_MOVE_SELECTED,
  noMovesTouchText,
  openRoundText,
  ROUTE_TO_TEXT,
  RULE_LABELS,
  SELECTED_ROW_TEXT,
  showAllMovesText,
} from "@/lib/copy";
import { cn } from "@/lib/utils";
import { planStepHref } from "@/lib/view-state/urls";

/** The drawer's numbers: every entry, and those still to decide (status open). */
export function drawerCounts(moves: readonly Pick<WallMove, "status">[]): { moves: number; toDecide: number } {
  return { moves: moves.length, toDecide: moves.filter((move) => move.status === "open").length };
}

/** The recommendation row behind a move, when the rows agree with the wall's version. */
export function joinedRow(move: WallMove, rows: readonly RecommendationRow[] | undefined): RecommendationRow | undefined {
  if (move.kind !== "recommendation" || rows === undefined) return undefined;
  return rows.find((row) => row.id === move.recommendation_id);
}

/** A move's status words; an outdated one with its cause when its row agrees (as on the Recommendations step). */
export function drawerStatusText(move: WallMove, rows: readonly RecommendationRow[] | undefined): string {
  const row = move.status === "outdated" ? joinedRow(move, rows) : undefined;
  return row?.status === "outdated" && row.outdated ? moveOutdatedStatusText(row.part, row.outdated) : moveStatusText(move);
}

/** Whether the drawer offers Apply · Other location · Keep in place for `move`. */
export function hasActions(move: WallMove, row: RecommendationRow | undefined): row is RecommendationRow {
  return row !== undefined && (move.status === "open" || move.status === "kept");
}

/** The move's marker as an HTML chip (the wall's marker, `aria-hidden`; the label says it in words). */
export function MoveChip({ move, selected }: { move: WallMove; selected: boolean }) {
  const ink = move.status === "applied" || move.status === "manual";
  return (
    <span
      aria-hidden="true"
      data-drawer-marker={move.status === "manual" ? "M" : move.status === "applied" ? "applied" : String(move.number ?? "")}
      className={cn(
        "inline-flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-full px-[3px] type-marker",
        ink ? "border-[1.2px] border-surface bg-ink text-surface" : "bg-surface text-ink",
        !ink && (selected ? "border-2 border-accent" : move.status === "outdated" ? "border-[1.2px] border-outdated" : "border-[1.2px] border-ink"),
        ink && selected && "ring-2 ring-accent",
      )}
    >
      {move.status === "applied" ? <Icon name="check" size={11} /> : move.status === "manual" ? "M" : move.number}
    </span>
  );
}

function Location({ location }: { location: LocationRef }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="type-code-table text-ink">{location.code}</span>
      {location.is_best && (
        <span className="rounded-xs border border-best-on-light px-1 py-0.5 text-best-on-light type-tag">{BEST_TAG}</span>
      )}
    </span>
  );
}

function Route({ move }: { move: WallMove }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Location location={move.from_location} />
      <span aria-hidden="true">→</span>
      <span className="sr-only">{ROUTE_TO_TEXT}</span>
      <Location location={move.to_location} />
    </span>
  );
}

export type MovesDrawerProps = {
  planId: string;
  aisle: string;
  round: number;
  /** The open aisle's entries, in server order. */
  moves: readonly WallMove[];
  selectedKey: string | undefined;
  /** A drawer row was chosen: select that move everywhere. */
  onSelect: (key: string) => void;
  /** The latest run's rows at the wall's version (undefined while they disagree: no actions). */
  rows: readonly RecommendationRow[] | undefined;
  version: number;
  savingReason: string | undefined;
  onSend: (body: CommandBody) => Promise<SendResult>;
  notify?: ApplyNotify;
  /** The Other location ▾ action (the page wires the shared `OtherLocationAction`). */
  otherLocation?: (props: OtherLocationActionProps) => ReactNode;
  /** Scroll this move's row into view (once per `seq`, when the table is open): a move selected on the wall. */
  scrollTo?: { key: string; seq: number };
};

export function MovesDrawer({
  planId,
  aisle,
  round,
  moves,
  selectedKey,
  onSelect,
  rows,
  version,
  savingReason,
  onSend,
  notify = showToast,
  otherLocation = () => null,
  scrollTo,
}: MovesDrawerProps) {
  const headingId = useId();
  const tableId = useId();
  const [showAll, setShowAll] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const container = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // After a confirmed command from the drawer, the version it was sent on: once a newer version
  // renders, focus that fell to the page (the pressed control is gone) moves to the heading.
  const [refocusAfter, setRefocusAfter] = useState<number | undefined>(undefined);
  if (refocusAfter !== undefined && version > refocusAfter + 1) setRefocusAfter(undefined);
  useEffect(() => {
    if (refocusAfter === undefined || version <= refocusAfter) return;
    const active = document.activeElement;
    if (active === null || active === document.body || !active.isConnected) heading.current?.focus();
  }, [version, refocusAfter]);

  /** Sends a drawer command; a confirmed one asks for the focus repair above. */
  async function run(send: () => Promise<SendResult>) {
    const sentOn = version;
    const result = await send();
    if (result.outcome === "confirmed") setRefocusAfter(sentOn);
    return result;
  }
  const counts = drawerCounts(moves);
  const selected = moves.find((move) => moveKey(move) === selectedKey);
  const selectedRow = selected ? joinedRow(selected, rows) : undefined;

  // The Other location listbox closes when the selection changes.
  const [otherFor, setOtherFor] = useState(selectedKey);
  if (otherFor !== selectedKey) {
    setOtherFor(selectedKey);
    setOtherOpen(false);
  }

  // A move selected on the wall: once the URL selects it, its table row scrolls into view (when the
  // table is open). Each request scrolls once; opening the table later does not scroll.
  const handledScroll = useRef<number | undefined>(undefined);
  const scrollKey = scrollTo?.key;
  const scrollSeq = scrollTo?.seq;
  useEffect(() => {
    if (scrollSeq === undefined || scrollKey !== selectedKey || handledScroll.current === scrollSeq) return;
    handledScroll.current = scrollSeq;
    if (!showAll) return;
    container.current
      ?.querySelector<HTMLElement>("tr[data-selected]")
      ?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [scrollSeq, scrollKey, selectedKey, showAll]);

  function apply(row: RecommendationRow) {
    return run(() => sendApply(onSend, applyCommand(row.id), notify));
  }

  const columns: DataTableColumn<WallMove>[] = [
    {
      key: "rule",
      header: MOVES_TABLE_COLUMNS.rule,
      cell: (move, { isSelected }) => (
        <span className="inline-flex items-center gap-1.5">
          <MoveChip move={move} selected={isSelected === true} />
          <span className="sr-only">{moveLabel(move)}, </span>
          <span className="type-code-table text-ink">{RULE_LABELS[move.rule]}</span>
          {isSelected && <span className="sr-only">, {SELECTED_ROW_TEXT}</span>}
        </span>
      ),
    },
    {
      key: "part",
      header: MOVES_TABLE_COLUMNS.part,
      cell: (move) => (
        <span className="flex flex-col">
          <span className="type-code-table text-ink">{move.part}</span>
          <span className="type-caption text-ink-secondary">{move.description}</span>
        </span>
      ),
    },
    { key: "class", header: MOVES_TABLE_COLUMNS.classPicks, cell: (move) => moveClassPicksText(move) },
    { key: "from", header: MOVES_TABLE_COLUMNS.from, cell: (move) => <Location location={move.from_location} /> },
    { key: "to", header: MOVES_TABLE_COLUMNS.to, cell: (move) => <Location location={move.to_location} /> },
    { key: "status", header: MOVES_TABLE_COLUMNS.status, cell: (move) => drawerStatusText(move, rows) },
    {
      key: "action",
      header: MOVES_TABLE_COLUMNS.action,
      cell: (move, { isActive }) => {
        const row = move.status === "open" ? joinedRow(move, rows) : undefined;
        if (!row) return null;
        return (
          <Button
            variant="secondary"
            size="sm"
            tabIndex={isActive ? 0 : -1}
            disabledReason={applyReason(row, savingReason)}
            onClick={() => void apply(row)}
          >
            {APPLY_LABEL}
          </Button>
        );
      },
    },
  ];

  return (
    <section
      ref={container}
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
      data-moves-drawer={aisle}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 ref={heading} id={headingId} tabIndex={-1} className="type-body-strong text-ink outline-none" data-moves-heading="">
          {movesDrawerHeading(aisle, round, counts.moves, counts.toDecide)}
        </h3>
        {counts.moves > 0 && (
          <div className="flex flex-wrap items-center gap-4">
            {round > 0 && (
              <Link href={planStepHref(planId, "recommendations")} className="type-button text-ink underline underline-offset-2">
                {openRoundText(round)}
              </Link>
            )}
            <Button
              variant="link"
              size="md"
              aria-expanded={showAll}
              aria-controls={tableId}
              onClick={() => setShowAll((open) => !open)}
              data-show-all=""
            >
              {showAllMovesText(counts.moves)}
            </Button>
          </div>
        )}
      </div>
      {counts.moves === 0 ? (
        <p className="type-body text-ink-secondary">{noMovesTouchText(aisle)}</p>
      ) : selected === undefined ? (
        <p className="type-body text-ink-secondary" data-no-move-selected="">
          {NO_MOVE_SELECTED}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-selected-move={moveKey(selected)}>
          <span className="inline-flex items-center gap-1.5">
            <MoveChip move={selected} selected />
            <span className="sr-only">{moveLabel(selected)}</span>
            <span className="type-code-table text-ink">{RULE_LABELS[selected.rule]}</span>
          </span>
          <span className="inline-flex items-baseline gap-2">
            <span className="type-code text-ink">{selected.part}</span>
            <span className="type-body text-ink">{selected.description}</span>
          </span>
          <span className="type-caption text-ink-secondary">{moveClassPicksText(selected)}</span>
          <Route move={selected} />
          <span className="type-caption text-ink" data-move-status={selected.status}>
            {drawerStatusText(selected, rows)}
          </span>
          {hasActions(selected, selectedRow) && (
            <span className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                disabledReason={applyReason(selectedRow, savingReason)}
                onClick={() => void apply(selectedRow)}
                data-drawer-apply=""
              >
                {APPLY_LABEL}
              </Button>
              {otherLocation({
                row: selectedRow,
                version,
                open: otherOpen,
                onOpenChange: setOtherOpen,
                disabledReason: applyReason(selectedRow, savingReason),
                onApply: (location) => void run(() => sendApply(onSend, applyOtherCommand(selectedRow.id, location), notify)),
              })}
              <KeepInPlaceButton
                kept={selectedRow.status === "kept"}
                savingReason={savingReason}
                onClick={() => void run(() => sendKeep(onSend, selectedRow.part, selectedRow.status === "kept", notify))}
              />
            </span>
          )}
        </div>
      )}
      {counts.moves > 0 && (
        <div id={tableId} hidden={!showAll} className="overflow-x-auto">
          <DataTable
            label={movesTableLabel(aisle)}
            columns={columns}
            rows={moves}
            rowKey={moveKey}
            selectedKey={selectedKey}
            onOpen={(move) => onSelect(moveKey(move))}
          />
        </div>
      )}
    </section>
  );
}
