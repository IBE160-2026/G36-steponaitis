import { expect, type Page, test } from "./support/test";

// UJ-5 "an examiner tries the app" (Story 9.5, FR-50, UX-DR53): the seeded `demo` account and
// Demo version. The e2e server runs `swp db upgrade`, which seeds `demo`/`demo`, with
// FEATURE_AUTH=true and FEATURE_DEMO off (a local install). The Demo version test turns the flag on
// in the browser only: it rewrites GET /api/session and forwards POST /api/auth/demo to a real
// `demo`/`demo` login, since turning FEATURE_DEMO on in the e2e server would cap the suite at 50
// plans. The endpoint itself is proven by the backend tests.

test.use({ storageState: { cookies: [], origins: [] } });

function card(page: Page) {
  return page.getByRole("region", { name: "Log in" });
}

async function expectLoggedInAsDemo(page: Page) {
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading", { name: "Saved plans", level: 1 })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "User menu" })).toHaveText("DE");
}

test.describe("fr50 uj5 the demo account", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("fr50 uj5 a local install logs in as demo/demo with no Demo version button", async ({ page }) => {
    await page.goto("/login");
    const section = card(page);
    await expect(section).toBeVisible();
    await expect(section.getByRole("button", { name: "Demo version" })).toHaveCount(0);
    await expect(section.getByText("or", { exact: true })).toHaveCount(0);

    await page.getByLabel("Username").fill("demo");
    await page.getByLabel("Password", { exact: true }).fill("demo");
    await section.getByRole("button", { name: "Log in" }).click();
    await expectLoggedInAsDemo(page);

    await page.getByRole("banner").getByRole("button", { name: "User menu" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText("demo", { exact: true })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Log out" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(card(page)).toBeVisible();
  });

  test("fr50 uj5 Demo version opens the saved-plans list as demo", async ({ page }) => {
    await page.route("**/api/session", async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({ response, json: { ...body, feature_demo: true } });
    });
    const demoPosts: string[] = [];
    await page.route("**/api/auth/demo", async (route) => {
      const request = route.request();
      demoPosts.push(request.method());
      const response = await route.fetch({
        url: new URL("/api/auth/login", request.url()).toString(),
        method: "POST",
        headers: { ...request.headers(), "content-type": "application/json" },
        postData: JSON.stringify({ username: "demo", password: "demo" }),
      });
      await route.fulfill({ response });
    });

    await page.goto("/login");
    const section = card(page);
    const demo = section.getByRole("button", { name: "Demo version" });
    await expect(demo).toBeVisible();
    await expect(demo.locator('[data-icon="play"]')).toBeVisible();

    // The button sits under the "or" rule, below the form and the Create account link, as wide as the form.
    const or = section.getByText("or", { exact: true });
    await expect(or).toBeVisible();
    const formBox = await section.locator("form").boundingBox();
    const linkBox = await section.getByRole("link", { name: "Create account" }).boundingBox();
    const orBox = await or.boundingBox();
    const demoBox = await demo.boundingBox();
    expect(orBox!.y).toBeGreaterThan(linkBox!.y);
    expect(demoBox!.y).toBeGreaterThan(orBox!.y);
    expect(demoBox!.width).toBe(formBox!.width);

    await demo.click();

    await expectLoggedInAsDemo(page);
    expect(demoPosts).toEqual(["POST"]);
  });
});
