import { createStudioStore } from "@/wab/client/stores/store-kit";
import { useFrameValue } from "@/wab/client/stores/use-frame-value";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

it("reads the new store and selector without waiting for another write", () => {
  const first = createStudioStore(() => ({ a: 1, b: 2 }));
  const second = createStudioStore(() => ({ a: 3, b: 4 }));
  const subscribe = vi.spyOn(first, "subscribe");
  function Probe({ store, field }: { store: typeof first; field: "a" | "b" }) {
    return <output>{useFrameValue(store, (state) => state[field])}</output>;
  }
  const { rerender } = render(<Probe store={first} field="a" />);
  rerender(<Probe store={first} field="b" />);
  expect(screen.getByRole("status").textContent).toBe("2");
  expect(subscribe).toHaveBeenCalledTimes(1);
  rerender(<Probe store={second} field="b" />);
  expect(screen.getByRole("status").textContent).toBe("4");
});

it("cancels a queued frame when its consumer unmounts", () => {
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(1, callback); return 1; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
  const store = createStudioStore(() => ({ value: 0 }));
  function Probe() { useFrameValue(store, (state) => state.value); return null; }
  try {
    const { unmount } = render(<Probe />);
    act(() => { store.setState({ value: 1 }); });
    expect(frames.size).toBe(1);
    unmount(); expect(frames.size).toBe(0);
  } finally { vi.unstubAllGlobals(); }
});

it("catches writes between rendering and subscription", () => {
  const store = createStudioStore(() => ({ value: 0 }));
  function Probe() { return <output>{useFrameValue(store, (state) => state.value)}</output>; }
  function Parent() {
    React.useLayoutEffect(() => { store.setState({ value: 1 }); }, []);
    return <Probe />;
  }
  render(<Parent />);
  expect(screen.getByRole("status").textContent).toBe("1");
});

/** Longer than one frame, so the coalesced notification has fired. */
function waitOneFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

it("coalesces several updates into a single render", async () => {
  const store = createStudioStore<{ value: number }>(() => ({ value: 0 }), {
    name: "frame-test",
  });
  let renders = 0;

  function Probe() {
    const value = useFrameValue(store, (state) => state.value);
    renders += 1;
    return <output data-testid="value">{value}</output>;
  }

  render(<Probe />);
  expect(screen.getByTestId("value").textContent).toBe("0");
  const before = renders;

  await act(async () => {
    store.setState({ value: 1 });
    store.setState({ value: 2 });
    store.setState({ value: 3 });
    await waitOneFrame();
  });

  expect(screen.getByTestId("value").textContent).toBe("3");
  expect(renders - before).toBe(1);
});

it("does not render when the selected value is unchanged", async () => {
  const store = createStudioStore<{ selected: number; other: number }>(
    () => ({ selected: 0, other: 0 }),
  );
  let renders = 0;

  function Probe() {
    const selected = useFrameValue(store, (state) => state.selected);
    renders += 1;
    return <output data-testid="selected">{selected}</output>;
  }

  render(<Probe />);
  const before = renders;

  await act(async () => {
    store.setState({ other: 1 });
    await waitOneFrame();
  });

  expect(renders).toBe(before);
});

it("honors a custom equality before scheduling a render", async () => {
  type Point = { x: number; y: number };
  const store = createStudioStore<{ point: Point }>(() => ({
    point: { x: 0, y: 0 },
  }));
  const equals = (previous: Point, next: Point) =>
    previous.x === next.x && previous.y === next.y;
  let renders = 0;

  function Probe() {
    const point = useFrameValue(store, (state) => state.point, { equals });
    renders += 1;
    return <output data-testid="point">{`${point.x},${point.y}`}</output>;
  }

  render(<Probe />);
  const before = renders;

  // A new object that is equal by the custom comparison must not render.
  await act(async () => {
    store.setState({ point: { x: 0, y: 0 } });
    await waitOneFrame();
  });
  expect(renders).toBe(before);

  await act(async () => {
    store.setState({ point: { x: 1, y: 0 } });
    await waitOneFrame();
  });
  expect(screen.getByTestId("point").textContent).toBe("1,0");
  expect(renders - before).toBe(1);
});
