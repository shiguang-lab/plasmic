import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { compile } from "sass";

// Exercise the real startup template without a bundle or backend, so delayed
// scripts, auth redirects, and route fallbacks cannot hide its first paint.
const wabRoot = resolve(__dirname, "../..");
const html = readFileSync(resolve(wabRoot, "public/index.html"), "utf8").replace(
  "<%= staticUrl %>",
  "http://localhost:3003",
);
const css = compile(resolve(wabRoot, "src/wab/styles/main.sass"), {
  silenceDeprecations: ["import", "global-builtin", "color-functions", "if-function"],
}).css;

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: "text/html", body: html })
      : route.abort(),
  );
});

for (const preference of ["dark", "light", "system"] as const) {
  test(`startup, refresh and route loading follow ${preference} appearance`, async ({ page }) => {
    // Explicit dark must win over a light OS, and explicit light over a dark OS.
    await page.emulateMedia({ colorScheme: preference === "dark" ? "light" : "dark" });
    await page.addInitScript((value) => {
      localStorage.setItem("shiguang.ui.appearance", value);
    }, preference);
    const background = preference === "light" ? "rgb(236, 238, 243)" : "rgb(21, 22, 27)";
    for (const path of ["/projects", "/projects/test", "/settings", "/login", "/logout"]) {
      await page.goto(`http://localhost:3003${path}`);
      await expect(page.locator("html")).toHaveCSS("background-color", background);
      await expect(page.locator("body")).toHaveCSS("background-color", background);
      await page.addStyleTag({ content: css });
      await page.locator(".app-container").evaluate((container) => {
        container.innerHTML = '<div class="root"><div class="loader-container"></div></div>';
      });
      await expect(page.locator("body")).toHaveCSS("background-color", background);
      await expect(page.locator(".root")).toHaveCSS("background-color", background);
    }
    await page.reload();
    await expect(page.locator("body")).toHaveCSS("background-color", background);
  });
}

test("embedded Studio first paint uses the top frame appearance", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    localStorage.setItem("shiguang.ui.appearance", "light");
    Object.assign(window, {
      __PlasmicStudioArgs: "#origin=http%3A%2F%2Flocalhost%3A3003&uiAppearance=dark",
    });
  });
  await page.goto("http://localhost:3003/host");
  await expect(page.locator("html")).toHaveAttribute("data-ui-appearance", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(21, 22, 27)");
  await page.addStyleTag({ content: css });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(21, 22, 27)");
});

test("UI appearance does not force a color scheme into canvas and preview documents", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("shiguang.ui.appearance", "dark"));
  await page.goto("http://localhost:3003/projects/test");
  await page.addStyleTag({ content: css });
  await page.locator(".app-container").evaluate((container) => {
    container.innerHTML = '<iframe srcdoc="<!doctype html><body>Business page</body>"></iframe>';
  });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(page.locator("iframe")).toHaveCSS("color-scheme", "normal");
  await expect(page.frameLocator("iframe").locator("html")).toHaveCSS("color-scheme", "normal");
  await expect(page.frameLocator("iframe").locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});
