import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { collectPropExpressionFields } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { arrayEq, ensure } from "@/wab/shared/common";
import { clone, extractReferencedParam } from "@/wab/shared/core/exprs";
import { ObjInst, Component, Expr, Param } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
/** Original image-variable parameter default and exact nested expression fields. */
export class ImageDefaultInputs {
  private readonly models: ModelSnapshots;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private readonly listeners = new Set<() => void>();
  private displayFields: readonly unknown[] | undefined;
  private display: Readonly<{ active: boolean; referencedParam: Param | undefined; defaultExpr: Expr | undefined }> | undefined;
  constructor(private readonly studio: StudioCtx, private readonly component: Component, private readonly expr: Expr) {
    this.models = studio.modelSnapshots; this.lifetime = studio.arenaState.lifetime();
  }
  isActive = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots;
  getDisplay = () => {
    const fields = this.getSnapshot(), active = this.isActive();
    if (fields !== this.displayFields || this.display?.active !== active) {
      this.displayFields = fields;
      const referencedParam = active ? extractReferencedParam(this.component, this.expr) : undefined;
      this.display = Object.freeze({ active, referencedParam, defaultExpr: referencedParam?.defaultExpr ? clone(referencedParam.defaultExpr) : undefined });
    }
    return ensure(this.display, "Image defaults must capture their initial display");
  };
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
    field(this.component, "params"); collectPropExpressionFields(this.expr, field);
    this.component.params.forEach((param) => { field(param, "variable", "defaultExpr"); field(param.variable, "name"); collectPropExpressionFields(param.defaultExpr, field); });
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

export function useImageDefaultInputs(studio: StudioCtx, component: Component, expr: Expr) {
  const source = React.useMemo(() => new ImageDefaultInputs(studio, component, expr), [studio, component, expr]);
  return React.useSyncExternalStore(source.subscribe, source.getDisplay, source.getDisplay);
}
