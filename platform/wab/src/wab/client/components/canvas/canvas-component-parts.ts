import type { CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import type { TplComponent } from "@/wab/shared/model/classes";

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
