import { useCurrentModelWorld, type VariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { allGlobalVariantGroups, getResponsiveStrategy, getSiteScreenSizes } from "@/wab/shared/core/sites";
import { getOrderedScreenVariantSpecs, isScreenVariantGroup } from "@/wab/shared/Variants";
import { ResponsiveStrategy } from "@/wab/shared/responsiveness";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq, ensure } from "@/wab/shared/common";
import { ObjInst, Site } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
let nextKey = 0;
/** Finite screen group labels, media queries, and the page-frame sizes used by the breakpoints panel. */
export class ResponsivePanelInputs {
  readonly key = ++nextKey;
  private readonly studio: StudioCtx;
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private readonly listeners = new Set<() => void>();
  private displayFields: readonly unknown[] | undefined;
  private display: Readonly<{ key: number; active: boolean; value: ReturnType<typeof readResponsivePanel> }> | undefined;
  getDisplay = () => {
    const fields = this.getSnapshot(), active = this.isActive();
    if (fields !== this.displayFields || this.display?.active !== active) {
      this.displayFields = fields;
      this.display = Object.freeze({ key: this.key, active, value: active ? readResponsivePanel(this.studio) : ensure(this.display, "Responsive inputs must capture an active owner before retirement").value });
    }
    return ensure(this.display, "Responsive inputs must capture their initial display");
  };
  constructor(world: VariantModelWorld) {
    this.studio = world.studio; this.models = world.models; this.site = world.site; this.lifetime = world.lifetime;
  }
  isActive = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => { this.connected = false; this.lifetime.removeEventListener("abort", this.close); this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear(); };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => { if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); } };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    field(this.site, "activeScreenVariantGroup", "globalVariantGroups", "projectDependencies", "pageArenas");
    const owners = [this.site, ...this.site.projectDependencies.map((dependency) => {
      field(dependency, "site", "name", "projectId"); field(dependency.site, "globalVariantGroups", "hostLessPackageInfo"); return dependency.site;
    })];
    const groups = new Set([...owners.flatMap((site) => site.globalVariantGroups), ...(this.site.activeScreenVariantGroup ? [this.site.activeScreenVariantGroup] : [])]);
    for (const group of groups) {
      field(group, "uuid", "type", "variants"); group.variants.forEach((variant) => field(variant, "uuid", "name", "mediaQuery"));
    }
    const firstPage = this.site.pageArenas[0];
    if (firstPage) {
      field(firstPage, "matrix"); field(firstPage.matrix, "rows");
      const firstRow = firstPage.matrix.rows[0];
      if (firstRow) { field(firstRow, "cols"); firstRow.cols.forEach((cell) => { field(cell, "frame"); field(cell.frame, "width", "height"); }); }
    }
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); } }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
    }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; } this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.dirty = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.publish(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useResponsivePanelInputs(studio: StudioCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new ResponsivePanelInputs(world), [world]);
  return React.useSyncExternalStore(source.subscribe, source.getDisplay, source.getDisplay);
}
export type ResponsivePanelSnapshot = ReturnType<typeof readResponsivePanel>;

function readResponsivePanel(studio: StudioCtx) {
  const site = studio.site, strategy = getResponsiveStrategy(site);
  const allScreenVariantGroups = allGlobalVariantGroups(site, { includeDeps: "direct", excludeEmpty: true, excludeHostLessPackages: true }).filter(isScreenVariantGroup);
  const active = site.activeScreenVariantGroup;
  return Object.freeze({
    strategy, isMobileFirst: strategy === ResponsiveStrategy.mobileFirst,
    isUnknownStrategy: strategy === ResponsiveStrategy.unknown,
    allScreenVariantGroups, activeScreenGroupId: active?.uuid,
    groupOptions: Object.freeze(allScreenVariantGroups.map((group) => Object.freeze({
      target: group, uuid: group.uuid, owned: site.globalVariantGroups.includes(group),
      ownerName: site.globalVariantGroups.includes(group) ? undefined : ensure(studio.projectDependencyManager.getOwnerDep(group), `Missing dependency for ${group.uuid}`).name,
    }))),
    isActiveOwnedBySite: !!active && site.globalVariantGroups.includes(active),
    orderedScreenVariants: (active ? getOrderedScreenVariantSpecs(site, active) : []).map((entry) => Object.freeze({ ...entry, name: entry.variant.name })),
    screenSizes: getSiteScreenSizes(site), hasAnyPageArena: site.pageArenas.length > 0,
  });
}
