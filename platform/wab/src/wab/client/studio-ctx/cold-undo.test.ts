import { buildViewCtxPinMaps } from "@/wab/client/cseval";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { observable } from "mobx";
import { vi } from "vitest";

it("recreated nested frame builds root pins before its first render, then includes all owners", () => {
  const site = createSite();
  const vals = ["Root", "Outer", "Inner"].map((name) => {
    const component = mkComponent({
      name,
      type: ComponentType.Plain,
      tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
    });
    site.components.push(component);
    return new ValComponent({
      tpl: mkTplComponent(component, component.variants[0]),
      key: name,
      fullKey: name,
      frameUid: 1,
      valOwner: undefined,
      parent: undefined,
      fibers: [],
      className: "",
      slotInfo: undefined,
      slotArgs: new Map(),
      slotCanvasEnvs: new Map(),
    });
  });
  const frames = vals.map((v) => new TransientComponentVariantFrame(v.tpl));
  let initialized = false;
  const vc = {
    site,
    componentStackFrames: () => frames,
    globalFrame: frames[0],
    valState: () => ({
      maybeValSysRoot: () => (initialized ? vals[0] : undefined),
    }),
    valComponentStack: () => vals,
    focusedTpl: () => null,
  } as unknown as ViewCtx;
  const before = buildViewCtxPinMaps(vc);
  expect(before.pinMap.size).toBe(1);
  expect(before.pinMap.has("." + vals[0].tpl.uuid)).toBe(true);
  initialized = true;
  expect([...buildViewCtxPinMaps(vc).pinMap.keys()]).toEqual([
    "Root",
    "Outer",
    "Inner",
  ]);
});

it("restoring a recreated frame restores both enabled and disabled default-slot display", () => {
  const frame = {} as any;
  const vc = Object.assign(Object.create(ViewCtx.prototype), {
    _xShowDefaultSlotContents: observable.box(false),
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
});
