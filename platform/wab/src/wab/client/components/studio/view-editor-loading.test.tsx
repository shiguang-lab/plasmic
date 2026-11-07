import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { TopFrameObserver } from "@/wab/client/components/studio/TopFrameObserver";
import { ViewEditor_ } from "@/wab/client/components/studio/view-editor";
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
  const editor = new ViewEditor_({
    renderInteractive: studioCtx.renderPolicy.store.getState().interactive,
    renderDocs: studioCtx.renderPolicy.store.getState().docs,
    renderDevMode: studioCtx.renderPolicy.store.getState().devMode,
    panelsHidden: studioCtx.leftPanelState.panelsHidden,
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
  const editor = new ViewEditor_({
    renderInteractive: studioCtx.renderPolicy.store.getState().interactive,
    renderDocs: studioCtx.renderPolicy.store.getState().docs,
    renderDevMode: studioCtx.renderPolicy.store.getState().devMode,
    panelsHidden: studioCtx.leftPanelState.panelsHidden,
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

it("refreshes the real drag-guard render boundary from native dragging and detaches it on unmount", async () => {
  const { studioCtx } = fakeStudioCtx();
  const editor = new ViewEditor_({
    renderInteractive: studioCtx.renderPolicy.store.getState().interactive,
    renderDocs: studioCtx.renderPolicy.store.getState().docs,
    renderDevMode: studioCtx.renderPolicy.store.getState().devMode,
    panelsHidden: studioCtx.leftPanelState.panelsHidden,
    studioCtx, viewCtx: undefined, previewCtx: mock<PreviewCtx>(), canvasLoading: false });
  const updated = vi.spyOn(editor, "forceUpdate").mockImplementation(() => undefined);
  const containsGuard = (tree: React.ReactNode): boolean => {
    let found = false;
    React.Children.forEach(tree, (child) => {
      if (React.isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
        found ||= child.props.className === "drag-guard" || containsGuard(child.props.children);
      } else if (child && typeof child === "object" && Reflect.get(child, "$$typeof") === Symbol.for("react.portal")) {
        found ||= containsGuard(Reflect.get(child, "children"));
      }
    });
    return found;
  };
  try {
    await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
    expect(containsGuard(editor.render())).toBe(false);
    editor.componentDidMount();
    expect(updated).not.toHaveBeenCalled();
    studioCtx.setIsDraggingObject(true);
    expect(updated).toHaveBeenCalledTimes(1);
    expect(containsGuard(editor.render())).toBe(true);
    studioCtx.setIsDraggingObject(true);
    expect(updated).toHaveBeenCalledTimes(1);
    studioCtx.setIsDraggingObject(false);
    expect(updated).toHaveBeenCalledTimes(2);
    expect(containsGuard(editor.render())).toBe(false);
    editor.componentWillUnmount();
    const before = updated.mock.calls.length;
    studioCtx.setIsDraggingObject(true);
    expect(updated).toHaveBeenCalledTimes(before);
  } finally { studioCtx.dispose(); }
});


it("updates the class for native arena ownership and detaches its exact selectors on unmount", async () => {
  const site = createSite();
  const first = mkMixedArena("First");
  const second = mkMixedArena("Second");
  site.arenas.push(first, second);
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.currentArena = first;
  const editor = new ViewEditor_({
    renderInteractive: studioCtx.renderPolicy.store.getState().interactive,
    renderDocs: studioCtx.renderPolicy.store.getState().docs,
    renderDevMode: studioCtx.renderPolicy.store.getState().devMode,
    panelsHidden: studioCtx.leftPanelState.panelsHidden,
    studioCtx, viewCtx: undefined, previewCtx: mock<PreviewCtx>(), canvasLoading: false });
  // Match React's lifecycle: the first render precedes componentDidMount.
  editor.render();
  const update = vi.spyOn(editor, "forceUpdate").mockImplementation(() => undefined);
  editor.componentDidMount();
  try {
    studioCtx.currentArena = second;
    expect(update).toHaveBeenCalledTimes(1);
    studioCtx.currentArena = second;
    expect(update).toHaveBeenCalledTimes(1);
    editor.componentWillUnmount();
    studioCtx.currentArena = first;
    expect(update).toHaveBeenCalledTimes(1);
  } finally {
    editor.componentWillUnmount();
    studioCtx.dispose();
  }
});
