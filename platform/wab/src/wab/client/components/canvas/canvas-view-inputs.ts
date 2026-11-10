import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ObjInst } from "@/wab/shared/model/classes";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
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
  private readonly inputs;
  constructor(private readonly scope: Scope, recipe: CanvasViewFieldRecipe) {
    this.inputs = new ModelFieldInputs({ models: scope.models, lifetime: scope.signal,
      isCurrent: () => !this.closed() }, recipe);
  }
  private closed = () => {
    if (this.scope.retired || this.scope.signal.aborted || this.scope.models !== this.scope.studio.modelSnapshots) { this.scope.retired = true; return true; }
    return false;
  };
  getSnapshot = (): Snapshot => {
    if (this.closed()) { return inactive; }
    const fields = this.inputs.read();
    if (!this.current.alive || this.current.fields !== fields) { this.current = Object.freeze({ alive: true, fields }); }
    return this.current;
  };
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);

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
