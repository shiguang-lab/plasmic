import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasAddCommentMarker, CanvasCommentSubjectLabel } from "@/wab/client/components/comments/CanvasCommentMarkers";
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
    expect(open).toHaveBeenCalledWith(view, tpl, expect.anything());
    act(() => studio.disposeViewCtx(view));
    expect(screen.queryByText("Updated subject")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  } finally {mounted.unmount(); scaler.remove(); await studio.awaitEval(); studio.dispose();}
});
