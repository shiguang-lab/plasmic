import { BottomModalsProvider } from "@/wab/client/components/BottomModal";
import { DataSourceOpPickerProvider } from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentDataQueriesSection } from "@/wab/client/components/sidebar-tabs/component-data-queries-section";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr, addEmptyQuery } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

it("updates legacy query labels and membership from completed changes and retires the original owner", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), component = new TplMgr({ site }).addComponent({ name: "Query catalog", type: ComponentType.Plain });
  const query = addEmptyQuery(component); query.name = "Original query";
  const frame = mkArenaFrame({ site, component, name: "Queries", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Queries", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Queries" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); const view = ensure(studio.tryGetViewCtxForFrame(frame), "Query view");
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><BottomModalsProvider><DataSourceOpPickerProvider><ComponentDataQueriesSection component={component} viewCtx={view} isDeprecated={false} /></DataSourceOpPickerProvider></BottomModalsProvider></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByText("Original query")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { query.name = "Updated query"; }); });
    expect(screen.getByText("Updated query")).toBeTruthy(); expect(screen.queryByText("Original query")).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => { addEmptyQuery(component).name = "Second query"; }); });
    expect(screen.getByText("Second query")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { component.dataQueries = component.dataQueries.filter((item) => item !== query); }); });
    expect(screen.queryByText("Updated query")).toBeNull();
    act(() => studio.disposeViewCtx(view)); expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); vi.restoreAllMocks(); }
});
