import { getAllVariantsForTpl, getVariantLabel, isBaseVariant, isGlobalVariant, isPrivateStyleVariant, isScreenVariant, isStandaloneVariant, isStyleOrCodeComponentVariant } from "@/wab/shared/Variants";
import { ensure, partitions, xGroupBy } from "@/wab/shared/common";
import { isVariantUsedInSplits } from "@/wab/shared/core/splits";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import { Component, ObjInst, Site, Variant, VariantGroup, isKnownGlobalVariantSplitContent } from "@/wab/shared/model/classes";
import * as React from "react";

export interface PreviewVariantEntry {
  readonly command: Variant;
  readonly uuid: string;
  readonly name: string;
  readonly parentName: string | undefined;
  readonly label: string;
}
export type PreviewVariantGroup = {
  readonly type: "standalone";
  readonly name: undefined;
  readonly variants: readonly PreviewVariantEntry[];
} | {
  readonly type: "single" | "multi";
  readonly name: string;
  readonly variants: readonly PreviewVariantEntry[];
};
interface PreviewVariantSnapshot {
  readonly alive: boolean;
  readonly fields: readonly unknown[];
  readonly labels: Readonly<Record<string, string>>;
  readonly groups: readonly PreviewVariantGroup[];
}
const closedSnapshot: PreviewVariantSnapshot = Object.freeze({ alive: false, fields: Object.freeze([]), labels: Object.freeze({}), groups: Object.freeze([]) });

/** Only the model fields read by the preview variant picker and its open menu.
 * Selection/navigation remain owned by PreviewCtx; commands retain real variants. */
export class PreviewVariantInputs {
  private current: PreviewVariantSnapshot = closedSnapshot;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;

  constructor(private readonly studio: StudioCtx, private readonly component: Component | undefined) {
    this.models = studio.modelSnapshots;
    this.site = studio.site;
    this.lifetime = studio.arenaState.lifetime();
    this.getSnapshot();
  }

  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop());
    this.fields.clear();
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true;
    this.current = closedSnapshot;
    this.disconnect();
    this.listeners.forEach((listener) => listener());
    this.listeners.clear();
  };
  private sync = () => {
    const previous = this.current;
    this.getSnapshot();
    if (previous !== this.current) { this.listeners.forEach((listener) => listener()); }
  };

  getSnapshot = (): PreviewVariantSnapshot => {
    if (this.closed || this.lifetime.aborted || this.studio.modelSnapshots !== this.models || !this.component) {
      this.current = closedSnapshot;
      this.disconnect();
      return this.current;
    }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    const variants = new Set<Variant>(), groups = new Set<VariantGroup>();
    const variant = (value: Variant) => {
      if (variants.has(value)) { return; }
      variants.add(value);
      field(value, "uuid", "name", "parent", "selectors", "forTpl", "mediaQuery", "codeComponentName", "codeComponentVariantKeys");
      if (value.parent) { group(value.parent); }
    };
    const group = (value: VariantGroup) => {
      if (groups.has(value)) { return; }
      groups.add(value);
      field(value, "variants", "param", "multi", "type");
      field(value.param, "variable");
      field(value.param.variable, "name");
      value.variants.forEach(variant);
    };
    field(this.component, "variants", "variantGroups");
    this.component.variants.forEach(variant);
    this.component.variantGroups.forEach(group);
    const sites = new Set<Site>();
    const globals = (site: Site) => {
      if (sites.has(site)) { return; }
      sites.add(site);
      field(site, "globalVariantGroups", "projectDependencies");
      site.globalVariantGroups.forEach(group);
      site.projectDependencies.forEach((dependency) => {
        field(dependency, "site");
        globals(dependency.site);
      });
    };
    globals(this.site);
    field(this.site, "splits");
    this.site.splits.forEach((split) => {
      field(split, "slices");
      split.slices.forEach((slice) => {
        field(slice, "contents");
        slice.contents.forEach((content) => {
          if (isKnownGlobalVariantSplitContent(content)) { field(content, "group"); }
        });
      });
    });
    const values = [...used].map((store) => store.getState());
    if (!this.current.alive || !arrayEq(this.current.fields, values)) {
      const variants = getAllVariantsForTpl({ component: this.component, tpl: null, site: this.site }).filter((variant) => !isStyleOrCodeComponentVariant(variant) && !isScreenVariant(variant) && !isPrivateStyleVariant(variant) && !isBaseVariant(variant));
      const [standalone, split, local, global] = partitions(variants, [isStandaloneVariant, (variant) => isVariantUsedInSplits(this.site, variant), (variant) => !isGlobalVariant(variant)]);
      const entry = (variant: Variant): PreviewVariantEntry => Object.freeze({ command: variant, uuid: variant.uuid, name: variant.name, parentName: variant.parent?.param.variable.name, label: getVariantLabel(this.site, variant) });
      const grouped = (items: Variant[]): PreviewVariantGroup[] => [...xGroupBy(items, (variant) => ensure(variant.parent, "A grouped variant requires a parent"))].map(([group, items]) => Object.freeze({ type: group.multi ? "multi" : "single", name: group.param.variable.name, variants: Object.freeze(items.map(entry)) }));
      const groups: PreviewVariantGroup[] = [...standalone.map((variant): PreviewVariantGroup => Object.freeze({ type: "standalone", name: undefined, variants: Object.freeze([entry(variant)]) })), ...grouped(local), ...(split.length ? [Object.freeze({ type: "multi" as const, name: "Splits", variants: Object.freeze(split.map(entry)) })] : []), ...grouped(global)];
      this.current = Object.freeze({ alive: true, fields: Object.freeze(values), groups: Object.freeze(groups), labels: Object.freeze(Object.fromEntries(variants.map((variant) => [variant.uuid, getVariantLabel(this.site, variant)]))) });
    }
    if (this.connected) {
      for (const store of used) {
        if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); }
      }
      for (const [store, stop] of this.fields) {
        if (!used.has(store)) { stop(); this.fields.delete(store); }
      }
    }
    return this.current;
  };

  subscribe = (listener: () => void) => {
    if (this.closed || this.lifetime.aborted) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.sync();
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.disconnect(); }
    };
  };
}

export function usePreviewVariantModelInputs(studio: StudioCtx, component: Component | undefined) {
  const world = useVariantModelWorld(studio, component ?? studio);
  const source = React.useMemo(() => new PreviewVariantInputs(world.studio, component), [world.studio, world.models, component]);
  const subscribe = React.useCallback((listener: () => void) => world.alive ? source.subscribe(listener) : () => undefined, [world.alive, source]);
  const read = React.useCallback(() => world.alive ? source.getSnapshot() : closedSnapshot, [world.alive, source]);
  return React.useSyncExternalStore(subscribe, read, read);
}
