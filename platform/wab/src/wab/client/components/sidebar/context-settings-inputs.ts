import { captureVariantModelWorld, useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { ComponentPropOrigin } from "@/wab/shared/core/lang";
import { uniqWith } from "lodash";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import { getComponentDisplayName, getRealParams, isContextCodeComponent } from "@/wab/shared/core/components";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Component, ObjInst, Param, ProjectDependency, TplComponent, Site, isKnownComponent, isKnownParam, isKnownTplNode, isKnownVar, isKnownSite, isKnownProjectDependency } from "@/wab/shared/model/classes";
import * as React from "react";

export interface ContextRowData {
  readonly tpl: TplComponent;
  readonly component: Component;
  readonly projectDependency: ProjectDependency | undefined;
  readonly displayName: string;
  readonly hasParams: boolean;
  readonly isCurrent: () => boolean;
}

const empty: readonly unknown[] = Object.freeze([]);

/** Installed context membership, registration labels and the local props/default
 * expression data read by ContextPropEditor. References to pages/components/tpls
 * stop at their serialization fields instead of walking their document trees. */
export class ContextSettingsInputs {
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private rowFields: readonly unknown[] | undefined;
  private rows: readonly ContextRowData[] = Object.freeze([]);
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  constructor(private readonly studio: StudioCtx, world = captureVariantModelWorld(studio)) {
    this.models = world.models; this.site = world.site;
    this.lifetime = world.lifetime; this.getSnapshot();
  }
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true; this.current = empty; this.disconnect();
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  private sync = () => {
    const before = this.current; this.getSnapshot();
    if (before !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): readonly unknown[] => {
    if (this.closed || this.lifetime.aborted || this.models !== this.studio.modelSnapshots) { this.current = empty; return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (value: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(value, key)));
    const seenData = new Set<object>();
    const data = (value: unknown) => {
      if (!value || typeof value !== "object" || seenData.has(value)) { return; }
      seenData.add(value);
      if (Array.isArray(value)) { value.forEach(data); return; }
      if (!instUtil.isObjInst(value)) { Object.values(value).forEach(data); return; }
      if (isKnownComponent(value)) {
        field(value, "uuid", "name", "type", "pageMeta");
        if (value.pageMeta) { field(value.pageMeta, "path"); }
        return;
      }
      if (isKnownTplNode(value)) { field(value, "uuid"); return; }
      if (isKnownVar(value)) { field(value, "name"); return; }
      if (isKnownParam(value)) { param(value); return; }
      // These are ownership references, not a prop value's serialization graph.
      if (isKnownSite(value) || isKnownProjectDependency(value)) { return; }
      const keys = instUtil.allInstFields(value).map((item) => item.name);
      field(value, ...keys);
      keys.forEach((key) => data(Reflect.get(value, key)));
    };
    const seenParams = new Set<Param>();
    const param = (value: Param) => {
      if (seenParams.has(value)) { return; }
      seenParams.add(value);
      const keys = instUtil.allInstFields(value).map((item) => item.name);
      field(value, ...keys);
      keys.forEach((key) => data(Reflect.get(value, key)));
    };
    const components = new Set<Component>();
    const component = (value: Component) => {
      if (components.has(value)) { return; }
      components.add(value);
      field(value, "type", "codeComponentMeta");
      const meta = value.codeComponentMeta;
      if (meta) { field(meta, "isContext"); }
      if (isContextCodeComponent(value)) {
        field(value, "uuid", "name");
        if (meta) { data(meta); }
      }
    };
    const sites = new Set<Site>();
    const site = (value: Site) => {
      if (sites.has(value)) { return; }
      sites.add(value); field(value, "components", "projectDependencies");
      value.components.forEach(component);
      value.projectDependencies.forEach((dependency) => {
        field(dependency, "site", "projectId"); site(dependency.site);
      });
    };
    site(this.site); field(this.site, "globalContexts", "flags");
    this.site.globalContexts.forEach((tpl) => {
      field(tpl, "uuid", "component", "vsettings", "parent");
      const owner = tpl.component;
      component(owner);
      if (!isContextCodeComponent(owner)) { return; }
      field(owner, "params", "states", "variantGroups");
      owner.params.forEach(param);
      owner.states.forEach((state) => field(state, "param", "onChangeParam", "accessType"));
      owner.variantGroups.forEach((group) => field(group, "param"));
      tpl.vsettings.forEach((setting) => {
        field(setting, "args");
        setting.args.forEach((arg) => { field(arg, "param", "expr"); param(arg.param); data(arg.expr); });
      });
    });
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  isCurrent = () => !this.closed && !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  getRowsSnapshot = () => {
    const fields = this.getSnapshot();
    if (fields !== this.rowFields) {
      this.rowFields = fields;
      if (fields === empty) { this.rows = Object.freeze([]); return this.rows; }
      const dependencies = walkDependencyTree(this.site, "all").map(dependency => ({
        dependency, components: dependency.site.components.filter(isContextCodeComponent),
      }));
      const components = uniqWith([
        ...this.site.components.filter(isContextCodeComponent),
        ...dependencies.flatMap(dependency => dependency.components),
      ], (left, right) => left.name === right.name);
      this.rows = Object.freeze(this.site.globalContexts.flatMap(tpl => {
        const component = components.find(candidate => candidate === tpl.component);
        if (!component) return [];
        return [Object.freeze({
          tpl, component, isCurrent: this.isCurrent,
          projectDependency: dependencies.find(dependency => dependency.components.includes(component))?.dependency,
          displayName: getComponentDisplayName(component),
          hasParams: getRealParams(component).some(param => param.origin !== ComponentPropOrigin.ReactHTMLAttributes),
        })];
      }));
    }
    return this.rows;
  };
  subscribe = (listener: () => void) => {
    if (this.closed || this.lifetime.aborted) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
export function useContextSettingsModelInputs(studio: StudioCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new ContextSettingsInputs(studio, world), [studio, world]);
  return React.useSyncExternalStore(source.subscribe, source.getRowsSnapshot, source.getRowsSnapshot);
}
