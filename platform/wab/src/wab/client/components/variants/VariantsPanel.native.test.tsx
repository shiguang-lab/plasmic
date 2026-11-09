import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { VariantsPanel } from "@/wab/client/components/variants/VariantsPanel";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

it("refreshes panel group membership and names on native edits and retires its original view", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Variant owner", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Mode" }), variant = manager.createVariant(component, group, "Original option");
  const frame = mkArenaFrame({ site, component, name: "Variants", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Variants", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Variants" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); const view = ensure(studio.tryGetViewCtxForFrame(frame), "Variant panel view");
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><VariantsPanel studioCtx={studio} component={component} viewCtx={view} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByText("Original option")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { variant.name = "Updated option"; group.param.variable.name = "Appearance"; }); });
    expect(screen.getByText("Updated option")).toBeTruthy(); expect(screen.getByText("Appearance")).toBeTruthy(); expect(screen.queryByText("Original option")).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => { manager.createVariant(component, group, "Second option"); }); });
    expect(screen.getByText("Second option")).toBeTruthy();
    act(() => studio.disposeViewCtx(view)); expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); vi.restoreAllMocks(); }
});
