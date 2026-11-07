import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { CanvasHeader } from "@/wab/client/components/canvas/CanvasFrame/CanvasHeader";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { createStudioSelectionFixture } from "@/wab/client/__testonly__/studio-selection";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Pt } from "@/wab/shared/geom";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const fixture = vi.hoisted(() => ({ ctx: undefined as unknown as StudioCtx }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock(
  "@/wab/client/components/canvas/CanvasFrame/CanvasConfigButton",
  () => ({
    CanvasConfigButton: () => null,
  }),
);
const sourceDisposals: (() => void)[] = [];
afterEach(() => { cleanup(); sourceDisposals.splice(0).forEach((dispose) => dispose()); });

function setup() {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const component = mgr.addComponent({
    name: "Customers",
    type: ComponentType.Page,
  });
  const frame = mkArenaFrame({
    site,
    component,
    name: "Customer list",
    width: 1440,
    height: 960,
  });
  const arena = mkMixedArena("Overview");
  arena.children.push(frame);
  site.arenas.push(arena);
  const modelSnapshots = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots });
  arenaState.setCurrent(arena);
  sourceDisposals.push(() => { arenaState.dispose(); modelSnapshots.dispose(); });
  const ctx = mock<StudioCtx>();
  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(createStudioSelectionFixture()));
  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(createViewportFixture(0.5)));
  Object.defineProperties(ctx, {
    site: { value: site },
    modelSnapshots: { value: modelSnapshots },
    arenaState: { value: arenaState },
    zoom: { value: 0.5 },
  });
  ctx.focusedFrames.mockReturnValue([]);
  ctx.tplMgr.mockReturnValue(mgr);
  ctx.getDedicatedArena.mockImplementation((it) => getDedicatedArena(site, it));
  fixture.ctx = ctx;
  return { ctx, arena, frame, component, site, modelSnapshots };
}

it("offers a focus action on each mixed-arena artboard without selecting or dragging the header", () => {
  const { ctx, arena, frame } = setup();
  const click = vi.fn();
  const pointerDown = vi.fn();
  render(
    <div onClick={click} onPointerDown={pointerDown}>
      <CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />
    </div>,
  );
  const focus = screen.getByRole("button", {
    name: "Focus artboard: Customers",
  });
  fireEvent.pointerDown(focus);
  fireEvent.click(focus);
  expect(ctx.focusCanvasFrame).toHaveBeenCalledWith(frame);
  expect(ctx.setStudioFocusOnFrame).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
  expect(pointerDown).not.toHaveBeenCalled();
});

it("keeps the focus entry out of the independent page editor", () => {
  const { ctx, frame, component, site } = setup();
  const arena = ensure(getDedicatedArena(site, component), "Page arena");
  render(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  expect(screen.queryByRole("button", { name: /Focus artboard/ })).toBeNull();
});


it("uses the current arena kind in collapsed tooltips even when the rendered frame belongs to a cached mixed arena", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1000);
  const { ctx, frame, component, site, arena } = setup();
  const page = ensure(getDedicatedArena(site, component), "Page arena");
  const { unmount } = render(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  const trigger = ensure(screen.getByText("Customers").parentElement, "Collapsed header tooltip trigger");
  fireEvent.mouseEnter(trigger);
  expect((await screen.findByRole("tooltip")).textContent).toContain("Customers");
  act(() => ctx.arenaState.setCurrent(page));
  expect(screen.getByRole("tooltip").textContent).not.toContain("Customers");
  unmount();
});


it("updates header max width from completed native width fields and the current viewport", () => {
  const { ctx, arena, frame, site, modelSnapshots } = setup();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  sourceDisposals.push(() => recorder.dispose());
  const mounted = render(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  const label = ensure(mounted.container.querySelector<HTMLElement>(".CanvasFrame__Label"), "Header label");
  expect(label.style.maxWidth).toBe("648px");
  act(() => {
    const changes = recorder.withRecording(() => { frame.width = 800; }).changes;
    modelSnapshots.sync(changes);
  });
  expect(label.style.maxWidth).toBe("328px");
  act(() => ensure(ctx.viewportCtx, "Viewport").enqueueTransform(2, Pt.zero(), false));
  expect(label.style.maxWidth).toBe("1528px");
  const demand = vi.spyOn(modelSnapshots, "field");
  act(() => { ctx.arenaState.reset(); modelSnapshots.dispose(); });
  mounted.rerender(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  expect(demand).not.toHaveBeenCalled();
  expect(label.style.maxWidth).toBe("1528px");
  mounted.unmount();
  const remounted = render(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  expect(ensure(remounted.container.querySelector<HTMLElement>(".CanvasFrame__Label"), "Remounted header").style.maxWidth).toBe("1528px");
  expect(demand).not.toHaveBeenCalled();
});


it("rejects never-bound foreign frames before asking the current model owner for fields", () => {
  const old = setup();
  const next = setup();
  const demand = vi.spyOn(next.modelSnapshots, "field");
  expect(() => render(<CanvasHeader studioCtx={next.ctx} arena={old.arena} frame={old.frame} />)).toThrow("Cannot attach a foreign frame to the current width source");
  expect(demand).not.toHaveBeenCalled();
});
