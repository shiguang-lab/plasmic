import { expect, test } from "@playwright/test";
import path from "node:path";
import { compile } from "sass";

test("keeps artboard controls at a constant screen size during rapid zoom", async ({
  page,
}) => {
  const css = compile(
    path.resolve(
      __dirname,
      "../../src/wab/client/components/canvas/CanvasFrame/CanvasFrame.module.scss",
    ),
    { loadPaths: [path.resolve(__dirname, "../..")], quietDeps: true },
  ).css;
  await page.setContent(`
    <style>
      ${css}
      :root { --hoverBoxTagHeight: 28px; }
      #scaler { transform-origin: 0 0; transform: scale(.02); }
      #artboard { position: relative; width: 1440px; height: 1024px; }
      iframe { width: 100%; height: 100%; border: 0; }
    </style>
    <div id="scaler"><div id="artboard">
      <div class="artboardSelectionHandle" style="transform: scale(50)"></div>
      <iframe srcdoc="<p>Canvas content</p>"></iframe>
    </div></div>
  `);
  const measurements = await page.evaluate(async () => {
    const scaler = document.querySelector<HTMLElement>("#scaler");
    const handle = document.querySelector<HTMLElement>(
      ".artboardSelectionHandle",
    );
    if (!scaler || !handle) {
      throw new Error("Missing canvas fixture elements");
    }
    const samples: { width: number; height: number }[] = [];
    const nextFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextFrame();
    // Each frame must use the same zoom for the canvas and its inverse-scaled
    // controls; a transform transition interpolates the controls independently.
    for (const zoom of [0.04, 0.1, 0.2, 0.5, 1, 2, 0.02, 0.2, 1]) {
      scaler.style.transform = `scale(${zoom})`;
      handle.style.transform = `scale(${1 / zoom})`;
      await nextFrame();
      const bounds = handle.getBoundingClientRect();
      samples.push({ width: bounds.width, height: bounds.height });
    }
    return samples;
  });
  for (const bounds of measurements) {
    expect(bounds.width).toBeCloseTo(28, 1);
    expect(bounds.height).toBeCloseTo(28, 1);
  }
});
