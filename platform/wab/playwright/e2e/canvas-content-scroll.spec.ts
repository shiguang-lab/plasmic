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

test("full page height view lets opted-in viewport shells grow with content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  // The shell mirrors AppShell's opt-in sizing contract.
  await page.setContent(`<style>${canvasCss}
    .__wab_val_root { display:flex; flex-direction:column; width:100%; height:100%; }
    #shell {
      width:100%; flex-shrink:0; overflow:hidden;
      height:var(--canvas-content-height, var(--viewport-height, 100vh));
      min-height:var(--viewport-height, 100vh);
    }
    #layout {
      display:flex; flex-direction:column; height:100%;
      min-height:var(--viewport-height, 100vh);
    }
    header { height:64px; flex-shrink:0; }
    main { flex:1 1 auto; min-height:0; overflow:auto; }
    #rows { height:1600px; }
    </style><div id="root" class="__wab_root __wab_root--stretch __wab_root--page-stretch __wab_root--full-height"
      style="min-height:600px; --viewport-height:600px; --canvas-content-height:auto">
      <div class="__wab_val_root"><div id="shell"><div id="layout">
        <header>Header</header><main><div id="rows"></div></main>
      </div></div></div>
    </div>`);
  const measure = () =>
    page.evaluate(() => ({
      shell: document.getElementById("shell")!.getBoundingClientRect().height,
      // The artboard height is derived from the measured canvas body.
      body: document.body.getBoundingClientRect().height,
      mainOverflow:
        document.querySelector("main")!.scrollHeight -
        document.querySelector("main")!.clientHeight,
    }));
  const full = await measure();
  expect(full.shell).toBe(1664);
  expect(full.body).toBeGreaterThanOrEqual(1664);
  expect(full.mainOverflow).toBe(0);

  // Short content keeps the authored viewport as the minimum height.
  await page.locator("#rows").evaluate((el: HTMLElement) => {
    el.style.height = "100px";
  });
  expect((await measure()).shell).toBe(600);

  // Leaving the view restores the bounded shell and its inner scrolling.
  await page.locator("#rows").evaluate((el: HTMLElement) => {
    el.style.height = "1600px";
  });
  await page.locator("#root").evaluate((el: HTMLElement) => {
    el.style.removeProperty("--canvas-content-height");
    el.classList.remove("__wab_root--full-height");
  });
  const bounded = await measure();
  expect(bounded.shell).toBe(600);
  expect(bounded.body).toBe(600);
  expect(bounded.mainOverflow).toBeGreaterThan(0);
});

test("a phone page scrolls inside its full screen and returns from full height", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 960 });
  const bundle = await build({
    stdin: {
      resolveDir: wabDir, loader: "tsx",
      contents: `
        import React from "react";
        import { createRoot } from "react-dom/client";
        import { CanvasFrame } from "../canvas-packages/src/canvas-frame";
        import { handleCanvasContentWheel } from "./src/wab/client/components/canvas/canvas-scroll";
        import { deviceViewportStyle, getDeviceFrame } from "./src/wab/client/components/device-frame/device-frame";
        const device = getDeviceFrame(393, 852);
        Object.assign(window.frameElement.style, deviceViewportStyle(device));
        let info = { viewMode: "stretch", height: 852, deviceContentHeight: device.contentHeight, isHeightAutoDerived: true, fullPageHeight: false };
        const listeners = new Set();
        const frameInfo = { getState: () => info, getInitialState: () => info,
          subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
        window.showFull = value => {
          info = { ...info, fullPageHeight: value };
          listeners.forEach(fn => fn());
        };
        const user = {appUser: {}};
        const currentUser = { ...frameInfo, getState: () => user };
        document.addEventListener("wheel", e => handleCanvasContentWheel(e, e.target), { passive: false });
        createRoot(document.body.appendChild(document.createElement("div"))).render(
          <CanvasFrame frameInfo={frameInfo} currentUser={currentUser}
            DataSourceProvider={({ children }) => children} lifetime={new AbortController().signal}>
            <main style={{ padding: "16px 16px 104px" }}>
              <input placeholder="Buscar pregunta" />
              <section style={{height: 1050}}>FAQ</section>
              <button>Last question</button>
              <button style={{position:"fixed", bottom:12, left:16}}>Feedback</button>
            </main>
          </CanvasFrame>);
      `,
    },
    bundle: true, write: false, outfile: "device.js",
  });
  await page.setContent('<div style="position:relative;width:393px;height:852px"><iframe title="FAQ" style="border:none"></iframe></div>');
  const frame = page.frames()[1];
  for (const file of bundle.outputFiles) {
    if (file.path.endsWith(".css")) { await frame.addStyleTag({ content: file.text }); }
    else { await frame.addScriptTag({ content: file.text }); }
  }
  await frame.addStyleTag({ content: canvasCss });
  const screen = page.locator('iframe[title="FAQ"]');
  await expect(screen).toHaveCSS("top", "0px");
  await expect(screen).toHaveCSS("width", "393px");
  await expect(screen).toHaveCSS("height", "852px");
  const search = frame.getByPlaceholder("Buscar pregunta");
  const feedback = frame.getByText("Feedback");
  const last = frame.getByText("Last question");
  const host = frame.locator("[data-overlayscrollbars]").first();
  await expect(host).toHaveCSS("height", "852px");
  await expect(search).toBeInViewport();
  const bottom = () => feedback.evaluate(el => el.getBoundingClientRect().bottom);
  expect(await bottom()).toBe(840);
  await search.hover();
  await page.keyboard.down("Alt");
  await page.mouse.wheel(0, 1200);
  await page.keyboard.up("Alt");
  await expect(last).toBeInViewport();
  expect(await bottom()).toBe(840);
  expect(await frame.evaluate(() => window.scrollY)).toBe(0);
  await frame.evaluate(() => (window as any).showFull(true));
  await expect.poll(() => host.evaluate(el => el.clientHeight)).toBeGreaterThan(1100);
  await frame.evaluate(() => (window as any).showFull(false));
  await expect(host).toHaveCSS("height", "852px");
  expect(await bottom()).toBe(840);
});
