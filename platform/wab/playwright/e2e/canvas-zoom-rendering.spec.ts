import { expect, test } from "@playwright/test";
import path from "node:path";
import { compile } from "sass";

test("keeps artboard labels at a constant screen size during rapid zoom", async ({
  page,
}) => {
  const css = compile(
    path.resolve(__dirname, "../../src/wab/styles/main.sass"),
    { quietDeps: true },
  ).css;
  await page.setContent(`
    <style>
      ${css}
      #scaler { transform-origin: 0 0; }
      #artboard { position: relative; width: 1440px; height: 1024px; }
      iframe { width: 100%; height: 100%; border: 0; }
    </style>
    <div id="scaler" class="canvas-editor__scaler"><div id="artboard">
      <div class="CanvasFrame__Label">A</div>
      <iframe srcdoc="<p>Canvas content</p>"></iframe>
    </div></div>
  `);
  const label = page.locator(".CanvasFrame__Label");
  const initial = await label.boundingBox();
  if (!initial || !initial.width || !initial.height) {
    throw new Error("Missing artboard label");
  }
  const measurements = await label.evaluate(async (element) => {
    const scaler = document.querySelector<HTMLElement>("#scaler");
    if (!scaler) {
      throw new Error("Missing canvas scaler");
    }
    const samples: { width: number; height: number }[] = [];
    for (const zoom of [0.04, 0.1, 0.2, 0.5, 1, 2, 0.02, 0.2, 1]) {
      scaler.style.transform = `scale(${zoom})`;
      element.style.transform = `scale(${1 / zoom})`;
      element.style.maxWidth = `${1440 * zoom}px`;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const bounds = element.getBoundingClientRect();
      samples.push({ width: bounds.width, height: bounds.height });
    }
    return samples;
  });
  for (const bounds of measurements) {
    expect(bounds.width).toBeCloseTo(initial.width, 1);
    expect(bounds.height).toBeCloseTo(initial.height, 1);
  }
});
