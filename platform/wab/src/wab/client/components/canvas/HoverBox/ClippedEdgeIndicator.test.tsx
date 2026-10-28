import {
  ClippedEdgeIndicators,
  hiddenDistance,
} from "@/wab/client/components/canvas/HoverBox/ClippedEdgeIndicator";
import {
  canRevealEdge,
  revealEdge,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

vi.mock(
  "@/wab/client/components/canvas/HoverBox/visible-bounds",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    canRevealEdge: vi.fn(),
    revealEdge: vi.fn(),
  }),
);

afterEach(() => {
  vi.mocked(canRevealEdge).mockReset();
  vi.mocked(revealEdge).mockReset();
});

const geometry = { top: 100, left: 20, width: 200, height: 1357 };
const visible = { top: 100, left: 20, width: 200, height: 924 };
const sides = { top: false, right: false, bottom: true, left: false };

it("measures how far the real edge lies past the drawn one", () => {
  expect(hiddenDistance(geometry, visible, "bottom")).toBe(433);
  expect(hiddenDistance(geometry, visible, "top")).toBe(0);
});

it("marks only clipped sides and scrolls a revealable edge into view", () => {
  vi.mocked(canRevealEdge).mockReturnValue(true);
  const element = document.createElement("div");
  const { container } = render(
    <ClippedEdgeIndicators
      elements={[element]}
      geometry={geometry}
      visible={visible}
      clippedSides={sides}
      zoom={1}
    />,
  );
  const markers = container.querySelectorAll("[data-clipped-edge]");
  expect(markers).toHaveLength(1);
  const marker = markers[0] as HTMLButtonElement;
  expect(marker.dataset.clippedEdge).toBe("bottom");
  expect(marker.textContent).toBe("433");
  // A real icon, not a text glyph.
  expect(marker.querySelector("svg")).toBeTruthy();
  expect(marker.getAttribute("aria-label")).toBe(
    "433px more below. Click to scroll to the bottom edge.",
  );
  fireEvent.click(marker);
  expect(revealEdge).toHaveBeenCalledWith([element], "bottom");
});

it("explains edges that can't be scrolled into view and does nothing on click", () => {
  vi.mocked(canRevealEdge).mockReturnValue(false);
  const { container } = render(
    <ClippedEdgeIndicators
      elements={[document.createElement("div")]}
      geometry={geometry}
      visible={visible}
      clippedSides={sides}
      zoom={1}
    />,
  );
  const marker = container.querySelector(
    "[data-clipped-edge]",
  ) as HTMLButtonElement;
  expect(marker.getAttribute("aria-disabled")).toBe("true");
  expect(marker.getAttribute("aria-label")).toBe(
    "433px below is cut off and can't be scrolled into view. Change the size in the right panel.",
  );
  fireEvent.click(marker);
  expect(revealEdge).not.toHaveBeenCalled();
});

it("leaves edges too short on screen unmarked", () => {
  const { container } = render(
    <ClippedEdgeIndicators
      elements={[]}
      geometry={geometry}
      visible={{ ...visible, width: 40 }}
      clippedSides={sides}
      zoom={1}
    />,
  );
  expect(container.querySelector("[data-clipped-edge]")).toBeNull();
});
