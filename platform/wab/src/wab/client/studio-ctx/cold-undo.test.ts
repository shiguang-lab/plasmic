import { ViewStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import { createViewVariantFixture } from "@/wab/client/__testonly__/view-variants";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { CanvasVariantInputs } from "@/wab/client/components/canvas/canvas-variant-inputs";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { ensureInstance } from "@/wab/shared/common";
import { GlobalVariantFrame } from "@/wab/shared/component-frame";
import { mock } from "vitest-mock-extended";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { vi } from "vitest";

it("recreated nested frame builds root pins before its first render, then includes all owners", () => {
  const site = createSite();
  const components = ["Root", "Outer", "Inner"].map((name) => {
    const component = mkComponent({ name, type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }) });
    site.components.push(component);
    return component;
  });
  const arena = mkArenaFrame({ site, component: components[0], name: "Root", width: 100, height: 100 });
  const tpls = components.map((component, index) => index === 0 ? arena.container : mkTplComponent(component, component.variants[0]));
  const frames = tpls.map((tpl) => new TransientComponentVariantFrame(tpl));
  const models = new ModelSnapshots();
  const frame = globalHookCtx.createFrameState({ uid: arena.uid, objectPrototype: Object.prototype });
  const variants = new ViewVariantState(() => models, () => arena, () => site, () => false, () => !!frame.valRootStore.getState());
  variants.transaction(() => { variants.replaceFrames(frames); variants.setGlobal(new GlobalVariantFrame(site, arena)); });
  const selection = new ViewSelection(() => models);
  const studio = Object.assign(mock<StudioCtx>(), { site, modelSnapshots: models, hasPendingModelChanges: () => false });
  const view = Object.assign(mock<ViewCtx>(), { site, studioCtx: studio, frameState: frame, variantStore: variants.store, selectionStore: selection.store });
  const input = new CanvasVariantInputs(view);
  try {
    const before = input.store.getState();
    expect(before.frames).toHaveLength(1);
    expect(before.frames.some((owner) => owner.key === "." + tpls[0].uuid)).toBe(true);
    const vals: ValComponent[] = [];
    for (const [index, tpl] of tpls.entries()) {
      const value = new ValComponent({ tpl, key: components[index].name, fullKey: components[index].name, frameUid: arena.uid, valOwner: vals[index - 1], parent: undefined, fibers: [], className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map() });
      vals.push(ensureInstance(frame.renderState.registerVal(value), ValComponent));
    }
    frame.valRootStore.setState(vals[0], true);
    selection.setContext(new ComponentCtx({ valComponent: vals[2] }));
    input.prepareCommit(); input.publishCommit();
    expect(input.store.getState().frames.map((owner) => owner.key)).toEqual(["Root", "Outer", "Inner"]);
  } finally { input.dispose(); selection.dispose(); variants.dispose(); frame.dispose(); models.dispose(); }
});

it("restoring a recreated frame restores both enabled and disabled default-slot display", () => {
  const models = new ModelSnapshots();
  const site = createSite();
  const component = new TplMgr({ site }).addComponent();
  const frame = mkArenaFrame({ site, component, name: "Restored", width: 100, height: 100 });
  const vc = Object.assign(Object.create(ViewCtx.prototype), {
    variants: createViewVariantFixture(models, site, frame),
    styleInputs: new ViewStyleInputs(() => models, new AbortController().signal),
    studioCtx: { hasPendingModelChanges: () => false },
    selection: new ViewSelection(() => models),
    arenaFrame: () => frame,
    restoreCurrentComponentCtxAndStack: vi.fn(),
  }) as ViewCtx;
  const view = {
    focusedFrame: frame,
    focusedOnFrame: true,
    vcComponentStack: [],
    vcShowDefaultSlotContents: true,
  };
  vc.restoreViewState(view);
  expect(vc.showDefaultSlotContents()).toBe(true);
  vc.restoreViewState({ ...view, vcShowDefaultSlotContents: false });
  expect(vc.showDefaultSlotContents()).toBe(false);
  vc.styleInputs.dispose(); vc.selection.dispose(); vc.variants.dispose(); models.dispose();
});
