import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../platform/wab/package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({
  executablePath: process.env.PLASMIC_BROWSER_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(process.env.PLASMIC_APP_SHELL_URL ?? "http://127.0.0.1:3106/?preview");
  await page.locator(".ant-layout-has-sider").waitFor();
  await page.evaluate(() => {
    const style = document.createElement("style");
    // Saved instance CSS must not override the component-owned viewport sizing.
    style.textContent = ".saved-shell-size { width:1440px; height:1024px; flex-shrink:1 }";
    document.head.append(style);
    document.querySelector(".ant-layout-has-sider").parentElement.classList.add("saved-shell-size");
  });

  for (const [viewport, parent] of [
    [{ width: 1440, height: 1024 }, { width: "100%", height: "auto" }],
    [{ width: 1440, height: 720 }, { width: "100%", height: "auto" }],
    [{ width: 1440, height: 720 }, { width: "100%", height: "240px" }],
    [{ width: 1440, height: 720 }, { width: "1100px", height: "auto" }],
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate((sizing) => {
      Object.assign(document.getElementById("root").style, {
        display: "flex", flexDirection: "column", ...sizing,
      });
    }, parent);
    const boxes = await page.evaluate(() => {
      const layout = document.querySelector(".ant-layout-has-sider");
      const read = (element) => {
        const { x, y, width, height, bottom } = element.getBoundingClientRect();
        return { x, y, width, height, bottom };
      };
      return {
        parent: read(document.getElementById("root")),
        shell: read(layout.parentElement),
        layout: read(layout),
        sidebar: read(layout.querySelector(".ant-layout-sider")),
      };
    });
    for (const name of ["shell", "layout", "sidebar"]) {
      assert(Math.abs(boxes[name].y) <= 1, `${name} top: ${JSON.stringify(boxes)}`);
      assert(Math.abs(boxes[name].bottom - viewport.height) <= 1, `${name} bottom: ${JSON.stringify(boxes)}`);
    }
    assert(Math.abs(boxes.shell.width - boxes.parent.width) <= 1, "Shell must fill parent width, not viewport width");
    assert.equal(boxes.shell.x, boxes.parent.x);
  }

  await page.evaluate(() => {
    Object.assign(document.getElementById("root").style, { width: "100%", height: "auto" });
    const body = document.querySelector(".ant-layout-content > div");
    const rows = document.createElement("div");
    rows.style.height = "2400px";
    rows.textContent = "Long business content";
    const action = document.createElement("button");
    action.textContent = "Last action";
    body.replaceChildren(rows, action);
  });
  const header = page.locator(".ant-layout-header");
  const before = await header.boundingBox();
  const content = page.locator(".ant-layout-content");
  await content.hover();
  await page.mouse.wheel(0, 3000);
  await page.waitForFunction(() => document.querySelector(".ant-layout-content").scrollTop > 0);
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const action = await page.getByRole("button", { name: "Last action", exact: true }).boundingBox();
  assert(action && action.y >= 64 && action.y + action.height <= 720, "Last action must be reachable inside the shell");
  assert.deepEqual(await header.boundingBox(), before, "Header must remain stationary during content scrolling");
  assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), 0);

  // Studio auto-sizes the iframe to its content. Siblings after a viewport shell
  // must not feed their height back into the shell on every measurement.
  for (const height of [1024, 720]) {
    await page.setViewportSize({ width: 1440, height });
    await page.evaluate((height) => {
      const root = document.getElementById("root");
      root.style.setProperty("--viewport-height", `${height}px`);
      root.querySelectorAll("[data-height-fixture]").forEach((el) => el.remove());
      const sibling = document.createElement("div");
      sibling.dataset.heightFixture = "true";
      Object.assign(sibling.style, { height: "96px", minHeight: "96px", flexShrink: "0" });
      root.append(sibling);
    }, height);
    for (let pass = 0; pass < 16; pass++) {
      const measured = await page.evaluate(() => ({
        shell: document.querySelector(".ant-layout-has-sider").parentElement.getBoundingClientRect().height,
        content: document.getElementById("root").getBoundingClientRect().height,
      }));
      assert.equal(measured.shell, height, `Auto-height feedback on measurement ${pass}: ${JSON.stringify(measured)}`);
      assert.equal(measured.content, height + 96);
      await page.setViewportSize({ width: 1440, height: measured.content });
    }
  }
  assert.deepEqual(errors, []);
  console.log("AppShell viewport sizing passed: auto/fixed-height parents, shorter viewport, parent width, saved CSS, long-content scrolling and 16 auto-height measurements at 1024/720.");
} finally {
  await browser.close();
}
