import type { CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { flattenComponent } from "@/wab/shared/cached-selectors";
import { isKnownTplTag, isKnownTplSlot, isKnownTplComponent, isKnownRenderExpr, type Component } from "@/wab/shared/model/classes";

/** Slot membership depends on tree/argument topology, not unrelated node styles. */
export function canvasSlotFields(component: Component | undefined, field: Parameters<CanvasViewFieldRecipe>[0]) {
  if (!component) { return; }
  field(component, "params", "tplTree");
  component.params.forEach((param) => field(param, "type"));
  flattenComponent(component).forEach((tpl) => {
    if (isKnownTplTag(tpl)) { field(tpl, "children"); }
    else if (isKnownTplSlot(tpl)) { field(tpl, "defaultContents", "param"); }
    else if (isKnownTplComponent(tpl)) {
      field(tpl, "vsettings");
      tpl.vsettings.forEach((setting) => {
        field(setting, "args");
        setting.args.forEach((arg) => { field(arg, "expr"); if (isKnownRenderExpr(arg.expr)) { field(arg.expr, "tpl"); } });
      });
    }
  });
}
