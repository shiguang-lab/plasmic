import { AppContext } from "@/wab/client/components/top-view";
import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ContentPanelSection } from "@/wab/client/components/sidebar-tabs/image-content-section";
import { StyleTarget, StyleTargetContext, TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { TplMgr } from "@/wab/shared/TplMgr";
import { tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX, TplTagType } from "@/wab/shared/core/tpls";
import { applyDevFlagOverrides, DEVFLAGS } from "@/wab/shared/devflags";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site }); site.flags.usePlasmicImg = false;
  const root = mkTplTagX("img", { type: TplTagType.Image });
  const component = manager.addComponent({ name: "Image content", type: ComponentType.Plain, rootTpl: root });
  const base = ensure(tryGetBaseVariantSetting(root), "Image base setting"), exp = new RuleSetHelpers(base.rs, "img");
  exp.set("object-position", "10% 20%");
  const frame = mkArenaFrame({ site, component, name: "Image content", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Image content", [frame]));
  const fixture = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Image%20content" });
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  const studio = fixture.studioCtx, view = ensure(studio.tryGetViewCtxForFrame(frame), "Image content view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(root);
  const provider = new TplExpsProvider(view, root), styling = new StyleTarget({ expsProvider: provider });
  const wrap = (children: React.ReactNode) => <AppCtxContext.Provider value={fixture.appCtx}><AppContext.Provider value={studio.app}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}>{children}</StyleTargetContext.Provider></StudioCtxContext.Provider></AppContext.Provider></AppCtxContext.Provider>;
  const panel = () => wrap(<ContentPanelSection expsProvider={provider} />);
  return { ...fixture, studio, site, root, exp, view, provider, wrap, panel };
}

it("uses installed project flags and current default policy while preserving actual position edit commands", async () => {
  const saved = DEVFLAGS.usePlasmicImg, f = await setup(), mounted = render(f.panel());
  try {
    expect(screen.queryByText("Quality")).toBeNull();
    await act(async () => { await f.studio.changeUnsafe(() => { f.site.flags.usePlasmicImg = true; }); });
    expect(screen.getByText("Quality")).toBeTruthy(); expect(screen.getByText("Format")).toBeTruthy();
    const x = screen.getByDisplayValue("10%"); fireEvent.change(x, { target: { value: "42%" } }); fireEvent.keyDown(x, { key: "Enter" });
    await waitFor(() => expect(f.exp.getRaw("object-position")).toBe("42% 20%"));
    await act(async () => { await f.studio.changeUnsafe(() => { f.exp.set("object-position", "42% 81%"); f.site.flags.usePlasmicImg = false; }); });
    expect(screen.getByDisplayValue("81%")).toBeTruthy(); expect(screen.queryByText("Quality")).toBeNull();
    const editedX = screen.getByDisplayValue("42%"); fireEvent.change(editedX, { target: { value: "53%" } }); fireEvent.keyDown(editedX, { key: "Enter" });
    await waitFor(() => expect(f.exp.getRaw("object-position")).toBe("53% 81%"));
    // This is the same apply + existing AppCtx input event used by reloadAll.
    await act(async () => { applyDevFlagOverrides({ ...DEVFLAGS, usePlasmicImg: true }); f.appCtx.publishUiEnvironmentInputs(); });
    expect(screen.queryByText("Quality")).toBeNull();
    await act(async () => { await f.studio.changeUnsafe(() => { delete f.site.flags.usePlasmicImg; }); });
    expect(screen.getByText("Quality")).toBeTruthy();
    await act(async () => { applyDevFlagOverrides({ ...DEVFLAGS, usePlasmicImg: false }); f.appCtx.publishUiEnvironmentInputs(); });
    expect(screen.queryByText("Quality")).toBeNull();
  } finally { mounted.unmount(); applyDevFlagOverrides({ ...DEVFLAGS, usePlasmicImg: saved }); await f.studio.awaitEval(); f.studio.dispose(); }
});

it("keeps flags unsubscribed for an abandoned render and closes the captured field/default leases before a real model world replacement", async () => {
  const f = await setup(), flags = f.studio.modelSnapshots.field(f.site, "flags"), original = flags.subscribe;
  let leases = 0;
  vi.spyOn(flags, "subscribe").mockImplementation((listener) => { leases++; const stop = original(listener); let stopped = false; return () => { if (!stopped) { stopped = true; leases--; stop(); } }; });
  const pending = new Promise<void>(() => undefined);
  function Suspend(): React.ReactNode { throw pending; }
  const abandoned = render(f.wrap(<React.Suspense fallback={<span>Pending image content</span>}><ContentPanelSection expsProvider={f.provider} /><Suspend /></React.Suspense>));
  expect(leases).toBe(0); abandoned.unmount();
  const mounted = render(f.panel()); expect(leases).toBe(1);
  try {
    const release = mock<PkgVersionInfoMeta>({ id: "image-content-world", pkgId: "image-content-pkg", version: "1.0.0", branchId: null });
    f.api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: f.studio.bundleSite().site }, depPkgs: [], etag: "image-content-etag" });
    await act(async () => { await f.studio["loadVersion"](release, true); });
    expect(leases).toBe(0);
    const fields = vi.spyOn(f.studio.modelSnapshots, "declaredField"); mounted.rerender(f.panel());
    expect(fields.mock.calls.some(([model]) => model === f.root || model === f.site)).toBe(false);
    expect(screen.getByDisplayValue("10%")).toBeTruthy();
    await act(async () => { f.appCtx.publishUiEnvironmentInputs(); }); expect(leases).toBe(0);
  } finally { mounted.unmount(); await f.studio.awaitEval(); f.studio.dispose(); }
});
