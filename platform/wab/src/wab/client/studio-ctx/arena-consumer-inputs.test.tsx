import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { EmptyTabPlaceholder } from "@/wab/client/components/sidebar-tabs/EmptyTabPlaceholder";
import { GlobalCssVariables } from "@/wab/client/components/studio/GlobalCssVariables";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useVariantsControllerInputs } from "@/wab/client/studio-ctx/variant-state";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { cloneArenaFrame, getArenaFrames } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { Arena } from "@/wab/shared/model/classes";
import * as cssVariables from "@/wab/styles/css-variables";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";

// Grid spacing is independent from recording color. The actual controller-owner
// selection is exercised below through its real factory and hook.
vi.mock("@/wab/client/hooks/useCurrentRecordingTarget", () => ({ useCurrentRecordingTarget: () => "baseVariant" }));
const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
  document.documentElement.style.removeProperty(cssVariables.gridSpacing);
  document.documentElement.style.removeProperty(cssVariables.selectionControlsColor);
});
async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue();
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Card", type: ComponentType.Plain });
  const page = manager.addComponent({ name: "Customers", type: ComponentType.Page });
  const mixed = new Arena({ name: "Scenarios", children: [cloneArenaFrame(ensure(getArenaFrames(getDedicatedArena(site, component))[0], "Mixed frame"))] });
  site.arenas.splice(0, site.arenas.length, mixed);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Scenarios", devFlagOverrides: { ccStubs: true } });
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.observeComponents([component, page]); studio.createViewStateUndoRecord();
  const componentArena = ensure(getDedicatedArena(site, component), "Component arena");
  const pageArena = ensure(getDedicatedArena(site, page), "Page arena");
  const wrap = (children: React.ReactNode) => <StudioCtxContext.Provider value={studio}>{children}</StudioCtxContext.Provider>;
  return { studio, component, mixed, componentArena, pageArena, wrap };
}

it("updates the plain empty-tab consumer from actual arena kind and frame membership alone", async () => {
  const f = await setup();
  const { container } = render(f.wrap(<EmptyTabPlaceholder>Panel body</EmptyTabPlaceholder>));
  expect(screen.queryByText("Panel body")).toBeNull();
  expect(container.textContent).not.toBe("");
  await act(async () => { await f.studio.changeUnsafe(() => { f.mixed.children.splice(0); }); });
  expect(container.textContent).toBe("");
  act(() => { f.studio.currentArena = f.componentArena; });
  expect(screen.getByText("Panel body")).toBeTruthy();
  act(() => { f.studio.currentArena = f.pageArena; });
  expect(screen.getByText("Panel body")).toBeTruthy();
  act(() => { f.studio.currentArena = null; });
  expect(screen.queryByText("Panel body")).toBeNull();
  expect(container.textContent).toBe("");
});

it("sets grid CSS by actual arena kind and retains the old value for null", async () => {
  const f = await setup();
  render(f.wrap(<GlobalCssVariables />));
  const spacing = () => document.documentElement.style.getPropertyValue(cssVariables.gridSpacing);
  expect(spacing()).toBe("150px");
  act(() => { f.studio.currentArena = f.componentArena; });
  expect(spacing()).toBe("80px");
  act(() => { f.studio.currentArena = null; });
  expect(spacing()).toBe("80px");
  act(() => { f.studio.currentArena = f.pageArena; });
  expect(spacing()).toBe("150px");
  act(() => { f.studio.currentArena = f.mixed; });
  expect(spacing()).toBe("150px");
});

it("keeps an explicit View subscribed to actual arena factory choices without selection changes", async () => {
  const f = await setup();
  f.studio.currentArena = f.componentArena;
  const frame = ensure(getArenaFrames(f.componentArena)[0], "Component first frame");
  const view = ensure(f.studio.tryGetViewCtxForFrame(frame), "Explicit view");
  f.studio.setStudioFocusOnFrameContents(undefined);
  const selection = f.studio.selectionStore.getState();
  const rendered = vi.fn();
  function Factory() {
    useVariantsControllerInputs(f.studio, view);
    rendered();
    return <output aria-label="Controller factory">{makeVariantsController(f.studio, view)?.constructor.name}</output>;
  }
  render(<Factory />);
  expect(screen.getByLabelText("Controller factory").textContent).toBe("ComponentArenaVariantsController");
  const count = rendered.mock.calls.length;
  await act(async () => { await f.studio.changeUnsafe(() => { f.component.name = "Renamed card"; }); });
  expect(rendered).toHaveBeenCalledTimes(count);
  act(() => { f.studio.currentArena = f.mixed; });
  expect(f.studio.selectionStore.getState()).toBe(selection);
  expect(view.isDisposed).toBe(false);
  expect(screen.getByLabelText("Controller factory").textContent).toBe("CustomVariantsController");
});

it("rebinds no-selection focused fallback when only the actual first-frame identity changes", async () => {
  const f = await setup();
  f.studio.currentArena = f.componentArena;
  const base = ensure(getArenaFrames(f.componentArena)[0], "Component frame");
  await f.studio.changeUnsafe(() => { f.componentArena._focusedFrame = cloneArenaFrame(base); });
  f.studio.setStudioFocusOnFrameContents(undefined);
  const first = ensure(f.componentArena._focusedFrame, "First focused frame");
  const firstView = ensure(f.studio.tryGetViewCtxForFrame(first), "Initial fallback view");
  const subscribe = firstView.variantStore.subscribe;
  const disconnected = vi.fn();
  vi.spyOn(firstView.variantStore, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener);
    return () => { disconnected(); stop(); };
  });
  const selection = f.studio.selectionStore.getState();
  const original = f.studio.focusedOrFirstViewCtx.bind(f.studio);
  let chosen: ViewCtx | undefined;
  vi.spyOn(f.studio, "focusedOrFirstViewCtx").mockImplementation(() => { chosen = original(); return chosen; });
  function Inputs() {
    const inputs = useVariantsControllerInputs(f.studio);
    return <output aria-label="Variant inputs">{chosen?.arenaFrame().uid}:{JSON.stringify(inputs)}</output>;
  }
  render(<Inputs />);
  expect(chosen?.arenaFrame()).toBe(first);
  const before = screen.getByLabelText("Variant inputs").textContent;
  await act(async () => { await f.studio.changeUnsafe(() => { f.componentArena._focusedFrame = cloneArenaFrame(base); }); });
  expect(f.studio.selectionStore.getState()).toBe(selection);
  expect(chosen?.arenaFrame()).toBe(f.componentArena._focusedFrame);
  expect(chosen?.arenaFrame()).not.toBe(first);
  expect(disconnected).toHaveBeenCalled();
  expect(screen.getByLabelText("Variant inputs").textContent).not.toBe(before);
});
