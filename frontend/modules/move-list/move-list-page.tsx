"use client";

// Move list print view (Story 8.3, FR-38, UX-DR52, AD-17): a paper preview of the server's move
// list with Print (the only primary button) and "Back to Recommendations". Rounds and lines render
// exactly in response order; the client never sorts, filters, counts or marks swaps (AD-3). The
// view is fetched on mount and the paper shows only once that response has arrived. Print fetches
// the view again and calls `window.print()` only after the new response has been rendered, so
// every printout carries a fresh generated time. The paper stylesheet is Story 8.4.

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonClassName } from "@/components/common/button";
import { PlanLoadError, PlanOpening, showsLoadError } from "@/components/common/plan-status";
import { type MoveListLine, type MoveListRound, type MoveListView as MoveListData, usePlanMoveList } from "@/lib/api/plans";
import {
  BACK_TO_RECOMMENDATIONS,
  MOVE_LIST_COLUMNS,
  MOVE_LIST_LOAD_FAILED,
  MOVE_LIST_TITLE,
  moveListDataLine,
  moveListGeneratedLine,
  moveListTitle,
  NO_MOVES_TO_PRINT,
  PRINT_BUSY,
  PRINT_LABEL,
  roundBandNote,
  roundBandTag,
  ruleCellText,
  SWAP_FOOTNOTE,
  swapLocationsText,
  TICK_HEAD,
  TICK_HEAD_SR,
  WALK_PATH_FOOTNOTE,
} from "@/lib/copy";
import { formatNumber } from "@/lib/format";
import { planStepHref } from "@/lib/view-state/urls";

/** Tick box plus the named columns. */
const COLUMN_COUNT = MOVE_LIST_COLUMNS.length + 1;

// ---------------------------------------------------------------------------------------------
// Print flow: refetch, wait for the new data to be rendered, then print once.

/** What a print refetch resolves to (a TanStack Query observer result). */
export type PrintRefetchResult = { isSuccess: boolean; dataUpdatedAt: number; error: Error | null };

/**
 * The print flow without React: `request` refetches the view and, when that succeeded, waits for
 * a render of data at least that fresh; `committed` is called after every commit with the rendered
 * data's `dataUpdatedAt` and prints once when the awaited data is on screen. A failed refetch
 * never prints. Ordinary refetches (a command, window focus) never print: nothing awaits them.
 */
export function createPrintFlow(print: () => void) {
  let awaitedAt: number | null = null;
  return {
    /** Refetches for a print; resolves the refetch error, or null when a print now awaits the render. */
    async request(refetch: () => Promise<PrintRefetchResult>): Promise<Error | null> {
      awaitedAt = null;
      const result = await refetch();
      if (!result.isSuccess) return result.error ?? new Error(MOVE_LIST_LOAD_FAILED);
      awaitedAt = result.dataUpdatedAt;
      return null;
    },
    /** After a commit that rendered data updated at `renderedAt`: print if a print awaits it. */
    committed(renderedAt: number): void {
      if (awaitedAt === null || renderedAt < awaitedAt) return;
      awaitedAt = null;
      print();
    },
  };
}

function usePrintAfterRender(refetch: () => Promise<PrintRefetchResult>, renderedAt: number) {
  const [flow] = useState(() => createPrintFlow(() => window.print()));
  const [busy, setBusy] = useState(false);
  // Bumped when a print refetch settles, so the effect below runs after that render commits too.
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    flow.committed(renderedAt);
  }, [flow, renderedAt, settled]);
  async function print() {
    if (busy) return;
    setBusy(true);
    await flow.request(refetch);
    setBusy(false);
    setSettled((count) => count + 1);
  }
  return { busy, print };
}

// ---------------------------------------------------------------------------------------------
// The paper.

function RuleCell({ line }: { line: MoveListLine }) {
  const swap = swapLocationsText(line);
  return (
    <>
      <span className="whitespace-nowrap">{ruleCellText(line)}</span>
      {swap === null ? null : (
        <span data-swap-locations className="block type-print-code whitespace-nowrap">
          {swap}
        </span>
      )}
    </>
  );
}

function RoundBody({ round }: { round: MoveListRound }) {
  return (
    <tbody data-round={round.round}>
      <tr data-round-band className="border-y-2 border-print-ink">
        <th scope="rowgroup" colSpan={COLUMN_COUNT} className="px-2 py-2 text-left font-normal">
          <span className="mr-3 inline-block border-[1.5px] border-print-ink px-1.5 py-0.5 type-print-round">
            {roundBandTag(round.round)}
          </span>
          <span className="type-print-body">{roundBandNote(round)}</span>
        </th>
      </tr>
      {round.lines.map((line) => (
        <tr key={line.move_number} data-move-line={line.move_number} className="border-b border-print-ink">
          <td className="px-2 py-2 align-top">
            <span aria-hidden="true" className="inline-block size-[14px] border border-print-ink" />
          </td>
          <td className="px-2 py-2 align-top tabular-nums">{formatNumber(line.round)}</td>
          <td className="px-2 py-2 align-top type-print-code">{line.part}</td>
          <td className="px-2 py-2 align-top">{line.description}</td>
          <td className="px-2 py-2 align-top type-print-code whitespace-nowrap">{line.from_location}</td>
          <td className="px-2 py-2 align-top type-print-code whitespace-nowrap">{line.to_location}</td>
          <td className="px-2 py-2 align-top">
            <RuleCell line={line} />
          </td>
          <td className="min-w-24 px-2 py-2" />
        </tr>
      ))}
    </tbody>
  );
}

function Paper({ view }: { view: MoveListData }) {
  const { header } = view;
  const hasSwap = view.rounds.some((round) => round.lines.some((line) => line.swap !== null));
  return (
    <div data-paper className="mx-auto w-full max-w-[210mm] bg-print-paper px-8 py-8 text-print-ink shadow-overlay">
      <table aria-label={moveListTitle(header.name)} className="w-full border-collapse type-print-body text-print-ink">
        <thead>
          <tr>
            <td colSpan={COLUMN_COUNT} className="pb-4">
              <h1 data-move-list-title className="font-code text-[14pt] leading-tight font-bold">
                {moveListTitle(header.name)}
              </h1>
              <p data-move-list-data>{moveListDataLine(header)}</p>
              <p data-move-list-generated className="font-bold">
                {moveListGeneratedLine(header.generated_at)}
              </p>
            </td>
          </tr>
          <tr className="border-b-2 border-print-ink">
            <th scope="col" className="w-8 px-2 py-1 text-left">
              <span aria-hidden="true">{TICK_HEAD}</span>
              <span className="sr-only">{TICK_HEAD_SR}</span>
            </th>
            {MOVE_LIST_COLUMNS.map((column) => (
              <th key={column} scope="col" className="px-2 py-1 text-left font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        {view.rounds.map((round) => (
          <RoundBody key={round.round} round={round} />
        ))}
      </table>
      <div className="mt-4 flex flex-col gap-1 type-print-body">
        <p data-footnote="walk-path">{WALK_PATH_FOOTNOTE}</p>
        {hasSwap ? <p data-footnote="swap">{SWAP_FOOTNOTE}</p> : null}
      </div>
    </div>
  );
}

export type MoveListViewProps = {
  planId: string;
  view: MoveListData;
  onPrint?: () => void;
  /** A print refetch is running: Print is disabled with its reason. */
  printing?: boolean;
  /** The error of the latest fetch (e.g. a failed print refetch), shown above the paper. */
  error?: Error | null;
};

/** The print view: actions, any fetch error, then the paper or the empty state. */
export function MoveListView({ planId, view, onPrint, printing = false, error = null }: MoveListViewProps) {
  const empty = view.rounds.length === 0;
  const disabledReason = empty ? NO_MOVES_TO_PRINT : printing ? PRINT_BUSY : undefined;
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabledReason={disabledReason} aria-busy={printing || undefined} onClick={onPrint}>
          {PRINT_LABEL}
        </Button>
        <Link href={planStepHref(planId, "recommendations")} className={buttonClassName("secondary")}>
          {BACK_TO_RECOMMENDATIONS}
        </Link>
      </div>
      {showsLoadError(error) ? <PlanLoadError message={error.message} /> : null}
      {empty ? (
        <section className="flex flex-col gap-2">
          <h1 className="type-page-title">{MOVE_LIST_TITLE}</h1>
          <p data-move-list-empty className="type-body text-ink-secondary">
            {NO_MOVES_TO_PRINT}
          </p>
        </section>
      ) : (
        <Paper view={view} />
      )}
    </div>
  );
}

export function MoveListPage({ planId }: { planId: string }) {
  const moveList = usePlanMoveList(planId);
  // The cached view's age when the page mounted: the paper waits for a newer one (AD-17).
  const [mountedAt] = useState(moveList.dataUpdatedAt);
  // Likewise a cached error from an earlier visit is not shown while the mount fetch runs.
  const [errorMountedAt] = useState(moveList.errorUpdatedAt);
  const loadError = moveList.errorUpdatedAt > errorMountedAt ? moveList.error : null;
  const fresh = moveList.isFetchedAfterMount && moveList.data !== undefined && moveList.dataUpdatedAt > mountedAt;
  const { busy, print } = usePrintAfterRender(moveList.refetch, fresh ? moveList.dataUpdatedAt : 0);
  if (fresh && moveList.data) {
    return (
      <MoveListView
        planId={planId}
        view={moveList.data}
        onPrint={() => void print()}
        printing={busy}
        error={moveList.error}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4 px-page-gutter py-5">
      {showsLoadError(loadError) ? (
        <PlanLoadError message={loadError.message} />
      ) : (
        <PlanOpening planId={planId} />
      )}
    </div>
  );
}
