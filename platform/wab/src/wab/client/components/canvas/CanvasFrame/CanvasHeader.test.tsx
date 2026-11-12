import { CanvasHeaderInputs } from "@/wab/client/components/canvas/CanvasFrame/canvas-header-inputs";
import { mkVariant } from "@/wab/shared/Variants";
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
  expect(label.style.maxWidth).toBe("720px");
  act(() => {
    const changes = recorder.withRecording(() => { frame.width = 800; }).changes;
    modelSnapshots.sync(changes);
  });
  expect(label.style.maxWidth).toBe("400px");
  act(() => ensure(ctx.viewportCtx, "Viewport").enqueueTransform(2, Pt.zero(), false));
  expect(label.style.maxWidth).toBe("1600px");
  const demand = vi.spyOn(modelSnapshots, "field");
  act(() => { ctx.arenaState.reset(); modelSnapshots.dispose(); });
  mounted.rerender(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  expect(demand).not.toHaveBeenCalled();
  expect(label.style.maxWidth).toBe("1600px");
  mounted.unmount();
  const remounted = render(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  expect(ensure(remounted.container.querySelector<HTMLElement>(".CanvasFrame__Label"), "Remounted header").style.maxWidth).toBe("1600px");
  expect(demand).not.toHaveBeenCalled();
});


it("rejects never-bound foreign frames before asking the current model owner for fields", () => {
  const old = setup();
  const next = setup();
  const demand = vi.spyOn(next.modelSnapshots, "field");
  expect(() => render(<CanvasHeader studioCtx={next.ctx} arena={old.arena} frame={old.frame} />)).toThrow("Cannot attach a foreign frame to the current width source");
  expect(demand).not.toHaveBeenCalled();
});


it("updates the visible frame label after title changes", () => {
  const { ctx, arena, frame, component, site, modelSnapshots } = setup();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  sourceDisposals.push(() => recorder.dispose());
  render(<CanvasHeader studioCtx={ctx} arena={arena} frame={frame} />);
  act(() => { modelSnapshots.sync(recorder.withRecording(() => { component.name = "Orders"; }).changes); });
  expect(screen.getByText("Orders")).toBeTruthy();
  act(() => { modelSnapshots.sync(recorder.withRecording(() => { component.name = ""; frame.name = "Fallback"; }).changes); });
  expect(screen.getByText("Fallback")).toBeTruthy();
});

it("tracks frame pin and variant labels without observing unrelated component names", () => {
  const { ctx, frame, component, site, modelSnapshots } = setup();
  const unrelated = new TplMgr({ site }).addComponent({ name: "Other", type: ComponentType.Plain });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  sourceDisposals.push(() => recorder.dispose());
  const inputs = new CanvasHeaderInputs(ctx, frame);
  const publish = vi.fn();
  const stop = inputs.subscribe(publish);
  sourceDisposals.unshift(stop);
  publish.mockClear();
  const before = inputs.getSnapshot();
  modelSnapshots.sync(recorder.withRecording(() => { unrelated.name = "Unrelated rename"; }).changes);
  expect(inputs.getSnapshot()).toBe(before);
  expect(publish).not.toHaveBeenCalled();
  const variant = mkVariant({ name: "Selected" });
  modelSnapshots.sync(recorder.withRecording(() => { component.variants.push(variant); frame.targetVariants = [variant]; }).changes);
  expect(publish).toHaveBeenCalledOnce();
  publish.mockClear();
  modelSnapshots.sync(recorder.withRecording(() => { variant.name = "Renamed"; }).changes);
  expect(publish).toHaveBeenCalledOnce();
  publish.mockClear();
  stop();
  modelSnapshots.sync(recorder.withRecording(() => { variant.name = "Detached"; }).changes);
  expect(publish).not.toHaveBeenCalled();
});

it("retains the header while its frame and pinned variant are removed, then reads the restored frame", () => {
  const { ctx, arena, frame, component, site, modelSnapshots } = setup();
  const variant = mkVariant({ name: "Hover", selectors: [":hover"] });
  component.variants.push(variant);
  frame.pinnedVariants = { [variant.uuid]: true };
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  sourceDisposals.push(() => recorder.dispose());
  const inputs = new CanvasHeaderInputs(ctx, frame);
  const publish = vi.fn();
  sourceDisposals.unshift(inputs.subscribe(publish));
  const original = ensure(inputs.getSnapshot(), "Mounted artboard header");
  const commit = (change: () => void) => {
    const { changes } = recorder.withRecording(change);
    modelSnapshots.sync(changes, () => ctx.arenaState.prepareModelCommit(changes));
  };
  publish.mockClear();
  commit(() => {
    arena.children.pop();
    component.variants.pop();
  });
  expect(inputs.getSnapshot()).toBe(original);
  expect(publish).not.toHaveBeenCalled();
  commit(() => {
    component.variants.push(variant);
    arena.children.push(frame);
    component.name = "Restored";
  });
  expect(inputs.getSnapshot()?.frameName).toContain("Restored");
  expect(publish).toHaveBeenCalledOnce();
});
