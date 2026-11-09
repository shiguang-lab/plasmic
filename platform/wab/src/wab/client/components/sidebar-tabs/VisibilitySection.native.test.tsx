import { AppContext } from "@/wab/client/components/top-view";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { VisibilitySection } from "@/wab/client/components/sidebar-tabs/VisibilitySection";
import { CustomCode, ensureKnownCustomCode } from "@/wab/shared/model/classes";
import { codeLit } from "@/wab/shared/core/exprs";
import { StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/app-auth/app-auth-contexts", () => ({ useAppRoles: () => ({ roles: [] }) }));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor", () => ({ DataPickerEditor: ({ value }: { value: unknown }) => <output data-testid="visibility-expression">{JSON.stringify(value)}</output> }));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/BoolPropEditor", () => ({ BoolPropEditor: ({ value, onChange }: { value?: boolean; onChange: (value: boolean) => void }) => <input aria-label="Condition fallback" type="checkbox" checked={!!value} onChange={(event) => onChange(event.target.checked)} /> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates native visibility conditions and nested fallbacks while opacity edits keep their original model target", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Visibility controls", type: ComponentType.Plain });
  const root = component.tplTree, setting = root.vsettings[0]; new RuleSetHelpers(setting.rs, "div").set("opacity", "0.5");
  const frame = mkArenaFrame({ site, component, name: "Visibility controls", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Visibility controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Visibility%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Visibility view");
  studio.observeComponents([component]);
  await studio.changeUnsafe(() => { studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root); });
  await waitFor(() => expect(studio.isSelectionPending).toBe(false));
  const provider = new TplExpsProvider(view, root), styling = new StyleTarget({ expsProvider: provider });
  const mounted = render(<AppCtxContext.Provider value={appCtx}><AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><VisibilitySection viewCtx={view} tpl={root} expsProvider={provider} /></StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider></AppCtxContext.Provider>);
  try {
    expect(provider.canEdit()).toBe(true);
    expect(ensure(document.querySelector<HTMLInputElement>('input[data-plasmic-prop="opacity"]'), "Opacity input")).toHaveProperty("value", "50%");
    fireEvent.click(ensure(document.querySelector<HTMLInputElement>('input[data-plasmic-prop="opacity"]'), "Opacity input"));
    await act(async () => { fireEvent.click(await screen.findByRole("option", { name: "100%" })); });
    await waitFor(() => expect(setting.rs.values.opacity).toBe("1")); expect(provider.targetRs()).toBe(setting.rs);
    expect(screen.queryByTestId("visibility-expression")).toBeNull();
    const condition = new CustomCode({ code: "($state.visible)", fallback: codeLit(true) });
    await act(async () => { await studio.changeUnsafe(() => { setting.dataCond = condition; }); });
    expect(screen.getByTestId("visibility-expression").textContent).toContain("visible"); expect(screen.getByRole("checkbox", { name: "Condition fallback" })).toHaveProperty("checked", true);
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownCustomCode(condition.fallback).code = "false"; condition.code = "($state.expanded)"; }); });
    expect(screen.getByTestId("visibility-expression").textContent).toContain("expanded"); expect(screen.getByRole("checkbox", { name: "Condition fallback" })).toHaveProperty("checked", false);
    expect(setting.dataCond).toBe(condition);
    await act(async () => { await studio.changeUnsafe(() => { setting.dataCond = null; }); });
    expect(screen.queryByTestId("visibility-expression")).toBeNull();
    act(() => studio.disposeViewCtx(view)); expect(document.querySelector('input[data-plasmic-prop="opacity"]')).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
