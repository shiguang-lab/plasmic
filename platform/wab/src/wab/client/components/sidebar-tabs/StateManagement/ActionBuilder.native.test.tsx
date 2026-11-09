import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ActionBuilder from "@/wab/client/components/sidebar-tabs/StateManagement/ActionBuilder";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { mkInteraction, initBuiltinActions } from "@/wab/shared/core/states";
import { ensureBaseVariantSetting } from "@/wab/shared/Variants";
import { EventHandler, FunctionExpr, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const chrome = vi.hoisted(() => ({ edit: undefined as { onChange: (event: { target: { value: string } }) => void; onBlur: () => void } | undefined }));
vi.mock("@/wab/client/plasmic/plasmic_kit_state_management/PlasmicActionBuilder", () => ({ PlasmicActionBuilder: (props: { actionName: string; editActionName: typeof chrome.edit }) => { chrome.edit = props.editActionName; return <output>{props.actionName}</output>; } }));
it("refreshes the actual action model and blocks an edit callback retained after its view retires", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined); vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), component = new TplMgr({ site }).addComponent({ name: "Actions", type: ComponentType.Plain }), tpl = ensureKnownTplTag(component.tplTree);
  const handler = new EventHandler({ interactions: [] }), interaction = mkInteraction(handler, "customFunction", "First action", { customFunction: new FunctionExpr({ argNames: [], bodyExpr: codeLit("first") }) }); handler.interactions.push(interaction); ensureBaseVariantSetting(tpl).attrs.onClick = handler;
  const frame = mkArenaFrame({ site, component, name: "Actions", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Actions", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Actions" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  initBuiltinActions({ projectId: studio.siteInfo.id, platform: "react", projectFlags: studio.projectFlags(), inStudio: true });
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Action view");
  const mounted = render(<AppCtxContext.Provider value={studio.appCtx}><StudioCtxContext.Provider value={studio}><ActionBuilder sc={studio} vc={view} component={component} tpl={tpl} interaction={interaction} eventHandlerExpr={handler} eventHandlerKey={{ attr: "onClick" }} onCollapseClick={vi.fn()} menu={null} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByText("First action")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { interaction.interactionName = "Updated action"; }); });
    expect(screen.getByText("Updated action")).toBeTruthy();
    act(() => { ensure(chrome.edit, "Action editor").onChange({ target: { value: "Retired edit" } }); });
    const retained = ensure(chrome.edit, "Retained editor").onBlur;
    act(() => studio.disposeViewCtx(view)); expect(mounted.container.textContent).toBe("");
    await act(async () => { retained(); }); expect(interaction.interactionName).toBe("Updated action");
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); vi.restoreAllMocks(); }
});
