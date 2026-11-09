import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { type TplNode, isKnownTplTag } from "@/wab/shared/model/classes";
import * as React from "react";

interface Scope { readonly view: ViewCtx; readonly models: ModelSnapshots; readonly signal: AbortSignal; }
interface Snapshot { readonly alive: boolean; readonly fields: readonly unknown[]; }
const inactive: Snapshot = Object.freeze({ alive: false, fields: Object.freeze([]) });

/** Structure used by inline placement; parent CSS remains in the native style owner. */
export class InlineAddInputs {
  private current = inactive;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly scope: Scope, private readonly node: TplNode | undefined) { this.getSnapshot(); }
  private closed() { return this.scope.signal.aborted || this.scope.models !== this.scope.view.studioCtx.modelSnapshots; }
  private disconnect = () => { this.connected = false; this.scope.signal.removeEventListener("abort", this.close); this.fields.forEach((stop) => stop()); this.fields.clear(); };
  private close = () => { this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const before = this.current; this.getSnapshot(); if (before !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.current = inactive; this.disconnect(); return this.current; }
    const { view, models } = this.scope, used = new Set<ModelFieldStore<unknown>>();
    if (this.node) {
      used.add(models.field(this.node, "parent"));
      used.add(models.field(view.currentComponent(), "tplTree"));
      if (isKnownTplTag(this.node)) { used.add(models.field(this.node, "tag")); used.add(models.field(this.node, "type")); used.add(models.field(this.node, "children")); }
      if (this.node.parent && isKnownTplTag(this.node.parent)) { used.add(models.field(this.node.parent, "type")); }
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
    if (this.closed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.scope.signal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useInlineAddInputs(view: ViewCtx | undefined, node: TplNode | undefined, selection: unknown) {
  const scope = React.useMemo(() => view ? { view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal } : undefined, [view]);
  const source = React.useMemo(() => scope ? new InlineAddInputs(scope, node) : undefined, [scope, node, selection]);
  const subscribe = source?.subscribe ?? (() => () => undefined), read = source?.getSnapshot ?? (() => inactive);
  return React.useSyncExternalStore(subscribe, read, read).alive;
}
