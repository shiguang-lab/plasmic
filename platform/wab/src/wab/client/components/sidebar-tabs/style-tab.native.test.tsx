import { useElementPropValue } from "@/wab/client/components/sidebar-tabs/ComponentProps/element-prop-inputs";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { StyleTab } from "@/wab/client/components/sidebar-tabs/style-tab";
import { TplTag, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/Sections", async (original) => {
  const actual = await original<typeof import("@/wab/client/components/sidebar-tabs/Sections")>();
  return { ...actual, getOrderedSectionRender: (_tpl: unknown, _view: unknown, options: Map<string, boolean>) => [() => <output key="sections" data-testid="native-style-sections">{JSON.stringify([...options])}</output>] };
});
vi.mock("@/wab/client/components/sidebar-tabs/ComponentPropsSection", async (original) => {
  const actual = await original<typeof import("@/wab/client/components/sidebar-tabs/ComponentPropsSection")>();
  return { ...actual, TplTagNameSection: function NativeTagHeading({ tpl, viewCtx, applyMenu }: { tpl: TplTag; viewCtx: ViewCtx; applyMenu: React.ReactElement | null }) {
    const select = React.useCallback(() => tpl.tag, [tpl]);
    const tag = useElementPropValue(viewCtx, tpl, select);
    return <output data-testid="native-tag-heading">{tag}:{applyMenu ? "apply" : "none"}</output>;
  } };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("refreshes Apply-menu tag inputs and replaces MobX visibility reactions with exact native style inputs", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }), component = manager.addComponent({ name: "Native style tab", type: ComponentType.Plain });
  const root = ensureKnownTplTag(component.tplTree), mixin = manager.addMixin("Native styles");
  const frame = mkArenaFrame({ site, component, name: "Native style tab", width: 400, height: 200 }); site.arenas.push(mkMixedArena("Native style tab", [frame]));
  const { studioCtx: studio, appCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Native%20style%20tab" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Style-tab view"); studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const mounted = render(<AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><StyleTab studioCtx={studio} viewCtx={view} /></StudioCtxContext.Provider></AppCtxContext.Provider>);
  try {
    await waitFor(() => expect(screen.getByTestId("native-tag-heading").textContent).toContain("div:apply"));
    await act(async () => { await studio.changeUnsafe(() => { root.tag = "button"; }); });
    expect(screen.getByTestId("native-tag-heading").textContent).toContain("button:apply");
    const { Section } = await import("@/wab/client/components/sidebar-tabs/Sections");
    const settings = () => new Map<string, boolean>(JSON.parse(ensure(screen.getByTestId("native-style-sections").textContent, "Section settings")));
    expect(settings().get(Section.Mixins)).toBe(false);
    await act(async () => { await studio.changeUnsafe(() => { view.variantTplMgr().applyMixin(root, mixin, view.variantTplMgr().getTargetVariantComboForNode(root)); }); });
    await waitFor(() => expect(settings().get(Section.Mixins)).toBe(true)); expect(root.vsettings[0].rs.mixins[0]).toBe(mixin);
    await act(async () => { await studio.changeUnsafe(() => { studio.tplMgr().createPrivateStyleVariant(component, root, [":hover"]); }); });
    await waitFor(() => expect(settings().get(Section.PrivateStyleVariants)).toBe(true));
    act(() => studio.disposeViewCtx(view)); expect(screen.queryByTestId("native-tag-heading")).toBeNull();
  } finally { mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
