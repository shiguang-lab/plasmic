import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { MergedSlotsTextSection } from "@/wab/client/components/sidebar-tabs/MergedSlotsSection";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { ensure } from "@/wab/shared/common";
import { addSlotParam, ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkSlot, mkTplComponent, mkTplInlinedText, mkTplTagX } from "@/wab/shared/core/tpls";
import { RenderExpr, ensureKnownRenderExpr } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/TypographySection", () => ({
  TextOnlySection: ({ title, expsProvider }: { title: string; expsProvider: TplExpsProvider }) => <output data-testid="merged-text">{title}:{expsProvider.tpl.uuid}</output>,
  TypographySection: () => null,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates real merged-slot eligibility, labels and argument shape without a revision fallback", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const child = manager.addComponent({ name: "Content container", type: ComponentType.Plain });
  const slot = addSlotParam(site, child, "content"); slot.mergeWithParent = true;
  $$$(child.tplTree).append(mkSlot(slot));
  const owner = manager.addComponent({ name: "Merged slots", type: ComponentType.Plain }), base = owner.variants[0];
  const text = mkTplInlinedText("Text content", [base]), expression = new RenderExpr({ tpl: [text] });
  const instance = mkTplComponent(child, base, { content: expression }); $$$(owner.tplTree).append(instance);
  const frame = mkArenaFrame({ site, component: owner, name: "Merged slots", width: 400, height: 200 });
  site.arenas.push(mkMixedArena("Merged slots", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Merged%20slots" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Merged slots view"); studio.setStudioFocusOnViewCtxContent(view);
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><MergedSlotsTextSection viewCtx={view} tpl={instance} tab="settings" /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    expect(screen.getByTestId("merged-text").textContent).toContain("Content");
    expect(screen.getByTestId("merged-text").textContent).toContain(text.uuid);
    const argument = ensure(instance.vsettings[0].args.find((arg) => arg.param === slot), "Original slot argument");
    expect(argument.expr).toBe(expression);
    await act(async () => { await studio.changeUnsafe(() => { slot.variable.name = "description"; }); });
    expect(screen.getByTestId("merged-text").textContent).toContain("Description");
    const plain = mkTplTagX("div", { baseVariant: base });
    await act(async () => { await studio.changeUnsafe(() => { $$$(text).replaceWith(plain); }); });
    expect(screen.queryByTestId("merged-text")).toBeNull();
    let restored: RenderExpr | undefined;
    await act(async () => { await studio.changeUnsafe(() => { $$$(plain).replaceWith(text); restored = ensureKnownRenderExpr(argument.expr); }); });
    expect(screen.getByTestId("merged-text").textContent).toContain(text.uuid);
    expect(ensure(instance.vsettings[0].args.find((arg) => arg.param === slot), "Canonical slot argument")).toBe(argument);
    expect(argument.expr).toBe(restored);
    expect(restored).not.toBe(expression);
    expect(ensure(restored, "Replacement command RenderExpr").tpl[0]).toBe(text);
    await act(async () => { await studio.changeUnsafe(() => { slot.mergeWithParent = false; }); });
    expect(screen.queryByTestId("merged-text")).toBeNull();
    await act(async () => { await studio.changeUnsafe(() => { slot.mergeWithParent = true; }); });
    expect(screen.getByTestId("merged-text")).toBeTruthy();
    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByTestId("merged-text")).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
