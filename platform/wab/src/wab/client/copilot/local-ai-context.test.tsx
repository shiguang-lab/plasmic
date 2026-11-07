import { observeLocalAiContext } from "@/wab/client/components/studio/TopFrameObserver";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import type { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CloneBoxes } from "@/wab/client/components/canvas/HoverBox/CloneBoxes";
import { getLocalAiContext, useLocalAiContextInputs } from "@/wab/client/copilot/local-ai-context";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import type { ValTag } from "@/wab/shared/core/val-nodes";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { observer } from "mobx-react";
import React from "react";
import { mock } from "vitest-mock-extended";

let currentStudio: ReturnType<typeof fakeStudioCtx>["studioCtx"];
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => currentStudio }));
vi.mock("@/wab/client/components/canvas/UserBodyObserver", () => ({ useRerenderOnUserBodyChange: () => 0 }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function fixture() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const site = createSite(), mgr = new TplMgr({ site });
  const component = mgr.addComponent({ name: "AI component", type: ComponentType.Plain });
  const frame = mkArenaFrame({ site, component, name: "First", width: 100, height: 100, top: 0, left: 0 });
  const secondFrame = mkArenaFrame({ site, component, name: "Second", width: 100, height: 100, top: 0, left: 0 });
  const arena = mkMixedArena("AI canvas", [frame, secondFrame]); site.arenas.push(arena);
  const { studioCtx: studio } = fakeStudioCtx({ site }); currentStudio = studio;
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.currentArena = arena;
  const first = ensure(studio.tryGetViewCtxForFrame(frame), "First view");
  const second = ensure(studio.tryGetViewCtxForFrame(secondFrame), "Second view");
  for (const view of [first, second]) {
    vi.spyOn(view, "scheduleSync").mockImplementation(() => undefined);
    vi.spyOn(view, "awaitSync").mockResolvedValue();
    vi.spyOn(view, "updateCtxPostChange").mockImplementation(() => undefined);
  }
  studio.selection.set(first, [frame]);
  return { studio, arena, component, first, second, frame, secondFrame };
}

test("AI bridge follows native fences and view ownership, preserves model tracking, and detaches", async () => {
  const { studio, arena, component, first, second, secondFrame } = await fixture();
  const host = mock<HostFrameCtx>();
  Object.defineProperty(host, "history", { value: studio.appCtx.history });
  const preview = new PreviewCtx(host, studio);
  const publish = vi.fn();
  const stop = observeLocalAiContext(studio, () => studio.canEditProject() && studio.showDevControls, publish);
  try {
    expect(publish).toHaveBeenLastCalledWith(getLocalAiContext(studio));
    publish.mockClear();
    studio._savedChangeCounter = studio._changeCounter;
    studio.startUnlogged();
    expect(publish).not.toHaveBeenCalled();
    await studio.changeUnsafe(() => { arena.name = "Live model rename"; });
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "Live model rename" }));
    const beforeFlush = studio._changeCounter;
    studio.stopUnlogged();
    expect(studio._changeCounter).toBe(beforeFlush + 1);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ binding: expect.objectContaining({ changeCounter: beforeFlush + 1 }) }));
    second.selection.setTpls([component.tplTree]);
    studio.selection.set(second, [secondFrame]);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ binding: expect.objectContaining({ frameUuid: secondFrame.uuid, elementUuids: [component.tplTree.uuid] }) }));
    publish.mockClear();
    first.selection.setTpls([component.tplTree]);
    expect(publish).not.toHaveBeenCalled();
    second.selection.setTpls([]);
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ binding: expect.objectContaining({ elementUuids: [] }) }));
    preview.isLive = true;
    expect(publish).toHaveBeenLastCalledWith(undefined);
    preview.isLive = false;
    expect(publish).toHaveBeenLastCalledWith(getLocalAiContext(studio));
    studio.isDocs = true;
    expect(publish).toHaveBeenLastCalledWith(undefined);
    publish.mockClear();
    studio.setFullPageHeightOverride(true);
    expect(publish).not.toHaveBeenCalled();
    preview.isLive = true;
    preview.isLive = false;
    expect(publish).not.toHaveBeenCalled();
    studio.isDocs = false;
    expect(publish).toHaveBeenLastCalledWith(getLocalAiContext(studio));
    studio.editMode = false;
    expect(publish).toHaveBeenLastCalledWith(undefined);
    studio.editMode = true;
    expect(publish).toHaveBeenLastCalledWith(getLocalAiContext(studio));
    stop(); publish.mockClear();
    second.selection.setTpls([component.tplTree]);
    studio.startUnlogged(); studio.stopUnlogged();
    studio.isDocs = true;
    studio.isDocs = false;
    expect(publish).not.toHaveBeenCalled();
  } finally { stop(); preview.dispose(); await studio.awaitEval(); studio.dispose(); }
});

test("AI panel inputs update a stable observer without refreshing on unrelated save state", async () => {
  const { studio, component, first, arena } = await fixture();
  const commits = vi.fn();
  const Probe = observer(function Probe() { useLocalAiContextInputs(studio); return <output>{JSON.stringify(getLocalAiContext(studio))}</output>; });
  const view = render(<React.Profiler id="context" onRender={commits}><Probe /></React.Profiler>);
  try {
    commits.mockClear();
    act(() => { studio.startUnlogged(); });
    expect(commits).not.toHaveBeenCalled();
    await act(async () => { await studio.changeUnsafe(() => { arena.name = "Panel model rename"; }); });
    expect(view.getByRole("status").textContent).toContain("Panel model rename");
    act(() => { first.selection.setTpls([component.tplTree]); });
    expect(view.getByRole("status").textContent).toContain(component.tplTree.uuid);
    act(() => { studio.stopUnlogged(); });
    expect(view.getByRole("status").textContent).toContain(`"changeCounter":${studio._changeCounter}`);
    act(() => { studio.currentArena = null; });
    expect(view.getByRole("status").textContent).toBe("{}");
  } finally { view.unmount(); await studio.awaitEval(); studio.dispose(); }
});

test("CloneBoxes responds to unlogged commands while unrelated save counters leave it quiet", async () => {
  const { studio, first } = await fixture();
  vi.spyOn(first, "focusedSelectable").mockReturnValue(mock<ValTag>());
  const keys = vi.spyOn(first, "selectableToCloneKeys").mockReturnValue([]);
  const view = render(<CloneBoxes />);
  try {
    expect(keys).toHaveBeenCalledOnce(); keys.mockClear();
    act(() => { studio._changeCounter++; });
    expect(keys).not.toHaveBeenCalled();
    act(() => { studio.startUnlogged(); });
    expect(keys).not.toHaveBeenCalled();
    act(() => { studio.stopUnlogged(); });
    expect(keys).toHaveBeenCalledOnce();
  } finally { view.unmount(); await studio.awaitEval(); studio.dispose(); }
});
