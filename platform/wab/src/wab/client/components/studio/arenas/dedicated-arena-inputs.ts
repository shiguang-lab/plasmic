import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ModelFieldInputs, type DeclareModelFields } from "@/wab/client/stores/model-field-inputs";
import { Component, ComponentArena, PageArena, Site, VariantGroup, isKnownGlobalVariantSplitContent, isKnownTplComponent, isKnownVariantGroup, isKnownVariant } from "@/wab/shared/model/classes";
import * as React from "react";


/** Fields read by arena row labels, combo availability and the add menus.
 * This stops at group catalogs and split assignments, never document tpl trees. */
export class DedicatedArenaInputs {
  private readonly models: ModelSnapshots;
  private readonly lifetime: AbortSignal;
  readonly site: Site;
  private readonly inputs;
  constructor(private readonly studio: StudioCtx, private readonly arena: ComponentArena | PageArena) {
    this.models = studio.modelSnapshots; this.site = studio.site; this.lifetime = studio.arenaState.lifetime();
    this.inputs = new ModelFieldInputs({ models: this.models, lifetime: this.lifetime, isCurrent: this.isCurrent }, this.collect);
  }
  isCurrent = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private collect = (field: DeclareModelFields) => {
    const groups = new Set<VariantGroup>();
    const group = (value: VariantGroup) => {
      if (groups.has(value)) { return; } groups.add(value);
      field(value, "type", "variants", "param"); field(value.param, "variable"); field(value.param.variable, "name");
      value.variants.forEach((variant) => field(variant, "name", "mediaQuery"));
    };
    const components = new Set<Component>();
    const component = (value: Component) => {
      if (components.has(value)) { return; } components.add(value);
      field(value, "name", "variants", "variantGroups", "superComp", "tplTree");
      value.variants.forEach((variant) => field(variant, "name"));
      value.variantGroups.forEach(group);
      if (value.superComp) { component(value.superComp); }
    };
    field(this.arena, "component", "matrix", "customMatrix"); component(this.arena.component);
    const root = this.arena.component.tplTree;
    field(root, "parent");
    if (isKnownTplComponent(root)) {
      field(root, "component"); field(root.component, "type", "name", "codeComponentMeta");
      if (root.component.codeComponentMeta) { field(root.component.codeComponentMeta, "variants"); }
    }
    for (const grid of [this.arena.matrix, this.arena.customMatrix]) {
      field(grid, "rows"); grid.rows.forEach((row) => {
        field(row, "rowKey", "cols");
        if (isKnownVariantGroup(row.rowKey)) { group(row.rowKey); }
        if (isKnownVariant(row.rowKey)) { field(row.rowKey, "uuid", "name", "parent"); if (row.rowKey.parent) { group(row.rowKey.parent); } }
      });
    }
    const firstCell = this.arena.matrix.rows[0]?.cols[0];
    if (firstCell) { field(firstCell, "frame"); field(firstCell.frame, "width"); }
    field(this.site, "globalVariantGroups", "projectDependencies", "activeScreenVariantGroup", "splits");
    this.site.globalVariantGroups.forEach(group);
    if (this.site.activeScreenVariantGroup) { group(this.site.activeScreenVariantGroup); }
    this.site.projectDependencies.forEach((dep) => {
      field(dep, "site"); field(dep.site, "globalVariantGroups", "hostLessPackageInfo"); dep.site.globalVariantGroups.forEach(group);
    });
    this.site.splits.forEach((split) => {
      field(split, "slices"); split.slices.forEach((slice) => {
        field(slice, "contents"); slice.contents.forEach((content) => { if (isKnownGlobalVariantSplitContent(content)) { field(content, "group"); } });
      });
    });
  };
  getSnapshot = () => this.inputs.read();
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);

}
export function useDedicatedArenaInputs(studio: StudioCtx, arena: ComponentArena | PageArena) {
  const source = React.useMemo(() => new DedicatedArenaInputs(studio, arena), [studio, arena]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return source;
}
