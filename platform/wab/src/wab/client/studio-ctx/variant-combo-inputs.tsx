import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isCodeComponentVariant, isVariantSettingEmpty, makeVariantName, tryGetVariantSetting, VariantCombo } from "@/wab/shared/Variants";
import { arrayEq, assert } from "@/wab/shared/common";
import { isTplComponent, isTplVariantable } from "@/wab/shared/core/tpls";
import { ObjInst, TplNode, VariantSetting } from "@/wab/shared/model/classes";
import * as React from "react";

interface ComboLabel { readonly uuid: string; readonly name: string; }
export interface VariantComboInputs {
  readonly labels: readonly ComboLabel[];
  readonly tpl: ModelRef<TplNode> | undefined;
  readonly setting: ModelRef<VariantSetting> | undefined;
}
const empty: VariantComboInputs = Object.freeze({ labels: Object.freeze([]), tpl: undefined, setting: undefined });

/** Finite labels and presence of a nonempty setting, using the original variant algorithms. */
export class VariantComboSource {
  private readonly models;
  private readonly site;
  private current = empty;
  private dirty = true;
  private closed = false;
  private connected = false;
  private selection: unknown;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepared: () => void; published: () => void }>();
  private stopSelection: (() => void) | undefined;
  constructor(private readonly view: ViewCtx, private readonly combo: VariantCombo) {
    this.models = view.studioCtx.modelSnapshots; this.site = view.site; this.getSnapshot();
  }
  private isClosed() { return this.closed || this.view.disposeSignal.aborted || this.view.studioCtx.modelSnapshots !== this.models; }
  private invalidate = () => { this.dirty = true; };
  private sync = () => { const before = this.current; this.dirty = true; this.getSnapshot(); if (before !== this.current) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false; this.stopSelection?.(); this.stopSelection = undefined;
    this.view.disposeSignal.removeEventListener("abort", this.close);
    for (const stops of this.fields.values()) { stops.prepared(); stops.published(); } this.fields.clear();
  };
  private close = () => {
    if (this.closed) { return; } this.closed = true; this.current = empty; this.disconnect();
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  getSnapshot = (): VariantComboInputs => {
    if (this.isClosed()) { this.current = empty; return this.current; }
    const selection = this.view.selectionStore.getState().tpls;
    if (this.selection !== selection) { this.selection = selection; this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    this.combo.forEach((variant) => field(variant, "uuid", "name", "selectors", "forTpl", "codeComponentName", "codeComponentVariantKeys"));
    // The default makeVariantName path uses this local registry only for code variants.
    if (this.combo.some(isCodeComponentVariant)) {
      field(this.site, "components");
      this.site.components.forEach((component) => {
        field(component, "variants");
        const variants = component.variants.filter((variant) => this.combo.includes(variant) && isCodeComponentVariant(variant));
        if (!variants.length) { return; }
        field(component, "tplTree");
        const root = component.tplTree; field(root, "parent");
        if (isTplComponent(root)) {
          field(root, "component"); field(root.component, "type", "codeComponentMeta");
          const meta = root.component.codeComponentMeta;
          if (meta) {
            field(meta, "variants");
            variants.filter(isCodeComponentVariant).forEach((variant) => variant.codeComponentVariantKeys.forEach((key) => {
              const value = meta.variants[key]; if (value) { field(value, "displayName"); }
            }));
          }
        }
      });
    }
    const tpl = this.view.focusedTpl() ?? undefined;
    let setting: VariantSetting | undefined;
    if (tpl && isTplVariantable(tpl)) {
      field(tpl, "vsettings");
      tpl.vsettings.forEach((value) => {
        field(value, "variants"); value.variants.forEach((variant) => field(variant, "name"));
      });
      const candidate = tryGetVariantSetting(tpl, this.combo);
      if (candidate) {
        field(candidate, "rs", "args", "attrs", "dataCond", "dataRep", "text");
        field(candidate.rs, "values", "mixins", "animations");
        if (!isVariantSettingEmpty(candidate)) { setting = candidate; }
      }
    }
    const before = this.current;
    const labels = this.combo.map((variant, index) => {
      const name = makeVariantName({ variant, site: this.site }), previous = before.labels[index];
      return previous?.uuid === variant.uuid && previous.name === name ? previous : Object.freeze({ uuid: variant.uuid, name });
    });
    const tplRef = tpl ? this.models.ref(tpl) : undefined, settingRef = setting ? this.models.ref(setting) : undefined;
    if (before.tpl !== tplRef || before.setting !== settingRef || !arrayEq(before.labels, labels)) {
      this.current = Object.freeze({ labels: Object.freeze(labels), tpl: tplRef, setting: settingRef });
    }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepared: this.models.subscribePreparedField(store, this.invalidate), published: store.subscribe(this.sync) }); } }
      for (const [store, stops] of this.fields) { if (!used.has(store)) { stops.prepared(); stops.published(); this.fields.delete(store); } }
    }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.stopSelection = this.view.selectionStore.subscribe(this.sync); this.view.disposeSignal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
  resolve<T extends ObjInst>(ref: ModelRef<T>): T { assert(!this.isClosed(), "Cannot resolve a closed variant combo"); return this.models.resolve(ref); }
}
export function useVariantComboInputs(view: ViewCtx, combo: VariantCombo) {
  const source = React.useMemo(() => new VariantComboSource(view, combo), [view, combo]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, resolve: <T extends ObjInst>(ref: ModelRef<T>) => source.resolve(ref) };
}
