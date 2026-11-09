import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { VariantLabel } from "@/wab/client/components/VariantControls";
import VariantRow from "@/wab/client/components/variants/VariantRow";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensureVariantSetting } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

const captured = vi.hoisted(() => ({ click: undefined as (() => void) | undefined }));
vi.mock("@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantRow", () => ({
  PlasmicVariantRow: ({ isIndicated, children, listItem }: { isIndicated: boolean; children: React.ReactNode; listItem: { onClickMain: () => void } }) => {
    captured.click = listItem.onClickMain;
    return <div><output>{isIndicated ? "indicated" : "empty"}</output>{children}</div>;
  },
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("refreshes the explicit label and setting marker and blocks a retired row callback", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Row owner" });
  const group = manager.createVariantGroup({ component, name: "Mode" }), variant = manager.createVariant(component, group, "First");
  const setting = ensureVariantSetting(component.tplTree, [variant]);
  const frame = mkArenaFrame({ site, component, name: "Row", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Rows", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Rows" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Row view");
  studio.setStudioFocusOnViewCtxContent(view); view.setStudioFocusByTpl(component.tplTree);
  const click = vi.fn();
  const mounted = render(<StudioCtxContext.Provider value={studio}><VariantRow studioCtx={studio} viewCtx={view} variant={variant} pinState={undefined} onClick={click} label={<VariantLabel variant={variant} />} /></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("status").textContent).toBe("empty");
    expect(screen.getByText("First")).toBeTruthy();
    await act(async () => { await studio.changeUnsafe(() => { variant.name = "Second"; setting.rs.values = { opacity: "0.4" }; }); });
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("indicated");
    const retained = ensure(captured.click, "Actual row callback");
    act(() => retained()); expect(click).toHaveBeenCalledOnce();
    act(() => studio.disposeViewCtx(view)); click.mockClear();
    act(() => retained()); expect(click).not.toHaveBeenCalled();
  } finally { mounted.unmount(); studio.dispose(); }
});
