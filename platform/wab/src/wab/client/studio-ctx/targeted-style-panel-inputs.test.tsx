import { ensureVariantSetting, mkVariant } from "@/wab/shared/Variants";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StyleExprButton } from "@/wab/client/components/sidebar-tabs/StyleExprModal";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TargetedStylePanelInputs } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkSelectorRuleSet } from "@/wab/shared/core/styles";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { $$$ } from "@/wab/shared/TplQuery";
import { StyleExpr, ensureKnownStyleExpr, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const studios = new Set<ReturnType<typeof fakeStudioCtx>["studioCtx"]>();
afterEach(async () => { cleanup(); for (const studio of studios) { await studio.awaitEval(); studio.dispose(); } studios.clear(); vi.restoreAllMocks(); });
async function fixture() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const styled = manager.addComponent({ name: "Styled", type: ComponentType.Plain });
  const param = mkParam({ name: "className", type: typeFactory.classNamePropType([], {}), paramType: "prop" }); styled.params.push(param);
  const component = manager.addComponent({ name: "Style targets", type: ComponentType.Plain, rootTpl: mkTplTagX("div") });
  const root = ensureKnownTplTag(component.tplTree), instance = mkTplComponent(styled, component.variants[0]);
  $$$(root).append(instance);
  const mixin = manager.addMixin("Original mixin");
  const frame = mkArenaFrame({ site, component, name: "Style targets", width: 600, height: 200 });
  site.arenas.push(mkMixedArena("Style targets", [frame]));
  const f = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Style%20targets" });
  studios.add(f.studioCtx);
  await waitFor(() => expect(f.studioCtx.initialRouteReady).toBe(true));
  const studio = f.studioCtx, view = ensure(studio.tryGetViewCtxForFrame(frame), "Style target view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  return { ...f, studio, view, site, root, instance, param, mixin };
}

it("publishes applied mixin ownership and catalog names while suppressing unrelated CSS changes", async () => {
  const f = await fixture(), source = new TargetedStylePanelInputs(f.studio, { kind: "mixins", view: f.view, tpl: f.root }), changed = vi.fn(), stop = source.subscribe(changed);
  changed.mockClear(); const before = source.getSnapshot();
  await f.studio.changeUnsafe(() => { new RuleSetHelpers(f.root.vsettings[0].rs, "div").set("padding-left", "3px"); });
  expect(source.getSnapshot()).toBe(before); expect(changed).not.toHaveBeenCalled();
  await f.studio.changeUnsafe(() => { f.mixin.name = "Renamed mixin"; });
  expect(changed).toHaveBeenCalledOnce(); changed.mockClear();
  await f.studio.changeUnsafe(() => { f.view.variantTplMgr().applyMixin(f.root, f.mixin, f.view.variantTplMgr().getTargetVariantComboForNode(f.root)); });
  expect(changed).toHaveBeenCalledOnce(); expect(f.root.vsettings[0].rs.mixins).toContain(f.mixin);
  f.studio.disposeViewCtx(f.view); changed.mockClear();
  expect(source.isActive()).toBe(false); expect(source.getSnapshot()).toEqual([]);
  await f.studio.changeUnsafe(() => { f.mixin.name = "After closed view"; });
  expect(changed).not.toHaveBeenCalled(); stop();
});

it("keeps style-expression arguments and selector ownership on their original command objects", async () => {
  const f = await fixture(), button = new TargetedStylePanelInputs(f.studio, { kind: "button", view: f.view, tpl: f.instance, attr: "className" }), changed = vi.fn(), stop = button.subscribe(changed);
  changed.mockClear();
  const mounted = render(<AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studio}><div className="app-container"><SidebarModalProvider><StyleExprButton viewCtx={f.view} tpl={f.instance} attr="className" spec={{ styleSections: [] }} /></SidebarModalProvider></div></StudioCtxContext.Provider></AppCtxContext.Provider>);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Configure styles" })); });
  const expr = ensureKnownStyleExpr(ensure(f.view.variantTplMgr().getArg(f.instance, f.param.variable), "Original style argument").expr);
  expect(changed).toHaveBeenCalledOnce(); expect(expr.styles).toHaveLength(1);
  const selectors = new TargetedStylePanelInputs(f.studio, { kind: "selectors", expr }), selectorChanged = vi.fn(), stopSelectors = selectors.subscribe(selectorChanged);
  selectorChanged.mockClear();
  await act(async () => { await f.studio.changeUnsafe(() => { expr.styles.push(mkSelectorRuleSet({ selector: ":hover", isBase: false })); }); });
  expect(selectorChanged).toHaveBeenCalledOnce();
  const original = expr.styles[1];
  await act(async () => { await f.studio.changeUnsafe(() => { original.selector = ":focus"; }); });
  expect(expr.styles[1]).toBe(original); expect(selectorChanged).toHaveBeenCalledTimes(2);
  expect(ensure(f.view.variantTplMgr().getArg(f.instance, f.param.variable), "Retained style argument").expr).toBe(expr);
  const replacement = new StyleExpr({ uuid: "replacement-style", styles: [mkSelectorRuleSet({ selector: null, isBase: true })] });
  await act(async () => { await f.studio.changeUnsafe(() => { f.view.variantTplMgr().setArg(f.instance, f.param.variable, replacement); }); });
  expect(ensure(f.view.variantTplMgr().getArg(f.instance, f.param.variable), "Replaced argument").expr).toBe(replacement);
  mounted.unmount(); stopSelectors(); stop();
});


it("refreshes imperative style helpers inside unfinished native commands without redirecting their write target", async () => {
  const f = await fixture(), provider = new TplExpsProvider(f.view, f.root);
  await f.studio.changeUnsafe(() => { new RuleSetHelpers(f.root.vsettings[0].rs, "div").set("width", "100px"); });
  const initial = provider.mergedExp();
  expect(initial.get("width")).toBe("100px"); expect(provider.mergedExp()).toBe(initial);
  const target = f.root.vsettings[0].rs;
  await f.studio.changeUnsafe(() => {
    new RuleSetHelpers(target, "div").set("width", "240px");
    expect(provider.mergedExp().get("width")).toBe("240px");
    provider.mergedExp().set("height", "80px");
    expect(provider.mergedExp().get("height")).toBe("80px");
  });
  expect(provider.targetRs()).toBe(target); expect(target.values.height).toBe("80px");
  expect(provider.mergedExp().get("width")).toBe("240px");
});

it("keeps a mounted provider on the current target variant and rejects writes after its owner retires", async () => {
  const f = await fixture(), provider = new TplExpsProvider(f.view, f.root), base = f.root.vsettings[0].rs;
  const variant = mkVariant({ name: "Compact" });
  await f.studio.changeUnsafe(() => {
    f.view.currentComponent().variants.push(variant);
    new RuleSetHelpers(base, "div").set("width", "120px");
    new RuleSetHelpers(ensureVariantSetting(f.root, [variant]).rs, "div").set("width", "240px");
  });
  expect(provider.mergedExp().get("width")).toBe("120px");
  await f.studio.changeUnsafe(() => { f.view.currentComponentStackFrame().setTargetVariants([variant]); });
  expect(provider.targetVariantCombo).toEqual([variant]);
  expect(provider.mergedExp().get("width")).toBe("240px");
  const target = ensureVariantSetting(f.root, [variant]).rs;
  await f.studio.changeUnsafe(() => { provider.mergedExp().set("height", "80px"); });
  expect(provider.targetRs()).toBe(target); expect(target.values.height).toBe("80px"); expect(base.values.height).not.toBe("80px");
  f.studio.disposeViewCtx(f.view);
  expect(provider.canEdit()).toBe(false);
  expect(() => provider.targetRs()).toThrow("retired model or component context");
});
