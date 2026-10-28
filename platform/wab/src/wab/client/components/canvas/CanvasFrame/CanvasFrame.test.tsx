import { CanvasContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasFrame } from "@/wab/client/components/canvas/CanvasFrame/CanvasFrame";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTag } from "@/wab/shared/core/tpls";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
import { mock } from "vitest-mock-extended";

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
  const rendered = observable.box(false);
  const updatingRegistry = observable.box(false);
  const vc = mock<ViewCtx>();
  Object.defineProperty(vc, "contentEditor", { value: new CanvasContentEditor(vc) });
  const editing = observable.box(false);
  vi.spyOn(vc.contentEditor, "target", "get").mockImplementation(() =>
    editing.get() ? { tpl: component.tplTree as never, fullKey: "target", element: document.body } : undefined,
  );
  const canvas = mock<CanvasCtx>();
  Object.defineProperty(vc, "canvasCtx", { value: canvas });
  Object.defineProperty(vc, "initialRenderReady", {
    get: () => rendered.get(),
  });
  canvas.isUpdatingCcRegistry.mockImplementation(() => updatingRegistry.get());
  const queue = vi
    .spyOn(studioCtx, "queueCanvasFrame")
    .mockImplementation(() => undefined);
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    vi.spyOn(studioCtx, "tryGetViewCtxForFrame").mockReturnValue(vc);
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
    expect(container.querySelector("iframe")?.getAttribute("data-plasmic-frame-uuid")).toBe(frame.uuid);
    expect(container.querySelector("iframe")?.getAttribute("data-plasmic-component-uuid")).toBe(component.uuid);
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ arena, frame }),
    );
    act(() => rendered.set(true));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => updatingRegistry.set(true));
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => updatingRegistry.set(false));
    expect(screen.queryByRole("status")).toBeNull();
    act(() => vc.contentEditor.size.set({ width: 1600, height: 2400 }));
    const contentFrame = container.querySelector<HTMLElement>(".CanvasFrame__Container");
    expect(contentFrame?.style.width).toBe("1600px");
    expect(contentFrame?.style.height).toBe("2400px");
    expect(frame.width).toBe(800);
    expect(frame.height).toBe(600);
    const iframe = container.querySelector("iframe");
    expect(iframe?.style.background).toBe("");
    expect(container.querySelector(".CanvasFrame__OverlayTop")).not.toBeNull();
    act(() => editing.set(true));
    expect(iframe?.style.background).toBe("transparent");
    expect(contentFrame?.style.boxShadow).toBe("none");
    expect(container.querySelector(".CanvasFrame__OverlayTop")).toBeNull();
    const focusFrame = vi.spyOn(studioCtx, "setStudioFocusOnFrame");
    fireEvent.click(contentFrame as HTMLElement);
    expect(focusFrame).not.toHaveBeenCalled();
    act(() => editing.set(false));
    expect(iframe?.style.background).toBe("");
    expect(contentFrame?.style.boxShadow).toBe("");
    expect(container.querySelector(".CanvasFrame__OverlayTop")).not.toBeNull();
    act(() => vc.contentEditor.size.set(undefined));
    expect(contentFrame?.style.width).toBe("800px");
    expect(contentFrame?.style.height).toBe("600px");
  } finally {
    cleanup();
    studioCtx.dispose();
  }
});
