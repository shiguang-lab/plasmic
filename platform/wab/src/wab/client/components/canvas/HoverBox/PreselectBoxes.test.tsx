import { ViewStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { TplMgr } from "@/wab/shared/TplMgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { RootComponentVariantFrame, GlobalVariantFrame } from "@/wab/shared/component-frame";
import * as Signals from "signals";
import { CanvasContentEditorIndex } from "@/wab/client/studio-ctx/canvas-content-editor";
import { ensure } from "@/wab/shared/common";
import { StackOfParents } from "@/wab/client/components/canvas/HoverBox/StackOfParents";
import { mock } from "vitest-mock-extended";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { createViewVariantFixture } from "@/wab/client/__testonly__/view-variants";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkParam } from "@/wab/shared/core/lang";
import { SlotSelection } from "@/wab/shared/core/slots";
import { createSite } from "@/wab/shared/core/sites";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { createStore } from "zustand/vanilla";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { PreselectBox, PreselectBoxes } from "@/wab/client/components/canvas/HoverBox/PreselectBoxes";
import { computeScalerVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { SQ } from "@/wab/shared/core/selection";
import { Arena, Arg, RenderExpr } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { deepTrackComponents, mkSlot, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import $ from "jquery";
import React from "react";

vi.mock("@/wab/client/contexts/StudioContexts", async (original) => ({
  ...await original<typeof import("@/wab/client/contexts/StudioContexts")>(),
  useStudioCtx: vi.fn(),
}));
vi.mock("@/wab/shared/core/selection", async (original) => ({
  ...await original<typeof import("@/wab/shared/core/selection")>(),
  SQ: vi.fn(),
}));
vi.mock("@/wab/client/components/canvas/EditableNodeLabel", () => ({
  EditableNodeLabel: () => null,
}));
vi.mock("@/wab/client/utils/tpl-client-utils", () => ({
  summarizeFocusObj: () => "Field",
}));
vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", () => ({
  createNodeIcon: () => undefined,
}));
vi.mock("@/wab/client/components/canvas/HoverBox/useTagPlacement", () => ({
  useTagPlacement: () => ({}),
}));
vi.mock("@/wab/client/components/canvas/HoverBox/visible-bounds", () => ({
  computeScalerVisibility: vi.fn(() => ({
    visible: { top: 0, left: 0, width: 100, height: 50 },
  })),
}));

const disposeFixtures: (() => void)[] = [];
function installContentScope(studio: StudioCtx) {
  const index = new CanvasContentEditorIndex(() => []);
  Object.defineProperty(studio, "activeContentEditorStore", { value: index.store });
  disposeFixtures.push(() => index.dispose());
}
afterEach(() => {
  cleanup();
  disposeFixtures.splice(0).forEach((dispose) => dispose());
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

function element(parent = document.body) {
  const node = document.createElement("div");
  Object.defineProperty(node, "offsetWidth", { value: 100 });
  Object.defineProperty(node, "offsetHeight", { value: 50 });
  parent.appendChild(node);
  return node;
}

function outline(roots: HTMLElement[], hovered: HTMLElement, isHoveredElt = false, live = false, dragging = createStore<boolean>(() => false), overlayState = new StudioOverlayState(), fixedSlot?: "root" | "slot") {
  overlayState.ancestorsHoverBoxes = false;
  const site = createSite();
  const base = mkBaseVariant();
  const tpl = mkTplTagX("div", { baseVariant: base, attrs: {} });
  const component = mkComponent({ name: "Hover", type: ComponentType.Plain, tplTree: fixedSlot ? mkTplTagX("div", { baseVariant: base }) : tpl, variants: [base] });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Hover", width: 100, height: 100 });
  const models = new ModelSnapshots();
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  const selection = new ViewSelection(() => models);
  const studioSelection = new StudioSelection(() => models);
  const variants = createViewVariantFixture(models, site, frame);
  const signal = new AbortController();
  const styleInputs = new ViewStyleInputs(() => models, signal.signal);
  const manager = new VariantTplMgr([new RootComponentVariantFrame(frame)], site, new TplMgr({ site }), new GlobalVariantFrame(site, frame));
  disposeFixtures.push(() => signal.abort());
  const value = new ValTag({ tpl, children: [], className: "", key: "hover", fullKey: "hover", frameUid: frame.uid, fibers: [], parent: undefined, valOwner: undefined, slotInfo: undefined });
  let selectable: ValTag | SlotSelection = value;
  if (fixedSlot) {
    const shell = mkCodeComponent("Shell", { name: "Shell", importPath: "./Shell", props: {} }, {});
    const param = mkParam({ name: "brand", paramType: "slot", type: typeFactory.renderable() });
    shell.params.push(param); site.components.push(shell);
    $$$(shell.tplTree).append(mkSlot(param));
    const owner = mkTplComponent(shell, base, []);
    $$$(component.tplTree).append(owner);
    owner.vsettings[0].args.push(new Arg({ param, expr: new RenderExpr({ tpl: [tpl] }) }));
    tpl.parent = owner;
    if (fixedSlot === "slot") selectable = new SlotSelection({ tpl: owner, slotParam: param });
  }
  deepTrackComponents(site);
  selection.setHover(selectable, $(hovered));
  disposeFixtures.push(() => { arenaState.dispose(); overlayState.dispose(); studioSelection.dispose(); selection.dispose(); variants.dispose(); models.dispose(); });
  const viewCtx = {
    selectionStore: selection.store,
    variantStore: variants.store,
    disposeSignal: signal.signal,
    styleInputs, site,
    modelLifetime: arenaState.lifetime(),
    canvasCtx: { $doc: () => $(document) },
    dom2focusObj: () => undefined,
    getCodeComponentMeta: () => ({ props: { brand: { type: "slot", fixedRoot: true } } }),
    selectionDom: () => $(roots),
    $hoveredDomElt: () => selection.hoverDom(),
    contentEditor: { contains: () => true },
    hoverVariantTplMgr: () => manager,
  } as unknown as ViewCtx;
  const studioCtx = {
    selectionStore: studioSelection.store, overlayState, arenaState, modelSnapshots: models,
    styleChanged: new Signals.Signal(), framesChanged: new Signals.Signal(),
    draggingObjectStore: dragging,
    hoveredViewStore: createStore<ViewCtx | undefined>(() => live ? viewCtx : undefined),
    focusedViewCtx: () => studioSelection.current().view,
    isDraggingObject: () => dragging.getState(),
    get screenshotting() { return overlayState.screenshotting; },
    get showStackOfParents() { return overlayState.stackOfParents; },
    zoom: 1,
    ...createViewportFixture(),
  } as unknown as StudioCtx;
  Object.defineProperty(viewCtx, "studioCtx", { value: studioCtx, writable: true });
  installContentScope(studioCtx);
  if (live) {
    Object.assign(viewCtx, {
      arenaFrame: () => frame,
      component: frame.container.component,
      studioCtx,
      modelLifetime: arenaState.lifetime(),
      isDisposed: false,
      initialRenderReadyStore: createStore<boolean>(() => false),
      hoveredSelectable: () => selection.hover(),
      sel2cloneKey: () => undefined,
      valState: () => undefined,
    });
    Object.assign(studioCtx, {
      isTransforming: () => false,
      currentArena: new Arena({ name: "Page", children: [frame] }),
      showAncestorsHoverBoxes: () => overlayState.ancestorsHoverBoxes,
    });
    arenaState.viewRegistry.register(viewCtx);
    vi.mocked(SQ).mockReturnValue({
      ancestors: () => ({ toArray: () => [selectable] }),
    } as unknown as ReturnType<typeof SQ>);
    vi.mocked(useStudioCtx).mockReturnValue(studioCtx);
    return Object.assign(render(<PreselectBoxes />), { retire: () => signal.abort() });
  }
  return Object.assign(render(
    <PreselectBox
      selectable={selectable}
      cloneKey={undefined}
      studioCtx={studioCtx}
      viewCtx={viewCtx}
      isHoveredElt={isHoveredElt}
    />,
  ), { retire: () => signal.abort() });
}

it("uses a dashed hover outline for fixed slot content", () => {
  const brand = element();
  const { container } = outline([brand], brand, true, false, undefined, undefined, "root");
  expect(container.querySelector<HTMLElement>(".PreselectBox > div")?.style.borderStyle).toBe("dashed");
});

it("does not add a second hover outline for the transparent fixed-root slot", () => {
  const wrapper = element(), brand = element(wrapper);
  const { container } = outline([wrapper], brand, false, false, undefined, undefined, "slot");
  expect(container.querySelector(".PreselectBox")).toBeNull();
});

it("does not outline background model ancestors of a portaled dialog", () => {
  const background = element();
  const dialog = element();
  const button = element(dialog);
  const { container } = outline([background], button);
  expect(container.querySelector(".PreselectBox")).toBeNull();
  expect(computeScalerVisibility).not.toHaveBeenCalled();
});

it("keeps ancestor outlines within the dialog content", () => {
  const dialog = element();
  const form = element(dialog);
  const field = element(form);
  const { container } = outline([form], field);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  expect(vi.mocked(computeScalerVisibility).mock.calls[0][0].toArray()).toEqual([form]);
});

it("excludes background roots from a component that also renders a portal", () => {
  const background = element();
  const dialog = element();
  const field = element(dialog);
  const { container } = outline([background, dialog], field);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  expect(vi.mocked(computeScalerVisibility).mock.calls[0][0].toArray()).toEqual([dialog]);
});

it("preserves ordinary non-portal ancestor outlines", () => {
  const section = element();
  const field = element(section);
  const { container } = outline([section], field);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});

it("hides a stale background hover target when a modal opens over it", () => {
  const opener = element();
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const { container } = outline([opener], opener, true);
  expect(container.querySelector(".PreselectBox")).toBeNull();
  expect(computeScalerVisibility).not.toHaveBeenCalled();
});

it("keeps hovered fields inside the active modal", () => {
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const field = element(modal);
  const { container } = outline([field], field, true);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});

it("does not let a hidden modal suppress background hover", () => {
  const field = element();
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.style.visibility = "hidden";
  const { container } = outline([field], field, true);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});

it("restricts hover to the last visible nested modal", () => {
  const first = element();
  const second = element();
  for (const modal of [first, second]) {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
  }
  const field = element(first);
  const { container } = outline([field], field, true);
  expect(container.querySelector(".PreselectBox")).toBeNull();
});

it("updates stale hover when a modal opens and closes without another mousemove", async () => {
  const opener = element();
  const { container } = outline([opener], opener, true, true);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  const modal = element();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  await waitFor(() => expect(container.querySelector(".PreselectBox")).toBeNull());
  modal.remove();
  await waitFor(() => expect(container.querySelector(".PreselectBox")).not.toBeNull());
});

it("hides the existing preselect outline when native dragging changes through its derived read boundary", () => {
  const section = element(), field = element(section);
  const dragging = createStore<boolean>(() => false);
  const { container } = outline([section], field, false, false, dragging);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  act(() => dragging.setState(true, true));
  expect(container.querySelector(".PreselectBox")).toBeNull();
  act(() => dragging.setState(false, true));
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});


it("hides and restores an existing outline through the real native screenshot helper read", () => {
  const section = element(), field = element(section);
  const overlayState = new StudioOverlayState();
  const { container } = outline([section], field, false, false, createStore<boolean>(() => false), overlayState);
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
  act(() => { overlayState.screenshotting = true; });
  expect(container.querySelector(".PreselectBox")).toBeNull();
  act(() => { overlayState.screenshotting = false; });
  expect(container.querySelector(".PreselectBox")).not.toBeNull();
});


it("cancels the actual parent-stack auto-hide producer when its view boundary unmounts", () => {
  vi.useFakeTimers();
  const models = new ModelSnapshots(), selection = new StudioSelection(() => models);
  const overlayState = new StudioOverlayState(), studio = mock<StudioCtx>();
  Object.defineProperties(studio, {
    overlayState: { value: overlayState }, selectionStore: { value: selection.store },
    setShowStackOfParents: { value: StudioCtx.prototype.setShowStackOfParents },
  });
  installContentScope(studio);
  studio.focusedViewCtx.mockReturnValue(undefined);
  vi.mocked(useStudioCtx).mockReturnValue(studio);
  const command = vi.spyOn(overlayState, "stackOfParents", "set");
  const mounted = render(<StackOfParents hoverTagRef={React.createRef<HTMLDivElement>()} />);
  try {
    const before = vi.getTimerCount();
    act(() => { overlayState.stackOfParents = true; });
    expect(vi.getTimerCount()).toBe(before + 1);
    mounted.unmount(); command.mockClear();
    act(() => { vi.runAllTimers(); });
    expect(command).not.toHaveBeenCalled();
  } finally {
    mounted.unmount(); command.mockRestore(); overlayState.dispose(); selection.dispose(); models.dispose(); vi.useRealTimers();
  }
});


it("rebinds parent-stack timers and hover listeners to a replacement Studio owner", async () => {
  const contexts = await vi.importActual<typeof import("@/wab/client/contexts/StudioContexts")>("@/wab/client/contexts/StudioContexts");
  vi.mocked(useStudioCtx).mockImplementation(contexts.useStudioCtx);
  vi.useFakeTimers();
  const models = new ModelSnapshots(), selection = new StudioSelection(() => models);
  const previous = new StudioOverlayState(), next = new StudioOverlayState();
  const studioFor = (overlayState: StudioOverlayState) => {
    const studio = mock<StudioCtx>();
    Object.defineProperties(studio, {
      overlayState: { value: overlayState }, selectionStore: { value: selection.store },
      setShowStackOfParents: { value: StudioCtx.prototype.setShowStackOfParents },
    });
    installContentScope(studio);
  studio.focusedViewCtx.mockReturnValue(undefined);
    return studio;
  };
  previous.stackOfParents = true; next.stackOfParents = true;
  const oldCommand = vi.spyOn(previous, "stackOfParents", "set"), nextCommand = vi.spyOn(next, "stackOfParents", "set");
  const tag = element(), hoverTagRef = { current: tag };
  const mounted = render(<contexts.StudioCtxContext.Provider value={studioFor(previous)}><StackOfParents hoverTagRef={hoverTagRef} /></contexts.StudioCtxContext.Provider>);
  try {
    mounted.rerender(<contexts.StudioCtxContext.Provider value={studioFor(next)}><StackOfParents hoverTagRef={hoverTagRef} /></contexts.StudioCtxContext.Provider>);
    oldCommand.mockClear(); nextCommand.mockClear();
    tag.dispatchEvent(new MouseEvent("mouseenter"));
    tag.dispatchEvent(new MouseEvent("mouseleave"));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(oldCommand).not.toHaveBeenCalled();
    expect(nextCommand).toHaveBeenCalledExactlyOnceWith(false);
  } finally {
    mounted.unmount(); oldCommand.mockRestore(); nextCommand.mockRestore(); previous.dispose(); next.dispose(); selection.dispose(); models.dispose(); vi.useRealTimers(); vi.mocked(useStudioCtx).mockReset();
  }
});

it("retires the existing hover outline without touching its runtime geometry again", () => {
  const field = element();
  const mounted = outline([field], field, true);
  expect(mounted.container.querySelector(".PreselectBox")).not.toBeNull();
  vi.mocked(computeScalerVisibility).mockClear();
  act(() => mounted.retire());
  expect(mounted.container.querySelector(".PreselectBox")).toBeNull();
  expect(computeScalerVisibility).not.toHaveBeenCalled();
});
