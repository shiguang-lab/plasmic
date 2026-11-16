import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasAddCommentMarker, CanvasCommentMarker, CanvasCommentOverlay, CanvasCommentSubjectLabel } from "@/wab/client/components/comments/CanvasCommentMarkers";
import { DragMoveFrameManager } from "@/wab/client/FreestyleManipulator";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { makeCommonFields } from "@/wab/client/components/comments/utils";
import { toOpaque } from "@/wab/commons/types";
import { ApiUser } from "@/wab/shared/ApiSchema";
import { mock } from "vitest-mock-extended";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { Pt } from "@/wab/shared/geom";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

afterEach(() => {cleanup(); vi.restoreAllMocks();});

function makeCommentSubjectElement(container: HTMLElement) {
  const element = container.appendChild(document.createElement("div"));
  Object.defineProperty(element, "offsetWidth", { value: 100 });
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(30, 40, 100, 50));
  return element;
}

it("publishes comment label fields, preserves original new-comment targets and retires the old view", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({site});
  const component = manager.addComponent({name: "Comments", type: ComponentType.Plain});
  const tpl = ensureKnownTplTag(component.tplTree); tpl.name = "Original subject";
  const unrelated = manager.addComponent({name: "Unrelated", type: ComponentType.Plain});
  const frame = mkArenaFrame({site, component, name: "Comments", width: 600, height: 200});
  site.arenas.push(mkMixedArena("Comments", [frame]));
  const {studioCtx: studio} = fakeStudioCtx({site, initialUrl: "/projects/test?arena_type=custom&arena=Comments"});
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Comment view");
  ensure(view.csEvaluator, "Comment evaluator").renderStatusStore.setState({renderCount: 1});
  const container = document.body.appendChild(document.createElement("div"));
  const element = makeCommentSubjectElement(container);
  vi.spyOn(view, "maybeDomsForTpl").mockReturnValue([null, [element]]);
  const open = vi.spyOn(studio.commentsCtx, "openNewCommentDialog").mockImplementation(() => undefined);
  const commits = vi.fn();
  const mounted = render(<><React.Profiler id="comment-label" onRender={commits}><CanvasCommentSubjectLabel view={view} subject={tpl}/></React.Profiler><CanvasAddCommentMarker viewCtx={view} tpl={tpl}/></>);
  try {
    expect(screen.getByText("Original subject")).toBeTruthy();
    const count = commits.mock.calls.length;
    await act(async () => {await studio.changeUnsafe(() => {unrelated.name = "Unrelated renamed";});});
    expect(commits).toHaveBeenCalledTimes(count);
    await act(async () => {await studio.changeUnsafe(() => {tpl.name = "Updated subject";});});
    expect(screen.getByText("Updated subject")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(open).toHaveBeenCalledWith(view, tpl);
    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByText("Updated subject")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  } finally {mounted.unmount(); container.remove(); await studio.awaitEval(); studio.dispose();}
});

it("previews the comment on hover without opening details, and opens the sidebar only on click", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Comments", type: ComponentType.Plain });
  const tpl = ensureKnownTplTag(component.tplTree);
  const frame = mkArenaFrame({ site, component, name: "Comments", width: 600, height: 200 });
  site.arenas.push(mkMixedArena("Comments", [frame]));
  const { studioCtx: studio, api } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Comments" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const view = ensure(studio.tryGetViewCtxForFrame(frame), "Comment view");
  ensure(view.csEvaluator, "Comment evaluator").renderStatusStore.setState({ renderCount: 1 });
  vi.spyOn(studio, "showComments").mockReturnValue(true);
  const author = mock<ApiUser>({ id: toOpaque("author"), email: "author@example.com", displayName: "Author" });
  studio.appCtx.selfInfo = author;
  const common = makeCommonFields(author.id);
  studio.bundler().bundle(studio.site, studio.siteInfo.id, studio.appCtx.lastBundleVersion);
  const id = toOpaque<string, "CommentThreadId">("hover-thread");
  api.getComments.mockResolvedValue({ threads: [{ ...common, id, resolved: false, location: { subject: ensure(studio.bundler().addrOf(tpl), "Subject address"), variants: [] }, comments: [{ ...common, id: toOpaque("hover-comment"), commentThreadId: id, body: "Full hover preview with query instructions" }], commentThreadHistories: [] }], users: [author], reactions: [] });
  await studio.commentsCtx.fetchComments();
  const thread = ensure(studio.commentsCtx.computedData().threadsById.get(id), "Loaded thread");
  const open = vi.spyOn(studio.commentsCtx, "openCommentThreadDialog").mockImplementation(() => undefined);
  const container = document.body.appendChild(document.createElement("div"));
  const element = makeCommentSubjectElement(container);
  vi.spyOn(view, "maybeDomsForTpl").mockReturnValue([null, [element]]);
  const mounted = render(<StudioCtxContext.Provider value={studio}><CanvasCommentMarker commentThread={thread} viewCtx={view} offsetRight={30} zIndex={12} onHoverChange={() => undefined} /></StudioCtxContext.Provider>);
  try {
    const marker = screen.getByRole("button");
    act(() => marker.focus());
    expect(screen.queryByText("Full hover preview with query instructions")).toBeNull();
    fireEvent.mouseEnter(marker);
    const preview = await screen.findByText("Full hover preview with query instructions");
    fireEvent.mouseEnter(preview);
    await act(async () => {
      marker.blur();
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    expect(preview.isConnected).toBe(true);
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(preview);
    fireEvent.doubleClick(preview);
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(marker);
    expect(open).toHaveBeenCalledExactlyOnceWith(id, true);
    await waitFor(() => expect(screen.queryByText("Full hover preview with query instructions")).toBeNull());
    act(() => studio.commentsCtx.handleOpenCommentThreadDialog(id, view));
    fireEvent.mouseLeave(marker);
    fireEvent.mouseEnter(marker);
    expect(await screen.findByText("Full hover preview with query instructions")).toBeTruthy();
    expect(open).toHaveBeenCalledOnce();
  } finally { mounted.unmount(); container.remove(); await studio.awaitEval(); studio.dispose(); }
});

it("keeps the comment overlay anchored to its artboard during a multi-artboard drag", async () => {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue(undefined);
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Comments", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "First", width: 200, height: 100, left: 20, top: 10 });
  const other = mkArenaFrame({ site, component, name: "Second", width: 200, height: 100, left: 240, top: 10 });
  site.arenas.push(mkMixedArena("Comments", [frame, other]));
  const { studioCtx: studio } = fakeStudioCtx({ site, initialUrl: "/projects/test?arena_type=custom&arena=Comments" });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));

  const scaler = document.body.appendChild(document.createElement("div"));
  scaler.className = "canvas-editor__scaler";
  const [commentFrame, otherFrame] = [frame, other].map((artboard) => {
    const container = scaler.appendChild(document.createElement("div"));
    container.style.cssText = `position: absolute; left: ${artboard.left}px; top: ${artboard.top}px;`;
    Object.defineProperties(container, {
      offsetLeft: { get: () => artboard.left },
      offsetTop: { get: () => artboard.top },
      offsetWidth: { value: artboard.width },
      offsetHeight: { value: artboard.height },
    });
    const view = ensure(studio.tryGetViewCtxForFrame(artboard), "Comment artboard view");
    view.canvasCtx.viewportContainer = () => container;
    view.canvasCtx.viewportContainerOffset = () => ({
      left: container.offsetLeft,
      top: container.offsetTop,
    });
    return { view, container };
  });
  const subject = makeCommentSubjectElement(commentFrame.container);
  const { view, container } = commentFrame;
  ensure(view.csEvaluator, "Comment evaluator").renderStatusStore.setState({ renderCount: 1 });
  vi.spyOn(view, "maybeDomsForTpl").mockReturnValue([null, [subject]]);
  await studio.changeUnsafe(() => studio.setStudioFocusOnFrames([frame, other]));

  const mounted = render(
    <CanvasCommentOverlay tpl={component.tplTree} viewCtx={view} offsetRight={30}>
      Comment
    </CanvasCommentOverlay>,
    { container },
  );
  const drag = new DragMoveFrameManager(studio, frame, Pt.zero());
  try {
    expect(drag.aborted()).toBe(false);
    await act(async () => {
      await drag.drag(new Pt(25, 35), { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false });
    });
    expect(container.style.left).toBe("45px");
    expect(container.style.top).toBe("45px");
    expect(otherFrame.container.style.left).toBe("265px");
    const overlay = ensure(scaler.querySelector<HTMLElement>(".CanvasTransformedBox"), "Comment overlay");
    expect(overlay.parentElement).toBe(container);
    expect(overlay.style.left).toBe("30px");
    expect(overlay.style.top).toBe("40px");
  } finally {
    drag.endDrag();
    await studio.changeUnsafe(() => undefined);
    mounted.unmount();
    scaler.remove();
    await studio.awaitEval();
    studio.dispose();
  }
});
