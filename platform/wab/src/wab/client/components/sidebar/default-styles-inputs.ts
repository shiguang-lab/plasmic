import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import type { ObjInst, Site } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
let nextKey = 0;
/** Theme selector identities and the variant picker; CSS contents belong to the mixin form. */
export class DefaultStylesInputs {
  readonly key = ++nextKey;
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private published = empty;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private dirty = true;
  constructor(private readonly studio: StudioCtx) {
    this.models = studio.modelSnapshots; this.site = studio.site; this.lifetime = studio.arenaState.lifetime();
  }
  isActive = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear();
  };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => {
    if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); }
  };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    field(this.site, "activeTheme", "globalVariantGroups", "activeScreenVariantGroup");
    const theme = this.site.activeTheme;
    if (theme) {
      field(theme, "defaultStyle", "styles");
      theme.styles.forEach((style) => field(style, "selector", "style"));
    }
    [...this.site.globalVariantGroups, ...(this.site.activeScreenVariantGroup ? [this.site.activeScreenVariantGroup] : [])].forEach((group) => {
      field(group, "variants", "type");
      group.variants.forEach((variant) => field(variant, "uuid", "name", "parent", "mediaQuery"));
    });
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) {
        if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); }
      }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
    }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.dirty = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.publish(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useDefaultStylesInputs(studio: StudioCtx) {
  const subscribe = React.useCallback((listener: () => void) => studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } }), [studio]);
  const read = React.useCallback(() => studio.modelSnapshots, [studio]);
  const models = React.useSyncExternalStore(subscribe, read, read);
  const lifetime = studio.arenaState.lifetime();
  const source = React.useMemo(() => new DefaultStylesInputs(studio), [studio, models, studio.site, lifetime]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { source, snapshot };
}
