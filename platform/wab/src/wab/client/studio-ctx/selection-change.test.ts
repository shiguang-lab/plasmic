import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { TplTag } from "@/wab/shared/model/classes";
import { waitFor } from "@testing-library/react";
import $ from "jquery";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const baseVariant = mkBaseVariant();
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    variants: [baseVariant],
    tplTree: mkTplTagX("div", { baseVariant, styles: {} }),
  });
  site.components.push(component);
  const arena = mkMixedArena("Selection");
  const frame = mkArenaFrame({
    site,
    component,
    name: "Page",
    width: 100,
    height: 100,
    left: 0,
    top: 0,
  });
  arena.children.push(frame);
  site.arenas.push(arena);
  const { studioCtx: sc } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Selection",
  });
  await waitFor(() => expect(sc.initialRouteReady).toBe(true));
  const vc = ensure(sc.tryGetViewCtxForFrame(frame), "View context");
  Object.assign(vc.canvasCtx, { getRegisteredLibraries: () => [] });
  vi.spyOn(vc, "isVisible").mockReturnValue(false);
  sc.dbCtx().maybeObserveComponents([vc.component]);
  vi.spyOn(vc, "awaitSync").mockResolvedValue();
  vi.spyOn(vc, "updateCtxPostChange").mockImplementation(() => {});
  expect(sc.currentArena).toBe(arena);
  const sync = vi.spyOn(vc, "scheduleSync").mockImplementation(() => {});
  return { sc, vc, sync };
}

it("selects and clears without entering a model transaction or scheduling evaluation", async () => {
  const { sc, vc, sync } = await setup();
  const change = vi.spyOn(sc, "changeUnsafe");
  vi.useFakeTimers();
  try {
    sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree));
    expect(vc.focusedTpl()).toBe(vc.component.tplTree);
    expect(sc.isSelectionPending).toBe(true);
    sc.changeSelection(() =>
      sc.setStudioFocusOnFrame({ frame: undefined, autoZoom: false }),
    );
    expect(sc.focusedViewCtx()).toBeUndefined();
    expect(change).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(sc.isSelectionPending).toBe(false);
  } finally {
    sc.dispose();
    vi.useRealTimers();
  }
});

it("keeps real edits undoable across transient selection changes and preserves redo", async () => {
  const { sc, vc } = await setup();
  try {
    const root = ensureInstance(vc.component.tplTree, TplTag);
    const name = root.name;
    await sc.changeUnsafe(() => {
      root.name = "Edited";
    });
    sc.changeSelection(() => vc.setStudioFocusByTpl(root));
    await sc.undo();
    expect(root.name).toBe(name);
    sc.changeSelection(() =>
      sc.setStudioFocusOnFrame({ frame: undefined, autoZoom: false }),
    );
    expect(sc.canRedo()).toBe(true);
    await sc.redo();
    expect(root.name).toBe("Edited");
  } finally {
    sc.dispose();
  }
});

it("coalesces canvas observers and refreshes selection DOM without an evaluation", () => {
  vi.useFakeTimers();
  const render = vi.fn();
  const update = vi.fn();
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _canvasRerenderQueue: new Set(),
    studioCtx: { hasPendingModelChanges: () => false },
    syncQueue: { idle: () => true },
    canvasCtx: {
      Sub: { ReactDOM: { unstable_batchedUpdates: (f: () => void) => f() } },
    },
    updateCtxPostChange: update,
  });
  try {
    view.addRerenderObserver(render);
    view.addRerenderObserver(render);
    expect(render).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(render).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("leaves queued observers to an in-progress evaluation instead of polling paused frames", () => {
  vi.useFakeTimers();
  const render = vi.fn();
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _canvasRerenderQueue: new Set(),
    studioCtx: { hasPendingModelChanges: () => false },
    syncQueue: { idle: () => false },
    canvasCtx: {
      Sub: { ReactDOM: { unstable_batchedUpdates: (f: () => void) => f() } },
    },
  });
  try {
    view.addRerenderObserver(render);
    vi.advanceTimersByTime(100);
    expect(render).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    view.flushRerenderQueue();
    expect(render).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("resolves a selected tpl to its ValNode and DOM when hidden content mounts later", async () => {
  const { sc, vc, sync } = await setup();
  try {
    const tpl = ensureInstance(vc.component.tplTree, TplTag);
    const dom = document.createElement("div");
    const lookup = vi
      .spyOn(vc, "maybeDomsForTpl")
      .mockReturnValue([null, null]);
    sc.changeSelection(() => vc.setStudioFocusByTpl(tpl));
    expect(vc.focusedSelectable()).toBeNull();
    const val = new ValTag({
      tpl,
      children: [],
      className: "",
      key: "root",
      fullKey: "root",
      frameUid: 1,
      fibers: [],
      parent: undefined,
      valOwner: undefined,
      slotInfo: undefined,
    });
    lookup.mockReturnValue([val, [dom]]);
    vi.spyOn(vc, "selectionDom").mockReturnValue($(dom));
    vi.spyOn(vc, "sel2cloneKey").mockReturnValue("root");
    expect(vc.recomputeFocusedDomElts()).toBe(true);
    expect(vc.focusedSelectable()).toBe(val);
    expect(vc.focusedDomElt()?.[0]).toBe(dom);
    expect(sync).not.toHaveBeenCalled();
  } finally {
    sc.dispose();
  }
});
