import indicatorStyles from "@/wab/client/components/style-controls/DefinedIndicator.module.sass";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { LabeledStyleCheckboxItem, LabeledStyleSwitchItem, LabeledToggleButtonGroup } from "@/wab/client/components/sidebar/sidebar-helpers";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import toggleStyles from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleToggleButton.module.css";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("uses native checkbox, switch and toggle indicators and retains all original edit commands", async () => {
  const site = createSite(), rs = ensure(site.activeTheme, "Theme").defaultStyle.rs, exp = new RuleSetHelpers(rs, "div"); exp.set("flex-direction", "row");
  const { studioCtx: studio } = fakeStudioCtx({ site }); await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" }), sc = new StyleTarget({ expsProvider: provider });
  const indicators = vi.spyOn(provider, "definedIndicator").mockImplementation((prop) => {
    throw new Error(`Native checkbox, switch and toggle rows must use installed indicators for ${prop}`);
  });
  const checked = vi.fn(), switched = vi.fn();
  const mounted = render(<StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}>
    <LabeledStyleCheckboxItem label="Checkbox row" styleName="opacity" value={false} onChange={checked} />
    <div data-native-switch="overflow"><LabeledStyleSwitchItem label="Switch row" styleName="overflow" value={false} onChange={switched} /></div>
    <div data-native-toggle="flow"><LabeledToggleButtonGroup label="Flow row" styleName="flex-direction"><StyleToggleButton value="row" label="Row" showLabel /><StyleToggleButton value="column" label="Column" showLabel /></LabeledToggleButtonGroup></div>
  </StyleTargetContext.Provider></StudioCtxContext.Provider>);
  try {
    const buttons = within(ensure(mounted.container.querySelector<HTMLElement>('[data-native-toggle="flow"]'), "Real toggle group")).getAllByRole("button", { name: /^(Row|Column)$/ });
    expect(indicators).not.toHaveBeenCalled();
    const switchRow = ensure(mounted.container.querySelector<HTMLElement>('[data-native-switch="overflow"]'), "Actual switch row");
    const switchIndicator = () => [...switchRow.querySelectorAll("div")].find((element) => element.classList.contains(indicatorStyles.DefinedIndicator));
    expect(switchIndicator()).toBeUndefined();
    expect(buttons).toHaveLength(2); expect(buttons[0]?.classList.contains(toggleStyles.rootvalueSetState_isSet)).toBe(true);
    await act(async () => { await studio.changeUnsafe(() => { exp.set("flex-direction", "column"); exp.set("opacity", "0.5"); exp.set("overflow", "hidden"); }); });
    expect(ensure(switchIndicator(), "Native switch indicator").classList.contains(indicatorStyles["DefinedIndicator--set"])).toBe(true);
    expect(indicators).not.toHaveBeenCalled();
    expect(buttons[1]?.classList.contains(toggleStyles.rootvalueSetState_isSet)).toBe(true); expect(buttons[0]?.classList.contains(toggleStyles.rootvalueSetState_isSet)).toBe(false);
    await act(async () => { fireEvent.click(ensure(buttons[0], "Original row command")); }); await waitFor(() => expect(exp.get("flex-direction")).toBe("row"));
    fireEvent.click(screen.getByRole("checkbox")); expect(checked).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("switch")); expect(switched).toHaveBeenCalledWith(true);
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
