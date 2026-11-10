import type { VariantsController } from "@/wab/client/components/variants/VariantsController";
import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { subscribeViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { VariantPinState } from "@/wab/shared/PinManager";
import { isComponentArena } from "@/wab/shared/Arenas";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { Component, ComponentVariantGroup, ObjInst, Site, Variant, VariantGroup } from "@/wab/shared/model/classes";
import * as React from "react";

export interface VariantRowInputs {
  readonly ref: ModelRef<Variant>;
  readonly uuid: string;
  readonly pinState: VariantPinState | undefined;
  readonly canTarget: boolean;
  readonly canToggle: boolean;
}
export interface VariantGroupInputs {
  readonly ref: ModelRef<ComponentVariantGroup>;
  readonly uuid: string;
  readonly name: string;
  readonly variants: readonly VariantRowInputs[];
}
export interface SuperComponentVariantInputs {
  readonly name: string;
  readonly canChangeVariants: boolean;
  readonly groups: readonly VariantGroupInputs[];
}
const emptyGroups: readonly VariantGroupInputs[] = Object.freeze([]);
const empty: SuperComponentVariantInputs = Object.freeze({ name: "", canChangeVariants: false, groups: emptyGroups });

interface ComponentVariantWorld {
  readonly models: ModelSnapshots;
  readonly site: Site;
  readonly lifetime: AbortSignal;
  name: string;
}
function bindComponentWorld(studio: StudioCtx, component: Component): ComponentVariantWorld {
  return { models: studio.modelSnapshots, site: studio.site, lifetime: studio.arenaState.lifetime(), name: component.name };
}

/** Finite group labels and the original controller's pin/capability results.
 * This is a demanded read projection; commands stay on the same controller. */
export class SuperComponentVariantSource {
  private readonly models;
  private readonly lifetime;
  private readonly site;
  private current = empty;
  private dirty = true;
  private closed = false;
  private connected = false;
  private nativeInputs: readonly unknown[] = [];
  private readonly groups = new Map<ModelRef<ComponentVariantGroup>, VariantGroupInputs>();
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepared: () => void; published: () => void }>();
  private capturedFields = new Map<ModelFieldStore<unknown>, unknown>();
  private stops: (() => void)[] = [];
  private view: ViewCtx | undefined;
  private viewStops: (() => void)[] = [];
  constructor(private readonly studio: StudioCtx, private readonly component: Component, private readonly controller: VariantsController,
    private readonly world: ComponentVariantWorld = bindComponentWorld(studio, component)) {
    this.models = world.models; this.lifetime = world.lifetime; this.site = world.site;
    this.current = Object.freeze({ ...empty, name: world.name });
    this.getSnapshot();
  }
  private isClosed() { return this.closed || this.lifetime.aborted || this.studio.modelSnapshots !== this.models; }
  private invalidate = () => { this.dirty = true; };
  private sync = () => {
    const before = this.current; this.getSnapshot();
    if (before !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  private disconnect = () => {
    this.connected = false;
    this.stops.splice(0).forEach((stop) => stop());
    this.viewStops.splice(0).forEach((stop) => stop()); this.view = undefined;
    for (const stops of this.fields.values()) { stops.prepared(); stops.published(); }
    this.fields.clear();
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true;
    const before = this.current;
    this.current = Object.freeze({ name: before.name, canChangeVariants: false, groups: emptyGroups });
    this.disconnect(); this.groups.clear();
    if (before !== this.current) { this.listeners.forEach((listener) => listener()); }
    this.listeners.clear();
  };
  getSnapshot = (): SuperComponentVariantInputs => {
    if (this.isClosed()) {
      if (this.current.groups.length || this.current.canChangeVariants) {
        this.current = Object.freeze({ name: this.current.name, canChangeVariants: false, groups: emptyGroups });
      }
      return this.current;
    }
    const sources = this.controller.readSources();
    if (sources.view?.isDisposed) { this.close(); return this.current; }
    const arena = this.studio.arenaState.store.getState(), selection = this.studio.selectionStore.getState();
    const view = sources.view, viewVariants = view?.variantStore.getState();
    const inputs = [arena.current, arena.focusedMode, selection.view, selection.frames, view, sources.frame,
      viewVariants?.frames, viewVariants?.global, view?.selectionStore.getState().context,
      view?.frameState.valRootStore.getState(), view?.csEvaluator.renderStatusStore.getState()];
    if (!arrayEq(this.nativeInputs, inputs)) { this.nativeInputs = inputs; this.dirty = true; }
    if (!this.connected && [...this.capturedFields].some(([field, value]) => field.getState() !== value)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const controller = this.controller.getSnapshot(this.component.variantGroups.flatMap(group => group.variants));
    const pinStates = new Map(controller.variants.map(value => [value.variant, value]));
    const canChangeVariants = controller.canChangeVariants;
    const activeGroups = new Set<ModelRef<ComponentVariantGroup>>();
    const groups = this.component.variantGroups.map((group) => {
      const ref = this.models.ref(group), previous = this.groups.get(ref); activeGroups.add(ref);
      const previousVariants = new Map(previous?.variants.map((row) => [row.ref, row]));
      const variants = group.variants.map((variant) => {
        const variantRef = this.models.ref(variant), before = previousVariants.get(variantRef);
        const pin = ensure(pinStates.get(variant), "Inherited variant must have a controller snapshot");
        const row: VariantRowInputs = { ref: variantRef, uuid: variant.uuid, pinState: pin.pinState,
          canTarget: canChangeVariants || pin.canToggle, canToggle: canChangeVariants };
        return before && before.uuid === row.uuid && before.pinState === row.pinState && before.canTarget === row.canTarget && before.canToggle === row.canToggle ? before : Object.freeze(row);
      });
      const name = group.param.variable.name;
      const next = previous && previous.uuid === group.uuid && previous.name === name && arrayEq(previous.variants, variants)
        ? previous : Object.freeze({ ref, uuid: group.uuid, name, variants: Object.freeze(variants) });
      this.groups.set(ref, next); return next;
    });
    for (const ref of this.groups.keys()) { if (!activeGroups.has(ref)) { this.groups.delete(ref); } }
    const before = this.current;
    this.world.name = this.component.name;
    if (before.name !== this.component.name || before.canChangeVariants !== canChangeVariants || !arrayEq(before.groups, groups)) {
      this.current = Object.freeze({ name: this.component.name, canChangeVariants, groups: Object.freeze(groups) });
    }
    this.bindFields(sources); this.dirty = false; return this.current;
  };
  private bindFields(sources: ReturnType<VariantsController["readSources"]>) {
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    const variants = new Set<Variant>(), groups = new Set<VariantGroup>(), components = new Set<Component>();
    const variant = (value: Variant) => {
      if (variants.has(value)) { return; } variants.add(value);
      field(value, "name", "parent", "selectors", "forTpl", "mediaQuery", "codeComponentName", "codeComponentVariantKeys");
      if (value.parent) { group(value.parent); }
    };
    const group = (value: VariantGroup) => {
      if (groups.has(value)) { return; } groups.add(value);
      field(value, "uuid", "variants", "param", "multi", "type"); field(value.param, "variable"); field(value.param.variable, "name");
      value.variants.forEach(variant);
    };
    const component = (value: Component) => {
      if (components.has(value)) { return; } components.add(value);
      field(value, "name", "variantGroups", "variants", "superComp");
      value.variantGroups.forEach(group); value.variants.forEach(variant);
      if (value.superComp) { component(value.superComp); }
    };
    const site = (value: Site) => { field(value, "globalVariantGroups", "activeScreenVariantGroup"); value.globalVariantGroups.forEach(group); };
    site(this.site); field(this.site, "projectDependencies");
    this.site.projectDependencies.forEach((dependency) => { field(dependency, "site"); site(dependency.site); });
    component(this.component);
    const frame = sources.frame;
    if (frame) { field(frame, "targetVariants", "pinnedVariants", "targetGlobalVariants", "pinnedGlobalVariants", "container"); field(frame.container, "component"); component(frame.container.component); }
    const arena = this.studio.currentArena;
    if (isComponentArena(arena)) {
      field(arena, "matrix", "customMatrix");
      [arena.matrix, arena.customMatrix].forEach((grid) => {
        field(grid, "rows"); grid.rows.forEach((row) => { field(row, "cols"); row.cols.forEach((cell) => { field(cell, "frame", "cellKey"); }); });
      });
    }
    if (this.connected && sources.view !== this.view) {
      this.viewStops.splice(0).forEach((stop) => stop()); this.view = sources.view;
      if (this.view) {
        const view = this.view;
        this.viewStops.push(view.variantStore.subscribe(this.sync), view.selectionStore.subscribe(this.sync), view.frameState.valRootStore.subscribe(this.sync), view.csEvaluator.renderStatusStore.subscribe(this.sync));
        view.disposeSignal.addEventListener("abort", this.close, { once: true });
        this.viewStops.push(() => view.disposeSignal.removeEventListener("abort", this.close));
      }
    }
    this.capturedFields = new Map([...used].map((store) => [store, store.getState()]));
    if (!this.connected) { return; }
    for (const store of used) {
      if (!this.fields.has(store)) { this.fields.set(store, { prepared: this.models.subscribePreparedField(store, this.invalidate), published: store.subscribe(this.sync) }); }
    }
    for (const [store, stops] of this.fields) { if (!used.has(store)) { stops.prepared(); stops.published(); this.fields.delete(store); } }
  }
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.dirty = true;
      this.stops.push(
        this.studio.selectionStore.subscribe(this.sync),
        this.studio.arenaState.store.subscribe(this.sync),
        // A replacement ViewCtx carries different native variant/selection
        // resources even when arena and studio-selection snapshots are equal.
        // Rebind those actual sources instead of caching the old view owner.
        subscribeViewRegistry(this.studio, (entries) => entries, this.sync),
      );
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.stops.push(() => this.lifetime.removeEventListener("abort", this.close));
      this.sync();
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
  resolve(ref: ModelRef<Variant>) { assert(!this.isClosed(), "Cannot resolve variants from a closed group owner"); return this.models.resolve(ref); }
}

export function useSuperComponentVariantInputs(studio: StudioCtx, component: Component, controller: VariantsController) {
  // A controller can be recreated during any parent render. The model world
  // belongs to the component prop identity, independent of that command object.
  const world = React.useMemo(() => bindComponentWorld(studio, component), [studio, component]);
  const source = React.useMemo(() => new SuperComponentVariantSource(studio, component, controller, world), [studio, component, controller, world]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, resolve: (ref: ModelRef<Variant>) => source.resolve(ref) };
}

interface StandaloneVariantSnapshot {
  readonly active: boolean;
  readonly fields: readonly unknown[];
}
const noStandaloneVariant: StandaloneVariantSnapshot = Object.freeze({ active: false, fields: Object.freeze([]) });

/** Standalone row metadata. Its menu callbacks retain the original group and
 * command targets; only the fields read while rendering are demanded here. */
export class StandaloneVariantInputs {
  private current = noStandaloneVariant;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly studio: StudioCtx, private readonly component: Component,
    private readonly group: ComponentVariantGroup,
    private readonly world = bindComponentWorld(studio, component)) {
    this.getSnapshot();
  }
  private isClosed() { return this.world.lifetime.aborted || this.world.models !== this.studio.modelSnapshots; }
  private disconnect = () => {
    this.connected = false;
    this.world.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => {
    this.current = noStandaloneVariant; this.disconnect();
    this.listeners.forEach((listener) => listener());
  };
  private sync = () => {
    const previous = this.current; this.getSnapshot();
    if (previous !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): StandaloneVariantSnapshot => {
    if (this.isClosed()) { this.current = noStandaloneVariant; this.disconnect(); return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.world.models.declaredField(model, key)));
    field(this.component, "plumeInfo");
    if (this.component.plumeInfo) { field(this.component.plumeInfo, "type"); }
    field(this.group, "variants", "param"); field(this.group.param, "defaultExpr");
    const variant = this.group.variants[0];
    if (variant) {
      field(variant, "name", "parent");
      if (variant.parent) {
        field(variant.parent, "param"); field(variant.parent.param, "variable");
        field(variant.parent.param.variable, "name");
      }
    }
    const values = [...used].map((store) => store.getState());
    if (this.current.active !== !!variant || !arrayEq(this.current.fields, values)) {
      this.current = Object.freeze({ active: !!variant, fields: Object.freeze(values) });
    }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.world.lifetime.addEventListener("abort", this.close, { once: true }); this.sync();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useStandaloneVariantInputs(studio: StudioCtx, component: Component, group: ComponentVariantGroup) {
  const world = React.useMemo(() => bindComponentWorld(studio, component), [studio, component]);
  const source = React.useMemo(() => new StandaloneVariantInputs(studio, component, group, world), [studio, component, group, world]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot).active;
}
