import { SimpleReorderableList } from "@/wab/client/components/widgets/SimpleReorderableList";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

function Row({ name }: { name: string; isDragging?: boolean }) {
  return <span>{name}</span>;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = this.hasAttribute("data-rfd-draggable-id") ? ["a", "b", "c"].indexOf(this.getAttribute("data-rfd-draggable-id") ?? "") : 0;
    const top = Math.max(0, index) * 30;
    const height = this.tagName === "UL" ? 90 : 30;
    return { top, left: 0, right: 200, bottom: top + height, width: 200, height, x: 0, y: top, toJSON: () => ({}) };
  });
});
afterEach(cleanup);

it.each([false, true])("preserves keyboard reorder and cancellation, cancel: %s", async (cancel) => {
  const onReordered = vi.fn();
  render(<SimpleReorderableList onReordered={onReordered}>
    <Row key="a" name="A" />
    <Row key="b" name="B" />
    <Row key="c" name="C" />
  </SimpleReorderableList>);
  const handle = screen.getAllByRole("button")[0];
  handle.focus();
  fireEvent.keyDown(handle, { key: " ", code: "Space", keyCode: 32 });
  await waitFor(() => expect(document.querySelector('[aria-live="assertive"]')?.textContent).toContain("lifted"));
  fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  fireEvent.keyDown(window, cancel
    ? { key: "Escape", code: "Escape", keyCode: 27 }
    : { key: " ", code: "Space", keyCode: 32 });
  // jsdom does not run CSS transitions; complete the real drop animation's
  // transition protocol before checking the result.
  const dragging = document.querySelector('[data-rfd-draggable-id="a"]');
  if (dragging) {
    const end = new Event("transitionend", { bubbles: true });
    Object.defineProperty(end, "propertyName", { value: "transform" });
    fireEvent(dragging, end);
  }
  await waitFor(() => expect(document.querySelector('[aria-live="assertive"]')?.textContent).toContain(cancel ? "cancelled" : "dropped"));
  if (cancel) {
    expect(onReordered).not.toHaveBeenCalled();
  } else {
    expect(onReordered).toHaveBeenCalledExactlyOnceWith(0, 1);
  }
});
