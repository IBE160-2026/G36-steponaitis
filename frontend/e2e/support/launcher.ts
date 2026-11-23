import { expect, type Locator, type Page } from "./test";

// Shared by the journeys that use the launcher (launcher.spec.ts, user-journeys.spec.ts).

/** The flow steps, one launcher column each, in flow order. */
export const STEPS = [
  "Overview",
  "Parts",
  "Locations",
  "Pick groups",
  "Best locations",
  "Recommendations",
  "Before/after",
  "Move list",
] as const;

export function launcher(page: Page): Locator {
  return page.getByRole("dialog", { name: "Launcher" });
}

export function searchField(page: Page): Locator {
  return launcher(page).getByPlaceholder("Search features, actions and plans");
}

export function gridButton(page: Page): Locator {
  return page.getByRole("button", { name: "Open the launcher" });
}

/** The plan plate shows once the summary has loaded on the client, so the shortcut listener is live. */
export async function planReady(page: Page) {
  await expect(page.getByRole("banner").getByText(/^Data as of /)).toBeVisible();
}
