import { captureVariantModelWorld, useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { ComponentPropOrigin } from "@/wab/shared/core/lang";
import { uniqWith } from "lodash";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelFieldInputs, type DeclareModelFields } from "@/wab/client/stores/model-field-inputs";
import { getComponentDisplayName, getRealParams, isContextCodeComponent } from "@/wab/shared/core/components";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { Component, Param, ProjectDependency, TplComponent, Site, isKnownComponent, isKnownParam, isKnownTplNode, isKnownVar, isKnownSite, isKnownProjectDependency } from "@/wab/shared/model/classes";
import * as React from "react";

export interface ContextRowData {
  readonly tpl: TplComponent;
  readonly component: Component;
  readonly projectDependency: ProjectDependency | undefined;
  readonly displayName: string;
  readonly hasParams: boolean;
  readonly isCurrent: () => boolean;
}


/** Installed context membership, registration labels and the local props/default
 * expression data read by ContextPropEditor. References to pages/components/tpls
 * stop at their serialization fields instead of walking their document trees. */
export class ContextSettingsInputs {
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private rowFields: readonly unknown[] | undefined;
  private rows: readonly ContextRowData[] = Object.freeze([]);
  private readonly inputs;
  constructor(private readonly studio: StudioCtx, world = captureVariantModelWorld(studio)) {
    this.models = world.models; this.site = world.site;
    this.lifetime = world.lifetime;
    this.inputs = new ModelFieldInputs({ models: this.models, lifetime: this.lifetime, isCurrent: this.isCurrent }, this.collect);
  }
  private collect = (field: DeclareModelFields) => {
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
  };
  getSnapshot = () => this.inputs.read();
  isCurrent = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  getRowsSnapshot = () => {
    const fields = this.getSnapshot();
    if (fields !== this.rowFields) {
      this.rowFields = fields;
      if (!this.isCurrent()) { this.rows = Object.freeze([]); return this.rows; }
      const dependencies = walkDependencyTree(this.site, "all").map(dependency => ({
        dependency, components: dependency.site.components.filter(isContextCodeComponent),
      }));
      const components = uniqWith([
        ...this.site.components.filter(isContextCodeComponent),
        ...dependencies.flatMap(dependency => dependency.components),
      ], (left, right) => left.name === right.name);
      this.rows = Object.freeze(this.site.globalContexts.flatMap(tpl => {
        const component = components.find(candidate => candidate === tpl.component);
        if (!component) {return [];}
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
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);

}
export function useContextSettingsModelInputs(studio: StudioCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new ContextSettingsInputs(studio, world), [studio, world]);
  return React.useSyncExternalStore(source.subscribe, source.getRowsSnapshot, source.getRowsSnapshot);
}
