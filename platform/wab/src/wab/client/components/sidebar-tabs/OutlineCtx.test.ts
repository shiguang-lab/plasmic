import {
  OutlineCtx,
  makeNodeKey,
} from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  AnyArena,
  getArenaFrames,
  isDedicatedArena,
  mkArenaFrame,
} from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { Arena, ArenaFrame, TplNode } from "@/wab/shared/model/classes";
import { observable, runInAction } from "mobx";
import { mock } from "vitest-mock-extended";

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
  const activeArena = observable.box<AnyArena | null>(arena, { deep: false });
  const focus = observable.box<ViewCtx | undefined>(undefined, { deep: false });
  const selected = observable.box<TplNode | null>(null, { deep: false });
  const views = new Map<ArenaFrame, ViewCtx>();
  for (const frame of frames) {
    const vc = mock<ViewCtx>();
    Object.defineProperty(vc, "component", { value: component });
    vc.arenaFrame.mockReturnValue(frame);
    vc.focusedSelectable.mockReturnValue(null);
    vc.focusedTpl.mockImplementation(() => selected.get());
    vc.hoveredSelectable.mockReturnValue(null);
    vc.componentStackFrames.mockReturnValue(observable.array([]));
    views.set(frame, vc);
  }
  const ctx = mock<StudioCtx>();
  Object.defineProperty(ctx, "currentArena", { get: () => activeArena.get() });
  ctx.focusedViewCtx.mockImplementation(() => focus.get());
  ctx.focusedOrFirstViewCtx.mockImplementation(
    () =>
      focus.get() ??
      (isDedicatedArena(activeArena.get())
        ? views.get(getArenaFrames(activeArena.get())[0])
        : undefined),
  );
  ctx.tryGetViewCtxForFrame.mockImplementation((frame) =>
    frame ? views.get(frame) : undefined,
  );
  const outline = new OutlineCtx(ctx, "");
  const select = (frame: ArenaFrame, node: TplNode | null) =>
    runInAction(() => {
      focus.set(views.get(frame));
      selected.set(node);
    });
  const deselect = () =>
    runInAction(() => {
      focus.set(undefined);
      selected.set(null);
    });
  return {
    site,
    arena,
    frames,
    views,
    ctx,
    outline,
    activeArena,
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
  runInAction(() =>
    f.activeArena.set(new Arena({ name: "Other", children: [] })),
  );
  expect(f.outline.viewCtx()).toBeUndefined();
  runInAction(() => f.activeArena.set(f.arena));
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
  runInAction(() =>
    f.activeArena.set(new Arena({ name: "Other", children: [] })),
  );
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
