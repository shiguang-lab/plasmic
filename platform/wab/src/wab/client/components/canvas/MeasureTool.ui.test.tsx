import { createStore } from "zustand/vanilla";
import * as Signals from "signals";
import { CanvasContentEditorIndex } from "@/wab/client/studio-ctx/canvas-content-editor";
import { FrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { mkArenaFrame, mkMixedArena, updateAutoDerivedFrameHeight } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { mockDeepAuto } from "@/wab/__testonly__/mock";
import { MeasureTool } from "@/wab/client/components/canvas/MeasureTool";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";
import { act, render } from "@testing-library/react";
import $ from "jquery";
import React from "react";

vi.mock("@/wab/client/dom", () => ({ hasLayoutBox: () => true }));
vi.mock("@/wab/client/components/canvas/HoverBox", () => ({
  recomputeBounds: ($node: JQuery) =>
    Box.fromRect($node[0].getBoundingClientRect()),
}));

it("updates existing measurement lines on nested content scroll and cleans up when changing frames", () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const doc = iframe.contentDocument!;
  const parent = doc.createElement("div");
  const child = doc.createElement("div");
  parent.append(child);
  doc.body.append(parent);
  let childY = 100;
  vi.spyOn(parent, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 400, 400),
  );
  vi.spyOn(child, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(50, childY, 100, 50),
  );
  const models = new ModelSnapshots();
  const site = createSite();
  const component = mkComponent({ name: "Measured page", type: ComponentType.Page, tplTree: mkTplTagX("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Measured page", width: 400, height: 400 });
  site.arenas.push(mkMixedArena("Measured", [frame]));
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  const studioCtx = mockDeepAuto<StudioCtx>();
  const views: { signal: AbortController; selection: ViewSelection }[] = [];
  Object.defineProperty(studioCtx, "framesChanged", { value: new Signals.Signal() });
  const contentEditors = new CanvasContentEditorIndex(() => []);
  Object.defineProperty(studioCtx, "activeContentEditorStore", { value: contentEditors.store });
  Object.defineProperties(studioCtx, { modelSnapshots: { value: models }, arenaState: { value: arenaState } });
  studioCtx.hasPendingModelChanges.mockReturnValue(false);
  studioCtx.subscribeModelChanges.mockReturnValue(() => undefined);
  const frameHeights = new FrameHeights(studioCtx);
  Object.defineProperty(studioCtx, "frameHeights", { value: frameHeights });
  const rafs = new Map<number, FrameRequestCallback>(); let rafId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { rafs.set(++rafId, callback); return rafId; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { rafs.delete(id); });
  const focus = new StudioSelection(() => models);
  const makeView = (canvasDocument: Document) => {
    const selection = new ViewSelection(() => models);
    selection.setDoms([$(child)]);
    selection.setMeasure($(parent));
    const view = mockDeepAuto<ViewCtx>();
    const signal = new AbortController(); views.push({ signal, selection });
    Object.defineProperties(view, {
      studioCtx: { value: studioCtx }, disposeSignal: { value: signal.signal }, modelLifetime: { value: arenaState.lifetime() },
      styleChanged: { value: new Signals.Signal() },
      csEvaluator: { value: { renderStatusStore: createStore(() => ({ renderCount: 0, isFirstRenderComplete: true })) } },
    });
    view.arenaFrame.mockReturnValue(frame);
    Object.defineProperty(view, "selectionStore", { value: selection.store });
    view.canvasCtx.$doc.mockReturnValue($(canvasDocument));
    view.focusedDomElt.mockImplementation(() => selection.doms()[0]);
    view.$measureToolDomElt.mockImplementation(() => selection.measure());
    const viewOps = mockDeepAuto<ReturnType<ViewCtx["getViewOps"]>>();
    view.getViewOps.mockReturnValue(viewOps);
    const tpl = mkTplTagX("div");
    const val = new ValTag({ tpl, children: [], className: "", key: "target", fullKey: "target", frameUid: 1, fibers: [], parent: undefined, valOwner: undefined, slotInfo: undefined });
    viewOps.getFinalFocusable.mockReturnValue({ val, focusedTpl: tpl, focusedDom: $(parent), focusedCloneKey: undefined });
    view.studioCtx.getArenaFrameScalerRect.mockReturnValue({ left: 0, top: 0, width: 400, height: 400 });
    return view;
  };
  focus.set(makeView(doc), []);
  const overlayState = new StudioOverlayState();
  Object.defineProperty(studioCtx, "overlayState", { value: overlayState });
  Object.defineProperties(studioCtx, Object.getOwnPropertyDescriptors(createViewportFixture()));
  Object.defineProperty(studioCtx, "selectionStore", { value: focus.store });
  studioCtx.focusedViewCtx.mockImplementation(() => focus.current().view);
  Object.defineProperties(studioCtx, {
    canvasContentEditor: { value: undefined },
    zoom: { value: 1 },
    isResizeDragging: { get: () => overlayState.resizeDragging },
  });
  const { container, unmount } = render(
    <StudioCtxContext.Provider value={studioCtx}>
      <MeasureTool />
    </StudioCtxContext.Provider>,
  );
  const topLine = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(".MeasureTool__Line"),
    ).find(
      (line) => line.style.left === "100px" && line.style.top === `${childY}px`,
    )!;
  expect(topLine().dataset.originalWidth).toBe("100");
  act(() => { overlayState.resizeDragging = true; });
  expect(container.querySelectorAll(".MeasureTool__Line")).toHaveLength(0);
  act(() => { overlayState.resizeDragging = false; });
  expect(topLine().dataset.originalWidth).toBe("100");
  act(() => {
    childY = 40;
    parent.dispatchEvent(new Event("scroll"));
  });
  expect(topLine().dataset.originalWidth).toBe("40");
  act(() => {
    childY = 25;
    updateAutoDerivedFrameHeight(frame, 700);
    const pending = [...rafs.values()]; rafs.clear();
    pending.forEach((callback) => callback(performance.now()));
  });
  expect(topLine().dataset.originalWidth).toBe("25");
  expect(frame.height).toBe(400);
  const remove = vi.spyOn(doc, "removeEventListener");
  const nextDoc = document.implementation.createHTMLDocument();
  const nextRemove = vi.spyOn(nextDoc, "removeEventListener");
  act(() => focus.set(makeView(nextDoc), []));
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  unmount();
  expect(nextRemove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  focus.dispose(); views.forEach(({ signal, selection }) => { signal.abort(); selection.dispose(); });
  contentEditors.dispose(); frameHeights.dispose(); arenaState.dispose();
  models.dispose();
  vi.restoreAllMocks();
  overlayState.dispose();
  iframe.remove();
});
