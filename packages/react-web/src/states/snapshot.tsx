import get from "dlv";
import * as React from "react";
import { getVersion, snapshot, subscribe } from "valtio";
import { ensure } from "../common";
import { useIsomorphicLayoutEffect } from "../react-utils";
import { CyclicStatesReferencesError, InvalidOperation } from "./errors";
import { buildTree, StateSpecNode } from "./graph";
import { getStateCells, isNum } from "./helpers";
import { $State, $StateSpec, DollarStateEnv, InitFuncEnv, Internal$State, NoUndefinedField, ObjectPath, StateInitialValue, StateInitializerDeclaration } from "./types";
import { dollarStateStores, getStateCellFrom$StateRoot } from "./valtio";

import { bindCommands, commandValues } from "./command-values";

function captureValue(value: any, seen = new WeakMap<object, any>()): any {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (getVersion(value)) {
    return snapshot(value);
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  // State data is copied; opaque values such as React elements retain their
  // existing immutable prop contract.
  if (React.isValidElement(value) || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) {
    return value;
  }
  const copy: any = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) {
    copy[key] = captureValue(value[key], seen);
  }
  return Object.freeze(copy);
}

const renderSources = new WeakMap<object, StateRenderSnapshot>();

/** A render owns its values, environment and spec tree. Lazy repeated branches
 * can be read before their initializers are registered, without reading live
 * command state or changing the values of an older render. */
class StateRenderSnapshot {
  readonly value: Readonly<$State>;
  private readonly readPaths = new Map<string, ObjectPath>();
  private readonly initialValues = new Map<string, StateInitialValue>();
  private committed = false;
  private readonly initializerLeases = new Map<object, readonly StateInitializerDeclaration[]>();

  constructor(private readonly store: Internal$State, values: object, private readonly sourceEnv: DollarStateEnv, private readonly specs: $StateSpec<any>[]) {
    const commands = store.getCommands();
    const tree = buildTree(specs);
    const captureRecord = (record: Record<string, any> = {}) => {
      const captured = Object.freeze(Object.fromEntries(Object.entries(record).map(([name, value]) => [
        name, value && typeof value === "object" && getVersion(value) ? snapshot(value) : value,
      ])));
      commandValues.set(captured, () => record);
      return captured;
    };
    const env: Omit<NoUndefinedField<InitFuncEnv>, "$state"> = {
      $props: captureRecord(sourceEnv.$props),
      $ctx: captureRecord(sourceEnv.$ctx),
      $queries: captureRecord(sourceEnv.$queries),
      $q: captureRecord(sourceEnv.$q),
    };
    bindCommands(values, () => store.stateValues, store.stateValues);
    const cells = new Map(getStateCells(commands, store.rootSpecTree).map((cell) => [
      JSON.stringify(cell.path),
      { initFunc: cell.initFunc, overrideEnv: cell.overrideEnv },
    ]));
    const reading: string[] = [];
    const immutable = () => { throw new InvalidOperation("Cannot mutate a render state snapshot"); };
    const read = (path: ObjectPath, node: StateSpecNode<any>): any => {
      if (node.isLeaf()) {
        const key = JSON.stringify(path);
        this.readPaths.set(key, path);
        const spec = node.getSpec();
        const valueProp = spec.valueProp;
        if (valueProp) {
          const source = env.$props[valueProp];
          const value = captureValue(source);
          bindCommands(value, () => sourceEnv.$props[valueProp], sourceEnv.$props[valueProp]);
          return value;
        }
        const parent = get(values, path.slice(0, -1));
        if (parent && Object.prototype.hasOwnProperty.call(parent, path[path.length - 1])) {
          return get(values, path);
        }
        if (reading.includes(key)) {
          throw new CyclicStatesReferencesError([...reading, key]);
        }
        reading.push(key);
        try {
          const cell = cells.get(key);
          const init = cell?.initFunc ?? spec.initFunc;
          const override = cell?.overrideEnv;
          const initEnv = override ? { ...env, ...override } : env;
          const value = captureValue(init ? init({ ...initEnv, $state: this.value }) : spec.initVal);
          bindCommands(value, () => get(commands, path), undefined);
          this.initialValues.set(key, { path, value, initFunc: init });
          return value;
        } finally {
          reading.pop();
        }
      }
      const source = get(values, path);
      const target = node.hasArrayTransition() ? new Array(source?.length ?? 0) : {};
      const children = new Map<PropertyKey, any>();
      const proxy = new Proxy(target, {
        get: (object, key, receiver) => {
          const next = node.makeTransition(key);
          if (!next) { return Reflect.get(object, key, receiver); }
          if (!children.has(key)) {
            children.set(key, read([...path, isNum(key) ? +key : key as string], next));
          }
          return children.get(key);
        },
        has: (object, key) => !!node.makeTransition(key) || Reflect.has(object, key),
        ownKeys: () => [...new Set([
          ...Reflect.ownKeys(target),
          ...Object.keys(source ?? {}),
          ...[...node.edges().keys()].filter((key): key is string => typeof key === "string"),
        ])],
        getOwnPropertyDescriptor: (object, key) => Reflect.getOwnPropertyDescriptor(object, key) ??
          (node.makeTransition(key) ? { enumerable: true, configurable: true } : undefined),
        set: immutable,
        deleteProperty: immutable,
        defineProperty: immutable,
      });
      commandValues.set(proxy, () => path.length ? get(store.getCommands(), path) : store.getCommands());
      return proxy;
    };
    this.value = read([], tree);
    commandValues.set(this.value, store.getCommands);
    renderSources.set(this.value, this);
  }

  retainInitializers(owner: object, declarations: readonly StateInitializerDeclaration[]) {
    this.initializerLeases.set(owner, declarations);
    if (this.store.activeRender === this) {
      this.store.applyInitializers(owner, declarations);
    }
  }

  releaseInitializers(owner: object) {
    this.initializerLeases.delete(owner);
    this.store.releaseInitializers(owner);
  }

  moveInitializers(owner: object) {
    this.initializerLeases.delete(owner);
  }

  get engine() { return this.store; }

  get isRetired() { return this.committed && this.store.activeRender !== this; }

  initialize() {
    const declarations = [...this.initializerLeases].flatMap(([owner, entries]) => entries.map((entry) => ({ ...entry, owner })));
    this.store.commit(this, this.sourceEnv, this.specs, declarations, [...this.initialValues.values()]);
    this.committed = true;
    const commands = this.store.getCommands();
    // Only a committed render creates cells. Suspended or abandoned renders
    // cannot initialize command state or register a different environment.
    for (const path of this.readPaths.values()) {
      getStateCellFrom$StateRoot(commands, path);
    }
    for (const { path, value } of this.initialValues.values()) {
      const source = get(commands, path);
      bindCommands(value, () => source, source);
    }
    this.initialValues.clear();
  }
}

class StateSnapshotSubscription {
  private readonly controlled: object[];
  private versions?: (number | undefined)[];
  private render?: StateRenderSnapshot;

  constructor(private store: Internal$State, private env: DollarStateEnv, private specs: $StateSpec<any>[]) {
    this.controlled = [...new Set(specs.flatMap((spec) => {
      const prop = spec.valueProp;
      const value = prop ? env.$props[prop] : undefined;
      return value && typeof value === "object" && getVersion(value) ? [value] : [];
    }))];
  }

  subscribe = (notify: () => void) => {
    const cleanups = [this.store.stateValues, ...this.controlled].map((value) => subscribe(value, notify, true));
    return () => cleanups.forEach((cleanup) => cleanup());
  };

  getSnapshot = () => {
    const versions = [this.store.stateValues, ...this.controlled].map((value) => getVersion(value));
    if (!this.render || !this.versions || versions.some((version, index) => version !== this.versions?.[index])) {
      this.versions = versions;
      this.render = new StateRenderSnapshot(this.store, snapshot(this.store.stateValues), this.env, this.specs);
    }
    return this.render;
  };
}

/** Read-only render data. Keep useDollarState's proxy for event commands and
 * initializer registration, including reads after an event writes a value. */
function useStateRenderSnapshot(commands: $State, renderEnv: DollarStateEnv, specs: $StateSpec<any>[]) {
  const store = ensure(dollarStateStores.get(commands));
  const binding = React.useMemo(() => new StateSnapshotSubscription(store, renderEnv, specs), [store, renderEnv, specs]);
  return React.useSyncExternalStore(binding.subscribe, binding.getSnapshot, binding.getSnapshot);
}

export function useDollarStateSnapshot(commands: $State, renderEnv: DollarStateEnv, specs: $StateSpec<any>[]): Readonly<$State> {
  const render = useStateRenderSnapshot(commands, renderEnv, specs);
  useIsomorphicLayoutEffect(() => { render.initialize(); });
  return render.value;
}

/** Queries need a read view before their own results exist. The final state
 * view commits the complete environment after those query fibers render. */
export function useDollarStateQueryInput(commands: $State, renderEnv: DollarStateEnv, specs: $StateSpec<any>[]): Readonly<$State> {
  return useStateRenderSnapshot(commands, renderEnv, specs).value;
}

class StateInitializerLease {
  private source?: StateRenderSnapshot;

  update(source: StateRenderSnapshot, declarations: readonly StateInitializerDeclaration[]) {
    if (source.isRetired) { return; }
    if (this.source && this.source !== source) {
      this.source.moveInitializers(this);
      if (this.source.engine !== source.engine) { this.source.releaseInitializers(this); }
    }
    this.source = source;
    source.retainInitializers(this, declarations);
  }

  dispose() {
    this.source?.releaseInitializers(this);
    this.source = undefined;
  }
}

/** A render callback can update on its own fiber. Its initializer declarations
 * take effect only when that fiber commits, against the still-current owner. */
export function StateInitializer({ state, initializers, children }: {
  state: Readonly<$State>;
  initializers: readonly StateInitializerDeclaration[];
  children?: React.ReactNode;
}) {
  const source = ensure(renderSources.get(state));
  const [lease] = React.useState(() => new StateInitializerLease());
  useIsomorphicLayoutEffect(() => { lease.update(source, initializers); });
  useIsomorphicLayoutEffect(() => () => lease.dispose(), [lease]);
  return children;
}
