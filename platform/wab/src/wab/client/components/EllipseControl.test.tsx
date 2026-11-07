import { EllipseControl } from "@/wab/client/components/EllipseControl";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/commons/components/XDraggable", () => ({
  XDraggable: ({ children, onStart, onDrag }: any) => React.cloneElement(children, {
    onMouseDown: onStart,
    onMouseMove: () => onDrag({ data: { deltaX: 20, deltaY: -10 } }),
  }),
}));

it.each([
  [0, { cx: 60, cy: 40, rx: 20, ry: 20 }],
  [1, { cx: 50, cy: 50, rx: 50, ry: 20 }],
  [2, { cx: 50, cy: 50, rx: 20, ry: 50 }],
  [3, { cx: 50, cy: 50, rx: 10, ry: 20 }],
  [4, { cx: 50, cy: 50, rx: 20, ry: 30 }],
])("uses the SVG's actual dimensions for handle %s", (index, expected) => {
  const onChange = vi.fn();
  const view = render(<EllipseControl ellipse={{ cx: 50, cy: 50, rx: 20, ry: 20 }} onChange={onChange} />);
  const svg = view.container.querySelector("svg") as SVGSVGElement;
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ width: 200, height: 100 } as DOMRect);
  const handle = svg.querySelectorAll("circle")[index];
  fireEvent.mouseDown(handle);
  fireEvent.mouseMove(handle);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(expected);
});
