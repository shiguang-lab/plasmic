import { DragMoveManager } from "@/wab/client/Dnd";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditor } from "@/wab/client/components/studio/view-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTag } from "@/wab/shared/core/val-nodes";
import { Pt } from "@/wab/shared/geom";
import { mock } from "vitest-mock-extended";

const motion = vi.hoisted(() => ({
  start: vi.fn(),
  drag: vi.fn(async () => undefined),
  end: vi.fn(),
}));

vi.mock("@/wab/client/Dnd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/Dnd")>()),
  DragMoveManager: class {
    constructor(...args: unknown[]) {
      motion.start(...args);
    }
    drag = motion.drag;
    endDrag = motion.end;
    aborted = () => false;
  },
}));

afterEach(() => vi.restoreAllMocks());

function fixture() {
  motion.start.mockClear();
  motion.drag.mockClear();
  motion.end.mockClear();
  const { studioCtx } = fakeStudioCtx();
  vi.spyOn(studioCtx, "tryUpdateKeyboardStatus").mockImplementation(
    () => undefined,
  );
  vi.spyOn(studioCtx, "tryPanning").mockReturnValue(false);
  const tpl = mkTplTagX("section");
  const val = new ValTag({
    tpl,
    children: [],
    className: "",
    key: "section",
    fullKey: "section",
    frameUid: 1,
    fibers: [],
    parent: undefined,
    valOwner: undefined,
    slotInfo: undefined,
  });
  const viewOps = mock<ViewOps>();
  const source = mock<ViewCtx>();
  Reflect.set(source, "isDisposed", false);
  Reflect.set(source, "studioCtx", studioCtx);
  source.focusedTpl.mockReturnValue(tpl);
  source.focusedSelectables.mockReturnValue([val]);
  source.eltFinder.mockReturnValue([document.createElement("section")]);
  source.getViewOps.mockReturnValue(viewOps);
  const target = mock<ViewCtx>();
  Reflect.set(target, "studioCtx", studioCtx);
  const editor = new ViewEditor({
    studioCtx,
    viewCtx: source,
    previewCtx: mock<PreviewCtx>(),
    canvasLoading: false,
  });
  const initial = {
    sourceViewCtx: source,
    initClientPt: new Pt(10, 20),
    initScreenX: 10,
    initScreenY: 20,
    isDragging: false,
    dragMoveManager: undefined,
  };
  Reflect.set(editor, "dragState", initial);
  const event = new MouseEvent("pointermove", {
    screenX: 250,
    screenY: 300,
    clientX: 250,
    clientY: 300,
  });
  document.body.dispatchEvent(event);
  return { studioCtx, source, target, editor, event };
}

it("keeps the drag source when the first move enters another artboard and computes that first drop position", async () => {
  const { studioCtx, source, target, editor, event } = fixture();
  try {
    await Reflect.get(editor, "handleMouseMove").call(editor, event, target);
    expect(motion.start).toHaveBeenCalledWith(
      source,
      expect.any(Array),
      new Pt(10, 20),
    );
    expect(motion.drag).toHaveBeenCalledWith(new Pt(250, 300), event);
  } finally {
    studioCtx.dispose();
  }
});

it("updates the final mouse-up position before committing a cross-artboard move", async () => {
  const { studioCtx, source, target, editor, event } = fixture();
  try {
    const manager = new DragMoveManager(source, [], new Pt(10, 20));
    Reflect.set(editor, "dragState", {
      sourceViewCtx: source,
      isDragging: true,
      dragMoveManager: manager,
    });
    await Reflect.get(editor, "handleMouseUp").call(editor, event, target);
    expect(motion.drag).toHaveBeenCalledWith(new Pt(250, 300), event);
    expect(motion.end).toHaveBeenCalledWith(false);
  } finally {
    studioCtx.dispose();
  }
});

it("cancels a tentative cross-artboard drop when Escape is pressed", () => {
  const { studioCtx, source, editor } = fixture();
  try {
    const manager = new DragMoveManager(source, [], new Pt(10, 20));
    Reflect.set(editor, "dragState", {
      sourceViewCtx: source,
      isDragging: true,
      dragMoveManager: manager,
    });
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    Reflect.get(editor, "handleDragEscape").call(editor, escape);
    expect(motion.end).toHaveBeenCalledWith(true);
    expect(escape.defaultPrevented).toBe(true);
    expect(escape.cancelBubble).toBe(true);
  } finally {
    studioCtx.dispose();
  }
});
