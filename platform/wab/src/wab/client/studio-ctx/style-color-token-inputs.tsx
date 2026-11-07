import { getStyleTokenScope } from "@/wab/client/studio-ctx/style-token-inputs";
import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq, ensure } from "@/wab/shared/common";
import { siteFinalColorTokens } from "@/wab/shared/core/site-style-tokens";
import { MutableToken, OverrideableToken, type FinalToken } from "@/wab/shared/core/tokens";
import type { ObjInst, StyleToken } from "@/wab/shared/model/classes";
import * as React from "react";
import { useStore } from "zustand";

interface ColorTokenRow {
  readonly token: ModelRef<StyleToken>;
  readonly uuid: string;
  readonly kind: "mutable" | "overrideable" | "immutable";
}
export interface ColorTokenCollectionSnapshot {
  readonly active: boolean;
  readonly tokens: readonly ColorTokenRow[];
}
const emptyRows: readonly ColorTokenRow[] = Object.freeze([]);

/** The original root/direct color picker collection, excluding its own token.
 * Native snapshots hold identities/scalars. Editable wrapper handles stay on
 * their captured model owner and are never resolved through another world. */
export class StyleColorTokenInputs {
  private readonly models;
  private readonly owner;
  private readonly lifetime;
  private readonly site;
  private current: ColorTokenCollectionSnapshot = Object.freeze({ active: true, tokens: emptyRows });
  private readonly initial: ColorTokenCollectionSnapshot;
  private readonly commands = new WeakMap<readonly ColorTokenRow[], FinalToken<StyleToken>[]>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; publish: () => void }>();
  private readonly listeners = new Set<(next: ColorTokenCollectionSnapshot, previous: ColorTokenCollectionSnapshot) => void>();
  private dirty = true;
  private connected = false;
  private closed = false;
  readonly store: ModelFieldStore<ColorTokenCollectionSnapshot> = {
    getState: () => this.getSnapshot(),
    getInitialState: () => this.initial,
    subscribe: (listener) => this.subscribe(listener),
  };

  constructor(studio: StudioCtx, private readonly self: FinalToken<StyleToken>) {
    const scope = getStyleTokenScope(studio, self);
    this.models = scope.models;
    this.owner = scope.owner;
    this.lifetime = scope.lifetime;
    this.site = scope.site;
    this.current = this.getSnapshot(); this.initial = this.current;
  }
  private isClosed() { return this.closed || this.owner.isDisposed || this.lifetime.aborted; }
  private invalidate = () => { this.dirty = true; };
  private disconnect = () => {
    this.connected = false;
    for (const stops of this.fields.values()) { stops.prepare(); stops.publish(); }
    this.fields.clear(); this.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) { return; }
    this.closed = true; this.disconnect();
    const previous = this.current;
    this.current = Object.freeze({ active: false, tokens: previous.tokens });
    this.listeners.forEach((listener) => listener(this.current, previous));
    this.listeners.clear();
  };
  private publish = () => {
    if (this.isClosed()) { this.close(); return; }
    const previous = this.current;
    this.getSnapshot();
    if (previous !== this.current) { this.listeners.forEach((listener) => listener(this.current, previous)); }
  };

  getSnapshot = (): ColorTokenCollectionSnapshot => {
    if (this.isClosed()) {
      if (this.current.active) { this.current = Object.freeze({ active: false, tokens: this.current.tokens }); }
      return this.current;
    }
    if (!this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...names: string[]) => names.forEach((name) => used.add(this.models.declaredField(model, name)));
    field(this.self.base, "uuid");
    field(this.site, "styleTokens", "projectDependencies");
    const sites = [this.site, ...this.site.projectDependencies.map((dep) => { field(dep, "site"); return dep.site; })];
    for (const site of sites) {
      field(site, "styleTokens");
      for (const token of site.styleTokens) { field(token, "type", "uuid", "isRegistered"); }
    }
    // Keep filtering, order, duplicate direct entries and wrapper selection in
    // the existing collection algorithm. Do not build a parallel token map.
    const values = siteFinalColorTokens(this.site, { includeDeps: "direct" }).filter((token) => token.uuid !== this.self.uuid);
    const previousRows = this.current.tokens;
    const previousCommands = this.commands.get(previousRows) ?? [];
    const handles: FinalToken<StyleToken>[] = [];
    const reused = new Set<ColorTokenRow>();
    const rows = values.map((token, index) => {
      const ref = this.models.ref(token.base);
      const kind = token instanceof MutableToken ? "mutable" : token instanceof OverrideableToken ? "overrideable" : "immutable";
      const matches = (row: ColorTokenRow) => !reused.has(row) && row.token === ref && row.uuid === token.uuid && row.kind === kind;
      const atIndex = previousRows[index];
      const previous = atIndex && matches(atIndex) ? atIndex : previousRows.find(matches);
      if (previous) { reused.add(previous); }
      // Handles are opaque commands. Stable models keep their original wrapper
      // identity even when another token joins or moves in the picker.
      const command = previousCommands.find((item) => item.base === token.base && item.constructor === token.constructor) ?? token;
      handles.push(command);
      return previous && previous.token === ref && previous.uuid === token.uuid && previous.kind === kind
        ? previous : Object.freeze({ token: ref, uuid: token.uuid, kind });
    });
    if (!arrayEq(previousRows, rows)) {
      const captured = Object.freeze(rows);
      this.current = Object.freeze({ active: true, tokens: captured });
      this.commands.set(captured, handles);
    } else if (!this.commands.has(previousRows)) {
      this.commands.set(previousRows, handles);
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

  /** Materialize only matching captured command handles; no ModelRef resolve. */
  commandTokens(snapshot: ColorTokenCollectionSnapshot): FinalToken<StyleToken>[] {
    return snapshot.active && !this.isClosed() ? ensure(this.commands.get(snapshot.tokens), "Color command handles must match their captured rows") : [];
  }
  private subscribe(listener: (next: ColorTokenCollectionSnapshot, previous: ColorTokenCollectionSnapshot) => void) {
    if (this.isClosed()) { this.close(); return () => undefined; }
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

export function useStyleColorTokens(studio: StudioCtx, self: FinalToken<StyleToken>) {
  const source = React.useMemo(() => new StyleColorTokenInputs(studio, self), [studio, self]);
  const snapshot = useStore(source.store);
  return { snapshot, commands: source.commandTokens(snapshot) };
}
