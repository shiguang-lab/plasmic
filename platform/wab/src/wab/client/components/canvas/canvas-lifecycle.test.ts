import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ownedComputedFn } from "@/wab/shared/mobx-util";
import { observable, onBecomeUnobserved, Reaction } from "mobx";

it.each([false, true])("unmounts once and releases frame-owned resources even when unmount fails: %s", (fails) => {
  const unmount = vi.fn(() => { if (fails) { throw new Error("unmount failed"); } });
  const sub = { React: {}, ReactDOM: { flushSync: (fn: () => void) => fn() }, hostUtils: { setPlasmicRootNode: unmount } };
  const box = observable.box(1);
  const unobserved = vi.fn();
  onBecomeUnobserved(box, unobserved);
  const read = ownedComputedFn((_owner: object) => box.get());
  read(sub);
  read(sub.React);
  const frame = globalHookCtx.createFrameState({ uid: 400, objectPrototype: {} });
  const resize = vi.fn(), mutation = vi.fn(), bridge = vi.fn(), packages = vi.fn(), listener = vi.fn();
  const canvas: CanvasCtx = Object.assign(Object.create(CanvasCtx.prototype), {
    Sub: sub, _frameState: frame, _name: "Fixture", _resizeObserver: { disconnect: resize },
    _mutationObserver: { disconnect: mutation }, bridgeDispose: bridge, usedPkgsDispose: packages, disposals: [listener],
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(unobserved).not.toHaveBeenCalled();
    canvas.dispose();
    canvas.dispose();
    expect(unmount).toHaveBeenCalledExactlyOnceWith(null);
    expect(unobserved).toHaveBeenCalledTimes(1);
    expect(globalHookCtx.frames.has(400)).toBe(false);
    for (const cleanup of [resize, mutation, bridge, packages, listener]) {
      expect(cleanup).toHaveBeenCalledTimes(1);
    }
    expect(log).toHaveBeenCalledTimes(fails ? 1 : 0);
  } finally {
    log.mockRestore();
    frame.dispose();
  }
});

it("marks a view disposed before reentrant cleanup and keeps its render-state handle readable", () => {
  const frame = globalHookCtx.createFrameState({ uid: 401, objectPrototype: {} });
  const evaluator = vi.fn(), canvas = vi.fn();
  const reaction = new Reaction("fixture", () => {});
  const states: boolean[] = [];
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    frameState: frame,
    canvasCtx: { dispose: canvas }, csEvaluator: { dispose: evaluator },
    canvasObservers: new Set([reaction]), disposals: [],
  });
  const cleanup = vi.fn(() => {
    states.push(view.isDisposed);
    if (cleanup.mock.calls.length === 1) { view.dispose(); }
  });
  Object.assign(view, { disposals: [cleanup] });
  const box = observable.box(1), released = vi.fn();
  onBecomeUnobserved(box, released);
  ownedComputedFn((_owner: object) => box.get())(view);
  view.dispose();
  view.dispose();
  expect(states).toEqual([true]);
  expect(canvas).toHaveBeenCalledTimes(1);
  expect(evaluator).toHaveBeenCalledTimes(1);
  expect(released).toHaveBeenCalledTimes(1);
  expect(reaction.isDisposed).toBe(true);
  expect(view.canvasObservers.size).toBe(0);
  expect(view.renderState).toBe(frame.renderState);
  expect(view.renderState.fullKey2val("gone")).toBeUndefined();
  frame.dispose();
});
