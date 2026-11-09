import { ViewStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import { createStore } from "zustand/vanilla";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { canvasFactory } from "@/wab/client/components/canvas/canvas-factories";

it.each([false, true])("returns no rendered values after disposal, evaluator released: %s", (released) => {
  const read = vi.fn(() => { throw new Error("Disposed evaluator was read"); });
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _isDisposed: true,
    csEvaluator: released ? null : { valState: read },
  });
  expect(view.maybeTpl2ValsInContext(mkTplTagX("div"))).toEqual([]);
  expect(read).not.toHaveBeenCalled();
});

it.each([false, true])("unmounts once and releases frame-owned resources even when unmount fails: %s", (fails) => {
  const unmount = vi.fn(() => { if (fails) { throw new Error("unmount failed"); } });
  const sub = { React: {}, ReactDOM: { flushSync: (fn: () => void) => fn() }, hostUtils: { setPlasmicRootNode: unmount } };
  const build = vi.fn((_owner: object) => ({ value: 1 }));
  const read = canvasFactory(build);
  const subFactory = read(sub), reactFactory = read(sub.React);
  expect(read(sub)).toBe(subFactory); expect(read(sub.React)).toBe(reactFactory);
  const frame = globalHookCtx.createFrameState({ uid: 400, objectPrototype: {} });
  const resize = vi.fn(), mutation = vi.fn(), frameInputs = vi.fn(), packages = vi.fn(), listener = vi.fn();
  const canvas: CanvasCtx = Object.assign(Object.create(CanvasCtx.prototype), {
    Sub: sub, _frameState: frame, _name: "Fixture", bodySizeCleanup: resize,
    pendingBodyWaits: new Set([mutation]), frameInfoOwner: { dispose: frameInputs }, usedPackages: { dispose: packages },
    registrations: new CanvasRegistrations(), disposals: [listener],
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(build).toHaveBeenCalledTimes(2);
    canvas.dispose();
    canvas.dispose();
    expect(unmount).toHaveBeenCalledExactlyOnceWith(null);
    expect(read(sub)).not.toBe(subFactory); expect(read(sub.React)).not.toBe(reactFactory);
    expect(build).toHaveBeenCalledTimes(4);
    expect(globalHookCtx.frames.has(400)).toBe(false);
    for (const cleanup of [resize, mutation, frameInputs, packages, listener]) {
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
  const lease = { isDisposed: false, dispose() { this.isDisposed = true; } };
  const states: boolean[] = [];
  const uncommittedCanvasObservers = new Map();
  const session = new CanvasSessionState();
  const renderOwner = new CanvasRenderOwner(session);
  const models = new ModelSnapshots(), selection = new ViewSelection(() => models);
  const variants = new ViewVariantState(() => models,
    () => { throw new Error("Disposal must not read an uninitialized artboard"); },
    () => { throw new Error("Disposal must not read an uninitialized site"); }, () => false, () => false);
  const viewLifetimeController = new AbortController();
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    viewLifetimeController,
    readySubscriptions: new Set<() => void>(),
    styleInputs: new ViewStyleInputs(() => models, viewLifetimeController.signal),
    textDataRequestsStore: createStore<ReturnType<ViewCtx["textDataRequestsStore"]["getState"]>>(() => Object.freeze({ editing: null, creating: null })),
    variants, selection, canvasSessionState: session, canvasRenderOwner: renderOwner, contextDataSetters: new Map(), frameState: frame, contentEditor: { dispose: vi.fn() },
    canvasCtx: { dispose: canvas }, csEvaluator: { dispose: evaluator },
    canvasObservers: new Set(), uncommittedCanvasObservers, canvasErrorObservers: new Set(), disposals: [],
  });
  view.trackCanvasObserver(lease);
  expect(uncommittedCanvasObservers.size).toBe(1);
  const cleanup = vi.fn(() => {
    states.push(view.isDisposed);
    if (cleanup.mock.calls.length === 1) { view.dispose(); }
  });
  Object.assign(view, { disposals: [cleanup] });
  const factory = canvasFactory((_owner: object) => ({ value: 1 }));
  const previousFactory = factory(view);
  view.dispose();
  view.dispose();
  expect(states).toEqual([true]);
  expect(canvas).toHaveBeenCalledTimes(1);
  expect(evaluator).toHaveBeenCalledTimes(1);
  expect(factory(view)).not.toBe(previousFactory);
  expect(lease.isDisposed).toBe(true);
  expect(view.canvasObservers.size).toBe(0);
  expect(uncommittedCanvasObservers.size).toBe(0);
  expect(view.renderState).toBe(frame.renderState);
  models.dispose();
  expect(view.renderState.fullKey2val("gone")).toBeUndefined();
  frame.dispose();
});
