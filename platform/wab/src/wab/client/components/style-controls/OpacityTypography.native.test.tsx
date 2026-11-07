import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { OpacityControl } from "@/wab/client/components/style-controls/OpacityControl";
import { Typography } from "@/wab/client/components/style-controls/Typography";
import { SingleRsExpsProvider, StyleComponent, StyleComponentContext } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates real opacity and typography indicators and avoids context demand when an explicit helper is provided", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Typography", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Typography", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Controls", [frame]));
  const rs = ensure(site.activeTheme, "Active theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div");
  exp.set("opacity", "0.2");
  exp.clear("line-height"); exp.clear("letter-spacing");
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.setStudioFocusOnViewCtxContent(ensure(studio.tryGetViewCtxForFrame(frame), "Control view"));
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const sc = new StyleComponent({ expsProvider: provider });
  const declared = vi.spyOn(studio.modelSnapshots, "declaredField");
  const controls = (vsh?: VariantedStylesHelper) => <StudioCtxContext.Provider value={studio}><StyleComponentContext.Provider value={sc}>
    <OpacityControl expsProvider={provider} vsh={vsh} />
    <Typography vsh={vsh} inheritableOnly onChange={(name, value) => sc.change(() => exp.set(name, value))} unset={(name) => sc.change(() => exp.clear(name))}
      renderMaybeCollapsibleRows={(rows) => rows.map((row, index) => row && <section key={index} data-testid={`collapsible-${index}`} data-collapsible={String(row.collapsible)}>{row.content}</section>)} />
  </StyleComponentContext.Provider></StudioCtxContext.Provider>;
  const mounted = render(controls());
  try {
    expect(screen.getByDisplayValue("20%")).toBeTruthy();
    expect(screen.getByTestId("collapsible-0").getAttribute("data-collapsible")).toBe("true");
    expect(declared.mock.calls.some(([model, key]) => model === frame && key === "targetGlobalVariants")).toBe(true);
    await act(async () => { await studio.changeUnsafe(() => { exp.set("opacity", "0.6"); exp.set("line-height", "1.8"); }); });
    expect(screen.getByDisplayValue("60%")).toBeTruthy();
    expect(screen.getByTestId("collapsible-0").getAttribute("data-collapsible")).toBe("false");
    mounted.unmount(); declared.mockClear();
    const explicit = new VariantedStylesHelper();
    const provided = render(controls(explicit));
    expect(screen.getByDisplayValue("60%")).toBeTruthy();
    expect(declared.mock.calls.some(([model, key]) => model === frame && key === "targetGlobalVariants")).toBe(false);
    provided.unmount();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
