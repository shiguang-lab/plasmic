import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import { HOSTLESS_PKGS_KEY } from "@/wab/client/studio-ctx/hostless-pkgs-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getComponentPresets, type Preset } from "@/wab/client/code-components/code-presets";
import { modelKeys } from "@/wab/shared/model-revisions";
import type { CodeComponent } from "@/wab/shared/core/components";
import { useStore } from "zustand";
import * as React from "react";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";

/**
 * Which code component's preset picker is open.
 *
 * Replaces `StudioCtx._presetsModalComponent` (`observable.box`). Opened from the
 * add drawer / insert panel, read by `ComponentPresetsModal`.
 */
export interface PresetsSnapshot {
  readonly modalComponent: CodeComponent | undefined;
}

export function createPresetsStore() {
  return createStudioStore<PresetsSnapshot>(
    () => ({ modalComponent: undefined }),
    { name: "studio-presets" },
  );
}

export type PresetsStore = ReturnType<typeof createPresetsStore>;

const emptyPresets = createPresetsStore();

/** Reactive read for the preset modal. */
export function usePresetsModalComponent(
  studio: StudioCtx,
): CodeComponent | undefined {
  return useStore(
    resolveStore(studio.presetsStore, emptyPresets),
    (state) => state.modalComponent,
  );
}

/** Shared stable empty result for "no component selected". */
const EMPTY_PRESETS: readonly Preset[] = Object.freeze([]);

/**
 * Registered templates for a code component.
 *
 * Subscribes to the same revisions `getComponentPresets` caches on, so the
 * picker updates once hostless packages register or the site changes.
 */
export function useComponentPresets(
  studio: StudioCtx,
  component: CodeComponent | undefined,
): readonly Preset[] {
  const world = useVariantModelWorld(studio, component ?? EMPTY_PRESETS);
  const isCurrent = world.isCurrent;
  const subscribe = React.useCallback((listener: () => void) => {
    if (!component || !isCurrent()) { return () => undefined; }
    const stopModel = studio.modelRevisions.subscribeModelKeys([modelKeys.site, HOSTLESS_PKGS_KEY], listener);
    const stopRegistry = studio.subscribeCodeRegistrations(listener);
    const close = () => { stopModel(); stopRegistry(); listener(); };
    world.lifetime.addEventListener("abort", close, { once: true });
    return () => { stopModel(); stopRegistry(); world.lifetime.removeEventListener("abort", close); };
  }, [studio, component, world, isCurrent]);
  const read = React.useCallback(() => component && isCurrent() ? getComponentPresets(studio, component) : EMPTY_PRESETS, [studio, component, isCurrent]);
  return React.useSyncExternalStore(subscribe, read, read);
}
