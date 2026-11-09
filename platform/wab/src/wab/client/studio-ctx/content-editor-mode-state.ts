import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import { useStore } from "zustand";

/**
 * Toggled "content editor" mode.
 *
 * Replaces `StudioCtx._contentEditorMode` (`observable.box`). The effective mode
 * is still composite — an editor whose role is content creator, or the dev flag,
 * also enables it — so both the getter and the hook OR in those static terms.
 */
export interface ContentEditorModeSnapshot {
  readonly mode: boolean;
}

export function createContentEditorModeStore() {
  return createStudioStore<ContentEditorModeSnapshot>(() => ({ mode: false }), {
    name: "studio-content-editor-mode",
  });
}

export type ContentEditorModeStore = ReturnType<
  typeof createContentEditorModeStore
>;

/** The toggled mode has its own native subscription boundary. */
const fallbackModeStore = createContentEditorModeStore();

export function setContentEditorMode(studio: StudioCtx, mode: boolean): void {
  const store = resolveStore(studio.contentEditorModeStore, fallbackModeStore);
  if (store.getState().mode === mode) {
    return;
  }
  store.setState({ mode });
}

/** Reactive read for menus and panels that change with the mode. */
export function useContentEditorMode(studio: StudioCtx): boolean {
  const toggled = useStore(
    resolveStore(studio.contentEditorModeStore, fallbackModeStore),
    (state) => state.mode,
  );
  const contentCreator =
    typeof studio.isContentEditor === "function" && studio.isContentEditor();
  return toggled || contentCreator || DEVFLAGS.contentEditorMode;
}
