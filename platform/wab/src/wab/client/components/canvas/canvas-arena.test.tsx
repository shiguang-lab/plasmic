import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { CanvasArenaShell } from "@/wab/client/components/canvas/canvas-arena";
import { mkMixedArena } from "@/wab/shared/Arenas";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("updates only the affected arena shell and retains its DOM across background and cached states", async () => {
  const site = createSite();
  const first = mkMixedArena("First");
  const second = mkMixedArena("Second");
  site.arenas.push(first, second);
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.arenaState.transaction(() => {
    studioCtx.arenaState.activate(first, 1);
    studioCtx.currentArena = first;
  });
  const firstCommits = vi.fn();
  const { container, unmount } = render(<>
    <React.Profiler id="first" onRender={firstCommits}>
      <CanvasArenaShell studioCtx={studioCtx} arena={first} onFrameLoad={vi.fn()} />
    </React.Profiler>
    <CanvasArenaShell studioCtx={studioCtx} arena={second} onFrameLoad={vi.fn()} />
  </>);
  const firstShell = container.querySelector(`[data-arena-uid="${first.uid}"]`);
  const secondShell = container.querySelector(`[data-arena-uid="${second.uid}"]`);
  expect(firstShell?.classList.contains("canvas-editor__frames")).toBe(true);
  expect(secondShell?.classList.contains("display-none")).toBe(true);
  const count = firstCommits.mock.calls.length;
  act(() => studioCtx.ensureArenaAliveInBackground(second));
  expect(secondShell?.classList.contains("canvas-editor__frames--background")).toBe(true);
  expect(firstCommits).toHaveBeenCalledTimes(count);
  act(() => studioCtx.arenaState.transaction(() => {
    studioCtx.arenaState.activate(second, 2);
    studioCtx.currentArena = second;
  }));
  expect(container.querySelector(`[data-arena-uid="${first.uid}"]`)).toBe(firstShell);
  expect(firstShell?.classList.contains("display-none")).toBe(true);
  expect(secondShell?.classList.contains("canvas-editor__frames--background")).toBe(false);
  expect(secondShell?.classList.contains("canvas-editor__frames")).toBe(true);
  unmount();
  studioCtx.dispose();
});

it("renders a retained shell as dead when Studio closes its model owner", async () => {
  const site = createSite();
  const arena = mkMixedArena("Retained");
  site.arenas.push(arena);
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.currentArena = arena;
  const status = studioCtx.arenaState.statusStore(arena);
  const { container, rerender } = render(<CanvasArenaShell studioCtx={studioCtx} arena={arena} onFrameLoad={vi.fn()} />);
  expect(container.querySelector(`[data-arena-uid="${arena.uid}"]`)?.classList.contains("canvas-editor__frames")).toBe(true);
  act(() => studioCtx.dispose());
  expect(status.getState()).toBe("dead");
  expect(studioCtx.arenaState.statusStore(arena)).toBe(status);
  expect(() => rerender(<CanvasArenaShell studioCtx={studioCtx} arena={arena} onFrameLoad={vi.fn()} />)).not.toThrow();
  const shell = container.querySelector(`[data-arena-uid="${arena.uid}"]`);
  expect(shell?.classList.contains("display-none")).toBe(true);
  expect(shell?.childElementCount).toBe(0);
});
