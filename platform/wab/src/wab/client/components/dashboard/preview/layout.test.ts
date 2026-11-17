import { overviewLayout, previewBounds } from "@/wab/client/components/dashboard/preview/layout";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";

it("fits mixed device shells and desktop screens without changing saved viewport sizes or positions", () => {
  const boards = [
    { left: -500, top: -200, width: 390, height: 844, deviceFrame: getDeviceFrame(390, 844) },
    { left: 100, top: -200, width: 834, height: 1194, deviceFrame: getDeviceFrame(834, 1194) },
    { left: 1000, top: 100, width: 1440, height: 900 },
  ];
  const saved = JSON.stringify(boards);
  const rects = overviewLayout(boards);
  const bounds = boards.map(previewBounds);
  const scale = rects[0].width / bounds[0].width;
  rects.forEach((rect, i) => {
    expect(rect.left).toBeGreaterThanOrEqual(8);
    expect(rect.top).toBeGreaterThanOrEqual(8);
    expect(rect.left + rect.width).toBeLessThanOrEqual(632);
    expect(rect.top + rect.height).toBeLessThanOrEqual(352);
    expect(rect.height / bounds[i].height).toBeCloseTo(scale);
    const screenLeft = rect.left + (boards[i].left - bounds[i].left) * scale;
    const firstScreenLeft = rects[0].left + (boards[0].left - bounds[0].left) * scale;
    expect(screenLeft - firstScreenLeft).toBeCloseTo((boards[i].left - boards[0].left) * scale);
  });
  expect(bounds[0].width).toBeGreaterThan(boards[0].width + 16);
  expect(bounds[1].height).toBeGreaterThan(boards[1].height + 32);
  expect(bounds[2]).toEqual(boards[2]);
  expect(JSON.stringify(boards)).toBe(saved);
});

it("fits every artboard into the padded overview, preserving saved positions and aspect ratios", () => {
  const boards = [
    { left: -1440, top: -1024, width: 1440, height: 1024 },
    { left: 80, top: -1024, width: 1440, height: 1024 },
    { left: -1440, top: 80, width: 1440, height: 1024 },
    { left: 80, top: 80, width: 1440, height: 1024 },
  ];
  const rects = overviewLayout(boards);
  rects.forEach((r, i) => {
    expect(r.left).toBeGreaterThanOrEqual(8);
    expect(r.top).toBeGreaterThanOrEqual(8);
    expect(r.left + r.width).toBeLessThanOrEqual(632);
    expect(r.top + r.height).toBeLessThanOrEqual(352);
    expect(r.width / r.height).toBeCloseTo(boards[i].width / boards[i].height);
  });
  expect(rects[0].left).toBe(rects[2].left);
  expect(rects[0].top).toBe(rects[1].top);
});
it("rejects empty, invalid and oversized canvases before mounting a renderer", () => {
  for (const boards of [
    [],
    [{ left: 0, top: 0, width: 0, height: 1 }],
    [{ left: NaN, top: 0, width: 1, height: 1 }],
    [{ left: 0, top: 0, width: 10000, height: 10000 }],
  ]) {
    expect(() => overviewLayout(boards)).toThrow();
  }
});
