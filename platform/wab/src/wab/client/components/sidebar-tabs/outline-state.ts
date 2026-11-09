import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import { useStore } from "zustand";
import type { Matcher } from "@/wab/client/components/view-common";
import type { OutlineNodeKey } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import type { AnyArena } from "@/wab/shared/Arenas";
import type { ArenaFrame } from "@/wab/shared/model/classes";

/**
 * Outline UI state for one `OutlineCtx` (or one nested frame outline).
 *
 * Replaces six `observable` containers in `OutlineCtx`. Every mutation replaces
 * the immutable value and bumps `version`, so consumers can subscribe once and
 * re-read through the class accessors.
 */
export interface OutlineStateSnapshot {
  readonly expandedFrames: ReadonlyMap<ArenaFrame, boolean>;
  readonly visible: ReadonlySet<string>;
  readonly expanded: ReadonlyMap<OutlineNodeKey, boolean>;
  readonly query: string;
  readonly matcher: Matcher;
  readonly lastViewedArtboard:
    | { arena: AnyArena; frame: ArenaFrame }
    | undefined;
  /** Bumped on every write; used as a cheap change signal. */
  readonly version: number;
}

export function createOutlineStateStore(initialMatcher: Matcher) {
  return createStudioStore<OutlineStateSnapshot>(
    () => ({
      expandedFrames: new Map(),
      visible: new Set(),
      expanded: new Map(),
      query: "",
      matcher: initialMatcher,
      lastViewedArtboard: undefined,
      version: 0,
    }),
    { name: "studio-outline" },
  );
}

export type OutlineStateStore = ReturnType<typeof createOutlineStateStore>;

export function patchOutlineState(
  store: OutlineStateStore,
  patch: Partial<
    Omit<OutlineStateSnapshot, "version">
  >,
): void {
  const state = store.getState();
  store.setState({ ...patch, version: state.version + 1 });
}

/**
 * Subscribe a component to all outline UI state.
 *
 * Coarse on purpose: expansion, visibility and search all feed one tree render,
 * so any change should re-render the outline.
 */
export function useOutlineVersion(store: OutlineStateStore | undefined): number {
  return useStore(
    resolveStore(store, emptyOutlineStore),
    (state) => state.version,
  );
}

const emptyOutlineStore = createOutlineStateStore({
  matches: () => false,
} as unknown as Matcher);
