import { ensureVariantSetting, mkVariant } from "@/wab/shared/Variants";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StyleExprButton } from "@/wab/client/components/sidebar-tabs/StyleExprModal";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { getTargetedStylePanelInputs, TargetedStylePanelInputs, useTargetedStylePanelInputs } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkSelectorRuleSet } from "@/wab/shared/core/styles";
import { mkSlot, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { $$$ } from "@/wab/shared/TplQuery";
import { RenderExpr, StyleExpr, ensureKnownSlotParam, ensureKnownStyleExpr, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { CONTENT_LAYOUT } from "@/wab/shared/core/style-props";
import { setTplVisibilityToDisplayNone } from "@/wab/shared/visibility-utils";
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

it("shares target inputs without subscribing unrelated siblings and catches edits made while hidden", async () => {
  const f = await fixture();
  const sibling = mkTplTagX("div");
  await f.studio.changeUnsafe(() => {
    ensureVariantSetting(sibling, [f.view.component.variants[0]]);
    $$$(f.root).append(sibling);
  });
  const input = { kind: "visibility", view: f.view, tpl: f.instance } as const;
  const source = getTargetedStylePanelInputs(f.studio, input);
  expect(getTargetedStylePanelInputs(f.studio, input)).toBe(source);
  const collect = vi.spyOn(f.studio.modelSnapshots, "declaredField");
  const before = source.getSnapshot();
  const readCount = collect.mock.calls.length;
  expect(readCount).toBeGreaterThan(0);
  expect(collect.mock.calls.some(([model]) => model === sibling || model === sibling.vsettings[0] || model === sibling.vsettings[0].rs)).toBe(false);
  source.getSnapshot(); source.getRenderInputs();
  expect(collect).toHaveBeenCalledTimes(readCount);
  const subscribe = vi.spyOn(f.studio.modelSnapshots, "subscribePreparedField");
  const notify = vi.fn(), stop = source.subscribe(notify);
  const subscriptions = subscribe.mock.calls.length;
  const secondStop = getTargetedStylePanelInputs(f.studio, input).subscribe(() => undefined);
  expect(subscribe).toHaveBeenCalledTimes(subscriptions);
  expect(collect).toHaveBeenCalledTimes(readCount);
  notify.mockClear();
  await f.studio.changeUnsafe(() => { new RuleSetHelpers(sibling.vsettings[0].rs, "div").set("display", "none"); });
  expect(notify).not.toHaveBeenCalled();
  expect(source.getSnapshot()).toBe(before);
  secondStop(); stop();
  await f.studio.changeUnsafe(() => { setTplVisibilityToDisplayNone(f.instance, f.instance.vsettings[0]); });
  expect(source.getSnapshot()).not.toBe(before);
  const reopened = source.getSnapshot();
  const stopAgain = source.subscribe(() => undefined);
  expect(source.getSnapshot()).toBe(reopened);
  stopAgain();
});

it("follows the actual layout parent through a supplied slot and rebinds when that slot moves", async () => {
  const f = await fixture();
  const owner = f.instance.component;
  f.studio.observeComponents([f.view.component, owner]);
  const param = ensureKnownSlotParam(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() }));
  const slot = mkSlot(param), first = mkTplTagX("div", {}, [slot]), second = mkTplTagX("div"), supplied = mkTplTagX("div");
  await f.studio.changeUnsafe(() => {
    owner.params.push(param);
    for (const node of [slot, first, second]) { ensureVariantSetting(node, [owner.variants[0]]); }
    ensureVariantSetting(supplied, [f.view.component.variants[0]]);
    $$$(owner.tplTree).append(first).append(second);
    $$$(f.instance).setSlotArg("children", new RenderExpr({ tpl: [supplied] }));
  });
  const source = getTargetedStylePanelInputs(f.studio, { kind: "layout", view: f.view, tpl: supplied });
  const stop = source.subscribe(() => undefined);
  expect(source.getRenderInputs().layout?.parent).toBe(f.studio.modelSnapshots.ref(first));
  expect(source.getRenderInputs().layout?.parentIsContentLayout).toBe(false);
  await f.studio.changeUnsafe(() => { new RuleSetHelpers(first.vsettings[0].rs, "div").set("display", CONTENT_LAYOUT); });
  expect(source.getRenderInputs().layout?.parentIsContentLayout).toBe(true);
  await f.studio.changeUnsafe(() => { $$$(second).append(slot); });
  expect(source.getRenderInputs().layout?.parent).toBe(f.studio.modelSnapshots.ref(second));
  expect(source.getRenderInputs().layout?.parentIsContentLayout).toBe(false);
  stop();
});

it("replaces a retired mounted input when the editing context changes for the same template", async () => {
  const f = await fixture(), frame = f.view.arenaFrame();
  const context = (key: string) => new ComponentCtx({ valComponent: new ValComponent({
    tpl: frame.container, key, fullKey: key, frameUid: frame.uid, valOwner: undefined,
    parent: undefined, fibers: [], className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map(),
  }) });
  f.view.selection.setContext(context("First"));
  const input = { kind: "style-tab", view: f.view, tpl: f.root } as const;
  const first = getTargetedStylePanelInputs(f.studio, input);
  function Panel() {
    const snapshot = useTargetedStylePanelInputs(f.studio, input);
    return <output>{String(snapshot.active)}</output>;
  }
  const mounted = render(<Panel />);
  expect(screen.getByText("true")).toBeTruthy();
  act(() => f.view.selection.setContext(context("Second")));
  expect(first.isActive()).toBe(false);
  expect(screen.getByText("true")).toBeTruthy();
  expect(getTargetedStylePanelInputs(f.studio, input)).not.toBe(first);
  act(() => f.view.selection.setContext(null));
  expect(screen.getByText("true")).toBeTruthy();
  mounted.unmount();
});
