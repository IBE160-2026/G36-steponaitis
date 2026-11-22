import { join } from "node:path";

import { expect, type Page, test } from "./support/test";

// UJ-1: the planner creates a plan from the three exports (Story 1.8; FR-1, FR-3, FR-4, UX-DR19/20).

test.skip(({ browserName }) => browserName !== "chromium", "The New Plan journey runs in Chromium.");

const SAMPLE = join(__dirname, "..", "..", "data", "sample");
const LOCATIONS = join(SAMPLE, "Locations.xlsx");
const INVENTORY = join(SAMPLE, "Inventory.xlsx");
const TRANSACTIONS = join(SAMPLE, "transactions.xlsx");

function tile(page: Page, role: "locations" | "inventory" | "transactions") {
  return page.locator(`[data-role="${role}"]`);
}

function newPlanButton(page: Page) {
  return page.getByRole("button", { name: "New Plan", exact: true });
}

async function openNewPlan(page: Page) {
  await page.goto("/plans/new");
  await expect(page.getByRole("heading", { name: "New Plan" })).toBeVisible();
}

test.describe("uj1 new plan", () => {
  test("uj1 shows the name field, three tiles and one primary button", async ({ page }) => {
    await openNewPlan(page);
    await expect(page.getByLabel("Plan name")).toBeVisible();
    for (const label of ["Locations", "Inventory", "Transactions"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("accept", ".xlsx,.csv");
    }
    expect(await page.locator("[data-role]").evaluateAll((els) => els.map((el) => el.getAttribute("data-role")))).toEqual(
      ["locations", "inventory", "transactions"],
    );
    await expect(newPlanButton(page)).toHaveCount(1);
  });

  test("uj1 imports the sample files", async ({ page }) => {
    const posts: string[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/plans", async (route) => {
      if (route.request().method() === "POST") {
        posts.push(route.request().url());
        await held;
      }
      await route.continue();
    });

    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("Demo");
    await page.getByLabel("Locations", { exact: true }).setInputFiles(LOCATIONS);
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(INVENTORY);
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(TRANSACTIONS);
    await expect(tile(page, "inventory")).toContainText("Inventory.xlsx");

    await newPlanButton(page).click();
    await expect(newPlanButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("status").filter({ hasText: /Uploading 3 files|Checking files/ })).toBeVisible();
    await newPlanButton(page).click({ force: true });
    await expect(page.getByLabel("Plan name")).toBeDisabled();
    for (const label of ["Locations", "Inventory", "Transactions"]) {
      await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
    }
    release();

    await expect(page).toHaveURL(/\/plans\/[0-9a-f-]{36}\/overview$/, { timeout: 30_000 });
    await expect(page.getByText("Demo created. Data as of 2026-09-30.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(posts).toHaveLength(1);
  });

  test("uj1 shows import errors and keeps passed files", async ({ page }) => {
    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("Broken");
    await page.getByLabel("Locations", { exact: true }).setInputFiles(LOCATIONS);
    await page.getByLabel("Inventory", { exact: true }).setInputFiles({
      name: "inventory.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Part,Part Description,Location\n0100,Bolt,A-01-01-01-A1\n"),
    });
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(TRANSACTIONS);
    await newPlanButton(page).click();

    const panel = page.getByRole("alert").filter({ hasText: "Import stopped: nothing was saved." });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel).toContainText("inventory.csv");
    await expect(panel).toContainText("Quantity");

    await expect(tile(page, "inventory")).toHaveAttribute("data-state", "failed");
    await expect(tile(page, "inventory")).toContainText("Failed. Choose a corrected file.");
    const panelId = await panel.getAttribute("id");
    const describedBy = await page.getByLabel("Inventory", { exact: true }).getAttribute("aria-describedby");
    expect(describedBy?.split(" ")).toContain(panelId);

    for (const role of ["locations", "transactions"] as const) {
      await expect(tile(page, role)).toHaveAttribute("data-state", "passed");
      await expect(tile(page, role)).toContainText("Passed");
    }
    await expect(tile(page, "locations")).toContainText("Locations.xlsx");
    await expect(tile(page, "inventory")).toContainText("inventory.csv");
    await expect(tile(page, "transactions")).toContainText("transactions.xlsx");
    await expect(page).toHaveURL(/\/plans\/new$/);

    // Choosing a corrected file clears only that tile's mark; the panel stays until the next submit.
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(INVENTORY);
    await expect(tile(page, "inventory")).toHaveAttribute("data-state", "none");
    await expect(tile(page, "inventory")).not.toContainText("Failed. Choose a corrected file.");
    await expect(tile(page, "inventory")).toContainText("Inventory.xlsx");
    await expect(panel).toBeVisible();
  });

  test("uj1 asks for a plan name", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/plans")) posts.push(request.url());
    });
    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("   ");
    await page.getByLabel("Locations", { exact: true }).setInputFiles(LOCATIONS);
    await newPlanButton(page).click();

    await expect(page.getByText("Give the plan a name.")).toBeVisible();
    await expect(page.getByLabel("Plan name")).toHaveAttribute("aria-invalid", "true");
    await expect(tile(page, "inventory")).toContainText("Choose the Inventory file.");
    await expect(tile(page, "transactions")).toContainText("Choose the Transactions file.");
    expect(posts).toEqual([]);
  });

  test("uj1 blocks files over the upload limit", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/plans")) posts.push(request.url());
    });
    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("Too big");
    const big = (name: string) => ({ name, mimeType: "text/csv", buffer: Buffer.alloc(1_750_000, "a") });
    await page.getByLabel("Locations", { exact: true }).setInputFiles(big("locations.csv"));
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(big("inventory.csv"));
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(big("transactions.csv"));

    const message = "These files are 5.3 MB together. One New Plan can upload at most 4 MB.";
    await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
    await expect(newPlanButton(page)).toHaveAttribute("aria-disabled", "true");
    // Playwright treats aria-disabled as disabled, so the click is forced to prove it does nothing.
    await newPlanButton(page).click({ force: true });
    await expect(page.getByRole("status")).toHaveText("");
    expect(posts).toEqual([]);

    await page.getByLabel("Transactions", { exact: true }).setInputFiles({
      name: "transactions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("x"),
    });
    await expect(page.getByText(message, { exact: true })).toHaveCount(0);
    await expect(newPlanButton(page)).not.toHaveAttribute("aria-disabled");
  });

  test("uj1 cancels the upload and keeps the chosen files", async ({ page }) => {
    // Hold the upload in stage 1: send() reports progress but never finishes, so Cancel stays.
    await page.addInitScript(() => {
      XMLHttpRequest.prototype.send = function () {
        setTimeout(() => {
          this.upload.dispatchEvent(new ProgressEvent("progress", { loaded: 1_200_000, total: 2_800_000, lengthComputable: true }));
        }, 0);
      };
      XMLHttpRequest.prototype.abort = function () {
        this.dispatchEvent(new Event("abort"));
      };
    });
    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("Cancelled");
    await page.getByLabel("Locations", { exact: true }).setInputFiles(LOCATIONS);
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(INVENTORY);
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(TRANSACTIONS);
    await newPlanButton(page).click();

    await expect(page.getByRole("status")).toHaveText("Uploading 3 files · 1.2 of 2.8 MB");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("status")).toHaveText("");
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveCount(0);
    await expect(newPlanButton(page)).not.toHaveAttribute("aria-disabled");
    await expect(page.getByLabel("Plan name")).toBeEnabled();
    await expect(page.getByLabel("Plan name")).toHaveValue("Cancelled");
    await expect(tile(page, "transactions")).toContainText("transactions.xlsx");
    await expect(page).toHaveURL(/\/plans\/new$/);
  });

  test("uj1 offers no Cancel during the server step", async ({ page }) => {
    // send() finishes the upload body at once and never responds, so the page stays in stage 2.
    await page.addInitScript(() => {
      XMLHttpRequest.prototype.send = function () {
        setTimeout(() => this.upload.dispatchEvent(new ProgressEvent("load")), 0);
      };
    });
    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("Server step");
    await page.getByLabel("Locations", { exact: true }).setInputFiles(LOCATIONS);
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(INVENTORY);
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(TRANSACTIONS);
    await newPlanButton(page).click();

    await expect(page.getByRole("status")).toHaveText("Checking files and computing classes and pick groups…");
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await expect(newPlanButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  async function submitWithResponse(page: Page, status: number, contentType: string, body: string) {
    await page.route("**/api/plans", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status, contentType, body })
        : route.continue(),
    );
    await openNewPlan(page);
    await page.getByLabel("Plan name").fill("Demo");
    await page.getByLabel("Locations", { exact: true }).setInputFiles(LOCATIONS);
    await page.getByLabel("Inventory", { exact: true }).setInputFiles(INVENTORY);
    await page.getByLabel("Transactions", { exact: true }).setInputFiles(TRANSACTIONS);
    await newPlanButton(page).click();
  }

  function envelope(code: string, message: string, details: object[] = []) {
    return JSON.stringify({ error: { code, message, details } });
  }

  test("uj1 shows the server message for a limit error", async ({ page }) => {
    const message = "transactions.xlsx has more than 25,000 rows. One file can hold at most 25,000.";
    await submitWithResponse(page, 413, "application/json", envelope("limit_reached", message));

    const alert = page.getByRole("alert").filter({ hasText: message });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(message);
    await expect(page.getByText("Import stopped: nothing was saved.")).toHaveCount(0);
    await expect(page).toHaveURL(/\/plans\/new$/);
  });

  test("uj1 shows a name rejected by the server under the name field", async ({ page }) => {
    const body = envelope("validation_failed", "Give the plan a name.", [
      { field: "name", message: "Give the plan a name." },
    ]);
    await submitWithResponse(page, 422, "application/json", body);

    await expect(page.getByText("Give the plan a name.")).toBeVisible();
    await expect(page.getByLabel("Plan name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "Give the plan a name." })).toHaveCount(0);

    await page.getByLabel("Plan name").fill("Demo 2");
    await expect(page.getByText("Give the plan a name.")).toHaveCount(0);
    await expect(page.getByLabel("Plan name")).not.toHaveAttribute("aria-invalid");
  });

  test("uj1 shows something went wrong for a response without an envelope", async ({ page }) => {
    await submitWithResponse(page, 502, "text/html", "<html><body>Bad gateway</body></html>");

    const alert = page.getByRole("alert").filter({ hasText: "Something went wrong. Try again." });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("Something went wrong. Try again.");
  });
});
