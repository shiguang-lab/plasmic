import { XDraggable } from "@/wab/commons/components/XDraggable";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ app: { setIsDragging: vi.fn() } }));
vi.mock("@/wab/client/components/top-view", () => ({
  useApp: () => fixture.app,
}));
afterEach(() => {
  cleanup();
  fixture.app.setIsDragging.mockClear();
});

it.each([false, true])("drags the actual native element with no added wrapper, SVG: %s", (svg) => {
  const onStart = vi.fn(), onDrag = vi.fn(), onStop = vi.fn();
  const child = svg ? <circle data-testid="handle" cx={10} cy={20} r={5} /> : <div data-testid="handle">Handle</div>;
  const draggable = <XDraggable minPx={0} onStart={onStart} onDrag={onDrag} onStop={onStop}>{child}</XDraggable>;
  const view = render(svg ? <svg>{draggable}</svg> : draggable);
  const handle = screen.getByTestId("handle");
  expect(svg ? handle.parentElement?.tagName : handle.parentElement).toBe(svg ? "svg" : view.container);
  fireEvent.mouseDown(handle, { clientX: 10, clientY: 20 });
  fireEvent.mouseMove(document, { clientX: 50, clientY: 70 });
  fireEvent.mouseUp(document, { clientX: 50, clientY: 70 });
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onDrag).toHaveBeenCalledTimes(1);
  expect(onStop).toHaveBeenCalledTimes(1);
  expect(onDrag.mock.lastCall?.[0].draggableData.node).toBe(handle);
  expect(onDrag.mock.lastCall?.[0].data).toMatchObject({ deltaX: 40, deltaY: 50, started: true, aborted: false });
  expect(fixture.app.setIsDragging.mock.calls).toEqual([[true], [false]]);
});

it("keeps the owner's native ref and mouse behavior intact", () => {
  const ref = React.createRef<HTMLDivElement>();
  const onClick = vi.fn(), onStart = vi.fn();
  render(<XDraggable nodeRef={ref} minPx={0} onStart={onStart}>
    <div ref={ref} data-testid="handle" onClick={onClick}>Owned handle</div>
  </XDraggable>);
  const handle = screen.getByTestId("handle");
  expect(ref.current).toBe(handle);
  fireEvent.mouseDown(handle, { clientX: 5, clientY: 6 });
  expect(onStart.mock.lastCall?.[0].draggableData.node).toBe(handle);
  fireEvent.mouseUp(document, { clientX: 5, clientY: 6 });
  fireEvent.click(handle);
  expect(onClick).toHaveBeenCalledTimes(1);
});

it("preserves the threshold and emits one aborted stop for Escape", () => {
  const onStart = vi.fn(), onDrag = vi.fn(), onStop = vi.fn();
  const view = render(<XDraggable onStart={onStart} onDrag={onDrag} onStop={onStop}><div data-testid="handle" /></XDraggable>);
  fireEvent.mouseDown(screen.getByTestId("handle"), { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 2, clientY: 0 });
  expect(onStart).not.toHaveBeenCalled();
  fireEvent.mouseMove(document, { clientX: 6, clientY: 0 });
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onDrag).not.toHaveBeenCalled();
  fireEvent.mouseMove(document, { clientX: 12, clientY: 0 });
  expect(onDrag).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
  expect(onStop).toHaveBeenCalledTimes(1);
  expect(onStop.mock.lastCall?.[0].data).toMatchObject({ aborted: true, started: false });
  fireEvent.mouseUp(document, { clientX: 12, clientY: 0 });
  expect(onStop).toHaveBeenCalledTimes(1);
  view.unmount();
  fireEvent.mouseMove(document, { clientX: 24, clientY: 0 });
  expect(onDrag).toHaveBeenCalledTimes(1);
});

it("ends an active drag once when its native owner unmounts", () => {
  const onStop = vi.fn();
  const mounted = render(<XDraggable minPx={0} onStop={onStop}><div data-testid="handle" /></XDraggable>);
  fireEvent.mouseDown(screen.getByTestId("handle"), { clientX: 0, clientY: 0 });
  mounted.unmount();
  expect(onStop).toHaveBeenCalledOnce();
  expect(onStop.mock.lastCall?.[0].data).toMatchObject({ aborted: true, started: false });
  expect(fixture.app.setIsDragging.mock.calls).toEqual([[true], [false]]);
  fireEvent.mouseUp(document, { clientX: 20, clientY: 20 });
  expect(onStop).toHaveBeenCalledOnce();
});
