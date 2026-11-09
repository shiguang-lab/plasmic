import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type {
  CopilotInteraction,
  CopilotType,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import type { CopilotInteractionId } from "@/wab/shared/ApiSchema";
import { useStore } from "zustand";

/**
 * Copilot prompt history and per-interaction feedback.
 *
 * Replaces `StudioCtx._copilotHistory` and `_copilotFeedbackByInteractionId`
 * (`observable.map`). These are keyed maps, so the reading hooks take a key and
 * must return a stable reference for missing keys.
 */
export interface CopilotSnapshot {
  readonly history: Readonly<Record<string, readonly CopilotInteraction[]>>;
  readonly feedback: Readonly<Record<string, boolean>>;
}

export function createCopilotStore() {
  return createStudioStore<CopilotSnapshot>(
    () => ({ history: {}, feedback: {} }),
    { name: "studio-copilot" },
  );
}

export type CopilotStore = ReturnType<typeof createCopilotStore>;

/** Shared so a missing key never produces a new array on every render. */
const EMPTY_HISTORY: readonly CopilotInteraction[] = Object.freeze([]);

/** Reactive, parameterized read of one prompt type's history. */
const emptyCopilotStore = createCopilotStore();

export function useCopilotHistory<T = unknown>(
  studio: StudioCtx,
  type: CopilotType,
): CopilotInteraction<T>[] {
  return useStore(
    resolveStore(studio.copilotStore, emptyCopilotStore),
    (state) =>
      (state.history[type] ?? EMPTY_HISTORY) as CopilotInteraction<T>[],
  );
}

/** Reactive read of the saved feedback for one interaction. */
export function useCopilotFeedback(
  studio: StudioCtx,
  id: CopilotInteractionId | undefined,
): boolean | undefined {
  return useStore(resolveStore(studio.copilotStore, emptyCopilotStore), (state) =>
    id === undefined ? undefined : state.feedback[id],
  );
}
