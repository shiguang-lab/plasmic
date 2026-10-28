import { computeHoverBoxViewState } from "@/wab/client/components/canvas/HoverBox/computeHoverBoxViewStates";
import { getSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { Box } from "@/wab/shared/geom";
import { typeFactory } from "@/wab/shared/model/model-util";
import $ from "jquery";

vi.mock("@/wab/client/components/sidebar-tabs/tpl-tree", () => ({
  createNodeIcon: () => undefined,
}));
vi.mock("@/wab/client/utils/tpl-client-utils", () => ({
  summarizeFocusObj: () => "Content",
}));

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
    studioCtx: {
      isDraggingObject: () => false,
      isTransformingObject: () => false,
    },
    canvasCtx: { viewportContainerOffset: () => ({ left: 100, top: 200 }) },
  } as unknown as ViewCtx;
  return { vc, focusObj };
}

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
    const result = computeHoverBoxViewState(vc, { node, focusObj });
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
    expect(computeHoverBoxViewState(vc, { node, focusObj })).toEqual({
      display: "none",
    });
    expect(getSelectionBounds([node])).toBeUndefined();
  }
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
  expect(computeHoverBoxViewState(vc, target).display).toBe("none");
  visible = true;
  expect(computeHoverBoxViewState(vc, target).displayProps).toMatchObject({
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
    const result = computeHoverBoxViewState(vc, { node: $(elt), focusObj });
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
    expect(computeHoverBoxViewState(vc, { node: $(elt), focusObj })).toEqual({
      display: "none",
    });
  });
});
