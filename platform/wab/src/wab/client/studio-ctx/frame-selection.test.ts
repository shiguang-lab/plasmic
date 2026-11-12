import { waitFor } from "@testing-library/react";
import { DragMoveFrameManager } from "@/wab/client/FreestyleManipulator";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  getMarqueeFrames,
  selectAllInCanvas,
} from "@/wab/client/components/canvas/marquee-selection";
import { getFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import * as canvasUtil from "@/wab/client/components/canvas/studio-canvas-util";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { ViewEditorController } from "@/wab/client/components/studio/view-editor";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { Box, Pt } from "@/wab/shared/geom";
import $ from "jquery";
import { mock } from "vitest-mock-extended";

async function setup() {
  const { studioCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  vi.spyOn(studioCtx, "tryZoomToFitArena").mockImplementation(() => undefined);
  const arena = await studioCtx.changeUnsafe(() => {
    const result = studioCtx.addArena("Pages");
    for (let index = 0; index < 2; index++) {
      const page = studioCtx.addComponent(`Page${index + 1}`, {
        type: ComponentType.Page,
        noSwitchArena: true,
      });
      studioCtx.tplMgr().addNewMixedArenaFrame(result, page.name, page, {
        width: 100,
        height: 100,
        insertPt: new Pt(index * 120, 0),
      });
      result.children[index].left = index * 120;
      result.children[index].top = 0;
    }
    return result;
  });
  const viewport = new ViewportCtx({
    dom: mock<DomActions>(),
    initialArena: arena,
    initialClipperBox: new Box(0, 0, 1000, 1000),
    initialClipperScroll: new Pt(0, 0),
  });
  studioCtx.viewportCtx = viewport;
  return {
    studioCtx,
    arena,
    frames: arena.children,
    async dispose() {
      await new Promise((resolve) => setTimeout(resolve, 10));
      viewport.dispose();
      studioCtx.dispose();
    },
  };
}

it("keeps distinct artboards selected, toggles with Shift, and clears for content focus", async () => {
  const { studioCtx, frames, dispose } = await setup();
  try {
    studioCtx.setStudioFocusOnFrames([frames[0], frames[1], frames[0]]);
    expect(studioCtx.focusedFrames()).toEqual(frames);
    expect(studioCtx.focusedFrame()).toBe(frames[0]);
    studioCtx.setStudioFocusOnFrame({
      frame: frames[0],
      appendToMultiSelection: true,
    });
    expect(studioCtx.focusedFrames()).toEqual([frames[1]]);
    studioCtx.setStudioFocusOnFrame({
      frame: frames[0],
      appendToMultiSelection: true,
    });
    expect(studioCtx.focusedFrames()).toEqual([frames[1], frames[0]]);
    studioCtx.setStudioFocusOnFrameContents(frames[0]);
    expect(studioCtx.focusedFrames()).toEqual([]);
    studioCtx.setStudioFocusOnFrame({ frame: undefined });
    expect(studioCtx.focusedViewCtx()).toBeUndefined();
  } finally {
    await dispose();
  }
});

it("selects all artboards from blank canvas or an artboard selection and combines their bounds", async () => {
  const { studioCtx, frames, dispose } = await setup();
  try {
    selectAllInCanvas(studioCtx);
    expect(studioCtx.focusedFrames()).toEqual(frames);
    expect(getFrameSelectionBounds(studioCtx)?.rect()).toEqual(
      new Box(0, 0, 220, 100).rect(),
    );
    studioCtx.setStudioFocusOnFrame({ frame: frames[1] });
    selectAllInCanvas(studioCtx);
    expect(studioCtx.focusedFrames()).toEqual(frames);
    studioCtx.setStudioFocusOnFrame({ frame: undefined });
    expect(getFrameSelectionBounds(studioCtx)).toBeUndefined();
  } finally {
    await dispose();
  }
});

it("keeps the inspector stable when all selected artboards are selected again", async () => {
  const { studioCtx, frames, dispose } = await setup();
  (() => selectAllInCanvas(studioCtx))();
  const vc = ensure(studioCtx.focusedViewCtx(), "Focused view context");
  const update = vi.fn();
  const readSelection = () => update(studioCtx.focusedFrames(), studioCtx.focusedViewCtx(), vc.focusedTpls());
  const stops = [studioCtx.selectionStore.subscribe(readSelection), vc.selectionStore.subscribe(readSelection)];
  const disposeObserver = () => stops.forEach((stop) => stop());
  try {
    update.mockClear();
    (() => selectAllInCanvas(studioCtx))();
    (() => studioCtx.setStudioFocusOnFrames([...frames, frames[0]]))();
    expect(studioCtx.focusedFrames()).toEqual(frames);
    expect(update).not.toHaveBeenCalled();
    (() => studioCtx.setStudioFocusOnFrames([frames[1]]))();
    expect(studioCtx.focusedFrames()).toEqual([frames[1]]);
    expect(update).toHaveBeenCalledTimes(1);
    (() => studioCtx.setStudioFocusOnFrameContents(frames[1]))();
    expect(studioCtx.focusedFrames()).toEqual([]);
    expect(update).toHaveBeenCalledTimes(2);
  } finally {
    disposeObserver();
    await dispose();
  }
});

it.each([0.5, 1, 2])(
  "marquee selects multiple complete artboards at zoom %s, excluding partial or hidden frames",
  async (zoom) => {
    const { studioCtx, frames, dispose } = await setup();
    try {
      const vcs = frames.map((frame, index) => {
        const vc = ensure(
          studioCtx.tryGetViewCtxForFrame(frame),
          "Expected view context",
        );
        vi.spyOn(vc, "isVisible").mockReturnValue(true);
        const viewport = document.createElement("iframe");
        vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
          new DOMRect(100 + index * 120 * zoom, 200, 100 * zoom, 100 * zoom),
        );
        vc.canvasCtx.viewport = vi.fn(() => viewport);
        return vc;
      });
      const start = new Pt(100, 200);
      const end = new Pt(100 + 220 * zoom, 200 + 100 * zoom);
      expect(getMarqueeFrames(studioCtx, Box.spanning(start, end))).toEqual(
        frames,
      );
      expect(getMarqueeFrames(studioCtx, Box.spanning(end, start))).toEqual(
        frames,
      );
      expect(
        getMarqueeFrames(
          studioCtx,
          Box.spanning(start, new Pt(end.x - 1, end.y)),
        ),
      ).toEqual([frames[0]]);
      vi.spyOn(vcs[1], "isVisible").mockReturnValue(false);
      expect(getMarqueeFrames(studioCtx, Box.spanning(start, end))).toEqual([
        frames[0],
      ]);
    } finally {
      await dispose();
    }
  },
);

it("limits selection to the current arena, including after switching arenas", async () => {
  const { studioCtx, frames, dispose } = await setup();
  try {
    studioCtx.setStudioFocusOnFrames(frames);
    await studioCtx.changeUnsafe(() => studioCtx.addArena("Other"));
    expect(studioCtx.focusedFrames()).toEqual([]);
    studioCtx.setStudioFocusOnFrames(frames);
    expect(studioCtx.focusedFrames()).toEqual([]);
    expect(getMarqueeFrames(studioCtx, new Box(0, 0, 1000, 1000))).toEqual([]);
  } finally {
    await dispose();
  }
});

it("moves selected artboards together and restores their positions and selection with one undo", async () => {
  const { studioCtx, frames, dispose } = await setup();
  try {
    for (const frame of frames) {
      const vc = ensure(
        studioCtx.tryGetViewCtxForFrame(frame),
        "Expected view context",
      );
      const element = document.createElement("div");
      document.createElement("div").appendChild(element);
      Object.defineProperties(element, {
        offsetLeft: { get: () => frame.left },
        offsetTop: { get: () => frame.top },
        offsetWidth: { value: 100 },
        offsetHeight: { value: 100 },
      });
      vc.canvasCtx.viewportContainer = vi.fn(() => element);
    }
    await studioCtx.changeUnsafe(() =>
      studioCtx.setStudioFocusOnFrames(frames),
    );
    const manager = new DragMoveFrameManager(
      studioCtx,
      frames[0],
      new Pt(0, 0),
    );
    expect(manager.aborted()).toBe(false);
    await manager.drag(new Pt(20, 30), {
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    });
    manager.endDrag();
    await studioCtx.changeUnsafe(() => undefined);
    expect(frames.map((frame) => [frame.left, frame.top])).toEqual([
      [20, 30],
      [140, 30],
    ]);
    await studioCtx.undo();
    expect(frames.map((frame) => [frame.left, frame.top])).toEqual([
      [0, 0],
      [120, 0],
    ]);
    expect(studioCtx.focusedFrames()).toEqual(frames);
  } finally {
    await dispose();
  }
});

async function setupArtboardGestures() {
  const fixture = await setup();
  const { studioCtx, frames } = fixture;
  const canvas = document.body.appendChild(document.createElement("div"));
  const views = frames.map((frame) => {
    const view = ensure(studioCtx.tryGetViewCtxForFrame(frame));
    const container = canvas.appendChild(document.createElement("div"));
    Object.defineProperties(container, {
      offsetLeft: { get: () => frame.left },
      offsetTop: { get: () => frame.top },
      offsetWidth: { value: frame.width },
      offsetHeight: { value: frame.height },
    });
    view.canvasCtx.viewportContainer = vi.fn(() => container);
    view.canvasCtx.$body = vi.fn(() => $(container));
    view.canvasCtx.$wabInternalElements = vi.fn(() => []);
    return { view, container };
  });
  const editor = new ViewEditorController({
    studioCtx,
    viewCtx: undefined,
    previewCtx: mock<PreviewCtx>(),
    renderInteractive: false,
    renderDocs: false,
    renderDevMode: true,
    panelsHidden: false,
  });
  const emit = async (
    type: "Down" | "Move" | "Up",
    target: HTMLElement,
    view: ViewCtx | undefined,
    x: number,
    y: number,
    shiftKey = false,
  ) => {
    const event = new MouseEvent(`pointer${type.toLowerCase()}`, {
      bubbles: true,
      cancelable: true,
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y,
      shiftKey,
    });
    target.dispatchEvent(event);
    await Reflect.get(editor, `handleMouse${type}`).call(editor, event, view);
  };
  return {
    ...fixture,
    views,
    emit,
    positions: () => frames.map((frame) => [frame.left, frame.top]),
    async dispose() {
      canvas.remove();
      await fixture.dispose();
    },
  };
}

it("selects by title, moves a single artboard from its body, and adds another by Shift-clicking its title", async () => {
  const f = await setupArtboardGestures();
  const { view, container } = f.views[0];
  const title = container.appendChild(document.createElement("span"));
  title.dataset.canvasArtboardUid = String(f.frames[0].uid);
  const otherTitle = f.views[1].container.appendChild(document.createElement("span"));
  otherTitle.dataset.canvasArtboardUid = String(f.frames[1].uid);
  try {
    await f.emit("Down", title, undefined, 5, 5);
    await f.emit("Move", title, undefined, 15, 15);
    await f.emit("Up", title, undefined, 25, 35);
    expect(f.positions()).toEqual([[0, 0], [120, 0]]);
    expect(f.studioCtx.focusedFrames()).toEqual([f.frames[0]]);
    await f.emit("Down", container, view, 30, 25);
    await f.emit("Move", container, view, 40, 35);
    await f.emit("Up", container, view, 50, 55);
    await f.studioCtx.changeUnsafe(() => undefined);
    expect(f.positions()).toEqual([[20, 30], [120, 0]]);
    expect(f.studioCtx.focusedFrames()).toEqual([f.frames[0]]);
    await f.emit("Down", otherTitle, undefined, 120, 0, true);
    await f.emit("Up", otherTitle, undefined, 120, 0, true);
    expect(f.studioCtx.focusedFrames()).toEqual(f.frames);
  } finally {
    await f.dispose();
  }
});

it("moves the full selection from a member's body and still selects and drills into a clicked layer", async () => {
  const f = await setupArtboardGestures();
  const { view, container } = f.views[1];
  const layer = container.appendChild(document.createElement("button"));
  const hitTest = vi.spyOn(canvasUtil, "closestTaggedNonTextDomElt").mockReturnValue($(layer));
  const ops = view.getViewOps();
  const focusLayer = vi.spyOn(ops, "tryFocusDomElt").mockImplementation(() => {
    f.studioCtx.setStudioFocusOnFrameContents(f.frames[1]);
    return undefined;
  });
  const drillDown = vi.spyOn(ops, "deepFocusElement").mockImplementation(() => undefined);
  vi.spyOn(ops, "getFinalFocusable").mockReturnValue({
    val: null,
    focusedDom: null,
    focusedTpl: null,
  });
  try {
    f.studioCtx.changeSelection(() => f.studioCtx.setStudioFocusOnFrames(f.frames));
    await f.emit("Down", layer, view, 130, 10);
    await f.emit("Move", layer, view, 140, 20);
    await f.emit("Up", layer, view, 150, 40);
    await f.studioCtx.changeUnsafe(() => undefined);
    expect(f.positions()).toEqual([[20, 30], [140, 30]]);
    expect(f.studioCtx.focusedFrames()).toEqual(f.frames);
    expect(focusLayer).not.toHaveBeenCalled();
    await f.studioCtx.undo();
    expect(f.positions()).toEqual([[0, 0], [120, 0]]);
    expect(f.studioCtx.focusedFrames()).toEqual(f.frames);

    await f.emit("Down", layer, view, 130, 10);
    await f.emit("Move", layer, view, 131, 11);
    expect(f.studioCtx.focusedFrames()).toEqual(f.frames);
    await f.emit("Up", layer, view, 131, 11);
    expect(focusLayer).toHaveBeenCalledOnce();
    expect(f.studioCtx.focusedFrames()).toEqual([]);
    await f.emit("Down", layer, view, 130, 10);
    await f.emit("Up", layer, view, 130, 10);
    expect(drillDown).toHaveBeenCalledWith($(layer));
    expect(f.positions()).toEqual([[0, 0], [120, 0]]);
  } finally {
    hitTest.mockRestore();
    await f.dispose();
  }
});
