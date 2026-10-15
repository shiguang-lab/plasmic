import { CanvasHeader } from "@/wab/client/components/canvas/CanvasFrame/CanvasHeader";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const fixture = vi.hoisted(() => ({ ctx: undefined as unknown as StudioCtx }));
vi.mock("@/wab/client/studio-ctx/StudioCtx", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock(
  "@/wab/client/components/canvas/CanvasFrame/CanvasConfigButton",
  () => ({
    CanvasConfigButton: () => null,
  }),
);
afterEach(cleanup);

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
  const ctx = mock<StudioCtx>();
  Object.defineProperties(ctx, {
    site: { value: site },
    currentArena: { value: arena },
    zoom: { value: 0.5 },
    focusedMode: { value: false },
  });
  ctx.focusedFrames.mockReturnValue([]);
  ctx.tplMgr.mockReturnValue(mgr);
  ctx.getDedicatedArena.mockImplementation((it) => getDedicatedArena(site, it));
  fixture.ctx = ctx;
  return { ctx, arena, frame, component, site };
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
