import { buildValTree } from "@/wab/__testonly__/tpls";
import {
  getSelectableLayers,
  selectAllInCanvas,
  selectMarquee,
} from "@/wab/client/components/canvas/marquee-selection";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { Selectable } from "@/wab/shared/core/selection";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValNode, ValTag, flattenVals } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { Box, Pt } from "@/wab/shared/geom";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

function setup(zoom = 1) {
  const first = mkTplTagX("div", {});
  const second = mkTplTagX("div", {});
  const rootTpl = mkTplTagX("div", {}, [first, second]);
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Page,
    tplTree: rootTpl,
  });
  const owner = buildValTree(
    mkTplComponent(component, ensure(component.variants[0], "Base variant")),
  );
  const root = ensureInstance(owner.contents?.[0], ValTag);
  const [firstVal, secondVal] = root.children;
  const valState = new ValState({ sysRoot: owner, globalRoot: undefined });
  const vc = mock<ViewCtx>();
  const elements = new Map<ValNode, HTMLElement>();
  const viewport = document.createElement("iframe");
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    new DOMRect(100, 200, 1000 * zoom, 1000 * zoom),
  );
  Object.assign(vc, {
    studioCtx: { zoom },
    canvasCtx: { viewport: () => viewport },
  });
  vc.valState.mockReturnValue(valState);
  vc.currentComponentCtx.mockReturnValue(null);
  const selected: (Selectable | null)[] = [];
  vc.focusedSelectables.mockImplementation(() => selected);
  vc.setStudioFocusBySelectable.mockImplementation((val) => {
    selected.splice(0, selected.length, ...(val ? [val] : []));
  });
  const viewOps = mock<ReturnType<ViewCtx["getViewOps"]>>();
  const tryFocusObj = viewOps.tryFocusObj;
  tryFocusObj.mockImplementation((val) => {
    selected.push(val);
  });
  viewOps.isRootNodeOfFrame.mockImplementation((tpl) => tpl === rootTpl);
  vc.getViewOps.mockReturnValue(viewOps);
  vc.change.mockImplementation((action) => {
    action();
    return Promise.resolve();
  });
  vc.sel2cloneKey.mockImplementation((val) =>
    val instanceof ValNode ? val.fullKey : undefined,
  );
  vc.selectionDom.mockImplementation((val) =>
    val instanceof ValNode && elements.has(val)
      ? $(ensure(elements.get(val), "Measured element"))
      : null,
  );
  function measure(val: ValNode, box: Box) {
    const element = document.createElement("div");
    Object.defineProperty(element, "offsetWidth", { value: box.width() });
    Object.defineProperty(element, "offsetHeight", { value: box.height() });
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(box.left(), box.top(), box.width(), box.height()),
    );
    elements.set(val, element);
    return element;
  }
  measure(root, new Box(0, 0, 1000, 1000));
  measure(firstVal, new Box(10, 10, 30, 30));
  measure(secondVal, new Box(10, 60, 30, 30));
  return {
    vc,
    first,
    second,
    root,
    firstVal,
    secondVal,
    owner,
    selected,
    tryFocusObj,
    measure,
    elements,
  };
}

it.each([0.5, 1, 2])(
  "selects fully enclosed siblings in either drag direction at zoom %s",
  (zoom) => {
    const { vc, firstVal, secondVal } = setup(zoom);
    const start = new Pt(100, 200);
    const end = new Pt(100 + 100 * zoom, 200 + 50 * zoom);
    expect(getSelectableLayers(vc, Box.spanning(start, end))).toEqual([
      firstVal,
      secondVal,
    ]);
    expect(getSelectableLayers(vc, Box.spanning(end, start))).toEqual([
      firstVal,
      secondVal,
    ]);
  },
);

it("excludes partially enclosed, locked, hidden and nonselectable nodes", () => {
  const { vc, first, firstVal, secondVal, elements } = setup();
  const box = new Box(200, 100, 100, 50);
  first.locked = true;
  expect(getSelectableLayers(vc, box)).toEqual([secondVal]);
  first.locked = false;
  elements.get(firstVal)?.style.setProperty("visibility", "hidden");
  expect(getSelectableLayers(vc, box)).toEqual([secondVal]);
  elements.get(firstVal)?.style.removeProperty("visibility");
  elements.get(firstVal)?.setAttribute("data-nonselectable", "true");
  expect(getSelectableLayers(vc, box)).toEqual([secondVal]);
  expect(getSelectableLayers(vc, new Box(200, 100, 80, 50))).toEqual([]);
});

it("selects a container without also selecting its children", () => {
  const { vc, root, firstVal, secondVal, measure } = setup();
  // The page root remains excluded, even if the entire artboard is enclosed.
  expect(getSelectableLayers(vc, new Box(200, 100, 1000, 1000))).toEqual([
    firstVal,
    secondVal,
  ]);
  const childTpl = mkTplTagX("span", {});
  const parent = ensureInstance(firstVal, ValTag);
  const child = new ValTag({
    tpl: childTpl,
    key: "child",
    fullKey: "child",
    frameUid: 1,
    fibers: [],
    parent,
    valOwner: parent.valOwner,
    slotInfo: undefined,
    className: "",
    children: [],
  });
  childTpl.parent = parent.tpl;
  parent.tpl.children.push(childTpl);
  parent.children.push(child);
  measure(child, new Box(15, 15, 10, 10));
  expect(getSelectableLayers(vc, new Box(200, 100, 100, 50))).toEqual([
    firstVal,
    secondVal,
  ]);
  expect(getSelectableLayers(vc, new Box(214, 114, 12, 12))).toEqual([child]);
  expect(root.children).toContain(parent);
});

it("replaces selection and Shift appends without toggling selected nodes off", () => {
  const { vc, firstVal, secondVal, selected, tryFocusObj } = setup();
  selected.push(firstVal);
  selectMarquee(vc, new Box(200, 100, 100, 50), true);
  expect(selected).toEqual([firstVal, secondVal]);
  expect(tryFocusObj).toHaveBeenCalledTimes(1);
  selectMarquee(vc, new Box(200, 150, 50, 50), false);
  expect(selected).toEqual([secondVal]);
  selectMarquee(vc, new Box(200, 200, 20, 20), false);
  expect(selected).toEqual([]);
});

it("ignores nodes outside the artboard viewport", () => {
  const { vc, firstVal, secondVal, measure } = setup();
  measure(firstVal, new Box(1100, 10, 30, 30));
  expect(getSelectableLayers(vc, new Box(200, 100, 2000, 2000))).toEqual([
    secondVal,
  ]);
});

it("selects all layers in the current editing scope, including outside the viewport", () => {
  const { vc, first, firstVal, secondVal, selected, measure } = setup();
  measure(secondVal, new Box(1100, 10, 30, 30));
  const studioCtx = mock<StudioCtx>();
  Object.defineProperty(studioCtx, "canvasContentEditor", { value: undefined });
  studioCtx.focusedFrames.mockReturnValue([]);
  studioCtx.focusedViewCtx.mockReturnValue(vc);
  selectAllInCanvas(studioCtx);
  expect(selected).toEqual([firstVal, secondVal]);
  first.locked = true;
  selectAllInCanvas(studioCtx);
  expect(selected).toEqual([secondVal]);
  expect(studioCtx.setStudioFocusOnFrames).not.toHaveBeenCalled();
});

it("treats component instances as a single selectable boundary", () => {
  const { vc, owner, root, measure } = setup();
  const innerTpl = mkTplTagX("div", {}, mkTplTagX("span", {}));
  const inner = mkComponent({
    name: "Card",
    type: ComponentType.Plain,
    tplTree: innerTpl,
  });
  const tpl = mkTplComponent(inner, ensure(inner.variants[0], "Base variant"));
  const instance = buildValTree(tpl);
  // Include the instance in the page's current editing context.
  Object.assign(instance, { parent: root, valOwner: owner });
  tpl.parent = root.tpl;
  root.tpl.children.push(tpl);
  root.children.push(instance);
  for (const val of flattenVals(instance)) {
    measure(val, new Box(60, 10, 30, 30));
  }
  expect(getSelectableLayers(vc, new Box(250, 100, 100, 50))).toEqual([
    instance,
  ]);
});

it("encloses a clipped layer by its visible part", () => {
  const { vc, firstVal, measure } = setup();
  // Runs past the bottom of the artboard viewport (jsdom: 1024×768).
  measure(firstVal, new Box(700, 10, 30, 400));
  // The marquee covers what is visible (y 700–768) but not the real box.
  expect(getSelectableLayers(vc, new Box(890, 100, 100, 100))).toEqual([
    firstVal,
  ]);
  // Nothing visible left: the layer can't be picked by a marquee.
  measure(firstVal, new Box(800, 10, 30, 30));
  expect(getSelectableLayers(vc, new Box(890, 100, 100, 200))).toEqual([]);
});
