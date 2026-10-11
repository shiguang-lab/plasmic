import { overviewLayout } from "@/wab/client/components/dashboard/preview/layout";

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
