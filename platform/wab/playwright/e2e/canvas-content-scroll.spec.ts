import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { compile } from "sass";

const wabDir = path.resolve(__dirname, "../..");
const canvasCss = compile(
  path.join(wabDir, "src/wab/styles/canvas/canvas.scss"),
).css;

test("authored page height bounds nested scrolling while automatic pages grow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  const bundle = await build({
    entryPoints: [
      path.join(wabDir, "src/wab/client/components/canvas/canvas-scroll.ts"),
    ],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "CanvasScroll",
  });
  await page.setContent(`<style>${canvasCss}
    .__wab_root { min-height: 600px; --viewport-height: 600px; }
    .__wab_val_root { display:flex; flex-direction:column; width:100%; min-height:0; }
    #shell { height:100%; flex-shrink:0; overflow:hidden; }
    #layout { display:flex; flex-direction:column; height:100%; min-height:0; }
    header { height:64px; flex-shrink:0; }
    main { flex:1 1 auto; min-height:0; overflow:auto; }
    #table { width:100%; overflow-x:auto; }
    #rows { width:1400px; height:1600px; }
    #last { position:relative; top:1500px; }
    </style><div class="__wab_root __wab_root--stretch __wab_root--page-stretch"><div style="width:100%">
      <div class="__wab_val_root" style="height:calc(var(--viewport-height)); max-height:100vh; overflow:hidden">
        <div id="shell"><div id="layout"><header>Header</header><main>
          <div id="table"><div id="rows"><button id="last">Last row</button></div></div>
        </main></div></div>
      </div>
    </div></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => {
    document.documentElement.addEventListener(
      "wheel",
      (event) => {
        (window as any).CanvasScroll.handleCanvasContentWheel(
          event,
          document.elementFromPoint(event.clientX, event.clientY),
        );
      },
      { passive: false },
    );
  });
  await expect(page.locator("#shell")).toHaveCSS("height", "600px");
  await expect(page.locator("main")).toHaveCSS("height", "536px");
  await page.mouse.move(200, 200);
  await page.keyboard.down("Alt");
  await page.mouse.wheel(0, 220);
  await expect
    .poll(() => page.locator("main").evaluate((el) => el.scrollTop))
    .toBe(220);
  await page.mouse.wheel(160, 0);
  await page.keyboard.up("Alt");
  await expect
    .poll(() => page.locator("#table").evaluate((el) => el.scrollLeft))
    .toBe(160);
  await expect(page.locator("header")).toHaveJSProperty("offsetTop", 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.locator("#last").evaluate((el) => {
    (window as any).CanvasScroll.revealCanvasElement(el);
  });
  await expect(page.locator("#last")).toBeInViewport();
  await expect(page.locator("header")).toHaveJSProperty("offsetTop", 0);

  // An explicit pixel height must also stay definite.
  await page.locator(".__wab_val_root").evaluate((el: HTMLElement) => {
    el.style.height = "500px";
  });
  await expect(page.locator("#shell")).toHaveCSS("height", "500px");
  await expect(page.locator("main")).toHaveCSS("height", "436px");

  // Natural/percentage-height pages still grow with their content.
  for (const height of ["auto", "100%"]) {
    await page.locator(".__wab_val_root").evaluate((el: HTMLElement, value) => {
      el.style.height = value;
      el.style.maxHeight = "none";
    }, height);
    expect(
      await page.locator(".__wab_val_root").evaluate((el) => el.clientHeight),
    ).toBeGreaterThan(1600);
    expect(
      await page
        .locator("main")
        .evaluate((el) => el.scrollHeight - el.clientHeight),
    ).toBe(0);
  }
});
