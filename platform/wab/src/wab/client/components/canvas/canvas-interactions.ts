import { PLATFORM } from "@/wab/client/platform";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";

/** The same modifier drives direct selection and native canvas interactions. */
export function isCanvasModifierPressed(
  event: { metaKey?: boolean; ctrlKey?: boolean },
) {
  return !!(PLATFORM === "osx" ? event.metaKey : event.ctrlKey);
}

/** Authored runtime handlers stay excluded by canvas rendering in edit mode. */
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
  if (
    event.type === "click" && mouse.button === 0 &&
    isCanvasModifierPressed(mouse) && !mouse.altKey && !mouse.shiftKey
  ) {
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
