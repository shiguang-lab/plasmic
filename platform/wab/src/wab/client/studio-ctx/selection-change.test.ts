import { createCanvasPartTextEditor } from "@/wab/client/components/canvas/canvas-part-text-editor";
import { getContentEditorTarget } from "@/wab/client/studio-ctx/canvas-content-editor";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { canEditInspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { TplTag, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { waitFor } from "@testing-library/react";
import $ from "jquery";
import { autorun, runInAction } from "mobx";

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

it("publishes inspector focus after canvas focus paints and commits only the latest clone", async () => {
  const { sc, vc } = await setup();
  vi.useFakeTimers();
  const inspect = vi.fn();
  const stop = autorun(() => inspect(vc.inspectorTpl(), vc.inspectorCloneKey()));
  try {
    sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree, "first"));
    expect(vc.focusedTpl()).toBe(vc.component.tplTree);
    expect(vc.inspectorTpl()).toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    const first = sc.inspectorSelection;
    expect(first?.cloneKey).toBe("first");
    expect(canEditInspectorSelection(sc, first)).toBe(true);
    inspect.mockClear();
    sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree, "second"));
    sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree, "latest"));
    expect(vc.focusedCloneKey()).toBe("latest");
    expect(vc.inspectorCloneKey()).toBe("first");
    expect(inspect).not.toHaveBeenCalled();
    expect(canEditInspectorSelection(sc, first)).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(inspect).toHaveBeenCalledExactlyOnceWith(vc.component.tplTree, "latest");
    expect(canEditInspectorSelection(sc, first)).toBe(false);
    expect(canEditInspectorSelection(sc, sc.inspectorSelection)).toBe(true);
  } finally {
    stop();
    sc.dispose();
    expect(sc.inspectorSelection).toBeUndefined();
    vi.useRealTimers();
  }
});

it("commits focus set by model or navigation paths without a pure selection transaction", async () => {
  const { sc, vc } = await setup();
  vi.useFakeTimers();
  try {
    runInAction(() => vc.setStudioFocusByTpl(vc.component.tplTree, "model-edit"));
    expect(sc.isSelectionPending).toBe(true);
    expect(vc.inspectorTpl()).toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    expect(vc.inspectorCloneKey()).toBe("model-edit");
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

it("does not refresh the inspector or restart a pending paint for repeated node selection", async () => {
  const { sc, vc, sync } = await setup();
  const inspector = vi.fn();
  const disposeInspector = autorun(() => {
    inspector(sc.isSelectionPending, sc.focusedFrame(), vc.focusedTpls());
  });
  vi.useFakeTimers();
  try {
    const select = () => sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree));
    select();
    expect(sc.isSelectionPending).toBe(true);
    const record = vi.spyOn(sc, "createViewStateUndoRecord");
    const paint = vi.spyOn(window, "requestAnimationFrame");
    inspector.mockClear();
    select();
    expect(inspector).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(paint).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(sc.isSelectionPending).toBe(false);
    inspector.mockClear();
    select();
    select();
    expect(inspector).not.toHaveBeenCalled();
    expect(sc.isSelectionPending).toBe(false);
    expect(record).not.toHaveBeenCalled();
    expect(paint).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  } finally {
    disposeInspector();
    sc.dispose();
    vi.useRealTimers();
  }
});

it.each(["canvas", "artboard"])(
  "does not refresh the inspector for repeated %s background selection",
  async (background) => {
    const { sc, vc, sync } = await setup();
    vi.useFakeTimers();
    const inspector = vi.fn();
    const disposeInspector = autorun(() => {
      inspector(sc.isSelectionPending, sc.focusedFrames(), vc.focusedTpls());
    });
    try {
      const clear = () => sc.changeSelection(() => sc.setStudioFocusOnFrame({
        frame: background === "artboard" ? vc.arenaFrame() : undefined,
        autoZoom: false,
      }));
      sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree));
      clear();
      await vi.advanceTimersByTimeAsync(100);
      inspector.mockClear();
      const record = vi.spyOn(sc, "createViewStateUndoRecord");
      const paint = vi.spyOn(window, "requestAnimationFrame");
      clear();
      clear();
      expect(inspector).not.toHaveBeenCalled();
      expect(sc.isSelectionPending).toBe(false);
      expect(record).not.toHaveBeenCalled();
      expect(paint).not.toHaveBeenCalled();
      expect(sync).not.toHaveBeenCalled();
    } finally {
      disposeInspector();
      sc.dispose();
      vi.useRealTimers();
    }
  },
);

it("updates the inspector when switching clones or collapsing a multiselection", async () => {
  const { sc, vc } = await setup();
  vi.useFakeTimers();
  try {
    const tpl = vc.component.tplTree;
    sc.changeSelection(() => vc.setStudioFocusByTpl(tpl, "first"));
    await vi.advanceTimersByTimeAsync(100);
    sc.changeSelection(() => vc.setStudioFocusByTpl(tpl, "second"));
    expect(vc.focusedCloneKeys()).toEqual(["second"]);
    expect(sc.isSelectionPending).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    sc.changeSelection(() => vc.setStudioFocusByTpl(tpl, "first", { appendToMultiSelection: true }));
    expect(vc.focusedTpls()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(100);
    sc.changeSelection(() => vc.setStudioFocusByTpl(tpl, "second"));
    expect(vc.focusedTpls()).toEqual([tpl]);
    expect(sc.isSelectionPending).toBe(true);
  } finally {
    sc.dispose();
    vi.useRealTimers();
  }
});

it("keeps rendered node selection stable while still tracking replacement DOM", async () => {
  const { sc, vc } = await setup();
  const tpl = ensureKnownTplTag(vc.component.tplTree);
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
  const dom = document.createElement("div");
  const lookup = vi.spyOn(vc, "selectionDom").mockReturnValue($(dom));
  vi.spyOn(vc, "sel2cloneKey").mockReturnValue("root");
  vi.useFakeTimers();
  try {
    const select = () => sc.changeSelection(() => vc.setStudioFocusBySelectable(val));
    select();
    await vi.advanceTimersByTimeAsync(100);
    const selectables = vc.focusedSelectables();
    const tpls = vc.focusedTpls();
    const doms = vc.focusedDomElts();
    select();
    expect(vc.focusedSelectables()).toBe(selectables);
    expect(vc.focusedTpls()).toBe(tpls);
    expect(vc.focusedDomElts()).toBe(doms);
    expect(sc.isSelectionPending).toBe(false);
    const replacement = document.createElement("div");
    lookup.mockReturnValue($(replacement));
    select();
    expect(vc.focusedDomElt()?.[0]).toBe(replacement);
    expect(vc.focusedSelectables()).toBe(selectables);
    expect(sc.isSelectionPending).toBe(false);
  } finally {
    sc.dispose();
    vi.useRealTimers();
  }
});

it("coalesces canvas observers and refreshes selection DOM without an evaluation", () => {
  vi.useFakeTimers();
  const render = vi.fn();
  const update = vi.fn();
  const view: ViewCtx = Object.assign(Object.create(ViewCtx.prototype), {
    _canvasRerenderQueue: new Set(),
    canvasErrorObservers: new Set(),
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
    canvasErrorObservers: new Set(),
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

it("deduplicates hover DOM notifications while keeping clone, target and DOM changes reactive", async () => {
  const { sc, vc } = await setup();
  const tpl = ensureKnownTplTag(vc.component.tplTree);
  const val = new ValTag({
    tpl, children: [], className: "", key: "root", fullKey: "root",
    frameUid: 1, fibers: [], parent: undefined, valOwner: undefined,
    slotInfo: undefined,
  });
  const first = document.createElement("div");
  const second = document.createElement("div");
  const replacement = document.createElement("div");
  let firstDom = first;
  // Return fresh wrappers, just as selectionDom does for every pointer event.
  vi.spyOn(vc, "selectionDom").mockImplementation((_val, clone) =>
    $(clone === "second" ? second : firstDom),
  );
  vi.spyOn(vc, "sel2cloneKey").mockReturnValue("root");
  const update = vi.fn();
  const disposeObserver = autorun(() => update(vc.hoveredSelectable(), vc.$hoveredDomElt()));
  try {
    runInAction(() => vc.setViewCtxHoverBySelectable(val, "first"));
    const doms = vc.$hoveredDomElt();
    update.mockClear();
    runInAction(() => vc.setViewCtxHoverBySelectable(val, "first"));
    runInAction(() => vc.setViewCtxHoverBySelectable(val, "first"));
    expect(update).not.toHaveBeenCalled();
    expect(vc.$hoveredDomElt()).toBe(doms);

    runInAction(() => vc.setViewCtxHoverBySelectable(val, "second"));
    expect(vc.$hoveredDomElt()?.[0]).toBe(second);
    expect(update).toHaveBeenCalledTimes(1);
    firstDom = replacement;
    runInAction(() => vc.setViewCtxHoverBySelectable(val, "first"));
    expect(vc.$hoveredDomElt()?.[0]).toBe(replacement);
    expect(update).toHaveBeenCalledTimes(2);
    runInAction(() => vc.setViewCtxHoverBySelectable(null));
    expect(vc.$hoveredDomElt()).toBeNull();
    expect(update).toHaveBeenCalledTimes(3);
    runInAction(() => vc.setViewCtxHoverBySelectable(null));
    expect(update).toHaveBeenCalledTimes(3);
  } finally {
    disposeObserver();
    sc.dispose();
  }
});

it.each(["frame", "studio"])(
  "disposing %s detaches focused content controls before destroying their evaluator",
  async (scope) => {
    const { sc, vc } = await setup();
    sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree));
    const errors: unknown[] = [];
    const stop = autorun(() => {
      sc.viewCtxs.slice();
      const focused = sc.focusedViewCtx();
      if (focused) {
        getContentEditorTarget(focused);
      }
    }, { onError: (error) => errors.push(error) });
    try {
      if (scope === "frame") {
        sc.disposeViewCtx(vc);
      } else {
        sc.dispose();
        expect(sc.inspectorSelection).toBeUndefined();
      }
      expect(errors).toEqual([]);
      expect(sc.focusedViewCtx()).toBeUndefined();
      expect(sc.focusedFrames()).toEqual([]);
      expect(sc.viewCtxs.includes(vc)).toBe(false);
      expect(vc.isDisposed).toBe(true);
    } finally {
      stop();
      sc.dispose();
    }
  },
);

it("Studio teardown cancels an unfinished part-text draft without committing a model edit", async () => {
  const { sc, vc } = await setup();
  sc.changeSelection(() => vc.setStudioFocusByTpl(vc.component.tplTree));
  const button = document.body.appendChild(document.createElement("button"));
  const label = button.appendChild(document.createElement("span"));
  label.className = "label";
  label.textContent = "Saved label";
  const commit = vi.fn();
  const editor = ensure(createCanvasPartTextEditor({
    element: button, displayName: "Button label", text: {prop: "label", selector: ".label"},
  }, "Saved label", commit, () => { vc.editingComponentPartText = undefined; }, vi.fn()), "Part-text editor");
  vc.editingComponentPartText = editor;
  editor.input.value = "Unfinished draft";
  editor.input.dispatchEvent(new Event("input"));
  try {
    sc.dispose();
    expect(commit).not.toHaveBeenCalled();
    expect(editor.input.isConnected).toBe(false);
    expect(label.textContent).toBe("Saved label");
  } finally {
    editor.finish(true);
    button.remove();
    sc.dispose();
  }
});
