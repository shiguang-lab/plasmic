import { StateSpecNode } from "./graph";

export type InitFuncEnv = {
  $props: Record<string, any>;
  $state: Record<string, any>;
  $queries?: Record<string, any>;
  $q?: Record<string, any>;
  $ctx?: Record<string, any>;
};

export type DollarStateEnv = Omit<InitFuncEnv, "$state"> & {
  /** Resolve imperative commands only when an onMutate callback runs. */
  getRefs?: () => Readonly<Record<string, any>>;
};

export type NoUndefinedField<T> = { [P in keyof T]-?: T[P] };

export type InitFunc<T> = (env: NoUndefinedField<InitFuncEnv>) => T;

export type ObjectPath = (string | number)[];

export interface $StateSpec<T> {
  // path of the state, like `count` or `list.selectedIndex`
  path: string;
  // if initial value is defined by a js expression
  initFunc?: InitFunc<T>;
  // if initial value is a hard-coded value
  initVal?: T;
  // Whether this state is private, readonly, or writable in
  // this component
  type: "private" | "readonly" | "writable";

  // If writable, there should be a valueProp that maps props[valueProp]
  // to the value of the state
  valueProp?: string;

  // If writable or readonly, there should be an onChangeProp where
  // props[onChangeProp] is invoked whenever the value changes
  onChangeProp?: string;

  isImmutable?: boolean;

  variableType:
    | "text"
    | "number"
    | "boolean"
    | "array"
    | "object"
    | "variant"
    | "dateString"
    | "dateRangeStrings";

  // Hash used to re-create the state
  // This is only used in canvas where the state specs are dynamic
  initFuncHash?: string;

  refName?: string;
  onMutate?: (stateValue: T, $ref: any) => void;
}

export interface $State {
  [key: string]: any;

}

export const ARRAY_SYMBOL = Symbol("[]");
export const PLASMIC_STATE_PROXY_SYMBOL = Symbol("plasmic.state.proxy");
export const UNINITIALIZED = Symbol("plasmic.unitialized");

export interface Internal$StateSpec<T> extends $StateSpec<T> {
  isRepeated: boolean;
  pathObj: (string | symbol)[];
}

export interface Internal$StateInstance {
  path: ObjectPath; // ["counter", 0, "count"]
  specKey: string;
}

export interface StateCell<T> {
  initialValue?: T | symbol;
  node: StateSpecNode<any>;
  path: ObjectPath;
  initFunc?: InitFunc<T>;
  initFuncHash: string;
  overrideEnv?: NoUndefinedField<DollarStateEnv>;
  // Registered but not yet applied by the layout effect.
  pendingInit?: boolean;
  initializerOwner?: object;
  // Resets that happened back to back without the value ever settling; used
  // to stop a runaway re-initialization loop. See shouldReInitialize().
  unsettledResetCount?: number;
  rejectedInitProbe?: { value: T };
  warnedUnstableInitFunc?: boolean;
}

export interface StateInitialValue {
  readonly path: ObjectPath;
  readonly value: any;
  readonly initFunc: InitFunc<any> | undefined;
}

export interface StateInitializerDeclaration {
  readonly path: string;
  readonly initFunc?: InitFunc<any>;
  readonly repetitionIndex?: number[];
  readonly env?: DollarStateEnv;
  readonly owner?: object;
}

export interface Internal$State {
  getCommands(): $State;
  subscribeCommands(listener: () => void): () => void;
  activeRender?: object;
  /** Child layout initialization may publish before this owner first commits. */
  initialCommands: Record<string | number | symbol, any>;
  commit(owner: object, env: DollarStateEnv, specs: $StateSpec<any>[], declarations: readonly StateInitializerDeclaration[], initialValues: readonly StateInitialValue[]): void;
  applyInitializers(owner: object, declarations: readonly StateInitializerDeclaration[]): void;
  releaseInitializers(owner: object): void;
  stateValues: Record<string, any>;
  env: NoUndefinedField<DollarStateEnv>;
  rootSpecTree: StateSpecNode<any>;
  specTreeLeaves: StateSpecNode<any>[];
  stateInitializationEnv: {
    stack: string[];
    visited: Set<string>;
  };
  initializedLeafPaths: Set<string>;
}
