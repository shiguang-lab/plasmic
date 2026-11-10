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
import { ModelFieldInputs, type DeclareModelFields } from "@/wab/client/stores/model-field-inputs";
import type { Component } from "@/wab/shared/model/classes";
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
  private readonly inputs;
  private owner: ViewCtx | undefined;
  private native: readonly unknown[] = [];
  private modelFields: readonly unknown[] | undefined;
  private published: VariantControllerSnapshot | undefined;
  constructor(private readonly world: ReturnType<typeof useCurrentModelWorld>, private readonly explicit: ViewCtx | undefined) {
    this.inputs = new ModelFieldInputs({ models: world.models, lifetime: world.lifetime, isCurrent: this.active }, this.collect);
  }
  private collect = (field: DeclareModelFields) => {
    const { site, studio } = this.world;
    const seen = new Set<Component>();
    const component = (value: Component) => {
      if (seen.has(value)) { return; } seen.add(value);
      field(value, "variants", "variantGroups", "superComp", "type");
      value.variants.forEach(variant => field(variant, "name", "selectors", "forTpl", "parent", "codeComponentName", "codeComponentVariantKeys"));
      value.variantGroups.forEach(group => {
        field(group, "variants", "type", "multi", "param");
        field(group.param, "variable"); field(group.param.variable, "name");
        group.variants.forEach(variant => field(variant, "name", "selectors", "forTpl", "parent", "mediaQuery"));
      });
      if (value.superComp) { component(value.superComp); }
    };
    const current = this.owner?.currentComponent() ?? (isDedicatedArena(studio.currentArena) ? studio.currentArena.component : undefined);
    if (current) { component(current); }
    field(site, "globalVariantGroups", "projectDependencies");
    const sites = [site, ...site.projectDependencies.map(dep => { field(dep, "site"); return dep.site; })];
    sites.forEach(owner => {
      field(owner, "globalVariantGroups");
      owner.globalVariantGroups.forEach(group => {
        field(group, "type", "variants"); group.variants.forEach(variant => field(variant, "name", "parent", "mediaQuery"));
      });
    });
    const arena = studio.currentArena;
    if (isDedicatedArena(arena)) {
      field(arena, "component", "_focusedFrame", "matrix", "customMatrix");
      for (const grid of [arena.matrix, arena.customMatrix]) {
        field(grid, "rows"); grid.rows.forEach(row => {
          field(row, "cols"); row.cols.forEach(cell => field(cell, "frame", "cellKey"));
        });
      }
    }
    const sources = this.controller?.readSources();
    if (sources?.view) { component(sources.view.currentComponent()); }
    const frame = sources?.frame;
    if (frame) {
      field(frame, "container", "pinnedVariants", "pinnedGlobalVariants", "targetVariants", "targetGlobalVariants");
      field(frame.container, "component"); component(frame.container.component);
    }
  };
  private active = () => !this.closed && this.world.isCurrent(this.explicit);
  private disconnect = () => {
    this.connected = false;
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.stopModels?.(); this.stopModels = undefined;
    this.world.lifetime.removeEventListener("abort", this.close);
    this.explicit?.disposeSignal.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true; this.current = undefined; this.disconnect();
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  private sync = () => {
    this.read();
    if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); }
  };
  read = (): VariantControllerSnapshot | undefined => {
    if (!this.active()) { return undefined; }
    const { studio, site } = this.world;
    const arena = studio.arenaState.store.getState();
    const selected = studio.selectionStore.getState().view;
    const fallback = arena.focusedMode ? studio.focusedOrFirstViewCtx() : selected;
    const owner = this.explicit ?? fallback;
    const ownerVariants = owner?.variantStore.getState();
    const key = [arena.current, arena.focusedMode, owner, ownerVariants?.frames.length];
    if (!arrayEq(key, this.controllerKey)) { this.controllerKey = key; this.controller = makeVariantsController(studio, this.explicit); this.inputs.invalidate(); }
    this.owner = owner;
    const commands = this.controller;
    const sources = commands?.readSources();
    const views = [...new Set([owner, sources?.view].filter((value): value is ViewCtx => !!value))];
    const native = [owner, sources?.view, sources?.frame, ...views.flatMap(view => {
      const state = view.variantStore.getState();
      return [state.frames, state.global, view.csEvaluator?.renderStatusStore.getState().renderCount];
    })];
    const changed = !arrayEq(this.native, native);
    if (changed) { this.native = native; this.inputs.invalidate(); }
    const fields = this.inputs.read();
    if (this.connected) {
      const used = new Set<ModelFieldStore<unknown>>([studio.arenaState.store, studio.selectionStore, studio.arenaState.viewRegistry.store,
        ...views.flatMap(view => [view.variantStore, ...(view.csEvaluator?.renderStatusStore ? [view.csEvaluator.renderStatusStore] : [])])]);
      for (const field of used) { if (!this.fields.has(field)) { this.fields.set(field, field.subscribe(this.sync)); } }
      for (const [field, stop] of this.fields) { if (!used.has(field)) { stop(); this.fields.delete(field); } }
    }
    if (!commands) { this.current = undefined; return undefined; }
    if (!changed && fields === this.modelFields && this.current?.commands === commands) { return this.current; }
    this.modelFields = fields;
    const component = owner?.currentComponent() ?? (isDedicatedArena(studio.currentArena) ? studio.currentArena.component : undefined);
    const all = [...new Set([...(component ? allComponentVariants(component, { includeSuperVariants: true }) : []), ...allGlobalVariants(site, { includeDeps: "direct" })])];
    const snapshot = commands.getSnapshot(all);
    const active = snapshot.activeVariants, targeted = snapshot.targetedVariants;
    const activeVariants = this.current && arrayEq(this.current.activeVariants, active) ? this.current.activeVariants : Object.freeze(active.slice());
    const targetedVariants = this.current && arrayEq(this.current.targetedVariants, targeted) ? this.current.targetedVariants : Object.freeze(targeted.slice());
    const variants: Record<number, VariantControllerValue> = {};
    let same = !!this.current && all.length === Object.keys(this.current.variants).length;
    for (const { variant, ...next } of snapshot.variants) {
      const before = this.current?.variants[variant.uid];
      const equal = before && before.pinState === next.pinState && before.active === next.active && before.targeted === next.targeted && before.canToggle === next.canToggle;
      variants[variant.uid] = equal ? before : Object.freeze(next); same &&= !!equal;
    }
    const canChangeVariants = snapshot.canChangeVariants;
    const ownerFrameUid = owner?.arenaFrame().uid;
    if (!this.current || this.current.commands !== commands || this.current.ownerFrameUid !== ownerFrameUid || this.current.activeVariants !== activeVariants || this.current.targetedVariants !== targetedVariants || this.current.canChangeVariants !== canChangeVariants || !same) {
      this.current = Object.freeze({ commands, ownerFrameUid, activeVariants, targetedVariants, canChangeVariants, variants: Object.freeze(variants) });
    }

    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.active()) { return () => undefined; }
    if (!this.listeners.size) { this.published = this.read(); }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.world.lifetime.addEventListener("abort", this.close, { once: true });
      this.explicit?.disposeSignal.addEventListener("abort", this.close, { once: true });
      const studio = this.world.studio;
      for (const field of [studio.arenaState.store, studio.selectionStore, studio.arenaState.viewRegistry.store]) {
        this.fields.set(field, field.subscribe(this.sync));
      }
      this.stopModels = this.inputs.subscribe(this.sync);
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
