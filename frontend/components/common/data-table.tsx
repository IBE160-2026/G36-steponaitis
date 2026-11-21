"use client";

// DataTable (UX-DR18): column heads in ink-secondary, hairline row dividers, numbers right-aligned
// and tabular. Rows show in the order given (server order) until the user picks a sort; sorts are
// stable, so ties keep server order (AD-14). The rows are one tab stop (roving tabindex):
// `↑`/`↓` move between rows, `Home`/`End` jump, `Enter` opens a row when `onOpen` is given.
// `focusKey` (UX-DR9) focuses a shown row and scrolls it into view, once per key value.

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/common/icons";
import { type SortDirection, type SortValue, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

export type ColumnAlign = "start" | "end";
export type SortKind = "number" | "text";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
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

export function DataTable<T>({ label, columns, rows, rowKey, onOpen, focusKey, className }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [active, setActive] = useState(0);
  const body = useRef<HTMLTableSectionElement>(null);
  const focused = useRef<string | undefined>(undefined);

  const sortColumn = sort ? columns.find((column) => column.key === sort.key && column.sortValue) : undefined;
  const shown = sort && sortColumn ? sortRows(rows, toValue(sortColumn), sort.direction) : [...rows];
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

  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const next = nextRowIndex(event.key, index, shown.length);
    if (next === null) return;
    if (next === "open") {
      if (!onOpen) return;
      event.preventDefault();
      onOpen(shown[index]);
      return;
    }
    event.preventDefault();
    focusRow(next);
  }

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
          <tr
            key={rowKey(row)}
            data-row-index={index}
            tabIndex={index === activeIndex ? 0 : -1}
            onFocus={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className="border-b border-hairline align-top"
          >
            {columns.map((column) => (
              <td
                key={column.key}
                className={cn(
                  "h-table-row px-2 py-1",
                  column.align === "end" && "text-right tabular-nums",
                  column.className,
                )}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
