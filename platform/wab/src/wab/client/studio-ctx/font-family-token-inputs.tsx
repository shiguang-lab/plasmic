import { StyleTokenReaderBinding } from "@/wab/client/studio-ctx/style-token-inputs";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { StyleTokenInputs, type StyleTokenSnapshot } from "@/wab/client/studio-ctx/style-token-inputs";
import { getStyleTokenReaderScope } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTokenRef, mkTokenRef, resolveToken } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq, ensure } from "@/wab/shared/common";
import type { FinalToken } from "@/wab/shared/core/tokens";
import type { StyleToken } from "@/wab/shared/model/classes";
import { getStyleTokenCatalogInputs, useStyleTokenCatalogInputs, type StyleTokenCatalogInputs } from "@/wab/client/studio-ctx/style-token-catalog-inputs";
import * as React from "react";

export interface FontFamilyTokenChoice {
  readonly ref: ModelRef<StyleToken>;
  readonly uuid: string;
  readonly name: string;
  readonly value: string;
  readonly resolvedValue: string;
}
export interface FontFamilyTokenSnapshot {
  readonly active: boolean;
  readonly choices: readonly FontFamilyTokenChoice[];
}
interface TokenNode {
  readonly token: FinalToken<StyleToken>;
  readonly inputs: StyleTokenInputs;
  captured: StyleTokenSnapshot | undefined;
  stop?: () => void;
}
const noChoices: readonly FontFamilyTokenChoice[] = Object.freeze([]);
interface FontLookup {
  byId: ReadonlyMap<string, FinalToken<StyleToken>>;
  byValue: ReadonlyMap<string, readonly FinalToken<StyleToken>[]>;
}
const lookups = new WeakMap<readonly FinalToken<StyleToken>[], FontLookup>();

/** The font selector's original root/direct FontFamily roster. Each visible
 * choice starts at its own FinalToken, including distinct duplicate UUIDs.
 * Aliases still use the original resolver and that same direct-only roster. */
export class FontFamilyTokenInputs {
  private readonly scope;
  readonly lifetime;
  private current: FontFamilyTokenSnapshot = Object.freeze({ active: true, choices: noChoices });
  private readonly catalog: StyleTokenCatalogInputs;
  private stopCatalog: (() => void) | undefined;
  private readonly nodes = new Map<StyleToken, TokenNode>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  private dirty = true;
  private lookup: ({ tokens: readonly FinalToken<StyleToken>[] } & FontLookup) | undefined;
  constructor(private readonly studio: StudioCtx, private readonly vsh: VariantedStylesHelper, private readonly expanded = true, private readonly selectedValue?: string, catalog?: StyleTokenCatalogInputs) {
    this.scope = getStyleTokenReaderScope(studio, vsh);
    this.lifetime = this.scope.lifetime;
    this.catalog = catalog ?? getStyleTokenCatalogInputs(studio, this.scope.models, "FontFamily", vsh);
  }
  private isClosed = () => this.closed || this.scope.owner.isDisposed || this.lifetime.aborted;
  private invalidate = () => { this.dirty = true; };
  // Keep missing/cyclic reference behavior in the original resolver. Its
  // errors are read by React, rather than aborting a completed model commit.
  private notify = () => { if (!this.isClosed()) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false;
    this.stopCatalog?.(); this.stopCatalog = undefined;
    for (const node of this.nodes.values()) { node.stop?.(); node.stop = undefined; }
    this.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) { return; } this.closed = true; this.disconnect();
    this.current = Object.freeze({ active: false, choices: this.current.choices });
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  getSnapshot = (): FontFamilyTokenSnapshot => {
    if (this.isClosed()) {
      if (this.current.active) { this.current = Object.freeze({ active: false, choices: this.current.choices }); }
      return this.current;
    }
    if (!this.expanded && !isTokenRef(this.selectedValue ?? "")) { return this.current; }
    const tokens = this.catalog.getTokens();
    if (tokens !== this.lookup?.tokens) { this.invalidate(); }
    if (!this.dirty && [...this.nodes.values()].some((node) => node.inputs.store.getState() !== node.captured)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const { models } = this.scope;
    const usedNodes = new Set<StyleToken>();
    let complete = false;
    try {
      if (tokens !== this.lookup?.tokens) {
        let lookup = lookups.get(tokens);
        if (!lookup) {
          const byId = new Map<string, FinalToken<StyleToken>>(), byValue = new Map<string, FinalToken<StyleToken>[]>();
          for (const token of tokens) {
            if (!byId.has(token.uuid)) { byId.set(token.uuid, token); }
            const value = mkTokenRef(token.base), bucket = byValue.get(value) ?? [];
            bucket.push(token); byValue.set(value, bucket);
          }
          lookup = { byId, byValue }; lookups.set(tokens, lookup);
        }
        this.lookup = { tokens, ...lookup };
      }
      const { byId, byValue } = ensure(this.lookup, "Font lookup must be captured");
      const visit = (token: FinalToken<StyleToken>) => {
        usedNodes.add(token.base);
        let node = this.nodes.get(token.base);
        if (!node || node.token.constructor !== token.constructor) {
          node?.stop?.(); node = { token, inputs: new StyleTokenInputs(this.studio, token, this.vsh), captured: undefined };
          this.nodes.set(token.base, node);
        }
        node.captured = node.inputs.store.getState();
      };
      const previousChoices = new Map(this.current.choices.map(choice => [choice.ref, choice]));
      const starts = this.expanded ? tokens : byValue.get(this.selectedValue ?? "") ?? [];
      const choices = starts.map((token) => {
        const resolved = resolveToken(byId, token, this.vsh, visit);
        const own = ensure(this.nodes.get(token.base)?.captured, "Font token's own inputs must exist");
        const ref = models.ref(token.base), previous = previousChoices.get(ref);
        return previous && previous.uuid === token.uuid && previous.name === own.name && previous.resolvedValue === resolved.value
          ? previous : Object.freeze({ ref, uuid: token.uuid, name: own.name, value: mkTokenRef(token.base), resolvedValue: resolved.value });
      });
      if (!arrayEq(choices, this.current.choices)) { this.current = Object.freeze({ active: true, choices: Object.freeze(choices) }); }
      complete = true;
      return this.current;
    } finally {
      for (const [token, node] of this.nodes) {
        if (!usedNodes.has(token)) { node.stop?.(); this.nodes.delete(token); }
        else if (this.connected && !node.stop) {
          node.stop = () => undefined;
          node.stop = node.inputs.store.subscribe(this.notify);
        }
      }
      this.dirty = !complete;
    }
  };
  subscribe = (listener: () => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true });
      let installed = false;
      try {
        if (this.expanded || isTokenRef(this.selectedValue ?? "")) { this.stopCatalog = this.catalog.subscribe(this.notify); }
        this.invalidate(); this.getSnapshot(); installed = true;
      }
      finally {
        if (!installed) { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } }
      }
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useFontFamilyTokenInputs(studio: StudioCtx, suppliedVsh: VariantedStylesHelper | undefined, expanded = true, value?: string) {
  const baseVsh = React.useMemo(() => new VariantedStylesHelper(), []), vsh = suppliedVsh ?? baseVsh;
  const subscribeOwner = React.useCallback((listener: () => void) => {
    const stopModel = studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = studio.arenaState.store.subscribe(listener);
    return () => { stopModel(); stopArena(); };
  }, [studio]);
  const readOwner = React.useCallback(() => studio.singleRsStyleInputs, [studio]);
  const owner = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const binding = React.useMemo(() => new StyleTokenReaderBinding<FontFamilyTokenInputs>(), [studio]);
  const context = React.useMemo(() => getStyleTokenReaderScope(studio, vsh), [studio, owner, vsh]);
  const selectedValue = expanded ? undefined : value;
  const { source: catalog } = useStyleTokenCatalogInputs(studio, "FontFamily", vsh, undefined, expanded || isTokenRef(value ?? ""));
  const source = React.useMemo(() => (context.owner.isDisposed || context.lifetime.aborted) && binding.committed?.lifetime === context.lifetime
    ? binding.committed : new FontFamilyTokenInputs(studio, vsh, expanded, selectedValue, catalog), [studio, owner, vsh, context, binding, expanded, selectedValue, catalog]);
  React.useLayoutEffect(() => {
    if (!binding.committed || !context.owner.isDisposed && !context.lifetime.aborted) { binding.commit(source); }
  }, [source, binding, context]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
