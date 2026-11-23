"use client";

// WallGrid (Story 10.3, FR-42, UX-DR42/43): the keyboard and pointer layer over the aisle's SVG
// wall. The SVG stays the picture (`aria-hidden`); this transparent HTML overlay, at the same scaled
// geometry, is one `role="grid"` with one tab stop (roving focus): runs are row groups, section
// numbers column headers, levels row headers, and every location a gridcell named in words with its
// parts as the description. Gap cells are never focusable. Arrow keys, Page Up/Down, Home/End and
// Ctrl+Home/End move through `nextCell`.
//
// Moves (Story 10.4): a cell's name ends with its move texts ("move 1, selected, leaves here"),
// never `aria-selected`; a click or `Enter` on a cell with moves also selects its first move (unless
// one of them is already selected), and a target whose move comes from another aisle says where
// from in its tooltip and description.
//
// The tooltip (WCAG 1.4.13) shows on focus at once or after a 150 ms hover, stays while focus or
// the pointer is on the cell or the tooltip (a short grace lets the pointer cross over), and `Esc`
// hides it without moving focus. `Enter` or a click pins it as a non-modal dialog and focuses its
// first action; `Esc` there closes it back to the cell, and focus leaving both closes it. Only one
// tooltip or dialog exists at a time.
//
// Marking (Story 10.7, FR-21/FR-29): with `marking`, a click or `Enter` on a cell marks or unmarks
// (`onMark`) instead of pinning the dialog or selecting a move, and sends nothing while
// `disabledReason` is set. The tooltip and the cell's description start with the mark preview
// ("Mark aisle A"); `onPreview` reports the hovered (else focused) location for a visible preview.
//
// Drag (Story 12.2, FR-51): with `drag` (only the Locations wall in One aisle), each located cell is
// a dnd-kit droppable and an occupied one a draggable (`WallCell`, which holds each cell's markup);
// a drag hides the tooltip and no tooltip shows while it is on.

import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { AisleLayout } from "@/lib/api/imports";
import type { RecommendationRow, WallLocation, WallMove } from "@/lib/api/plans";
import {
  cellMoveText,
  cellName,
  cellPartLine,
  descriptionLine,
  levelName,
  markSourceText,
  moveArrivesFromText,
  moveFromOtherAisleText,
  partnerStripText,
  walkPathText,
  wallGridLabel,
} from "@/lib/copy";

import { cellRect, runHeight, runTops, type WallCellModel } from "./model";
import { cellMoveSelection, marksByCode, moveKey, type MoveMark, scrollBehavior } from "./moves";
import { firstCell, nextCell } from "./navigation";
import { WallCell, type WallDrag, WallGapCell } from "./wall-cell";
import { cellRecommendations, partnerStrips, recommendationLinks, WallTooltip } from "./wall-tooltip";

/** The pointer must rest this long on a cell before its tooltip shows. */
export const HOVER_DELAY_MS = 150;
/** How long the tooltip waits for the pointer to come back (cell → tooltip) before it hides. */
export const HOVER_GRACE_MS = 120;
/** The gap between the tooltip and its run, and to the viewport edges. */
const TIP_GAP = 8;

/** Which cell's tooltip shows, and whether it is pinned as a dialog. */
export type TipState = { code: string | null; pinned: boolean };

export type TipEvent =
  /** A cell got focus: its tooltip shows (a dialog pinned on that cell stays). */
  | { type: "focus"; code: string }
  /** The pointer rested on a cell: its tooltip shows, unless a dialog is pinned. */
  | { type: "hover"; code: string }
  /** Pointer and focus left: an unpinned tooltip hides. */
  | { type: "hide" }
  /** `Esc`: the tooltip or dialog hides. */
  | { type: "escape" }
  /** `Enter` or a click: the cell's tooltip is pinned as a dialog. */
  | { type: "pin"; code: string }
  /** Focus left both the dialog and its cell: it closes. */
  | { type: "close" };

export const NO_TIP: TipState = { code: null, pinned: false };

export function tipReducer(state: TipState, event: TipEvent): TipState {
  switch (event.type) {
    case "focus":
      return state.pinned && state.code === event.code ? state : { code: event.code, pinned: false };
    case "hover":
      return state.pinned || state.code === event.code ? state : { code: event.code, pinned: false };
    case "hide":
      return state.pinned || state.code === null ? state : NO_TIP;
    case "escape":
    case "close":
      return state.code === null ? state : NO_TIP;
    case "pin":
      return state.pinned && state.code === event.code ? state : { code: event.code, pinned: true };
  }
}

/** The grid's row and column counts (ARIA): one header row per run plus its levels; 1 + widest run. */
export function gridCounts(layout: Pick<AisleLayout, "runs">): { rows: number; columns: number } {
  return {
    rows: layout.runs.reduce((sum, run) => sum + 1 + run.levels.length, 0),
    columns: 1 + Math.max(0, ...layout.runs.map((run) => run.columns)),
  };
}

/** The 1-based `aria-rowindex` of each run's header row. */
function headerRowIndexes(layout: Pick<AisleLayout, "runs">): number[] {
  const indexes: number[] = [];
  let next = 1;
  for (const run of layout.runs) {
    indexes.push(next);
    next += 1 + run.levels.length;
  }
  return indexes;
}

function toolbarHeight(): number {
  if (typeof document === "undefined") return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue("--spacing-toolbar-height");
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type WallManualMoveProps = {
  location: WallLocation;
  /** The cell: focus goes back there when the move dialog closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

export type WallGridProps = {
  layout: AisleLayout;
  cells: readonly WallCellModel[];
  /** The wall view's locations (flags, parts, marks, Walk Path), joined to the cells by code. */
  locations: readonly WallLocation[];
  /** The drawn size over the natural size, as for the SVG. */
  scale: number;
  /** The open part's current location: named ", selected" and made the tab stop. */
  selectedCode?: string;
  /** A location to open at (`?loc=`): made the tab stop, scrolled into view and its dialog pinned. */
  pinCode?: string;
  /** Called once `pinCode` was handled (pinned, or not in this aisle). */
  onPinHandled?: () => void;
  /** The latest run's recommendations at the wall's version (undefined while they disagree). */
  recommendations?: readonly RecommendationRow[];
  recommendationHref?: (row: Pick<RecommendationRow, "id" | "status">) => string;
  /** A pinned part line: open that part's panel with the cell as the opener. */
  onOpenPart?: (part: string, opener: HTMLElement | null) => void;
  /** The pinned dialog's Manual move… for a location. */
  manualMove?: (props: WallManualMoveProps) => ReactNode;
  /** The open aisle's move entries (server order) and their ends on this wall (`moveMarks`). */
  moves?: readonly WallMove[];
  marks?: readonly MoveMark[];
  /** A click or `Enter` on a cell with moves selects one (by `moveKey`). */
  onSelectMove?: (key: string) => void;
  /** Scroll this cell into view (once per `seq`): a move selected in the drawer. */
  scrollTo?: { code: string; seq: number };
  /** Marking replaces pinning (Story 10.7): a click or `Enter` marks; no dialog, no move selection. */
  marking?: WallMarking;
  /**
   * Drag (Story 12.2, FR-51): only the Locations wall in One aisle passes it. Each located cell
   * becomes a dnd-kit droppable (and a draggable when `canDrag`); the tooltip hides while a drag is on.
   */
  drag?: WallDrag;
};

/** Marking on the wall (Story 10.7): what a click or `Enter` on a location does, and its preview. */
export type WallMarking = {
  /** The preview line of the mark a click on `location` sets or removes ("Mark aisle A"). */
  preview: (location: WallLocation) => string;
  /** A click or `Enter` on `location` (never while `disabledReason` is set). */
  onMark: (location: WallLocation) => void;
  /** "Saving the last change…" while a command is unconfirmed: a click or `Enter` sends nothing. */
  disabledReason?: string;
  /** The hovered location, else the focused one, else null (whenever that changes). */
  onPreview?: (location: WallLocation | null) => void;
};

/** A target's lines about a move from another aisle: the tooltip's and the description's. */
export function crossAisleLines(
  marks: readonly MoveMark[],
  moves: readonly WallMove[],
  aisle: string,
): { tip: string; description: string }[] {
  return marks.flatMap((mark) => {
    if (mark.kind !== "target") return [];
    const move = moves.find((candidate) => moveKey(candidate) === mark.key);
    if (!move || move.from_location.aisle === aisle || move.number === null) return [];
    return [
      {
        tip: moveFromOtherAisleText(move.from_location),
        description: moveArrivesFromText(move.number, move.from_location.code),
      },
    ];
  });
}

export function WallGrid({
  layout,
  cells,
  locations,
  scale,
  selectedCode,
  pinCode,
  onPinHandled,
  recommendations,
  recommendationHref,
  onOpenPart,
  manualMove,
  moves = [],
  marks = [],
  onSelectMove,
  scrollTo,
  marking,
  drag,
}: WallGridProps) {
  const id = useId();
  const tops = useMemo(() => runTops(layout), [layout]);
  const counts = gridCounts(layout);
  const headerRows = headerRowIndexes(layout);
  const byCode = new Map(locations.map((entry) => [entry.location.code, entry]));
  // The recommendations touching each location, for the partner lines of its description.
  const touchingByCode = new Map<string, RecommendationRow[]>();
  for (const row of recommendations ?? []) {
    for (const code of new Set([row.from_location, row.to_location])) {
      const list = touchingByCode.get(code);
      if (list) list.push(row);
      else touchingByCode.set(code, [row]);
    }
  }
  const marksAt = marksByCode(marks);
  const selectedMoveKey = marks.find((mark) => mark.selected)?.key;
  const located = cells.filter((cell): cell is WallCellModel & { code: string } => cell.code !== null);

  const [chosen, setChosen] = useState<string | undefined>(undefined);
  // The open part's cell becomes the tab stop whenever it changes.
  const [seenSelected, setSeenSelected] = useState(selectedCode);
  if (seenSelected !== selectedCode) {
    setSeenSelected(selectedCode);
    if (selectedCode !== undefined) setChosen(selectedCode);
  }
  const has = (code: string | undefined) => code !== undefined && located.some((cell) => cell.code === code);
  const activeCode = has(chosen) ? chosen : has(selectedCode) ? selectedCode : firstCell(cells, layout.runs)?.code ?? undefined;

  const [tip, dispatch] = useReducer(tipReducer, NO_TIP);
  const tipState = useRef(tip);
  const cellElements = useRef(new Map<string, HTMLElement>());
  const tipElement = useRef<HTMLDivElement>(null);
  const gridElement = useRef<HTMLDivElement>(null);
  const pinnedCell = useRef<HTMLElement | null>(null);
  /** The cell code under the pointer, "tip" over the tooltip, or null. */
  const pointer = useRef<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusInside = useRef(false);
  /** The next cell focus is a return from the dialog: it does not show the tooltip again. */
  const quietFocus = useRef(false);
  const focusFirstAction = useRef(false);
  /** The hovered and the focused cell for the marking preview (`marking.onPreview`). */
  const previewHover = useRef<string | null>(null);
  const previewFocus = useRef<string | null>(null);
  const onPreview = marking?.onPreview;
  const reportPreview = useCallback(() => {
    if (!onPreview) return;
    const code = previewHover.current ?? previewFocus.current;
    onPreview(code === null ? null : (locations.find((entry) => entry.location.code === code) ?? null));
  }, [onPreview, locations]);

  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(graceTimer.current);
    },
    [],
  );

  /** Keeps `cellElements` current (stable, so a drag binding's node refs are not reset on every render). */
  const registerCell = useCallback((code: string, element: HTMLElement | null) => {
    if (element) cellElements.current.set(code, element);
    else cellElements.current.delete(code);
  }, []);

  // A drag hides the tooltip (and a pinned dialog); no tooltip shows while it is on.
  const dragging = drag?.activeCode != null;
  useEffect(() => {
    if (!dragging) return;
    clearTimeout(hoverTimer.current);
    clearTimeout(graceTimer.current);
    dispatch({ type: "escape" });
  }, [dragging]);

  // A newly selected part's cell scrolls into view inside the scroll box, without taking focus.
  useEffect(() => {
    if (selectedCode === undefined) return;
    cellElements.current.get(selectedCode)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedCode]);

  // A move selected in the drawer: its cell scrolls into view inside the scroll box.
  const scrollSeq = scrollTo?.seq;
  const scrollCode = scrollTo?.code;
  useEffect(() => {
    if (scrollCode === undefined) return;
    cellElements.current.get(scrollCode)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: scrollBehavior() });
  }, [scrollSeq, scrollCode]);

  /** A click or `Enter` on a cell: its first move is selected unless one of its moves already is. */
  function selectCellMove(code: string) {
    const key = cellMoveSelection(marksAt.get(code), selectedMoveKey);
    if (key !== undefined) onSelectMove?.(key);
  }

  /** A click or `Enter` on a located cell while marking: mark it unless a change is saving. */
  function mark(code: string, active: WallMarking) {
    const entry = byCode.get(code);
    if (!entry) return;
    setChosen(code);
    if (active.disabledReason !== undefined) return;
    active.onMark(entry);
  }

  function pin(code: string) {
    pinnedCell.current = cellElements.current.get(code) ?? null;
    focusFirstAction.current = true;
    setChosen(code);
    dispatch({ type: "pin", code });
  }

  // A `?loc=` link: that cell becomes the tab stop, scrolls into view and its dialog is pinned.
  useEffect(() => {
    if (pinCode === undefined) return;
    const element = cellElements.current.get(pinCode);
    if (element && byCodeHas(locations, pinCode)) {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
      pinnedCell.current = element;
      focusFirstAction.current = true;
      setChosen(pinCode);
      dispatch({ type: "pin", code: pinCode });
    }
    onPinHandled?.();
  }, [pinCode, locations, onPinHandled]);

  // Place the tooltip above its run (below it when there is no room above), at the cell, clamped
  // to the viewport. Written straight to the element before paint, and again on scroll and resize.
  const place = useCallback(() => {
    const code = tipState.current.code;
    const element = tipElement.current;
    const grid = gridElement.current;
    const cellElement = code === null ? undefined : cellElements.current.get(code);
    const cell = code === null ? undefined : cells.find((candidate) => candidate.code === code);
    const run = cell === undefined ? undefined : layout.runs[cell.run];
    if (!element || !grid || !cellElement || cell === undefined || run === undefined) return;
    const gridBox = grid.getBoundingClientRect();
    const cellBox = cellElement.getBoundingClientRect();
    const runTop = gridBox.top + (tops[cell.run] ?? 0) * scale;
    const runBottom = runTop + runHeight(run) * scale;
    const height = element.offsetHeight;
    const width = element.offsetWidth;
    let top = runTop - TIP_GAP - height;
    const minTop = toolbarHeight() + TIP_GAP;
    if (top < minTop) top = runBottom + TIP_GAP;
    // Never off-screen: clamped to the viewport below the toolbar.
    top = Math.max(minTop, Math.min(top, window.innerHeight - height - TIP_GAP));
    const maxLeft = Math.max(TIP_GAP, window.innerWidth - width - TIP_GAP);
    const left = Math.min(Math.max(cellBox.left + cellBox.width / 2 - width / 2, TIP_GAP), maxLeft);
    element.style.top = `${Math.round(top)}px`;
    element.style.left = `${Math.round(left)}px`;
  }, [cells, layout.runs, tops, scale]);

  useLayoutEffect(() => {
    tipState.current = tip;
    if (tip.code !== null) place();
  }, [tip, place, locations, recommendations]);

  useEffect(() => {
    if (tip.code === null) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [tip.code, place]);

  // A newly pinned dialog takes focus on its first action.
  useEffect(() => {
    if (!tip.pinned || !focusFirstAction.current) return;
    focusFirstAction.current = false;
    const first = tipElement.current?.querySelector<HTMLElement>("button, a[href]");
    first?.focus({ preventScroll: true });
  }, [tip]);

  /** After the grace time: hide unless the pointer or focus is still on the tooltip's cell or the tooltip. */
  function scheduleHide() {
    clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => {
      if (pointer.current !== null) return;
      const shown = tipState.current;
      if (shown.code === null || shown.pinned) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && tipElement.current?.contains(active)) return;
      const focusedCode = active instanceof HTMLElement ? active.dataset.gridCell : undefined;
      if (focusedCode === shown.code) return;
      // Focus on another cell keeps that cell's tooltip.
      dispatch(focusedCode !== undefined ? { type: "focus", code: focusedCode } : { type: "hide" });
    }, HOVER_GRACE_MS);
  }

  function focusCell(code: string) {
    const element = cellElements.current.get(code);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function onCellFocus(code: string) {
    setChosen(code);
    previewFocus.current = code;
    reportPreview();
    if (quietFocus.current) {
      quietFocus.current = false;
      return;
    }
    dispatch({ type: "focus", code });
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLElement>, cell: WallCellModel & { code: string }) {
    if (event.key === "Enter") {
      if (!byCode.has(cell.code)) return;
      event.preventDefault();
      if (marking) {
        mark(cell.code, marking);
        return;
      }
      pin(cell.code);
      selectCellMove(cell.code);
      return;
    }
    if (event.key === "Escape") {
      if (tipState.current.code === null) return;
      event.preventDefault();
      dispatch({ type: "escape" });
      return;
    }
    // Alt+Arrow (browser history) and Shift+Arrow are left to the browser.
    if (event.altKey || event.shiftKey) return;
    const target = nextCell(cells, layout.runs, cell, event);
    if (target === null || target.code === null) return;
    event.preventDefault();
    if (target.code !== cell.code) {
      setChosen(target.code);
      focusCell(target.code);
    }
  }

  function onCellPointerEnter(code: string) {
    pointer.current = code;
    previewHover.current = code;
    reportPreview();
    clearTimeout(graceTimer.current);
    clearTimeout(hoverTimer.current);
    if (dragging || tipState.current.pinned || tipState.current.code === code) return;
    hoverTimer.current = setTimeout(() => dispatch({ type: "hover", code }), HOVER_DELAY_MS);
  }

  function onPointerLeave() {
    clearTimeout(hoverTimer.current);
    pointer.current = null;
    if (previewHover.current !== null) {
      previewHover.current = null;
      reportPreview();
    }
    scheduleHide();
  }

  function onTipKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys from the Manual move dialog (a portal) bubble here through React; only the tooltip's own count.
    if (event.key !== "Escape" || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
    event.preventDefault();
    const code = tipState.current.code;
    dispatch({ type: "escape" });
    const cellElement = code === null ? undefined : cellElements.current.get(code);
    if (cellElement) {
      quietFocus.current = true;
      cellElement.focus({ preventScroll: true });
      // Only a focus that happened stays quiet; otherwise the next real focus shows the tooltip.
      if (document.activeElement !== cellElement) quietFocus.current = false;
    }
  }

  function onRootFocus() {
    focusInside.current = true;
  }

  function onRootBlur() {
    focusInside.current = false;
    // Focus moving within the wall (or into the move dialog, through React) sets it back at once.
    setTimeout(() => {
      if (focusInside.current) return;
      if (previewFocus.current !== null) {
        previewFocus.current = null;
        reportPreview();
      }
      const shown = tipState.current;
      if (shown.pinned) dispatch({ type: "close" });
      else if (pointer.current === null) dispatch({ type: "hide" });
    }, 0);
  }

  const shownLocation = tip.code === null ? undefined : byCode.get(tip.code);
  const touching = shownLocation && recommendations ? cellRecommendations(recommendations, shownLocation.location.code) : [];
  const labelId = `${id}-tip-label`;
  const shownCross = shownLocation ? crossAisleLines(marksAt.get(shownLocation.location.code) ?? [], moves, layout.aisle) : [];

  return (
    <div className="pointer-events-none absolute inset-0" onFocus={onRootFocus} onBlur={onRootBlur} data-wall-grid-layer="">
      <div
        ref={gridElement}
        role="grid"
        aria-label={wallGridLabel(layout.aisle)}
        aria-rowcount={counts.rows}
        aria-colcount={counts.columns}
        data-surface="graphite"
        className="absolute inset-0"
      >
        {layout.runs.map((run, runIndex) => {
          const header = headerRows[runIndex];
          return (
            <div key={runIndex} role="rowgroup" data-grid-run={runIndex}>
              <div role="row" aria-rowindex={header}>
                {run.sections.map((span) => (
                  <div
                    key={span.section}
                    role="columnheader"
                    aria-colindex={2 + span.first_column}
                    aria-colspan={span.columns}
                    className="sr-only"
                  >
                    {span.section}
                  </div>
                ))}
              </div>
              {run.levels.map((level, row) => (
                <div key={level} role="row" aria-rowindex={header + 1 + row}>
                  <div role="rowheader" aria-colindex={1} className="sr-only">
                    {levelName(level)}
                  </div>
                  {cells
                    .filter((cell) => cell.run === runIndex && cell.row === row)
                    .sort((a, b) => a.column - b.column)
                    .map((cell) => {
                      const rect = cellRect(layout, tops, cell);
                      const style = rect && {
                        left: rect.x * scale,
                        top: rect.y * scale,
                        width: rect.width * scale,
                        height: rect.height * scale,
                      };
                      if (cell.code === null) {
                        return (
                          <WallGapCell
                            key={cell.column}
                            rowIndex={header + 1 + row}
                            colIndex={2 + cell.column}
                            style={style ?? undefined}
                            dragging={dragging}
                          />
                        );
                      }
                      const code = cell.code;
                      const entry = byCode.get(code);
                      const selected = code === selectedCode;
                      const descriptionId = entry ? `${id}-desc-${runIndex}-${row}-${cell.column}` : undefined;
                      const preview = entry && marking ? marking.preview(entry) : undefined;
                      return (
                        <WallCell
                          key={cell.column}
                          code={code}
                          rowIndex={header + 1 + row}
                          colIndex={2 + cell.column}
                          style={style ?? undefined}
                          name={cellName({
                            code,
                            level: entry?.location.level ?? cell.level,
                            best: entry?.location.is_best ?? cell.best !== "none",
                            occupied: cell.occupied,
                            topClass: cell.parts[0],
                            selected,
                            moves: (marksAt.get(code) ?? []).map(cellMoveText),
                          })}
                          descriptionId={descriptionId}
                          hasPopup={entry !== undefined && !marking}
                          expanded={entry && !marking ? tip.pinned && tip.code === code : undefined}
                          active={code === activeCode}
                          selected={selected}
                          cellRef={registerCell}
                          onFocus={() => onCellFocus(code)}
                          onKeyDown={(event) => onCellKeyDown(event, { ...cell, code })}
                          onClick={() => {
                            if (!entry) return;
                            if (marking) {
                              mark(code, marking);
                              return;
                            }
                            pin(code);
                            selectCellMove(code);
                          }}
                          onPointerEnter={() => onCellPointerEnter(code)}
                          onPointerLeave={onPointerLeave}
                          drag={
                            drag && {
                              draggable: entry !== undefined && drag.canDrag(entry),
                              drop: {
                                dragging,
                                vacated: drag.activeCode === code,
                                hint: drag.over?.code === code ? drag.over.hint : undefined,
                              },
                            }
                          }
                          description={
                            descriptionId &&
                            entry && (
                              <div id={descriptionId} hidden>
                                {preview !== undefined && <p data-mark-preview-line="">{descriptionLine(preview)}</p>}
                                {entry.parts.map((part) => (
                                  <p key={part.part}>{descriptionLine(cellPartLine(part))}</p>
                                ))}
                                {entry.covering_marks.map((mark, index) => (
                                  <p key={`mark-${index}`}>{descriptionLine(markSourceText(mark))}</p>
                                ))}
                                <p>{descriptionLine(walkPathText(entry.walk_path))}</p>
                                {crossAisleLines(marksAt.get(code) ?? [], moves, layout.aisle).map((line, index) => (
                                  <p key={`from-${index}`}>{descriptionLine(line.description)}</p>
                                ))}
                                {partnerStrips(touchingByCode.get(code) ?? []).map((partner) => (
                                  <p key={`partner-${partner.id}`}>
                                    {descriptionLine(partnerStripText(partner.partner, partner.sharedJobs, partner.number))}
                                  </p>
                                ))}
                              </div>
                            )
                          }
                        />
                      );
                    })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {shownLocation && (
        <div className="pointer-events-auto">
          <WallTooltip
            key={shownLocation.location.code}
            tipRef={tipElement}
            location={shownLocation}
            pinned={tip.pinned}
            preview={marking ? marking.preview(shownLocation) : undefined}
            labelId={labelId}
            partners={partnerStrips(touching)}
            fromLines={shownCross.map((line) => line.tip)}
            links={recommendationHref ? recommendationLinks(touching, recommendationHref) : []}
            onOpenPart={(part) => onOpenPart?.(part, cellElements.current.get(shownLocation.location.code) ?? null)}
            manualMove={
              tip.pinned && manualMove ? (
                <ManualMoveSlot render={manualMove} location={shownLocation} returnFocusRef={pinnedCell} />
              ) : null
            }
            onKeyDown={onTipKeyDown}
            onPointerEnter={() => {
              pointer.current = "tip";
              clearTimeout(graceTimer.current);
            }}
            onPointerLeave={onPointerLeave}
          />
        </div>
      )}
    </div>
  );
}

/** Renders the page's Manual move… for the pinned location (a component, so the cell ref is only read on close). */
function ManualMoveSlot({
  render,
  location,
  returnFocusRef,
}: WallManualMoveProps & { render: (props: WallManualMoveProps) => ReactNode }) {
  return render({ location, returnFocusRef });
}

function byCodeHas(locations: readonly WallLocation[], code: string): boolean {
  return locations.some((entry) => entry.location.code === code);
}
