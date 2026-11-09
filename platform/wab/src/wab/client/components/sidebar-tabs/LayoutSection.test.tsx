import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { LayoutSection } from "@/wab/client/components/sidebar-tabs/LayoutSection";
import { createStyleTarget, SingleRsExpsProvider, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/FlexContainerControls", () => ({ FlexContainerControls: () => <span>Flex controls</span> }));
vi.mock("@/wab/client/components/sidebar-tabs/GridControls", () => ({ GridControls: () => <span>Grid controls</span> }));
vi.mock("@/wab/client/components/sidebar-tabs/ContentLayoutControls", () => ({ ContentLayoutContainerControls: () => <span>Document controls</span> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("switches the native layout classification and keeps the original conversion controls", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Layout", type: ComponentType.Plain });
  const tpl = ensureKnownTplTag(component.tplTree);
  const rs = ensureBaseVariantSetting(tpl).rs;
  const rsh = RSH(rs, tpl);
  rsh.set("display", "flex"); rsh.set("flex-direction", "row");
  const { studioCtx: studio } = fakeStudioCtx({ site });
  try {
    await waitFor(() => expect(studio.initialRouteReady).toBe(true));
    studio.observeComponents([component]);
    const provider = new SingleRsExpsProvider(rs, rsh, studio, [], { kind: "ruleSet", rs, forTag: "div" });
    const sc = createStyleTarget({ expsProvider: provider });
    const mounted = render(<StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={sc}>
      <LayoutSection expsProvider={provider} allowConvert isCodeComponentTpl />
    </StyleTargetContext.Provider></StudioCtxContext.Provider>);
    const horizontal = () => ensure(mounted.container.querySelector<HTMLButtonElement>('[data-test-id="layout-hstack"]'), "Horizontal layout control");
    const selectedClass = horizontal().className;
    expect(screen.getByText("Flex controls")).toBeInTheDocument();
    await act(async () => { await studio.changeUnsafe(() => rsh.set("flex-direction", "column")); });
    expect(horizontal().className).not.toBe(selectedClass);
    await act(async () => { await studio.changeUnsafe(() => rsh.set("display", "grid")); });
    expect(screen.getByText("Grid controls")).toBeInTheDocument();
    expect(screen.queryByText("Flex controls")).toBeNull();
    await act(async () => { fireEvent.click(horizontal()); });
    await waitFor(() => expect(rsh.get("display")).toBe("flex"));
    expect(rsh.get("flex-direction")).toBe("row");
    expect(screen.getByText("Flex controls")).toBeInTheDocument();
    await act(async () => { await studio.changeUnsafe(() => rsh.clear("display")); });
    expect(screen.queryByText("Flex controls")).toBeNull();
    mounted.unmount();
  } finally {
    cleanup(); await studio.awaitEval(); studio.dispose();
  }
});
