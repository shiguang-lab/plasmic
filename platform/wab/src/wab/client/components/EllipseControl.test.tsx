import { EllipseControl } from "@/wab/client/components/EllipseControl";
import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ app: { setIsDragging: vi.fn() } }));
vi.mock("@/wab/client/components/top-view", () => ({ useApp: () => fixture.app }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("measures the native SVG drag in percentages and preserves its start ellipse", () => {
  const onChange = vi.fn();
  const ellipse = { cx: 50, cy: 40, rx: 20, ry: 10 };
  const mounted = render(<EllipseControl ellipse={ellipse} onChange={onChange} />);
  const svg = mounted.container.querySelector("svg")!;
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 100));
  const center = mounted.container.querySelector("circle")!;
  fireEvent.mouseDown(center, { clientX: 100, clientY: 40 });
  fireEvent.mouseMove(document, { clientX: 106, clientY: 40 });
  fireEvent.mouseMove(document, { clientX: 120, clientY: 50 });
  expect(onChange.mock.lastCall?.[0]).toEqual({ ...ellipse, cx: 60, cy: 50 });
  mounted.rerender(<EllipseControl ellipse={{ ...ellipse, cx: 60 }} onChange={onChange} />);
  fireEvent.mouseMove(document, { clientX: 140, clientY: 60 });
  expect(onChange.mock.lastCall?.[0]).toEqual({ ...ellipse, cx: 70, cy: 60 });
  fireEvent.mouseUp(document, { clientX: 140, clientY: 60 });
});
