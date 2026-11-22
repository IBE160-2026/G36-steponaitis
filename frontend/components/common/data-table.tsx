"use client";

// DataTable (UX-DR18): column heads in ink-secondary, hairline row dividers, numbers right-aligned
// and tabular. Rows show in the order given (server order) until the user picks a sort; sorts are
// stable, so ties keep server order (AD-14). The rows are one tab stop (roving tabindex):
// `↑`/`↓` move between rows, `Home`/`End` jump, `Enter` or a click opens a row when `onOpen` is
// given (a click on a link or button inside the row keeps its own action).
// A cell learns whether its row is active (`cell(row, { isActive })`), so a row's menu button can be
// tabbable only in the active row: `Tab` from the row reaches that row's menu and no other.
// Keys a control inside the row already handled (default prevented) and events from content
// portaled out of the row (e.g. an open menu) never move or open rows.
// `focusKey` (UX-DR9) focuses a shown row and scrolls it into view, once per key value.
// Rows are memoized: after a command the refetched view keeps unchanged rows (TanStack Query's
// structural sharing), so only changed rows re-render. Re-rendering every row of a 2,000-row table
// after each command took over a second in Firefox.

import {
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/common/icons";
import { type SortDirection, type SortValue, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

export type ColumnAlign = "start" | "end";
export type SortKind = "number" | "text";

/** What a cell knows about its row besides the data. */
export type CellContext = { isActive: boolean };

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T, context: CellContext) => ReactNode;
  align?: ColumnAlign;
  /** Makes the column sortable. A decimal column gives its server `sort_rank` as a number. */
  sortValue?: (row: T) => SortValue;
  sortKind?: SortKind;
  className?: string;
};

export type DataTableProps<T> = {
  label: string;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  /** The key of a row to make active, focus and scroll into view (once per value) when shown. */
  focusKey?: string;
  className?: string;
};

type SortState = { key: string; direction: SortDirection } | null;

/**
 * The row a key moves focus to, clamped to the table; `"open"` for `Enter`; `null` for any other
 * key (including `Enter` with nothing to open, decided by the caller).
 */
export function nextRowIndex(key: string, index: number, count: number): number | "open" | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return Math.min(index + 1, count - 1);
    case "ArrowUp":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "Enter":
      return "open";
    default:
      return null;
  }
}

/** The next sort after clicking a column head: ascending first, then it flips. */
export function nextSort(current: SortState, key: string): SortState {
  if (current?.key === key) {
    return { key, direction: current.direction === "ascending" ? "descending" : "ascending" };
  }
  return { key, direction: "ascending" };
}

function toValue<T>(column: DataTableColumn<T>): (row: T) => SortValue {
  const value = column.sortValue!;
  if (column.sortKind === "text") return (row) => String(value(row));
  return (row) => Number(value(row));
}

/** The rows in shown order: the user's sort when its column sorts, else the given order. Row `i`
 * of the table (and of `onOpen`) is `shownRows(...)[i]`. */
export function shownRows<T>(rows: readonly T[], columns: readonly DataTableColumn<T>[], sort: SortState): T[] {
  const sortColumn = sort ? columns.find((column) => column.key === sort.key && column.sortValue) : undefined;
  return sort && sortColumn ? sortRows(rows, toValue(sortColumn), sort.direction) : [...rows];
}

/** Whether `Enter` opens the row: only when the row itself has the focus, never from a link or
 * button inside it, which keeps its own action (retro item 15). */
export function enterOpensRow(target: EventTarget | null, row: EventTarget | null): boolean {
  return target !== null && target === row;
}

type RowProps<T> = {
  row: T;
  index: number;
  isActive: boolean;
  columns: readonly DataTableColumn<T>[];
  clickable: boolean;
  onFocus: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>, index: number) => void;
  onClick: (event: MouseEvent<HTMLTableRowElement>, index: number) => void;
};

// A row's cells depend only on `row`, `isActive` and `columns` (cells close over nothing else that
// changes without a new `columns`), so equal props mean equal output.
const DataTableRow = memo(function DataTableRow<T>({
  row,
  index,
  isActive,
  columns,
  clickable,
  onFocus,
  onKeyDown,
  onClick,
}: RowProps<T>) {
  return (
    <tr
      data-row-index={index}
      tabIndex={isActive ? 0 : -1}
      onFocus={() => onFocus(index)}
      onKeyDown={(event) => onKeyDown(event, index)}
      onClick={clickable ? (event) => onClick(event, index) : undefined}
      className={cn("border-b border-hairline align-top", clickable && "cursor-pointer")}
    >
      {columns.map((column) => (
        <td
          key={column.key}
          className={cn("h-table-row px-2 py-1", column.align === "end" && "text-right tabular-nums", column.className)}
        >
          {column.cell(row, { isActive })}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: RowProps<T>) => ReactNode;

export function DataTable<T>({ label, columns, rows, rowKey, onOpen, focusKey, className }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [active, setActive] = useState(0);
  const body = useRef<HTMLTableSectionElement>(null);
  const focused = useRef<string | undefined>(undefined);

  const shown = shownRows(rows, columns, sort);
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));
  const focusIndex = focusKey === undefined ? -1 : shown.findIndex((row) => rowKey(row) === focusKey);

  useEffect(() => {
    if (focusKey === undefined) {
      focused.current = undefined;
      return;
    }
    if (focused.current === focusKey) return;
    // Handled on the first run for this value, shown or not: a row shown later never steals focus.
    focused.current = focusKey;
    if (focusIndex < 0) return;
    const element = body.current?.querySelector<HTMLElement>(`tr[data-row-index="${focusIndex}"]`);
    if (!element) return;
    // Focusing the row makes it active through its onFocus handler.
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "center" });
  }, [focusKey, focusIndex]);

  function focusRow(index: number) {
    setActive(index);
    body.current?.querySelector<HTMLElement>(`tr[data-row-index="${index}"]`)?.focus();
  }

  function onClick(event: MouseEvent<HTMLTableRowElement>, index: number) {
    if (!onOpen) return;
    const target = event.target as Element | null;
    // A click in content portaled out of the row (an open menu) is not a click on the row.
    if (!target || !event.currentTarget.contains(target)) return;
    if (target.closest("a, button, input, select, textarea, label")) return;
    // Selecting text in a row (e.g. to copy a part number) does not open it.
    if (window.getSelection()?.toString()) return;
    onOpen(shown[index]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
    const next = nextRowIndex(event.key, index, shown.length);
    if (next === null) return;
    if (next === "open") {
      if (!onOpen || !enterOpensRow(event.target, event.currentTarget)) return;
      event.preventDefault();
      onOpen(shown[index]);
      return;
    }
    event.preventDefault();
    focusRow(next);
  }

  // The memoized rows get stable handlers that call the latest render's functions.
  const latest = useRef({ onClick, onKeyDown });
  useLayoutEffect(() => {
    latest.current = { onClick, onKeyDown };
  });
  const rowFocus = useCallback((index: number) => setActive(index), []);
  const rowClick = useCallback(
    (event: MouseEvent<HTMLTableRowElement>, index: number) => latest.current.onClick(event, index),
    [],
  );
  const rowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableRowElement>, index: number) => latest.current.onKeyDown(event, index),
    [],
  );

  return (
    <table aria-label={label} className={cn("w-full border-collapse type-body", className)}>
      <thead>
        <tr className="border-b border-border">
          {columns.map((column) => {
            const sorted = sort?.key === column.key ? sort.direction : undefined;
            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sortValue ? (sorted ?? "none") : undefined}
                className={cn(
                  "px-2 py-1 type-column-head text-ink-secondary",
                  column.align === "end" ? "text-right" : "text-left",
                  column.className,
                )}
              >
                {column.sortValue ? (
                  <button
                    type="button"
                    onClick={() => setSort((current) => nextSort(current, column.key))}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm type-column-head text-ink-secondary",
                      column.align === "end" && "flex-row-reverse",
                    )}
                  >
                    {column.header}
                    <Icon
                      name="chevron"
                      size={12}
                      className={cn(
                        sorted === undefined && "opacity-0",
                        sorted === "ascending" && "rotate-180",
                      )}
                    />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody ref={body}>
        {shown.map((row, index) => (
          <DataTableRow
            key={rowKey(row)}
            row={row}
            index={index}
            isActive={index === activeIndex}
            columns={columns}
            clickable={onOpen !== undefined}
            onFocus={rowFocus}
            onKeyDown={rowKeyDown}
            onClick={rowClick}
          />
        ))}
      </tbody>
    </table>
  );
}
