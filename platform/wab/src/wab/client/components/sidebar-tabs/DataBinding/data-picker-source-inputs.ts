import { captureVariantModelWorld, type VariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { Component, Site, State, TplNode, isKnownNamedState, isKnownTplTag, isKnownTplComponent } from "@/wab/shared/model/classes";
import * as React from "react";

/** A component prop owns its captured model world. Only a picker without a
 * component follows the Studio's live catalogs across completed replacements. */
class DataPickerWorldInputs {
  private world: VariantModelWorld;
  constructor(readonly studio: StudioCtx, readonly component: Component | undefined) { this.world = captureVariantModelWorld(studio); }
  read = () => {
    if (!this.component && (this.world.models !== this.studio.modelSnapshots || this.world.site !== this.studio.site || this.world.lifetime !== this.studio.arenaState.lifetime())) { this.world = captureVariantModelWorld(this.studio); }
    return this.world;
  };
  subscribe = (listener: () => void) => {
    if (this.component) { return () => undefined; }
    const stopModels = this.studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = this.studio.arenaState.store.subscribe(listener);
    return () => { stopModels(); stopArena(); };
  };
}

/** Exactly the model catalogs searched by a visible picker projection. */
export function useDataPickerSourceInputs<T>(studio: StudioCtx, component: Component | undefined, paths: readonly (readonly (string | number)[])[], select: () => T) {
  const [binding, setBinding] = React.useState(() => new DataPickerWorldInputs(studio, component));
  if (binding.component !== component || !component && binding.studio !== studio) { setBinding(new DataPickerWorldInputs(studio, component)); }
  const captured = React.useSyncExternalStore(binding.subscribe, binding.read, binding.read);
  const isCurrent = React.useCallback(() => binding.studio === studio && captured.isCurrent(), [binding, studio, captured]);
  const categories = new Set(paths.map((path) => path[0])), categoryKey = JSON.stringify([...categories].sort());
  const source = React.useMemo(() => createDataPickerSource({ ...captured, isCurrent }, component, categoryKey), [captured, isCurrent, component, categoryKey]);
  const [committed] = React.useState(() => new DataPickerSelection<T>());
  const projection = React.useMemo(() => new DataPickerSourceValue(source, select, committed, captured), [source, select, committed, captured]);
  const value = React.useSyncExternalStore(source.subscribe, projection.read, projection.read);
  React.useLayoutEffect(() => { if (source.isCurrent()) { committed.commit(captured, value); } }, [source, captured, committed, value]);
  return value;
}
class DataPickerSelection<T> {
  private selection: { owner: VariantModelWorld; value: T | undefined } | undefined;
  read(owner: VariantModelWorld) { return this.selection?.owner === owner ? this.selection.value : undefined; }
  commit(owner: VariantModelWorld, value: T | undefined) { this.selection = { owner, value }; }
}
class DataPickerSourceValue<T> {
  private fields: readonly unknown[] | undefined;
  private result: { value: T } | undefined;
  constructor(private readonly source: ReturnType<typeof createDataPickerSource>, private readonly select: () => T, private readonly committed: DataPickerSelection<T>, private readonly owner: VariantModelWorld) {}
  read = (): T | undefined => {
    if (!this.source.isCurrent()) { return this.committed.read(this.owner); }
    const fields = this.source.read();
    if (fields !== this.fields) { this.fields = fields; this.result = { value: this.select() }; }
    return this.result?.value;
  };
}

function createDataPickerSource(world: VariantModelWorld, component: Component | undefined, categoryKey: string) {
  const categories = new Set(JSON.parse(categoryKey) as (string | number)[]);
    const { site } = world;
    return new ModelFieldInputs(world, (field) => {
      if (categories.has("$dataTokens")) {
        const tokens = (owner: Site) => { field(owner, "dataTokens"); owner.dataTokens.forEach((token) => field(token, "name")); };
        tokens(site); field(site, "projectDependencies"); site.projectDependencies.forEach((dep) => { field(dep, "name", "site"); tokens(dep.site); });
      }
      if (component) {
        if (categories.has("$ctx")) { field(component, "type"); }
        if (categories.has("$props")) {
          field(component, "params", "variantGroups", "states");
          component.params.forEach((param) => { field(param, "variable", "exportType"); field(param.variable, "name"); });
          component.variantGroups.forEach((group) => field(group, "param"));
          component.states.forEach((state) => field(state, "param", "onChangeParam", "accessType"));
        }
        if (categories.has("$q")) { field(component, "serverQueries"); component.serverQueries.forEach((query) => field(query, "name")); }
        if (categories.has("$queries")) { field(component, "dataQueries"); component.dataQueries.forEach((query) => field(query, "name")); }
        if (categories.has("$state")) {
          const states = new Set<State>();
          const state = (value: State) => {
            if (states.has(value)) { return; } states.add(value);
            field(value, "param", "tplNode", "implicitState"); field(value.param, "variable"); field(value.param.variable, "name");
            if (isKnownNamedState(value)) { field(value, "name"); }
            if (value.implicitState) { state(value.implicitState); }
            let node: TplNode | null | undefined = value.tplNode; const ancestors = new Set<TplNode>();
            while (node && !ancestors.has(node)) {
              ancestors.add(node); field(node, "parent", "vsettings");
              if (isKnownTplTag(node) || isKnownTplComponent(node)) { field(node, "name"); }
              node.vsettings.forEach((setting) => { field(setting, "variants", "dataRep"); setting.variants.forEach((variant) => field(variant, "name")); });
              node = node.parent;
            }
          };
          field(component, "states"); component.states.forEach(state);
        }
      }
    });
}
