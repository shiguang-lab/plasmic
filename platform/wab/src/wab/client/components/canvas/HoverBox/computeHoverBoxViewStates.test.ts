import { computeHoverBoxViewState } from "@/wab/client/components/canvas/HoverBox/computeHoverBoxViewStates";
import { getSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValComponent, ValTextTag } from "@/wab/shared/core/val-nodes";
import { Box } from "@/wab/shared/geom";
import { Arg, RenderExpr } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import $ from "jquery";

vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", () => ({
  createNodeIcon: () => undefined,
}));
vi.mock("@/wab/client/utils/tpl-client-utils", () => ({
  summarizeFocusObj: () => "Content",
}));

afterEach(() => { document.body.innerHTML = ""; });

function element(box: Box, visible = true) {
  const elt = document.createElement("div");
  Object.defineProperty(elt, "offsetWidth", {
    value: visible ? box.width() : 0,
  });
  Object.defineProperty(elt, "offsetHeight", {
    value: visible ? box.height() : 0,
  });
  vi.spyOn(elt, "getBoundingClientRect").mockReturnValue(
    new DOMRect(box.left(), box.top(), box.width(), box.height()),
  );
  return elt;
}

function fixture() {
  const component = mkComponent({
    name: "Container",
    type: ComponentType.Plain,
    tplTree: mkTplTagX("div"),
  });
  const slot = mkParam({
    name: "children",
    paramType: "slot",
    type: typeFactory.renderable(),
  });
  component.params.push(slot);
  const focusObj = new SlotSelection({
    tpl: mkTplComponent(component, mkBaseVariant(), []),
    slotParam: slot,
  });
  const vc = {
    dom2focusObj: () => undefined,
    studioCtx: {
    },
    canvasCtx: { viewportContainerOffset: () => ({ left: 100, top: 200 }) },
  } as unknown as ViewCtx;
  return { vc, focusObj };
}

it("hides an already-selected background node while a modal is open", () => {
  const { vc, focusObj } = fixture();
  const background = document.body.appendChild(element(new Box(0, 0, 1000, 400)));
  const modal = document.body.appendChild(element(new Box(100, 100, 600, 300)));
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const target = { node: $(background), focusObj };
  expect(computeHoverBoxViewState(vc, target, false, false, undefined)).toEqual({ display: "none" });
  modal.style.visibility = "hidden";
  expect(computeHoverBoxViewState(vc, target, false, false, undefined).display).toBe("unset");
});

it("measures only foreground roots when a selected component also renders behind a modal", () => {
  const { vc, focusObj } = fixture();
  const background = document.body.appendChild(element(new Box(0, 0, 1000, 400)));
  const modal = document.body.appendChild(element(new Box(100, 100, 600, 300)));
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const result = computeHoverBoxViewState(vc, { node: $([background, modal]), focusObj }, false, false, undefined);
  expect(result.displayProps).toMatchObject({ top: 300, left: 200, width: 600, height: 300 });
  expect(result.focusedElt?.toArray()).toEqual([modal]);
});

it.each(["style", "hidden root"])(
  "shows the full visible selection when a %s precedes the content",
  (firstRoot) => {
    const { vc, focusObj } = fixture();
    const leading = firstRoot === "style"
      ? document.createElement("style")
      : element(new Box(0, 0, 1000, 1000), false);
    const node = $(
      [leading, element(new Box(20, 10, 30, 40)), element(new Box(80, 150, 40, 20))],
    );
    const result = computeHoverBoxViewState(vc, { node, focusObj }, false, false, undefined);
    expect(result.display).toBe("unset");
    expect(result.displayProps).toMatchObject({
      top: 220, left: 110, width: 180, height: 80,
    });
    expect(result.focusedElt).toBe(node);
    expect(getSelectionBounds([node])?.rect()).toEqual(
      new Box(20, 10, 180, 80).rect(),
    );
  },
);

it("hides an empty or entirely non-layout selection", () => {
  const { vc, focusObj } = fixture();
  for (const node of [
    null,
    $(),
    $(document.createElement("style")),
    $(element(new Box(0, 0, 1000, 1000), false)),
  ]) {
    expect(computeHoverBoxViewState(vc, { node, focusObj }, false, false, undefined)).toEqual({
      display: "none",
    });
    expect(getSelectionBounds([node])).toBeUndefined();
  }
});

it("resolves a native component part without a global jQuery", () => {
  const { vc, focusObj } = fixture();
  const owner = new ValComponent({ tpl: focusObj.tpl } as any);
  const button = document.createElement("button");
  Object.defineProperty(vc, "focusedComponentPart", {
    value: { tpl: owner.tpl, element: button, displayName: "Confirm button" },
  });
  expect(computeHoverBoxViewState(vc, { node: $(document.createElement("div")), focusObj: owner }, false, false, vc.focusedComponentPart))
    .toEqual({ display: "none" });
});

it("outlines the protected part's fixed DOM bounds without resize or spacing controls", () => {
  const { vc, focusObj } = fixture();
  const owner = new ValComponent({ tpl: focusObj.tpl } as any);
  const root = document.body.appendChild(element(new Box(0, 0, 1000, 800)));
  const brand = root.appendChild(element(new Box(10, 20, 166, 64)));
  Object.assign(vc, {
    effectiveCurrentVariantSetting: () => undefined,
    variantTplMgr: () => ({ effectiveVariantSetting: () => undefined }),
  });
  const target = { node: $(root), focusObj: owner };
  expect(computeHoverBoxViewState(vc, { node: $(root), focusObj }, false, false, undefined).displayProps)
    .toMatchObject({ width: 1000, height: 800 });
  const part = { tpl: owner.tpl, name: "brand", displayName: "Product name", selector: "[data-brand]", props: ["productName"], element: brand };
  expect(computeHoverBoxViewState(vc, target, false, false, part).displayProps)
    .toMatchObject({ left: 120, top: 210, width: 166, height: 64, isComponentPart: true, edgeControls: { top: [], right: [], bottom: [], left: [] } });
});

it("uses the common dashed border while keeping the real text node selected", () => {
  const { vc, focusObj } = fixture();
  const param = focusObj.slotParam;
  const component = mkCodeComponent("Shell", { name: "Shell", importPath: "./Shell", props: {} }, {});
  component.params.push(param);
  const owner = mkTplComponent(component, mkBaseVariant(), []);
  const brand = mkTplTagX("span");
  owner.vsettings[0].args.push(new Arg({ param, expr: new RenderExpr({ tpl: [brand] }) }));
  brand.parent = owner;
  Object.assign(vc, {
    getCodeComponentMeta: () => ({ props: { children: { type: "slot", fixedRoot: true } } }),
    effectiveCurrentVariantSetting: () => undefined,
  });
  const node = $(document.body.appendChild(element(new Box(10, 20, 166, 32))));
  const result = computeHoverBoxViewState(vc, { node, focusObj: new ValTextTag({ tpl: brand } as any) }, false, false, undefined);
  expect(result.displayProps).toMatchObject({
    width: 166,
    height: 32,
    dashedBorder: true,
    edgeControls: { top: [], right: [], bottom: [], left: [] },
  });
  expect(result.focusedElt).toBe(node);
});

it("shows a selection when an initially hidden root gains layout", () => {
  const { vc, focusObj } = fixture();
  const elt = document.createElement("div");
  let visible = false;
  Object.defineProperty(elt, "offsetWidth", { get: () => visible ? 80 : 0 });
  Object.defineProperty(elt, "offsetHeight", { get: () => visible ? 40 : 0 });
  vi.spyOn(elt, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(10, 20, visible ? 80 : 0, visible ? 40 : 0),
  );
  const target = { node: $(elt), focusObj };
  expect(computeHoverBoxViewState(vc, target, false, false, undefined).display).toBe("none");
  visible = true;
  expect(computeHoverBoxViewState(vc, target, false, false, undefined).displayProps).toMatchObject({
    top: 220, left: 110, width: 80, height: 40,
  });
});

describe("clipped selections", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function clipper(box: Box) {
    const elt = element(box);
    elt.style.overflow = "hidden";
    for (const [key, value] of Object.entries({
      clientWidth: box.width(),
      clientHeight: box.height(),
      clientLeft: 0,
      clientTop: 0,
    })) {
      Object.defineProperty(elt, key, { value });
    }
    document.body.appendChild(elt);
    return elt;
  }

  it("keeps the real size but draws on the visible part", () => {
    const { vc, focusObj } = fixture();
    const container = clipper(new Box(0, 0, 300, 100));
    const elt = element(new Box(50, 20, 200, 400));
    container.appendChild(elt);
    const result = computeHoverBoxViewState(vc, { node: $(elt), focusObj }, false, false, undefined);
    expect(result.displayProps).toMatchObject({
      // Real box: drives the size badge and drag computations.
      top: 250,
      left: 120,
      width: 200,
      height: 400,
      // Drawn box: cut at the container's bottom edge.
      visibleBox: { top: 250, left: 120, width: 200, height: 50 },
      clippedSides: { top: false, right: false, bottom: true, left: false },
    });
  });

  it("hides the selection when the element is entirely clipped", () => {
    const { vc, focusObj } = fixture();
    const container = clipper(new Box(0, 0, 300, 100));
    const elt = element(new Box(150, 20, 200, 40));
    container.appendChild(elt);
    expect(computeHoverBoxViewState(vc, { node: $(elt), focusObj }, false, false, undefined)).toEqual({
      display: "none",
    });
  });
});

it("uses the explicit transform snapshot to hide geometry without an observable command getter", () => {
  const { vc, focusObj } = fixture();
  const root = document.body.appendChild(element(new Box(20, 20, 100, 50)));
  const target = { node: $(root), focusObj };
  expect(computeHoverBoxViewState(vc, target, true, false, undefined)).toEqual({ display: "none" });
  expect(computeHoverBoxViewState(vc, target, false, false, undefined).display).toBe("unset");
});

it("uses the explicit dragging snapshot without a mutable command getter", () => {
  const { vc, focusObj } = fixture();
  const root = document.body.appendChild(element(new Box(20, 20, 100, 50)));
  const target = { node: $(root), focusObj };
  expect(computeHoverBoxViewState(vc, target, false, true, undefined)).toEqual({ display: "none" });
  expect(computeHoverBoxViewState(vc, target, false, false, undefined).display).toBe("unset");
});
