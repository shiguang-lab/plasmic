import { subscribeToSelector } from "@/wab/client/stores/store-kit";
import {
  createCursorStore,
  setCursorLocation,
} from "@/wab/client/studio-ctx/cursor-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

/**
 * `cursorLocation` used to be an `observable.box` read only inside the
 * multiplayer view sync. The sync now subscribes to a store instead, so the
 * setter must stay quiet for no-op moves.
 */

function fakeStudio(): StudioCtx {
  return { cursorStore: createCursorStore() } as unknown as StudioCtx;
}

it("notifies when the pointer position changes", () => {
  const studio = fakeStudio();
  const listener = vi.fn();
  subscribeToSelector(studio.cursorStore, (state) => state.cursor, listener);

  setCursorLocation(studio, { left: 1, top: 2 });
  setCursorLocation(studio, { left: 3, top: 4 });
  setCursorLocation(studio, null);

  expect(listener.mock.calls).toEqual([
    [{ left: 1, top: 2 }, null],
    [{ left: 3, top: 4 }, { left: 1, top: 2 }],
    [null, { left: 3, top: 4 }],
  ]);
});

it("ignores the same position and repeated clears", () => {
  const studio = fakeStudio();
  const listener = vi.fn();
  subscribeToSelector(studio.cursorStore, (state) => state.cursor, listener);

  setCursorLocation(studio, { left: 1, top: 2 });
  setCursorLocation(studio, { left: 1, top: 2 });
  setCursorLocation(studio, null);
  setCursorLocation(studio, null);

  expect(listener).toHaveBeenCalledTimes(2);
});

it("stores the latest position for imperative readers", () => {
  const studio = fakeStudio();

  setCursorLocation(studio, { left: 7, top: 8 });

  expect(studio.cursorStore.getState().cursor).toEqual({ left: 7, top: 8 });
});
