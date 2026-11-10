import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { flattenComponent, getLinkedCodeProps } from "@/wab/shared/cached-selectors";
import { getComponentPropTypes } from "@/wab/shared/component-props";
import { arrayEq } from "@/wab/shared/common";
import { isCodeComponent, isPlumeComponent } from "@/wab/shared/core/components";
import { Component, Site, isKnownTplComponent, isKnownVarRef } from "@/wab/shared/model/classes";
import { modelKeys, type ModelKey } from "@/wab/shared/model-revisions";
import * as React from "react";

/** getLinkedCodeProps scans whole component trees through forwarded bindings.
 * Revision keys invalidate that actual query; only changed links/contracts publish. */
export function useLinkedCodePropInputs(view: ViewCtx, component: Component) {
  const studio = view.studioCtx;
  const world = useVariantModelWorld(studio, component);
  const source = React.useMemo(() => createLinkedCodePropInputsSource(world, studio, view, component), [world, studio, view, component]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

export function createLinkedCodePropInputsSource(world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio'], view: Parameters<typeof useLinkedCodePropInputs>[0], component: Parameters<typeof useLinkedCodePropInputs>[1]) {
    let current: readonly unknown[] = Object.freeze([]), stopKeys: (() => void) | undefined;
    let boundKeys = "";
    let captured: { keys: Map<ModelKey, number>; fields: Map<ModelFieldStore<unknown>, unknown> } | undefined;
    const listeners = new Set<() => void>(), registrations = new Map<ModelFieldStore<unknown>, () => void>();
    const read = () => {
      if (world.studio !== studio || !world.isCurrent(view)) { return current; }
      if (captured && [...captured.keys].every(([key, version]) => studio.modelRevisions.getModelRevision(key) === version) &&
        [...captured.fields].every(([field, value]) => field.getState() === value)) { return current; }
      const keys = new Set<ModelKey>(), owners = new Set<Component>(), used = new Set<ModelFieldStore<unknown>>();
      const sites = new Set<Site>();
      const catalog = (owner: Site) => {
        if (sites.has(owner)) { return; } sites.add(owner);
        used.add(world.models.field(owner, "components"));
        const dependencies = world.models.field(owner, "projectDependencies"); used.add(dependencies);
        dependencies.getState().forEach((ref) => {
          const dependency = world.models.resolve(ref), siteInput = world.models.field(dependency, "site"); used.add(siteInput); catalog(world.models.resolve(siteInput.getState()));
        });
      };
      catalog(world.site);
      const walk = (owner: Component) => {
        if (owners.has(owner)) { return; } owners.add(owner); keys.add(modelKeys.component(owner.uuid));
        if (isCodeComponent(owner)) { used.add(view.canvasCtx.registrations.component(owner.name)); return; }
        if (isPlumeComponent(owner)) { return; }
        flattenComponent(owner).forEach((tpl) => {
          if (isKnownTplComponent(tpl) && tpl.vsettings.some((setting) => setting.args.some((arg) => isKnownVarRef(arg.expr)))) { walk(tpl.component); }
        });
        owner.states.forEach((state) => { if (state.tplNode && state.implicitState && isKnownTplComponent(state.tplNode)) { walk(state.tplNode.component); } });
      };
      walk(component);
      const values: unknown[] = [];
      [...getLinkedCodeProps(component)].sort(([left], [right]) => left.localeCompare(right)).forEach(([name, [tpl, param]]) => {
        const target = tpl.component;
        values.push(name, world.models.ref(tpl), world.models.ref(param), world.models.ref(target), target.name, target.type, param.variable.name);
        if (isCodeComponent(target)) {
          const registration = view.canvasCtx.registrations.component(target.name); used.add(registration); values.push(registration.getState()?.contract);
        } else {
          values.push(JSON.stringify(getComponentPropTypes(view, target), (_key, value) => typeof value === "function" ? value.toString() : value));
        }
      });
      if (!arrayEq(current, values)) { current = Object.freeze(values); }
      if (listeners.size) {
        const signature = [...keys].sort().join("|");
        if (signature !== boundKeys) { stopKeys?.(); boundKeys = signature; stopKeys = studio.modelRevisions.subscribeModelKeys([...keys], sync); }
        used.forEach((store) => { if (!registrations.has(store)) { registrations.set(store, store.subscribe(sync)); } });
        for (const [store, stop] of registrations) { if (!used.has(store)) { stop(); registrations.delete(store); } }
      }
      captured = { keys: new Map([...keys].map(key => [key, studio.modelRevisions.getModelRevision(key)])), fields: new Map([...used].map(field => [field, field.getState()])) };
      return current;
    };
    const disconnect = () => { stopKeys?.(); stopKeys = undefined; boundKeys = ""; registrations.forEach((stop) => stop()); registrations.clear(); world.lifetime.removeEventListener("abort", disconnect); view.disposeSignal.removeEventListener("abort", disconnect); };
    const sync = () => { const before = current; read(); if (before !== current) { listeners.forEach((listener) => listener()); } };
    const subscribe = (listener: () => void) => {
      if (world.studio !== studio || !world.isCurrent(view)) { return () => undefined; }
      captured = undefined;
      listeners.add(listener); world.lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe };
  }
