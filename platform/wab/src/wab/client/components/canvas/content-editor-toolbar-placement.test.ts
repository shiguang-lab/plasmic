import { placeContentEditorToolbar } from "@/wab/client/components/canvas/content-editor-toolbar-placement";
import { Box } from "@/wab/shared/geom";

const safe = { left: 80, top: 60, width: 800, height: 660 };
const size = { width: 240, height: 28 };
const owner = { left: 400, top: 300, width: 400, height: 500 };

test("anchors the compact toolbar above the owner's right edge", () => {
  expect(placeContentEditorToolbar(owner, safe, size, [])).toEqual({
    left: 560,
    top: 264,
    maxWidth: 800,
  });
});

test("avoids another canvas toolbar while retaining the owner horizontal boundary", () => {
  const toolbar = { left: 540, top: 260, width: 270, height: 26 };
  const position = placeContentEditorToolbar(owner, safe, size, [toolbar]);
  expect(position.top).toBe(224);
  expect(
    Box.fromRect({ ...position, ...size }).intersects(Box.fromRect(toolbar)),
  ).toBe(false);
});

test.each([
  [{ left: -1000, top: 300, width: 400, height: 500 }, -840, 264],
  [{ left: 1000, top: 300, width: 400, height: 500 }, 1000, 264],
  [{ left: 400, top: -1000, width: 400, height: 500 }, 560, -1036],
] as const)(
  "follows an offscreen component instead of docking to the viewport: %j",
  (bounds, left, top) => {
    expect(placeContentEditorToolbar(bounds, safe, size, [])).toEqual({
      left,
      top,
      maxWidth: 800,
    });
  },
);

test("stops at the component's left edge when its right side is covered by a panel", () => {
  expect(
    placeContentEditorToolbar({ ...owner, left: 800 }, safe, size, []),
  ).toEqual({ left: 800, top: 264, maxWidth: 800 });
});

test("keeps nested entry separate from the current editing toolbar", () => {
  const position = placeContentEditorToolbar(
    { ...owner, top: 70 },
    safe,
    size,
    [{ left: 640, top: 60, ...size }],
  );
  expect(position).toEqual({ left: 560, top: 96, maxWidth: 800 });
});

test("pins vertically clipped content to the viewport top without moving beyond its right edge", () => {
  expect(
    placeContentEditorToolbar({ ...owner, top: 70 }, safe, size, []),
  ).toEqual({ left: 560, top: 60, maxWidth: 800 });
  expect(
    placeContentEditorToolbar({ ...owner, top: -200 }, safe, size, [
      { left: 808, top: 60, width: 72, height: 24 },
    ]),
  ).toEqual({ left: 560, top: 60, maxWidth: 800 });
});

test.each([
  { left: -200, top: 70, width: 700, height: 500 },
  { left: 0, top: 300, width: 500, height: 500 },
  { left: 500, top: 70, width: 700, height: 500 },
])(
  "keeps both toolbar edges inside the visible owner when it fits: %j",
  (bounds) => {
    const position = placeContentEditorToolbar(bounds, safe, size, [
      { left: 500, top: 60, width: 380, height: 28 },
      { left: 300, top: 260, width: 500, height: 28 },
    ]);
    expect(position.left).toBeGreaterThanOrEqual(
      Math.max(bounds.left, safe.left),
    );
    expect(position.left + size.width).toBeLessThanOrEqual(
      Math.min(bounds.left + bounds.width, safe.left + safe.width),
    );
  },
);

test("horizontal collision avoidance cannot move the toolbar outside its owner", () => {
  const position = placeContentEditorToolbar(owner, safe, size, [
    { left: 700, top: 0, width: 110, height: 800 },
  ]);
  expect(position.left).toBe(452);
  expect(position.left + size.width).toBeLessThanOrEqual(
    owner.left + owner.width,
  );
});

test("follows a narrow visible sliver behind the left edge instead of pulling it back onscreen", () => {
  expect(
    placeContentEditorToolbar(
      { ...owner, left: -300, width: 400 },
      safe,
      size,
      [],
    ),
  ).toEqual({ left: -140, top: 264, maxWidth: 800 });
});

test("moves continuously with the component after reaching its left edge", () => {
  const positions = [600, 630, 640, 650, 700, 800, 900].map(
    (left) =>
      placeContentEditorToolbar({ ...owner, left }, safe, size, []).left,
  );
  expect(positions).toEqual([640, 640, 640, 650, 700, 800, 900]);
});

test("does not escape a narrow component or shrink the toolbar to force it onscreen", () => {
  const narrow = { ...owner, left: 400, width: 100 };
  expect(placeContentEditorToolbar(narrow, safe, size, []).left).toBe(400);
  expect(
    placeContentEditorToolbar(owner, { ...safe, width: 120 }, size, []),
  ).toEqual({
    left: 400,
    top: 264,
    maxWidth: 240,
  });
});

test("does not bring an offscreen entry back to avoid another toolbar", () => {
  expect(
    placeContentEditorToolbar({ ...owner, top: -1000 }, safe, size, [
      { left: 560, top: -1036, ...size },
    ]),
  ).toEqual({ left: 560, top: -1036, maxWidth: 800 });
});
