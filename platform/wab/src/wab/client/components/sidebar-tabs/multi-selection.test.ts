import { buildValTree } from "@/wab/__testonly__/tpls";
import {
  getCommonStyleValue,
  getMultiSelectionFieldState,
  getMultiSelectionProviders,
  setMultiSelectionStyle,
} from "@/wab/client/components/sidebar-tabs/multi-selection";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { mkVariant } from "@/wab/shared/Variants";
import {
  createTplMgr,
  createVariantTplMgr,
} from "@/wab/shared/__testonly__/site-tests-utils";
import { CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { TplTagType, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { mock } from "vitest-mock-extended";

function setup() {
  const first = mkTplTagX("div");
  const second = mkTplTagX("div");
  const untouched = mkTplTagX("div");
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Page,
    tplTree: mkTplTagX("div", {}, [first, second, untouched]),
  });
  const site = createSite();
  site.components.push(component);
  const vtm = createVariantTplMgr(site, createTplMgr(site), component);
  for (const tpl of [component.tplTree, first, second, untouched]) {
    vtm.ensureBaseVariantSetting(tpl);
  }
  const owner = buildValTree(
    mkTplComponent(component, ensure(component.variants[0], "Base variant")),
  );
  const root = ensureInstance(owner.contents?.[0], ValTag);
  const studio = mock<StudioCtx>();
  Object.assign(studio, {
    codeComponentsRegistry: new CodeComponentsRegistry(globalThis, {}),
    contentEditorMode: false,
  });
  studio.getCurrentUiConfig.mockReturnValue({});
  studio.canEditProject.mockReturnValue(true);
  studio.canEditBranch.mockReturnValue(true);
  const vc = mock<ViewCtx>();
  Object.assign(vc, { studioCtx: studio, site });
  vc.variantTplMgr.mockReturnValue(vtm);
  vc.currentComponent.mockReturnValue(component);
  vc.focusedTpls.mockReturnValue([first, second]);
  vc.focusedSelectables.mockReturnValue(root.children.slice(0, 2));
  vc.valState.mockReturnValue(
    new ValState({ sysRoot: owner, globalRoot: undefined }),
  );
  vc.change.mockImplementation((action) => {
    action();
    return Promise.resolve();
  });
  const exp = (tpl: typeof first) =>
    RSH(vtm.ensureBaseVariantSetting(tpl).rs, tpl);
  return { vc, vtm, component, first, second, untouched, exp, studio };
}

it("reads common and mixed effective values without adding variant settings", () => {
  const { vc, first, second, exp } = setup();
  exp(first).set("width", "100px");
  exp(second).set("width", "200px");
  const providers = getMultiSelectionProviders(vc);
  expect(getCommonStyleValue(providers, "width")).toEqual({
    mixed: true,
    value: undefined,
  });
  expect(getCommonStyleValue(providers, "opacity")).toEqual({
    mixed: false,
    value: "1.0",
  });
  expect(getCommonStyleValue(providers, "border-radius")).toEqual({
    mixed: false,
    value: "0",
  });
  expect([first.vsettings.length, second.vsettings.length]).toEqual([1, 1]);
});

it("updates all selected nodes in one transaction and leaves other nodes untouched", async () => {
  const { vc, first, second, untouched, exp } = setup();
  await setMultiSelectionStyle(vc, "width", "240px");
  expect(vc.change).toHaveBeenCalledTimes(1);
  expect(exp(first).getRaw("width")).toBe("240px");
  expect(exp(second).getRaw("width")).toBe("240px");
  expect(exp(untouched).getRaw("width")).toBeUndefined();
  expect(getCommonStyleValue(getMultiSelectionProviders(vc), "width")).toEqual({
    mixed: false,
    value: "240px",
  });
});

it("edits each node's recording variant and resets only that variant", async () => {
  const { vc, vtm, component, first, second, exp } = setup();
  const variant = mkVariant({ name: "Selected" });
  component.variants.push(variant);
  const combo = [variant];
  vi.spyOn(vtm, "getTargetVariantComboForNode").mockImplementation((tpl) =>
    tpl === first ? combo : [ensure(component.variants[0], "Base variant")],
  );
  vi.spyOn(vtm, "getTargetIndicatorComboForNode").mockImplementation((tpl) =>
    vtm.getTargetVariantComboForNode(tpl),
  );
  exp(first).set("width", "100px");
  await setMultiSelectionStyle(vc, "width", "240px");
  expect(exp(first).getRaw("width")).toBe("100px");
  expect(
    RSH(vtm.ensureVariantSetting(first, combo).rs, first).getRaw("width"),
  ).toBe("240px");
  expect(exp(second).getRaw("width")).toBe("240px");
  await setMultiSelectionStyle(vc, "width", undefined);
  expect(exp(first).getRaw("width")).toBe("100px");
  expect(
    RSH(vtm.ensureVariantSetting(first, combo).rs, first).getRaw("width"),
  ).toBeUndefined();
  expect(exp(second).getRaw("width")).toBeUndefined();
});

it("blocks the whole batch if a selected node is locked", async () => {
  const { vc, first, second, exp } = setup();
  second.locked = true;
  expect(
    getMultiSelectionFieldState(vc, getMultiSelectionProviders(vc), "width")
      .disabled,
  ).toBe(true);
  await setMultiSelectionStyle(vc, "width", "240px");
  expect(exp(first).getRaw("width")).toBeUndefined();
  expect(exp(second).getRaw("width")).toBeUndefined();
});

it("does not offer text styles for an image and does not partially apply them", async () => {
  const { vc, first, second, exp } = setup();
  second.type = TplTagType.Image;
  second.tag = "img";
  expect(
    getMultiSelectionFieldState(vc, getMultiSelectionProviders(vc), "color")
      .supported,
  ).toBe(false);
  await setMultiSelectionStyle(vc, "color", "red");
  expect(exp(first).getRaw("color")).toBeUndefined();
});

it("respects the content editor's configured editing permissions", async () => {
  const { vc, studio, first, exp } = setup();
  Object.assign(studio, { contentEditorMode: true });
  expect(
    getMultiSelectionFieldState(vc, getMultiSelectionProviders(vc), "width")
      .supported,
  ).toBe(false);
  await setMultiSelectionStyle(vc, "width", "240px");
  expect(exp(first).getRaw("width")).toBeUndefined();
});

it("treats different corner values as mixed and edits all four real radius properties", async () => {
  const { vc, first, second, exp } = setup();
  exp(first).set("border-top-left-radius", "8px");
  expect(
    getCommonStyleValue(getMultiSelectionProviders(vc), "border-radius").mixed,
  ).toBe(true);
  await setMultiSelectionStyle(vc, "border-radius", "12px");
  for (const tpl of [first, second]) {
    for (const corner of [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ]) {
      expect(exp(tpl).getRaw(`border-${corner}-radius`)).toBe("12px");
    }
    expect(exp(tpl).getRaw("border-radius")).toBeUndefined();
  }
});

it("edits repeated instances of the same template once", async () => {
  const { vc, first, second, exp } = setup();
  vc.focusedTpls.mockReturnValue([first, first]);
  expect(getMultiSelectionProviders(vc)).toHaveLength(1);
  await setMultiSelectionStyle(vc, "opacity", "0.5");
  expect(exp(first).getRaw("opacity")).toBe("0.5");
  expect(exp(second).getRaw("opacity")).toBeUndefined();
});

it("blocks a base-variant edit when a higher-priority active variant overrides it", async () => {
  const { vc, vtm, component, first, second, exp } = setup();
  const variant = mkVariant({ name: "Active" });
  component.variants.push(variant);
  vi.spyOn(vtm, "getEffectiveVariantComboForNode").mockReturnValue([variant]);
  RSH(vtm.ensureVariantSetting(second, [variant]).rs, second).set(
    "width",
    "300px",
  );
  expect(
    getMultiSelectionFieldState(vc, getMultiSelectionProviders(vc), "width")
      .disabled,
  ).toBe(true);
  await setMultiSelectionStyle(vc, "width", "240px");
  expect(exp(first).getRaw("width")).toBeUndefined();
  expect(exp(second).getRaw("width")).toBeUndefined();
});

it.each(["canEditProject", "canEditBranch"] as const)(
  "does not change read-only selections when %s is false",
  async (permission) => {
    const { vc, studio, first, second, exp } = setup();
    studio[permission].mockReturnValue(false);
    await setMultiSelectionStyle(vc, "opacity", "0.5");
    expect(exp(first).getRaw("opacity")).toBeUndefined();
    expect(exp(second).getRaw("opacity")).toBeUndefined();
  },
);

it("does not create empty recording variants when reading or resetting an unset field", async () => {
  const { vc, vtm, component, first, second } = setup();
  const variant = mkVariant({ name: "Selected" });
  component.variants.push(variant);
  vi.spyOn(vtm, "getTargetVariantComboForNode").mockReturnValue([variant]);
  vi.spyOn(vtm, "getTargetIndicatorComboForNode").mockReturnValue([variant]);
  getMultiSelectionFieldState(vc, getMultiSelectionProviders(vc), "width");
  await setMultiSelectionStyle(vc, "width", undefined);
  expect(first.vsettings).toHaveLength(1);
  expect(second.vsettings).toHaveLength(1);
});

it("keeps the batch attached to the selection that initiated a queued edit", async () => {
  const { vc, first, second, untouched, exp } = setup();
  let queuedChange: (() => void) | undefined;
  vc.change.mockImplementation((action) => {
    queuedChange = action;
    return Promise.resolve();
  });
  await setMultiSelectionStyle(vc, "width", "240px");
  vc.focusedTpls.mockReturnValue([untouched]);
  ensure(queuedChange, "Queued edit")();
  expect(exp(first).getRaw("width")).toBe("240px");
  expect(exp(second).getRaw("width")).toBe("240px");
  expect(exp(untouched).getRaw("width")).toBeUndefined();
});
