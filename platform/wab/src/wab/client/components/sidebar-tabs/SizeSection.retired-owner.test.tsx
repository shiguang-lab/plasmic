import { AppContext } from "@/wab/client/components/top-view";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock } from "vitest-mock-extended";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { SizeSection } from "@/wab/client/components/sidebar-tabs/SizeSection";
import { SingleRsExpsProvider, StyleTarget, StyleTargetContext } from "@/wab/client/components/style-controls/StyleComponent";
import type { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { RuleSetHelpers } from "@/wab/shared/RuleSetHelpers";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const captured = vi.hoisted(() => ({ callbacks: new Map<string, NonNullable<React.ComponentProps<typeof DimTokenSpinner>["onChange"]>>() }));
vi.mock("@/wab/client/components/widgets/DimTokenSelector", () => ({
  DimTokenSpinner: (props: React.ComponentProps<typeof DimTokenSpinner>) => {
    const key = props["data-plasmic-prop"];
    if (key && props.onChange) { captured.callbacks.set(key, props.onChange); }
    return <input aria-label={key} value={props.value ?? ""} disabled={props.disabled} readOnly />;
  },
}));
afterEach(() => { cleanup(); captured.callbacks.clear(); vi.restoreAllMocks(); });

it("keeps actual standalone Size values while rejecting queued and retained edits after its owner closes", async () => {
  const site = createSite(), rs = ensure(site.activeTheme, "Actual theme").defaultStyle.rs;
  const exp = new RuleSetHelpers(rs, "div"); exp.set("width", "120px"); exp.set("min-width", "40px");
  const { studioCtx: studio, appCtx, api } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const provider = new SingleRsExpsProvider(rs, exp, studio, [], { kind: "ruleSet", rs, forTag: "div" });
  const styling = new StyleTarget({ expsProvider: provider });
  const contents = (vsh = new VariantedStylesHelper()) => <AppContext.Provider value={studio.app}><AppCtxContext.Provider value={appCtx}><StudioCtxContext.Provider value={studio}><StyleTargetContext.Provider value={styling}><SizeSection expsProvider={provider} vsh={vsh} /></StyleTargetContext.Provider></StudioCtxContext.Provider></AppCtxContext.Provider></AppContext.Provider>;
  const mounted = render(contents());
  const minimum = ensure(captured.callbacks.get("min-width"), "Real generic dimension edit");
  const width = ensure(captured.callbacks.get("width"), "Real SizeControl edit");
  const pending: (() => void)[] = [];
  const enqueue = vi.spyOn(studio, "changeSpawn").mockImplementation((command) => { pending.push(command); });
  try {
    expect(screen.getByRole("textbox", { name: "width" })).toHaveProperty("value", "120px");
    act(() => { minimum("80px", "raw"); }); expect(pending).toHaveLength(1);
    const queued = ensure(pending.shift(), "Command accepted before owner retirement");
    enqueue.mockRestore();
    const release = mock<PkgVersionInfoMeta>({ id: "size-retired-owner", pkgId: "size-retired-pkg", version: "1.0.0", branchId: null });
    api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: studio.bundleSite().site }, depPkgs: [], etag: "size-retired-etag" });
    await act(async () => { await studio["loadVersion"](release, true); });
    expect(screen.getByRole("textbox", { name: "width" })).toHaveProperty("disabled", true);
    const fields = vi.spyOn(studio.modelSnapshots, "declaredField");
    mounted.rerender(contents());
    expect(screen.getByRole("textbox", { name: "width" })).toHaveProperty("value", "120px");
    expect(screen.getByRole("textbox", { name: "min-width" })).toHaveProperty("value", "40px");
    expect(fields).not.toHaveBeenCalled();
    act(() => { queued(); });
    expect(exp.getRaw("min-width")).toBe("40px");
    const unsafe = vi.spyOn(studio, "changeUnsafe"), enqueueRetired = vi.spyOn(studio, "changeSpawn");
    act(() => { minimum("90px", "raw"); width("240px", "raw"); });
    expect(pending).toHaveLength(0); expect(unsafe).not.toHaveBeenCalled(); expect(enqueueRetired).not.toHaveBeenCalled(); expect(fields).not.toHaveBeenCalled();
    expect(exp.getRaw("min-width")).toBe("40px"); expect(exp.getRaw("width")).toBe("120px");
    expect(provider.targetRs()).toBe(rs);
  } finally { enqueue.mockRestore(); mounted.unmount(); await studio.awaitEval(); studio.dispose(); }
});
