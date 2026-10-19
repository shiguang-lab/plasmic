import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { TopFrameObserver } from "@/wab/client/components/studio/TopFrameObserver";
import { ViewEditor } from "@/wab/client/components/studio/view-editor";
import LeftPane from "@/wab/client/components/studio/LeftPane";
import { RightPane } from "@/wab/client/components/studio/RightPane";
import { StudioLoading } from "@/wab/client/components/widgets/StudioLoading";
import { waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

function elements(tree: React.ReactNode): React.ReactElement[] {
  const result: React.ReactElement[] = [];
  React.Children.forEach(tree, (child) => {
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      result.push(child, ...elements(child.props.children));
    }
  });
  return result;
}

afterEach(() => vi.restoreAllMocks());

it("keeps both sidebar shells mounted while comments toggle without a focused artboard", async () => {
  const { studioCtx } = fakeStudioCtx();
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  vi.spyOn(studioCtx, "focusedOrFirstViewCtx").mockReturnValue(undefined);
  const editor = new ViewEditor({
    studioCtx,
    viewCtx: undefined,
    previewCtx: mock<PreviewCtx>(),
    canvasLoading: false,
  });
  const mountedSidebars = () => {
    const split = elements(editor.render()).find((element) =>
      (element.props as { className?: string }).className === "canvas-editor__hsplit",
    );
    expect(split).toBeDefined();
    return React.Children.toArray(
      (split?.props as { children?: React.ReactNode }).children,
    ).filter((child) =>
      React.isValidElement<{ studioCtx?: typeof studioCtx }>(child) &&
      child.props.studioCtx === studioCtx,
    );
  };
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    const checkShells = (comments: boolean) => {
      const sidebars = mountedSidebars() as React.ReactElement<{ canvasLoading?: boolean }>[];
      expect(sidebars.map((sidebar) => sidebar.type)).toEqual([LeftPane, RightPane]);
      expect(sidebars[1].props.canvasLoading).toBe(false);
      expect(studioCtx.showCommentsPanel).toBe(comments);
    };
    checkShells(false);
    studioCtx.toggleCommentsPanel();
    checkShells(true);
    studioCtx.toggleCommentsPanel();
    checkShells(false);
  } finally {
    studioCtx.dispose();
  }
});

it("keeps the global mask and top-frame readiness closed until both target render and viewport restoration complete", async () => {
  const { studioCtx } = fakeStudioCtx();
  const target = vi
    .spyOn(studioCtx, "activeCanvasReady", "get")
    .mockReturnValue(false);
  const viewport = vi
    .spyOn(studioCtx, "initialViewportReady", "get")
    .mockReturnValue(false);
  const editor = new ViewEditor({
    studioCtx,
    viewCtx: undefined,
    previewCtx: mock<PreviewCtx>(),
    canvasLoading: false,
  });
  const check = (ready: boolean) => {
    const children = elements(editor.render());
    expect(children.some((element) => element.type === StudioLoading)).toBe(
      !ready,
    );
    const observer = children.find(
      (element) => element.type === TopFrameObserver,
    );
    expect(observer).toBeDefined();
    expect((observer?.props as { studioReady: boolean }).studioReady).toBe(
      ready,
    );
  };
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    check(false);
    target.mockReturnValue(true);
    check(false);
    viewport.mockReturnValue(true);
    check(true);
  } finally {
    studioCtx.dispose();
  }
});
