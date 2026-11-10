import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { getOutlineModelInput, OutlineModelInputs } from "@/wab/client/components/sidebar-tabs/outline-model-inputs";
import { makeNodeKey, OutlineCtx } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { waitFor } from "@testing-library/react";

async function fixture() {
  const base = mkBaseVariant();
  const site = createSite(), root = mkTplTagX("div", { baseVariant: base });
  const component = mkComponent({ name: "Outline", type: ComponentType.Plain, variants: [base], tplTree: root }); site.components.push(component); ensureBaseVariantSetting(component, root);
  const empty = mkMixedArena("Empty"), frame = mkArenaFrame({ site, component, name: "Outline", width: 100, height: 100 });
  const arena = mkMixedArena("Outline", [frame]); site.arenas.push(empty, arena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Empty" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.arenaState.activate(arena, performance.now());
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual outline ViewCtx");
  // Inactive artboards do not lease recorder coverage through the current arena.
  studio.observeComponents([view.component]);
  return { studio, view, root, component, frame, arena };
}

it("rebinds actual tree children and Val inputs and seals the original view world", async () => {
  const { studio, view, root, component, frame } = await fixture();
  const nodeInput = view.canvasRenderOwner.observerInput(view, root);
  const subscribeNode = nodeInput.subscribe, released = vi.fn();
  const connected = vi.spyOn(nodeInput, "subscribe").mockImplementation((listener) => {
    const stop = subscribeNode(listener);
    listener();
    return () => { released(); stop(); };
  });
  const source = new OutlineModelInputs(view), notify = vi.fn();
  source.getState(); const stop = source.subscribe(notify); notify.mockClear();
  try {
    expect(connected).toHaveBeenCalledOnce();
    const before = source.getState();
    await studio.changeUnsafe(() => { root.name = "Renamed"; });
    expect(root.name).toBe("Renamed");
    expect(studio.modelSnapshots.field(root, "name").getState()).toBe("Renamed");
    expect(source.getState()).not.toBe(before); expect(notify).toHaveBeenCalled(); notify.mockClear();
    const child = mkTplTagX("span", { baseVariant: component.variants[0] });
    ensureBaseVariantSetting(component, child);
    await studio.changeUnsafe(() => { root.children.push(child); child.parent = root; });
    expect(notify).toHaveBeenCalled(); notify.mockClear();
    await studio.changeUnsafe(() => { child.locked = true; });
    expect(notify).toHaveBeenCalled(); notify.mockClear();
    const val = new ValComponent({ tpl: frame.container, key: "root", fullKey: "root", frameUid: frame.uid,
      valOwner: undefined, parent: undefined, fibers: [], className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map() });
    view.frameState.valRootStore.setState(val, true); notify.mockClear();
    val.codeComponentProps = { title: "Changed runtime label" };
    expect(notify).toHaveBeenCalledOnce(); notify.mockClear();
    studio.disposeViewCtx(view);
    expect(released).toHaveBeenCalledOnce();
    expect(source.getState()).toEqual([]); notify.mockClear();
    const bind = vi.spyOn(view.canvasRenderOwner, "observerInput");
    val.codeComponentProps = { title: "Retired" };
    expect(source.getState()).toEqual([]); expect(bind).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  } finally { stop(); connected.mockRestore(); studio.dispose(); }
});


it("releases an in-flight native subscription when its synchronous catch-up retires the view", async () => {
  const { studio, view } = await fixture();
  const source = new OutlineModelInputs(view), notify = vi.fn();
  source.getState();
  const selection = view.selectionStore, subscribeSelection = selection.subscribe;
  const released = vi.fn();
  const connected = vi.spyOn(selection, "subscribe").mockImplementation((listener) => {
    const stop = subscribeSelection(listener);
    studio.disposeViewCtx(view);
    listener(selection.getState(), selection.getState());
    return () => { released(); stop(); };
  });
  let stop: () => void = () => undefined;
  try {
    stop = source.subscribe(notify);
    expect(view.isDisposed).toBe(true);
    expect(connected).toHaveBeenCalledOnce();
    expect(released).toHaveBeenCalledOnce();
    expect(source.getState()).toEqual([]);
    stop(); stop();
    expect(released).toHaveBeenCalledOnce();
  } finally { stop(); connected.mockRestore(); studio.dispose(); }
});

it.each([100, 1000])("captures a %i-node model transaction once without rebuilding its subscriptions", async (count) => {
  const { studio, view, root, component } = await fixture();
  const children = Array.from({ length: count }, () => mkTplTagX("div", { baseVariant: component.variants[0] }));
  await studio.changeUnsafe(() => {
    for (const child of children) {
      ensureBaseVariantSetting(component, child);
      root.children.push(child); child.parent = root;
    }
  });
  const source = new OutlineModelInputs(view), notify = vi.fn();
  source.getState();
  const stop = source.subscribe(notify);
  const collect = vi.spyOn(view.canvasRenderOwner, "observerInput");
  const read = vi.spyOn(view.canvasRenderOwner.observerInput(view, root), "getState");
  collect.mockClear(); notify.mockClear();
  const before = source.getState();
  try {
    await studio.changeUnsafe(() => { for (const child of children) { child.locked = true; } });
    expect(source.getState()).not.toBe(before);
    expect(notify).toHaveBeenCalledOnce();
    expect(collect).not.toHaveBeenCalled();
    // Count actual model reads, not just React renders: a capture on every
    // field notification would read this root once per node in the batch.
    expect(read.mock.calls.length).toBeLessThanOrEqual(4);
  } finally { stop(); studio.dispose(); }
});

it("reuses lazy branches across expansion and selection and refreshes their inherited metadata after edits", async () => {
  const { studio, view, root, component, frame, arena } = await fixture();
  studio.arenaState.setCurrent(arena);
  const leaf = mkTplTagX("span", { baseVariant: component.variants[0] });
  const branch = mkTplTagX("div", { baseVariant: component.variants[0] }, [leaf]);
  await studio.changeUnsafe(() => {
    ensureBaseVariantSetting(component, branch); ensureBaseVariantSetting(component, leaf);
    root.children.push(branch); branch.parent = root;
  });
  const source = getOutlineModelInput(view);
  const stop = source.subscribe(() => undefined);
  const outline = new OutlineCtx(studio, "", frame);
  const visibility = vi.spyOn(view.getViewOps(), "getEffectiveTplVisibility");
  try {
    const tree = ensure(outline.rootTreeNode(), "Outline root");
    expect(visibility.mock.calls.map(([tpl]) => tpl)).toEqual([root]);
    const child = tree.children[0];
    expect(visibility.mock.calls.map(([tpl]) => tpl)).toEqual([root, branch]);
    outline.setExpanded(makeNodeKey(branch), true);
    expect(outline.rootTreeNode()).toBe(tree);
    expect(child.children[0].self.item).toBe(leaf);
    expect(tree.children[0]).toBe(child);

    const treeInput = source.getTreeState();
    outline.collapseAll();
    view.setStudioFocusByTpl(leaf);
    expect(outline.focusedNodeKeyPath()[0]).toBe(makeNodeKey(leaf));
    for (const key of outline.focusedNodeKeyPath()) { expect(outline.isExpanded(key)).toBe(true); }
    expect(source.getTreeState()).toBe(treeInput);
    expect(outline.rootTreeNode()).toBe(tree);

    view.selection.setCloneKeys(["RepeatedInstance"]);
    expect(source.getTreeState()).not.toBe(treeInput);
    expect(outline.rootTreeNode()).not.toBe(tree);
    view.selection.setCloneKeys([undefined]);

    await studio.changeUnsafe(() => { branch.locked = true; });
    const edited = ensure(outline.rootTreeNode(), "Edited outline root");
    expect(edited).not.toBe(tree);
    expect(edited.children[0].children[0].self.ancestorLocked).toBe(true);

    outline.collapseAll();
    const notify = vi.fn(), stopOutline = outline.stateStore.subscribe(notify);
    outline.expandAll();
    expect(notify).toHaveBeenCalledOnce();
    expect(outline.isExpanded(makeNodeKey(leaf))).toBe(true);
    outline.expandAll();
    expect(notify).toHaveBeenCalledOnce();
    stopOutline();
  } finally { outline.dispose(); stop(); studio.dispose(); }
});
