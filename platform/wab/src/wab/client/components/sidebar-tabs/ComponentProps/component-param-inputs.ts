import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { ensure } from "@/wab/shared/common";
import { instUtil } from "@/wab/shared/model/InstUtil";
import type { Component, ObjInst, Param } from "@/wab/shared/model/classes";
import * as React from "react";

export function collectComponentParamFields(component: Component, field: (model: ObjInst, ...keys: string[]) => void, selected?: Param) {
      const param = (value: Param) => {
        field(value, ...instUtil.allInstFields(value).map((entry) => entry.name));
        field(value.variable, "name");
        collectPropExpressionFields(value.type, field);
        collectPropExpressionFields(value.defaultExpr, field);
        collectPropExpressionFields(value.previewExpr, field);
      };
      const seen = new Set<Component>();
      const contract = (value: Component) => {
        if (seen.has(value)) { return; } seen.add(value);
        field(value, "name", "params", "variantGroups", "states", "type", "plumeInfo", "codeComponentMeta", "subComps", "tplTree", "trapsFocus", "templateInfo");
        if (value.plumeInfo) { field(value.plumeInfo, "type"); }
        if (value.templateInfo) { field(value.templateInfo, "name"); }
        if (selected && value === component) { param(selected); } else { value.params.forEach(param); }
        value.variantGroups.forEach((group) => { field(group, "param"); });
        value.states.forEach((state) => field(state, "param", "onChangeParam", "accessType"));
        value.subComps.forEach(contract);
      };
      contract(component); if (selected && !component.params.includes(selected)) { param(selected); }
}

/** Component prop/slot/state contracts, including default expressions and types.
 * TplSlot references stop at identity; no component document tree is traversed. */
export function useComponentParamInputs(studio: StudioCtx, component: Component, selected?: Param) {
  const world = useVariantModelWorld(studio, component);
  const source = React.useMemo(() => createComponentParamInputsSource(world, studio, component, selected), [world, studio, component, selected]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

/** Render values derived from the same finite component contract publication. */
export function useComponentParamValue<T>(studio: StudioCtx, component: Component, select: () => T, selected?: Param) {
  const world = useVariantModelWorld(studio, component);
  const source = React.useMemo(() => createComponentParamInputsSource(world, studio, component, selected), [world, studio, component, selected]);
  const projection = React.useMemo(() => new ComponentParamValue(source, select), [source, select]);
  return React.useSyncExternalStore(source.subscribe, projection.read, projection.read);
}
class ComponentParamValue<T> {
  private fields: readonly unknown[] | undefined;
  private result: { value: T } | undefined;
  constructor(private readonly source: ReturnType<typeof createComponentParamInputsSource>, private readonly select: () => T) {}
  read = () => {
    const fields = this.source.read();
    if (fields !== this.fields) { this.fields = fields; this.result = { value: this.select() }; }
    return ensure(this.result, "Component parameters must capture their initial display").value;
  };
}

function createComponentParamInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: Parameters<typeof useComponentParamInputs>[0], component: Parameters<typeof useComponentParamInputs>[1], selected: Parameters<typeof useComponentParamInputs>[2]) {
  return new ModelFieldInputs({ models: world.models, lifetime: world.lifetime,
    isCurrent: () => world.studio === studio && world.isCurrent() },
    (field) => collectComponentParamFields(component, field, selected));
}
