import { hasLayoutBox } from "@/wab/client/dom";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ValNode } from "@/wab/shared/core/val-nodes";
import $ from "jquery";

/** The active modal boundary belongs to one artboard document. */
export function getActiveCanvasModal(doc: Document | undefined) {
  return doc && Array.from(
    doc.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
  ).reverse().find((element) => {
    const style = doc.defaultView?.getComputedStyle(element);
    return hasLayoutBox(element) && style?.visibility !== "hidden";
  });
}

/** Background roots may remain mounted behind portaled modal content. */
export function filterCanvasModalElements(elements: JQuery<HTMLElement>) {
  const modal = getActiveCanvasModal(elements[0]?.ownerDocument);
  return modal
    ? elements.filter((_, element) => modal.contains(element))
    : elements;
}

/** A portaled component can register its root outside the dialog DOM itself. */
export function getCanvasModalSelectionRoot(viewCtx: ViewCtx, modal: HTMLElement) {
  for (let element: HTMLElement | null = modal; element; element = element.parentElement) {
    const selectable = viewCtx.dom2focusObj($(element));
    const val = selectable instanceof ValNode ? selectable : selectable?.val;
    if (val && viewCtx.selectionDom(val, viewCtx.sel2cloneKey(val))?.toArray().some(
      (root) => root === modal || root.contains(modal),
    )) {
      return val;
    }
  }
  return undefined;
}
