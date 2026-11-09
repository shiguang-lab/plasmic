import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { LegacyComponentParamsSection } from "@/wab/client/components/sidebar-tabs/legacy-component-params-section";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/BoolPropEditor", () => ({ BoolPropEditor: ({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) => <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /> }));
afterEach(cleanup);
it("refreshes variant parameter captions and the original trap-focus setting", async () => {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Legacy definitions" });
  const group = manager.createVariantGroup({ component, name: "OriginalGroup" });
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); studio.dbCtx().maybeObserveComponents([component]);
  const mounted = render(<StudioCtxContext.Provider value={studio}><LegacyComponentParamsSection studioCtx={studio} component={component} justOneSection="variants" /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByText("OriginalGroup")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { group.param.variable.name = "UpdatedGroup"; component.trapsFocus = true; }); });
    expect(screen.getByText("UpdatedGroup")).toBeTruthy(); expect(screen.queryByText("OriginalGroup")).toBeNull();
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles).toHaveLength(3); expect(toggles[2]).toHaveProperty("checked", true);
  } finally { mounted.unmount(); studio.dispose(); }
});
