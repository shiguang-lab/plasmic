import { plasmicIFrameWheelEvent } from "@/wab/client/definitions/events";
import { isContextMenuDescendant, isDescendant } from "@/wab/client/dom-utils";
import { RefObject, useEffect, useEffectEvent, useMemo } from "react";

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
  const studio = useMemo(() => document.querySelector(".studio"), []);
  const onDismissEvent = useEffectEvent((e: Event) => {
    if (e.type === "keydown" && (e as any).key !== "Escape") {
      return;
    }

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
      return e.stopPropagation();
    }

    // Should NOT dismiss if the event target
    // is a context menu item
    if (e.target instanceof HTMLElement && isContextMenuDescendant(e.target)) {
      return e.stopPropagation();
    }

    onDismiss(e);
  });

  useEffect(() => {
    const dismiss = (event: Event) => onDismissEvent(event);
    studio?.addEventListener("wheel", dismiss);
    const events = ["mousedown", "keydown", "wheel", "contextmenu", plasmicIFrameWheelEvent];
    events.forEach((name) => document.addEventListener(name, dismiss));
    return () => {
      studio?.removeEventListener("wheel", dismiss);
      events.forEach((name) => document.removeEventListener(name, dismiss));
    };
  }, [studio]);
}
