import { AppContext } from "@/wab/client/components/top-view";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PositioningPanelSection } from "@/wab/client/components/sidebar-tabs/PositioningSection";
import { StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/style-controls/PosControls", () => ({ PosControls2: () => null, PosPushButtons: () => null }));
vi.mock("@/wab/client/components/style-controls/align-items-controls", () => ({ AlignItemsControls: ({ dir }: { dir: string }) => <output data-testid="parent-flex-direction">{dir}</output> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("refreshes real positioning modes and flex direction when the deep layout parent changes", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Position controls", type: ComponentType.Plain });
  const root = component.tplTree, base = component.variants[0], child = mkTplTagX("div", { baseVariant: base, styles: { position: "absolute" } }), otherParent = mkTplTagX("div", { baseVariant: base, styles: { display: "block" } });
  $$$(root).append(child); $$$(root).append(otherParent);
  const parentStyles = new RuleSetHelpers(root.vsettings[0].rs, "div"); parentStyles.set("display", "block");
  new RuleSetHelpers(child.vsettings[0].rs, "div").set("position", "absolute");
  new RuleSetHelpers(otherParent.vsettings[0].rs, "div").set("display", "block");
  const frame = mkArenaFrame({ site, component, name: "Position controls", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Position controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Position%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Positioning view"); studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(child);
  const provider = new TplExpsProvider(view, child), styling = new StyleTarget({ expsProvider: provider });
  const setPosition = vi.spyOn(provider, "onPositionChange").mockImplementation((value) => { provider.targetExp().set("position", value); });
  const mounted = render(<AppContext.Provider value={studio.app}><AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><PositioningPanelSection expsProvider={provider} /></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>);
  try {
    expect(screen.queryByRole("button", { name: "Auto" })).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => { parentStyles.set("display", "flex"); parentStyles.set("flex-direction", "row"); }); });
    expect(screen.getByRole("button", { name: "Auto" })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Auto" })); });
    expect(setPosition).toHaveBeenCalledWith("relative"); expect(provider.targetRs()).toBe(child.vsettings[0].rs);
    expect(screen.getByTestId("parent-flex-direction").textContent).toBe("row");
    await act(async () => { await studio.changeUnsafe(() => { parentStyles.set("flex-direction", "column"); }); });
    expect(screen.getByTestId("parent-flex-direction").textContent).toBe("column");
    await act(async () => { await studio.changeUnsafe(() => { $$$(otherParent).append(child); }); });
    expect(screen.queryByRole("button", { name: "Auto" })).toBeNull();
    expect(screen.queryByTestId("parent-flex-direction")).toBeNull();
    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByRole("button", { name: "Free" })).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
