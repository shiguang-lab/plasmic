import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import { isWithinKeyboardInteractiveElement } from "@/wab/client/dom-utils";
import { hasStudioCommandBarrier } from "@/wab/client/hooks/useStudioEscape";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";

export function isStudioDesignInputEnabled(studio: StudioCtx) {
  return studio.isDevMode && !studio.isInteractiveMode;
}

export function canHandleStudioModelInput(
  studio: StudioCtx,
  doc: Document = document,
) {
  return (
    isStudioDesignInputEnabled(studio) &&
    isModelInputFocused(doc) &&
    !hasStudioCommandBarrier(doc) &&
    !isAnyModalOpen() &&
    !studio.isBottomModalFocused()
  );
}

/** Active input belongs to the mode, arena and model owner where it began. */
export function onStudioInputContextChange(
  studio: StudioCtx,
  reset: () => void,
) {
  const lifetime = studio.arenaState.lifetime();
  const stopMode = studio.renderPolicy.store.subscribe((next, previous) => {
    if (
      next.interactive !== previous.interactive ||
      next.devMode !== previous.devMode
    ) {
      reset();
    }
  });
  const stopArena = studio.arenaState.store.subscribe((next, previous) => {
    if (next.current !== previous.current) {
      reset();
    }
  });
  lifetime.addEventListener("abort", reset, { once: true });
  return () => {
    stopMode();
    stopArena();
    lifetime.removeEventListener("abort", reset);
  };
}

/** Native focus identifies the model command surface; body is never one. */
export function isModelInputFocused(doc: Document = document) {
  const active = doc.activeElement;
  return !!active?.matches(
    "[data-studio-model-input], [data-studio-model-input] > [data-overlayscrollbars-viewport]",
  );
}

export function focusModelInput(root: HTMLElement, target: EventTarget | null) {
  const element =
    target && "nodeType" in target && (target as Node).nodeType === 1
      ? (target as Element)
      : undefined;
  if (
    !element ||
    !root.contains(element) ||
    isWithinKeyboardInteractiveElement(element) ||
    element.closest("button,a,select,[role=button]")
  ) {
    return;
  }
  root.ownerDocument.getSelection()?.removeAllRanges();
  root.focus({ preventScroll: true });
}
