import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { OutlineModelInputs } from "@/wab/client/components/sidebar-tabs/outline-model-inputs";
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
  return { studio, view, root, component, frame };
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
