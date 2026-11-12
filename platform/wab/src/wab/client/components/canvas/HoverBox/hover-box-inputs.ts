import type { CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasVariantChromeFields } from "@/wab/client/components/canvas/canvas-variant-chrome-inputs";
import type { HoverBoxTarget } from "@/wab/client/components/canvas/HoverBox/computeHoverBoxViewStates";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isTplVariantable } from "@/wab/shared/core/tpls";
import { isKnownArenaFrame, isKnownTplComponent, isKnownTplTag, isKnownTplSlot, type RuleSet, type TplNode } from "@/wab/shared/model/classes";

/** Authored chrome inputs; themed/resolved CSS stays with the native style owner. */
export function hoverBoxModelFields(view: ViewCtx, target: HoverBoxTarget, field: Parameters<CanvasViewFieldRecipe>[0]) {
  const frame = isKnownArenaFrame(target) ? target : view.arenaFrame();
  field(frame, "name", "width", "height", "viewMode", "top", "left", "container", "targetVariants", "pinnedVariants", "targetGlobalVariants", "pinnedGlobalVariants");
  field(frame.container, "component"); field(frame.container.component, "name", "type", "tplTree");
  const tpl = isKnownArenaFrame(target) ? view.valState().maybeValUserRoot()?.tpl : target.focusObj.tpl;
  canvasVariantChromeFields(view.site, view.currentComponent(), tpl, field);
  const seen = new Set<RuleSet>();
  const rules = (rs: RuleSet) => {
    if (seen.has(rs)) { return; } seen.add(rs); field(rs, "values", "mixins");
    rs.mixins.forEach((mixin) => {
      field(mixin, "rs", "variantedRs"); rules(mixin.rs);
      mixin.variantedRs.forEach((setting) => { field(setting, "rs", "variants"); rules(setting.rs); });
    });
  };
  for (let node: TplNode | null | undefined = tpl; node; node = node.parent) {
    field(node, "parent", "locked");
    if (isKnownTplTag(node)) { field(node, "tag", "type", "columnsSetting"); }
    if (isKnownTplComponent(node)) {
      field(node, "component"); field(node.component, "name", "type", "tplTree", "codeComponentMeta");
      if (node.component.codeComponentMeta) { field(node.component.codeComponentMeta, "defaultStyles"); }
    }
    if (isKnownTplSlot(node)) { field(node, "param"); field(node.param, "variable"); field(node.param.variable, "name"); }
    if (isTplVariantable(node)) {
      field(node, "vsettings");
      node.vsettings.forEach((setting) => { field(setting, "variants", "rs", "attrs"); rules(setting.rs); });
    }
  }
}

export const hoverBoxStyleKeys = [
  "width", "height", "min-width", "max-width", "min-height", "max-height", "display", "position",
  "flex-direction", "justify-content", "align-items", "align-self", "align-content", "justify-self", "justify-items",
  ...["top", "right", "bottom", "left"].flatMap((side) => [`margin-${side}`, `padding-${side}`]),
];
