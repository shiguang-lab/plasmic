import { HandlePosition, ResizingHandle } from "@/wab/client/components/ResizingHandle";
import { plasmicCanvasTransformEvent } from "@/wab/client/definitions/events";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ clipper: undefined as HTMLElement | undefined, callbacks: [] as FrameRequestCallback[] }));
vi.mock("@/wab/client/contexts/StudioContexts", () => {
  const studio = { maybeCanvasClipper: () => fixture.clipper };
  return { useStudioCtx: () => studio };
});
vi.mock("@/wab/commons/components/XDraggable", () => ({ XDraggable: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); fixture.callbacks = []; });
it("measures with the current zoom and ignores callbacks queued by a retired measurement", () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { fixture.callbacks.push(callback); return fixture.callbacks.length; });
  const box = { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(box);
  fixture.clipper = document.createElement("div");
  const onDrag = vi.fn();
  const field = (zoom: number) => <div><ResizingHandle position={HandlePosition.left} zoom={zoom} onDrag={onDrag} /></div>;
  const view = render(field(1));
  const first = fixture.callbacks.shift();
  view.rerender(field(2));
  const current = fixture.callbacks.shift();
  const handle = view.container.firstElementChild?.firstElementChild as HTMLElement;
  act(() => current?.(0));
  expect(handle.style.height).toBe("50px");
  act(() => first?.(0));
  expect(handle.style.height).toBe("50px");
  window.dispatchEvent(new Event(plasmicCanvasTransformEvent));
  view.unmount();
  expect(() => act(() => fixture.callbacks.shift()?.(0))).not.toThrow();
});
