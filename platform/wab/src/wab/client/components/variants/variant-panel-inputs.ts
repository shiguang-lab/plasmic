import { collectComponentParamFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import { Component, ObjInst } from "@/wab/shared/model/classes";
import * as React from "react";

/** Panel-only inputs augment the shared preview variant catalog: inheritance,
 * editable state contracts, dependency captions and the active breakpoint group. */
export function useVariantPanelInputs(studio: StudioCtx, component: Component) {
  const world = useVariantModelWorld(studio, component);
  const source = React.useMemo(() => createVariantPanelInputsSource(world, studio, component), [world, studio, component]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createVariantPanelInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], component: Parameters<typeof useVariantPanelInputs>[1]) {
    let current: readonly unknown[] = Object.freeze([]);
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    const read = () => {
      if (world.studio !== studio || !world.isCurrent()) { return current; }
      const used = new Set<ModelFieldStore<unknown>>();
      const field = (owner: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(world.models.declaredField(owner, key)));
      collectComponentParamFields(component, field);
      const seen = new Set<Component>(); let owner: Component | null | undefined = component;
      while (owner && !seen.has(owner)) { seen.add(owner); field(owner, "superComp"); owner = owner.superComp; }
      field(component, "variantGroups"); component.variantGroups.forEach((group) => { field(group, "linkedState"); if (group.linkedState) { field(group.linkedState, "accessType"); } });
      field(world.site, "activeScreenVariantGroup", "projectDependencies"); world.site.projectDependencies.forEach((dependency) => field(dependency, "name"));
      const next = [...used].map((store) => store.getState()); if (!arrayEq(current, next)) { current = Object.freeze(next); }
      if (listeners.size) {
        used.forEach((store) => { if (!fields.has(store)) { fields.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of fields) { if (!used.has(store)) { stop(); fields.delete(store); } }
      }
      return current;
    };
    const sync = () => { const before = current; read(); if (before !== current) { listeners.forEach((listener) => listener()); } };
    const disconnect = () => { fields.forEach((stop) => stop()); fields.clear(); world.lifetime.removeEventListener("abort", disconnect); };
    const subscribe = (listener: () => void) => {
      if (world.studio !== studio || !world.isCurrent()) { return () => undefined; }
      listeners.add(listener); world.lifetime.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe };
  }
