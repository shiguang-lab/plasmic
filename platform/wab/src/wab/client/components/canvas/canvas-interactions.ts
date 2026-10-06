import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";

/** Canvas selection must not invoke runtime handlers, except while editing text. */
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
  event.stopImmediatePropagation();
}
