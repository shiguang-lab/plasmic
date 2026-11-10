import { collectComponentParamFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Component } from "@/wab/shared/model/classes";
import * as React from "react";

/** Panel-only inputs augment the shared preview variant catalog: inheritance,
 * editable state contracts, dependency captions and the active breakpoint group. */
export function useVariantPanelInputs(studio: StudioCtx, component: Component) {
  const world = useVariantModelWorld(studio, component);
  const source = React.useMemo(() => createVariantPanelInputsSource(world, studio, component), [world, studio, component]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createVariantPanelInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], component: Parameters<typeof useVariantPanelInputs>[1]) {
  return new ModelFieldInputs({ models: world.models, lifetime: world.lifetime,
    isCurrent: () => world.studio === studio && world.isCurrent() }, (field) => {
      collectComponentParamFields(component, field);
      const seen = new Set<Component>(); let owner: Component | null | undefined = component;
      while (owner && !seen.has(owner)) { seen.add(owner); field(owner, "superComp"); owner = owner.superComp; }
      field(component, "variantGroups"); component.variantGroups.forEach((group) => { field(group, "linkedState"); if (group.linkedState) { field(group.linkedState, "accessType"); } });
      field(world.site, "activeScreenVariantGroup", "projectDependencies"); world.site.projectDependencies.forEach((dependency) => field(dependency, "name"));
  });
}
