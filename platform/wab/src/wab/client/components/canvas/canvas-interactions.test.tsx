import { absorbEditingCanvasEvent } from "@/wab/client/components/canvas/canvas-interactions";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ PLATFORM: "osx" }));
vi.mock("@/wab/client/platform", () => platform);

it.each(["edit", "interactive", "live", "text"])(
  "keeps selection separate from runtime handlers in %s mode",
  (mode) => {
    const click = vi.fn();
    const pointer = vi.fn();
    const doubleClick = vi.fn();
    const viewCtx = {
      studioCtx: {
        isLiveMode: mode === "live",
        isInteractiveMode: mode === "interactive",
      },
      viewOps: { isEditing: () => mode === "text" },
    } as unknown as ViewCtx;
    const container = document.createElement("div");
    document.body.append(container);
    const absorb = (event: Event) => absorbEditingCanvasEvent(event, viewCtx);
    container.addEventListener("click", absorb, true);
    container.addEventListener("dblclick", absorb, true);
    const view = render(
      <button onClick={click} onPointerDown={pointer} onDoubleClick={doubleClick}>
        Canvas image
      </button>,
      { container },
    );
    fireEvent.pointerDown(view.getByRole("button"));
    fireEvent.click(view.getByRole("button"));
    fireEvent.doubleClick(view.getByRole("button"));
    expect(pointer).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledTimes(mode === "edit" ? 0 : 1);
    expect(doubleClick).toHaveBeenCalledTimes(mode === "edit" ? 0 : 1);
    view.unmount();
    container.remove();
  },
);

it.each([
  ["osx", { metaKey: true }, true],
  ["osx", { ctrlKey: true }, false],
  ["windows", { ctrlKey: true }, true],
  ["windows", { metaKey: true }, false],
  ["linux", { ctrlKey: true }, true],
  ["osx", {}, false],
  ["osx", { metaKey: true, altKey: true }, false],
  ["osx", { metaKey: true, shiftKey: true }, false],
  ["osx", { metaKey: true, button: 2 }, false],
] as const)("routes the %s canvas modifier without browser default actions: %j", (os, modifiers, allowed) => {
  platform.PLATFORM = os;
  const click = vi.fn();
  const viewCtx = {
    studioCtx: { isLiveMode: false, isInteractiveMode: false },
    viewOps: { isEditing: () => false },
  } as unknown as ViewCtx;
  const container = document.createElement("div");
  document.body.append(container);
  container.addEventListener("click", (event) => absorbEditingCanvasEvent(event, viewCtx), true);
  const view = render(<a href="/another-page" onClick={click}>Native control</a>, { container });
  expect(fireEvent.click(view.getByRole("link"), modifiers)).toBe(false);
  expect(click).toHaveBeenCalledTimes(allowed ? 1 : 0);
  if (allowed) expect(click.mock.calls[0][0].defaultPrevented).toBe(true);
  view.unmount();
  container.remove();
});

it.each([
  ["osx", { metaKey: true }, true],
  ["windows", { ctrlKey: true }, true],
  ["osx", {}, false],
] as const)("routes a %s modifier click through the canvas overlay exactly once", (os, modifiers, allowed) => {
  platform.PLATFORM = os;
  const click = vi.fn();
  const hitTest = vi.fn(() => view.getByRole("button"));
  const viewCtx = {
    studioCtx: { isLiveMode: false, isInteractiveMode: false },
    viewOps: { isEditing: () => false },
    canvasCtx: { getActualTargetUnderCanvasOverlay: hitTest },
  } as unknown as ViewCtx;
  const container = document.createElement("div");
  document.body.append(container);
  container.addEventListener("click", (event) => absorbEditingCanvasEvent(event, viewCtx), true);
  const view = render(<><button onClick={click}>Native control</button><div className="__wab_canvas_overlay" data-testid="overlay" /></>, { container });
  fireEvent.click(view.getByTestId("overlay"), { ...modifiers, clientX: 10, clientY: 20 });
  expect(hitTest).toHaveBeenCalledTimes(allowed ? 1 : 0);
  expect(click).toHaveBeenCalledTimes(allowed ? 1 : 0);
  if (allowed) {
    expect(hitTest).toHaveBeenCalledWith(10, 20);
    expect(click.mock.calls[0][0].defaultPrevented).toBe(true);
    expect(click.mock.calls[0][0].metaKey).toBe(os === "osx");
    expect(click.mock.calls[0][0].ctrlKey).toBe(os === "windows");
  }
  view.unmount();
  container.remove();
});
