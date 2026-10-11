import { getSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { Box } from "@/wab/shared/geom";
import $ from "jquery";

function element(box: Box, visible = true) {
  const elt = document.createElement("div");
  Object.defineProperty(elt, "offsetWidth", {
    value: visible ? box.width() : 0,
  });
  Object.defineProperty(elt, "offsetHeight", {
    value: visible ? box.height() : 0,
  });
  vi.spyOn(elt, "getBoundingClientRect").mockReturnValue(
    new DOMRect(box.left(), box.top(), box.width(), box.height()),
  );
  return elt;
}

it("merges disjoint and multi-root nodes in artboard coordinates", () => {
  const first = $(element(new Box(20, 10, 30, 40)));
  const second = $([
    element(new Box(10, 100, 20, 50)),
    element(new Box(80, 150, 40, 20)),
  ]);
  expect(getSelectionBounds([first, second])?.rect()).toEqual(
    new Box(10, 10, 180, 90).rect(),
  );
});

it("ignores missing and hidden DOM nodes and handles no visible selection", () => {
  const hidden = $(element(new Box(0, 0, 1000, 1000), false));
  const visible = $(element(new Box(20, 10, 30, 40)));
  expect(getSelectionBounds([hidden, null, visible])?.rect()).toEqual(
    new Box(20, 10, 30, 40).rect(),
  );
  expect(getSelectionBounds([hidden, null])).toBeUndefined();
});
