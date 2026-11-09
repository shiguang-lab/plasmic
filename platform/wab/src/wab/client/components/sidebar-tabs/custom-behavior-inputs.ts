import { noCanvasModelFields, useCanvasComponentInputs, useCanvasViewInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isTplComponent } from "@/wab/shared/core/tpls";
import type { Component, TplNode } from "@/wab/shared/model/classes";
import * as React from "react";

/** Attachment ancestors and the direct component-store catalog, not canvas content. */
export function customBehaviorRecipe(view: ViewCtx, tpl: TplNode): CanvasViewFieldRecipe {
  return (field) => {
    const components = new Set<Component>();
    const component = (value: Component) => {
      if (components.has(value)) {return;} components.add(value);
      field(value, "uuid", "name", "type", "codeComponentMeta");
      if (value.codeComponentMeta) {field(value.codeComponentMeta, "isAttachment", "isHostLess", "displayName");}
    };
    for (let ancestor: TplNode | null | undefined = tpl; ancestor; ancestor = ancestor.parent) {
      field(ancestor, "parent");
      if (isTplComponent(ancestor)) {field(ancestor, "component"); component(ancestor.component);}
    }
    const site = view.studioCtx.site;
    field(site, "components", "projectDependencies"); site.components.forEach(component);
    site.projectDependencies.forEach((dep) => {
      field(dep, "projectId", "site"); field(dep.site, "hostLessPackageInfo", "components");
      dep.site.components.forEach(component);
    });
  };
}
export function useCustomBehaviorInputs(view: ViewCtx, tpl: TplNode) {
  const studio = view.studioCtx;
  const world = React.useMemo(() => ({models: studio.modelSnapshots, lifetime: studio.arenaState.lifetime()}), [studio, tpl]);
  const recipe = React.useMemo(() => customBehaviorRecipe(view, tpl), [view, tpl]);
  const fields = useCanvasComponentInputs(studio, tpl, recipe);
  const runtime = useCanvasViewInputs(view, noCanvasModelFields);
  const isCurrent = React.useCallback(() => !world.lifetime.aborted && !view.disposeSignal.aborted && world.models === studio.modelSnapshots, [studio, view, world]);
  return {alive: fields.alive && runtime.alive, isCurrent};
}
