import type { ExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { createImageAssetDictionaryInputs } from "@/wab/client/studio-ctx/image-asset-inputs";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { StyleTokenRefInputs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { extractAllReferencedTokenIds, replaceAllTokenRefs, tryParseMixinPropRef } from "@/wab/commons/StyleToken";
import { getRuleSetRawValue, getRuleSetValueOrInitial } from "@/wab/shared/RuleSetHelpers";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq, ensure } from "@/wab/shared/common";
import { extractAllAssetRefs, resolveAllAssetRefs } from "@/wab/shared/core/image-assets";
import { walkDependencyInputs } from "@/wab/shared/core/project-deps";
import { collectDependencyResources } from "@/wab/shared/core/sites";
import { resolveCssTokenInput, resolveCssVarInput, resolveMixinInput } from "@/wab/shared/core/styles";
import type { Mixin, ObjInst, ProjectDependency, Site } from "@/wab/shared/model/classes";
import * as React from "react";

export interface GridCssRead {
  readonly display: string | undefined;
  readonly hasTemplate: boolean;
  readonly template: string | undefined;
}
export interface CssVariableRead { readonly value: string | undefined; }
export interface GridCssSnapshot { readonly active: boolean; readonly value: string | undefined; }
const empty: GridCssSnapshot = Object.freeze({ active: false, value: undefined });
type AssetInput = ReturnType<typeof createImageAssetDictionaryInputs>;
interface AssetPhase { readonly ids: readonly string[]; readonly source: AssetInput; stop?: () => void; }
interface TokenPhase { readonly inputs: readonly string[]; readonly source: StyleTokenRefInputs; stop?: () => void; }

/** Exact Grid/CssVarResolver recipe. Only a chosen mixin's base rs.values are
 * read here; tokens and requested asset values lease their existing resources.
 * The original callback pipeline decides the number/order of replacement passes. */
export class GridCssInputs {
  private readonly studio;
  private readonly models;
  private readonly site;
  private readonly owner;
  private readonly baseVsh = new VariantedStylesHelper();
  private current = empty;
  private connected = false;
  private connecting = false;
  private closed = false;
  private mixinDirty = true;
  private mixinRaw: string | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { captured: unknown; prepare?: () => void; publish?: () => void }>();
  private readonly assets = new Map<number, AssetPhase>();
  private readonly tokens = new Map<number, TokenPhase>();

  constructor(provider: ExpsProvider, private readonly input: GridCssRead | CssVariableRead, private readonly lifetime: AbortSignal) {
    this.studio = provider.studioCtx;
    const native = provider.getNativeStyleSource(); this.owner = native.inputs;
    this.models = this.studio.modelSnapshots; this.site = native.kind === "tpl" ? native.source.site : this.studio.site;
  }
  private isClosed() { return this.closed || this.owner.isDisposed || this.lifetime.aborted || this.studio.modelSnapshots !== this.models; }
  private invalidate = () => { this.mixinDirty = true; };
  private notify = () => { if (!this.connecting && !this.isClosed()) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.close);
    for (const binding of this.fields.values()) { binding.prepare?.(); binding.publish?.(); binding.prepare = undefined; binding.publish = undefined; }
    for (const node of this.assets.values()) { node.stop?.(); node.stop = undefined; }
    for (const node of this.tokens.values()) { node.stop?.(); node.stop = undefined; }
  };
  private close = () => {
    if (this.closed) { return; } this.closed = true; this.disconnect();
    this.current = Object.freeze({ active: false, value: this.current.value });
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  private readMixin(ref: string) {
    if (!this.connected && [...this.fields].some(([store, binding]) => store.getState() !== binding.captured)) { this.mixinDirty = true; }
    if (!this.mixinDirty) { return ensure(this.mixinRaw, "Mixin raw read must already exist"); }
    const used = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, K extends Exclude<keyof T, "uid"> & string>(model: T, key: K) => {
      const store = this.models.field(model, key); used.add(store);
      let binding = this.fields.get(store);
      if (!binding) { binding = { captured: store.getState() }; this.fields.set(store, binding); }
      binding.captured = store.getState(); return store.getState();
    };
    let complete = false;
    try {
      const local: Mixin[] = read(this.site, "mixins").map((item) => this.models.resolve(item));
      const dependencySite = (dep: ProjectDependency): Site => this.models.resolve(read(dep, "site"));
      const dependencies = walkDependencyInputs<ProjectDependency>(read(this.site, "projectDependencies").map((item) => this.models.resolve(item)), "all",
        (dep) => read(dependencySite(dep), "projectDependencies").map((item) => this.models.resolve(item)), (dep) => read(dep, "projectId"));
      const mixins = collectDependencyResources<Mixin, ProjectDependency>(local, dependencies, (dep) => read(dependencySite(dep), "mixins").map((item) => this.models.resolve(item)));
      // Parser lookup reads only immutable UUIDs; payload uses installed fields.
      mixins.forEach((mixin) => { read(mixin, "uuid"); });
      this.mixinRaw = resolveMixinInput<Mixin>(ref, (value) => tryParseMixinPropRef(value, mixins, "last"), (mixin, prop) => {
        const rs = this.models.resolve(read(mixin, "rs"));
        return getRuleSetValueOrInitial(getRuleSetRawValue(read(rs, "values"), prop), prop, "div");
      });
      complete = true; return this.mixinRaw;
    } finally {
      if (this.connected) {
        for (const store of used) {
          const binding = ensure(this.fields.get(store), "Declared mixin input must exist");
          if (!binding.prepare) { binding.prepare = this.models.subscribePreparedField(store, this.invalidate); binding.publish = store.subscribe(this.notify); }
        }
      }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare?.(); binding.publish?.(); this.fields.delete(store); } }
      this.mixinDirty = !complete;
    }
  }
  getSnapshot = (): GridCssSnapshot => {
    if (this.isClosed()) {
      if (this.current.active) { this.current = Object.freeze({ active: false, value: this.current.value }); }
      return this.current;
    }
    // Evaluate the original display check before any variable lookup.
    if ("display" in this.input) { ensure(this.input.display === "grid", "Grid element is expected to have display:grid"); }
    let phase = 0;
    const usedAssets = new Set<number>(), usedTokens = new Set<number>();
    const resolveTokens = (value: string) => {
      const index = phase++;
      return resolveCssTokenInput(value, {}, (assetValue) => {
        const ids = [...new Set(extractAllAssetRefs(assetValue))];
        if (!ids.length) { return assetValue; }
        usedAssets.add(index);
        let node = this.assets.get(index);
        if (!node || !arrayEq(node.ids, ids)) {
          node?.stop?.(); node = { ids, source: createImageAssetDictionaryInputs(this.studio, ids) }; this.assets.set(index, node);
        }
        const rows = node.source.getSnapshot();
        if (this.connected && !node.stop) { node.stop = () => undefined; node.stop = node.source.subscribe(this.notify); }
        return resolveAllAssetRefs(assetValue, rows);
      }, (tokenValue) => {
        const inputs = [...new Set(extractAllReferencedTokenIds(tokenValue).map((id) => `var(--token-${id})`))];
        if (!inputs.length) { return tokenValue; }
        usedTokens.add(index);
        let node = this.tokens.get(index);
        if (!node || !arrayEq(node.inputs, inputs)) {
          node?.stop?.(); node = { inputs, source: new StyleTokenRefInputs(this.studio, inputs, this.baseVsh, "dictionary") }; this.tokens.set(index, node);
        }
        const snapshot = node.source.getSnapshot();
        if (this.connected && !node.stop) { node.stop = () => undefined; node.stop = node.source.subscribe(this.notify); }
        return replaceAllTokenRefs(tokenValue, (id) => snapshot.rows.find((row) => row.input === `var(--token-${id})`)?.resolved?.value);
      });
    };
    try {
      const raw = "display" in this.input ? this.input.hasTemplate ? ensure(this.input.template, "Grid template CSS must exist") : undefined : this.input.value;
      const value = raw === undefined ? undefined : resolveCssVarInput(raw, (ref) => resolveTokens(this.readMixin(ref)), resolveTokens);
      if (!this.current.active || value !== this.current.value) { this.current = Object.freeze({ active: true, value }); }
      return this.current;
    } finally {
      for (const [index, node] of this.assets) { if (!usedAssets.has(index)) { node.stop?.(); this.assets.delete(index); } }
      for (const [index, node] of this.tokens) { if (!usedTokens.has(index)) { node.stop?.(); this.tokens.delete(index); } }
    }
  };
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      const before = this.current; this.connected = true; this.connecting = true; this.mixinDirty = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      try { this.getSnapshot(); }
      catch (error) { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } throw error; }
      finally { this.connecting = false; }
      if (before !== this.current) { this.notify(); }
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useGridCssInputs(provider: ExpsProvider, input: GridCssRead, lifetime: AbortSignal) {
  const { display, hasTemplate, template } = input;
  const source = React.useMemo(() => new GridCssInputs(provider, { display, hasTemplate, template }, lifetime), [provider, display, hasTemplate, template, lifetime]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}


/** The same CssVarResolver variable pipeline for an actual non-grid CSS value. */
export function useCssVariableInputs(provider: ExpsProvider, value: string | undefined, lifetime: AbortSignal) {
  const source = React.useMemo(() => new GridCssInputs(provider, { value }, lifetime), [provider, value, lifetime]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
