import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import { isTplNamable } from "@/wab/shared/core/tpls";
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
  return React.useMemo(() => getPropExpressionInputsSource(world, studio, value, component), [world, studio, value, component]);
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

type ExpressionWorld = ReturnType<typeof useVariantModelWorld>;
const expressionSources = new WeakMap<ModelSnapshots, WeakMap<object, Map<Component | null | undefined | "dataQueries" | "serverQueries", { studio: StudioCtx; lifetime: AbortSignal; source: ModelFieldInputs }>>>();

/** Rows reading the same query roster share collection and subscriptions. */
function getPropExpressionInputsSource(world: ExpressionWorld, studio: StudioCtx, value: unknown, component: Component | null | undefined): ModelFieldInputs {
  if (!value || typeof value !== "object") { return createPropExpressionInputsSource(world, studio, value, component); }
  const roster = component && (value === component.dataQueries ? "dataQueries" : value === component.serverQueries ? "serverQueries" : undefined);
  const identity = component && roster ? component : value;
  const context = roster ?? component;
  let values = expressionSources.get(world.models);
  if (!values) { values = new WeakMap(); expressionSources.set(world.models, values); }
  let contexts = values.get(identity);
  if (!contexts) { contexts = new Map(); values.set(identity, contexts); }
  const previous = contexts.get(context);
  if (previous?.studio === studio && previous.lifetime === world.lifetime && previous.source.isCurrent()) { return previous.source; }
  const source = createPropExpressionInputsSource(world, studio, value, component);
  contexts.set(context, { studio, lifetime: world.lifetime, source });
  return source;
}

function createPropExpressionInputsSource(world: ExpressionWorld, studio: StudioCtx, value: unknown, component: Component | null | undefined) {
  const roster = component && (value === component.dataQueries ? "dataQueries" : value === component.serverQueries ? "serverQueries" : undefined);
  const expression = roster ? undefined : value;
  return new ModelFieldInputs({ ...world, isCurrent: () => world.studio === studio && world.isCurrent() }, (field) => {
    // A query roster follows its owning field across array replacement, even
    // when a mounted/memoized consumer still holds the previous array handle.
    collectPropExpressionFields(component && roster ? component[roster] : expression, field);
    if (component) {
      collectPropExpressionFields(component, field);
      if (roster) { field(component, roster); }
    }
    const sites = new Set<Site>();
    const dependencies = (owner: Site) => {
      if (sites.has(owner)) { return; } sites.add(owner);
      field(owner, "projectDependencies");
      owner.projectDependencies.forEach((dependency) => { field(dependency, "name", "projectId", "site"); dependencies(dependency.site); });
    };
    field(world.site, "flags"); dependencies(world.site);
  });
}
