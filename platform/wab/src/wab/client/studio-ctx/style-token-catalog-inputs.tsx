import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getStyleTokenReaderScope } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { getStyleTokenScope } from "@/wab/client/studio-ctx/style-token-inputs";
import type { StyleTokenType } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq } from "@/wab/shared/common";
import type { FinalToken } from "@/wab/shared/core/tokens";
import { siteFinalStyleTokensOfType } from "@/wab/shared/core/site-style-tokens";
import type { ObjInst, StyleToken } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
const emptyTokens: readonly FinalToken<StyleToken>[] = Object.freeze([]);
let nextKey = 0;
const ownerKeys = new WeakMap<object, number>();
/** Direct picker membership and labels only. Values and aliases keep their existing demanded sources. */
export class StyleTokenCatalogInputs {
  readonly key: number;
  private readonly scope;
  private current = empty;
  private tokenFields: readonly unknown[] | undefined;
  private tokens = emptyTokens;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  constructor(private readonly studio: StudioCtx, private readonly type: StyleTokenType | undefined, helper: VariantedStylesHelper, private readonly supplied?: readonly FinalToken<StyleToken>[]) {
    this.scope = supplied?.[0] ? getStyleTokenScope(studio, supplied[0]) : getStyleTokenReaderScope(studio, helper);
    let key = ownerKeys.get(this.scope.models);
    if (key === undefined) { key = ++nextKey; ownerKeys.set(this.scope.models, key); }
    this.key = key;
  }
  isActive = () => this.scope.models === this.studio.modelSnapshots && !this.scope.owner.isDisposed && !this.scope.lifetime.aborted;
  private disconnect = () => {
    this.connected = false; this.scope.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear();
  };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => { if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); } };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>(), { models, site } = this.scope;
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(models.declaredField(model, key)));
    if (this.supplied) {
      this.supplied.forEach((token) => field(token.base, "uuid", "name", "type", "isRegistered"));
    } else if (this.type) {
      field(site, "styleTokens", "projectDependencies");
      const sites = [site, ...site.projectDependencies.map((dependency) => { field(dependency, "site"); field(dependency.site, "styleTokens"); return dependency.site; })];
      sites.forEach((owner) => owner.styleTokens.forEach((token) => {
        field(token, "type");
        if (token.type === this.type) { field(token, "uuid", "name", "isRegistered"); }
      }));
    }
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepare: models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); } }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
    }
    this.dirty = false; return this.current;
  };
  getTokens = (): readonly FinalToken<StyleToken>[] => {
    const fields = this.getSnapshot();
    if (fields !== this.tokenFields) {
      this.tokenFields = fields;
      this.tokens = !this.isActive() ? emptyTokens : Object.freeze([...(this.supplied ?? (this.type ? siteFinalStyleTokensOfType(this.scope.site, this.type, { includeDeps: "direct" }) : []))]);
    }
    return this.tokens;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.dirty = true; this.scope.lifetime.addEventListener("abort", this.close, { once: true }); this.publish(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useStyleTokenCatalogInputs(studio: StudioCtx | undefined, type: StyleTokenType | undefined, helper?: VariantedStylesHelper, supplied?: readonly FinalToken<StyleToken>[]) {
  const subscribeOwner = React.useCallback((listener: () => void) => studio ? studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } }) : () => undefined, [studio]);
  const readOwner = React.useCallback(() => studio?.modelSnapshots, [studio]);
  const models = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const baseHelper = React.useMemo(() => new VariantedStylesHelper(), []);
  const source = React.useMemo(() => studio ? new StyleTokenCatalogInputs(studio, type, helper ?? baseHelper, supplied) : undefined, [studio, models, type, helper, baseHelper, supplied]);
  const subscribe = React.useCallback((listener: () => void) => source ? source.subscribe(listener) : () => undefined, [source]);
  const read = React.useCallback(() => source?.getTokens() ?? emptyTokens, [source]);
  const tokens = React.useSyncExternalStore(subscribe, read, read);
  return { source, tokens };
}


/** Subscribe only to policy consumed by the two token pickers. */
export function useTokenPickerPermissions(studio: StudioCtx | undefined) {
  const owner = studio?.uiEnvironment.store;
  const source = React.useMemo(() => createTokenPickerPermissionsSource(owner), [owner]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createTokenPickerPermissionsSource(owner: StudioCtx["uiEnvironment"]["store"] | undefined) {
    let current: Readonly<{ canCreateTokens: boolean; canOverrideImportedTokens: boolean; canOverrideRegisteredTokens: boolean }> = Object.freeze({ canCreateTokens: true, canOverrideImportedTokens: true, canOverrideRegisteredTokens: true });
    const read = () => {
      const state = owner?.getState();
      if (state && (current.canCreateTokens !== state.canCreateTokens || current.canOverrideImportedTokens !== state.canOverrideImportedTokens || current.canOverrideRegisteredTokens !== state.canOverrideRegisteredTokens)) {
        current = Object.freeze({ canCreateTokens: state.canCreateTokens, canOverrideImportedTokens: state.canOverrideImportedTokens, canOverrideRegisteredTokens: state.canOverrideRegisteredTokens });
      }
      return current;
    };
    return { read, subscribe: (listener: () => void) => owner ? owner.subscribe(listener) : () => undefined };
  }
