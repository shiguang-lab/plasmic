import { AppContext } from "@/wab/client/components/top-view";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ImageSection } from "@/wab/client/components/sidebar-tabs/image-section";
import { codeLit, tryExtractString } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { VarRef, ensureKnownTplTag, ensureKnownCustomCode } from "@/wab/shared/model/classes";
import { StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { TplTagType } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/style-controls/ImageSelector", () => ({ ImageAssetPreviewAndPicker: ({ value, onPicked }: { value?: unknown; onPicked: (value: string) => void }) => <input aria-label="Image source" value={typeof value === "string" ? value : ""} onChange={(event) => onPicked(event.target.value)} /> }));
vi.mock("@/wab/client/components/sidebar-tabs/image-content-section", () => ({ ContentPanelSection: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates image expressions and linked defaults while retaining their original command objects", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Image controls", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), setting = root.vsettings[0], src = codeLit("https://example.test/original.png");
  root.tag = "img"; root.type = TplTagType.Image; setting.attrs.src = src;
  const param = mkParam({ name: "photo", type: typeFactory.img(), paramType: "prop" }); param.defaultExpr = codeLit("https://example.test/default.png"); component.params.push(param);
  const frame = mkArenaFrame({ site, component, name: "Image controls", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Image controls", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Image%20controls" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Image view"); studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = new TplExpsProvider(view, root), styling = new StyleTarget({ expsProvider: provider });
  const mounted = render(<AppCtxContext.Provider value={appCtx}><AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><ImageSection expsProvider={provider} /></StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByRole("textbox", { name: "Image source" })).toHaveProperty("value", "https://example.test/original.png");
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownCustomCode(src).code = JSON.stringify("https://example.test/changed.png"); }); });
    expect(screen.getByRole("textbox", { name: "Image source" })).toHaveProperty("value", "https://example.test/changed.png"); expect(setting.attrs.src).toBe(src);
    await act(async () => { fireEvent.change(screen.getByRole("textbox", { name: "Image source" }), { target: { value: "https://example.test/edited.png" } }); });
    await waitFor(() => expect(tryExtractString(setting.attrs.src)).toBe("https://example.test/edited.png")); expect(provider.targetRs()).toBe(setting.rs);
    const reference = new VarRef({ variable: param.variable });
    await act(async () => { await studio.changeUnsafe(() => { setting.attrs.src = reference; }); });
    expect(screen.getByRole("textbox", { name: "Image source" })).toHaveProperty("value", "https://example.test/default.png");
    await act(async () => { await studio.changeUnsafe(() => { ensureKnownCustomCode(param.defaultExpr).code = JSON.stringify("https://example.test/new-default.png"); }); });
    expect(screen.getByRole("textbox", { name: "Image source" })).toHaveProperty("value", "https://example.test/new-default.png");
    await act(async () => { fireEvent.change(screen.getByRole("textbox", { name: "Image source" }), { target: { value: "https://example.test/default-edit.png" } }); });
    await waitFor(() => expect(tryExtractString(ensure(param.defaultExpr, "Canonical image parameter default"))).toBe("https://example.test/default-edit.png")); expect(setting.attrs.src).toBe(reference); expect(component.params).toContain(param);
    act(() => studio.disposeViewCtx(view)); expect(screen.queryByRole("textbox", { name: "Image source" })).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
