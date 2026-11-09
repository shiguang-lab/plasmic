import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext, StylePanelSection } from "@/wab/client/components/style-controls/StyleComponent";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import sidebarStyles from "@/wab/client/components/sidebar/SidebarSection.module.scss";
import indicatorStyles from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { useStyleIndicator } from "@/wab/client/studio-ctx/style-inputs-react";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function IndicatorRead({ provider }: { provider: SingleRsExpsProvider }) {
  const indicator = useStyleIndicator(provider, "opacity");
  return <output data-testid="indicator-recipe">{indicator.source}{indicator.source === "setNonVariable" ? `:${indicator.value}` : ""}</output>;
}

async function setup() {
  const site = createSite();
  const rs = ensure(site.activeTheme, "Active theme").defaultStyle.rs;
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const provider = new SingleRsExpsProvider(rs, new RuleSetHelpers(rs, "div"), studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const sc = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}>{children}</StyleTargetContext.Provider></StudioCtxContext.Provider>;
  return { studio, rs, provider, wrap };
}

it("updates the actual shared section and wrapper from installed recipes while preserving the real indicator popover", async () => {
  const f = await setup();
  vi.spyOn(f.provider, "definedIndicator").mockImplementation(() => { throw new Error("Render must use the installed recipe"); });
  const mounted = render(f.wrap(<>
    <IndicatorRead provider={f.provider} />
    <StylePanelSection expsProvider={f.provider} title="Native opacity" styleProps={["opacity"]}><span>Controls</span></StylePanelSection>
    <StyleWrapper styleName="opacity" showDefinedIndicator><span>Wrapped control</span></StyleWrapper>
  </>));
  try {
    expect(screen.getByTestId("indicator-recipe").textContent).toBe("none");
    const title = ensure(screen.getByText("Native opacity").closest(`.${sidebarStyles.headerTitle}`), "Section title");
    expect(title.classList.contains(sidebarStyles.headerTitleActive)).toBe(false);
    const wrapper = ensure(mounted.container.querySelector(".style-wrapper__defined-container"), "Wrapper indicator container");
    expect(wrapper.childElementCount).toBe(0);
    await act(async () => { await f.studio.changeUnsafe(() => { new RuleSetHelpers(f.rs, "div").set("opacity", "0.4"); }); });
    expect(screen.getByTestId("indicator-recipe").textContent).toBe("setNonVariable:0.4");
    expect(title.classList.contains(sidebarStyles.headerTitleActive)).toBe(true);
    const dot = ensure(wrapper.querySelector(`.${indicatorStyles.DefinedIndicatorContainer}`), "Real indicator trigger");
    fireEvent.mouseEnter(dot);
    expect(await screen.findByText("Value is set")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { new RuleSetHelpers(f.rs, "div").set("opacity", "0.7"); }); });
    expect(screen.getByTestId("indicator-recipe").textContent).toBe("setNonVariable:0.7");
    expect(await screen.findByText("0.7")).toBeTruthy();
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps a mounted terminal recipe and an initially closed recipe empty without resolving a disposed world", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => { new RuleSetHelpers(f.rs, "div").set("opacity", "0.6"); });
  const mounted = render(<IndicatorRead provider={f.provider} />);
  expect(screen.getByTestId("indicator-recipe").textContent).toBe("setNonVariable:0.6");
  const models = f.studio.modelSnapshots;
  await act(async () => { await f.studio.awaitEval(); f.studio.dispose(); });
  const resolve = vi.spyOn(models, "resolve");
  const get = vi.spyOn(f.studio.singleRsStyleInputs, "get");
  mounted.rerender(<IndicatorRead provider={f.provider} />);
  expect(screen.getByTestId("indicator-recipe").textContent).toBe("setNonVariable:0.6");
  mounted.unmount();
  render(<IndicatorRead provider={f.provider} />);
  expect(screen.getByTestId("indicator-recipe").textContent).toBe("none");
  expect(resolve).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
});
