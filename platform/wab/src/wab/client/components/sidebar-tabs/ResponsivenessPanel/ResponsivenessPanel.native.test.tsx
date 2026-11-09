import { captureVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ResponsivenessPanel } from "@/wab/client/components/sidebar-tabs/ResponsivenessPanel/ResponsivenessPanel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { ResponsivePanelInputs } from "@/wab/client/hooks/responsive-panel-inputs";
import { TplMgr } from "@/wab/shared/TplMgr";
import { createSite } from "@/wab/shared/core/sites";
import { ScreenSizeSpec } from "@/wab/shared/css-size";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("refreshes media queries and labels and renames the canonical breakpoint", async () => {
  const site = createSite(), manager = new TplMgr({ site }), variant = manager.createScreenVariant({ name: "Compact", spec: new ScreenSizeSpec(undefined, 640) });
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const source = new ResponsivePanelInputs(captureVariantModelWorld(studio)), changed = vi.fn(), stop = source.subscribe(changed);
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><ResponsivenessPanel /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByDisplayValue("Compact")).toBeTruthy();
    const original = site.activeScreenVariantGroup;
    await act(async () => { await studio.changeUnsafe(() => { variant.name = "Phone"; manager.updateScreenVariantQuery(variant, new ScreenSizeSpec(undefined, 720).query()); }); });
    expect(screen.getByDisplayValue("Phone")).toBeTruthy(); expect(screen.getByDisplayValue(/720/)).toBeTruthy();
    const input = screen.getByDisplayValue("Phone");
    await act(async () => { fireEvent.change(input, { target: { value: "Narrow" } }); fireEvent.blur(input); });
    await waitFor(() => expect(variant.name).toBe("Narrow")); expect(site.activeScreenVariantGroup).toBe(original); expect(original?.variants).toContain(variant);
    const snapshot = source.getSnapshot(); changed.mockClear();
    await studio.changeUnsafe(() => { site.flags = { unrelated: true }; });
    expect(source.getSnapshot()).toBe(snapshot); expect(changed).not.toHaveBeenCalled();
  } finally { stop(); mounted.unmount(); studio.dispose(); }
});
