import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FocusedModeToolbar } from "@/wab/client/components/studio/FocusedModeToolbar/FocusedModeToolbar";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const calls = vi.hoisted(() => ({ frame: vi.fn<(frame: ArenaFrame) => void>() }));
vi.mock("@/wab/client/components/canvas/VariantsBar", () => ({ VariantsBar: () => <span>Variants</span> }));
vi.mock("@/wab/client/components/canvas/CanvasFrame/CanvasConfigButton", () => ({ CanvasConfigButton: ({ frame }: { frame: ArenaFrame }) => { calls.frame(frame); return <output aria-label="Configured frame">{frame.uid}</output>; } }));
const studios = new Set<StudioCtx>();
afterEach(async () => {
  await act(async () => { cleanup(); });
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); calls.frame.mockClear(); vi.restoreAllMocks();
});
async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  vi.spyOn(ViewCtx.prototype, "awaitSync").mockResolvedValue();
  const { studioCtx: studio } = fakeStudioCtx({ devFlagOverrides: { ccStubs: true } });
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  await studio.changeUnsafe(() => studio.addComponent("Focused card", { type: ComponentType.Plain }));
  await studio.changeUnsafe(() => studio.turnFocusedModeOff());
  const tree = () => <StudioCtxContext.Provider value={studio}><FocusedModeToolbar studioCtx={studio} /></StudioCtxContext.Provider>;
  return { studio, tree };
}
it("shows actual focused mode and keeps the opaque frame synchronized with native selection", async () => {
  const f = await setup();
  const view = render(f.tree());
  expect(document.getElementById("refresh-canvas-btn")).toBeNull();
  await act(async () => { await f.studio.changeUnsafe(() => f.studio.turnFocusedModeOn()); });
  const focusedFrame = ensure(f.studio.arenaState.store.getState().frames[0], "Focused frame ref");
  const frame = f.studio.modelSnapshots.resolve(focusedFrame);
  act(() => { f.studio.setStudioFocusOnFrameContents(frame); });
  expect(document.getElementById("refresh-canvas-btn")).not.toBeNull();
  expect(calls.frame).toHaveBeenLastCalledWith(frame);
  expect(screen.getByLabelText("Configured frame").textContent).toBe(String(frame.uid));
  await act(async () => { await f.studio.changeUnsafe(() => f.studio.turnFocusedModeOff()); });
  expect(document.getElementById("refresh-canvas-btn")).toBeNull();
  view.unmount();
});
it("executes actual refresh cloning and updates after the new View is explicitly selected", async () => {
  const f = await setup();
  await f.studio.changeUnsafe(() => f.studio.turnFocusedModeOn());
  const first = f.studio.modelSnapshots.resolve(ensure(f.studio.arenaState.store.getState().frames[0], "Initial focused frame"));
  f.studio.setStudioFocusOnFrameContents(first);
  render(f.tree());
  fireEvent.click(ensure(document.getElementById("refresh-canvas-btn"), "Refresh arena action"));
  await act(async () => { await f.studio.awaitEval(); });
  const next = f.studio.modelSnapshots.resolve(ensure(f.studio.arenaState.store.getState().frames[0], "Refreshed frame"));
  expect(next).not.toBe(first);
  expect(next.uid).not.toBe(first.uid);
  expect(f.studio.focusedViewCtx()).toBeUndefined();
  expect(screen.queryByLabelText("Configured frame")).toBeNull();
  // Actual refresh/prune does not promise onFrameLoad auto-focus. Exercise the real
  // public selection producer instead of fabricating an automatic ViewCtx handoff.
  act(() => { f.studio.setStudioFocusOnFrameContents(next); });
  expect(calls.frame).toHaveBeenLastCalledWith(next);
  expect(screen.getByLabelText("Configured frame").textContent).toBe(String(next.uid));
});
