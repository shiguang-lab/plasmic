import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

test("initializing a shared Scrollbar preserves the focused editor inside an iframe", async ({
  page,
}) => {
  const bundle = await build({
    stdin: {
      resolveDir: path.resolve(__dirname, "../.."),
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
        window.mountPanel = () => createRoot(document.getElementById("panel")).render(
          React.createElement(Scrollbar, { defer: false, style: { height: 100 }, events: {
            initialized: () => window.panelInitialized = true
          } }, React.createElement("div", { style: { height: 400 } }, "Panel content"))
        );`,
    },
    bundle: true,
    write: false,
    format: "iife",
    loader: { ".css": "empty" },
  });
  await page.setContent(
    '<iframe title="Canvas" srcdoc="<div contenteditable=true>Keep native text selection</div>"></iframe><div id="panel"></div>',
  );
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const editor = page
    .frameLocator('iframe[title="Canvas"]')
    .locator("[contenteditable]");
  await editor.evaluate((element) => {
    (element as HTMLElement).focus();
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    const selection = element.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await expect(editor).toBeFocused();
  await page.evaluate(() => (window as any).mountPanel());
  await expect
    .poll(() => page.evaluate(() => (window as any).panelInitialized))
    .toBe(true);
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate((element) =>
      element.ownerDocument.getSelection()?.toString(),
    ),
  ).toBe("Keep native text selection");
});
