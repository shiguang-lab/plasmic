import "@/wab/client/components/sidebar/MixinControls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { VariantAnimations } from "@/wab/client/components/sidebar-tabs/VariantAnimations";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { getBaseVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar-tabs/style-tab", () => ({ useNewAnimationContext: () => ({ newAnimation: undefined, onAnimationAdded: vi.fn() }) }));
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({ SidebarModal: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("updates animation labels and duration through native inputs and retires retained commands", async () => {
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ type: ComponentType.Plain, name: "Animation owner" });
  const tpl = ensureKnownTplTag(component.tplTree), variant = getBaseVariant(component);
  const sequence = manager.addAnimationSequence("Entrance"), animation = manager.addAnimation(sequence);
  ensure(tpl.vsettings[0], "Base setting").rs.animations = [animation];
  const frame = mkArenaFrame({ site, component, name: "Animation", width: 400, height: 300, left: 0, top: 0 });
  const arena = mkMixedArena("Animation", [frame]); site.arenas.push(arena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Animation" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Animation view");
  let retainedAdd: (() => void) | undefined;
  const mounted = render(<StudioCtxContext.Provider value={studio}><VariantAnimations viewCtx={view} tpl={tpl} variants={[variant]}>{({ animations, addAnimationLayer }) => {
    retainedAdd = addAnimationLayer;
    return <output>{animations.map((item) => `${item.sequence.name}:${item.duration}`).join(",")}</output>;
  }}</VariantAnimations></StudioCtxContext.Provider>);
  try {
    expect(screen.getByRole("status").textContent).toBe("Entrance:1s");
    await act(async () => { await studio.changeUnsafe(() => { sequence.name = "Updated"; animation.duration = "2s"; }); });
    expect(screen.getByRole("status").textContent).toBe("Updated:2s");
    const add = ensure(retainedAdd, "Retained add animation command");
    const change = vi.spyOn(studio, "change");
    act(() => studio.disposeViewCtx(view));
    change.mockClear();
    act(() => add());
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  } finally { mounted.unmount(); studio.dispose(); }
});
