import type { CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import type { ArenaFrame, RuleSet, TplNode } from "@/wab/shared/model/classes";
import { isTplVariantable } from "@/wab/shared/core/tpls";

/** Label layout classification and stretch-root exclusion for a drop target. */
export function dndMarkerModelFields(field: Parameters<CanvasViewFieldRecipe>[0], frame: ArenaFrame, tpl: TplNode | undefined) {
  field(frame, "viewMode", "container");
  field(frame.container, "component"); field(frame.container.component, "tplTree");
  if (!tpl || !isTplVariantable(tpl)) { return; }
  const seen = new Set<RuleSet>();
  const rules = (rs: RuleSet) => {
    if (seen.has(rs)) { return; } seen.add(rs); field(rs, "values", "mixins");
    rs.mixins.forEach((mixin) => {
      field(mixin, "rs", "variantedRs"); rules(mixin.rs);
      mixin.variantedRs.forEach((setting) => { field(setting, "variants", "rs"); rules(setting.rs); });
    });
  };
  field(tpl, "vsettings");
  tpl.vsettings.forEach((setting) => { field(setting, "rs", "variants"); rules(setting.rs); });
}
