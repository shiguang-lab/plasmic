import { AppContext } from "@/wab/client/components/top-view";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ContentLayoutContainerControls } from "@/wab/client/components/sidebar-tabs/ContentLayoutControls";
import { AlignItemsControls } from "@/wab/client/components/style-controls/align-items-controls";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import toggleStyles from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleToggleButton.module.css";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear();
});
async function setup(values: Record<string, string>) {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Layout controls", type: ComponentType.Plain });
  const rs = ensureBaseVariantSetting(component.tplTree).rs;
  (() => Object.assign(rs.values, values))();
  const { studioCtx: studio } = fakeStudioCtx({ site });
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component]);
  studio.createViewStateUndoRecord();
  const exp = RSH(rs, component.tplTree);
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const styling = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}>{children}</StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider>;
  return { studio, rs, provider, wrap };
}

it("keeps actual alignment edits and undo in the existing child style control while primitive props change", async () => {
  const { studio, rs, provider, wrap } = await setup({ "align-items": "center" });
  const view = render(wrap(<AlignItemsControls expsProvider={provider} prop="align-items" dir="row" includeAuto={false} isFlex label="Align" />));
  const initialOptions = screen.getAllByRole("button", { name: "" });
  expect(initialOptions).toHaveLength(5);
  const end = ensure(initialOptions[2], "Alignment end option");
  fireEvent.click(end);
  await act(async () => { await studio.awaitEval(); });
  expect(rs.values["align-items"]).toBe("flex-end");
  expect(end.classList.contains(toggleStyles.rootvalueSetState_isSet)).toBe(true);
  expect(studio.canUndo()).toBe(true);
  await act(async () => { await studio.undo(); });
  expect(rs.values["align-items"]).toBe("center");
  expect(ensure(initialOptions[1], "Alignment center option").classList.contains(toggleStyles.rootvalueSetState_isSet)).toBe(true);
  view.rerender(wrap(<AlignItemsControls expsProvider={provider} prop="justify-self" dir="column" includeAuto isFlex={false} label="Justify" />));
  const nextOptions = screen.getAllByRole("button", { name: "" });
  expect(nextOptions).toHaveLength(6);
  const auto = ensure(nextOptions[0], "Alignment auto option");
  fireEvent.click(auto);
  await waitFor(() => expect(rs.values["justify-self"]).toBe("auto"));
  expect(rs.values["align-items"]).toBe("center");
});

it("keeps the content-layout grid controls on their original CSS properties and command owner", async () => {
  const { rs, provider, wrap } = await setup({ "justify-items": "flex-start", "align-content": "flex-start", "grid-row-gap": "16px" });
  render(wrap(<ContentLayoutContainerControls expsProvider={provider} />));
  expect(screen.getByText("Gap")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Distribute horizontally" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Center" }));
  await waitFor(() => expect(rs.values["justify-items"]).toBe("center"));
  expect(rs.values["align-content"]).toBe("flex-start");
  expect(rs.values["grid-row-gap"]).toBe("16px");
  expect(screen.getByRole("button", { name: "Distribute vertically" })).toBeTruthy();
});
