import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStore } from "zustand";

/**
 * Synthetic (fake, session-only) insert-panel sections the user chose to reveal.
 *
 * Replaces `StudioCtx.shownSyntheticSections` (`observable.map`), which was read
 * during the insert panel render and mutated from the add drawer.
 */
export interface SyntheticSectionsSnapshot {
  readonly shown: Readonly<Record<string, boolean>>;
}

export function createSyntheticSectionsStore() {
  return createStudioStore<SyntheticSectionsSnapshot>(
    () => ({ shown: {} }),
    { name: "studio-synthetic-sections" },
  );
}

export type SyntheticSectionsStore = ReturnType<
  typeof createSyntheticSectionsStore
>;

/** Reactive read for one section key. */
const emptySyntheticSectionsStore = createSyntheticSectionsStore();

export function useSyntheticSectionShown(
  studio: StudioCtx,
  key: string,
): boolean {
  return useStore(
    resolveStore(studio.syntheticSectionsStore, emptySyntheticSectionsStore),
    (state) => state.shown[key] ?? false,
  );
}

/** Imperative write used by the add drawer. */
export function showSyntheticSection(studio: StudioCtx, key: string): void {
  if (studio.syntheticSectionsStore.getState().shown[key]) {
    return;
  }
  studio.syntheticSectionsStore.setState((state) => ({
    shown: { ...state.shown, [key]: true },
  }));
}
