import { maybeMkSemVerSiteElement } from "@/wab/shared/site-diffs";
import { noCanvasModelFields, useCanvasComponentInputs, useCanvasComponentValue, useCanvasViewInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isTplNamable } from "@/wab/shared/core/tpls";
import { isKnownTplSlot, type TplNode } from "@/wab/shared/model/classes";
import * as React from "react";

/** Comment labels and ownership need names and ancestor links, never CSS. */
export function commentMarkerRecipe(tpl: TplNode): CanvasViewFieldRecipe {
  return field => {
    for (let node: TplNode | null | undefined = tpl; node; node = node.parent) {field(node, "parent");}
    if (isKnownTplSlot(tpl)) {field(tpl, "param"); field(tpl.param, "variable"); field(tpl.param.variable, "name");}
    else if (isTplNamable(tpl)) {field(tpl, "name");}
  };
}
export function useCommentMarkerOwner(view: ViewCtx, tpl: TplNode) {
  const studio = view.studioCtx;
  const world = useVariantModelWorld(studio, tpl, view);
  const recipe = React.useMemo(() => commentMarkerRecipe(tpl), [tpl]);
  const fields = useCanvasComponentInputs(studio, tpl, recipe);
  const runtime = useCanvasViewInputs(view, noCanvasModelFields);
  const item = useCanvasComponentValue(studio, tpl, recipe, () => maybeMkSemVerSiteElement(tpl));
  const isCurrent = React.useCallback(() => world.models === studio.modelSnapshots && world.isCurrent(view), [world, studio, view]);
  return {alive: fields.alive && runtime.alive, isCurrent, item};
}
