import { FloatingWindow } from "@/wab/client/components/widgets/FloatingWindow";
import { ensure } from "@/wab/shared/common";
import { Box } from "@/wab/shared/geom";
import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/dom-utils", () => ({
  isWithinPointerInteractiveElement: () => false,
}));

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const windowEl = this.closest<HTMLElement>(".floating-window");
      const [x, y] = (windowEl?.style.transform.match(/-?[\d.]+/g) ?? [0, 0]).map(Number);
      return new DOMRect(650 + x, 40 + y, 300, this === windowEl ? 240 : 50);
    },
  );
});
afterEach(cleanup);

function anchor(left: number, top: number) {
  return Box.fromRectSides({ left, top, right: left + 20, bottom: top + 20 });
}

function dialog(initialAnchor?: Box) {
  return (
    <FloatingWindow
      handleSelector=".handle"
      initialWidth={300}
      initialAnchor={initialAnchor}
      disableHeightResize
    >
      <div className="handle">Comment</div>
    </FloatingWindow>
  );
}

function getWindow(container: HTMLElement) {
  return ensure(container.querySelector<HTMLElement>(".floating-window"), "Floating window");
}

it("opens beside the marker using viewport coordinates", () => {
  const { container } = render(dialog(anchor(200, 300)));
  const bounds = getWindow(container).getBoundingClientRect();
  expect(bounds.left).toBe(228);
  expect(bounds.top).toBe(300);
});

it("flips to the left and stays above the bottom viewport edge", () => {
  const { container } = render(dialog(anchor(900, 720)));
  const bounds = getWindow(container).getBoundingClientRect();
  expect(bounds.right).toBe(892);
  expect(bounds.bottom).toBe(window.innerHeight);
});

it("repositions when another marker opens the same mounted dialog", () => {
  const { container, rerender } = render(dialog(anchor(200, 300)));
  rerender(dialog(anchor(500, 200)));
  const bounds = getWindow(container).getBoundingClientRect();
  expect(bounds.left).toBe(528);
  expect(bounds.top).toBe(200);
});

it("keeps the default position for entry points without a marker", () => {
  const { container } = render(dialog());
  expect(getWindow(container).style.transform).toBe("translate(0px, 0px)");
});

it("can be dragged after opening beside a marker", () => {
  const initialAnchor = anchor(200, 300);
  const { container, getByText, rerender } = render(dialog(initialAnchor));
  const handle = getByText("Comment");
  handle.setPointerCapture = vi.fn();
  function pointer(type: string, x: number, y: number) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      isPrimary: { value: true },
    });
    return event;
  }
  fireEvent(handle, pointer("pointerdown", 240, 310));
  fireEvent(document, pointer("pointermove", 290, 340));
  fireEvent(document, pointer("pointerup", 290, 340));
  rerender(dialog(initialAnchor));
  const bounds = getWindow(container).getBoundingClientRect();
  expect(bounds.left).toBe(278);
  expect(bounds.top).toBe(330);
});
