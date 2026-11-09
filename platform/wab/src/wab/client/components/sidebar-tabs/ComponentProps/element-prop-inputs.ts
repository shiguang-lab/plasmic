import { createLinkedCodePropInputsSource } from "@/wab/client/components/sidebar-tabs/ComponentProps/linked-code-prop-inputs";
import { collectComponentParamFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { ObjInst, TplNode, isKnownTplComponent, isKnownTplTag } from "@/wab/shared/model/classes";
import * as React from "react";

/** One element's argument/attribute source path and its component contracts.
 * Parent paths are bounded by model identity; expressions stop at document refs. */
export function useElementPropInputs(view: ViewCtx, tpl: TplNode) {
  const studio = view.studioCtx;
  const world = useVariantModelWorld(studio, tpl);
  const source = React.useMemo(() => createElementPropInputsSource(world, studio, view, tpl), [world, studio, view, tpl]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

/** Render the selected value captured from the element's committed finite fields. */
export function useElementPropValue<Value>(view: ViewCtx, tpl: TplNode, select: () => Value) {
  const studio = view.studioCtx;
  const world = useVariantModelWorld(studio, tpl);
  const source = React.useMemo(() => createElementPropInputsSource(world, studio, view, tpl), [world, studio, view, tpl]);
  const projection = React.useMemo(() => new ElementPropValue(source, select), [source, select]);
  return React.useSyncExternalStore(source.subscribe, projection.read, projection.read);
}
class ElementPropValue<Value> {
  private fields: readonly unknown[] | undefined;
  private value: Value | undefined;
  constructor(private readonly source: ReturnType<typeof createElementPropInputsSource>, private readonly select: () => Value) {}
  read = () => {
    if (!this.source.isCurrent()) { return undefined; }
    const fields = this.source.read();
    if (fields !== this.fields) { this.fields = fields; this.value = this.select(); }
    return this.value;
  };
}

function createElementPropInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], view: Parameters<typeof useElementPropInputs>[0], tpl: Parameters<typeof useElementPropInputs>[1]) {
    const { models, site, lifetime } = world;
    const linked = isKnownTplComponent(tpl) ? createLinkedCodePropInputsSource(world, studio, view, tpl.component) : undefined;
    let stopLinked: (() => void) | undefined, stopVariants: (() => void) | undefined;
    let current: readonly unknown[] = Object.freeze([]);
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    const read = () => {
      if (world.studio !== studio || !world.isCurrent(view)) { return current; }
      const used = new Set<ModelFieldStore<unknown>>();
      const field = (value: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(value, key)));
      field(site, "flags", "components");
      const owner = tryGetTplOwnerComponent(tpl); if (owner) { collectComponentParamFields(owner, field); }
      let node: TplNode | null | undefined = tpl; const seen = new Set<TplNode>();
      while (node && !seen.has(node)) {
        seen.add(node); field(node, "parent", "vsettings");
        if (isKnownTplTag(node)) { field(node, "name", "tag", "type", "codeGenType"); }
        if (isKnownTplComponent(node)) {
          field(node, "name", "component"); const component = node.component;
          collectComponentParamFields(component, field); field(component, "editableByContentEditor");
          if (component.codeComponentMeta) { field(component.codeComponentMeta, "displayName", "description"); }
          used.add(view.canvasCtx.registrations.component(component.name));
        }
        collectPropExpressionFields(node.vsettings, field); node = node.parent;
      }
      const next = [...used].map((store) => store.getState());
      next.push(view.variantStore.getState(), linked?.read()); if (!arrayEq(current, next)) { current = Object.freeze(next); }
      if (listeners.size) {
        used.forEach((store) => { if (!fields.has(store)) { fields.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of fields) { if (!used.has(store)) { stop(); fields.delete(store); } }
      }
      return current;
    };
    const disconnect = () => { stopLinked?.(); stopLinked = undefined; stopVariants?.(); stopVariants = undefined; fields.forEach((stop) => stop()); fields.clear(); lifetime.removeEventListener("abort", disconnect); view.disposeSignal.removeEventListener("abort", disconnect); };
    const sync = () => { const before = current; read(); if (before !== current) { listeners.forEach((listener) => listener()); } };
    const subscribe = (listener: () => void) => {
      if (world.studio !== studio || !world.isCurrent(view)) { return () => undefined; } listeners.add(listener); stopLinked ??= linked?.subscribe(sync); stopVariants ??= view.variantStore.subscribe(sync); lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe, isCurrent: () => world.studio === studio && world.isCurrent(view) };
  }
