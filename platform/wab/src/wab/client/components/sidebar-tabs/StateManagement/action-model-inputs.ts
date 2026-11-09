import { contractSnapshot } from "@/wab/client/components/canvas/canvas-registrations";
import { collectComponentParamFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq } from "@/wab/shared/common";
import { Component, EventHandler, ObjInst, TplNode, isKnownTplComponent, isKnownTplTag, isKnownTplNode } from "@/wab/shared/model/classes";
import { isEqual } from "lodash";
import * as React from "react";

/** Built-in action options read state/variant contracts; ref actions read their
 * explicitly referenced node and host contract. No document-wide revision. */
export function useActionModelInputs(view: ViewCtx, component: Component, handler: EventHandler) {
  const studio = view.studioCtx;
  const world = useVariantModelWorld(studio, handler);
  const source = React.useMemo(() => createActionModelInputsSource(world, studio, view, component, handler), [world, studio, view, component, handler]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createActionModelInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], view: Parameters<typeof useActionModelInputs>[0], component: Parameters<typeof useActionModelInputs>[1], handler: Parameters<typeof useActionModelInputs>[2]) {
    let current: readonly unknown[] = Object.freeze([]), contract: unknown;
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    let stopRegistry: (() => void) | undefined;
    const read = () => {
      if (world.studio !== studio || !world.isCurrent(view)) { return current; }
      const used = new Set<ModelFieldStore<unknown>>(), refs = new Set<TplNode>(), refContracts: unknown[] = [];
      const field = (owner: ObjInst, ...keys: string[]) => {
        keys.forEach((key) => used.add(world.models.declaredField(owner, key)));
        if (isKnownTplNode(owner) && !refs.has(owner)) { reference(owner); }
      };
      const reference = (tpl: TplNode) => {
        if (refs.has(tpl)) { return; } refs.add(tpl);
        field(tpl, "parent", "vsettings");
        if (isKnownTplTag(tpl)) { field(tpl, "name", "tag", "type", "codeGenType"); }
        if (isKnownTplComponent(tpl)) {
          field(tpl, "name", "component"); field(tpl.component, "name", "codeComponentMeta");
          if (tpl.component.codeComponentMeta) { field(tpl.component.codeComponentMeta, "hasRef"); }
          const meta = studio.getCodeComponentMeta(tpl.component); refContracts.push(tpl.component.name, meta?.refActions);
        }
        collectPropExpressionFields(tpl.vsettings, field);
        if (tpl.parent) { reference(tpl.parent); }
      };
      collectComponentParamFields(component, field);
      collectPropExpressionFields(handler, field);
      component.variantGroups.forEach((group) => { field(group, "variants", "multi", "type"); group.variants.forEach((variant) => field(variant, "name")); });
      const contexts = [...studio.getRegisteredContextsMap().values(), ...studio.getHostLessContextsMap().values()];
      const nextContract = contractSnapshot([contexts.map(({ meta }) => [meta.name, meta.displayName, "globalActions" in meta ? meta.globalActions : undefined]), refContracts]);
      if (!isEqual(contract, nextContract)) { contract = nextContract; }
      const next = [...used].map((store) => store.getState()); next.push(contract);
      if (!arrayEq(current, next)) { current = Object.freeze(next); }
      if (listeners.size) {
        used.forEach((store) => { if (!fields.has(store)) { fields.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of fields) { if (!used.has(store)) { stop(); fields.delete(store); } }
      }
      return current;
    };
    const sync = () => { const previous = current; read(); if (previous !== current) { listeners.forEach((listener) => listener()); } };
    const disconnect = () => { fields.forEach((stop) => stop()); fields.clear(); stopRegistry?.(); stopRegistry = undefined; world.lifetime.removeEventListener("abort", disconnect); view.disposeSignal.removeEventListener("abort", disconnect); };
    const subscribe = (listener: () => void) => {
      if (world.studio !== studio || !world.isCurrent(view)) { return () => undefined; }
      listeners.add(listener); if (!stopRegistry) { stopRegistry = studio.subscribeCodeRegistrations(sync); }
      world.lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe };
  }
