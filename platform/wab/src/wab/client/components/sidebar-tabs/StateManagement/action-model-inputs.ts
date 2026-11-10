import { contractSnapshot } from "@/wab/client/components/canvas/canvas-registrations";
import { collectComponentParamFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
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
    let contract: unknown;
    const source = new ModelFieldInputs({ models: world.models, lifetime: view.disposeSignal,
      isCurrent: () => world.studio === studio && world.isCurrent(view) }, (declare) => {
      const refs = new Set<TplNode>(), refContracts: unknown[] = [];
      const field = (owner: ObjInst, ...keys: string[]) => {
        declare(owner, ...keys);
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
      return [contract];
    });
    return { read: source.read, subscribe: (listener: () => void) => {
      if (!source.isCurrent()) { return () => undefined; }
      const stop = source.subscribe(listener), stopRegistry = studio.subscribeCodeRegistrations(source.refresh);
      let stopped = false;
      const release = () => {
        if (stopped) { return; } stopped = true;
        stopRegistry(); stop();
        world.lifetime.removeEventListener("abort", release); view.disposeSignal.removeEventListener("abort", release);
      };
      world.lifetime.addEventListener("abort", release, { once: true }); view.disposeSignal.addEventListener("abort", release, { once: true });
      return release;
    } };
}
