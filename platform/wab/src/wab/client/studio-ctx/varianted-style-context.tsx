import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { readGlobalStyleContext } from "@/wab/client/utils/style-utils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq } from "@/wab/shared/common";
import { ObjInst, Site, Variant, VariantGroup } from "@/wab/shared/model/classes";
import * as React from "react";

interface GlobalStyleContextSnapshot {
  readonly active: readonly ModelRef<Variant>[] | undefined;
  readonly target: readonly ModelRef<Variant>[] | undefined;
}
const emptyContext: GlobalStyleContextSnapshot = Object.freeze({ active: undefined, target: undefined });
function sameRefs(left: readonly ModelRef<Variant>[] | undefined, right: readonly ModelRef<Variant>[] | undefined) {
  return left === right || (!!left && !!right && arrayEq(left, right));
}

/** Per committed reader, only the original controller's finite global inputs.
 * No persisted values, token definitions, or component runtime graph are copied. */
export class VariantedStyleContext {
  private readonly models;
  private readonly owner;
  private readonly lifetime;
  private readonly site: Site;
  private snapshot = emptyContext;
  private dirty = true;
  private nativeInputs: readonly unknown[] = [];
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepared: () => void; published: () => void }>();
  private readonly listeners = new Set<() => void>();
  private stops: (() => void)[] = [];
  private view: ViewCtx | undefined;
  private stopView: (() => void) | undefined;
  private connected = false;
  private closed = false;

  constructor(private readonly studio: StudioCtx) {
    this.models = studio.modelSnapshots;
    this.owner = studio.singleRsStyleInputs;
    this.lifetime = studio.arenaState.lifetime();
    this.site = studio.site;
    this.getSnapshot();
  }
  private isClosed() { return this.closed || this.owner.isDisposed || this.lifetime.aborted; }
  private invalidate = () => { this.dirty = true; };
  private sync = () => {
    if (this.isClosed()) { this.disconnect(); return; }
    const before = this.snapshot;
    this.dirty = true;
    this.getSnapshot();
    if (before !== this.snapshot) { this.listeners.forEach((listener) => listener()); }
  };
  private disconnect = () => {
    this.connected = false;
    this.stops.splice(0).forEach((stop) => stop());
    this.stopView?.(); this.stopView = undefined; this.view = undefined;
    for (const stops of this.fields.values()) { stops.prepared(); stops.published(); }
    this.fields.clear();
  };
  private close = () => { this.closed = true; this.disconnect(); this.listeners.clear(); };

  getSnapshot = (): GlobalStyleContextSnapshot => {
    if (this.isClosed()) { return this.snapshot; }
    const arena = this.studio.arenaState.store.getState();
    const selection = this.studio.selectionStore.getState();
    const focused = this.studio.focusedOrFirstViewCtx();
    const inputs = [arena.current, arena.focusedMode, selection.view, selection.frames, focused,
      focused?.variantStore.getState().frames, focused?.variantStore.getState().global];
    if (!arrayEq(this.nativeInputs, inputs)) { this.dirty = true; this.nativeInputs = inputs; }
    if (!this.dirty) { return this.snapshot; }
    const context = readGlobalStyleContext(this.studio);
    const active = context.active?.map((variant) => this.models.ref(variant));
    const target = context.target?.map((variant) => this.models.ref(variant));
    const before = this.snapshot;
    if (!sameRefs(before.active, active) || !sameRefs(before.target, target)) {
      this.snapshot = Object.freeze({
        active: sameRefs(before.active, active) ? before.active : active && Object.freeze(active),
        target: sameRefs(before.target, target) ? before.target : target && Object.freeze(target),
      });
    }
    this.bindFields(context);
    this.dirty = false;
    return this.snapshot;
  };

  private bindFields(context: ReturnType<typeof readGlobalStyleContext>) {
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...names: string[]) => {
      names.forEach((name) => used.add(this.models.declaredField(model, name)));
    };
    const variants = new Set<Variant>();
    const groups = new Set<VariantGroup>();
    const group = (item: VariantGroup) => {
      if (groups.has(item)) { return; } groups.add(item);
      field(item, "type", "multi", "variants", "param");
      field(item.param, "variable"); field(item.param.variable, "name");
      item.variants.forEach(variant);
    };
    const variant = (item: Variant) => {
      if (variants.has(item)) { return; } variants.add(item);
      field(item, "name", "parent");
      if (item.parent) { group(item.parent); }
    };
    const site = (item: Site) => {
      field(item, "globalVariantGroups", "activeScreenVariantGroup");
      item.globalVariantGroups.forEach(group);
    };
    site(this.site); field(this.site, "projectDependencies");
    this.site.projectDependencies.forEach((dep) => { field(dep, "site"); site(dep.site); });
    context.active?.forEach(variant); context.target?.forEach(variant);
    const frame = context.sources?.frame;
    if (frame) { field(frame, "targetVariants", "targetGlobalVariants", "pinnedVariants", "pinnedGlobalVariants", "container"); field(frame.container, "component"); }
    const view = context.sources?.view;
    if (this.connected && view !== this.view) {
      this.stopView?.(); this.view = view;
      this.stopView = view?.variantStore.subscribe(this.sync);
    }
    if (!this.connected) { return; }
    for (const store of used) {
      if (!this.fields.has(store)) {
        this.fields.set(store, {
          prepared: this.models.subscribePreparedField(store, this.invalidate),
          published: store.subscribe(this.sync),
        });
      }
    }
    for (const [store, stops] of this.fields) {
      if (!used.has(store)) { stops.prepared(); stops.published(); this.fields.delete(store); }
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.stops.push(this.studio.selectionStore.subscribe(this.sync), this.studio.arenaState.store.subscribe(this.sync));
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.stops.push(() => this.lifetime.removeEventListener("abort", this.close));
      this.sync();
    }
    let stopped = false;
    return () => {
      if (stopped) { return; } stopped = true;
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.disconnect(); }
    };
  };

  materialize(snapshot: GlobalStyleContextSnapshot) {
    if (this.isClosed()) { return undefined; }
    return new VariantedStylesHelper(this.site,
      snapshot.active?.map((variant) => this.models.resolve(variant)),
      snapshot.target?.map((variant) => this.models.resolve(variant)));
  }
}

/** Native context only. Token definitions and token rendering remain explicit
 * model dependencies at the child that reads them. */
export function useVariantedStylesHelperFromCurrentCtx(studio: StudioCtx | undefined): VariantedStylesHelper {
  const subscribeOwner = React.useCallback((listener: () => void) => {
    if (!studio) { return () => undefined; }
    const stopModel = studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = studio.arenaState.store.subscribe(listener);
    return () => { stopModel(); stopArena(); };
  }, [studio]);
  const readOwner = React.useCallback(() => studio ? studio.singleRsStyleInputs : undefined, [studio]);
  const owner = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const source = React.useMemo(() => studio ? new VariantedStyleContext(studio) : undefined, [studio, owner]);
  const subscribe = React.useCallback((listener: () => void) => source ? source.subscribe(listener) : () => undefined, [source]);
  const read = React.useCallback(() => source ? source.getSnapshot() : emptyContext, [source]);
  const snapshot = React.useSyncExternalStore(subscribe, read, read);
  const helper = React.useMemo(() => source?.materialize(snapshot), [source, snapshot]);
  const [previous, setPrevious] = React.useState(() => helper ?? new VariantedStylesHelper());
  if (helper && helper !== previous) { setPrevious(helper); }
  return helper ?? previous;
}
