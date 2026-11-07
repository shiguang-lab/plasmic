import { CanvasArena } from "@/wab/client/components/canvas/canvas-arena";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { mock } from "vitest-mock-extended";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { FocusModeLayout } from "@/wab/client/components/studio/arenas/FocusModeLayout";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  AnyArena,
  FocusedDedicatedArena,
  isFocusedDedicatedArena,
  setFocusedFrame,
} from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";

interface CanvasFrameMockProps {
  studioCtx: StudioCtx;
  arena: AnyArena;
  arenaFrame: ArenaFrame;
  isFree: boolean;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
}

const canvasFrameCalls = vi.hoisted(() => ({
  props: [] as CanvasFrameMockProps[],
}));

vi.mock("@/wab/client/components/canvas/CanvasFrame", async () => {
  const ReactModule = await import("react");
  return {
    CanvasFrame: (props: CanvasFrameMockProps) => {
      canvasFrameCalls.props.push(props);
      return ReactModule.createElement("div", {
        "data-testid": "canvas-frame",
        "data-frame-uid": String(props.arenaFrame.uid),
      });
    },
  };
});

vi.mock("@/wab/client/components/studio/arenas/ComponentArenaLayout", () => ({
  ComponentArenaLayout: () => <div data-testid="component-layout" />,
}));
vi.mock("@/wab/client/components/studio/arenas/PageArenaLayout", () => ({
  PageArenaLayout: () => <div data-testid="page-layout" />,
}));

afterEach(() => {
  cleanup();
  canvasFrameCalls.props.length = 0;
});

async function setup() {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({
    name: "Page",
    type: ComponentType.Plain,
  });
  const arena = ensure(
    getDedicatedArena(site, component),
    "Dedicated arena",
  );
  const { studioCtx, api } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  return { site, component, arena, studioCtx, api };
}

async function commitFocusedFrame(
  studioCtx: StudioCtx,
  site: ReturnType<typeof createSite>,
  arena: Awaited<ReturnType<typeof setup>>["arena"],
  fromFocusedFrame?: ArenaFrame,
) {
  let frame: ArenaFrame | undefined;
  await act(async () => {
    frame = await studioCtx.changeUnsafe(() =>
      setFocusedFrame(site, arena, fromFocusedFrame),
    );
  });
  return ensure(frame, "Focused frame");
}

function Layout(props: {
  studioCtx: StudioCtx;
  arena: FocusedDedicatedArena;
  onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
}) {
  return (
    <FocusModeLayout
      studioCtx={props.studioCtx}
      arena={props.arena}
      onFrameLoad={props.onFrameLoad}
    />
  );
}

it("replaces and closes the subscribed focused frame while retaining the CanvasFrame for the same frame", async () => {
  const { site, component, arena, studioCtx } = await setup();
  const onFrameLoad = vi.fn();
  try {
    const frameA = await commitFocusedFrame(studioCtx, site, arena);
    const focusedArena = ensure(
      isFocusedDedicatedArena(arena) ? arena : undefined,
      "Focused arena",
    );
    const { rerender } = render(
      <Layout
        studioCtx={studioCtx}
        arena={focusedArena}
        onFrameLoad={onFrameLoad}
      />,
    );

    expect(canvasFrameCalls.props).toHaveLength(1);
    const firstProps = ensure(canvasFrameCalls.props[0], "First frame props");
    expect(firstProps.studioCtx).toBe(studioCtx);
    expect(firstProps.arena).toBe(focusedArena);
    expect(firstProps.arenaFrame).toBe(frameA);
    expect(firstProps.isFree).toBe(false);
    expect(firstProps.onFrameLoad).toBe(onFrameLoad);
    const firstNode = screen.getByTestId("canvas-frame");
    expect(firstNode.getAttribute("data-frame-uid")).toBe(String(frameA.uid));

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        arena._focusedFrame = frameA;
      });
    });
    rerender(
      <Layout
        studioCtx={studioCtx}
        arena={focusedArena}
        onFrameLoad={onFrameLoad}
      />,
    );
    expect(ensure(canvasFrameCalls.props.at(-1), "Retained props").arenaFrame).toBe(
      frameA,
    );
    expect(screen.getByTestId("canvas-frame")).toBe(firstNode);

    const frameB = await commitFocusedFrame(studioCtx, site, arena, frameA);
    expect(frameB).not.toBe(frameA);
    expect(frameB.uid).not.toBe(frameA.uid);
    expect(ensure(canvasFrameCalls.props.at(-1), "Replaced props").arenaFrame).toBe(
      frameB,
    );
    const replacedNode = screen.getByTestId("canvas-frame");
    expect(replacedNode).not.toBe(firstNode);
    expect(replacedNode.getAttribute("data-frame-uid")).toBe(String(frameB.uid));

    const retainedProps = ensure(
      canvasFrameCalls.props.at(-1),
      "Frame B props",
    );
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        component.name = "Renamed page";
      });
    });
    rerender(
      <Layout
        studioCtx={studioCtx}
        arena={focusedArena}
        onFrameLoad={onFrameLoad}
      />,
    );
    expect(ensure(canvasFrameCalls.props.at(-1), "Unchanged props").arenaFrame).toBe(
      retainedProps.arenaFrame,
    );
    expect(screen.getByTestId("canvas-frame")).toBe(replacedNode);

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        arena._focusedFrame = null;
      });
    });
    expect(screen.queryByTestId("canvas-frame")).toBeNull();
    const callsAfterClose = canvasFrameCalls.props.length;
    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        arena._focusedFrame = null;
      });
    });
    rerender(
      <Layout
        studioCtx={studioCtx}
        arena={focusedArena}
        onFrameLoad={onFrameLoad}
      />,
    );
    expect(screen.queryByTestId("canvas-frame")).toBeNull();
    expect(canvasFrameCalls.props).toHaveLength(callsAfterClose);
  } finally {
    studioCtx.dispose();
  }
});


it("routes the actual arena boundary from only the native focused-frame field", async () => {
  const { site, component, arena, studioCtx } = await setup();
  const commits = vi.fn();
  const mounted = render(<React.Profiler id="arena" onRender={commits}><CanvasArena studioCtx={studioCtx} arena={arena} onFrameLoad={vi.fn()} /></React.Profiler>);
  try {
    expect(screen.getByTestId("component-layout")).toBeTruthy();
    commits.mockClear();
    await act(async () => { await studioCtx.changeUnsafe(() => { component.name = "Renamed without focus"; }); });
    expect(commits).not.toHaveBeenCalled();
    const frame = await commitFocusedFrame(studioCtx, site, arena);
    expect(screen.queryByTestId("component-layout")).toBeNull();
    expect(screen.getByTestId("canvas-frame").getAttribute("data-frame-uid")).toBe(String(frame.uid));
    await act(async () => { await studioCtx.changeUnsafe(() => { arena._focusedFrame = null; }); });
    expect(screen.queryByTestId("canvas-frame")).toBeNull();
    expect(screen.getByTestId("component-layout")).toBeTruthy();
  } finally { mounted.unmount(); studioCtx.dispose(); }
});

it("retires the old focused-frame source before real model replacement and final old-prop renders", async () => {
  const { site, arena, studioCtx, api } = await setup();
  await commitFocusedFrame(studioCtx, site, arena);
  const focusedArena = ensure(isFocusedDedicatedArena(arena) ? arena : undefined, "Focused arena");
  const fieldSource = studioCtx.modelSnapshots.field(focusedArena, "_focusedFrame");
  const subscribe = fieldSource.subscribe;
  let activeSubscriptions = 0;
  vi.spyOn(fieldSource, "subscribe").mockImplementation((listener) => {
    const off = subscribe(listener); activeSubscriptions++;
    let stopped = false;
    return () => { if (!stopped) { stopped = true; activeSubscriptions--; off(); } };
  });
  const mounted = render(<Layout studioCtx={studioCtx} arena={focusedArena} onFrameLoad={vi.fn()} />);
  expect(activeSubscriptions).toBe(1);
  const release = mock<PkgVersionInfoMeta>({ id: "focus-world", pkgId: "focus-package", version: "1.0.0", branchId: null });
  api.getPkgVersion.mockResolvedValueOnce({ pkg: { ...release, model: studioCtx.bundleSite().site }, depPkgs: [], etag: "focus-etag" });
  try {
    expect(screen.getByTestId("canvas-frame")).toBeTruthy();
    const oldModels = studioCtx.modelSnapshots;
    const disposeModels = oldModels.dispose.bind(oldModels);
    vi.spyOn(oldModels, "dispose").mockImplementation(() => { expect(activeSubscriptions).toBe(0); disposeModels(); });
    await act(async () => { await studioCtx["loadVersion"](release, true); });
    expect(studioCtx.modelSnapshots).not.toBe(oldModels);
    const field = vi.spyOn(studioCtx.modelSnapshots, "field"), resolve = vi.spyOn(studioCtx.modelSnapshots, "resolve");
    mounted.rerender(<Layout studioCtx={studioCtx} arena={focusedArena} onFrameLoad={vi.fn()} />);
    expect(screen.getByTestId("canvas-frame").getAttribute("data-frame-uid")).toBe(String(ensure(focusedArena._focusedFrame, "Terminal focused frame").uid));
    expect(field).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled();
    mounted.rerender(<Layout key="foreign-old-props" studioCtx={studioCtx} arena={focusedArena} onFrameLoad={vi.fn()} />);
    expect(screen.queryByTestId("canvas-frame")).toBeNull();
    expect(field).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled();
    act(() => studioCtx.dispose()); field.mockClear(); resolve.mockClear();
    mounted.rerender(<Layout key="foreign-old-props" studioCtx={studioCtx} arena={focusedArena} onFrameLoad={vi.fn()} />);
    expect(screen.queryByTestId("canvas-frame")).toBeNull();
    expect(field).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled();
  } finally { mounted.unmount(); studioCtx.dispose(); }
});
