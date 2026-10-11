import { DragMoveFrameManager } from "@/wab/client/FreestyleManipulator";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import {
  getMarqueeFrames,
  selectAllInCanvas,
} from "@/wab/client/components/canvas/marquee-selection";
import { getFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { DomActions, ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { Box, Pt } from "@/wab/shared/geom";
import { mock } from "vitest-mock-extended";

async function setup() {
  const { studioCtx } = fakeStudioCtx();
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
