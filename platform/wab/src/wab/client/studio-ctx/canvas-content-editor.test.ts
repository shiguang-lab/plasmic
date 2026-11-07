import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { cloneDeep } from "lodash";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { StudioCtx as ActualStudioCtx, type ModelCommit } from "@/wab/client/studio-ctx/StudioCtx";
import { CanvasFrameInfoOwner } from "@/wab/client/components/canvas/canvas-frame-info";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { Arg, RenderExpr, type ObjInst, type TplNode, isKnownTplComponent, isKnownRenderExpr } from "@/wab/shared/model/classes";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { mock } from "vitest-mock-extended";
import $ from "jquery";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewCtx as ActualViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { waitFor } from "@testing-library/react";
import { ensure } from "@/wab/shared/common";
import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { StudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { createStudioModeFixture } from "@/wab/client/__testonly__/studio-mode";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { createStore } from "zustand/vanilla";
import {
  CanvasContentEditor,
  CanvasContentEditorIndex,
  findClippedContent,
  getContentEditorTarget,
  isolateContentElement,
} from "@/wab/client/studio-ctx/canvas-content-editor";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { vi } from "vitest";

const editors: CanvasContentEditor[] = [];
const disposeSources: (() => void)[] = [];

function fixture(clipped = true) {
  const tpl = mkTplComponent(
    mkCodeComponent(
      "CustomViewport",
      { name: "CustomViewport", importPath: "test", props: {} },
      {},
    ),
    mkBaseVariant(),
  );
  const child = mkTplTagX("span");
  const outside = mkTplTagX("div");
  const element = document.createElement("div");
  const selected = element.appendChild(document.createElement("span"));
  if (clipped) {
    element.style.overflowY = "auto";
    Object.defineProperties(element, {
      clientHeight: { value: 200 },
      scrollHeight: { value: 600 },
    });
  }
  document.body.append(element);
  const val = { fullKey: "owner[1]", tpl };
  const childVal = { fullKey: "owner[1].child", tpl: child };
  const site = createSite();
  const arena = mkMixedArena("Editing");
  const otherArena = mkMixedArena("Other");
  site.arenas.push(arena, otherArena);
  const frame = mkArenaFrame({ site, component: tpl.component, name: "Editing", width: 800, height: 600 });
  arena.children.push(frame); site.components.push(tpl.component);
  const models = new ModelSnapshots();
  const commits = new Set<(event: ModelCommit) => void>();
  const variants = new ViewVariantState(() => models, () => frame, () => site, () => false, () => false);
  disposeSources.push(() => variants.dispose());
  const arenaState = new StudioArenaState({ site, modelSnapshots: models });
  arenaState.setCurrent(arena);
  const selection = new ViewSelection(() => models);
  const focused = new StudioSelection(() => models);
  const studioMode = createStudioModeFixture();
  const renderPolicy = new StudioRenderPolicy({
    isLive: () => studioMode.previewOwnerStore.getState()?.store.getState().isLive ?? false,
    isDragging: () => false,
  });
  const mode = {
    get interactive() { return renderPolicy.interactive; },
    set interactive(value: boolean) { renderPolicy.interactive = value; renderPolicy.prepareInputs(); renderPolicy.publishCommit(); },
  };
  disposeSources.push(() => renderPolicy.dispose());
  const canvasSessionState = new CanvasSessionState();
  const canvasRenderOwner = new CanvasRenderOwner(canvasSessionState);
  const views: ViewCtx[] = [];
  const contentEditors = new CanvasContentEditorIndex(() => views);
  disposeSources.push(() => { canvasRenderOwner.dispose(); canvasSessionState.dispose(); contentEditors.dispose(); });
  const renderStatusStore = createStore(() => ({ renderCount: 0, isFirstRenderComplete: false }));
  disposeSources.push(() => { selection.dispose(); focused.dispose(); arenaState.dispose(); models.dispose(); });
  const frameState = globalHookCtx.createFrameState({ uid: frame.uid, objectPrototype: Object.prototype });
  disposeSources.push(() => frameState.dispose());
  const overlayState = new StudioOverlayState();
  disposeSources.push(() => overlayState.dispose());
  const vc = {
    _canvasExporting: false,
    site, arenaFrame: () => frame,
    selection, variants, variantStore: variants.store,
    frameState,
    canvasRenderOwner,
    selectionStore: selection.store,
    csEvaluator: { renderStatusStore },
    studioCtx: {
      ...studioMode,
      renderPolicy, site, overlayState,
      pendingArenaViewDisposals: new Set(),
      draggingObjectStore: createStore(() => false),
      hasPendingModelChanges: () => false,
      subscribeModelChanges: (listener: (event: ModelCommit) => void) => { commits.add(listener); return () => { commits.delete(listener); }; },
      modelSnapshots: models,
      activeContentEditorStore: contentEditors.store,
      withContentEditorPublication: <Result>(command: () => Result): Result => contentEditors.deferPublication(command),
      publishContentEditorInputs: (publish: () => void) => contentEditors.queue(publish),
      selectionStore: focused.store,
      arenaState,
      get isInteractiveMode() {
        return mode.interactive;
      },
      get isLiveMode() { return studioMode.previewOwnerStore.getState()?.store.getState().isLive; },
      get currentArena() { return arenaState.currentArena(); },
      focusedViewCtx: () => focused.current().view,
      getCurrentStudioViewportSnapshot: vi.fn(() => ({ scale: 0.75 })),
      restoreStudioViewportSnapshot: vi.fn(),
      viewportCtx: { zoomToScalerBox: vi.fn() },
      canvasZoomPadding: () => ({ left: 20, right: 20, top: 20, bottom: 20 }),
      viewCtxs: views,
    },
    focusedDomElts: () => selection.doms(),
    focusedTplAncestorsThroughComponents: ActualViewCtx.prototype.focusedTplAncestorsThroughComponents,
    maybeTpl2ValsInContext: (node: unknown) => node === tpl ? [val] : node === child ? [childVal] : [],
    eltFinder: (node: { tpl: unknown }) => node.tpl === child ? [selected] : [element],
    canvasCtx: {
      viewportContainerOffset: () => ({ left: 0, top: 0 }),
      frameInfo: () => frameInfo.store,
      prepareFrameInfo: () => frameInfo.prepare(),
    },
    scheduleSync: vi.fn(),
    setViewCtxHoverBySelectable: vi.fn(),
    setMeasureToolDomElt: vi.fn(),
    awaitSync: vi.fn(async () => {}),
  } as unknown as ViewCtx;
  Object.setPrototypeOf(vc, ActualViewCtx.prototype);
  Object.setPrototypeOf(vc.studioCtx, ActualStudioCtx.prototype);
  focused.set(vc, []);
  Object.assign(vc, { contentEditor: new CanvasContentEditor(vc) });
  const frameInfo = new CanvasFrameInfoOwner(vc);
  disposeSources.unshift(() => frameInfo.dispose());
  selection.setDoms([$(selected)]);
  const path = {
    get: () => vc.focusedTplAncestorsThroughComponents(),
    set: (nodes: readonly { node: TplNode }[]) => {
      const changes: ModelChange[] = [];
      const changed = (inst: ObjInst, field: string, oldValue: unknown) => {
        changes.push({ type: "update", changeNode: { inst, field }, oldValue, newValue: Reflect.get(inst, field) });
      };
      selection.deferPublication(() => {
        for (let index = 1; index < nodes.length; index++) {
          const inner = nodes[index - 1].node, outer = nodes[index].node;
          if (inner.parent !== outer) { const old = inner.parent; inner.parent = outer; changed(inner, "parent", old); }
          if (isKnownTplComponent(outer)) {
            let param = outer.component.params.find((candidate) => candidate.variable.name === "children");
            if (!param) {
              param = mkParam({ name: "children", type: typeFactory.renderable(), paramType: "slot" });
              const old = outer.component.params.slice(); outer.component.params.push(param); changed(outer.component, "params", old);
            }
            const setting = outer.vsettings[0];
            const arg = setting.args.find((candidate) => candidate.param === param);
            if (!arg || !isKnownRenderExpr(arg.expr) || !arg.expr.tpl.includes(inner)) {
              const old = setting.args.slice();
              const expr = new RenderExpr({ tpl: [inner] });
              setting.args = [...setting.args.filter((candidate) => candidate.param !== param), new Arg({ param, expr })];
              changed(setting, "args", old);
            }
          }
        }
        selection.setTpls(nodes.length ? [nodes[0].node] : []);
        models.sync(changes, () => {
          const summary = mock<ChangeSummary>(); summary.changes = changes;
          commits.forEach((listener) => listener({ type: "commit", summary }));
        });
      });
    },
  };
  path.set([{ node: child }, { node: tpl }]);
  views.push(vc);
  editors.push(vc.contentEditor);
  return { vc, tpl, child, outside, element, path, mode, arenaState, arena, otherArena, selection, focused, renderStatusStore, studioMode, contentEditors, models };
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.exit(false));
  disposeSources.splice(0).forEach((dispose) => dispose());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

test("automatically detects a clipped component without registration flags, independently of its name", () => {
  const { vc, tpl } = fixture();
  expect(getContentEditorTarget(vc)?.tpl).toBe(tpl);
  expect(getContentEditorTarget(vc)?.fullKey).toBe("owner[1]");
  const unsupported = fixture(false);
  expect(getContentEditorTarget(unsupported.vc)).toBeUndefined();
});

test("finds actual clipped native containers without assuming every code component can expand", () => {
  const { vc, element } = fixture(false);
  const native = mkTplTagX("div");
  vi.spyOn(vc, "focusedTplAncestorsThroughComponents").mockReturnValue([
    { node: native },
  ] as never);
  vi.spyOn(vc, "maybeTpl2ValsInContext").mockReturnValue([{ tpl: native, fullKey: "native" }] as never);
  element.style.overflowY = "auto";
  Object.defineProperties(element, {
    scrollHeight: { value: 600 },
    clientHeight: { value: 200 },
  });
  expect(getContentEditorTarget(vc)?.tpl).toBe(native);
});

test("isolation preserves DOM ownership and live inline edits, and cleans every temporary marker", () => {
  const { element } = fixture();
  element.style.color = "red";
  const parent = element.parentElement;
  const undo = isolateContentElement(element, 320);
  expect(element.parentElement).toBe(parent);
  expect(element.hasAttribute("data-plasmic-content-target")).toBe(true);
  expect(
    document.head.querySelector(
      "[data-plasmic-editor-style][data-plasmic-content-editor-style]",
    )?.textContent,
  ).toContain("min-width: 320px");
  element.style.color = "blue";
  undo();
  expect(element.style.color).toBe("blue");
  expect(
    document.querySelector(
      "[data-plasmic-content-target], [data-plasmic-content-ancestor], [data-plasmic-content-editor]",
    ),
  ).toBeNull();
  expect(document.head.querySelector("[data-plasmic-editor-style]")).toBeNull();
});

test("blank/internal selection stays in scope; outside selection exits and restores the camera without writing props", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const { vc, tpl, child, outside, path, element } = fixture();
  const saved = cloneDeep(tpl.vsettings);
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target?.tpl).toBe(tpl);
  expect(vc.contentEditor.size).toEqual({ width: 64, height: 696 });
  path.set([]);
  expect(vc.contentEditor.target).toBeDefined();
  path.set([{ node: child }, { node: tpl }]);
  expect(vc.contentEditor.target).toBeDefined();
  path.set([{ node: outside }]);
  expect(vc.contentEditor.target).toBeUndefined();
  expect(element.hasAttribute("data-plasmic-content-target")).toBe(false);
  expect(vc.studioCtx.restoreStudioViewportSnapshot).toHaveBeenCalledWith(
    { scale: 0.75 },
    false,
  );
  expect(tpl.vsettings).toEqual(saved);
});

test("preview/export stops editing and cannot expose the content editing capability", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const { vc, mode } = fixture();
  await vc.contentEditor.enter();
  mode.interactive = true;
  expect(vc.contentEditor.target).toBeUndefined();
  expect(getContentEditorTarget(vc)).toBeUndefined();
  expect(vc.studioCtx.restoreStudioViewportSnapshot).toHaveBeenCalledWith(
    { scale: 0.75 },
    false,
  );
});

test("entry keeps the component mounted and reveals it only after layout and camera preparation", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
  const { vc, element } = fixture();
  const parent = element.parentElement;
  await vc.contentEditor.enter();
  expect(vc.contentEditor.ready).toBe(false);
  expect(element.parentElement).toBe(parent);
  expect(vc.setViewCtxHoverBySelectable).toHaveBeenCalledWith(null);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  expect(vc.contentEditor.ready).toBe(true);
  vc.contentEditor.exit();
  expect(vc.contentEditor.ready).toBe(false);
  expect(element.parentElement).toBe(parent);
});

test("ignores a component's editor stylesheet when resolving its content root", () => {
  const { vc, element, tpl } = fixture();
  vi.spyOn(vc, "focusedTplAncestorsThroughComponents").mockReturnValue([{ node: tpl, layer: 0 }]);
  const style = document.createElement("style");
  vi.spyOn(vc, "eltFinder").mockReturnValue([style, element]);
  vi.spyOn(vc, "focusedDomElts").mockReturnValue([
    { toArray: () => [style, element] },
  ] as never);
  expect(getContentEditorTarget(vc)?.element).toBe(element);
});

test("a selection change while evaluation is pending cancels entry before isolating DOM", async () => {
  const { vc, path, outside, element } = fixture();
  let finish: () => void = () => undefined;
  vi.spyOn(vc, "awaitSync").mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const entered = vc.contentEditor.enter();
  path.set([{ node: outside }]);
  finish();
  await entered;
  expect(vc.contentEditor.target).toBeUndefined();
  expect(element.hasAttribute("data-plasmic-content-target")).toBe(false);
});

test("selecting a different repeated instance exits the previous instance's scope", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const { vc, tpl, element, selection } = fixture();
  const other = document.createElement("div");
  document.body.append(other);
  selection.setDoms([$(element)]);
  const values = [
    { fullKey: "owner[1]", tpl },
    { fullKey: "owner[2]", tpl },
  ];
  vi.spyOn(vc, "maybeTpl2ValsInContext").mockImplementation((node) => (node === tpl ? values : []) as never);
  vi.spyOn(vc, "eltFinder").mockImplementation((val) =>
    val.fullKey === "owner[1]" ? [element] : [other],
  );
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target?.fullKey).toBe("owner[1]");
  selection.setDoms([$(other)]);
  expect(vc.contentEditor.target).toBeUndefined();
});

function nestedFixture() {
  const outer = fixture();
  const innerTpl = mkTplComponent(
    mkCodeComponent(
      "NestedViewport",
      { name: "NestedViewport", importPath: "test", props: {} },
      {},
    ),
    mkBaseVariant(),
  );
  const innerElement = document.createElement("div");
  innerElement.style.overflowY = "auto";
  Object.defineProperties(innerElement, {
    clientHeight: { value: 100 },
    scrollHeight: { value: 300 },
  });
  const leaf = innerElement.appendChild(document.createElement("span"));
  outer.element.append(innerElement);
  const outerVal = { tpl: outer.tpl, fullKey: "owner[1]" };
  const innerVal = { tpl: innerTpl, fullKey: "owner[1].inner[0]" };
  vi.spyOn(outer.vc, "maybeTpl2ValsInContext").mockImplementation(
    (tpl) => (tpl === innerTpl ? [innerVal] : tpl === outer.tpl ? [outerVal] : []) as never,
  );
  vi.spyOn(outer.vc, "eltFinder").mockImplementation((val) =>
    val.fullKey === innerVal.fullKey ? [innerElement] : [outer.element],
  );
  vi.spyOn(outer.vc, "focusedDomElts").mockReturnValue([
    { toArray: () => [leaf] },
  ] as never);
  outer.path.set([
    { node: outer.child },
    { node: innerTpl },
    { node: outer.tpl },
  ]);
  const outerTarget = {
    tpl: outer.tpl,
    fullKey: outerVal.fullKey,
    element: outer.element,
  };
  return { ...outer, innerTpl, innerElement, innerVal, outerTarget };
}

test("nested selection keeps the current scope until explicit entry, then exits directly to the original page", async () => {
  const {
    vc,
    innerTpl,
    innerElement,
    innerVal,
    outerTarget,
    element,
    path,
    outside,
  } = nestedFixture();
  await vc.contentEditor.enter(outerTarget);
  expect(getContentEditorTarget(vc)?.tpl).toBe(innerTpl);
  expect(vc.contentEditor.target?.tpl).toBe(outerTarget.tpl);
  const savedPage = { scale: 0.75 };
  vi.mocked(vc.studioCtx.getCurrentStudioViewportSnapshot).mockReturnValue({
    scale: 0.25,
  } as never);
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target?.tpl).toBe(innerTpl);
  expect(vc.studioCtx.getCurrentStudioViewportSnapshot).toHaveBeenCalledOnce();
  expect(vc.studioCtx.restoreStudioViewportSnapshot).not.toHaveBeenCalled();
  expect(element.hasAttribute("data-plasmic-content-target")).toBe(false);
  expect(innerElement.hasAttribute("data-plasmic-content-target")).toBe(true);
  expect(
    document.head.querySelectorAll("[data-plasmic-editor-style]"),
  ).toHaveLength(1);
  // Keep virtualized ancestors materialized while only the inner target is isolated.
  expect(vc.contentEditor.isExpanded(outerTarget.fullKey)).toBe(true);
  expect(vc.contentEditor.isExpanded(innerVal.fullKey)).toBe(true);
  path.set([{ node: outside }]);
  expect(vc.contentEditor.target).toBeUndefined();
  expect(vc.contentEditor.isExpanded(outerTarget.fullKey)).toBe(false);
  expect(vc.contentEditor.isExpanded(innerVal.fullKey)).toBe(false);
  expect(vc.studioCtx.restoreStudioViewportSnapshot).toHaveBeenCalledOnce();
  expect(vc.studioCtx.restoreStudioViewportSnapshot).toHaveBeenCalledWith(
    savedPage,
    false,
  );
  expect(
    document.querySelector(
      "[data-plasmic-content-editor], [data-plasmic-content-target], [data-plasmic-content-ancestor]",
    ),
  ).toBeNull();
});

test("direct inner entry materializes required ancestors but exposes only the inner editing target", async () => {
  const { vc, innerTpl, outerTarget } = nestedFixture();
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target?.tpl).toBe(innerTpl);
  expect(vc.contentEditor.isExpanded(outerTarget.fullKey)).toBe(true);
  vc.contentEditor.exit();
  expect(vc.studioCtx.restoreStudioViewportSnapshot).toHaveBeenCalledOnce();
  expect(vc.contentEditor.target).toBeUndefined();
});

test("reentering the same target preserves the original session and its stylesheet", async () => {
  const { vc } = fixture();
  await vc.contentEditor.enter();
  await vc.contentEditor.enter();
  expect(vc.studioCtx.getCurrentStudioViewportSnapshot).toHaveBeenCalledOnce();
  expect(
    document.head.querySelectorAll("[data-plasmic-editor-style]"),
  ).toHaveLength(1);
  vc.contentEditor.exit();
});

function clippedBox(horizontal = false) {
  const element = document.createElement("div");
  element.style.overflow = "auto";
  Object.defineProperties(element, {
    clientWidth: { value: 200 },
    scrollWidth: { value: horizontal ? 600 : 200 },
    clientHeight: { value: 200 },
    scrollHeight: { value: horizontal ? 200 : 600 },
  });
  return element;
}

test("stops entry detection at the first clipped region but enumerates all regions for editing", () => {
  const { vc, tpl, element } = fixture();
  const nested = clippedBox(true);
  element.append(nested);
  const computedStyle = vi.spyOn(window, "getComputedStyle");
  expect(getContentEditorTarget(vc)?.tpl).toBe(tpl);
  expect(computedStyle.mock.calls.some(([node]) => node === nested)).toBe(false);
  expect(findClippedContent(element).map((region) => region.element)).toEqual([
    element,
    nested,
  ]);
  expect(computedStyle.mock.calls.some(([node]) => node === nested)).toBe(true);
});

test("automatically detects an AppShell-style internal viewport without a model node or metadata flag", () => {
  const { vc, element } = fixture(false);
  const viewport = clippedBox();
  const selected = viewport.appendChild(document.createElement("span"));
  element.append(viewport);
  vi.spyOn(vc, "focusedDomElts").mockReturnValue([
    { toArray: () => [selected] },
  ] as never);
  expect(getContentEditorTarget(vc)?.element).toBe(element);
  expect(findClippedContent(element).map((region) => region.element)).toEqual([
    viewport,
  ]);
  const undo = isolateContentElement(element, 320);
  expect(viewport.hasAttribute("data-plasmic-content-expand-y")).toBe(true);
  expect(viewport.hasAttribute("data-plasmic-content-expand-x")).toBe(false);
  undo();
  expect(viewport.style.overflow).toBe("auto");
  expect(document.querySelector("[data-plasmic-content-expand-y]")).toBeNull();
});

test("detects horizontal internal clipping and excludes clipping owned by a nested design node", () => {
  const root = document.createElement("div");
  const internal = root.appendChild(clippedBox(true));
  const nested = root.appendChild(document.createElement("section"));
  nested.appendChild(clippedBox());
  expect(findClippedContent(root, new Set([nested]))).toEqual([
    { element: internal, horizontal: true, vertical: false },
  ]);
  expect(findClippedContent(nested)).toHaveLength(1);
});

test("fully visible content and text ellipsis do not create a scroll-container editing entry", () => {
  const { vc, element } = fixture(false);
  expect(getContentEditorTarget(vc)).toBeUndefined();
  const text = clippedBox(true);
  text.style.textOverflow = "ellipsis";
  element.append(text);
  expect(findClippedContent(element)).toEqual([]);
});

test.each([
  { parentClips: false, tableClipsX: false, tableClipsY: false, owner: undefined },
  { parentClips: true, tableClipsX: false, tableClipsY: false, owner: "parent" },
  { parentClips: false, tableClipsX: true, tableClipsY: false, owner: "table" },
  { parentClips: true, tableClipsX: true, tableClipsY: false, owner: "table" },
  { parentClips: false, tableClipsX: false, tableClipsY: true, owner: "table" },
  { parentClips: true, tableClipsX: false, tableClipsY: true, owner: "table" },
])("resolves the actual clipping owner: $owner ($parentClips, $tableClipsX, $tableClipsY)", ({ parentClips, tableClipsX, tableClipsY, owner }) => {
  const { vc, tpl: table, child, element, path } = fixture(false);
  const parent = mkTplTagX("div", {}, [table]);
  const parentElement = document.createElement("div");
  parentElement.style.overflow = "auto";
  Object.defineProperties(parentElement, {
    clientWidth: { value: 400 },
    scrollWidth: { value: 400 },
    clientHeight: { value: parentClips ? 200 : 600 },
    scrollHeight: { value: 600 },
  });
  document.body.append(parentElement);
  parentElement.append(element);
  // The table's rows can exceed the parent's viewport while fitting the table
  // itself. Its internal viewport need not correspond to a design node.
  const viewport = document.createElement("div");
  viewport.style.overflow = "auto";
  Object.defineProperties(viewport, {
    clientWidth: { value: 400 },
    scrollWidth: { value: tableClipsX ? 800 : 400 },
    clientHeight: { value: tableClipsY ? 200 : 600 },
    scrollHeight: { value: 600 },
  });
  const selected = element.firstElementChild;
  element.append(viewport);
  if (selected) {
    viewport.append(selected);
  }
  const values = [
    { tpl: parent, fullKey: "parent" },
    { tpl: table, fullKey: "table" },
    { tpl: child, fullKey: "column" },
  ];
  vi.spyOn(vc, "maybeTpl2ValsInContext").mockImplementation(
    (node) => values.filter((val) => val.tpl === node) as never,
  );
  vi.spyOn(vc, "eltFinder").mockImplementation((val) =>
    val.tpl === parent ? [parentElement] : val.tpl === table ? [element] : selected ? [selected as HTMLElement] : [],
  );
  path.set([{ node: child }, { node: table }, { node: parent }] as never);
  expect(getContentEditorTarget(vc)?.fullKey).toBe(owner);

  // Selecting the table follows the same rule as selecting a column.
  path.set([{ node: table }, { node: parent }] as never);
  vi.spyOn(vc, "focusedDomElts").mockReturnValue([
    { toArray: () => [element] },
  ] as never);
  expect(getContentEditorTarget(vc)?.fullKey).toBe(owner);

  // An ancestor must not claim a descendant's internal clipping as its own.
  path.set([{ node: parent }] as never);
  vi.mocked(vc.focusedDomElts).mockReturnValue([
    { toArray: () => [parentElement] },
  ] as never);
  expect(getContentEditorTarget(vc)?.fullKey).toBe(parentClips ? "parent" : undefined);
});


test("native arena changes exit before traversing the old target and detach every native subscription", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
  const { vc, arenaState, otherArena, selection, outside, focused, renderStatusStore } = fixture();
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target).toBeDefined();
  const ancestry = vi.spyOn(vc, "focusedTplAncestorsThroughComponents").mockImplementation(() => {
    throw new Error("The departed arena target must not be traversed");
  });
  expect(() => arenaState.setCurrent(otherArena)).not.toThrow();
  expect(vc.contentEditor.target).toBeUndefined();
  expect(ancestry).not.toHaveBeenCalled();
  expect(vc.studioCtx.restoreStudioViewportSnapshot).not.toHaveBeenCalled();
  const scheduled = vi.mocked(vc.scheduleSync).mock.calls.length;
  selection.setTpls([outside]);
  focused.clear();
  renderStatusStore.setState({ renderCount: 1, isFirstRenderComplete: true });
  expect(ancestry).not.toHaveBeenCalled();
  expect(vc.scheduleSync).toHaveBeenCalledTimes(scheduled);
});

test("native live mode leaves content editing without waiting for a model mutation", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
  const { vc, studioMode } = fixture();
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target).toBeDefined();
  const preview = studioMode.previewOwnerStore.getState();
  expect(preview).toBeDefined();
  preview?.store.setState({ isLive: true });
  expect(vc.contentEditor.target).toBeUndefined();
});

test("native selected tpl publication checks a changed path without a model mutation", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
  const { vc, tpl, child, outside, selection } = fixture();
  let currentPath = [{ node: child, layer: 0 }, { node: tpl, layer: 0 }];
  vi.spyOn(vc, "focusedTplAncestorsThroughComponents").mockImplementation(() => currentPath);
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target).toBeDefined();
  currentPath = [{ node: outside, layer: 0 }];
  selection.setTpls([outside]);
  expect(vc.contentEditor.target).toBeUndefined();
  expect(vc.studioCtx.restoreStudioViewportSnapshot).toHaveBeenCalledTimes(1);
});

test("committed runtime replacement checks the resolved target even when its model identity is unchanged", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
  const { vc, tpl, renderStatusStore } = fixture();
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target).toBeDefined();
  const replacement = new ValComponent({ tpl, fullKey: "owner[2]", key: "owner", frameUid: 0,
    fibers: [], parent: undefined, valOwner: undefined, className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map() });
  expect(replacement.tpl).toBe(tpl);
  vi.spyOn(vc, "maybeTpl2ValsInContext").mockReturnValue([replacement]);
  renderStatusStore.setState({ renderCount: 1, isFirstRenderComplete: true });
  expect(vc.contentEditor.target).toBeUndefined();
});


 test("installs one coherent native session and active command handle while preserving runtime target identity", async () => {
  const f = fixture();
  const target = getContentEditorTarget(f.vc);
  if (!target) { throw new Error("Editing target"); }
  const indexChanged = vi.fn(() => {
    expect(f.contentEditors.store.getState()).toBe(f.vc.contentEditor);
    expect(f.vc.contentEditor.target).toBe(target);
    expect(f.vc.contentEditor.store.getState().target?.fullKey).toBe(target.fullKey);
  });
  const off = f.contentEditors.store.subscribe(indexChanged);
  await f.vc.contentEditor.enter(target);
  try {
    expect(indexChanged).toHaveBeenCalledOnce();
    expect(f.vc.contentEditor.target).toBe(target);
    const snapshot = f.vc.contentEditor.store.getState();
    expect(f.models.resolve(ensure(snapshot.target, "Native editing target").tpl)).toBe(target.tpl);
    expect(snapshot.target?.element).toBe(target.element);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.target)).toBe(true);
    expect(Object.isFrozen(snapshot.size)).toBe(true);
    const changed = vi.fn(); const stop = f.vc.contentEditor.store.subscribe(changed);
    await f.vc.contentEditor.enter(target);
    expect(f.vc.contentEditor.store.getState()).toBe(snapshot);
    expect(changed).not.toHaveBeenCalled(); stop();
  } finally { off(); f.vc.contentEditor.exit(false); }
});

 test("retires queued DOM and animation deliveries before clearing the native session and sealing disposal", async () => {
  let resize: TestResizeObserver | undefined, mutation: TestMutationObserver | undefined;
  class TestResizeObserver implements ResizeObserver {
    constructor(readonly callback: ResizeObserverCallback) { resize = this; }
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  }
  class TestMutationObserver implements MutationObserver {
    constructor(readonly callback: MutationCallback) { mutation = this; }
    observe = vi.fn(); disconnect = vi.fn(); takeRecords = (): MutationRecord[] => [];
  }
  vi.stubGlobal("ResizeObserver", TestResizeObserver); vi.stubGlobal("MutationObserver", TestMutationObserver);
  const frames = new Map<number, FrameRequestCallback>(); let next = 0;
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.set(++next, callback); return next; });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  const f = fixture();
  await f.vc.contentEditor.enter();
  const runtime = ensure(f.vc.contentEditor.target, "Running target");
  const oldResize = resize, oldMutation = mutation;
  if (!oldResize || !oldMutation) { throw new Error("Mounted content observers"); }
  const queued = [...frames.values()];
  const changed = vi.fn(); const off = f.vc.contentEditor.store.subscribe(changed);
  f.vc.contentEditor.exit(false);
  expect(f.vc.contentEditor.target).toBeUndefined(); expect(f.vc.contentEditor.size).toBeUndefined();
  expect(f.contentEditors.store.getState()).toBeUndefined();
  expect(oldResize.disconnect).toHaveBeenCalledOnce(); expect(oldMutation.disconnect).toHaveBeenCalledOnce();
  changed.mockClear();
  oldResize.callback([], oldResize); oldMutation.callback([], oldMutation);
  queued.forEach((callback) => callback(performance.now()));
  expect(frames.size).toBe(0); expect(changed).not.toHaveBeenCalled(); expect(f.vc.contentEditor.ready).toBe(false);
  await f.vc.contentEditor.enter(runtime);
  const size = f.vc.contentEditor.size, scheduled = frames.size;
  changed.mockClear();
  oldResize.callback([], oldResize); oldMutation.callback([], oldMutation); queued.forEach((callback) => callback(performance.now()));
  expect(f.vc.contentEditor.size).toBe(size); expect(frames.size).toBe(scheduled); expect(changed).not.toHaveBeenCalled();
  f.vc.contentEditor.dispose(); f.vc.contentEditor.dispose();
  const read = vi.spyOn(f.vc, "focusedTplAncestorsThroughComponents"); read.mockClear();
  await expect(f.vc.contentEditor.enter()).rejects.toThrow("disposed content editor");
  expect(read).not.toHaveBeenCalled();
  off(); request.mockRestore(); cancel.mockRestore();
});


test("retargets a replaced DOM root without replacing the runtime command target or equal measured size", async () => {
  let notify: MutationCallback | undefined, mutation: MutationObserver | undefined;
  vi.stubGlobal("MutationObserver", class implements MutationObserver {
    constructor(callback: MutationCallback) { notify = callback; mutation = this; }
    observe = vi.fn(); disconnect = vi.fn(); takeRecords = (): MutationRecord[] => [];
  });
  const frames = new Map<number, FrameRequestCallback>(); let next = 0;
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.set(++next, callback); return next; });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  const f = fixture(); await f.vc.contentEditor.enter();
  const runtime = ensure(f.vc.contentEditor.target, "Running target"), previous = f.vc.contentEditor.store.getState();
  const replacement = document.createElement("div"), child = replacement.appendChild(document.createElement("span"));
  replacement.style.overflowY = "auto";
  Object.defineProperties(replacement, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  f.element.replaceWith(replacement);
  vi.spyOn(f.vc, "eltFinder").mockImplementation((value) => value.tpl === f.child ? [child] : [replacement]);
  ensure(notify, "Body mutation callback")([], ensure(mutation, "Body observer"));
  const delivered = next, callback = ensure(frames.get(delivered), "Replacement frame"); frames.delete(delivered); callback(performance.now());
  expect(f.vc.contentEditor.target).toBe(runtime);
  expect(runtime.element).toBe(replacement);
  expect(f.vc.contentEditor.store.getState().target).not.toBe(previous.target);
  expect(f.vc.contentEditor.store.getState().target?.element).toBe(replacement);
  expect(f.vc.contentEditor.store.getState().size).toBe(previous.size);
  f.vc.contentEditor.exit(false); request.mockRestore(); cancel.mockRestore();
});

test("actual Studio closes a pending session before its first interactive-policy subscriber", async () => {
  const schedule = vi.spyOn(ActualViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Session", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Session", width: 200, height: 100 });
  const otherArena = mkMixedArena("Other");
  site.arenas.push(mkMixedArena("Session", [frame]), otherArena);
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Session" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.viewportCtx = ensure(createViewportFixture().viewportCtx, "Actual session viewport");
  studio.observeComponents([component]);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Real content-editing view");
  const target = { tpl: ensureKnownTplTag(component.tplTree), fullKey: "pending", element: document.createElement("div") };
  document.body.append(target.element);
  vi.spyOn(view, "focusedTplAncestorsThroughComponents").mockReturnValue([]);
  let resume: () => void = () => undefined;
  const blocked = new Promise<void>((resolve) => { resume = resolve; });
  vi.spyOn(view, "awaitSync").mockReturnValue(blocked);
  let expectClosed = false;
  const inspect = vi.fn(() => {
    if (expectClosed) {
      expect(studio.activeContentEditorStore.getState()).toBeUndefined();
      expect(view.contentEditor.store.getState().target).toBeUndefined();
      expect(view.contentEditor.target).toBeUndefined();
    }
  });
  // Register the UI reader before the session's own policy listener could exist.
  const off = studio.renderPolicy.store.subscribe(inspect);
  const entry = view.contentEditor.enter(target);
  try {
    expect(studio.activeContentEditorStore.getState()).toBe(view.contentEditor);
    expect(view.contentEditor.target).toBe(target);
    const snapshot = view.contentEditor.store.getState(), changed = vi.fn();
    const stopState = view.contentEditor.store.subscribe(changed), stopIndex = studio.activeContentEditorStore.subscribe(changed);
    try {
      await expect(studio.changeUnsafe(() => {
        studio.switchToArena(otherArena); studio.arenaState.prepareCommit();
        throw new Error("failed editing-scope switch");
      })).rejects.toThrow("failed editing-scope switch");
      expect(view.contentEditor.target).toBe(target);
      expect(view.contentEditor.store.getState()).toBe(snapshot);
      expect(studio.activeContentEditorStore.getState()).toBe(view.contentEditor);
      expect(changed).not.toHaveBeenCalled();
    } finally { stopState(); stopIndex(); }
    expectClosed = true; studio.isInteractiveMode = true;
    expect(inspect).toHaveBeenCalledOnce();
    resume(); await entry;
    expect(target.element.hasAttribute("data-plasmic-content-target")).toBe(false);
  } finally { off(); resume(); await entry; studio.dispose(); schedule.mockRestore(); target.element.remove(); }
});


test("actual export command installs the flag and closes pending editing before the first frame subscriber without changing full-height geometry", async () => {
  const schedule = vi.spyOn(ActualViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Export session", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "Export session", width: 200, height: 100 });
  site.arenas.push(mkMixedArena("Export session", [frame]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Export%20session" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.viewportCtx = ensure(createViewportFixture().viewportCtx, "Actual export viewport");
  studio.observeComponents([component]);
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Actual export view");
  const frameInfo = new CanvasFrameInfoOwner(view);
  Object.assign(view.canvasCtx, { frameInfo: () => frameInfo.store, prepareFrameInfo: () => frameInfo.prepare() });
  const target = { tpl: ensureKnownTplTag(component.tplTree), fullKey: "pending-export", element: document.createElement("div") };
  document.body.append(target.element);
  vi.spyOn(view, "focusedTplAncestorsThroughComponents").mockReturnValue([]);
  let resume: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => { resume = resolve; });
  vi.spyOn(view, "awaitSync").mockReturnValue(pending);
  const initial = frameInfo.store.getState();
  const check = vi.fn(() => {
    expect(frameInfo.store.getState().exporting).toBe(view.canvasExporting);
    expect(frameInfo.store.getState().fullPageHeight).toBe(initial.fullPageHeight);
    expect(view.contentEditor.target).toBeUndefined();
    expect(studio.activeContentEditorStore.getState()).toBeUndefined();
  });
  const off = frameInfo.store.subscribe(check);
  const entered = view.contentEditor.enter(target);
  try {
    expect(view.contentEditor.target).toBe(target);
    view.setCanvasExporting(true);
    expect(check).toHaveBeenCalledOnce();
    expect(frameInfo.store.getState().exporting).toBe(true);
    view.setCanvasExporting(true); expect(check).toHaveBeenCalledOnce();
    view.setCanvasExporting(false); expect(check).toHaveBeenCalledTimes(2);
    resume(); await entered;
    expect(view.contentEditor.target).toBeUndefined();
    expect(target.element.hasAttribute("data-plasmic-content-target")).toBe(false);
  } finally { off(); resume(); await entered; frameInfo.dispose(); studio.dispose(); schedule.mockRestore(); target.element.remove(); }
});
