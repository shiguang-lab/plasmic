import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStore } from "zustand";

/**
 * Last executed values of `$steps`, keyed by interaction uuid.
 *
 * Replaces `StudioCtx.$stepsCache` (`observable.map`). The canvas writes while
 * previewing interactions; the state-management panel reads to show the current
 * value and whether a step has ever been played.
 */
export interface StepsCacheSnapshot {
  readonly values: Readonly<Record<string, unknown>>;
  /** Bumped on every write so callers can re-render without a keyed selector. */
  readonly version: number;
}

export function createStepsCacheStore() {
  return createStudioStore<StepsCacheSnapshot>(
    () => ({ values: {}, version: 0 }),
    { name: "studio-steps-cache" },
  );
}

export type StepsCacheStore = ReturnType<typeof createStepsCacheStore>;

const emptyStepsCache = createStepsCacheStore();

export function saveStepsCacheValue(
  studio: StudioCtx,
  interactionUuid: string,
  value: unknown,
): void {
  studio.stepsCacheStore.setState((state) => ({
    values: { ...state.values, [interactionUuid]: value },
    version: state.version + 1,
  }));
}

/** Reactive: has this step ever been played in this session? */
export function useHasCachedStepValue(
  studio: StudioCtx,
  interactionUuid: string,
): boolean {
  return useStore(
    studio.stepsCacheStore,
    (state) => state.values[interactionUuid] !== undefined,
  );
}

/** Reactive: the last played value for this step. */
export function useCachedStepValue(
  studio: StudioCtx,
  interactionUuid: string,
): unknown {
  return useStore(
    studio.stepsCacheStore,
    (state) => state.values[interactionUuid],
  );
}

/**
 * Coarse subscription for call sites that look values up per row during render
 * (and therefore cannot call a hook per key).
 */
export function useStepCacheVersion(studio: StudioCtx | undefined): number {
  return useStore(
    resolveStore(studio?.stepsCacheStore, emptyStepsCache),
    (state) => state.version,
  );
}
