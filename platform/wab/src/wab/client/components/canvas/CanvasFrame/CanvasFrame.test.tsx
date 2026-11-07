import { CanvasRenderOwner } from "@/wab/client/components/canvas/canvas-cache";
import { CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ensure } from "@/wab/shared/common";
import { fakeRegistryViewCtx, fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame/CanvasFrame";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { mkArenaFrame, mkMixedArena, updateAutoDerivedFrameHeight } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/canvas/CanvasFrame/CanvasHeader", () => ({
  CanvasHeader: () => null,
}));
vi.mock(
  "@/wab/client/components/canvas/CanvasFrame/CanvasArtboardSelectionHandle",
  () => ({ CanvasArtboardSelectionHandle: () => null }),
);
vi.mock("@/wab/client/components/canvas/CanvasActions/CanvasActions", () => ({
  CanvasActions: () => null,
}));
vi.mock("@/wab/client/components/comments/CanvasCommentMarkers", () => ({
  CanvasCommentMarkers: () => null,
}));
vi.mock("@/wab/client/components/canvas/CopilotActivityOverlay", () => ({
  CopilotActivityOverlay: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows a bounded local skeleton until first render, preserves component-registration loading, and queues frame identity", async () => {
  const site = createSite();
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    tplTree: mkTplTag("div"),
  });
  site.components.push(component);
  const arena = mkMixedArena("Overview");
  const frame = mkArenaFrame({
    site,
    component,
    name: "Target",
    width: 800,
    height: 600,
    left: 0,
    top: 0,
  });
  arena.children.push(frame);
  site.arenas.push(arena);
  const { studioCtx } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Overview",
  });
  const { view: vc, ready: rendered } = fakeRegistryViewCtx(studioCtx, frame);
  const registrations = vc.canvasCtx.registrations;
  const editingSession = new CanvasSessionState(), editingCache = new CanvasRenderOwner(editingSession);
  Object.defineProperty(vc, "canvasRenderOwner", { value: editingCache });
  const setEditing = (editing: boolean) => vc.contentEditor["commitSession"]({
    target: editing ? { tpl: ensureKnownTplTag(component.tplTree), fullKey: "target", element: document.body } : undefined,
    size: vc.contentEditor.size, ready: false, expandedAncestors: Object.freeze([]),
  });
  const queue = vi
    .spyOn(studioCtx, "queueCanvasFrame")
    .mockImplementation(() => vi.fn());
  vc.arenaFrame.mockReturnValue(frame);
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(vc);
  const selectFrame = vi.spyOn(studioCtx, "setStudioFocusOnFrame").mockImplementation(() => undefined);
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    selectFrame.mockClear();
    const { container } = render(
      <CanvasFrame
        studioCtx={studioCtx}
        arena={arena}
        arenaFrame={frame}
        isFree
        onFrameLoad={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ant-skeleton")).toHaveLength(1);
    expect(container.querySelector(".ant-skeleton-active")).toBeNull();
    expect(container.querySelector("iframe")?.getAttribute("data-plasmic-frame-uuid")).toBe(frame.uuid);
    expect(container.querySelector("iframe")?.getAttribute("data-plasmic-component-uuid")).toBe(component.uuid);
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ arena, frame }),
    );
    act(() => rendered.setState(true, true));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => registrations.begin());
    expect(screen.getByRole("status")).toBeTruthy();
    expect(container.querySelector(".ant-skeleton-active")).not.toBeNull();
    act(() => registrations.end());
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vc.contentEditor["setSize"]({ width: 1600, height: 2400 }));
    const contentFrame = container.querySelector<HTMLElement>(".CanvasFrame__Container");
    expect(contentFrame?.style.width).toBe("1600px");
    expect(contentFrame?.style.height).toBe("2400px");
    expect(frame.width).toBe(800);
    expect(frame.height).toBe(600);
    const iframe = container.querySelector("iframe");
    expect(iframe?.style.background).toBe("");
    expect(container.querySelector(".CanvasFrame__OverlayTop")).not.toBeNull();
    act(() => setEditing(true));
    expect(iframe?.style.background).toBe("transparent");
    expect(contentFrame?.style.boxShadow).toBe("none");
    expect(container.querySelector(".CanvasFrame__OverlayTop")).toBeNull();
    const focusFrame = vi.spyOn(studioCtx, "setStudioFocusOnFrame");
    fireEvent.click(contentFrame as HTMLElement);
    expect(focusFrame).not.toHaveBeenCalled();
    act(() => setEditing(false));
    expect(iframe?.style.background).toBe("");
    expect(contentFrame?.style.boxShadow).toBe("");
    expect(container.querySelector(".CanvasFrame__OverlayTop")).not.toBeNull();
    act(() => vc.contentEditor["setSize"](undefined));
    expect(contentFrame?.style.width).toBe("800px");
    expect(contentFrame?.style.height).toBe("600px");
  } finally {
    cleanup();
    registrations.dispose();
    vc.contentEditor.dispose(); editingCache.dispose(); editingSession.dispose();
    studioCtx.dispose();
  }
});

it("cancels a pending iframe initializer before its old frame can reach the new model owner", async () => {
  const site = createSite();
  const component = mkComponent({ name: "Pending", type: ComponentType.Plain, tplTree: mkTplTag("div") });
  site.components.push(component);
  const arena = mkMixedArena("Pending");
  const frame = mkArenaFrame({ site, component, name: "Pending", width: 800, height: 600, left: 0, top: 0 });
  arena.children.push(frame); site.arenas.push(arena);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Pending" });
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(undefined);
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  vi.spyOn(studioCtx, "fetchHostPageHtml").mockResolvedValue("<!doctype html><html><head></head><body></body></html>");
  const queue = vi.spyOn(studioCtx, "queueCanvasFrame").mockImplementation(() => vi.fn());
  let resume: () => void = () => undefined;
  const blocked = new Promise<void>((resolve) => { resume = resolve; });
  const init = vi.spyOn(CanvasCtx.prototype, "initViewPort").mockImplementation(async function* () {
    yield "user-body-wait";
    await blocked;
    yield "script-wait";
  });
  const dispose = vi.spyOn(CanvasCtx.prototype, "dispose");
  const createView = vi.spyOn(studioCtx, "createViewCtx");
  const report = vi.spyOn(studioCtx, "reportCanvasLoadError");
  const onFrameLoad = vi.fn((loadedFrame: typeof frame, canvas: CanvasCtx) => studioCtx.createViewCtx(loadedFrame, canvas));
  const { unmount } = render(<CanvasFrame studioCtx={studioCtx} arena={arena} arenaFrame={frame} isFree onFrameLoad={onFrameLoad} />);
  const request = ensure(queue.mock.calls[0]?.[0], "Queued frame load request");
  let loaded: Promise<void> | undefined;
  await act(async () => { loaded = request.load(); });
  await waitFor(() => expect(init).toHaveBeenCalledOnce());
  const oldModels = studioCtx.modelSnapshots;
  act(() => {
    studioCtx.arenaState.reset();
    oldModels.dispose();
    studioCtx.modelSnapshots = new ModelSnapshots();
  });
  await expect(ensure(loaded, "Started frame load")).resolves.toBeUndefined();
  expect(dispose).toHaveBeenCalledOnce();
  await act(async () => { resume(); await blocked; });
  expect(onFrameLoad).not.toHaveBeenCalled();
  expect(createView).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
  unmount(); studioCtx.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});


it("renders transient page measurements without changing the authored viewport height", async () => {
  const site = createSite();
  const component = mkComponent({ name: "Measured page", type: ComponentType.Page, tplTree: mkTplTag("div") });
  site.components.push(component);
  const frame = mkArenaFrame({ site, component, name: "Measured", width: 800, height: 600, left: 0, top: 0 });
  const arena = mkMixedArena("Measured", [frame]); site.arenas.push(arena);
  const { studioCtx } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Measured" });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const existing = studioCtx.arenaState.viewRegistry.forFrame(frame);
  if (existing) { studioCtx.disposeViewCtx(existing.view); }
  vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(undefined);
  vi.spyOn(studioCtx, "queueCanvasFrame").mockImplementation(() => vi.fn());
  const mounted = render(<CanvasFrame studioCtx={studioCtx} arena={arena} arenaFrame={frame} isFree onFrameLoad={vi.fn()} />);
  const container = mounted.container.querySelector<HTMLElement>(".CanvasFrame__Container");
  try {
    expect(container?.style.height).toBe("600px");
    act(() => updateAutoDerivedFrameHeight(frame, 1800));
    expect(container?.style.height).toBe("1800px"); expect(frame.height).toBe(600);
    act(() => updateAutoDerivedFrameHeight(frame, 500));
    expect(container?.style.height).toBe("600px"); expect(frame.height).toBe(600);
  } finally { mounted.unmount(); studioCtx.dispose(); }
});
