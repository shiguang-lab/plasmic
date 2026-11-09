import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type {
  EditingTextContext,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import { useStore } from "zustand";

/**
 * The canvas text editor's editing context (value, variant setting, draft text).
 *
 * Replaces `ViewCtx._editingTextContext` (`observable.box`). Written by the
 * canvas editing path, read by overlays that must hide while text is edited.
 */
export interface EditingTextSnapshot {
  readonly editingTextContext: EditingTextContext | null;
}

export function createEditingTextStore() {
  return createStudioStore<EditingTextSnapshot>(
    () => ({ editingTextContext: null }),
    { name: "view-editing-text" },
  );
}

export type EditingTextStore = ReturnType<typeof createEditingTextStore>;

const emptyEditingText = createEditingTextStore();

/** Reactive read; `null` while no text is being edited. */
export function useEditingTextContext(
  view: ViewCtx | undefined,
): EditingTextContext | null {
  return useStore(
    resolveStore(view?.editingTextStore, emptyEditingText),
    (state) => state.editingTextContext,
  );
}

/** Imperative write used by the editing path. */
export function setEditingTextContext(
  view: ViewCtx,
  context: EditingTextContext | null,
): void {
  if (view.editingTextStore.getState().editingTextContext === context) {
    return;
  }
  view.editingTextStore.setState({ editingTextContext: context });
}
