import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { Component, ComponentArena, PageArena, ObjInst, Site, VariantGroup, isKnownGlobalVariantSplitContent, isKnownTplComponent, isKnownVariantGroup, isKnownVariant } from "@/wab/shared/model/classes";
import * as React from "react";

const retired: readonly unknown[] = Object.freeze([]);

/** Fields read by arena row labels, combo availability and the add menus.
 * This stops at group catalogs and split assignments, never document tpl trees. */
export class DedicatedArenaInputs {
  private readonly models: ModelSnapshots;
  private readonly lifetime: AbortSignal;
  readonly site: Site;
  private current = retired;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly studio: StudioCtx, private readonly arena: ComponentArena | PageArena) {
    this.models = studio.modelSnapshots; this.site = studio.site; this.lifetime = studio.arenaState.lifetime(); this.getSnapshot();
  }
  isCurrent = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.sync);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private sync = () => {
    const before = this.current; this.getSnapshot();
    if (!this.isCurrent()) { this.disconnect(); }
    if (before !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isCurrent()) { this.current = retired; return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
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
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isCurrent()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.sync, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
export function useDedicatedArenaInputs(studio: StudioCtx, arena: ComponentArena | PageArena) {
  const source = React.useMemo(() => new DedicatedArenaInputs(studio, arena), [studio, arena]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return source;
}
