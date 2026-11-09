import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ObjInst } from "@/wab/shared/model/classes";
import { arrayEq } from "@/wab/shared/common";
import * as React from "react";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";

type Declare = (model: ObjInst, ...fields: string[]) => void;
export type CanvasViewFieldRecipe = (declare: Declare) => void;
interface Scope { readonly studio: StudioCtx; readonly models: ModelSnapshots; readonly signal: AbortSignal; retired?: boolean; }
interface Snapshot { readonly alive: boolean; readonly fields: readonly unknown[]; }
const inactive: Snapshot = Object.freeze({ alive: false, fields: Object.freeze([]) });

/** Finite model fields for canvas chrome, tied to the originating view world. */
export class CanvasViewInputs {
  private current = inactive;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly scope: Scope, private readonly recipe: CanvasViewFieldRecipe) {}
  private closed = () => {
    if (this.scope.retired || this.scope.signal.aborted || this.scope.models !== this.scope.studio.modelSnapshots) { this.scope.retired = true; return true; }
    return false;
  };
  private disconnect = () => { this.connected = false; this.scope.signal.removeEventListener("abort", this.close); this.fields.forEach((stop) => stop()); this.fields.clear(); };
  private close = () => { this.scope.retired = true; this.current = inactive; this.disconnect(); this.listeners.forEach((listener) => listener()); };
  private sync = () => { const before = this.current; this.getSnapshot(); if (before !== this.current) { this.listeners.forEach((listener) => listener()); } };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { this.scope.retired = true; this.current = inactive; this.disconnect(); return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    this.recipe((model, ...keys) => keys.forEach((key) => used.add(this.scope.models.declaredField(model, key))));
    const values = [...used].map((store) => store.getState());
    if (!this.current.alive || !arrayEq(this.current.fields, values)) { this.current = Object.freeze({ alive: true, fields: Object.freeze(values) }); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (this.closed()) { this.scope.retired = true; return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.scope.signal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

const emptySubscribe = () => () => undefined;
const inactiveSnapshot = () => inactive;
export function useCanvasViewInputs(view: ViewCtx | undefined, recipe: CanvasViewFieldRecipe) {
  const scope = React.useMemo(() => view ? { studio: view.studioCtx, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal } : undefined, [view]);
  const source = React.useMemo(() => scope ? new CanvasViewInputs(scope, recipe) : undefined, [scope, recipe]);
  return React.useSyncExternalStore(source?.subscribe ?? emptySubscribe, source?.getSnapshot ?? inactiveSnapshot, source?.getSnapshot ?? inactiveSnapshot);
}
export const noCanvasModelFields: CanvasViewFieldRecipe = () => undefined;

/** Model-prop consumers retain their original world even when focused view changes. */
function useCanvasComponentSource(studio: StudioCtx, component: ObjInst, recipe: CanvasViewFieldRecipe) {
  // Model identity owns this binding; changing the surrounding Studio cannot
  // admit the same old prop into its replacement model world.
  const world = useVariantModelWorld(studio, component);
  return React.useMemo(() => world.alive ? new CanvasViewInputs({ studio, models: world.models, signal: world.lifetime }, recipe) : undefined, [world, studio, recipe]);
}

export function useCanvasComponentInputs(studio: StudioCtx, component: ObjInst, recipe: CanvasViewFieldRecipe) {
  const source = useCanvasComponentSource(studio, component, recipe);
  return React.useSyncExternalStore(source?.subscribe ?? emptySubscribe, source?.getSnapshot ?? inactiveSnapshot, source?.getSnapshot ?? inactiveSnapshot);
}

/** Project the declared finite fields into render values before crossing the
 * Hook boundary. Stable model identities remain usable by event commands. */
class CanvasViewValue<T> {
  private previous: Snapshot | undefined;
  private value: T | undefined;
  constructor(private readonly source: CanvasViewInputs | undefined, private readonly select: () => T) {}
  getSnapshot = (): T | undefined => {
    const snapshot = this.source?.getSnapshot() ?? inactive;
    if (snapshot !== this.previous) {
      this.previous = snapshot;
      this.value = snapshot.alive ? this.select() : undefined;
    }
    return this.value;
  };
}

export function useCanvasComponentValue<T>(studio: StudioCtx, component: ObjInst, recipe: CanvasViewFieldRecipe, select: () => T): T | undefined {
  const source = useCanvasComponentSource(studio, component, recipe);
  const value = React.useMemo(() => new CanvasViewValue(source, select), [source, select]);
  return React.useSyncExternalStore(source?.subscribe ?? emptySubscribe, value.getSnapshot, value.getSnapshot);
}
