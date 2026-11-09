import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { DraggableDimLabel } from "@/wab/client/components/sidebar/sidebar-helpers";
import { mkTokenRef } from "@/wab/commons/StyleToken";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/commons/components/XDraggable", () => ({ XDraggable: ({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) => <div data-testid="dimension-drag" data-disabled={String(disabled)}>{children}</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("refreshes dimension dragging for actual CSS and token-head changes with stable style-name props", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Dimension labels", type: ComponentType.Plain });
  const root = component.tplTree, token = manager.addStyleToken({ name: "Spacing", tokenType: "Spacing", value: "10px" });
  const styles = new RuleSetHelpers(root.vsettings[0].rs, "div"); styles.set("width", mkTokenRef(token));
  const frame = mkArenaFrame({ site, component, name: "Dimension labels", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Dimension labels", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Dimension%20labels" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Dimension view"); studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = new TplExpsProvider(view, root), keys = ["width"];
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><DraggableDimLabel studioCtx={studio} expsProvider={provider} label="Width" styleNames={keys} defaultUnit="px" /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByTestId("dimension-drag").getAttribute("data-disabled")).toBe("false");
    await act(async () => { await studio.changeUnsafe(() => { token.value = "calc(10px + 2px)"; }); });
    expect(screen.getByTestId("dimension-drag").getAttribute("data-disabled")).toBe("true");
    await act(async () => { await studio.changeUnsafe(() => { styles.set("width", "24px"); }); });
    expect(screen.getByTestId("dimension-drag").getAttribute("data-disabled")).toBe("false");
    await act(async () => { await studio.changeUnsafe(() => { styles.set("width", "calc(100% - 4px)"); }); });
    expect(screen.getByTestId("dimension-drag").getAttribute("data-disabled")).toBe("true");
    expect(provider.targetRs()).toBe(root.vsettings[0].rs);
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
