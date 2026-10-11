import { expect, test } from "@playwright/test";

// Hold bootstrap data so these assertions exercise the actual initial React
// tree, styles and route fallbacks before an AppCtx is available.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("shiguang.ui.appearance", "dark");
    localStorage.setItem("shiguang.ui.language", "en");
  });
  await page.route("**/api/v1/**", () => {});
});

for (const route of [
  "/projects",
  "/playground",
  "/workspaces/example",
  "/workspaces/example#tab=dataSources",
  "/orgs/example",
  "/orgs/example/settings",
  "/settings",
  "/admin",
  "/import-projects-from-prod",
  "/org-creation",
  "/cms/example/settings",
  "/cms/example/content/models/articles/entries/entry",
  "/cms/example/schemas/articles",
  "/orgs/example/analytics",
]) {
  test(`renders real page regions during bootstrap: ${route}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    if (route !== "/org-creation") {
      await expect(page.locator(".ant-skeleton").first()).toBeVisible();
    }
    await expect(page.locator(".loader-container")).toHaveCount(0);
    if (route.startsWith("/cms")) {
      await expect(page.locator('[data-test-id="cmsContent"]')).toBeVisible();
      await expect(page.locator('[data-test-id="cmsModels"]')).toBeVisible();
    } else if (route === "/admin" || route === "/import-projects-from-prod") {
      await expect(page.getByRole("link", { name: "Help" })).toBeVisible();
    } else if (route === "/org-creation") {
      await expect(
        page.getByText("Tell us about your organization"),
      ).toBeVisible();
    } else if (route.endsWith("/analytics")) {
      await expect(
        page.getByRole("heading", { name: "Analytics" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Back to organization" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("navigation", { name: "All projects" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "My Playground", exact: true }),
      ).toBeVisible();
      if (route === "/settings") {
        await expect(
          page.getByRole("heading", { name: "Preferences" }),
        ).toBeVisible();
        await expect(page.getByLabel("Appearance")).toBeVisible();
      }
    }
    const whiteSurfaces = await page.locator("body *").evaluateAll((elements) =>
      elements
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.width > 200 &&
            rect.height > 40 &&
            getComputedStyle(el).backgroundColor === "rgb(255, 255, 255)"
          );
        })
        .map((el) => el.className),
    );
    expect(whiteSurfaces).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("retains capsule geometry and the dark surface during loading", async ({
  page,
}) => {
  await page.goto("/workspaces/example");
  const pill = page.locator(".ant-skeleton-button-round").first();
  await expect(pill).toBeVisible();
  await expect(pill).toHaveCSS("width", "112px");
  await expect(pill).toHaveCSS("height", "36px");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(21, 22, 27)",
  );
  await expect(page.getByPlaceholder("Search…")).toBeVisible();
  await expect(page.getByText("Data sources", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/plasmic-workspace-skeleton.png",
    fullPage: true,
  });
});

test("preserves known analytics selections in the loading layout", async ({
  page,
}) => {
  await page.goto(
    "/orgs/example/analytics?event=conversions&period=month&from=2026-08-01&to=2026-09-30",
  );
  await expect(page.getByText("Conversions", { exact: true })).toBeVisible();
  await expect(page.getByText("Monthly", { exact: true })).toBeVisible();
  await expect(page.locator("input[placeholder='Start date']")).toHaveValue(
    "2026-08-01",
  );
  await expect(page.locator("input[placeholder='End date']")).toHaveValue(
    "2026-09-30",
  );
});
