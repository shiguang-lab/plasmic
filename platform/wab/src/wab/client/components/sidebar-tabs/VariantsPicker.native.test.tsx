import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { VariantPicker } from "@/wab/client/components/sidebar-tabs/VariantsPicker";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { getBaseVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { $$$ } from "@/wab/shared/TplQuery";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ensureKnownVariantsRef } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/style-controls/StyleSelect", () => ({
  default: Object.assign(({ value, onChange, children, "aria-label": label }: { value?: string | null; onChange: (value: string) => void; children: React.ReactNode; "aria-label"?: string }) => <select aria-label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value)}><option value="" />{children}</select>, { Option: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option> }),
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("refreshes group/variant captions and edits the original instance argument", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Choices" });
  const group = manager.createVariantGroup({ component, name: "Mode" });
  manager.createVariant(component, group, "First"); const second = manager.createVariant(component, group, "Second");
  const owner = manager.addComponent({ type: ComponentType.Plain, name: "Picker owner" });
  const tpl = mkTplComponent(component, getBaseVariant(owner)); $$$(owner.tplTree).append(tpl);
  const frame = mkArenaFrame({ site, component: owner, name: "Picker", width: 400, height: 300 }); site.arenas.push(mkMixedArena("Picker", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Picker" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Picker view");
  studio.dbCtx().maybeObserveComponents([owner, component]);
  const mounted = render(<StudioCtxContext.Provider value={studio}><VariantPicker viewCtx={view} group={group} tpl={tpl} /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { group.param.variable.name = "Appearance"; second.name = "Updated option"; }); });
    const select = screen.getByRole("combobox", { name: "Appearance" });
    expect(screen.getByRole("option", { name: "Updated option" })).toBeTruthy();
    fireEvent.change(select, { target: { value: "Updated option" } });
    await waitFor(() => {
      const arg = ensure(view.variantTplMgr().getArg(tpl, group.param.variable), "Edited instance argument");
      expect(ensureKnownVariantsRef(arg.expr).variants).toEqual([second]);
    });
  } finally { mounted.unmount(); studio.dispose(); }
});
