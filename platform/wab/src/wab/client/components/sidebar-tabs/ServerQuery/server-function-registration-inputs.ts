import { contractSnapshot, type CanvasRegistration } from "@/wab/client/components/canvas/canvas-registrations";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { CustomFunction } from "@/wab/shared/model/classes";
import type { CustomFunctionRegistration } from "@plasmicapp/host";
import { isEqual } from "lodash";
import * as React from "react";

/** Host registration clears invalidate this lookup; only this function's actual
 * implementation or copied metadata contract publishes to query consumers. */
export function useServerFunctionRegistration(studio: StudioCtx, func: CustomFunction | undefined) {
  const identity = func ?? studio;
  const world = useVariantModelWorld(studio, identity);
  const source = React.useMemo(() => createServerFunctionRegistrationSource(func, world, studio), [world, studio, func]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createServerFunctionRegistrationSource(func: Parameters<typeof useServerFunctionRegistration>[1], world: ReturnType<typeof useVariantModelWorld>, studio: ReturnType<typeof useVariantModelWorld>['studio']) {
    let current: CanvasRegistration<CustomFunctionRegistration> | undefined;
    const read = () => {
      if (!func || world.studio !== studio || !world.isCurrent()) { return undefined; }
      const runtime = studio.getRegisteredFunction(func);
      if (!runtime) { current = undefined; return current; }
      const contract = contractSnapshot(runtime.meta);
      if (!current || current.runtime.function !== runtime.function || !isEqual(current.contract, contract)) {
        current = Object.freeze({ runtime: Object.freeze({ ...runtime }), contract });
      }
      return current;
    };
    const subscribe = (listener: () => void) => {
      if (!func || world.studio !== studio || !world.isCurrent()) { return () => undefined; }
      const notify = () => { const previous = current; read(); if (previous !== current) { listener(); } };
      const stopRegistry = studio.subscribeCodeRegistrations(notify);
      const stopName = world.models.field(func, "importName").subscribe(notify);
      const stopNamespace = world.models.field(func, "namespace").subscribe(notify);
      const disconnect = () => { stopRegistry(); stopName(); stopNamespace(); world.lifetime.removeEventListener("abort", disconnect); };
      world.lifetime.addEventListener("abort", disconnect, { once: true }); read();
      return disconnect;
    };
    return { read, subscribe };
  }
