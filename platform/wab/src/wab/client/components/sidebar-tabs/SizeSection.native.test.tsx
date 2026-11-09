import { AppContext } from "@/wab/client/components/top-view";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SizeSection } from "@/wab/client/components/sidebar-tabs/SizeSection";
import { ensureVariantSetting, mkVariant } from "@/wab/shared/Variants";
import { StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("refreshes a mounted size editor and writes the current canonical variant without replacing its provider", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Size controls", type: ComponentType.Plain });
  const root = component.tplTree, variant = mkVariant({ name: "Compact" }); component.variants.push(variant);
  const base = root.vsettings[0].rs, target = ensureVariantSetting(root, [variant]).rs;
  new RuleSetHelpers(base, "div").set("width", "120px"); new RuleSetHelpers(target, "div").set("width", "240px");
  const frame = mkArenaFrame({ site, component, name: "Size controls", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Size controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Size%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Sizing view"); studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  await waitFor(() => expect(studio.isSelectionPending).toBe(false));
  const provider = new TplExpsProvider(view, root), styling = new StyleTarget({ expsProvider: provider });
  const mounted = render(<AppContext.Provider value={studio.app}><AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><SizeSection expsProvider={provider} /></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>);
  try {
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "120px");
    await act(async () => { await studio.changeUnsafe(() => { view.currentComponentStackFrame().setTargetVariants([variant]); }); });
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "240px");
    expect(provider.canEdit()).toBe(true);
    act(() => { fireEvent.focus(screen.getByRole("textbox", { name: "Width" })); });
    act(() => { fireEvent.change(screen.getByRole("textbox", { name: "Width" }), { target: { value: "320px" } }); });
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "320px");
    await act(async () => { fireEvent.keyDown(screen.getByRole("textbox", { name: "Width" }), { key: "Enter", code: "Enter" }); });
    await waitFor(() => expect(target.values.width).toBe("320px")); expect(base.values.width).toBe("120px"); expect(provider.targetRs()).toBe(target);
    await act(async () => { await studio.changeUnsafe(() => { new RuleSetHelpers(target, "div").set("width", "360px"); }); });
    expect(screen.getByRole("textbox", { name: "Width" })).toHaveProperty("value", "360px");
    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByRole("textbox", { name: "Width" })).toBeNull();
    expect(provider.canEdit()).toBe(false);
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
