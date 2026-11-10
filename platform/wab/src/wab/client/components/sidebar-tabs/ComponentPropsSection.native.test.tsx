import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentPropsSection, TplTagNameSection } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX, TplTagType } from "@/wab/shared/core/tpls";
import { Arg, RawText, RenderExpr, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ensureBaseVariantSetting } from "@/wab/shared/VariantTplMgr";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("edits a fixed slot through the owner's Label prop using the same text node", async () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const owner = manager.addComponent({ name: "Owner", type: ComponentType.Plain });
  const meta = { name: "Field", importPath: "./Field", props: { label: { type: "slot" as const, fixedRoot: true } } };
  const field = mkCodeComponent("Field", meta, {});
  const param = mkParam({ name: "label", type: typeFactory.renderable(), paramType: "slot" });
  field.params.push(param); site.components.push(field);
  const tpl = mkTplComponent(field, owner.variants[0]);
  const root = ensureKnownTplTag(owner.tplTree); tpl.parent = root; root.children.push(tpl);
  const label = mkTplTagX("span", { type: TplTagType.Text, baseVariant: owner.variants[0] });
  label.name = "Label"; label.parent = tpl;
  ensureBaseVariantSetting(owner, label).text = new RawText({ text: "关键词", markers: [] });
  tpl.vsettings[0].args.push(new Arg({ param, expr: new RenderExpr({ tpl: [label] }) }));
  const frame = mkArenaFrame({ site, component: owner, name: "Label props", width: 400, height: 300 });
  site.arenas.push(mkMixedArena("Label props", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Label%20props" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([owner, field]); studio.createViewStateUndoRecord();
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Label property view");
  vi.spyOn(view, "getCodeComponentMeta").mockReturnValue(meta);
  view.selection.setTpls([tpl]);
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><ComponentPropsSection viewCtx={view} tpl={tpl} tab="settings" expsProvider={new TplExpsProvider(view, tpl)} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByText("Label")).toBeTruthy();
    expect(screen.queryByTestId("slot-content-navigation")).toBeNull();
    const input = screen.getByDisplayValue("关键词");
    fireEvent.change(input, { target: { value: "查询关键词" } });
    await waitFor(() => expect(label.vsettings[0].text).toMatchObject({ text: "查询关键词" }));
    await act(async () => { await studio.changeUnsafe(() => { label.vsettings[0].text = new RawText({ text: "客户昵称", markers: [] }); }); });
    expect(screen.getByDisplayValue("客户昵称")).toBeTruthy();
    expect(tpl.vsettings[0].args).toHaveLength(1);
    expect(tpl.vsettings[0].args[0].expr).toMatchObject({ tpl: [label] });
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});

it("updates an instance's actual prop catalog and keeps disposed element sections retired", async () => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const owner = manager.addComponent({ name: "Owner", type: ComponentType.Plain }), target = manager.addComponent({ name: "Target", type: ComponentType.Plain });
  const param = mkParam({ name: "OriginalProp", type: typeFactory.text(), paramType: "prop" }); target.params.push(param);
  const root = ensureKnownTplTag(owner.tplTree), tpl = mkTplComponent(target, owner.variants[0]); tpl.parent = root; root.children.push(tpl);
  const frame = mkArenaFrame({ site, component: owner, name: "Properties", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Properties", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Properties" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); const view = ensure(studio.tryGetViewCtxForFrame(frame), "Property view");
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><ComponentPropsSection viewCtx={view} tpl={tpl} tab="settings" expsProvider={new TplExpsProvider(view, tpl)} /><TplTagNameSection viewCtx={view} tpl={root} applyMenu={null} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByText("OriginalProp")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { param.variable.name = "UpdatedProp"; root.name = "Updated root"; }); });
    expect(screen.getByText("UpdatedProp")).toBeTruthy(); expect(screen.queryByText("OriginalProp")).toBeNull();
    expect(screen.getByDisplayValue("Updated root")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { target.params = []; }); });
    expect(screen.queryByText("UpdatedProp")).toBeNull();
    act(() => studio.disposeViewCtx(view)); expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
