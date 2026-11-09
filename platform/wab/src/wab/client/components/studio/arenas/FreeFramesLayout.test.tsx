import { assert } from "@/wab/shared/common";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FreeFramesLayout } from "@/wab/client/components/studio/arenas/FreeFramesLayout";
import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame";
import { FrameViewMode, mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/canvas/CanvasFrame", () => ({
  CanvasFrame: vi.fn(({ arenaFrame }: { arenaFrame: ArenaFrame }) => <div data-frame={arenaFrame.uuid} />),
}));
afterEach(cleanup);

it("updates mixed arena bounds after a real model commit and retains existing frame DOM", async () => {
  const site = createSite();
  const component = mkComponent({ name: "Content", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const unrelated = mkComponent({ name: "Other", type: ComponentType.Plain, tplTree: mkTplTagX("span") });
  site.components.push(component, unrelated);
  const frame = mkArenaFrame({ site, component, name: "First", viewMode: FrameViewMode.Centered, width: 100, height: 100, left: 10, top: 20 });
  const arena = mkMixedArena("Canvas", [frame]);
  site.arenas.push(arena);
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.currentArena = arena;
  const commits = vi.fn();
  const onFrameLoad = vi.fn();
  const layout = () => <React.Profiler id="arena" onRender={commits}><FreeFramesLayout studioCtx={studioCtx} arena={arena} onFrameLoad={onFrameLoad} /></React.Profiler>;
  const { container, unmount, rerender } = render(layout());
  try {
    const renderedFrames = vi.mocked(CanvasFrame).mock.calls.length;
    rerender(layout());
    expect(CanvasFrame).toHaveBeenCalledTimes(renderedFrames);
    const root = container.firstElementChild;
    assert(root instanceof HTMLElement, "Expected mixed arena root");
    const frameElement = root.querySelector(`[data-frame="${frame.uuid}"]`);
    expect(root.style.width).toBe("110px");
    const before = commits.mock.calls.length;
    await act(async () => {
      await studioCtx.changeUnsafe(() => { unrelated.name = "Renamed"; });
    });
    expect(commits).toHaveBeenCalledTimes(before);
    await act(async () => {
      await studioCtx.changeUnsafe(() => { frame.width = 240; });
    });
    expect(root.style.width).toBe("250px");
    expect(root.querySelector(`[data-frame="${frame.uuid}"]`)).toBe(frameElement);
    await act(async () => {
      await studioCtx.changeUnsafe(() => { arena.children = []; });
    });
    expect(root.style.width).toBe("0px");
    expect(root.querySelector("[data-frame]")).toBeNull();
  } finally {
    unmount();
    studioCtx.dispose();
  }
});
