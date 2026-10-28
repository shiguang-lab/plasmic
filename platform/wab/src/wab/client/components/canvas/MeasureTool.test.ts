import { computeMeasureLines } from "@/wab/client/components/canvas/MeasureTool";
import { Box } from "@/wab/shared/geom";

const sides = (top: number, left: number, right: number, bottom: number) =>
  Box.fromRectSides({ top, left, right, bottom });

// Artboard viewport in scaler coordinates.
const viewport = sides(0, 0, 1000, 800);

it("anchors lines on the visible part and labels real distances", () => {
  // A tall selected column inside a table, both cut off by the artboard.
  const column = sides(-200, 100, 300, 1500);
  const table = sides(-300, 50, 900, 1600);
  const lines = computeMeasureLines(
    { box: column, visible: column.intersection(viewport)! },
    { box: table, visible: table.intersection(viewport)! },
    viewport,
  );
  const horizontal = lines.filter((line) => line.y1 === line.y2);
  // Left/right distances sit at the middle of the visible part (y = 400),
  // not of the real box (y = 650), and keep their real lengths.
  expect(horizontal.map((line) => [line.y1, line.label])).toEqual([
    [400, 50],
    [400, 600],
  ]);
  const vertical = lines.filter((line) => line.x1 === line.x2);
  // Top: real distance 100, entirely above the artboard -> not drawn.
  // Bottom: real distance 100, entirely below the artboard -> not drawn.
  expect(vertical).toEqual([]);
});

it("cuts a partly visible line to the artboard but keeps its real length", () => {
  const selected = sides(100, 100, 300, 200);
  const container = sides(-300, 0, 1000, 700);
  const lines = computeMeasureLines(
    { box: selected, visible: selected },
    { box: container, visible: container.intersection(viewport)! },
    viewport,
  );
  const top = lines.find((line) => line.x1 === line.x2 && line.y1 === 100);
  expect(top).toMatchObject({ y1: 100, y2: 0, label: 400, showPx: true });
  const bottom = lines.find((line) => line.x1 === line.x2 && line.y1 === 200);
  expect(bottom).toMatchObject({ y2: 700, label: 500 });
});
