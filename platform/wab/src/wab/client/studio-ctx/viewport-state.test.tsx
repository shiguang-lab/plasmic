import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  subscribeViewport,
  useCanvasTransforming,
  useCanvasZoom,
  useViewportValue,
} from "@/wab/client/studio-ctx/viewport-state";
import { ensure } from "@/wab/shared/common";
import { Pt } from "@/wab/shared/geom";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("isolates zoom, scroll and transform subscribers and retains equal geometry snapshots", () => {
  vi.useFakeTimers();
  const owner = createViewportFixture();
  const studio = owner as unknown as StudioCtx;
  const viewport = ensure(owner.viewportCtx, "Viewport");
  const zoomCommits = vi.fn(),
    scrollCommits = vi.fn(),
    transformCommits = vi.fn();
  function Zoom() {
    const zoom = useCanvasZoom(studio);
    return (
      <React.Profiler id="zoom" onRender={zoomCommits}>
        <output aria-label="zoom">{zoom}</output>
      </React.Profiler>
    );
  }
  function Scroll() {
    const scroll = useViewportValue(studio, (state) => state.scroll);
    return (
      <React.Profiler id="scroll" onRender={scrollCommits}>
        <output aria-label="scroll">{scroll.x}</output>
      </React.Profiler>
    );
  }
  function Transform() {
    const transforming = useCanvasTransforming(studio);
    return (
      <React.Profiler id="transform" onRender={transformCommits}>
        <output aria-label="transform">{String(transforming)}</output>
      </React.Profiler>
    );
  }
  render(
    <React.StrictMode>
      <Zoom />
      <Scroll />
      <Transform />
    </React.StrictMode>,
  );
  zoomCommits.mockClear();
  scrollCommits.mockClear();
  transformCommits.mockClear();
  act(() => viewport.setScroll(new Pt(10, 20)));
  expect(screen.getByLabelText("scroll").textContent).toBe("10");
  expect(scrollCommits).toHaveBeenCalledOnce();
  expect(zoomCommits).not.toHaveBeenCalled();
  expect(transformCommits).not.toHaveBeenCalled();
  const before = viewport.store.getState();
  act(() => {
    for (let i = 0; i < 100; i++) {
      viewport.setScroll(new Pt(10, 20));
    }
  });
  expect(viewport.store.getState()).toBe(before);
  expect(scrollCommits).toHaveBeenCalledOnce();
  act(() => viewport.enqueueTransform(2, Pt.zero(), false));
  expect(screen.getByLabelText("zoom").textContent).toBe("2");
  expect(screen.getByLabelText("transform").textContent).toBe("true");
  expect(zoomCommits).toHaveBeenCalledOnce();
  expect(transformCommits).toHaveBeenCalledOnce();
  expect(viewport.store.getState().scroll).toBe(before.scroll);
  expect(viewport.store.getState().clipperBox).toBe(before.clipperBox);
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.getByLabelText("transform").textContent).toBe("false");
  expect(zoomCommits).toHaveBeenCalledOnce();
  expect(scrollCommits).toHaveBeenCalledOnce();
});

it("rebinds ownership and releases obsolete viewport subscriptions", () => {
  const owner = createViewportFixture();
  const studio = owner as unknown as StudioCtx;
  const first = ensure(owner.viewportCtx, "First viewport");
  const second = ensure(createViewportFixture().viewportCtx, "Second viewport");
  const publish = vi.fn();
  const stop = subscribeViewport(studio, (state) => state.scale, publish);
  first.setScroll(new Pt(20, 30));
  expect(publish).not.toHaveBeenCalled();
  first.enqueueTransform(2, Pt.zero(), false);
  expect(publish).toHaveBeenLastCalledWith(2, 1);
  owner.viewportCtx = second;
  expect(publish).toHaveBeenLastCalledWith(1, 2);
  first.enqueueTransform(3, Pt.zero(), false);
  expect(publish).toHaveBeenCalledTimes(2);
  second.enqueueTransform(4, Pt.zero(), false);
  expect(publish).toHaveBeenLastCalledWith(4, 1);
  stop();
  second.enqueueTransform(5, Pt.zero(), false);
  owner.viewportCtx = null;
  expect(publish).toHaveBeenCalledTimes(3);
});

it("cancels the settling timer and ignores commands after viewport disposal", () => {
  vi.useFakeTimers();
  const viewport = ensure(createViewportFixture().viewportCtx, "Viewport");
  const publish = vi.fn();
  const stop = viewport.store.subscribe(publish);
  viewport.enqueueTransform(2, Pt.zero(), false);
  expect(publish).toHaveBeenCalledOnce();
  const snapshot = viewport.store.getState();
  viewport.dispose();
  vi.runAllTimers();
  viewport.setScroll(new Pt(30, 40));
  viewport.enqueueTransform(3, Pt.zero(), false);
  expect(viewport.store.getState()).toBe(snapshot);
  expect(publish).toHaveBeenCalledOnce();
  stop();
});
