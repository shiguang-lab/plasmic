import { getFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { Pt } from "@/wab/shared/geom";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { FrameSelectionBox } from "@/wab/client/components/canvas/HoverBox/FrameSelectionBox";
import { MultiSelectionBox } from "@/wab/client/components/canvas/HoverBox/MultiSelectionBox";
import edgeStyles from "@/wab/client/components/canvas/HoverBox/draggable-edge.module.sass";
import { HoverBox, HoverBoxes } from "@/wab/client/components/canvas/HoverBox/HoverBoxes";
import { AppContext } from "@/wab/client/components/top-view";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { typeFactory } from "@/wab/shared/model/model-util";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import $ from "jquery";
import React from "react";

function element(left: number) {
  const node = document.body.appendChild(document.createElement("div"));
  Object.defineProperties(node, { offsetWidth: { value: 100 }, offsetHeight: { value: 50 } });
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue(new DOMRect(left, 20, 100, 50));
  return node;
}

async function fixture(type = ComponentType.Plain) {
  const site = createSite(), base = mkBaseVariant();
  const nested = mkComponent({ name: "Nested", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const slot = mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() });
  nested.params.push(slot);
  const first = mkTplComponent(nested, base, []), second = mkTplComponent(nested, base, []);
  const component = mkComponent({ name: "Page", type, variants: [base], tplTree: mkTplTagX("div", { baseVariant: base }, [first, second]) });
  site.components.push(nested, component);
  const arena = mkMixedArena("Selection");
  const size = type === ComponentType.Page ? { width: 390, height: 844 } : { width: 400, height: 300 };
  const frame = mkArenaFrame({ site, component, name: "First", ...size, left: 0, top: 0 });
  const other = mkArenaFrame({ site, component, name: "Second", width: 400, height: 300, left: 500, top: 0 });
  arena.children.push(frame, other); site.arenas.push(arena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Selection" });
  // Finish the initial route's deferred zoom-to-fit before testing an explicit
  // zoom or layer selection on this artboard.
  const initialFit = vi.spyOn(studio, "tryZoomToFitArena");
  studio.viewportCtx = createViewportFixture().viewportCtx;
  await waitFor(() => {
    expect(studio.initialRouteReady).toBe(true);
    expect(initialFit).toHaveBeenCalled();
  });
  return { studio, frame, other, first, second, slot };
}

beforeEach(() => { vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false); });

afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.restoreAllMocks(); });

it.each([0.5, 1, 2])("clips root spacing while keeping drag targets on the actual phone edges at zoom %s", async (zoom) => {
  const { studio, frame } = await fixture(ComponentType.Page);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Phone view");
  const viewport = document.body.appendChild(document.createElement("iframe"));
  const root = document.body.appendChild(document.createElement("div"));
  root.style.padding = "40px 0 0";
  Object.assign(view.canvasCtx, {
    viewport: () => viewport, $doc: () => $(document), doc: () => document,
    viewportContainerOffset: () => ({ left: 0, top: 0 }),
  });
  const tpl = ensureKnownTplTag(frame.container.component.tplTree);
  const val = new ValTag({ tpl, children: [], className: "", key: tpl.uuid, fullKey: tpl.uuid,
    frameUid: frame.uid, fibers: [], parent: undefined, valOwner: undefined, slotInfo: undefined });
  const valState = view.valState();
  vi.spyOn(valState, "maybeValUserRoot").mockReturnValue(val);
  vi.spyOn(view, "valState").mockReturnValue(valState);
  vi.spyOn(view.renderState, "sel2dom").mockReturnValue([root]);
  await act(async () => {
    await studio.changeUnsafe(() => {
      studio.selection.set(view, []);
    });
    studio.viewportCtx = createViewportFixture(zoom).viewportCtx;
  });
  const mounted = render(
    <AppContext.Provider value={studio.app}>
      <StudioCtxContext.Provider value={studio}>
        <HoverBox viewCtx={view} target={frame} />
      </StudioCtxContext.Provider>
    </AppContext.Provider>
  );
  const border = ensure(mounted.container.querySelector<HTMLElement>(".HoverBox__Border--screen"), "Screen outline");
  const mask = ensure(mounted.container.querySelector<HTMLElement>('[style*="polygon"]')?.closest<HTMLElement>('[style*="clip-path: inset"]'), "Spacing mask");
  expect(border.parentElement?.className).toBe("hoverbox");
  expect(border.style.clipPath).toBe(`inset(0px 0px 0px 0px round ${44 * zoom}px)`);
  expect(mask.style.clipPath).toBe(`inset(0px 0px 0px 0px round ${44 * zoom}px)`);
  expect(mask.querySelector('[style*="polygon"]')).toBeTruthy();
  const controls = ensure(mounted.container.querySelector(".HoverBox__Resizers"), "Edge controls");
  expect(mask.contains(controls)).toBe(false);
  const bottom = ensure(controls.querySelector<HTMLElement>(
    `.${edgeStyles.bottom} .${edgeStyles.padding} .${edgeStyles.edgeHandle}`
  ), "Bottom padding drag target");
  expect(bottom.style.bottom).toBe("0px");
  expect(bottom.closest('[style*="clip-path"]')).toBeNull();
  expect(controls.querySelector<HTMLElement>(`.${edgeStyles.top} .${edgeStyles.edgeAreaFill}`)?.style.clipPath)
    .toBe(`inset(0px 0px ${(40 - 844) * zoom}px 0px round ${44 * zoom}px)`);
  const right = ensure(controls.querySelector<HTMLElement>(
    `.${edgeStyles.right} .${edgeStyles.size}`
  ), "Width drag target");
  expect(parseFloat(right.style.right)).toBe(-parseFloat(right.style.width) / 2);
  const label = ensure(mounted.container.querySelector(".node-outline-tag"), "Artboard label");
  expect(mask.contains(label)).toBe(false);
});

it("keeps a read-only full-width selection visible as the iframe changes position", async () => {
  const { studio, frame, first, slot } = await fixture(ComponentType.Page);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Phone view");
  const hero = document.body.appendChild(document.createElement("div"));
  Object.defineProperties(hero, { offsetWidth: { value: 390 }, offsetHeight: { value: 328 } });
  vi.spyOn(hero, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 158, 390, 328));
  const viewport = document.body.appendChild(document.createElement("iframe"));
  let offsetTop = 47;
  Object.assign(view.canvasCtx, {
    viewport: () => viewport, $doc: () => $(document), doc: () => document,
    viewportContainerOffset: () => ({ left: 1260, top: offsetTop }),
  });
  const target = { node: $(hero), focusObj: new SlotSelection({ tpl: first, slotParam: slot }) };
  await act(async () => {
    await studio.changeUnsafe(() => {
      studio.selection.set(view, []);
      view.selection.setTargets([target.focusObj]);
      view.selection.setDoms([target.node]);
    });
    studio.viewportCtx = createViewportFixture(0.71152).viewportCtx;
    studio.setBlockChanges(true);
  });
  const mounted = render(
    <AppContext.Provider value={studio.app}>
      <StudioCtxContext.Provider value={studio}>
        <HoverBox viewCtx={view} target={target} />
      </StudioCtxContext.Provider>
    </AppContext.Provider>
  );
  try {
    const border = ensure(mounted.container.querySelector<HTMLElement>(".HoverBox__Border--screen"), "Selected border");
    const box = ensure(border.parentElement, "Selection overlay");
    expect(box.className).toBe("hoverbox");
    expect(border.closest('[style*="clip-path"]')).toBeNull();
    expect(box.style.top).toBe("205px");
    expect(box.textContent).toContain("390 × 328");
    act(() => { offsetTop = 0; studio.framesChanged.dispatch(); });
    await waitFor(() => expect(box.style.top).toBe("158px"));
    expect(mounted.container.querySelector(".HoverBox__Border")).toBe(border);
  } finally { mounted.unmount(); studio.dispose(); }
});

it("restores selection outlines when the initial viewport transform settles", async () => {
  const { studio, frame, other } = await fixture();
  const viewport = ensure(createViewportFixture().viewportCtx, "Viewport");
  await act(async () => {
    await studio.changeUnsafe(() => studio.selection.set(undefined, [frame, other]));
    studio.viewportCtx = viewport;
    viewport.enqueueTransform(0.71152, Pt.zero(), false);
  });
  const mounted = render(<HoverBoxes studioCtx={studio} />);
  try {
    expect(screen.queryByText("2 artboards selected")).toBeNull();
    await waitFor(() => expect(screen.getByText("2 artboards selected")).toBeTruthy());
  } finally { mounted.unmount(); studio.dispose(); }
});

it("hides and restores the actual artboard selection from the real transform command without another input change", async () => {
  const f = await fixture();
  await act(async () => { await f.studio.changeUnsafe(() => f.studio.selection.set(undefined, [f.frame, f.other])); });
  const changed = vi.fn();
  const stop = f.studio.transformingObjectStore.subscribe(changed);
  const label = render(<FrameSelectionBox studioCtx={f.studio} />);
  try {
    expect(screen.getByText("2 artboards selected")).toBeTruthy();
    act(() => f.studio.setIsTransformingObject(true));
    expect(f.studio.isTransformingObject()).toBe(true);
    expect(screen.queryByText("2 artboards selected")).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
    act(() => f.studio.setIsTransformingObject(true));
    expect(changed).toHaveBeenCalledTimes(1);
    act(() => f.studio.setIsTransformingObject(false));
    expect(screen.getByText("2 artboards selected")).toBeTruthy();
    expect(f.studio.focusedFrames()).toEqual([f.frame, f.other]);
  } finally { label.unmount(); stop(); f.studio.dispose(); }
});

it("updates real layer selection UI and detaches the native source on unmount", async () => {
  const f = await fixture(ComponentType.Page), view = ensure(f.studio.tryGetViewCtxForFrame(f.frame), "Missing view owner");
  const first = element(20), second = element(150);
  Object.assign(view.canvasCtx, {
    $userBody: () => $(document.body), doc: () => document,
    viewportContainerOffset: () => ({ left: 0, top: 0 }),
  });
  await act(async () => { await f.studio.changeUnsafe(() => {
    view.selection.setTargets([new SlotSelection({ tpl: f.first, slotParam: f.slot }), new SlotSelection({ tpl: f.second, slotParam: f.slot })]);
    view.selection.setDoms([$(first), $(second)]);
  }); });
  const subscribe = f.studio.transformingObjectStore.subscribe, stopped = vi.fn();
  vi.spyOn(f.studio.transformingObjectStore, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener); return () => { stopped(); stop(); };
  });
  const label = render(<MultiSelectionBox viewCtx={view} />);
  try {
    const border = ensure(label.container.querySelector<HTMLElement>(".canvas-editor__multi-selection-border"), "Layer selection border");
    expect(border.style.clipPath).toBe("");
    expect(border.contains(screen.getByText("2 layers selected"))).toBe(false);
    act(() => f.studio.setIsTransformingObject(true));
    expect(screen.queryByText("2 layers selected")).toBeNull();
    act(() => f.studio.setIsTransformingObject(false));
    expect(screen.getByText("2 layers selected")).toBeTruthy();
    act(() => f.studio.setIsDraggingObject(true));
    expect(screen.queryByText("2 layers selected")).toBeNull();
    act(() => f.studio.setIsDraggingObject(false));
    expect(screen.getByText("2 layers selected")).toBeTruthy();
    label.unmount();
    expect(stopped).toHaveBeenCalledTimes(1);
  } finally { label.unmount(); f.studio.dispose(); }
});

it("uses the unique native dragging command for selection UI and the effective auto-open read", async () => {
  const f = await fixture();
  await act(async () => { await f.studio.changeUnsafe(() => f.studio.selection.set(undefined, [f.frame, f.other])); });
  const label = render(<FrameSelectionBox studioCtx={f.studio} />);
  try {
    expect(f.studio.isAutoOpenMode).toBe(true);
    expect(screen.getByText("2 artboards selected")).toBeTruthy();
    act(() => f.studio.setIsDraggingObject(true));
    expect(f.studio.draggingObjectStore.getState()).toBe(true);
    expect(f.studio.isAutoOpenMode).toBe(false);
    expect(screen.queryByText("2 artboards selected")).toBeNull();
    act(() => f.studio.setIsDraggingObject(false));
    expect(f.studio.isAutoOpenMode).toBe(true);
    expect(screen.getByText("2 artboards selected")).toBeTruthy();
  } finally { label.unmount(); f.studio.dispose(); }
});


it("updates frame selection from exact model geometry and native heights, releasing fields at owner departure", async () => {
  const f = await fixture();
  act(() => { f.studio.viewportCtx = ensure(createViewportFixture().viewportCtx, "Geometry viewport"); });
  await act(async () => { await f.studio.changeUnsafe(() => f.studio.selection.set(undefined, [f.frame, f.other])); });
  const widthField = f.studio.modelSnapshots.field(f.frame, "width");
  const subscribe = widthField.subscribe;
  const releases: ReturnType<typeof vi.fn>[] = [];
  vi.spyOn(widthField, "subscribe").mockImplementation((listener) => {
    const off = subscribe(listener), release = vi.fn(off); releases.push(release); return release;
  });
  const label = render(<React.StrictMode><FrameSelectionBox studioCtx={f.studio} /></React.StrictMode>);
  const root = ensure(label.container.querySelector<HTMLElement>("[data-artboard-selection]"), "Actual frame bounds");
  const prepared = vi.fn(() => {
    const rect = ensure(getFrameSelectionBounds(f.studio), "Prepared selection").rect();
    expect(rect).toMatchObject({ left: 20, top: 30, width: 1180, height: 320 });
  });
  let stop: () => void = () => undefined;
  try {
    expect(screen.getByText("900 × 300")).toBeTruthy();
    stop = widthField.subscribe(prepared);
    await act(async () => { await f.studio.changeUnsafe(() => {
      f.frame.left = 20; f.frame.top = 30; f.frame.width = 600;
      f.other.left = 800; f.other.top = 50;
    }); });
    expect(prepared).toHaveBeenCalledOnce(); stop();
    expect(root.style.left).toBe("20px"); expect(root.style.top).toBe("30px");
    expect(screen.getByText("1180 × 320")).toBeTruthy();
    await act(async () => { await f.studio.changeUnsafe(() => { f.frame.height = 450; }); });
    expect(screen.getByText("1180 × 450")).toBeTruthy();
    act(() => ensure(f.studio.viewportCtx, "Viewport").enqueueTransform(2, Pt.zero(), false));
    expect(root.style.width).toBe("2360px");
    expect(root.style.height).toBe("900px");
    act(() => f.studio.arenaState.reset());
    expect(releases.length).toBeGreaterThan(0);
    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true);
    expect(label.container.querySelector("[data-artboard-selection]")).toBeNull();
  } finally { stop(); label.unmount(); f.studio.dispose(); }
});

it("recomputes automatic-layout DOM bounds when the native viewport geometry changes", async () => {
  const f = await fixture();
  const viewport = ensure(createViewportFixture().viewportCtx, "Geometry viewport");
  const host = document.body.appendChild(document.createElement("div"));
  host.className = "canvas-editor__frames";
  const frameElement = host.appendChild(document.createElement("div"));
  frameElement.dataset.frameId = String(f.frame.uid);
  Object.defineProperty(frameElement, "offsetParent", { value: host });
  vi.spyOn(frameElement, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 80, 200, 100));
  await act(async () => { await f.studio.changeUnsafe(() => {
    f.frame.left = undefined; f.frame.top = undefined;
    f.studio.selection.set(undefined, [f.frame]);
  }); f.studio.viewportCtx = viewport; });
  const label = render(<FrameSelectionBox studioCtx={f.studio} />);
  try {
    const initial = ensure(getFrameSelectionBounds(f.studio), "Initial DOM bounds");
    expect(screen.getByText(`${Math.round(initial.width())} × ${Math.round(initial.height())}`)).toBeTruthy();
    act(() => viewport.enqueueTransform(2, Pt.zero(), false));
    const zoomed = ensure(getFrameSelectionBounds(f.studio), "Zoomed DOM bounds");
    expect(zoomed.width()).toBe(initial.width() / 2);
    expect(screen.getByText(`${Math.round(zoomed.width())} × ${Math.round(zoomed.height())}`)).toBeTruthy();
    const root = ensure(label.container.querySelector<HTMLElement>("[data-artboard-selection]"), "Actual auto-layout bounds");
    act(() => viewport.setScroll(new Pt(30, 40)));
    const moved = ensure(getFrameSelectionBounds(f.studio), "Scrolled DOM bounds");
    expect(moved.left()).not.toBe(zoomed.left());
    expect(root.style.left).toBe(`${moved.left()}px`);
    expect(root.style.top).toBe(`${moved.top()}px`);
  } finally { label.unmount(); f.studio.dispose(); }
});
