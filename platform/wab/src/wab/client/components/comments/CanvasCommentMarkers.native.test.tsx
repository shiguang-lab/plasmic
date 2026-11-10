import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasAddCommentMarker, CanvasCommentMarker, CanvasCommentSubjectLabel } from "@/wab/client/components/comments/CanvasCommentMarkers";
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
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/canvas/CanvasTransformedBox", () => ({CanvasTransformedBox: ({children}: {children: React.ReactNode}) => <div>{children}</div>}));
afterEach(() => {cleanup(); vi.restoreAllMocks();});

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
  const element = document.createElement("div"), scaler = document.createElement("div");
  scaler.className = "canvas-editor__scaler"; document.body.appendChild(scaler);
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
  } finally {mounted.unmount(); scaler.remove(); await studio.awaitEval(); studio.dispose();}
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
  vi.spyOn(view, "maybeDomsForTpl").mockReturnValue([null, [document.createElement("div")]]);
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
  const scaler = document.createElement("div"); scaler.className = "canvas-editor__scaler"; document.body.appendChild(scaler);
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
  } finally { mounted.unmount(); scaler.remove(); await studio.awaitEval(); studio.dispose(); }
});
