import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import { ObjInst, Site, Variant, VariantedValue } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
let nextPanelKey = 0;

/** Only the token directory and resolution inputs; component documents are unrelated. */
export class TokenPanelInputs {
  readonly key = ++nextPanelKey;
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private published = empty;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepared: () => void; stop: () => void }>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  private dirty = true;
  constructor(private readonly studio: StudioCtx, private readonly kind: "data" | "style") {
    this.models = studio.modelSnapshots;
    this.site = studio.site;
    this.lifetime = studio.arenaState.lifetime();
  }
  isActive = () => !this.closed && !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach(({ prepared, stop }) => { prepared(); stop(); });
    this.fields.clear();
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true; this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear();
  };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => {
    if (this.current !== this.published) {
      this.published = this.current;
      this.listeners.forEach((listener) => listener());
    }
  };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    // Detached sources compare fields again when React reattaches them.
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    const variants = new Set<Variant>();
    const variant = (value: Variant) => {
      if (variants.has(value)) { return; }
      variants.add(value);
      field(value, "uuid", "name", "parent", "mediaQuery", "selectors", "forTpl");
      if (value.parent) {
        field(value.parent, "variants", "type", "multi", "param");
        field(value.parent.param, "variable"); field(value.parent.param.variable, "name");
      }
    };
    const varianted = (values: readonly VariantedValue[]) => values.forEach((value) => {
      field(value, "variants", "value"); value.variants.forEach(variant);
    });
    const sites = new Set<Site>();
    const visit = (site: Site, depth: number) => {
      if (sites.has(site)) { return; } sites.add(site);
      field(site, this.kind === "style" ? "styleTokens" : "dataTokens");
      const tokens = this.kind === "style" ? site.styleTokens : site.dataTokens;
      tokens.forEach((token) => {
        field(token, "uuid", "name", "value", "type", "isRegistered", "regKey");
        if (this.kind === "style") { field(token, "variantedValues"); varianted(token.variantedValues); }
      });
      if (this.kind === "style") {
        field(site, "globalVariantGroups", "activeScreenVariantGroup");
        const groups = [...site.globalVariantGroups, ...(site.activeScreenVariantGroup ? [site.activeScreenVariantGroup] : [])];
        groups.forEach((group) => { field(group, "variants", "type", "param", "multi"); group.variants.forEach(variant); });
      }
      if (this.kind === "style" || depth === 0) {
        field(site, "projectDependencies");
        site.projectDependencies.forEach((dependency) => {
          field(dependency, "site", "projectId");
          if (depth === 0) { field(dependency, "uuid", "name"); field(dependency.site, "hostLessPackageInfo"); }
          visit(dependency.site, depth + 1);
        });
      }
    };
    visit(this.site, 0);
    field(this.site, "styleTokenOverrides");
    this.site.styleTokenOverrides.forEach((override) => {
      field(override, "token", "value"); field(override.token, "uuid");
      if (this.kind === "style") { field(override, "variantedValues"); varianted(override.variantedValues); }
    });
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) {
        if (!this.fields.has(store)) {
          this.fields.set(store, { prepared: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) });
        }
      }
      for (const [store, binding] of this.fields) {
        if (!used.has(store)) { binding.prepared(); binding.stop(); this.fields.delete(store); }
      }
    }
    this.dirty = false;
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.dirty = true;
      this.lifetime.addEventListener("abort", this.close, { once: true }); this.publish();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useTokenPanelInputs(studio: StudioCtx, kind: "data" | "style") {
  const lifetime = studio.arenaState.lifetime();
  const source = React.useMemo(() => new TokenPanelInputs(studio, kind), [studio, studio.modelSnapshots, studio.site, lifetime, kind]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return source;
}
