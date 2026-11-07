import {
  isContextMenuOpen,
  maybeShowContextMenu,
  useContextMenu,
} from "@/wab/client/components/ContextMenu";
import { plasmicIFrameWheelEvent } from "@/wab/client/definitions/events";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

let active: ReturnType<typeof maybeShowContextMenu>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => active?.destroy());
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function open(menu = <button>Action</button>) {
  const event = new MouseEvent("contextmenu", { cancelable: true });
  act(() => {
    active = maybeShowContextMenu(event, menu, { pageX: 20, pageY: 40 });
  });
  return event;
}

it("prevents the native menu, allows one root, and destroys it idempotently", () => {
  const original = document.body.children.length;
  const event = open();
  expect(event.defaultPrevented).toBe(true);
  expect(isContextMenuOpen()).toBe(true);
  expect(screen.getByRole("button", { name: "Action" })).toBeTruthy();
  expect(maybeShowContextMenu(new MouseEvent("contextmenu"), <b>Duplicate</b>)).toBeUndefined();
  expect(screen.queryByText("Duplicate")).toBeNull();
  act(() => { active?.destroy(); active?.destroy(); });
  expect(isContextMenuOpen()).toBe(false);
  expect(document.body.children.length).toBe(original);
  const old = active;
  open(<button>Reopened</button>);
  act(() => old?.destroy());
  expect(isContextMenuOpen()).toBe(true);
  expect(screen.getByRole("button", { name: "Reopened" })).toBeTruthy();
});

it.each(["escape", "wheel", "canvas-wheel"])("closes and cleans the portal on %s", (kind) => {
  open();
  act(() => {
    if (kind === "escape") {
      fireEvent.keyDown(document, { key: "Escape", keyCode: 27 });
    } else {
      document.body.dispatchEvent(new Event(kind === "wheel" ? "wheel" : plasmicIFrameWheelEvent, { bubbles: true }));
    }
  });
  expect(isContextMenuOpen()).toBe(false);
  expect(screen.queryByRole("button", { name: "Action" })).toBeNull();
});

it("runs the selected action before deferred click cleanup", () => {
  const action = vi.fn();
  open(<button onClick={action}>Run</button>);
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  expect(action).toHaveBeenCalledTimes(1);
  act(() => vi.runOnlyPendingTimers());
  expect(isContextMenuOpen()).toBe(false);
});

it("cleans an owner's independent root when the owner unmounts", () => {
  function Owner() {
    const handlers = useContextMenu({ menu: <button>Owned</button> });
    return <div {...handlers}>Owner</div>;
  }
  const view = render(<Owner />);
  fireEvent.contextMenu(screen.getByText("Owner"));
  expect(isContextMenuOpen()).toBe(true);
  view.unmount();
  expect(isContextMenuOpen()).toBe(false);
  expect(screen.queryByRole("button", { name: "Owned" })).toBeNull();
});

it("does not allocate a root for an absent menu", () => {
  const count = document.body.children.length;
  expect(maybeShowContextMenu(new MouseEvent("contextmenu"), null)).toBeUndefined();
  expect(document.body.children.length).toBe(count);
  expect(isContextMenuOpen()).toBe(false);
});
