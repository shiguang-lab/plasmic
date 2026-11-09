import clone from "clone";
import get from "dlv";
import React from "react";
import {
  proxy as createValtioProxy,
  ref as createValtioRef,
  getVersion as isValtioProxy,
  subscribe,
} from "valtio";
import { ensure } from "../common";
import { getStateCommandValue } from "./command-values";
import {
  CyclicStatesReferencesError,
  InvalidOperation,
  UnknownError,
} from "./errors";
import {
  StateSpecNode,
  buildTree,
  findStateCell,
  getSpecTreeLeaves,
  updateTree,
} from "./graph";
import { arrayEq, deepEqual, getStateCells, isNum, set } from "./helpers";
import {
  $State,
  DollarStateEnv,
  InitFunc,
  InitFuncEnv,
  Internal$State,
  NoUndefinedField,
  ObjectPath,
  PLASMIC_STATE_PROXY_SYMBOL,
  StateCell,
  StateInitializerDeclaration,
  UNINITIALIZED,
} from "./types";

function canProxy(value: any) {
  return typeof value === "object" && value != null;
}

export const proxyObjToStateCell = new WeakMap<
  object,
  Record<string | number | symbol, StateCell<any>>
>();
export const valtioSubscriptions = new WeakMap<
  object,
  ReturnType<typeof subscribe>[]
>();

// The command proxy owns the mutable engine; render readers subscribe to its
// values and capture a separate immutable view.
export const dollarStateStores = new WeakMap<$State, Internal$State>();

function ensureStateCell(
  target: any,
  property: string | number | symbol,
  path: ObjectPath,
  node: StateSpecNode<any>
) {
  if (!proxyObjToStateCell.has(target)) {
    proxyObjToStateCell.set(target, {});
  }
  const stateCell = proxyObjToStateCell.get(target)!;
  if (!(property in stateCell)) {
    stateCell[property as any] = {
      initialValue: UNINITIALIZED,
      path,
      node,
      initFunc: node.getSpec().initFunc,
      initFuncHash: node.getSpec().initFuncHash ?? "",
    };
  }
  return stateCell[property as any];
}

function getStateCell(target: any, property: string | number | symbol) {
  return proxyObjToStateCell.get(target)?.[property as any];
}

export function tryGetStateCellFrom$StateRoot(
  $state: $State,
  path: ObjectPath
) {
  if (path.length === 0) {
    throw new UnknownError("expected a path with length greater than 0");
  }
  const target = get($state, path.slice(0, -1));
  get(target, path.slice(-1)); // create state cell;
  return getStateCell(target, path.slice(-1)[0]);
}

export function getStateCellFrom$StateRoot($state: $State, path: ObjectPath) {
  return ensure(tryGetStateCellFrom$StateRoot($state, path));
}

export function unsubscribeToValtio(
  $$state: Internal$State,
  statePath: ObjectPath
) {
  const oldValue = get($$state.stateValues, statePath);
  if (isValtioProxy(oldValue)) {
    valtioSubscriptions.get(oldValue)?.forEach((f) => f());
    valtioSubscriptions.delete(oldValue);
  }
}

export function subscribeToValtio(
  $$state: Internal$State,
  statePath: ObjectPath,
  node: StateSpecNode<any>
) {
  const spec = node.getSpec();
  const maybeValtioProxy = spec.valueProp
    ? getStateCommandValue($$state.env.$props[spec.valueProp])
    : get($$state.stateValues, statePath);
  if (
    isValtioProxy(maybeValtioProxy) &&
    (spec.onChangeProp || (spec.onMutate && node.isLeaf()))
  ) {
    const unsub = subscribe(maybeValtioProxy, () => {
      if (spec.onMutate && node.isLeaf()) {
        spec.onMutate(
          maybeValtioProxy,
          spec.refName ? $$state.env.getRefs()[spec.refName] : undefined
        );
      }
      $$state.env.$props[spec.onChangeProp!]?.(
        spec.valueProp
          ? getStateCommandValue($$state.env.$props[spec.valueProp])
          : get($$state.stateValues, statePath)
      );
    });
    if (!valtioSubscriptions.has(maybeValtioProxy)) {
      valtioSubscriptions.set(maybeValtioProxy, []);
    }
    ensure(valtioSubscriptions.get(maybeValtioProxy)).push(unsub);
  }
}

function initializeStateValue(
  $$state: Internal$State,
  initialStateCell: StateCell<any>,
  proxyRoot: any
) {
  const initialStateName = initialStateCell.node.getSpec().path;
  $$state.stateInitializationEnv.visited.add(initialStateName);
  $$state.stateInitializationEnv.stack.push(initialStateName);
  const $state = create$StateProxy($$state, (internalStateCell) => ({
    get() {
      const spec = internalStateCell.node.getSpec();
      if ($$state.stateInitializationEnv.visited.has(spec.path)) {
        // cyclic reference found
        const stateAccessCycle: string[] = [spec.path];
        while ($$state.stateInitializationEnv.stack.length > 0) {
          const curr = $$state.stateInitializationEnv.stack.pop();
          if (!curr) {
            break;
          }
          stateAccessCycle.push(curr);
          if (curr === spec.path) {
            throw new CyclicStatesReferencesError(stateAccessCycle);
          }
        }
        throw new UnknownError("Internal error: cycle not found");
      }

      const stateCell = getStateCellFrom$StateRoot(
        proxyRoot,
        internalStateCell.path
      );
      if (spec.valueProp) {
        return $$state.env.$props[spec.valueProp];
      } else if (spec.initFunc && stateCell.initialValue === UNINITIALIZED) {
        return initializeStateValue($$state, stateCell, proxyRoot);
      }
      return get(proxyRoot, stateCell.path);
    },
    set() {
      throw new InvalidOperation(
        `Cannot update state values during initialization`
      );
    },
  }));

  const initialValue = invokeInitFunc(initialStateCell.initFunc!, {
    $state,
    ...(initialStateCell.overrideEnv ?? $$state.env),
  });
  installInitialStateValue(initialStateCell, proxyRoot, initialValue);

  $$state.stateInitializationEnv.visited.delete(initialStateName);
  $$state.stateInitializationEnv.stack.pop();

  return initialValue;
}

function installInitialStateValue(initialStateCell: StateCell<any>, proxyRoot: $State, initialValue: any) {
  const initialSpec = initialStateCell.node.getSpec();

  // Try to clone initialValue. It can fail if it's a PlasmicUndefinedDataProxy
  // and we still want to clear some states and return the initialValue.
  try {
    const clonedValue = clone(initialValue);
    initialStateCell.initialValue = clonedValue;

    const value = initialSpec.isImmutable
      ? mkUntrackedValue(initialValue)
      : clonedValue;
    set(proxyRoot, initialStateCell.path, value);
  } catch {
    // Setting the state to undefined to make sure it gets re-initialized
    // in case it changes values.
    initialStateCell.initialValue = undefined;
    set(proxyRoot, initialStateCell.path, undefined);
  }

}

function create$StateProxy(
  $$state: Internal$State,
  leafHandlers: (stateCell: StateCell<any>) => ProxyHandler<any>
) {
  let proxyRoot: any;
  const rec = (currPath: ObjectPath, currNode: StateSpecNode<any>) => {
    const getNextPath = (property: string | number | symbol) => [
      ...currPath,
      isNum(property) ? +property : (property as string),
    ];
    const spec = currNode.getSpec();
    const handlers: ProxyHandler<any> = {
      deleteProperty(target, property) {
        if (
          !currNode.isLeaf() &&
          !currNode.hasArrayTransition() &&
          !isNum(property)
        ) {
          throw new InvalidOperation(
            "Can't delete a property in the middle of the state spec"
          );
        }
        delete get($$state.stateValues, currPath)[property];
        if (spec.onChangeProp) {
          //we are always in a leaf, since we only have two cases:
          // 1 - delete properties outside the state tree
          // 2 - delete indices in repeated implicit states, but these can't be exposed, so they don't have onChangeProp
          $$state.env.$props[spec.onChangeProp]?.(
            get(proxyRoot, currPath.slice(spec.pathObj.length))
          );
        }
        return Reflect.deleteProperty(target, property);
      },
      get(target, property, receiver) {
        if (property === PLASMIC_STATE_PROXY_SYMBOL) {
          return {
            node: currNode,
            path: currPath,
          };
        }
        const nextPath = getNextPath(property);

        const nextNode = currNode.makeTransition(property);
        if (nextNode?.isLeaf()) {
          return leafHandlers(
            ensureStateCell(receiver, property, nextPath, nextNode)
          ).get?.(target, property, receiver);
        } else if (nextNode && !(property in target)) {
          target[property] = rec(nextPath, nextNode);
        }
        return Reflect.get(target, property, receiver);
      },
      set(target, property, value, receiver) {
        const nextPath = getNextPath(property);
        const nextNode = currNode.makeTransition(property);
        const nextSpec = nextNode?.getSpec();

        if (!nextNode && currNode.hasArrayTransition()) {
          set($$state.stateValues, nextPath, value);
          //array can set his own properties such as length, map, ...
          return Reflect.set(target, property, value, receiver);
        }
        if (nextNode?.isLeaf()) {
          leafHandlers(
            ensureStateCell(receiver, property, nextPath, nextNode)
          ).set?.(target, property, value, receiver);
          Reflect.set(target, property, value, receiver);
          if (nextSpec?.onChangeProp) {
            const pathKey = JSON.stringify(nextPath);
            const isInitOnChange =
              // If we are dealing with a valueProp it means that this state cell value is provided by the parent
              // and we don't need to consider initialization calls for it.
              !nextSpec.valueProp && !$$state.initializedLeafPaths.has(pathKey);

            // We need to call the onChangeProp during initialization process so that the parent
            // state can be updated with the correct value. We will provide an additional parameter
            // to the onChangeProp function to indicate that the call is made during initialization.
            $$state.env.$props[nextSpec.onChangeProp]?.(value, {
              _plasmic_state_init_: isInitOnChange,
            });

            if (isInitOnChange) {
              $$state.initializedLeafPaths.add(pathKey);
            }
          }
        }
        if (!nextNode) {
          if (!$$state.activeRender) {
            // A child's layout initializer can publish before its parent's first
            // schema commit. Preserve immediate reads; validate and replay the
            // write against the first schema that actually commits.
            set($$state.initialCommands, nextPath, value);
            return Reflect.set(target, property, value, receiver);
          }
          // Committed schemas continue rejecting unknown fields.
          return false;
        }
        if (canProxy(value) && !nextNode.isLeaf()) {
          target[property] = rec(nextPath, nextNode);
          Reflect.ownKeys(value).forEach((key) => {
            target[property][key] = value[key];
          });
        } else if (!nextNode.isLeaf()) {
          throw new InvalidOperation(
            "inserting a primitive value into a non-leaf"
          );
        }
        // Valtio 2 proxies its input in place. Mutable state owns a copy so
        // updates cannot change props or the saved initial value used by reset.
        const newValue =
          nextNode.isLeaf() && nextSpec?.isImmutable
            ? mkUntrackedValue(value)
            : canProxy(value) && !isValtioProxy(value)
            ? clone(value)
            : value;

        unsubscribeToValtio($$state, nextPath);
        set($$state.stateValues, nextPath, newValue);
        subscribeToValtio($$state, nextPath, nextNode);
        return true;
      },
    };
    const baseObject = currNode.hasArrayTransition() ? [] : {};
    const proxyObj = new Proxy(baseObject, handlers);
    if (currPath.length === 0) {
      proxyRoot = proxyObj;
    }
    return proxyObj;
  };

  return rec([], $$state.rootSpecTree);
}

const mkUntrackedValue = (o: any) =>
  o != null && typeof o === "object" ? createValtioRef(o) : o;

const emptyRefs = Object.freeze({});
const getEmptyRefs = () => emptyRefs;

const envFieldsAreNonNill = (
  env: DollarStateEnv
): NoUndefinedField<DollarStateEnv> => ({
  $props: env.$props,
  $ctx: env.$ctx ?? {},
  $queries: env.$queries ?? {},
  $q: env.$q ?? {},
  getRefs: env.getRefs ?? getEmptyRefs,
});


function invokeInitFunc<T>(
  initFunc: InitFunc<T>,
  env: NoUndefinedField<InitFuncEnv>
) {
  return initFunc(env);
}

function initFuncEnv(
  $$state: Internal$State,
  stateCell: StateCell<any>,
  $state: $State
): NoUndefinedField<InitFuncEnv> {
  const env = stateCell.overrideEnv ?? $$state.env;
  return { $state, $props: env.$props, $ctx: env.$ctx, $queries: env.$queries, $q: env.$q };
}


const MAX_UNSETTLED_RESETS = 5;

function warnUnstableInitFunc(stateCell: StateCell<any>, reason: string) {
  if (stateCell.warnedUnstableInitFunc) {
    return;
  }
  stateCell.warnedUnstableInitFunc = true;
  console.warn(
    `Plasmic: the initial value of state "${stateCell.path.join(
      "."
    )}" ${reason}, so it is kept at its current value instead of being reset. To set a random or time-based value, run an interaction from a Side Effect component instead.`
  );
}

/**
 * Whether `stateCell` should be reset to what `initFunc` now returns. An
 * initFunc that returns a new value every time it runs would reset on every
 * render, and each reset renders again, so the loop never ends. We refuse to
 * reset in two cases:
 *
 * - Two back-to-back calls disagree, indicating an unstable initializer.
 * - Too many resets occur without a settled evaluation. This also catches
 *   values that are stable within a render but drift between renders.
 *
 * This is a circuit breaker, not a proof of determinism: legitimate feedback
 * chains can also exceed the budget, and unstable functions can return equal
 * values by chance. Initializers must be pure and deterministic for fixed inputs.
 *
 * Rejected probes never change the installed initial value used by preview
 * reset. A rejected value that repeats on a later render can reopen the budget.
 */
function shouldReInitialize<T>(
  stateCell: StateCell<T>,
  initFunc: InitFunc<T>,
  env: NoUndefinedField<InitFuncEnv>
) {
  let newInit: T;
  let repeats: boolean;
  try {
    newInit = invokeInitFunc(initFunc, env);
    if (deepEqual(newInit, stateCell.initialValue)) {
      stateCell.unsettledResetCount = undefined;
      stateCell.rejectedInitProbe = undefined;
      return false;
    }
    repeats = deepEqual(invokeInitFunc(initFunc, env), newInit);
  } catch {
    // initFunc can throw, e.g. if it tries to access loading $queries. Swallow here
    // since we only care whether the init value changed, not error handling.
    return false;
  }
  let reason: string | undefined;
  if (!repeats) {
    reason = "is not deterministic";
  } else {
    const { rejectedInitProbe } = stateCell;
    const reopened =
      rejectedInitProbe && deepEqual(newInit, rejectedInitProbe.value);
    stateCell.unsettledResetCount = reopened
      ? 1
      : (stateCell.unsettledResetCount ?? 0) + 1;
    if (stateCell.unsettledResetCount > MAX_UNSETTLED_RESETS) {
      reason = "keeps changing";
    }
  }
  stateCell.rejectedInitProbe = reason ? { value: newInit } : undefined;
  if (reason) {
    warnUnstableInitFunc(stateCell, reason);
  }
  return !reason;
}

/** Validate the complete pre-commit command record before replaying any leaf. */
function collectInitialCommands(values: Record<PropertyKey, any>, tree: StateSpecNode<any>, path: ObjectPath = []): { path: ObjectPath; value: any }[] {
  if (tree.isLeaf()) { return [{ path, value: values }]; }
  if (!canProxy(values)) { throw new InvalidOperation("Inserting a primitive value into a non-leaf state"); }
  return Reflect.ownKeys(values).filter((key) => !(Array.isArray(values) && key === "length")).flatMap((key) => {
    const node = tree.makeTransition(key);
    if (!node) { throw new InvalidOperation(`Unknown state field during initial commit: ${[...path, String(key)].join(".")}`); }
    return collectInitialCommands(values[key], node, [...path, isNum(key) ? +key : String(key)]);
  });
}

function createDollarStateEngine() {
  const commandListeners = new Set<() => void>();
  const $$state: Internal$State = {
    rootSpecTree: buildTree([]),
    specTreeLeaves: [],
    stateValues: createValtioProxy({}),
    env: envFieldsAreNonNill({ $props: {} }),
    stateInitializationEnv: { stack: [], visited: new Set<string>() },
    initializedLeafPaths: new Set(),
    initialCommands: {},
    getCommands: () => $state,
    subscribeCommands(listener) { commandListeners.add(listener); return () => commandListeners.delete(listener); },
    applyInitializers(owner, declarations) {
      for (const declaration of declarations) { applyInitializer({ ...declaration, owner }); }
      resetInitializedCells();
      initializeDeclaredPaths(declarations);
    },
    releaseInitializers(owner) {
      for (const cell of getStateCells($state, $$state.rootSpecTree)) {
        if (cell.initializerOwner === owner) {
          cell.initializerOwner = undefined;
          cell.initFunc = cell.node.getSpec().initFunc;
          cell.overrideEnv = undefined;
          cell.pendingInit = undefined;
        }
      }
    },
    commit: (owner, env, specs, declarations, initialValues) => {
      $$state.activeRender = owner;
      $$state.env = envFieldsAreNonNill(env);
      const previousLeaves = $$state.specTreeLeaves;
      $$state.rootSpecTree = updateTree($$state.rootSpecTree, specs);
      $$state.specTreeLeaves = getSpecTreeLeaves($$state.rootSpecTree);
      const initialCommands = collectInitialCommands($$state.initialCommands, $$state.rootSpecTree);
      $$state.initialCommands = {};
      if (!arrayEq(previousLeaves, $$state.specTreeLeaves)) {
        const previous = $state;
        $state = create$State();
        for (const { path } of getStateCells(previous, $$state.rootSpecTree)) {
          const oldCell = tryGetStateCellFrom$StateRoot(previous, path);
          if (oldCell) {
            set($state, path, get(previous, path));
            const cell = getCellForRegistration($state, path);
            cell.initialValue = oldCell.initialValue;
            cell.initFunc = oldCell.initFunc;
            cell.overrideEnv = oldCell.overrideEnv;
            cell.initFuncHash = oldCell.initFuncHash;
          }
        }
      }
      for (const cell of getStateCells($state, $$state.rootSpecTree)) {
        const spec = cell.node.getSpec();
        if (cell.initFuncHash !== (spec.initFuncHash ?? "")) {
          cell.initFuncHash = spec.initFuncHash ?? "";
          cell.unsettledResetCount = undefined;
          cell.warnedUnstableInitFunc = undefined;
          cell.rejectedInitProbe = undefined;
        }
        if (!cell.initializerOwner) { cell.initFunc = spec.initFunc; }
      }
      for (const declaration of declarations) { applyInitializer({ ...declaration, owner: declaration.owner ?? owner }); }
      for (const initial of initialValues) {
        const cell = getCellForRegistration($state, initial.path);
        if (cell.initialValue === UNINITIALIZED && cell.initFunc === initial.initFunc && !cell.node.getSpec().valueProp) {
          cell.pendingInit = undefined;
          installInitialStateValue(cell, $state, initial.value);
        }
      }
      resetInitializedCells();
      initializeDeclaredPaths(declarations);
      for (const node of $$state.specTreeLeaves) {
        const spec = node.getSpec();
        if (!spec.isRepeated && spec.type !== "private") {
          getStateCellFrom$StateRoot($state, spec.pathObj as ObjectPath);
        }
      }
      for (const { path, value } of initialCommands) { set($state, path, value); }
      if (!arrayEq(previousLeaves, $$state.specTreeLeaves)) {
        commandListeners.forEach((listener) => listener());
      }
    },
  };

  function getCellForRegistration(commands: $State, path: ObjectPath) {
    const parent = get(commands, path.slice(0, -1));
    const { node } = parent[PLASMIC_STATE_PROXY_SYMBOL] as { node: StateSpecNode<any> };
    const property = path[path.length - 1];
    const next = ensure(node.makeTransition(property));
    return ensureStateCell(parent, property, path, next);
  }

  function applyInitializer(declaration: StateInitializerDeclaration) {
    const { realPath } = findStateCell($$state.rootSpecTree, declaration.path, declaration.repetitionIndex);
    const cell = getCellForRegistration($state, realPath);
    if (!declaration.initFunc) { return; }
    cell.pendingInit ||= !cell.initFunc;
    cell.initializerOwner = declaration.owner;
    cell.initFunc = declaration.initFunc;
    cell.overrideEnv = declaration.env ? envFieldsAreNonNill(declaration.env) : undefined;
  }

  function initializeDeclaredPaths(declarations: readonly StateInitializerDeclaration[]) {
    for (const declaration of declarations) {
      const { realPath } = findStateCell($$state.rootSpecTree, declaration.path, declaration.repetitionIndex);
      getStateCellFrom$StateRoot($state, realPath);
    }
  }

  function resetInitializedCells() {
    const cells = getStateCells($state, $$state.rootSpecTree).filter((cell) => cell.pendingInit ||
      (cell.initFunc && shouldReInitialize(cell, cell.initFunc, initFuncEnv($$state, cell, $state))));
    for (const cell of cells) {
      cell.pendingInit = undefined;
      const initial = initializeStateValue($$state, cell, $state);
      const spec = cell.node.getSpec();
      if (spec.onChangeProp) { $$state.env.$props[spec.onChangeProp]?.(initial); }
    }
  }

  function create$State(): $State {
    const commands = create$StateProxy($$state, (cell) => {
      const spec = cell.node.getSpec();
      if (cell.initialValue === UNINITIALIZED && cell.initFunc) {
        initializeStateValue($$state, cell, commands);
      } else if (cell.initialValue === UNINITIALIZED && !spec.valueProp) {
        cell.initialValue = spec.initVal;
        set(commands, cell.path, spec.initVal);
      }
      return { get() {
        const current = cell.node.getSpec();
        if (current.valueProp) {
          subscribeToValtio($$state, cell.path, cell.node);
          return getStateCommandValue($$state.env.$props[current.valueProp]);
        }
        return get($$state.stateValues, cell.path);
      } };
    });
    dollarStateStores.set(commands, $$state);
    return commands;
  }
  let $state = create$State();
  return $$state;
}

/** Create a command engine. Its render snapshot owns configuration and commits. */
export function useDollarState(): $State {
  const [engine] = React.useState(createDollarStateEngine);
  return React.useSyncExternalStore(engine.subscribeCommands, engine.getCommands, engine.getCommands);
}

export default useDollarState;
