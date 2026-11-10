import { plasmicIFrameWheelEvent } from "@/wab/client/definitions/events";
import { isContextMenuDescendant, isDescendant } from "@/wab/client/dom-utils";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { RefObject, useEffect, useEffectEvent, useRef } from "react";

/**
 * Makes it possible to monitor dismissing events on the
 * Studio UI for a given overlay element
 *
 * @param onDismiss   Will be called when any dismiss event is triggered
 * @param overlayRef  DOM reference to the overlay root element
 * @param isOpen      Tells the hook whether the overlay is open or not
 */
export function useDismissibleStudioOverlay({
  onDismiss,
  overlayRef,
  isOpen = true,
}: {
  onDismiss: (e: Event) => any;
  isOpen?: boolean;
  overlayRef?: RefObject<HTMLElement | null>;
}) {
  const emptyRef = useRef<HTMLElement>(null);
  // A docked panel owns Escape without disabling commands on the canvas.
  useStudioEscape(overlayRef ?? emptyRef, isOpen, onDismiss, false);
  const onDismissEvent = useEffectEvent((e: Event) => {
    if (!isOpen) {
      return;
    }

    // Should NOT dismiss if the event target
    // is descendant of the overlay container
    if (
      overlayRef?.current &&
      e.target instanceof Element &&
      isDescendant({
        parent: overlayRef.current,
        child: e.target,
      })
    ) {
      return;
    }

    // Should NOT dismiss if the event target
    // is a context menu item
    if (e.target instanceof HTMLElement && isContextMenuDescendant(e.target)) {
      return;
    }

    onDismiss(e);
  });

  useEffect(() => {
    const dismiss = (event: Event) => onDismissEvent(event);
    const doc = overlayRef?.current?.ownerDocument ?? document;
    const events = ["mousedown", "wheel", "contextmenu", plasmicIFrameWheelEvent];
    events.forEach((name) => doc.addEventListener(name, dismiss));
    return () => {
      events.forEach((name) => doc.removeEventListener(name, dismiss));
    };
  }, [overlayRef]);
}
