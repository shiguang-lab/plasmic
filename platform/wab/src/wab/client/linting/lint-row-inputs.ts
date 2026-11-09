import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { capitalizeFirst } from "@/wab/shared/strs";
import { useCanvasComponentValue, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTplNamable, isTplSlot, summarizeTpl } from "@/wab/shared/core/tpls";
import { type Component, type TplNode, type VariantSetting, type Param, type Expr, isKnownTplComponent, isKnownTplSlot, isKnownTplTag, isKnownCustomCode, isKnownTemplatedString, isKnownCompositeExpr } from "@/wab/shared/model/classes";
import * as React from "react";

/** Issue links read names and input classification, not rendered CSS or trees. */
export function lintRowRecipe(component: Component, tpl?: TplNode, setting?: VariantSetting, param?: Param): CanvasViewFieldRecipe {
  return (field) => {
    field(component, "name", "type", "tplTree");
    if (param) {field(param, "variable"); field(param.variable, "name");}
    const literal = (expr: Expr) => {
      if (isKnownCustomCode(expr)) {field(expr, "code");}
      else if (isKnownTemplatedString(expr)) {field(expr, "text");}
      else if (isKnownCompositeExpr(expr)) {field(expr, "hostLiteral", "substitutions"); Object.values(expr.substitutions).forEach(literal);}
    };
    if (tpl) {
      if (isTplNamable(tpl)) {field(tpl, "name");}
      if (isKnownTplComponent(tpl)) {
        field(tpl, "component"); field(tpl.component, "name", "type", "codeComponentMeta");
        if (tpl.component.codeComponentMeta) {field(tpl.component.codeComponentMeta, "displayName");}
      } else if (isKnownTplSlot(tpl)) {field(tpl, "param"); field(tpl.param, "variable"); field(tpl.param.variable, "name");}
      else if (isKnownTplTag(tpl)) {
        field(tpl, "tag", "type");
        if (tpl.tag === "input") {
          field(tpl, "vsettings"); tpl.vsettings.forEach((value) => {
            field(value, "variants", "attrs"); value.variants.forEach((variant) => field(variant, "name"));
            if (value.attrs.type) {literal(value.attrs.type);}
          });
        }
      }
    }
    if (setting) {field(setting, "variants");}
  };
}
type TplCaption = { readonly kind: "named" | "slot" | "summary"; readonly text: string };

function captureLintRow(component: Component, tpl?: TplNode, setting?: VariantSetting, param?: Param) {
  const tplCaption: TplCaption | undefined = !tpl ? undefined
    : isTplNamable(tpl) && tpl.name ? Object.freeze({kind: "named", text: tpl.name})
    : isTplSlot(tpl) ? Object.freeze({kind: "slot", text: tpl.param.variable.name})
    : Object.freeze({kind: "summary", text: capitalizeFirst(summarizeTpl(tpl))});
  return Object.freeze({
    componentName: component.name, componentType: component.type, tplCaption,
    paramName: param?.variable.name,
    variants: Object.freeze(setting?.variants.slice() ?? []),
  });
}

export function useLintRowInputs(studio: StudioCtx, component: Component, tpl?: TplNode, setting?: VariantSetting, param?: Param) {
  const world = useVariantModelWorld(studio, component);
  const recipe = React.useMemo(() => lintRowRecipe(component, tpl, setting, param), [component, tpl, setting, param]);
  const capture = React.useCallback(() => captureLintRow(component, tpl, setting, param), [component, tpl, setting, param]);
  const data = useCanvasComponentValue(studio, component, recipe, capture);
  return {data, isCurrent: world.isCurrent};
}
