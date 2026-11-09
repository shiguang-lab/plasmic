import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { GridChildSection } from "@/wab/client/components/sidebar-tabs/GridChildSection";
import { createStyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates grid placement from native model commits and preserves the real span edit command", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Grid child", type: ComponentType.Plain });
  const tpl = ensureKnownTplTag(component.tplTree);
  const rsh = RSH(ensureBaseVariantSetting(tpl).rs, tpl);
  rsh.set("grid-row-start", "2"); rsh.set("grid-row-end", "span 3");
  rsh.set("grid-column-start", "4"); rsh.set("grid-column-end", "span 5");
  const frame = mkArenaFrame({ site, component, name: "Grid", width: 200, height: 100, left: 0, top: 0 });
  site.arenas.push(mkMixedArena("Grid", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Grid" });
  try {
    await waitFor(() => expect(studio.initialRouteReady).toBe(true));
    studio.observeComponents([component]);
    const view = ensure(studio.tryGetViewCtxForFrame(frame), "Grid view");
    vi.spyOn(view, "awaitSync").mockResolvedValue(undefined);
    const provider = new TplExpsProvider(view, tpl);
    const sc = createStyleTarget({ expsProvider: provider });
    const mounted = render(<StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}>
      <GridChildSection expsProvider={provider} />
    </StyleTargetContext.Provider></StudioCtxContext.Provider>);
    const inputs = () => [...mounted.container.querySelectorAll<HTMLInputElement>("input")];
    expect(inputs().map((input) => input.value)).toEqual(["2", "3", "4", "5"]);
    await act(async () => { await studio.changeUnsafe(() => { rsh.set("grid-row-start", "6"); rsh.clear("grid-column-end"); }); });
    await waitFor(() => expect(inputs().map((input) => input.value)).toEqual(["6", "3", "4", "1"]));
    await act(async () => {
      const span = ensure(inputs()[1], "Grid row span input");
      fireEvent.change(span, { target: { value: "7" } });
    });
    await act(async () => { fireEvent.keyDown(ensure(inputs()[1], "Grid row span input"), { key: "Enter" }); });
    await waitFor(() => expect(rsh.get("grid-row-end")).toBe("span 7"));
    mounted.unmount();
  } finally {
    cleanup(); await studio.awaitEval(); studio.dispose();
  }
});
