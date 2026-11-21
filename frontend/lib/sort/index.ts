// User-picked sorts (AD-14): text compares by code point with `<`/`>` (never `localeCompare`),
// numbers numerically. Decimal columns sort by the server's `sort_rank`. Ties keep the incoming
// (server) order, in both directions.

export type SortDirection = "ascending" | "descending";
export type SortValue = number | string;

/** Code-point order, like Python `str`: `"30400" < "3050"`. */
export function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareNumber(a: number, b: number): number {
  return a - b;
}

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return compareNumber(a, b);
  return compareText(String(a), String(b));
}

/** A new array sorted by `key`; stable, so equal keys keep their order in `rows`. */
export function sortRows<T>(rows: readonly T[], key: (row: T) => SortValue, direction: SortDirection): T[] {
  const sign = direction === "ascending" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: key(row) }))
    .sort((a, b) => sign * compareValues(a.value, b.value) || a.index - b.index)
    .map((entry) => entry.row);
}
