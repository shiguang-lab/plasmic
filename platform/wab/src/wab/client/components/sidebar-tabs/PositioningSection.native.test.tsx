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
  await waitFor(() => expect(studio.isSelectionPending).toBe(false));
  const provider = new TplExpsProvider(view, child), styling = new StyleTarget({ expsProvider: provider });
  const setPosition = vi.spyOn(provider, "onPositionChange").mockImplementation((value) => { provider.targetExp().set("position", value); });
  const mounted = render(
    <AppContext.Provider value={studio.app}>
      <AppCtxContext.Provider value={appCtx}>
        <StudioCtxContext.Provider value={studio}>
          <StyleTargetContext.Provider value={styling}>
            <PositioningPanelSection expsProvider={provider} />
          </StyleTargetContext.Provider>
        </StudioCtxContext.Provider>
      </AppCtxContext.Provider>
    </AppContext.Provider>,
  );
  try {
    expect(screen.getByTestId("position-mode-trigger").textContent).toContain("Free");
    fireEvent.click(screen.getByTestId("position-mode-trigger"));
    expect(screen.queryByTestId("position-mode-option-relative")).toBeNull();
    fireEvent.click(screen.getByTestId("position-mode-trigger"));

    await act(async () => {
      await studio.changeUnsafe(() => {
        parentStyles.set("display", "flex");
        parentStyles.set("flex-direction", "row");
      });
    });

    fireEvent.click(screen.getByTestId("position-mode-trigger"));
    expect(screen.getByTestId("position-mode-option-relative")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("position-mode-option-relative"));
    });
    expect(setPosition).toHaveBeenCalledWith("relative");
    expect(provider.targetRs()).toBe(child.vsettings[0].rs);
    expect(screen.getByTestId("position-align-strip").getAttribute("data-cross-axis")).toBe("vertical");

    await act(async () => {
      await studio.changeUnsafe(() => {
        parentStyles.set("flex-direction", "column");
      });
    });
    expect(screen.getByTestId("position-align-strip").getAttribute("data-cross-axis")).toBe("horizontal");

    await act(async () => {
      await studio.changeUnsafe(() => {
        $$$(otherParent).append(child);
      });
    });
    fireEvent.click(screen.getByTestId("position-mode-trigger"));
    expect(screen.queryByTestId("position-mode-option-relative")).toBeNull();
    expect(screen.queryByTestId("position-align-strip")).toBeNull();

    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByTestId("position-card")).toBeNull();
  } finally {
    mounted.unmount();
    await studio.awaitEval();
    studio.dispose();
  }
});
