import { getTokenIndicatorType, type TokenIndicatorType } from "@/wab/client/components/sidebar/token-utils";
import type { StyleTokenValue } from "@/wab/commons/StyleToken";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { assert } from "@/wab/shared/common";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import type { FinalToken } from "@/wab/shared/core/tokens";
import type { ObjInst, StyleToken, Variant, VariantGroup } from "@/wab/shared/model/classes";
import * as React from "react";
import { useStore } from "zustand";

export interface StyleTokenScope {
  readonly models: StudioCtx["modelSnapshots"];
  readonly owner: StudioCtx["singleRsStyleInputs"];
  readonly lifetime: AbortSignal;
  readonly site: StudioCtx["site"];
}
// Ownership metadata only. A command handle never changes worlds; a new handle
// may bind to the next world. Values remain on each demanded read resource.
const tokenScopes = new WeakMap<StudioCtx, WeakMap<FinalToken<StyleToken>, StyleTokenScope>>();
export function getStyleTokenScope(studio: StudioCtx, token: FinalToken<StyleToken>): StyleTokenScope {
  let scopes = tokenScopes.get(studio);
  const previous = scopes?.get(token);
  if (previous) { return previous; }
  const scope = { models: studio.modelSnapshots, owner: studio.singleRsStyleInputs,
    lifetime: studio.arenaState.lifetime(), site: studio.site };
  if (!scope.owner.isDisposed && !scope.lifetime.aborted) {
    assert(scope.site.styleTokens.includes(token.base) || walkDependencyTree(scope.site, "all").some((dep) => dep.site.styleTokens.includes(token.base)),
      "Style token command belongs to another model world");
  }
  if (!scopes) { scopes = new WeakMap(); tokenScopes.set(studio, scopes); }
  scopes.set(token, scope);
  return scope;
}

export interface StyleTokenSnapshot {
  readonly name: string;
  readonly type: StyleToken["type"];
  readonly activeValue: StyleTokenValue;
  readonly isRegistered: boolean;
  readonly regKey: StyleToken["regKey"];
  readonly indicatorType: TokenIndicatorType;
  readonly styleInherited: boolean;
  readonly hasOverride: boolean;
  readonly hasOverrideValue: boolean;
  readonly canUpdate: boolean;
}

/** One demanded token's display inputs. Reference strings remain references;
 * this source never expands the site's token dictionary or resolves aliases. */
export class StyleTokenInputs {
  private readonly models;
  private readonly owner;
  private readonly lifetime;
  private readonly site;
  private current: StyleTokenSnapshot | undefined;
  private readonly initial: StyleTokenSnapshot | undefined;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; publish: () => void }>();
  private readonly listeners = new Set<(next: StyleTokenSnapshot | undefined, previous: StyleTokenSnapshot | undefined) => void>();
  private dirty = true;
  private connected = false;
  private closed = false;
  readonly store: ModelFieldStore<StyleTokenSnapshot | undefined> = {
    getState: () => this.getSnapshot(),
    getInitialState: () => this.initial,
    subscribe: (listener) => this.subscribe(listener),
  };

  constructor(studio: StudioCtx, private readonly token: FinalToken<StyleToken>, private readonly vsh: VariantedStylesHelper) {
    const scope = getStyleTokenScope(studio, token);
    this.models = scope.models;
    this.owner = scope.owner;
    this.lifetime = scope.lifetime;
    this.site = scope.site;
    this.current = this.getSnapshot();
    this.initial = this.current;
  }
  private isClosed() { return this.closed || this.owner.isDisposed || this.lifetime.aborted; }
  private invalidate = () => { this.dirty = true; };
  private publish = () => {
    if (this.isClosed()) { this.close(); return; }
    const previous = this.current;
    this.getSnapshot();
    if (previous !== this.current) { this.listeners.forEach((listener) => listener(this.current, previous)); }
  };
  private disconnect = () => {
    this.connected = false;
    for (const stops of this.fields.values()) { stops.prepare(); stops.publish(); }
    this.fields.clear();
    this.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => { this.closed = true; this.disconnect(); this.listeners.clear(); };

  getSnapshot = (): StyleTokenSnapshot | undefined => {
    if (this.isClosed() || !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...names: string[]) => {
      names.forEach((name) => used.add(this.models.declaredField(model, name)));
    };
    const groups = new Set<VariantGroup>();
    const variants = new Set<Variant>();
    const group = (item: VariantGroup) => {
      if (groups.has(item)) { return; } groups.add(item);
      field(item, "variants", "type", "multi", "param");
      field(item.param, "variable"); field(item.param.variable, "name");
      item.variants.forEach(variant);
    };
    const variant = (item: Variant) => {
      if (variants.has(item)) { return; } variants.add(item);
      field(item, "uuid", "name", "parent", "selectors", "forTpl", "mediaQuery");
      if (item.parent) { group(item.parent); }
    };
    field(this.token.base, "name", "type", "value", "variantedValues", "isRegistered", "regKey");
    // OverrideableToken finds overrides by referenced token identity/UUID.
    field(this.site, "styleTokenOverrides");
    for (const override of this.site.styleTokenOverrides) {
      field(override, "token");
      if (override.token.uuid === this.token.uuid) {
        field(override, "value", "variantedValues");
      }
    }
    const active = this.vsh.globalVariants();
    if (active?.length) {
      active.forEach(variant);
      this.token.variantedValues.forEach((value) => {
        field(value, "variants", "value"); value.variants.forEach(variant);
      });
      // The original VSH rank/fallback policy reads root and direct-dependency
      // group order plus responsive screen ordering; keep that policy unique.
      field(this.site, "globalVariantGroups", "activeScreenVariantGroup", "projectDependencies");
      this.site.globalVariantGroups.forEach(group);
      if (this.site.activeScreenVariantGroup) { group(this.site.activeScreenVariantGroup); }
      for (const dep of this.site.projectDependencies) {
        field(dep, "site"); field(dep.site, "globalVariantGroups"); dep.site.globalVariantGroups.forEach(group);
      }
    }
    const next = { name: this.token.name, type: this.token.type,
      activeValue: this.vsh.getActiveTokenValue(this.token), isRegistered: this.token.isRegistered, regKey: this.token.base.regKey,
      indicatorType: getTokenIndicatorType(this.token, this.vsh),
      styleInherited: this.vsh.isStyleInherited(this.token),
      hasOverride: !!this.token.override, hasOverrideValue: !!this.token.override?.value,
      canUpdate: this.vsh.canUpdateToken() };
    const previous = this.current;
    if (!previous || previous.name !== next.name || previous.type !== next.type || previous.activeValue !== next.activeValue || previous.isRegistered !== next.isRegistered || previous.regKey !== next.regKey || previous.indicatorType !== next.indicatorType || previous.styleInherited !== next.styleInherited || previous.hasOverride !== next.hasOverride || previous.hasOverrideValue !== next.hasOverrideValue || previous.canUpdate !== next.canUpdate) {
      this.current = Object.freeze(next);
    }
    if (this.connected) {
      for (const store of used) {
        if (!this.fields.has(store)) {
          this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), publish: store.subscribe(this.publish) });
        }
      }
      for (const [store, stops] of this.fields) {
        if (!used.has(store)) { stops.prepare(); stops.publish(); this.fields.delete(store); }
      }
    }
    this.dirty = false;
    return this.current;
  };

  private subscribe(listener: (next: StyleTokenSnapshot | undefined, previous: StyleTokenSnapshot | undefined) => void) {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.dirty = true; this.publish();
    }
    let stopped = false;
    return () => {
      if (stopped) { return; } stopped = true;
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.disconnect(); }
    };
  }
}

/** A committed reader stays bound to its retired model lifetime. */
export class StyleTokenReaderBinding<T> {
  private current: T | undefined;
  get committed() { return this.current; }
  commit(reader: T) { this.current = reader; }
}

export function useStyleTokenInputs<Selected>(studio: StudioCtx, token: FinalToken<StyleToken>, vsh: VariantedStylesHelper,
  selector: (snapshot: StyleTokenSnapshot | undefined) => Selected): Selected {
  const scope = React.useMemo(() => getStyleTokenScope(studio, token), [studio, token]);
  const binding = React.useMemo(() => new StyleTokenReaderBinding<StyleTokenInputs>(), [studio, token]);
  const source = React.useMemo(() => {
    const closed = scope.owner.isDisposed || scope.lifetime.aborted;
    return closed && binding.committed ? binding.committed : new StyleTokenInputs(studio, token, vsh);
  }, [studio, token, vsh, binding, scope]);
  React.useLayoutEffect(() => {
    if (!binding.committed || !scope.owner.isDisposed && !scope.lifetime.aborted) {
      binding.commit(source);
    }
  }, [binding, source, scope]);
  return useStore(source.store, selector);
}
