import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { isBaseVariant } from "@/wab/shared/Variants";
import { isTplVariantable } from "@/wab/shared/core/tpls";
import type { TplNode } from "@/wab/shared/model/classes";
import * as React from "react";

interface Scope { readonly view: ViewCtx; readonly models: ModelSnapshots; readonly signal: AbortSignal; }
interface Snapshot { readonly alive: boolean; readonly targeting: boolean; }
const inactive: Snapshot = Object.freeze({ alive: false, targeting: false });

/** The clone tint reads local target names, including a base variant renamed in place. */
export class CloneVariantInputs {
  private current = inactive;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly scope: Scope, private readonly tpl: TplNode | undefined) { this.getSnapshot(); }
  private closed() { return this.scope.signal.aborted || this.scope.models !== this.scope.view.studioCtx.modelSnapshots; }
  private disconnect = () => { this.connected = false; this.scope.signal.removeEventListener("abort", this.close); this.fields.forEach((stop) => stop()); this.fields.clear(); };
  private close = () => { this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const before = this.current; this.getSnapshot(); if (before !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.current = inactive; this.disconnect(); return this.current; }
    const { view, models } = this.scope;
    const used = new Set<ModelFieldStore<unknown>>();
    let targeting = false;
    if (this.tpl && isTplVariantable(this.tpl)) {
      for (let ancestor: TplNode | null | undefined = this.tpl; ancestor; ancestor = ancestor.parent) { used.add(models.field(ancestor, "parent")); }
      const frame = view.variantTplMgr().getContainingFrame(this.tpl);
      if (frame) {
        used.add(models.field(frame.component, "variants"));
        frame.component.variants.forEach((variant) => used.add(models.field(variant, "name")));
        const targets = frame.getTargetVariants();
        targets.forEach((variant) => used.add(models.field(variant, "name")));
        targeting = targets.some((variant) => !isBaseVariant(variant));
      }
    }
    if (!this.current.alive || this.current.targeting !== targeting) { this.current = Object.freeze({ alive: true, targeting }); }
    if (this.connected) {
      for (const field of used) { if (!this.fields.has(field)) { this.fields.set(field, field.subscribe(this.sync)); } }
      for (const [field, stop] of this.fields) { if (!used.has(field)) { stop(); this.fields.delete(field); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (this.closed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.scope.signal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useCloneVariantInputs(view: ViewCtx, tpl: TplNode | undefined, variants: unknown) {
  const scope = React.useMemo(() => ({ view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal }), [view]);
  const source = React.useMemo(() => new CloneVariantInputs(scope, tpl), [scope, tpl, variants]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
