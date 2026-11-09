import type { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import type { TplComponent } from "@/wab/shared/model/classes";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { isCodeComponent } from "@/wab/shared/core/components";
import $ from "jquery";

export interface CanvasComponentPart {
  tpl: TplComponent;
  name: string;
  displayName: string;
  selector: string;
  props: string[];
  text?: { prop: string; selector: string };
  element: HTMLElement;
}

export function findCanvasComponentPart(
  target: Element,
  owner: Element,
  tpl: TplComponent,
  parts: CodeComponentMeta<any>["canvasParts"],
): CanvasComponentPart | undefined {
  for (const [name, part] of Object.entries(parts ?? {})) {
    const element = target.closest<HTMLElement>(part.selector);
    if (element && owner.contains(element)) {
      return { ...part, name, tpl, element };
    }
  }
  return undefined;
}

/** Slot content belongs to the consuming page, so its nearest tagged node is
 * not necessarily the code component that owns the protected region. */
export function getCanvasComponentPartTarget(viewCtx: ViewCtx, target: Element) {
  for (let element: Element | null = target; element; element = element.parentElement) {
    const owner = viewCtx.dom2focusObj($(element));
    if (!(owner instanceof ValComponent) || !isCodeComponent(owner.tpl.component)) {
      continue;
    }
    const part = findCanvasComponentPart(
      target, element, owner.tpl,
      viewCtx.getCodeComponentMeta(owner.tpl.component)?.canvasParts,
    );
    if (part) {
      return { owner, part };
    }
  }
  return undefined;
}
