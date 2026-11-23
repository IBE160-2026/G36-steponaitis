import type { Locator } from "./test";

// Shared by the journeys that read the Before/after table.

/** The Before/after table's row of `aisle` ("Total" for the total row). */
export function aisleRow(table: Locator, aisle: string): Locator {
  return table.locator("tbody tr").filter({ has: table.page().getByRole("cell", { name: aisle, exact: true }) });
}
