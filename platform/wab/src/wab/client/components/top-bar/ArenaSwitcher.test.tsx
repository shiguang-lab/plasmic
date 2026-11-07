import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ArenaSwitcher from "@/wab/client/components/top-bar/ArenaSwitcher";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { AnyArena } from "@/wab/shared/Arenas";
import { ensure } from "@/wab/shared/common";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { Arena } from "@/wab/shared/model/classes";
import { Pt } from "@/wab/shared/geom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const calls = vi.hoisted(() => ({ menu: vi.fn<(arena: AnyArena) => void>() }));
vi.mock("@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicArenaSwitcher", () => ({ PlasmicArenaSwitcher: ({ arenaType, root, onClick, onContextMenu }: { arenaType: string; root: { children: React.ReactNode }; onClick: React.MouseEventHandler; onContextMenu: React.MouseEventHandler }) => <button data-testid="arena-switcher" data-arena-type={arenaType} onClick={onClick} onContextMenu={onContextMenu}>{root.children}</button> }));
// Menu contents have an independent C4 contract. Keep the actual shared context-menu lifecycle.
vi.mock("@/wab/client/components/sidebar-tabs/ProjectPanel/ArenaContextMenu", () => ({ ArenaContextMenu: ({ arena }: { arena: AnyArena }) => { calls.menu(arena); return <output aria-label="Arena menu">Menu</output>; } }));
const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); calls.menu.mockClear(); vi.restoreAllMocks();
});
async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue();
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Card", type: ComponentType.Plain });
  const page = manager.addComponent({ name: "Customers", type: ComponentType.Page });
  const mixed = new Arena({ name: "Scenarios", children: [] });
  site.arenas.splice(0, site.arenas.length, mixed);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Scenarios", devFlagOverrides: { ccStubs: true } });
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  // The real route command persists viewport data; this headless UI fixture has no viewport.
  vi.spyOn(studio, "getCurrentStudioViewportSnapshot").mockReturnValue({ scroll: Pt.zero(), canvasPadding: Pt.zero(), scale: 1 });
  vi.spyOn(studio, "restoreStudioViewportSnapshot").mockImplementation(() => undefined);
  studio.observeComponents([component, page]); studio.createViewStateUndoRecord();
  render(<StudioCtxContext.Provider value={studio}><ArenaSwitcher /></StudioCtxContext.Provider>);
  return { studio, mixed, component, componentArena: ensure(getDedicatedArena(site, component), "Component arena"), pageArena: ensure(getDedicatedArena(site, page), "Page arena") };
}
it("renders actual mixed/component/page/null arena output and the project-panel command", async () => {
  const f = await setup(), button = screen.getByTestId("arena-switcher");
  expect(button.textContent).toBe("Scenarios"); expect(button.getAttribute("data-arena-type")).toBe("mixed");
  for (const [arena, name, kind] of [[f.componentArena, "Card", "component"], [f.pageArena, "Customers", "page"], [null, "", "mixed"]] as const) {
    // A null route selects the first arena in a nonempty project. Exercise the
    // actual loading/empty current source directly for the null UI contract.
    await act(async () => { if (arena) { f.studio.switchToArena(arena); } else { f.studio.currentArena = null; } });
    expect(button.textContent).toBe(name); expect(button.getAttribute("data-arena-type")).toBe(kind);
  }
  const show = vi.spyOn(f.studio, "showProjectPanel");
  fireEvent.click(button); expect(show).toHaveBeenCalledOnce();
  fireEvent.contextMenu(button);
  expect(calls.menu).not.toHaveBeenCalled();
});
it("updates native component labels and passes the real arena into an opened menu", async () => {
  const f = await setup();
  await act(async () => { f.studio.switchToArena(f.componentArena); });
  const button = screen.getByTestId("arena-switcher");
  fireEvent.contextMenu(button);
  await screen.findByLabelText("Arena menu");
  expect(calls.menu).toHaveBeenLastCalledWith(f.componentArena);
  await act(async () => { await f.studio.changeUnsafe(() => { f.component.name = "Renamed card"; }); });
  expect(button.textContent).toBe("Renamed card");
  // The separate menu root still targets the same real arena; its internal current hook is C4.
  expect(calls.menu.mock.calls.every(([arena]) => arena === f.componentArena)).toBe(true);
  await act(async () => { fireEvent.click(document.body); });
});
