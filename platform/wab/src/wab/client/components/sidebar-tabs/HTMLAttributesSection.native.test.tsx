import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { HTMLAttributesSection } from "@/wab/client/components/sidebar-tabs/HTMLAttributesSection";
import { Expr, ensureKnownTplTag, ensureKnownCustomCode, isKnownCustomCode } from "@/wab/shared/model/classes";
import { codeLit, tryExtractString } from "@/wab/shared/core/exprs";
import { StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({
  inferPropTypeFromAttr: () => "string",
  PropEditorRow: ({ attr, expr, onChange }: { attr: string; expr?: Expr; onChange: (expr: Expr) => void }) =>
    <input aria-label={attr} value={expr && isKnownCustomCode(expr) ? String(JSON.parse(expr.code)) : ""} onChange={(event) => onChange(codeLit(event.target.value))} />,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("refreshes nested HTML expressions and writes through the original variant setting", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "HTML controls", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), setting = root.vsettings[0], title = codeLit("Original title"); setting.attrs.title = title;
  const frame = mkArenaFrame({ site, component, name: "HTML controls", width: 400, height: 200 }); site.arenas.push(mkMixedArena("HTML controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=HTML%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "HTML view"); studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = new TplExpsProvider(view, root), styling = new StyleTarget({ expsProvider: provider });
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><HTMLAttributesSection viewCtx={view} tpl={root} component={component} expsProvider={provider} /></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByRole("textbox", { name: "title" })).toHaveProperty("value", "Original title");
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownCustomCode(title).code = JSON.stringify("Updated title"); }); });
    expect(screen.getByRole("textbox", { name: "title" })).toHaveProperty("value", "Updated title"); expect(setting.attrs.title).toBe(title);
    await act(async () => { fireEvent.change(screen.getByRole("textbox", { name: "title" }), { target: { value: "Edited title" } }); });
    await waitFor(() => expect(tryExtractString(setting.attrs.title)).toBe("Edited title")); expect(provider.targetRs()).toBe(setting.rs);
    await act(async () => { await studio.changeUnsafe(() => { root.tag = "img"; }); });
    expect(screen.queryByRole("textbox", { name: "title" })).toBeTruthy();
    act(() => studio.disposeViewCtx(view)); expect(screen.queryByRole("textbox", { name: "title" })).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
