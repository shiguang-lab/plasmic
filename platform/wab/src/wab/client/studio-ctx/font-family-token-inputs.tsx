import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { StyleTokenInputs, type StyleTokenSnapshot } from "@/wab/client/studio-ctx/style-token-inputs";
import { getStyleTokenReaderScope } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkTokenRef, resolveToken } from "@/wab/commons/StyleToken";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq, ensure } from "@/wab/shared/common";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { siteFinalStyleTokensOfType } from "@/wab/shared/core/site-style-tokens";
import type { FinalToken } from "@/wab/shared/core/tokens";
import type { ObjInst, StyleToken } from "@/wab/shared/model/classes";
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

/** The font selector's original root/direct FontFamily roster. Each visible
 * choice starts at its own FinalToken, including distinct duplicate UUIDs.
 * Aliases still use the original resolver and that same direct-only roster. */
export class FontFamilyTokenInputs {
  private readonly scope;
  readonly lifetime;
  private current: FontFamilyTokenSnapshot = Object.freeze({ active: true, choices: noChoices });
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; publish: () => void }>();
  private readonly nodes = new Map<StyleToken, TokenNode>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  private dirty = true;
  private lookupDirty = true;
  private lookup: { tokens: readonly FinalToken<StyleToken>[]; captured: ReadonlyMap<ModelFieldStore<unknown>, unknown> } | undefined;
  constructor(private readonly studio: StudioCtx, private readonly vsh: VariantedStylesHelper) {
    this.scope = getStyleTokenReaderScope(studio, vsh);
    this.lifetime = this.scope.lifetime;
  }
  private isClosed = () => this.closed || this.scope.owner.isDisposed || this.lifetime.aborted;
  private invalidate = () => { this.dirty = true; this.lookupDirty = true; };
  // Keep missing/cyclic reference behavior in the original resolver. Its
  // errors are read by React, rather than aborting a completed model commit.
  private notify = () => { if (!this.isClosed()) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false;
    for (const stop of this.fields.values()) { stop.prepare(); stop.publish(); }
    this.fields.clear();
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
    if (!this.connected && this.lookup && [...this.lookup.captured].some(([field, value]) => field.getState() !== value)) { this.invalidate(); }
    if (!this.dirty && [...this.nodes.values()].some((node) => node.inputs.store.getState() !== node.captured)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const { site, models } = this.scope;
    const usedFields = new Set<ModelFieldStore<unknown>>(this.lookup && !this.lookupDirty ? this.lookup.captured.keys() : []);
    const usedNodes = new Set<StyleToken>();
    const declare = (model: ObjInst, ...names: string[]) => names.forEach((name) => usedFields.add(models.declaredField(model, name)));
    let complete = false;
    try {
      if (!this.lookup || this.lookupDirty) {
        declare(site, "styleTokens", "projectDependencies");
        const dependencies = walkDependencyTree(site, "direct");
        dependencies.forEach((dep) => { declare(dep, "site", "projectId"); declare(dep.site, "styleTokens"); });
        for (const ownerSite of [site, ...dependencies.map((dep) => dep.site)]) {
          ownerSite.styleTokens.forEach((token) => declare(token, "uuid", "type", "isRegistered"));
        }
        this.lookup = { tokens: siteFinalStyleTokensOfType(site, "FontFamily", { includeDeps: "direct" }),
          captured: new Map([...usedFields].map((field) => [field, field.getState()])) };
        this.lookupDirty = false;
      }
      const tokens = this.lookup.tokens;
      const visit = (token: FinalToken<StyleToken>) => {
        usedNodes.add(token.base);
        let node = this.nodes.get(token.base);
        if (!node || node.token.constructor !== token.constructor) {
          node?.stop?.(); node = { token, inputs: new StyleTokenInputs(this.studio, token, this.vsh), captured: undefined };
          this.nodes.set(token.base, node);
        }
        node.captured = node.inputs.store.getState();
      };
      const choices = tokens.map((token) => {
        const resolved = resolveToken(tokens, token, this.vsh, visit);
        const own = ensure(this.nodes.get(token.base)?.captured, "Font token's own inputs must exist");
        const ref = models.ref(token.base), previous = this.current.choices.find((choice) => choice.ref === ref);
        return previous && previous.uuid === token.uuid && previous.name === own.name && previous.resolvedValue === resolved.value
          ? previous : Object.freeze({ ref, uuid: token.uuid, name: own.name, value: mkTokenRef(token.base), resolvedValue: resolved.value });
      });
      if (!arrayEq(choices, this.current.choices)) { this.current = Object.freeze({ active: true, choices: Object.freeze(choices) }); }
      complete = true;
      return this.current;
    } finally {
      if (this.connected) {
        for (const field of usedFields) {
          if (!this.fields.has(field)) { this.fields.set(field, { prepare: models.subscribePreparedField(field, this.invalidate), publish: field.subscribe(this.notify) }); }
        }
        for (const [field, stops] of this.fields) { if (!usedFields.has(field)) { stops.prepare(); stops.publish(); this.fields.delete(field); } }
      }
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
      try { this.invalidate(); this.getSnapshot(); installed = true; }
      finally {
        if (!installed) { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } }
      }
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useFontFamilyTokenInputs(studio: StudioCtx, suppliedVsh: VariantedStylesHelper | undefined) {
  const baseVsh = React.useMemo(() => new VariantedStylesHelper(), []), vsh = suppliedVsh ?? baseVsh;
  const subscribeOwner = React.useCallback((listener: () => void) => {
    const stopModel = studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = studio.arenaState.store.subscribe(listener);
    return () => { stopModel(); stopArena(); };
  }, [studio]);
  const readOwner = React.useCallback(() => studio.singleRsStyleInputs, [studio]);
  const owner = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const binding = React.useMemo<{ committed: FontFamilyTokenInputs | undefined }>(() => ({ committed: undefined }), [studio]);
  const context = React.useMemo(() => getStyleTokenReaderScope(studio, vsh), [studio, owner, vsh]);
  const source = React.useMemo(() => (context.owner.isDisposed || context.lifetime.aborted) && binding.committed?.lifetime === context.lifetime
    ? binding.committed : new FontFamilyTokenInputs(studio, vsh), [studio, owner, vsh, context, binding]);
  React.useLayoutEffect(() => {
    if (!binding.committed || !context.owner.isDisposed && !context.lifetime.aborted) { binding.committed = source; }
  }, [source, binding, context]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
