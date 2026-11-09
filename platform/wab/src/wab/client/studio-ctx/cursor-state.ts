import { createStudioStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

/**
 * Pointer position inside the canvas, shared with other players.
 *
 * Replaces `StudioCtx.cursorLocation` (`observable.box`). Nothing renders it
 * directly; the multiplayer view sync subscribes and throttles it.
 */
export interface CursorLocationSnapshot {
  readonly cursor: { readonly left: number; readonly top: number } | null;
}

export function createCursorStore() {
  return createStudioStore<CursorLocationSnapshot>(() => ({ cursor: null }), {
    name: "studio-cursor",
  });
}

export type CursorStore = ReturnType<typeof createCursorStore>;

/** Imperative write; ignores no-op moves so subscribers stay quiet. */
export function setCursorLocation(
  studio: StudioCtx,
  cursor: { left: number; top: number } | null,
): void {
  const previous = studio.cursorStore.getState().cursor;
  if (
    (!previous && !cursor) ||
    (previous && cursor && previous.left === cursor.left && previous.top === cursor.top)
  ) {
    return;
  }
  studio.cursorStore.setState({ cursor });
}
