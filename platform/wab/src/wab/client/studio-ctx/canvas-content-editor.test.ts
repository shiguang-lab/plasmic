import {
  CanvasContentEditor,
  getContentEditorTarget,
  isolateContentElement,
} from "@/wab/client/studio-ctx/canvas-content-editor";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { observable } from "mobx";
import { vi } from "vitest";

function fixture(registered = true) {
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
  document.body.append(element);
  const path = observable.box([{ node: child }, { node: tpl }], {
    deep: false,
  });
  const mode = observable({ interactive: false });
  const val = { fullKey: "owner[1]", tpl };
  const arena = {};
  const vc = {
    canvasExporting: observable.box(false),
    studioCtx: {
      get isInteractiveMode() {
        return mode.interactive;
      },
      isLiveMode: false,
      currentArena: arena,
      focusedViewCtx: () => vc,
      getCurrentStudioViewportSnapshot: vi.fn(() => ({ scale: 0.75 })),
      restoreStudioViewportSnapshot: vi.fn(),
      viewportCtx: {},
      viewCtxs: [] as unknown[],
    },
    focusedDomElts: () => [{ toArray: () => [selected] }],
    focusedTplAncestorsThroughComponents: () => path.get(),
    getCodeComponentMeta: () => ({ canvasContentEditor: registered }),
    maybeTpl2ValsInContext: () => [val],
    eltFinder: () => [element],
    scheduleSync: vi.fn(),
    awaitSync: vi.fn(async () => {}),
  } as unknown as ViewCtx;
  Object.assign(vc, { contentEditor: new CanvasContentEditor(vc) });
  vc.studioCtx.viewCtxs.push(vc);
  return { vc, tpl, child, outside, element, path, mode };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

test("resolves a supported parent by capability, independently of component name", () => {
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
    document.head.querySelector("[data-plasmic-editor-style]")?.textContent,
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
  const saved = JSON.stringify(tpl.vsettings);
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target?.tpl).toBe(tpl);
  expect(vc.contentEditor.size.get()).toEqual({ width: 64, height: 96 });
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
  expect(JSON.stringify(tpl.vsettings)).toBe(saved);
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

test("ignores a component's editor stylesheet when resolving its content root", () => {
  const { vc, element } = fixture();
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
  const { vc, tpl, element } = fixture();
  const other = document.createElement("div");
  document.body.append(other);
  const selected = observable.box(element, { deep: false });
  const values = [
    { fullKey: "owner[1]", tpl },
    { fullKey: "owner[2]", tpl },
  ];
  vi.spyOn(vc, "maybeTpl2ValsInContext").mockReturnValue(values as never);
  vi.spyOn(vc, "eltFinder").mockImplementation((val) =>
    val.fullKey === "owner[1]" ? [element] : [other],
  );
  vi.spyOn(vc, "focusedDomElts").mockImplementation(
    () => [{ toArray: () => [selected.get()] }] as never,
  );
  await vc.contentEditor.enter();
  expect(vc.contentEditor.target?.fullKey).toBe("owner[1]");
  selected.set(other);
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
  const leaf = innerElement.appendChild(document.createElement("span"));
  outer.element.append(innerElement);
  const outerVal = { tpl: outer.tpl, fullKey: "owner[1]" };
  const innerVal = { tpl: innerTpl, fullKey: "owner[1].inner[0]" };
  vi.spyOn(outer.vc, "maybeTpl2ValsInContext").mockImplementation(
    (tpl) => (tpl === innerTpl ? [innerVal] : [outerVal]) as never,
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
