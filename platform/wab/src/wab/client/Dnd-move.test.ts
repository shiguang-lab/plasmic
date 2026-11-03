import { DragMoveManager, FreeBoxInsertion, NodeTargeter } from "@/wab/client/Dnd";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { Box, Pt } from "@/wab/shared/geom";
import { mockDeep } from "vitest-mock-extended";

vi.mock("@/wab/client/FreestyleManipulator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/FreestyleManipulator")>()),
  mkFreestyleManipForFocusedDomElt: () => ({
    match: (start: (manip: { start: () => undefined }) => void) =>
      start({ start: () => undefined }),
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function fixture(count: number) {
  const vc = mockDeep<ViewCtx>();
  Reflect.set(vc, "studioCtx", { zoom: 2 });
  vc.currentComponent.mockReturnValue(mkComponent({
    tplTree: mkTplTagX("div"), type: ComponentType.Plain,
  }));
  const viewport = document.createElement("iframe");
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 1000, 800));
  vc.canvasCtx.viewport.mockReturnValue(viewport);
  const objects = Array.from({ length: count }, (_, i) => new ValTag({
    tpl: mkTplTagX("div"), children: [], className: "", key: `node-${i}`,
    fullKey: `node-${i}`, frameUid: 1, fibers: [], parent: undefined,
    valOwner: undefined, slotInfo: undefined,
  }));
  const rects = [new DOMRect(80, 60, 20, 20), new DOMRect(20, 100, 20, 20), new DOMRect(40, 10, 20, 20)];
  vc.eltFinder.mockImplementation((object) => {
    const index = objects.indexOf(object as ValTag);
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rects[index]);
    return [element];
  });
  vc.focusedSelectables.mockReturnValue(objects);
  const nodeBox: ConstructorParameters<typeof FreeBoxInsertion>[0] = {
    selectable: objects[0], dom: document.createElement("div"),
    box: new Box(0, 0, 1000, 1000), paddingBox: new Box(0, 0, 1000, 1000),
    boxInScaler: new Box(0, 0, 1000, 1000), flowDir: "vertical",
    isInFlex: false, isInFlexReverse: false, acceptsChildren: true,
    acceptsNeighbors: true, measuredGrid: undefined, containerType: "free",
  };
  const measure = vi.spyOn(
    NodeTargeter.prototype as unknown as { calcBoxes: (nodes: unknown) => unknown },
    "calcBoxes",
  ).mockReturnValue({
    nodeBoxes: [nodeBox], insertionBoxes: [], nodeBoxToBeforeAfter: new Map(),
    frameRect: { left: 0, top: 0, width: 1000, height: 1000 },
  });
  return { vc, objects, measure };
}

it.each([1, 3])("measures one set of drop targets for %s selected objects and keeps their combined cursor offset", (count) => {
  const { vc, objects, measure } = fixture(count);
  const manager = new DragMoveManager(vc, objects, new Pt(100, 100));
  expect(measure).toHaveBeenCalledTimes(1);
  expect(measure).toHaveBeenCalledWith(objects.map((object) => object.tpl));
  const targeter = Reflect.get(manager, "targeter");
  assert(targeter instanceof NodeTargeter, "Expected measured drop targets");
  const insertion = targeter.getAbsInsertion(new Pt(300, 400));
  assert(insertion instanceof FreeBoxInsertion, "Expected a free insertion");
  expect(insertion.pt).toEqual(count === 1 ? new Pt(370, 440) : new Pt(250, 340));
});

it("does not measure drop targets for an empty selection", () => {
  const { vc, measure } = fixture(0);
  new DragMoveManager(vc, [], new Pt(100, 100));
  expect(measure).not.toHaveBeenCalled();
  expect(vc.startUnlogged).not.toHaveBeenCalled();
});
