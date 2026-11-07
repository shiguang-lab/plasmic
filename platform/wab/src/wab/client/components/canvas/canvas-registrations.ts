import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { assert, ensure } from "@/wab/shared/common";
import type { CustomFunctionId } from "@/wab/shared/core/query-ids";
import type { CodeLibraryRegistration } from "@/wab/shared/register-library";
import type { CustomFunctionRegistration } from "@plasmicapp/host";
import { cloneDeepWith, isEqual, isPlainObject } from "lodash";
import { createStore, StoreApi } from "zustand/vanilla";

type ComponentRegistration = ReturnType<CodeComponentsRegistry["getRegisteredComponentsAndContextsMap"]> extends Map<string, infer Registration> ? Registration : never;

/** Runtime handles retain their identity. The copied contract is comparison/UI data. */
export interface CanvasRegistration<T> {
  readonly runtime: T;
  readonly contract: unknown;
}

interface KeyInput<T> {
  readonly store: ModelFieldStore<T>;
  prepare(next: T): void;
  publish(): void;
  dispose(): void;
}

function keyInput<T>(initial: T): KeyInput<T> {
  let current = initial;
  let state: StoreApi<T> | undefined = createStore(() => current);
  const listeners = new Set<() => void>();
  let disposed = false;
  return {
    store: {
      getState: () => current,
      getInitialState: () => current,
      subscribe: (listener) => {
        if (disposed) { return () => undefined; }
        const stopState = ensure(state, "Live registration input must have a native store").subscribe(listener);
        const stop = () => { stopState(); listeners.delete(stop); };
        listeners.add(stop);
        return stop;
      },
    },
    prepare: (next) => { current = next; },
    publish: () => { if (!disposed) { ensure(state, "Live registration input must have a native store").setState(() => current, true); } },
    dispose: () => { disposed = true; listeners.forEach((stop) => stop()); listeners.clear(); state = undefined; },
  };
}

function contractSnapshot(meta: unknown) {
  const copy = cloneDeepWith(meta, (value) => {
    // Class instances, React elements and functions are runtime handles. Only
    // registration metadata's plain containers belong to the copied contract.
    if (typeof value === "function" || value && typeof value === "object" &&
        (!Array.isArray(value) && !isPlainObject(value) || "$$typeof" in value)) {
      return value;
    }
    return undefined;
  });
  const seen = new Set<object>();
  const freeze = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value) ||
        !Array.isArray(value) && (!isPlainObject(value) || "$$typeof" in value)) { return; }
    seen.add(value);
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(copy);
  return copy;
}

/** One frame's demanded registration keys. Refresh installs every key before notifying. */
export class CanvasRegistrations {
  private registry: CodeComponentsRegistry | undefined;
  private readonly components = new Map<string, KeyInput<CanvasRegistration<ComponentRegistration> | undefined>>();
  private readonly functions = new Map<CustomFunctionId, KeyInput<CanvasRegistration<CustomFunctionRegistration> | undefined>>();
  private readonly libraries = new Map<string, KeyInput<CanvasRegistration<CodeLibraryRegistration> | undefined>>();
  private readonly loading = keyInput(false);
  private readonly libraryNames = keyInput<readonly string[]>(Object.freeze([]));
  private pending = 0;
  private disposed = false;
  private readonly refreshListeners = new Set<() => (() => void)>();
  readonly loadingStore = this.loading.store;
  readonly libraryNamesStore = this.libraryNames.store;

  get pendingCount() { return this.pending; }

  /** Derived runtime inputs install after keys and publish after key notifications. */
  subscribeBeforePublish(listener: () => (() => void)) {
    this.refreshListeners.add(listener);
    return () => { this.refreshListeners.delete(listener); };
  }

  begin() {
    assert(!this.disposed, "Cannot load registrations for a disposed frame");
    this.pending++;
    this.loading.prepare(true); this.loading.publish();
  }

  end() {
    assert(this.pending > 0, "Canvas registration loads must finish exactly once");
    this.pending--;
    if (!this.disposed) {
      this.loading.prepare(this.pending !== 0); this.loading.publish();
    }
  }

  install(registry: CodeComponentsRegistry) {
    assert(!this.disposed, "Cannot install registrations for a disposed frame");
    this.registry = registry;
    this.refresh();
  }

  component(name: string) {
    return this.demand(this.components, name, this.registry?.getRegisteredComponentsAndContextsMap().get(name), (value) => value.impl);
  }

  function(id: CustomFunctionId) {
    return this.demand(this.functions, id, this.registry?.getRegisteredFunctionsMap().get(id), (value) => value.function);
  }

  library(name: string) {
    return this.demand(this.libraries, name, this.registry?.getRegisteredLibrariesMap().get(name), (value) => value.lib);
  }

  private capture<T extends { meta: unknown }>(previous: CanvasRegistration<T> | undefined, runtime: T | undefined, handle: (value: T) => unknown): CanvasRegistration<T> | undefined {
    if (!runtime) { return undefined; }
    const contract = contractSnapshot(runtime.meta);
    return previous && Object.is(handle(previous.runtime), handle(runtime)) && isEqual(previous.contract, contract)
      ? previous : Object.freeze({ runtime: Object.freeze({ ...runtime }), contract });
  }

  private demand<T extends { meta: unknown }, K extends string>(inputs: Map<K, KeyInput<CanvasRegistration<T> | undefined>>, key: K, value: T | undefined, handle: (value: T) => unknown) {
    assert(!this.disposed, "Cannot subscribe to disposed canvas registrations");
    let input = inputs.get(key);
    if (!input) {
      input = keyInput(this.capture(undefined, value, handle));
      inputs.set(key, input);
    }
    return input.store;
  }

  refresh() {
    if (this.disposed || !this.registry) { return; }
    const components = this.registry.getRegisteredComponentsAndContextsMap();
    const functions = this.registry.getRegisteredFunctionsMap();
    const libraries = this.registry.getRegisteredLibrariesMap();
    for (const [name, input] of this.components) {
      input.prepare(this.capture(input.store.getState(), components.get(name), (value) => value.impl));
    }
    for (const [id, input] of this.functions) {
      input.prepare(this.capture(input.store.getState(), functions.get(id), (value) => value.function));
    }
    for (const [name, input] of this.libraries) {
      input.prepare(this.capture(input.store.getState(), libraries.get(name), (value) => value.lib));
    }
    const names = [...libraries.keys()];
    if (!isEqual(names, this.libraryNames.store.getState())) { this.libraryNames.prepare(Object.freeze(names)); }
    const publishDerived = [...this.refreshListeners].map((prepare) => prepare());
    this.components.forEach((input) => input.publish());
    this.functions.forEach((input) => input.publish());
    this.libraries.forEach((input) => input.publish());
    this.libraryNames.publish();
    publishDerived.forEach((publish) => publish());
  }

  dispose() {
    this.disposed = true;
    this.registry = undefined;
    this.refreshListeners.clear();
    for (const inputs of [this.components, this.functions, this.libraries]) {
      inputs.forEach((input) => { input.prepare(undefined); input.dispose(); }); inputs.clear();
    }
    this.loading.prepare(false); this.loading.dispose();
    this.libraryNames.prepare(Object.freeze([])); this.libraryNames.dispose();
  }
}
