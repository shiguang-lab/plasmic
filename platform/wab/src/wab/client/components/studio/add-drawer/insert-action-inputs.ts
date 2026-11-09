import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { Component } from "@/wab/shared/model/classes";
import * as React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const noComponent = createStore<Component["type"] | undefined>(() => undefined);

/** An AddItem carrying a component keeps that command identity in the model
 * world where it was rendered; a retained item cannot target a replacement world. */
export function useInsertActionComponent(studio: StudioCtx, component: Component | undefined) {
  const binding = React.useMemo(() => {
    if (!component) { return undefined; }
    const models = studio.modelSnapshots, lifetime = studio.arenaState.lifetime();
    return { models, lifetime, type: lifetime.aborted ? noComponent : models.field(component, "type") };
  }, [studio, component]);
  const subscribe = React.useCallback((listener: () => void) => {
    if (!binding || binding.lifetime.aborted) { return () => undefined; }
    binding.lifetime.addEventListener("abort", listener, { once: true });
    return () => binding.lifetime.removeEventListener("abort", listener);
  }, [binding]);
  const isCurrent = React.useCallback(() => !binding || !binding.lifetime.aborted && binding.models === studio.modelSnapshots, [studio, binding]);
  const alive = React.useSyncExternalStore(subscribe, isCurrent, isCurrent);
  useStore(alive ? binding?.type ?? noComponent : noComponent);
  return { alive, isCurrent };
}
