import { StyleTokenReaderBinding } from "@/wab/client/studio-ctx/style-token-inputs";
import { useShallow } from "zustand/react/shallow";
import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { getStyleTokenScope, StyleTokenInputs, type StyleTokenSnapshot } from "@/wab/client/studio-ctx/style-token-inputs";
import { getStyleTokenReaderScope, type ResolvedStyleToken } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTokenRef, resolveToken } from "@/wab/commons/StyleToken";
import type { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { siteFinalStyleTokensAllDeps, siteStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import type { FinalToken } from "@/wab/shared/core/tokens";
import type { ObjInst, StyleToken } from "@/wab/shared/model/classes";
import * as React from "react";

function choiceScope(studio: StudioCtx, starts: readonly FinalToken<StyleToken>[], vsh: VariantedStylesHelper) {
  const commands = starts.map((token) => getStyleTokenScope(studio, token));
  const first = commands[0];
  if (first) {
    assert(commands.every((scope) => scope.models === first.models), "Color choices belong to different model worlds");
    if (first.owner.isDisposed || first.lifetime.aborted) { return first; }
  }
  const context = getStyleTokenReaderScope(studio, vsh);
  if (context.owner.isDisposed || context.lifetime.aborted) { return context; }
  assert(!first || first.models === context.models, "Color context belongs to another model world");
  return context;
}

export interface ColorTokenChoice {
  readonly id: string;
  readonly ref: ModelRef<StyleToken>;
  readonly name: string;
  readonly resolved: ResolvedStyleToken;
}
export interface ColorTokenChoiceSnapshot {
  readonly active: boolean;
  readonly choices: readonly ColorTokenChoice[];
}
interface TokenNode {
  readonly inputs: StyleTokenInputs;
  captured: StyleTokenSnapshot | undefined;
  stop?: () => void;
}
const emptyChoices: readonly ColorTokenChoice[] = Object.freeze([]);

/** The palette's supplied command tokens are explicit resolver starts.
 * The original all-style array supplies aliases, with first UUID semantics.
 * Rows contain refs/scalars; original command wrappers stay in a private map. */
export class ColorTokenChoiceInputs {
  private readonly scope;
  readonly lifetime;
  private readonly starts;
  private readonly ordinals;
  private current: ColorTokenChoiceSnapshot = Object.freeze({ active: true, choices: emptyChoices });
  private readonly commands = new WeakMap<ColorTokenChoice, FinalToken<StyleToken>>();
  private readonly nodes = new Map<FinalToken<StyleToken>, TokenNode>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; publish: () => void }>();
  private readonly listeners = new Set<() => void>();
  private roster: { tokens: readonly StyleToken[]; members: ReadonlySet<StyleToken>; captured: ReadonlyMap<ModelFieldStore<unknown>, unknown> } | undefined;
  private aliases: { tokens: ReadonlyMap<string, FinalToken<StyleToken>>; captured: ReadonlyMap<ModelFieldStore<unknown>, unknown> } | undefined;
  private dirty = true;
  private connected = false;
  private closed = false;
  constructor(private readonly studio: StudioCtx, starts: readonly FinalToken<StyleToken>[], private readonly vsh: VariantedStylesHelper) {
    this.starts = Object.freeze(starts.slice());
    const counts = new Map<StyleToken, number>();
    this.ordinals = this.starts.map((token) => {
      const ordinal = counts.get(token.base) ?? 0; counts.set(token.base, ordinal + 1); return ordinal;
    });
    this.scope = choiceScope(studio, this.starts, vsh); this.lifetime = this.scope.lifetime;
  }
  isActive = () => !this.closed && this.scope.models === this.studio.modelSnapshots && !this.scope.owner.isDisposed && !this.lifetime.aborted;
  private invalidate = () => { this.dirty = true; };
  private notify = () => { if (this.isActive()) { this.listeners.forEach((listener) => listener()); } };
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
  private readRoster(used: Set<ModelFieldStore<unknown>>) {
    if (!this.roster || [...this.roster.captured].some(([field, value]) => field.getState() !== value)) {
      const { models, site } = this.scope;
      const fields = new Set<ModelFieldStore<unknown>>();
      const declare = (model: ObjInst, ...names: string[]) => names.forEach((name) => fields.add(models.declaredField(model, name)));
      declare(site, "styleTokens", "projectDependencies");
      for (const dep of walkDependencyTree(site, "all")) { declare(dep, "site", "projectId"); declare(dep.site, "styleTokens", "projectDependencies"); }
      const tokens = siteStyleTokensAllDeps(site);
      this.roster = { tokens, members: new Set(tokens), captured: new Map([...fields].map((field) => [field, field.getState()])) };
      this.aliases = undefined;
    }
    for (const field of this.roster.captured.keys()) { used.add(field); }
    return this.roster.tokens;
  }
  private readAliases(used: Set<ModelFieldStore<unknown>>) {
    const roster = this.readRoster(used);
    if (!this.aliases || [...this.aliases.captured].some(([field, value]) => field.getState() !== value)) {
      const fields = new Set<ModelFieldStore<unknown>>();
      for (const token of roster) { fields.add(this.scope.models.field(token, "uuid")); fields.add(this.scope.models.field(token, "isRegistered")); }
      const tokens = new Map<string, FinalToken<StyleToken>>();
      for (const token of siteFinalStyleTokensAllDeps(this.scope.site)) { if (!tokens.has(token.uuid)) { tokens.set(token.uuid, token); } }
      this.aliases = { tokens, captured: new Map([...fields].map((field) => [field, field.getState()])) };
    }
    for (const field of this.aliases.captured.keys()) { used.add(field); }
    return this.aliases.tokens;
  }
  getSnapshot = (): ColorTokenChoiceSnapshot => {
    if (!this.isActive()) {
      if (this.current.active) { this.current = Object.freeze({ active: false, choices: this.current.choices }); }
      return this.current;
    }
    if (!this.connected && (this.roster && [...this.roster.captured].some(([field, value]) => field.getState() !== value) || this.aliases && [...this.aliases.captured].some(([field, value]) => field.getState() !== value))) { this.dirty = true; }
    if (!this.dirty && [...this.nodes.values()].some((node) => node.inputs.store.getState() !== node.captured)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const usedFields = new Set<ModelFieldStore<unknown>>(), usedNodes = new Set<FinalToken<StyleToken>>();
    let complete = false;
    try {
      if (this.starts.length) { this.readRoster(usedFields); }
      let aliases: ReturnType<ColorTokenChoiceInputs["readAliases"]> | undefined;
      const visit = (token: FinalToken<StyleToken>) => {
        usedNodes.add(token);
        let node = this.nodes.get(token);
        if (!node) { node = { inputs: new StyleTokenInputs(this.studio, token, this.vsh), captured: undefined }; this.nodes.set(token, node); }
        node.captured = node.inputs.store.getState();
        return ensure(node.captured, "Color token inputs must exist");
      };
      const choices = this.starts.map((start, index) => {
        // makeTokenResolver's original command-token map rejects removed starts.
        ensure(this.roster?.members.has(start.base), () => `Missing token ${start.name} (${start.uuid})`);
        const own = visit(start);
        const lookup = isTokenRef(own.activeValue) ? aliases ??= this.readAliases(usedFields) : [];
        const result = resolveToken(lookup, start, this.vsh, visit);
        const terminal = ensure(this.nodes.get(result.token)?.captured, "Terminal color inputs must exist");
        const ref = this.scope.models.ref(start.base), terminalRef = this.scope.models.ref(result.token.base);
        const previous = this.current.choices[index];
        const before = previous?.resolved;
        const resolved = before && before.ref === terminalRef && before.value === result.value && before.isRegistered === terminal.isRegistered && before.regKey === terminal.regKey
          ? before : Object.freeze({ ref: terminalRef, value: result.value, isRegistered: terminal.isRegistered, regKey: terminal.regKey });
        const id = `${ref.uid}:${this.ordinals[index]}`;
        const row = previous && previous.id === id && previous.ref === ref && previous.name === own.name && previous.resolved === resolved
          ? previous : Object.freeze({ id, ref, name: own.name, resolved });
        this.commands.set(row, start); return row;
      });
      if (!arrayEq(choices, this.current.choices)) { this.current = Object.freeze({ active: true, choices: Object.freeze(choices) }); }
      complete = true; return this.current;
    } finally {
      if (this.connected) {
        for (const field of usedFields) {
          if (!this.fields.has(field)) { this.fields.set(field, { prepare: this.scope.models.subscribePreparedField(field, this.invalidate), publish: field.subscribe(this.notify) }); }
        }
        for (const [field, stops] of this.fields) { if (!usedFields.has(field)) { stops.prepare(); stops.publish(); this.fields.delete(field); } }
      }
      for (const [token, node] of this.nodes) {
        if (!usedNodes.has(token)) { node.stop?.(); this.nodes.delete(token); }
        else if (this.connected && !node.stop) { node.stop = () => undefined; node.stop = node.inputs.store.subscribe(this.notify); }
      }
      this.dirty = !complete;
    }
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true });
      let installed = false;
      try { this.invalidate(); this.getSnapshot(); installed = true; }
      finally { if (!installed) { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } } }
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
  command(choice: ColorTokenChoice) {
    if (!this.isActive()) { return undefined; }
    const start = ensure(this.commands.get(choice), "Color row belongs to another reader");
    return this.scope.site.styleTokens.includes(start.base) || walkDependencyTree(this.scope.site, "all").some((dep) => dep.site.styleTokens.includes(start.base)) ? start : undefined;
  }
}

export function useColorTokenChoiceInputs(studio: StudioCtx, starts: readonly FinalToken<StyleToken>[], vsh: VariantedStylesHelper) {
  const subscribeOwner = React.useCallback((listener: () => void) => {
    const stopModel = studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = studio.arenaState.store.subscribe(listener);
    return () => { stopModel(); stopArena(); };
  }, [studio]);
  const readOwner = React.useCallback(() => studio.singleRsStyleInputs, [studio]);
  const owner = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const inputs = useShallow((tokens: readonly FinalToken<StyleToken>[]) => tokens)(starts);
  const binding = React.useMemo(() => new StyleTokenReaderBinding<ColorTokenChoiceInputs>(), [studio]);
  const scope = React.useMemo(() => choiceScope(studio, inputs, vsh), [studio, owner, inputs, vsh]);
  const source = React.useMemo(() => (scope.owner.isDisposed || scope.lifetime.aborted) && binding.committed?.lifetime === scope.lifetime
    ? binding.committed : new ColorTokenChoiceInputs(studio, inputs, vsh), [studio, owner, inputs, vsh, scope, binding]);
  React.useLayoutEffect(() => {
    if (!binding.committed || !scope.owner.isDisposed && !scope.lifetime.aborted) { binding.commit(source); }
  }, [source, binding, scope]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, lifetime: source.lifetime, command: (choice: ColorTokenChoice) => source.command(choice), isActive: source.isActive };
}
