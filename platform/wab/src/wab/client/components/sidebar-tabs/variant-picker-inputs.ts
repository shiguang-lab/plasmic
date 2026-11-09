import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq } from "@/wab/shared/common";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Component, Expr, ObjInst, Param, TplComponent, TplNode, VariantGroup, isKnownCustomCode, isKnownObjectPath, isKnownVariantsRef, isKnownVarRef, isKnownType } from "@/wab/shared/model/classes";
import * as React from "react";

/** Instance variant choices, inherited args/fallbacks and linkable owner-param
 * contracts. Expression traversal stops at model identity references. */
export function useVariantPickerInputs(view: ViewCtx, tpl: TplComponent, selectedGroup?: VariantGroup) {
  const studio = view.studioCtx;
  const world = useVariantModelWorld(studio, tpl, view);
  const source = React.useMemo(() => createVariantPickerInputsSource(world, view, tpl, selectedGroup), [world, view, tpl, selectedGroup]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createVariantPickerInputsSource(world: ReturnType<typeof useVariantModelWorld>, view: Parameters<typeof useVariantPickerInputs>[0], tpl: Parameters<typeof useVariantPickerInputs>[1], selectedGroup: Parameters<typeof useVariantPickerInputs>[2]) {
    const { models, site, lifetime } = world;
    let current: readonly unknown[] = Object.freeze([]);
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    const read = () => {
      if (!world.isCurrent(view)) { return current; }
      const used = new Set<ModelFieldStore<unknown>>();
      const field = (value: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(value, key)));
      const seenTypes = new Set<ObjInst>();
      const type = (value: unknown) => {
        if (!instUtil.isObjInst(value) || !isKnownType(value) || seenTypes.has(value)) { return; }
        seenTypes.add(value);
        instUtil.allInstFields(value).forEach(({ name }) => {
          field(value, name); const nested: unknown = Reflect.get(value, name);
          if (Array.isArray(nested)) { nested.forEach(type); } else { type(nested); }
        });
      };
      const seenExpressions = new Set<Expr>();
      const expr = (value: Expr | null | undefined) => {
        if (!value || seenExpressions.has(value)) { return; } seenExpressions.add(value);
        if (isKnownCustomCode(value)) { field(value, "code", "fallback"); expr(value.fallback); }
        else if (isKnownObjectPath(value)) { field(value, "path", "fallback"); expr(value.fallback); }
        else if (isKnownVarRef(value)) { field(value, "variable"); field(value.variable, "name"); }
        else if (isKnownVariantsRef(value)) { field(value, "variants"); value.variants.forEach((variant) => field(variant, "name")); }
      };
      const param = (value: Param) => { field(value, "variable", "type", "exportType", "defaultExpr"); field(value.variable, "name"); type(value.type); expr(value.defaultExpr); };
      const groups = new Set<VariantGroup>();
      const group = (value: VariantGroup) => {
        if (groups.has(value)) { return; } groups.add(value);
        field(value, "param", "variants", "multi", "type"); param(value.param);
        value.variants.forEach((variant) => field(variant, "name", "parent", "mediaQuery"));
      };
      const component = (value: Component) => {
        field(value, "params", "variants", "variantGroups", "states", "type", "plumeInfo");
        value.variants.forEach((variant) => field(variant, "name", "parent", "selectors", "forTpl"));
        if (value.plumeInfo) { field(value.plumeInfo, "type"); }
        value.variantGroups.forEach(group); value.params.forEach(param);
        value.states.forEach((state) => field(state, "param", "onChangeParam", "accessType"));
      };
      field(tpl, "name", "component"); component(tpl.component);
      const owner = tryGetTplOwnerComponent(tpl); if (owner && owner !== tpl.component) { component(owner); }
      if (selectedGroup) { group(selectedGroup); }
      let node: TplNode | null | undefined = tpl;
      const ancestors = new Set<TplNode>();
      while (node && !ancestors.has(node)) {
        ancestors.add(node); field(node, "parent", "vsettings");
        node.vsettings.forEach((setting) => {
          field(setting, "variants", "args"); setting.variants.forEach((variant) => field(variant, "name", "parent", "selectors", "forTpl"));
          setting.args.forEach((arg) => { field(arg, "param", "expr"); param(arg.param); expr(arg.expr); });
        });
        node = node.parent;
      }
      field(view.arenaFrame(), "width");
      field(site, "flags", "activeScreenVariantGroup");
      if (site.activeScreenVariantGroup) { group(site.activeScreenVariantGroup); }
      const next = [...used].map((store) => store.getState());
      if (!arrayEq(current, next)) { current = Object.freeze(next); }
      if (listeners.size) {
        used.forEach((store) => { if (!fields.has(store)) { fields.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of fields) { if (!used.has(store)) { stop(); fields.delete(store); } }
      }
      return current;
    };
    const disconnect = () => { fields.forEach((stop) => stop()); fields.clear(); lifetime.removeEventListener("abort", disconnect); view.disposeSignal.removeEventListener("abort", disconnect); };
    const sync = () => { const before = current; read(); if (before !== current) { listeners.forEach((listener) => listener()); } };
    const subscribe = (listener: () => void) => {
      if (!world.isCurrent(view)) { return () => undefined; }
      listeners.add(listener); lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe };
  }
