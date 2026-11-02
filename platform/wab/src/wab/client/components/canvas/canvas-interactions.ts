import { PLATFORM } from "@/wab/client/platform";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";

/** The same modifier drives direct selection and native canvas interactions. */
export function isCanvasModifierPressed(
  event: { metaKey?: boolean; ctrlKey?: boolean },
) {
  return !!(PLATFORM === "osx" ? event.metaKey : event.ctrlKey);
}

export function isCanvasInteractionClick(event?: {
  type?: string;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}) {
  return (
    !!event &&
    event.type === "click" &&
    event.button === 0 &&
    isCanvasModifierPressed(event) &&
    !event.altKey &&
    !event.shiftKey
  );
}

/** Installing a handler must not enable ordinary editing or initialization events. */
export function wrapCanvasEventHandler(
  viewCtx: ViewCtx,
  handler: (...args: any[]) => any,
) {
  return (...args: any[]) => {
    if (
      viewCtx.studioCtx.isInteractiveMode ||
      isCanvasInteractionClick(args[0]?.nativeEvent ?? args[0])
    ) {
      return handler(...args);
    }
    return undefined;
  };
}

/** Ordinary editing clicks select; modifier clicks may run the authored click handler. */
export function absorbEditingCanvasEvent(
  event: Event | JQuery.UIEventBase,
  viewCtx: ViewCtx,
) {
  if (
    viewCtx.studioCtx.isLiveMode ||
    viewCtx.studioCtx.isInteractiveMode ||
    viewCtx.viewOps.isEditing(event.target as HTMLElement)
  ) {
    return;
  }
  event.preventDefault();
  const mouse = event as MouseEvent;
  if (isCanvasInteractionClick(mouse)) {
    if ((event.target as Element).classList.contains("__wab_canvas_overlay")) {
      // Selection already resolves through this overlay on pointerdown. Route
      // the native UI click through the same canvas hit test, for every widget.
      event.stopImmediatePropagation();
      const target = viewCtx.canvasCtx.getActualTargetUnderCanvasOverlay(
        mouse.clientX, mouse.clientY,
      );
      const win = target?.ownerDocument.defaultView;
      if (target && win) {
        target.dispatchEvent(new win.MouseEvent("click", {
          bubbles: true, cancelable: true, view: mouse.view,
          button: mouse.button, buttons: mouse.buttons, detail: mouse.detail,
          clientX: mouse.clientX, clientY: mouse.clientY,
          screenX: mouse.screenX, screenY: mouse.screenY,
          metaKey: mouse.metaKey, ctrlKey: mouse.ctrlKey,
          altKey: mouse.altKey, shiftKey: mouse.shiftKey,
        }));
      }
    }
    // Let native component UI respond, while suppressing browser navigation
    // and form submission. Ordinary selection clicks remain absorbed.
    return;
  }
  event.stopImmediatePropagation();
}
