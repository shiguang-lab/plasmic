import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import * as React from "react";

interface Scope { readonly view: ViewCtx; readonly models: ModelSnapshots; readonly signal: AbortSignal; }
interface Snapshot { readonly alive: boolean; readonly fields: readonly unknown[]; }
const inactive: Snapshot = Object.freeze({ alive: false, fields: Object.freeze([]) });

/** Remote slot selections resolve a live ValComponent's parameter uuid roster. */
export class PlayerSelectionInputs {
  private current = inactive;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly scope: Scope, private readonly key?: string) { this.getSnapshot(); }
  private disconnect = () => {
    this.connected = false; this.scope.signal.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => { this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const previous = this.current; this.getSnapshot(); if (previous !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    const { view, models, signal } = this.scope;
    if (signal.aborted || models !== view.studioCtx.modelSnapshots) { this.current = inactive; this.disconnect(); return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const [valKey, paramUuid] = this.key?.split("~") ?? [];
    const val = valKey && paramUuid ? view.renderState.fullKey2val(valKey) : undefined;
    if (val && isValComponent(val)) {
      used.add(models.field(val.tpl, "component"));
      used.add(models.field(val.tpl.component, "params"));
      val.tpl.component.params.forEach((param) => used.add(models.field(param, "uuid")));
    }
    const values = [...used].map((field) => field.getState());
    if (!this.current.alive || !arrayEq(this.current.fields, values)) { this.current = Object.freeze({ alive: true, fields: Object.freeze(values) }); }
    if (this.connected) {
      for (const field of used) { if (!this.fields.has(field)) { this.fields.set(field, field.subscribe(this.sync)); } }
      for (const [field, stop] of this.fields) { if (!used.has(field)) { stop(); this.fields.delete(field); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (this.scope.signal.aborted || this.scope.models !== this.scope.view.studioCtx.modelSnapshots) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.scope.signal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function usePlayerSelectionInputs(view: ViewCtx | undefined, key: string | undefined, renderCount: number) {
  const scope = React.useMemo(() => view ? { view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal } : undefined, [view]);
  const source = React.useMemo(() => scope ? new PlayerSelectionInputs(scope, key) : undefined, [scope, key, renderCount]);
  const subscribe = source?.subscribe ?? (() => () => undefined), read = source?.getSnapshot ?? (() => inactive);
  return React.useSyncExternalStore(subscribe, read, read).alive;
}
