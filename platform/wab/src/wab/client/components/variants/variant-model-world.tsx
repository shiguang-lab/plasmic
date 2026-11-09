import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { Site } from "@/wab/shared/model/classes";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import * as React from "react";

export interface VariantModelWorld {
  readonly studio: StudioCtx;
  readonly models: ModelSnapshots;
  readonly site: Site;
  readonly lifetime: AbortSignal;
  readonly isCurrent: (view?: ViewCtx) => boolean;
}

/** Model identity belongs to the world in which its props were received.
 * A changed view is a separate runtime input and cannot admit old models. */
export function captureVariantModelWorld(studio: StudioCtx): VariantModelWorld {
  const models = studio.modelSnapshots, site = studio.site, lifetime = studio.arenaState.lifetime();
  const isCurrent = (view?: ViewCtx) => !lifetime.aborted && models === studio.modelSnapshots && site === studio.site && (!view || !view.disposeSignal.aborted && !view.isDisposed && view.modelLifetime === lifetime);
  return { studio, models, site, lifetime, isCurrent };
}

/** The current world is the actual model owner and arena lifetime, rather than
 * a revision counter used to refresh reads from mutable Studio fields. */
class CurrentModelWorldInputs {
  private current: VariantModelWorld;
  constructor(private readonly studio: StudioCtx) { this.current = captureVariantModelWorld(studio); }
  read = () => {
    if (this.current.models !== this.studio.modelSnapshots || this.current.site !== this.studio.site || this.current.lifetime !== this.studio.arenaState.lifetime()) {
      this.current = captureVariantModelWorld(this.studio);
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    const stopModel = this.studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = this.studio.arenaState.store.subscribe(listener);
    return () => { stopModel(); stopArena(); };
  };
}

/** Consumers without a model prop follow completed owner replacements. */
export function useCurrentModelWorld(studio: StudioCtx) {
  const source = React.useMemo(() => new CurrentModelWorldInputs(studio), [studio]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

class VariantModelBinding {
  readonly captured: VariantModelWorld;
  constructor(readonly studio: StudioCtx, readonly identity: object) {
    this.captured = captureVariantModelWorld(studio);
  }
}

export function useVariantModelWorld(studio: StudioCtx, identity: object, view?: ViewCtx) {
  const [binding, setBinding] = React.useState(() => new VariantModelBinding(studio, identity));
  if (binding.identity !== identity) { setBinding(new VariantModelBinding(studio, identity)); }
  const world = binding.captured;
  const isCurrent = React.useCallback((requestedView?: ViewCtx) => binding.studio === studio && world.isCurrent(view) && world.isCurrent(requestedView), [binding, world, studio, view]);
  const subscribe = React.useCallback((listener: () => void) => {
    if (!isCurrent()) { return () => undefined; }
    world.lifetime.addEventListener("abort", listener, { once: true });
    view?.disposeSignal.addEventListener("abort", listener, { once: true });
    return () => { world.lifetime.removeEventListener("abort", listener); view?.disposeSignal.removeEventListener("abort", listener); };
  }, [world, view, isCurrent]);
  const alive = React.useSyncExternalStore(subscribe, isCurrent, isCurrent);
  return React.useMemo(() => ({ ...world, isCurrent, alive }), [world, isCurrent, alive]);
}
