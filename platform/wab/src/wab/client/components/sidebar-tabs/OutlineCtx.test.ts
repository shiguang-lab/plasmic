import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { createViewVariantFixture } from "@/wab/client/__testonly__/view-variants";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import {
  _testOnlyUtils,
  makeNodeKey,
  OutlineCtx,
} from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  getArenaFrames,
  isDedicatedArena,
  mkArenaFrame,
} from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkSlot, mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import {
  Arena,
  ArenaFrame,
  CustomCode,
  ensureKnownSlotParam,
  TplNode,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

it.each(["null", "$props.content"])(
  "keeps the outline usable for an expression-backed slot: %s",
  (code) => {
    const param = ensureKnownSlotParam(
      mkParam({
        name: "children",
        type: typeFactory.renderable(),
        paramType: "slot",
      }),
    );
    const slot = mkSlot(param);
    const component = mkComponent({
      name: "Overlay",
      type: ComponentType.Plain,
      params: [param],
      tplTree: slot,
    });
    const instance = mkTplComponentX({
      component,
      baseVariant: component.variants[0],
      args: { children: new CustomCode({ code, fallback: null }) },
    });
    const view = mock<ViewCtx>();
    const variants = mock<ReturnType<ViewCtx["variantTplMgr"]>>();
    view.variantTplMgr.mockReturnValue(variants);
    variants.getEffectiveArgForParam.mockReturnValue(
      instance.vsettings[0].args[0],
    );
    expect(
      _testOnlyUtils.getTreeNodeChildren(
        view,
        new SlotSelection({ tpl: instance, slotParam: param }),
        1,
        instance,
      ),
    ).toEqual({ children: [], childrenFrameNum: 1 });
    expect(_testOnlyUtils.getTreeNodeChildren(view, slot, 1, instance)).toEqual(
      { children: [], childrenFrameNum: 0 },
    );
  },
);

function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "Customers",
    type: ComponentType.Page,
  });
  const leafA = mkTplTagX("span");
  const branchA = mkTplTagX("div", {}, [leafA]);
  const leafB = mkTplTagX("span");
  const branchB = mkTplTagX("div", {}, [leafB]);
  $$$(component.tplTree).append(branchA).append(branchB);
  const frames = ["List", "Details"].map((name) =>
    mkArenaFrame({ site, component, name, width: 1440, height: 960 }),
  );
  const arena = new Arena({ name: "Overview", children: frames });
  site.arenas.push(arena);
  const models = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  arenaState.setCurrent(arena);
  const focus = new StudioSelection(() => models);
  const selectionByView = new Map<ViewCtx, ViewSelection>();
  const views = new Map<ArenaFrame, ViewCtx>();
  for (const frame of frames) {
    const vc = mock<ViewCtx>();
    const selection = new ViewSelection(() => models);
    const variants = createViewVariantFixture(models, site, frame);
    selectionByView.set(vc, selection);
    Object.defineProperties(vc, { component: { value: component }, selectionStore: { value: selection.store }, variantStore: { value: variants.store } });
    vc.arenaFrame.mockReturnValue(frame);
    vc.focusedSelectable.mockReturnValue(null);
    vc.focusedTpl.mockImplementation(() => selection.tpls()[0] ?? null);
    vc.hoveredSelectable.mockReturnValue(null);
    vc.componentStackFrames.mockReturnValue([]);
    views.set(frame, vc);
  }
  const ctx = mock<StudioCtx>();
  Object.defineProperties(ctx, { site: { value: site }, modelSnapshots: { value: models }, arenaState: { value: arenaState }, currentArena: { get: () => arenaState.currentArena() }, selectionStore: { value: focus.store } });
  Object.defineProperty(ctx, "renamingOnPanelStore", { value: createStore(() => false) });
  ctx.subscribeModelChanges.mockImplementation(() => () => undefined);
  ctx.focusedViewCtx.mockImplementation(() => focus.current().view);
  ctx.focusedOrFirstViewCtx.mockImplementation(
    () =>
      focus.current().view ??
      (isDedicatedArena(arenaState.currentArena())
        ? views.get(getArenaFrames(arenaState.currentArena())[0])
        : undefined),
  );
  ctx.tryGetViewCtxForFrame.mockImplementation((frame) =>
    frame ? views.get(frame) : undefined,
  );
  Object.defineProperty(ctx, "commentsCtx", {
    value: {
      store: createStore(() => ({ commentedSubjectIds: new Set<string>() })),
    },
  });
  const outline = new OutlineCtx(ctx, "");
  const transact = (command: () => void) => {
    const selections = [...selectionByView.values()];
    const run = (index: number): void => {
      if (index === selections.length) { command(); }
      else { selections[index].transaction(() => run(index + 1)); }
    };
    focus.transaction(() => run(0));
  };
  const select = (frame: ArenaFrame, node: TplNode | null) => transact(() => {
    const selectedView = ensure(views.get(frame), "Selected artboard");
    focus.set(selectedView, []);
    for (const [view, selection] of selectionByView) {
      selection.setTpls(view === selectedView && node ? [node] : []);
      selection.setTargets(view === selectedView && node ? [null] : []);
    }
  });
  const deselect = () => transact(() => {
    focus.clear();
    for (const selection of selectionByView.values()) { selection.clear(); }
  });
  return {
    site,
    arena,
    frames,
    views,
    ctx,
    outline,
    arenaState,
    select,
    deselect,
    leafA,
    leafB,
    branchA,
    branchB,
    component,
  };
}

it("retains the displayed tree and expanded branches when clicking canvas background", () => {
  const f = setup();
  expect(f.outline.viewCtx()).toBeUndefined();
  f.select(f.frames[1], f.leafA);
  const view = f.outline.viewCtx();
  expect(f.outline.isExpanded(makeNodeKey(f.branchA))).toBe(true);
  f.deselect();
  expect(f.ctx.focusedViewCtx()).toBeUndefined();
  expect(f.outline.viewCtx()).toBe(view);
  expect(f.outline.focusedNodeKeyPath()).toEqual([]);
  expect(f.outline.isExpanded(makeNodeKey(f.branchA))).toBe(true);
  expect(f.ctx.setStudioFocusOnFrame).not.toHaveBeenCalled();
  f.outline.dispose();
});

it("reveals the next selection while retaining existing expansion and explicit collapse", () => {
  const f = setup();
  f.select(f.frames[0], f.leafA);
  f.select(f.frames[0], f.leafB);
  expect(f.outline.focusedNodeKeyPath()[0]).toBe(makeNodeKey(f.leafB));
  expect(f.outline.isExpanded(makeNodeKey(f.branchA))).toBe(true);
  expect(f.outline.isExpanded(makeNodeKey(f.branchB))).toBe(true);
  f.outline.setExpanded(makeNodeKey(f.branchA), false);
  f.deselect();
  f.select(f.frames[0], f.leafB);
  expect(f.outline.isExpanded(makeNodeKey(f.branchA))).toBe(false);
  f.outline.dispose();
});

it("publishes the complete selected ancestor chain once and skips repeated expansion", () => {
  const f = setup();
  f.select(f.frames[0], f.branchA);
  expect(f.outline.isExpanded(makeNodeKey(f.branchA))).toBe(false);
  f.deselect();
  const snapshots: ReturnType<typeof f.outline.stateStore.getState>[] = [];
  const stop = f.outline.stateStore.subscribe((state) => snapshots.push(state));
  try {
    f.select(f.frames[0], f.leafA);
    expect(snapshots).toHaveLength(1);
    const selected = snapshots[0];
    expect(selected.lastViewedArtboard?.frame).toBe(f.frames[0]);
    expect(selected.expandedFrames.get(f.frames[0])).toBe(true);
    expect(selected.expanded.has(makeNodeKey(f.leafA))).toBe(false);
    for (const key of f.outline.focusedNodeKeyPath().slice(1)) {
      expect(selected.expanded.get(key)).toBe(true);
    }
    f.outline.setFrameExpanded(f.frames[0], true);
    f.outline.setExpanded(makeNodeKey(f.branchA), true);
    f.select(f.frames[0], f.leafA);
    expect(snapshots).toHaveLength(1);
    f.select(f.frames[0], f.leafB);
    expect(snapshots).toHaveLength(2);
    expect(f.outline.isExpanded(makeNodeKey(f.branchA))).toBe(true);
    expect(f.outline.isExpanded(makeNodeKey(f.branchB))).toBe(true);
  } finally { stop(); f.outline.dispose(); }
});

it("uses the newly selected artboard and retains it when selection is cleared", () => {
  const f = setup();
  f.select(f.frames[0], f.leafA);
  f.select(f.frames[1], f.leafB);
  expect(f.outline.viewCtx()).toBe(f.views.get(f.frames[1]));
  f.deselect();
  expect(f.outline.viewCtx()).toBe(f.views.get(f.frames[1]));
  f.outline.dispose();
});

it("does not reuse the retained artboard in another arena or after it is removed", () => {
  const f = setup();
  f.select(f.frames[1], f.leafA);
  f.deselect();
  const other = new Arena({ name: "Other", children: [] });
  f.site.arenas.push(other);
  f.arenaState.setCurrent(other);
  expect(f.outline.viewCtx()).toBeUndefined();
  f.arenaState.setCurrent(f.arena);
  expect(f.outline.viewCtx()).toBe(f.views.get(f.frames[1]));
  f.arena.children.splice(1, 1);
  expect(f.outline.viewCtx()).toBeUndefined();
  f.outline.dispose();
});

it("keeps each artboard's view and expansion independent, including repeated components", () => {
  const f = setup();
  const first = f.outline.getFrameOutline(f.frames[0]);
  const second = f.outline.getFrameOutline(f.frames[1]);
  f.select(f.frames[0], f.leafA);
  expect(first.viewCtx()).toBe(f.views.get(f.frames[0]));
  expect(second.viewCtx()).toBe(f.views.get(f.frames[1]));
  expect(first.isExpanded(makeNodeKey(f.branchA))).toBe(true);
  expect(second.isExpanded(makeNodeKey(f.branchA))).toBe(false);
  f.select(f.frames[1], f.leafB);
  f.deselect();
  expect(f.outline.isFrameExpanded(f.frames[0])).toBe(true);
  expect(f.outline.isFrameExpanded(f.frames[1])).toBe(true);
  expect(first.isExpanded(makeNodeKey(f.branchA))).toBe(true);
  expect(second.isExpanded(makeNodeKey(f.branchB))).toBe(true);
  expect(first.focusedNodeKeyPath()).toEqual([]);
  expect(second.focusedNodeKeyPath()).toEqual([]);
  f.outline.setFrameExpanded(f.frames[0], false);
  f.select(f.frames[1], f.leafA);
  expect(f.outline.isFrameExpanded(f.frames[0])).toBe(false);
  f.outline.collapseAll();
  expect(f.outline.isFrameExpanded(f.frames[1])).toBe(false);
  expect(first.isExpanded(makeNodeKey(f.branchA))).toBe(false);
  expect(second.isExpanded(makeNodeKey(f.branchB))).toBe(false);
  f.outline.dispose();
});

it("disposes artboard outlines when leaving their arena", () => {
  const f = setup();
  const child = f.outline.getFrameOutline(f.frames[0]);
  const dispose = vi.spyOn(child, "dispose");
  const other = new Arena({ name: "Other", children: [] });
  f.site.arenas.push(other);
  f.arenaState.setCurrent(other);
  expect(dispose).toHaveBeenCalledOnce();
  f.outline.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});

it("allows page sections to default open while keeping explicit fold state", () => {
  const f = setup();
  const frame = f.frames[0];
  expect(f.outline.isFrameExpanded(frame)).toBe(false);
  expect(f.outline.isFrameExpanded(frame, true)).toBe(true);
  f.outline.setFrameExpanded(frame, false);
  expect(f.outline.isFrameExpanded(frame, true)).toBe(false);
  f.select(frame, f.leafA);
  expect(f.outline.isFrameExpanded(frame, true)).toBe(true);
  f.deselect();
  expect(f.outline.isFrameExpanded(frame, true)).toBe(true);
  f.outline.dispose();
});

it("retires departed frame outlines in one bounded publication despite a synchronous old-frame reader", () => {
  const f = setup();
  const first = f.outline.getFrameOutline(f.frames[0]);
  const second = f.outline.getFrameOutline(f.frames[1]);
  const firstDispose = vi.spyOn(first, "dispose"), secondDispose = vi.spyOn(second, "dispose");
  const next = new Arena({ name: "Other", children: [] });
  f.site.arenas.push(next);
  let reads = 0;
  const stop = f.outline.stateStore.subscribe(() => {
    if (f.ctx.currentArena !== next) { return; }
    if (++reads > 5) { throw new Error("Unbounded departed-frame reentry"); }
    f.outline.getFrameOutline(f.frames[0]);
  });
  try {
    expect(() => f.arenaState.setCurrent(next)).not.toThrow();
    expect(reads).toBe(1);
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(f.outline.isFrameExpanded(f.frames[0])).toBe(false);
  } finally { stop(); f.outline.dispose(); }
});
