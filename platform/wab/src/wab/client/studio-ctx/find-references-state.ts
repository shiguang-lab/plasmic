import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type {
  Component,
  DataToken,
  StyleToken,
} from "@/wab/shared/model/classes";
import { useStore } from "zustand";

/**
 * "Find references" target for the left pane modal.
 *
 * Replaces three `observable.box` fields on StudioCtx. Only the left pane reads
 * them reactively; everything else just sets the target.
 */
export interface FindReferencesSnapshot {
  readonly component: Component | undefined;
  readonly styleToken: StyleToken | undefined;
  readonly dataToken: DataToken | undefined;
}

export function createFindReferencesStore() {
  return createStudioStore<FindReferencesSnapshot>(
    () => ({
      component: undefined,
      styleToken: undefined,
      dataToken: undefined,
    }),
    { name: "studio-find-references" },
  );
}

export type FindReferencesStore = ReturnType<typeof createFindReferencesStore>;

/** The currently requested target, if any. */
const emptyFindReferencesStore = createFindReferencesStore();

export function useFindReferencesTarget(
  studio: StudioCtx,
): Component | StyleToken | DataToken | undefined {
  return useStore(
    resolveStore(studio.findReferencesStore, emptyFindReferencesStore),
    (state) => state.component ?? state.styleToken ?? state.dataToken,
  );
}
