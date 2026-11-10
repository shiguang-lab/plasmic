import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ModelFieldInputs } from "@/wab/client/stores/model-field-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getStyleTokenReaderScope } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { getStyleTokenScope } from "@/wab/client/studio-ctx/style-token-inputs";
import type { StyleTokenType } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import type { FinalToken } from "@/wab/shared/core/tokens";
import { siteFinalStyleTokensOfType } from "@/wab/shared/core/site-style-tokens";
import type { StyleToken } from "@/wab/shared/model/classes";
import * as React from "react";

const emptyTokens: readonly FinalToken<StyleToken>[] = Object.freeze([]);
let nextKey = 0;
const ownerKeys = new WeakMap<object, number>();
/** Direct picker membership and labels only. Values and aliases keep their existing demanded sources. */
export class StyleTokenCatalogInputs {
  readonly key: number;
  private readonly scope;
  private tokenFields: readonly unknown[] | undefined;
  private tokens = emptyTokens;
  private readonly inputs: ModelFieldInputs;
  constructor(private readonly studio: StudioCtx, private readonly type: StyleTokenType | undefined, helper: VariantedStylesHelper, private readonly supplied?: readonly FinalToken<StyleToken>[]) {
    this.scope = supplied?.[0] ? getStyleTokenScope(studio, supplied[0]) : getStyleTokenReaderScope(studio, helper);
    let key = ownerKeys.get(this.scope.models);
    if (key === undefined) { key = ++nextKey; ownerKeys.set(this.scope.models, key); }
    this.key = key;
    this.inputs = new ModelFieldInputs({ models: this.scope.models, lifetime: this.scope.lifetime, isCurrent: this.isActive }, (field) => {
    const { site } = this.scope;
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
    });
  }
  isActive = () => this.scope.models === this.studio.modelSnapshots && !this.scope.owner.isDisposed && !this.scope.lifetime.aborted;
  getSnapshot = () => this.inputs.read();
  getTokens = (): readonly FinalToken<StyleToken>[] => {
    const fields = this.getSnapshot();
    if (fields !== this.tokenFields) {
      this.tokenFields = fields;
      this.tokens = !this.isActive() ? emptyTokens : Object.freeze([...(this.supplied ?? (this.type ? siteFinalStyleTokensOfType(this.scope.site, this.type, { includeDeps: "direct" }) : []))]);
    }
    return this.tokens;
  };
  subscribe = (listener: () => void) => this.inputs.subscribe(listener);
}

const catalogs = new WeakMap<ModelSnapshots, Map<StyleTokenType | undefined, { studio: StudioCtx; scope: ReturnType<typeof getStyleTokenReaderScope>; source: StyleTokenCatalogInputs }>>();
export function getStyleTokenCatalogInputs(studio: StudioCtx, models: ModelSnapshots, type: StyleTokenType | undefined, helper: VariantedStylesHelper, supplied?: readonly FinalToken<StyleToken>[]) {
  if (supplied) { return new StyleTokenCatalogInputs(studio, type, helper, supplied); }
  const scope = getStyleTokenReaderScope(studio, helper);
  if (scope.models !== models || scope.owner.isDisposed || scope.lifetime.aborted) { return new StyleTokenCatalogInputs(studio, type, helper); }
  let types = catalogs.get(scope.models);
  if (!types) { types = new Map(); catalogs.set(scope.models, types); }
  const previous = types.get(type);
  if (previous?.studio === studio && previous.scope.site === scope.site && previous.scope.owner === scope.owner && previous.scope.lifetime === scope.lifetime && previous.source.isActive()) { return previous.source; }
  const source = new StyleTokenCatalogInputs(studio, type, helper);
  types.set(type, { studio, scope, source }); return source;
}

export function useStyleTokenCatalogInputs(studio: StudioCtx | undefined, type: StyleTokenType | undefined, helper?: VariantedStylesHelper, supplied?: readonly FinalToken<StyleToken>[], enabled = true) {
  const subscribeOwner = React.useCallback((listener: () => void) => studio ? studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } }) : () => undefined, [studio]);
  const readOwner = React.useCallback(() => studio?.modelSnapshots, [studio]);
  const models = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const baseHelper = React.useMemo(() => new VariantedStylesHelper(), []);
  const source = React.useMemo(() => studio && models ? getStyleTokenCatalogInputs(studio, models, type, helper ?? baseHelper, supplied) : undefined, [studio, models, type, helper, baseHelper, supplied]);
  const subscribe = React.useCallback((listener: () => void) => enabled && source ? source.subscribe(listener) : () => undefined, [source, enabled]);
  const read = React.useCallback(() => enabled ? source?.getTokens() ?? emptyTokens : emptyTokens, [source, enabled]);
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
