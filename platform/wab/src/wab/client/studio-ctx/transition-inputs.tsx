import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { getRuleSetRawValue } from "@/wab/shared/RuleSetHelpers";
import { isBaseVariantName } from "@/wab/shared/Variants";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { transitionProps } from "@/wab/shared/core/style-props";
import { isTplAttachedToSite } from "@/wab/shared/core/sites";
import type { ObjInst } from "@/wab/shared/model/classes";
import * as React from "react";

const emptyRaw: readonly (string | undefined)[] = Object.freeze(transitionProps.map(() => undefined));

/** The original first base setting and raw (unexpanded) transition fields.
 * No active variant, mixin, theme or parent values enter this read recipe. */
export class BaseTransitionInputs {
  private readonly models;
  private readonly owner;
  private readonly site;
  private readonly lifetime;
  private current = emptyRaw;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { captured: unknown; prepare?: () => void; publish?: () => void }>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly provider: TplExpsProvider) {
    const source = provider.getNativeStyleSource();
    assert(source.kind === "tpl", "Base transitions require the original tpl provider");
    this.models = provider.studioCtx.modelSnapshots; this.owner = source.inputs;
    this.site = source.source.site; this.lifetime = provider.viewCtx.disposeSignal;
    if (!this.isClosed()) { assert(isTplAttachedToSite(this.site, provider.tpl), "Transition element belongs to another model world"); }
    this.getSnapshot();
  }
  private isClosed() { return this.owner.isDisposed || this.lifetime.aborted || this.provider.studioCtx.modelSnapshots !== this.models || this.provider.studioCtx.site !== this.site; }
  private invalidate = () => { this.dirty = true; };
  private notify = () => { if (!this.isClosed()) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.disconnect);
    for (const binding of this.fields.values()) { binding.prepare?.(); binding.publish?.(); binding.prepare = undefined; binding.publish = undefined; }
    if (this.isClosed()) { this.listeners.clear(); }
  };
  getSnapshot = (): readonly (string | undefined)[] => {
    if (this.isClosed()) { this.disconnect(); return this.current; }
    if (!this.connected && [...this.fields].some(([field, binding]) => field.getState() !== binding.captured)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = <T extends ObjInst, K extends Exclude<keyof T, "uid"> & string>(model: T, key: K) => {
      const store = this.models.field(model, key); used.add(store); return store.getState();
    };
    const settingRef = field(this.provider.tpl, "vsettings").find((ref) => {
      const setting = this.models.resolve(ref), variants = field(setting, "variants");
      return variants.length === 1 && isBaseVariantName(field(this.models.resolve(variants[0]), "name"));
    });
    const setting = this.models.resolve(ensure(settingRef, "Unexpected undefined base variant for tpl"));
    const rs = this.models.resolve(field(setting, "rs")), values = field(rs, "values");
    const next = transitionProps.map((prop) => getRuleSetRawValue(values, prop));
    if (!arrayEq(next, this.current)) { this.current = Object.freeze(next); }
    for (const store of used) {
      let binding = this.fields.get(store);
      if (!binding) { binding = { captured: store.getState() }; this.fields.set(store, binding); }
      binding.captured = store.getState();
      if (this.connected && !binding.prepare) {
        binding.prepare = this.models.subscribePreparedField(store, this.invalidate);
        binding.publish = store.subscribe(this.notify);
      }
    }
    for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare?.(); binding.publish?.(); this.fields.delete(store); } }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { this.disconnect(); return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.lifetime.addEventListener("abort", this.disconnect, { once: true });
      this.dirty = true; this.getSnapshot();
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useBaseTransitionInputs(provider: TplExpsProvider | undefined) {
  const source = React.useMemo(() => provider ? new BaseTransitionInputs(provider) : undefined, [provider]);
  const subscribe = React.useCallback((listener: () => void) => source ? source.subscribe(listener) : () => undefined, [source]);
  const getSnapshot = React.useCallback(() => source ? source.getSnapshot() : emptyRaw, [source]);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
