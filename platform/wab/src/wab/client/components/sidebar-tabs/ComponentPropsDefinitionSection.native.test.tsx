import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ComponentPropsDefinitionSection } from "@/wab/client/components/sidebar-tabs/ComponentPropsDefinitionSection";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { mkModelUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("refreshes prop rows and membership on completed model edits", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Definition owner" });
  const param = mkParam({ name: "OriginalProp", type: typeFactory.text(), paramType: "prop" }); component.params.push(param);
  const frame = mkArenaFrame({ site, component, name: "Definitions", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Definitions", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Definitions" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true)); const view = ensure(studio.tryGetViewCtxForFrame(frame), "Definition view");
  const mounted = render(<StudioCtxContext.Provider value={studio}><ComponentPropsDefinitionSection studioCtx={studio} component={component} viewCtx={view} /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByText("OriginalProp")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { param.variable.name = "UpdatedProp"; }); });
    expect(screen.getByText("UpdatedProp")).toBeTruthy(); expect(screen.queryByText("OriginalProp")).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => { component.params = []; }); });
    expect(screen.queryByText("UpdatedProp")).toBeNull();
  } finally { mounted.unmount(); studio.dispose(); }
});

it("expands a requested prop through the current view after the previous view is disposed", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Shared component" });
  const param = mkParam({ name: "TargetProp", displayName: "Folder/TargetProp", type: typeFactory.text(), paramType: "prop" });
  component.params.push(param);
  const firstFrame = mkArenaFrame({ site, component, name: "First", width: 400, height: 300 });
  const secondFrame = mkArenaFrame({ site, component, name: "Second", width: 400, height: 300 });
  site.arenas.push(mkMixedArena("Views", [firstFrame, secondFrame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Views" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const first = ensure(studio.tryGetViewCtxForFrame(firstFrame), "First view");
  const second = ensure(studio.tryGetViewCtxForFrame(secondFrame), "Second view");
  const content = (viewCtx: ViewCtx) => <StudioCtxContext.Provider value={studio}><ComponentPropsDefinitionSection studioCtx={studio} component={component} viewCtx={viewCtx} /></StudioCtxContext.Provider>;
  const mounted = render(content(first));
  try {
    expect(screen.queryByText("TargetProp")).toBeNull();
    mounted.rerender(content(second));
    await act(async () => { studio.disposeViewCtx(first); await studio.awaitEval(); });
    await act(async () => { studio.uiActionBus.dispatch(mkModelUiId(param), "jump"); });
    expect(await screen.findByText("TargetProp")).toBeTruthy();
  } finally { mounted.unmount(); studio.dispose(); }
});
