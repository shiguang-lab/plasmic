import { makeVariantsController, type VariantsController } from "@/wab/client/components/variants/VariantsController";
import { useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { allComponentVariants } from "@/wab/shared/core/components";
import { allGlobalVariants } from "@/wab/shared/core/sites";
import { isDedicatedArena } from "@/wab/shared/Arenas";
import { arrayEq } from "@/wab/shared/common";
import type { Variant } from "@/wab/shared/model/classes";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import * as React from "react";

interface VariantControllerValue {
  readonly pinState: ReturnType<VariantsController["getPinState"]>;
  readonly active: ReturnType<VariantsController["isActive"]>;
  readonly targeted: boolean;
  readonly canToggle: boolean;
}
export interface VariantControllerSnapshot {
  /** Only event commands use this handle. Rendering reads the projections below. */
  readonly commands: VariantsController;
  readonly ownerFrameUid: number | undefined;
  readonly activeVariants: readonly Variant[];
  readonly targetedVariants: readonly Variant[];
  readonly canChangeVariants: boolean;
  readonly variants: Readonly<Record<number, VariantControllerValue>>;
}

/** A controller's displayed state is computed at its native owner boundary,
 * before React receives it. Owner changes replace subscriptions atomically. */
class VariantControllerInputs {
  private current: VariantControllerSnapshot | undefined;
  private controller: VariantsController | undefined;
  private controllerKey: readonly unknown[] = [];
  private connected = false;
  private closed = false;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private stopModels: (() => void) | undefined;
  constructor(private readonly world: ReturnType<typeof useCurrentModelWorld>, private readonly explicit: ViewCtx | undefined) {}
  private active = () => !this.closed && this.world.isCurrent(this.explicit);
  private disconnect = () => {
    this.connected = false;
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.stopModels?.(); this.stopModels = undefined;
    this.world.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true; this.current = undefined; this.disconnect();
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  private sync = () => {
    const before = this.current;
    this.read();
    if (this.current !== before) { this.listeners.forEach((listener) => listener()); }
  };
  read = (): VariantControllerSnapshot | undefined => {
    if (!this.active()) { return undefined; }
    const { studio, site } = this.world;
    const arena = studio.arenaState.store.getState();
    const selected = studio.selectionStore.getState().view;
    const fallback = arena.focusedMode ? studio.focusedOrFirstViewCtx() : selected;
    const owner = this.explicit ?? fallback;
    const native = owner?.variantStore.getState();
    const key = [arena.current, arena.focusedMode, owner, native?.frames.length];
    if (!arrayEq(key, this.controllerKey)) { this.controllerKey = key; this.controller = makeVariantsController(studio, this.explicit); }
    if (this.connected) {
      const used = new Set<ModelFieldStore<unknown>>([studio.arenaState.store, studio.selectionStore, studio.inspectorStore, studio.arenaState.viewRegistry.store, ...(owner ? [owner.variantStore] : [])]);
      for (const field of used) { if (!this.fields.has(field)) { this.fields.set(field, field.subscribe(this.sync)); } }
      for (const [field, stop] of this.fields) { if (!used.has(field)) { stop(); this.fields.delete(field); } }
    }
    const commands = this.controller;
    if (!commands) { this.current = undefined; return undefined; }
    const active = commands.getActiveNonBaseVariants(), targeted = commands.getTargetedVariants();
    const activeVariants = this.current && arrayEq(this.current.activeVariants, active) ? this.current.activeVariants : Object.freeze(active.slice());
    const targetedVariants = this.current && arrayEq(this.current.targetedVariants, targeted) ? this.current.targetedVariants : Object.freeze(targeted.slice());
    const component = owner?.currentComponent() ?? (isDedicatedArena(studio.currentArena) ? studio.currentArena.component : undefined);
    const all = [...new Set([...(component ? allComponentVariants(component, { includeSuperVariants: true }) : []), ...allGlobalVariants(site, { includeDeps: "direct" })])];
    const variants: Record<number, VariantControllerValue> = {};
    let same = !!this.current && all.length === Object.keys(this.current.variants).length;
    for (const variant of all) {
      const before = this.current?.variants[variant.uid];
      const next = { pinState: commands.getPinState(variant), active: commands.isActive(variant), targeted: commands.isTargeted(variant), canToggle: commands.canToggleTargeting(variant) };
      const equal = before && before.pinState === next.pinState && before.active === next.active && before.targeted === next.targeted && before.canToggle === next.canToggle;
      variants[variant.uid] = equal ? before : Object.freeze(next); same &&= !!equal;
    }
    const canChangeVariants = commands.canChangeActiveVariants();
    const ownerFrameUid = owner?.arenaFrame().uid;
    if (!this.current || this.current.commands !== commands || this.current.ownerFrameUid !== ownerFrameUid || this.current.activeVariants !== activeVariants || this.current.targetedVariants !== targetedVariants || this.current.canChangeVariants !== canChangeVariants || !same) {
      this.current = Object.freeze({ commands, ownerFrameUid, activeVariants, targetedVariants, canChangeVariants, variants: Object.freeze(variants) });
    }

    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.active()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.world.lifetime.addEventListener("abort", this.close, { once: true });
      const studio = this.world.studio;
      for (const field of [studio.arenaState.store, studio.selectionStore, studio.inspectorStore, studio.arenaState.viewRegistry.store]) {
        this.fields.set(field, field.subscribe(this.sync));
      }
      this.stopModels = studio.subscribeModelChanges(this.sync);
      this.read();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useVariantsController(studio: StudioCtx, view?: ViewCtx) {
  const world = useCurrentModelWorld(studio);
  const source = React.useMemo(() => new VariantControllerInputs(world, view), [world, view]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}
