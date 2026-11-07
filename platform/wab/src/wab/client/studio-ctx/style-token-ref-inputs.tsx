import { allGlobalVariants } from "@/wab/shared/core/sites";
import { useShallow } from "zustand/react/shallow";
import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { StyleTokenInputs, type StyleTokenSnapshot } from "@/wab/client/studio-ctx/style-token-inputs";
import { hasTokenRefs, resolveToken, tryParseTokenRef, type StyleTokenValue } from "@/wab/commons/StyleToken";
import type { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { siteFinalColorTokens, siteFinalStyleTokensAllDeps, siteFinalStyleTokensOfType } from "@/wab/shared/core/site-style-tokens";
import type { FinalToken } from "@/wab/shared/core/tokens";
import type { ObjInst, StyleToken } from "@/wab/shared/model/classes";
import * as React from "react";

export interface StyleTokenReaderScope {
  readonly models: StudioCtx["modelSnapshots"];
  readonly owner: StudioCtx["singleRsStyleInputs"];
  readonly lifetime: AbortSignal;
  readonly site: StudioCtx["site"];
}
// Only active helper ownership is bound. Literal strings and base helpers do
// not carry model identities and continue following the current display world.
const activeContexts = new WeakMap<StudioCtx, WeakMap<VariantedStylesHelper, StyleTokenReaderScope>>();
export function getStyleTokenReaderScope(studio: StudioCtx, helper: VariantedStylesHelper): StyleTokenReaderScope {
  const active = helper.globalVariants();
  let contexts = active?.length ? activeContexts.get(studio) : undefined;
  const previous = contexts?.get(helper);
  if (previous) { return previous; }
  const scope = { models: studio.modelSnapshots, owner: studio.singleRsStyleInputs,
    lifetime: studio.arenaState.lifetime(), site: studio.site };
  if (active?.length) {
    if (!scope.owner.isDisposed && !scope.lifetime.aborted) {
      const admitted = allGlobalVariants(scope.site, { includeDeps: "all" });
      assert(active.every((variant) => admitted.includes(variant)), "Active style context belongs to another model world");
    }
    if (!contexts) { contexts = new WeakMap(); activeContexts.set(studio, contexts); }
    contexts.set(helper, scope);
  }
  return scope;
}

/** The original consumers' finite lookup contracts:
 * Color: Color heads, all-style aliases, first UUID.
 * ColorOnly: Color heads and aliases, first UUID.
 * ColorLabel: Color head/name only, without dereferencing aliases.
 * all: all-style heads and aliases, first UUID.
 * allHead: all-style head name/base value only, first UUID, no aliases.
 * SpacingOnly: Spacing heads and aliases, first UUID.
 * dictionary: CssVarResolver's all-style heads and aliases, last UUID.
 */
export type StyleTokenReferenceRole = "Color" | "ColorOnly" | "ColorLabel" | "SpacingOnly" | "allHead" | "all" | "dictionary";

export interface ResolvedStyleToken {
  readonly ref: ModelRef<StyleToken>;
  readonly value: StyleTokenValue;
  readonly isRegistered: boolean;
  readonly regKey: StyleToken["regKey"];
}
export interface TokenReferenceRow {
  readonly input: string;
  readonly applied: Readonly<{ ref: ModelRef<StyleToken>; name: string }> | undefined;
  readonly resolved: ResolvedStyleToken | undefined;
}
export interface TokenReferenceSnapshot {
  readonly active: boolean;
  readonly rows: readonly TokenReferenceRow[];
}
interface TokenNode {
  readonly token: FinalToken<StyleToken>;
  readonly source: StyleTokenInputs;
  captured: StyleTokenSnapshot | undefined;
  stop?: () => void;
}
const emptyRows: readonly TokenReferenceRow[] = Object.freeze([]);

/** Demanded reference reads, not a token dictionary. The original resolver
 * explicitly visits its chosen nodes; each node leases the existing finite
 * token/VSH/override recipe. Raw strings belong to this current display world. */
export class StyleTokenRefInputs {
  private readonly models;
  private readonly owner;
  readonly lifetime;
  private readonly site;
  private current: TokenReferenceSnapshot = Object.freeze({ active: true, rows: emptyRows });
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; publish: () => void }>();
  private readonly nodes = new Map<StyleToken, TokenNode>();
  private labelNames = new Map<ModelFieldStore<unknown>, unknown>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private closed = false;
  private readonly inputs: readonly string[];
  private dirty = true;
  private lookup: { all: ReadonlyArray<FinalToken<StyleToken>>; heads: ReadonlyArray<FinalToken<StyleToken>>; captured: ReadonlyMap<ModelFieldStore<unknown>, unknown> } | undefined;
  private lookupDirty = true;
  constructor(private readonly studio: StudioCtx, inputs: readonly string[],
    private readonly vsh: VariantedStylesHelper, private readonly headType: StyleTokenReferenceRole) {
    this.inputs = Object.freeze(inputs.slice());
    const scope = getStyleTokenReaderScope(studio, vsh);
    this.models = scope.models; this.owner = scope.owner;
    this.lifetime = scope.lifetime; this.site = scope.site;
  }
  private isClosed() { return this.closed || this.owner.isDisposed || this.lifetime.aborted; }
  private invalidate = () => { this.dirty = true; this.lookupDirty = true; };
  private invalidateLabel = () => { this.dirty = true; };
  // Notify invalidation only. React reads the snapshot and handles the original
  // resolver's missing-reference exception in render, outside the model commit.
  private notify = () => { if (!this.isClosed()) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false;
    for (const stops of this.fields.values()) { stops.prepare(); stops.publish(); }
    this.fields.clear();
    for (const node of this.nodes.values()) { node.stop?.(); node.stop = undefined; }
    this.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) { return; } this.closed = true; this.disconnect();
    this.current = Object.freeze({ active: false, rows: this.current.rows });
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };

  getSnapshot = (): TokenReferenceSnapshot => {
    if (this.isClosed()) {
      if (this.current.active) { this.current = Object.freeze({ active: false, rows: this.current.rows }); }
      return this.current;
    }
    // Plain CSS has no token lookup dependency. Do not lease membership or
    // unrelated token fields when neither caller supplied a token reference.
    if (!this.inputs.some(hasTokenRefs)) {
      const rows = this.inputs.map((input, index) => this.current.rows[index]?.input === input
        ? this.current.rows[index] : Object.freeze({ input, applied: undefined, resolved: undefined }));
      if (!arrayEq(rows, this.current.rows)) { this.current = Object.freeze({ active: true, rows: Object.freeze(rows) }); }
      this.dirty = false;
      return this.current;
    }
    if (!this.connected && this.lookup && [...this.lookup.captured].some(([field, captured]) => field.getState() !== captured)) { this.invalidate(); }
    // Prepared node values are readable before any public field subscriber.
    if (!this.dirty && [...this.nodes.values()].some((node) => node.source.store.getState() !== node.captured)) { this.dirty = true; }
    if (!this.dirty && [...this.labelNames].some(([store, name]) => store.getState() !== name)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    this.labelNames = new Map();
    const usedFields = new Set<ModelFieldStore<unknown>>(this.lookup && !this.lookupDirty ? this.lookup.captured.keys() : []), usedNodes = new Set<StyleToken>();
    const field = (model: ObjInst, ...names: string[]) => names.forEach((name) => usedFields.add(this.models.declaredField(model, name)));
    let complete = false;
    try {
      if (!this.lookup || this.lookupDirty) {
        field(this.site, "styleTokens", "projectDependencies");
        const deps = walkDependencyTree(this.site, "all");
        for (const dep of deps) { field(dep, "site", "projectId"); field(dep.site, "projectDependencies", "styleTokens"); }
        for (const site of [this.site, ...deps.map((dep) => dep.site)]) {
          for (const token of site.styleTokens) { field(token, "uuid", "type", "isRegistered"); }
        }
        const all = siteFinalStyleTokensAllDeps(this.site);
        this.lookup = { all, heads: this.headType === "SpacingOnly" ? siteFinalStyleTokensOfType(this.site, "Spacing", { includeDeps: "all" }) : (this.headType === "Color" || this.headType === "ColorOnly" || this.headType === "ColorLabel") ? siteFinalColorTokens(this.site, { includeDeps: "all" }) : all,
          captured: new Map([...usedFields].map((store) => [store, store.getState()])) };
        this.lookupDirty = false;
      }
      const { all, heads } = this.lookup;
      const lookupOrder = this.headType === "dictionary" ? "last" : "first";
      const visit = (token: FinalToken<StyleToken>) => {
        usedNodes.add(token.base);
        let node = this.nodes.get(token.base);
        if (!node || node.token.constructor !== token.constructor) {
          node?.stop?.(); node = { token, source: new StyleTokenInputs(this.studio, token, this.vsh), captured: undefined };
          this.nodes.set(token.base, node);
        }
        node.captured = node.source.store.getState();
        return node.captured;
      };
      const distinct = new Map<string, TokenReferenceRow>();
      const rows = this.inputs.map((input, index) => {
        const existing = distinct.get(input); if (existing) { return existing; }
        const previous = this.current.rows[index]?.input === input ? this.current.rows[index] : this.current.rows.find((row) => row.input === input);
        const token = tryParseTokenRef(input, heads, lookupOrder);
        let applied: TokenReferenceRow["applied"], resolved: TokenReferenceRow["resolved"];
        if (token && this.headType === "ColorLabel") {
          field(token.base, "name");
          const nameField = this.models.field(token.base, "name");
          this.labelNames.set(nameField, nameField.getState());
          const ref = this.models.ref(token.base), before = previous?.applied;
          applied = before && before.ref === ref && before.name === token.name ? before : Object.freeze({ ref, name: token.name });
        } else if (token) {
          const result = this.headType === "allHead" ? { token, value: ensure(visit(token), "Head token inputs must exist").activeValue }
            : resolveToken(this.headType === "ColorOnly" || this.headType === "SpacingOnly" ? heads : all, token, this.vsh, visit, lookupOrder);
          const head = ensure(this.nodes.get(token.base)?.captured, "Applied token inputs must exist");
          const end = ensure(this.nodes.get(result.token.base)?.captured, "Resolved token inputs must exist");
          const ref = this.models.ref(token.base), endRef = this.models.ref(result.token.base);
          const appliedBefore = previous?.applied;
          applied = appliedBefore && appliedBefore.ref === ref && appliedBefore.name === head.name ? appliedBefore : Object.freeze({ ref, name: head.name });
          const before = previous?.resolved;
          resolved = before && before.ref === endRef && before.value === result.value && before.isRegistered === end.isRegistered && before.regKey === end.regKey
            ? before : Object.freeze({ ref: endRef, value: result.value, isRegistered: end.isRegistered, regKey: end.regKey });
        }
        const row = previous && previous.applied === applied && previous.resolved === resolved ? previous : Object.freeze({ input, applied, resolved });
        distinct.set(input, row); return row;
      });
      if (!arrayEq(rows, this.current.rows)) { this.current = Object.freeze({ active: true, rows: Object.freeze(rows) }); }
      complete = true;
      return this.current;
    } finally {
      // Also retain the visited prefix of a broken path, so a subsequent valid
      // edit can recover. No exception is caught or converted to a fallback.
      if (this.connected) {
        for (const store of usedFields) {
          if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.labelNames.has(store) ? this.invalidateLabel : this.invalidate), publish: store.subscribe(this.notify) }); }
        }
        for (const [store, stops] of this.fields) {
          if (!usedFields.has(store)) { stops.prepare(); stops.publish(); this.fields.delete(store); }
        }
      }
      for (const [token, node] of this.nodes) {
        if (!usedNodes.has(token)) { node.stop?.(); this.nodes.delete(token); }
        else if (this.connected && !node.stop) {
          // Child subscription catches render-to-commit changes synchronously;
          // reserve its lease before that catch-up can notify this reader.
          node.stop = () => undefined;
          node.stop = node.source.store.subscribe(this.notify);
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
      this.invalidate(); this.getSnapshot();
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useStyleTokenRefs<Selected>(studio: StudioCtx, inputs: readonly string[], vsh: VariantedStylesHelper,
  headType: StyleTokenReferenceRole, selector: (snapshot: TokenReferenceSnapshot) => Selected) {
  const subscribeOwner = React.useCallback((listener: () => void) => {
    const stopModel = studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } });
    const stopArena = studio.arenaState.store.subscribe(listener);
    return () => { stopModel(); stopArena(); };
  }, [studio]);
  const readOwner = React.useCallback(() => studio.singleRsStyleInputs, [studio]);
  const owner = React.useSyncExternalStore(subscribeOwner, readOwner, readOwner);
  const stableInputs = useShallow((values: readonly string[]) => values)(inputs);
  const binding = React.useMemo<{ committed: StyleTokenRefInputs | undefined }>(() => ({ committed: undefined }), [studio]);
  const context = React.useMemo(() => getStyleTokenReaderScope(studio, vsh), [studio, owner, vsh]);
  const source = React.useMemo(() => {
    const closed = context.owner.isDisposed || context.lifetime.aborted;
    return closed && binding.committed?.lifetime === context.lifetime
      ? binding.committed : new StyleTokenRefInputs(studio, stableInputs, vsh, headType);
  }, [studio, owner, stableInputs, vsh, headType, context, binding]);
  React.useLayoutEffect(() => {
    if (!binding.committed || !context.owner.isDisposed && !context.lifetime.aborted) { binding.committed = source; }
  }, [binding, source, context]);
  const readSelected = React.useCallback(() => selector(source.getSnapshot()), [source, selector]);
  const selected = React.useSyncExternalStore(source.subscribe, readSelected, readSelected);
  return { selected, lifetime: source.lifetime };
}
