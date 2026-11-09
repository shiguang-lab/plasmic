import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentLink, renderLintIssue } from "@/wab/client/linting/lint-issue-row";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkVariantSetting } from "@/wab/shared/Variants";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import type { NonCssScreenVariantOverrideLintIssue } from "@/wab/shared/linting/lint-types";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);
it("publishes issue captions and original command targets from admitted fields, then retires old rows", async () => {
  const site = createSite(), manager = new TplMgr({site});
  const component = manager.addComponent({name: "Original component", type: ComponentType.Plain});
  const tpl = ensureKnownTplTag(component.tplTree); tpl.name = "Original element";
  const group = manager.createGlobalVariantGroup("Responsive"), variant = manager.createGlobalVariant(group, "Mobile");
  const vs = mkVariantSetting({variants: [variant]}); tpl.vsettings.push(vs);
  const issue: NonCssScreenVariantOverrideLintIssue = {key: "responsive", type: "non-css-screen-variant-override", component, tpl, vs, prop: {type: "attr", attr: "title"}};
  const {studioCtx: studio} = fakeStudioCtx({site});
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.dbCtx().maybeObserveComponents([component]);
  const focus = vi.spyOn(studio, "setStudioFocusOnTpl").mockResolvedValue(undefined);
  const mounted = render(<StudioCtxContext.Provider value={studio}><ComponentLink component={component} />{renderLintIssue(issue)}</StudioCtxContext.Provider>);
  try {
    expect(screen.getByText("Original element")).toBeTruthy();
    await act(async () => {await studio.changeUnsafe(() => {component.name = "Renamed component"; tpl.name = "Renamed element"; variant.name = "Narrow";});});
    expect(screen.getByText("Component Renamed component")).toBeTruthy();
    expect(screen.getByText("Narrow")).toBeTruthy();
    await act(async () => {fireEvent.click(screen.getByText("Renamed element"));});
    expect(focus).toHaveBeenCalledWith(component, tpl);
    act(() => studio.arenaState.reset());
    expect(screen.queryByText("Renamed element")).toBeNull();
    expect(screen.queryByText("Component Renamed component")).toBeNull();
  } finally {mounted.unmount(); studio.dispose();}
});
