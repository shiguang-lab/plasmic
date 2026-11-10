import { captureVariantModelWorld, useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { ModelFieldInputs, type DeclareModelFields } from "@/wab/client/stores/model-field-inputs";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Arg, Component, Expr, ObjInst, Param, TplComponent, TplNode, VariantGroup, isKnownCustomCode, isKnownObjectPath, isKnownVariantsRef, isKnownVarRef, isKnownType } from "@/wab/shared/model/classes";
import * as React from "react";

function parameterCollector(field: DeclareModelFields) {
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
  return { param, expr };
}

// Parameter compatibility is shared; option labels belong to individual groups.
const componentInputs = new WeakMap<ModelSnapshots, WeakMap<Component, ModelFieldInputs>>();
function componentContract(view: ViewCtx, component: Component) {
  const world = captureVariantModelWorld(view.studioCtx);
  let entries = componentInputs.get(world.models);
  if (!entries) { entries = new WeakMap(); componentInputs.set(world.models, entries); }
  let source = entries.get(component);
  if (!source?.isCurrent()) {
    source = new ModelFieldInputs(world, (field) => {
      const { param } = parameterCollector(field);
      field(component, "params", "variants", "variantGroups", "states", "type", "plumeInfo");
      component.variants.forEach((variant) => field(variant, "name", "parent", "selectors", "forTpl"));
      if (component.plumeInfo) { field(component.plumeInfo, "type"); }
      component.params.forEach(param);
      component.variantGroups.forEach((group) => field(group, "param"));
      component.states.forEach((state) => field(state, "param", "onChangeParam", "accessType"));
    });
    entries.set(component, source);
  }
  return source;
}

class VariantPickerContext {
  readonly inputs: ModelFieldInputs;
  readonly args = new Map<Param, Arg[]>();
  constructor(view: ViewCtx, tpl: TplComponent, models: ModelSnapshots) {
    const world = captureVariantModelWorld(view.studioCtx);
    this.inputs = new ModelFieldInputs({ models, lifetime: view.disposeSignal,
      isCurrent: () => world.models === models && world.isCurrent(view) }, (field, watch) => {
      field(tpl, "name", "component");
      watch(componentContract(view, tpl.component));
      const owner = tryGetTplOwnerComponent(tpl);
      if (owner && owner !== tpl.component) { watch(componentContract(view, owner)); }
      this.args.clear();
      let node: TplNode | null | undefined = tpl;
      const ancestors = new Set<TplNode>();
      while (node && !ancestors.has(node)) {
        ancestors.add(node); field(node, "parent", "vsettings");
        node.vsettings.forEach((setting) => {
          field(setting, "variants", "args");
          setting.variants.forEach((variant) => field(variant, "name", "parent", "selectors", "forTpl"));
          setting.args.forEach((arg) => {
            field(arg, "param");
            const args = this.args.get(arg.param) ?? [];
            args.push(arg); this.args.set(arg.param, args);
          });
        });
        node = node.parent;
      }
      field(view.arenaFrame(), "width");
      field(world.site, "flags", "activeScreenVariantGroup");
      const screen = world.site.activeScreenVariantGroup;
      if (screen) {
        field(screen, "param", "variants", "multi", "type");
        parameterCollector(field).param(screen.param);
        screen.variants.forEach((variant) => field(variant, "name", "parent", "mediaQuery"));
      }
    });
  }
}
const contexts = new WeakMap<ViewCtx, WeakMap<TplComponent, VariantPickerContext>>();
function contextFor(view: ViewCtx, tpl: TplComponent, models: ModelSnapshots) {
  let entries = contexts.get(view);
  if (!entries) { entries = new WeakMap(); contexts.set(view, entries); }
  let context = entries.get(tpl);
  if (!context?.inputs.isCurrent()) { context = new VariantPickerContext(view, tpl, models); entries.set(tpl, context); }
  return context;
}

/** One shared ancestor/contract index and one finite field source per group. */
export function useVariantPickerInputs(view: ViewCtx, tpl: TplComponent, selectedGroup?: VariantGroup) {
  const world = useVariantModelWorld(view.studioCtx, tpl, view);
  const source = React.useMemo(() => {
    const context = contextFor(view, tpl, world.models);
    return new ModelFieldInputs({ models: world.models, lifetime: view.disposeSignal,
      isCurrent: () => world.isCurrent(view) }, (field, watch) => {
      watch(context.inputs);
      if (!selectedGroup) { return; }
      const { param, expr } = parameterCollector(field);
      field(selectedGroup, "param", "variants", "multi", "type"); param(selectedGroup.param);
      selectedGroup.variants.forEach((variant) => field(variant, "name", "parent", "mediaQuery"));
      for (const arg of context.args.get(selectedGroup.param) ?? []) {
        field(arg, "expr"); expr(arg.expr);
      }
    });
  }, [world, view, tpl, selectedGroup]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}
