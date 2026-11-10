import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import type { ObjInst } from "@/wab/shared/model/classes";
import type { ModelFieldRead } from "@/wab/client/stores/model-field-selector";

export type DeclareModelFields = (model: ObjInst, ...keys: string[]) => void;
type Watch = (store: ModelFieldStore<unknown> | ModelFieldInputs) => void;
interface Scope {
  readonly models: ModelSnapshots;
  readonly lifetime: AbortSignal;
  readonly isCurrent: () => boolean;
}
const empty: readonly unknown[] = Object.freeze([]);

/** Explicit field dependencies shared by catalog and expression projections.
 * All changed fields invalidate before publication; the first notification
 * captures the completed command and subsequent notifications reuse it. */
export class ModelFieldInputs {
  private current = empty;
  private published = empty;
  private dirty = true;
  private connected = false;
  private values = new Map<ModelFieldStore<unknown>, unknown>();
  private native = new Set<ModelFieldStore<unknown>>();
  private sources = new Map<ModelFieldStore<unknown>, ModelFieldInputs>();
  private readonly preparers = new Set<() => void>();
  private readonly bindings = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  readonly store: ModelFieldStore<readonly unknown[]> = {
    getState: () => this.read(),
    getInitialState: () => this.read(),
    subscribe: (listener) => {
      let previous = this.read();
      return this.subscribe(() => {
        const next = this.read(), before = previous;
        previous = next; listener(next, before);
      });
    },
  };

  constructor(
    private readonly scope: Scope,
    private readonly collect: (field: DeclareModelFields, watch: Watch, read: ModelFieldRead) => readonly unknown[] | void,
  ) {}

  isCurrent = () => !this.scope.lifetime.aborted && this.scope.isCurrent();
  invalidate = () => {
    if (this.dirty) { return; }
    this.dirty = true;
    this.preparers.forEach((prepare) => prepare());
  };
  refresh = () => { this.invalidate(); this.publish(); };
  private publish = () => {
    const next = this.read();
    if (next !== this.published) {
      this.published = next;
      this.listeners.forEach((listener) => listener());
    }
  };
  private disconnect = () => {
    this.connected = false;
    this.scope.lifetime.removeEventListener("abort", this.close);
    this.bindings.forEach((stop) => stop());
    this.bindings.clear();
  };
  private close = () => {
    this.disconnect();
    this.invalidate();
    this.current = empty;
    this.values.clear(); this.native.clear(); this.sources.clear();
    this.publish();
    this.listeners.clear();
    this.preparers.clear();
  };

  read = (): readonly unknown[] => {
    if (!this.isCurrent()) { return empty; }
    // Disconnected reads must notice edits without retaining subscriptions.
    if (!this.dirty && !this.connected) {
      for (const [store, value] of this.values) {
        if (!Object.is(store.getState(), value)) { this.dirty = true; break; }
      }
    }
    if (this.dirty) {
      const values = new Map<ModelFieldStore<unknown>, unknown>();
      const native = new Set<ModelFieldStore<unknown>>();
      const sources = new Map<ModelFieldStore<unknown>, ModelFieldInputs>();
      const watch: Watch = (input) => {
        const store = input instanceof ModelFieldInputs ? input.store : input;
        if (input instanceof ModelFieldInputs) { sources.set(store, input); }
        native.add(store); values.set(store, store.getState());
      };
      const extra = this.collect((model, ...keys) => keys.forEach((key) => {
        const store = this.scope.models.declaredField(model, key);
        values.set(store, store.getState());
      }), watch, (model, key) => {
        const store = this.scope.models.field(model, key), value = store.getState();
        values.set(store, value);
        return value;
      });
      const next = [...values.values(), ...(extra ?? [])];
      if (!arrayEq(this.current, next)) { this.current = Object.freeze(next); }
      this.values = values; this.native = native; this.sources = sources; this.dirty = false;
      if (this.connected) { this.bind(); }
    }
    return this.current;
  };

  private bind() {
    for (const store of this.values.keys()) {
      if (this.bindings.has(store)) { continue; }
      const source = this.sources.get(store);
      if (source) {
        source.preparers.add(this.invalidate);
        const stop = store.subscribe(this.publish);
        this.bindings.set(store, () => { source.preparers.delete(this.invalidate); stop(); });
      } else if (this.native.has(store)) {
        this.bindings.set(store, store.subscribe(() => {
          if (!Object.is(this.values.get(store), store.getState())) { this.refresh(); }
        }));
      } else {
        const prepare = this.scope.models.subscribePreparedField(store, this.invalidate);
        const stop = store.subscribe(this.publish);
        this.bindings.set(store, () => { prepare(); stop(); });
      }
    }
    for (const [store, stop] of this.bindings) {
      if (!this.values.has(store)) { stop(); this.bindings.delete(store); }
    }
  }

  subscribe = (listener: () => void) => {
    if (!this.isCurrent()) { return () => undefined; }
    // Check changes made while disconnected before taking the fast connected path.
    this.read();
    if (!this.listeners.size) { this.published = this.current; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.scope.lifetime.addEventListener("abort", this.close, { once: true });
      this.bind(); this.publish();
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
