import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PlumeMissingIngredientsPanel } from "@/wab/client/components/plume/PlumeComponentPanel";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { setLanguagePreference } from "@/wab/client/i18n";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { createSite } from "@/wab/shared/core/sites";
import { PlumeInfo, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar/SidebarSection", () => ({ SidebarSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
afterEach(cleanup);
it("refreshes a complete component ingredient scan on admitted tree edits and retires old props", async () => {
  await setLanguagePreference("en");
  const site = createSite();
  const component = mkComponent({ type: ComponentType.Plain, name: "Plume button", plumeInfo: new PlumeInfo({ type: "button" }), tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }) });
  site.components.push(component);
  const root = ensureKnownTplTag(component.tplTree); root.name = "Wrong";
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.dbCtx().maybeObserveComponents([component]);
  const mounted = render(<StudioCtxContext.Provider value={studio}><PlumeMissingIngredientsPanel component={component} /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByText("Missing elements:")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { root.name = "root"; }); });
    expect(screen.queryByText("Missing elements:")).toBeNull();
    act(() => studio.dispose());
    expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); studio.dispose(); }
});
