import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { isTplNamable } from "@/wab/shared/core/tpls";
import { arrayEq } from "@/wab/shared/common";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Component, ObjInst, Site, isKnownComponent, isKnownParam, isKnownTplNode, isKnownVar, isKnownVariant, isKnownVariantGroup, isKnownImageAsset, isKnownStyleToken, isKnownDataToken, isKnownSite, isKnownProjectDependency, isKnownRenderExpr, isKnownTplTag, isKnownTplComponent } from "@/wab/shared/model/classes";
import * as React from "react";

export function collectPropExpressionFields(value: unknown, field: (model: ObjInst, ...keys: string[]) => void) {
  const seen = new Set<object>();
  const data = (item: unknown) => {
        if (!item || typeof item !== "object" || seen.has(item)) { return; } seen.add(item);
        if (Array.isArray(item)) { item.forEach(data); return; }
        if (!instUtil.isObjInst(item)) { Object.values(item).forEach(data); return; }
        if (isKnownSite(item) || isKnownProjectDependency(item)) { return; }
        if (isKnownRenderExpr(item)) {
          field(item, "tpl");
          item.tpl.forEach((node) => {
            if (isKnownTplTag(node)) {
              field(node, "name", "tag", "type", "codeGenType", "vsettings");
              node.vsettings.forEach((setting) => { field(setting, "variants", "text"); data(setting.variants); data(setting.text); });
            } else if (isKnownTplComponent(node)) { field(node, "name", "component"); data(node.component); }
          });
          return;
        }
        if (isKnownComponent(item)) { field(item, "name", "type", "pageMeta"); if (item.pageMeta) { field(item.pageMeta, "path"); } return; }
        if (isKnownTplNode(item)) { if (isTplNamable(item)) { field(item, "name"); } return; }
        if (isKnownVar(item)) { field(item, "name"); return; }
        if (isKnownParam(item)) { field(item, "variable"); data(item.variable); return; }
        if (isKnownVariant(item)) { field(item, "name", "parent"); data(item.parent); return; }
        if (isKnownVariantGroup(item)) { field(item, "param"); data(item.param); return; }
        if (isKnownImageAsset(item)) { field(item, "name", "dataUri"); return; }
        if (isKnownStyleToken(item) || isKnownDataToken(item)) { field(item, "name"); return; }
        const keys = instUtil.allInstFields(item).map((entry) => entry.name);
        field(item, ...keys); keys.forEach((key) => data(Reflect.get(item, key)));
      };
  data(value);
}

/** Persisted expression serialization, stopping at document references. Property
 * values can be nested plain objects containing real Expr model identities. */
function usePropExpressionSource(studio: StudioCtx, identity: object, value: unknown, component?: Component | null) {
  const world = useVariantModelWorld(studio, identity);
  return React.useMemo(() => createPropExpressionInputsSource(world, studio, value, component), [world, studio, value, component]);
}

export function usePropExpressionInputs(studio: StudioCtx, identity: object, value: unknown, component?: Component | null) {
  const source = usePropExpressionSource(studio, identity, value, component);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

class PropExpressionValue<T> {
  private fields: readonly unknown[] | undefined;
  private value: T | undefined;
  constructor(private readonly source: ReturnType<typeof createPropExpressionInputsSource>, private readonly select: () => T) {}
  read = () => {
    if (!this.source.isCurrent()) { return undefined; }
    const fields = this.source.read();
    if (fields !== this.fields) {
      this.fields = fields;
      this.value = this.select();
    }
    return this.value;
  };
}

/** Publish the expression's rendered value, including in-place model edits. */
export function usePropExpressionValue<T>(studio: StudioCtx, identity: object, value: unknown, component: Component | null | undefined, select: () => T) {
  const source = usePropExpressionSource(studio, identity, value, component);
  const projection = React.useMemo(() => new PropExpressionValue(source, select), [source, select]);
  return React.useSyncExternalStore(source.subscribe, projection.read, projection.read);
}

function createPropExpressionInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], value: Parameters<typeof usePropExpressionInputs>[2], component: Parameters<typeof usePropExpressionInputs>[3]) {
    const { models, site, lifetime } = world;
    let current: readonly unknown[] = Object.freeze([]);
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    const read = () => {
      if (world.studio !== studio || !world.isCurrent()) { return current; }
      const used = new Set<ModelFieldStore<unknown>>();
      const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(model, key)));
      collectPropExpressionFields(value, field); if (component) { collectPropExpressionFields(component, field); }
      const sites = new Set<Site>();
      const dependencies = (owner: Site) => {
        if (sites.has(owner)) { return; } sites.add(owner); field(owner, "projectDependencies");
        owner.projectDependencies.forEach((dependency) => { field(dependency, "name", "projectId", "site"); dependencies(dependency.site); });
      };
      field(site, "flags");
      dependencies(site);
      const next = [...used].map((store) => store.getState());
      if (!arrayEq(current, next)) { current = Object.freeze(next); }
      if (listeners.size) {
        used.forEach((store) => { if (!fields.has(store)) { fields.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of fields) { if (!used.has(store)) { stop(); fields.delete(store); } }
      }
      return current;
    };
    const disconnect = () => { fields.forEach((stop) => stop()); fields.clear(); lifetime.removeEventListener("abort", disconnect); };
    const sync = () => { const before = current; read(); if (before !== current) { listeners.forEach((listener) => listener()); } };
    const subscribe = (listener: () => void) => {
      if (world.studio !== studio || !world.isCurrent()) { return () => undefined; }
      listeners.add(listener); lifetime.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe, isCurrent: world.isCurrent };
  }
