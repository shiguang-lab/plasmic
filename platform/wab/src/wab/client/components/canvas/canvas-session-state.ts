import { cloneDeep, isEqual } from "lodash";
import { createStore, StoreApi } from "zustand/vanilla";
import { ensure } from "@/wab/shared/common";

interface Entry {
  nativeValue: unknown;
  initialValue: unknown;
  value: unknown;
  revealInput?: unknown;
  hasRevealInput: boolean;
  revealed: boolean;
  beforeReveal?: unknown;
  initialized: boolean;
  locked?: boolean;
  sourceChanged?: boolean;
}

const sourceValue = (entry: Pick<Entry, "nativeValue" | "initialValue">) =>
  entry.nativeValue !== undefined ? entry.nativeValue : entry.initialValue;

/** Transient state belongs to a rendered instance in one artboard, never the Site. */
export interface CanvasSessionValue {
  readonly value: unknown;
  readonly runtimeValue: unknown;
  readonly revealed: boolean;
}

export type CanvasSessionSnapshot = Readonly<Record<string, CanvasSessionValue>>;
export type CanvasSessionStore = Pick<StoreApi<CanvasSessionSnapshot>, "getState" | "getInitialState" | "subscribe">;

interface SessionResource {
  readonly entries: Readonly<Record<string, Entry>>;
  readonly values: CanvasSessionSnapshot;
}
interface InstanceResource {
  readonly state: StoreApi<SessionResource>;
  readonly store: CanvasSessionStore;
}

export class CanvasSessionState {
  private instances = new Map<string, InstanceResource>();
  private listeners = new Set<(instance: string) => (() => void) | void>();
  readonly revealsStore = createStore<boolean>(() => false);
  private shownCount = 0;

  private isShown(entry: Entry | undefined) {
    return !!entry && entry.revealed && entry.value !== false && !isEqual(entry.value, sourceValue(entry));
  }

  private updateShown(previous: Entry | undefined, next: Entry) {
    this.shownCount += Number(this.isShown(next)) - Number(this.isShown(previous));
    const hasReveals = this.shownCount > 0;
    if (this.revealsStore.getState() !== hasReveals) {
      this.revealsStore.setState(hasReveals, true);
    }
  }

  /** Stable shallow readonly runtime views for exactly one rendered instance. */
  instanceStore(instance: string): CanvasSessionStore {
    return this.instanceResource(instance).store;
  }

  /** Invalidate before publication; an optional returned callback runs afterward. */
  subscribeToChanges(listener: (instance: string) => (() => void) | void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private instanceResource(instance: string): InstanceResource {
    let resource = this.instances.get(instance);
    if (!resource) {
      const state = createStore<SessionResource>(() => ({ entries: Object.freeze({}), values: Object.freeze({}) }));
      resource = {
        state,
        store: {
          getState: () => state.getState().values,
          getInitialState: () => state.getInitialState().values,
          subscribe: (listener) => state.subscribe((next, previous) => {
            if (next.values !== previous.values) {
              listener(next.values, previous.values);
            }
          }),
        },
      };
      this.instances.set(instance, resource);
    }
    return resource;
  }

  private entry(instance: string, name: string) {
    return this.instances.get(instance)?.state.getState().entries[name];
  }

  private write(instance: string, name: string, entry: Entry) {
    const resource = this.instanceResource(instance);
    const current = resource.state.getState();
    if (isEqual(current.entries[name], entry)) {
      return;
    }
    const entries = Object.freeze({ ...current.entries, [name]: Object.freeze(entry) });
    const previous = current.values[name];
    const runtimeValue = entry.revealed ? entry.beforeReveal : entry.value;
    if (previous && isEqual(previous.value, entry.value) &&
        isEqual(previous.runtimeValue, runtimeValue) && previous.revealed === entry.revealed) {
      resource.state.setState({ entries, values: current.values }, true);
      this.updateShown(current.entries[name], entry);
      return;
    }
    const next = Object.freeze({ value: entry.value, runtimeValue, revealed: entry.revealed });
    // Invalidate the instance's cached render before its React subscribers run.
    const notify = [...this.listeners].map((listener) => listener(instance));
    resource.state.setState({ entries, values: Object.freeze({ ...current.values, [name]: next }) }, true);
    this.updateShown(current.entries[name], entry);
    notify.forEach((afterPublish) => afterPublish?.());
  }

  resolve(instance: string, name: string, nativeValue: unknown, initialValue?: unknown) {
    let entry = this.entry(instance, name);
    if (entry && !entry.initialized) {
      entry = {
        ...entry, nativeValue: cloneDeep(nativeValue), initialValue: cloneDeep(initialValue),
        beforeReveal: cloneDeep(nativeValue !== undefined ? nativeValue : initialValue), initialized: true,
      };
      this.write(instance, name, entry);
    }
    if (!entry || !isEqual(entry.nativeValue, nativeValue) || !isEqual(entry.initialValue, initialValue)) {
      entry = {
        nativeValue: cloneDeep(nativeValue), initialValue: cloneDeep(initialValue),
        value: cloneDeep(nativeValue !== undefined ? nativeValue : initialValue), revealInput: entry?.revealInput,
        hasRevealInput: entry?.hasRevealInput ?? false, revealed: false, initialized: true,
        sourceChanged: !!entry,
      };
      this.write(instance, name, entry);
    } else if (entry.sourceChanged) {
      entry = { ...entry, sourceChanged: false };
      this.write(instance, name, entry);
    }
    return entry.value;
  }

  reveal(instance: string, name: string, value: unknown) {
    const entry = ensure(this.entry(instance, name), `Canvas state ${name} was not initialized`);
    if (entry.locked) {
      return entry.value;
    }
    if (entry.sourceChanged) {
      this.write(instance, name, { ...entry, revealInput: cloneDeep(value), hasRevealInput: true, sourceChanged: false });
      return entry.value;
    }
    if (!entry.hasRevealInput || !isEqual(entry.revealInput, value)) {
      const releasing = isEqual(value, sourceValue(entry));
      this.write(instance, name, {
        ...entry,
        value: releasing && entry.revealed ? entry.beforeReveal : cloneDeep(value),
        beforeReveal: releasing ? undefined : entry.revealed ? entry.beforeReveal : entry.value,
        revealInput: cloneDeep(value), hasRevealInput: true, revealed: !releasing,
      });
    }
    return this.entry(instance, name)?.value;
  }

  set(instance: string, name: string, value: unknown, revealed = false) {
    const entry = this.entry(instance, name);
    if (!entry) {
      this.write(instance, name, { nativeValue: undefined, initialValue: undefined, value: cloneDeep(value),
        hasRevealInput: false, revealed, initialized: false, locked: revealed });
      return;
    }
    if (!isEqual(entry.value, value) || entry.revealed !== revealed) {
      this.write(instance, name, { ...entry, value: cloneDeep(value), revealed, locked: revealed,
        beforeReveal: revealed ? entry.revealed ? entry.beforeReveal : entry.value : undefined });
    }
  }

  get(instance: string, name: string) {
    return this.entry(instance, name)?.value;
  }

  getRuntime(instance: string, name: string) {
    const entry = this.entry(instance, name);
    return entry?.revealed ? entry.beforeReveal : entry?.value;
  }

  setRuntime(instance: string, name: string, value: unknown) {
    const entry = this.entry(instance, name);
    if (entry?.revealed) {
      if (!isEqual(entry.beforeReveal, value)) {
        this.write(instance, name, { ...entry, beforeReveal: cloneDeep(value) });
      }
    } else {
      this.set(instance, name, value);
    }
  }

  has(instance: string, name: string) {
    return !!this.entry(instance, name);
  }

  get hasReveals() {
    return this.revealsStore.getState();
  }

  hideReveals() {
    for (const [instance, resource] of this.instances) {
      for (const [name, entry] of Object.entries(resource.state.getState().entries)) {
        if (entry.revealed && entry.value !== false && !isEqual(entry.value, sourceValue(entry))) {
          this.write(instance, name, { ...entry, value: entry.beforeReveal, revealed: false, beforeReveal: undefined });
        }
      }
    }
  }

  clear() {
    this.shownCount = 0;
    this.revealsStore.setState(false, true);
    for (const [instance, resource] of this.instances) {
      if (Object.keys(resource.state.getState().entries).length === 0) {
        continue;
      }
      const notify = [...this.listeners].map((listener) => listener(instance));
      resource.state.setState({ entries: Object.freeze({}), values: Object.freeze({}) }, true);
      notify.forEach((afterPublish) => afterPublish?.());
    }
  }

  dispose() {
    this.clear();
    this.listeners.clear();
    this.instances.clear();
  }
}

export interface CanvasStateSpec {
  valueProp: string;
  onChangeProp?: string;
  initialValueProp?: string;
  controlled: boolean;
  onChangeArgsToValue?: (...args: any[]) => unknown;
}

export function canvasSessionInstanceKey(instance: string, renderSlotInstance?: string) {
  return renderSlotInstance ? JSON.stringify([instance, renderSlotInstance]) : instance;
}

/** Bind the actual registered props/events; no component names or persisted schema. */
export function applyCanvasSessionState(
  session: CanvasSessionState,
  instance: string,
  props: Record<string, any>,
  specs: CanvasStateSpec[],
  interactive: boolean,
  onChange: () => void,
  isOverlay = false,
  sourceProps: Record<string, any> = props,
) {
  const authoredProps = { ...sourceProps };
  // The canvas overlay contract also applies when no implicit open state exists.
  // Eagerly bind it so native events invalidate the cached canvas render.
  if (isOverlay && !specs.some((spec) => spec.valueProp === "open")) {
    specs = [...specs, {
      valueProp: "open", onChangeProp: "onOpenChange", initialValueProp: "defaultOpen",
      controlled: authoredProps.open !== undefined,
    }];
  }
  const nativeProps = { ...props };
  // Generated implicit-state props may be shared by render-slot clones. Native
  // uncontrolled instances initialize from authored props, not another clone's event.
  const stateSource = (spec: CanvasStateSpec) => spec.controlled ? nativeProps : authoredProps;
  const read = (name: string) => session.get(instance, name);
  const bindings: Record<string, { value: unknown; readonly revealed: boolean; reveal: (value: unknown) => unknown }> = {};
  const events = new Map<string, CanvasStateSpec[]>();
  for (const spec of specs) {
    const { valueProp, onChangeProp, initialValueProp } = spec;
    const source = stateSource(spec);
    const nativeValue = source[valueProp];
    const initialValue = initialValueProp ? source[initialValueProp] : undefined;
    session.resolve(instance, valueProp, nativeValue, initialValue);
    const value = read(valueProp);
    props[valueProp] = value;
    bindings[valueProp] = {
      value,
      get revealed() { return session.instanceStore(instance).getState()[valueProp]?.revealed ?? false; },
      reveal: (next) => session.reveal(instance, valueProp, next),
    };
    if (onChangeProp) {
      const states = events.get(onChangeProp) ?? [];
      states.push(spec);
      events.set(onChangeProp, states);
    }
  }
  for (const [event, states] of events) {
    const handler = nativeProps[event];
    props[event] = (...args: any[]) => {
      for (const spec of states) {
        const { valueProp, initialValueProp } = spec;
        const source = stateSource(spec);
        const nativeValue = source[valueProp];
        const initialValue = initialValueProp ? source[initialValueProp] : undefined;
        // Explicit controlled bindings retain ownership when an actual event runs.
        // Editing reveals and mode switches never call the business handler.
        const overlayOpen = isOverlay && valueProp === "open";
        const next = (interactive || overlayOpen) && spec.controlled
          ? nativeValue !== undefined ? nativeValue : initialValue
          : spec.onChangeArgsToValue ? spec.onChangeArgsToValue(...args) : args[0];
        // A delayed native close can finish after entering editing mode. Keep
        // its runtime value separate from the content revealed for editing.
        if (!interactive && overlayOpen) {
          session.setRuntime(instance, valueProp, next);
        } else {
          session.set(instance, valueProp, next);
        }
      }
      onChange();
      return interactive ? handler?.(...args) : undefined;
    };
  }
  const selection = props.__canvas ?? (props.__canvas = {});
  selection.instance = instance;
  selection.getState = (name: string, nativeValue: unknown, initialValue?: unknown) => {
    const spec = specs.find((item) => item.valueProp === name);
    const source = spec ? stateSource(spec)[name] : nativeValue;
    const initial = spec?.initialValueProp ? stateSource(spec)[spec.initialValueProp] : initialValue;
    session.resolve(instance, name, source, initial);
    return {
      get value() { return read(name); },
      get revealed() { return session.instanceStore(instance).getState()[name]?.revealed ?? false; },
      reveal: (value: unknown) => session.reveal(instance, name, value),
      set: (value: unknown) => { session.set(instance, name, value); onChange(); },
    };
  };
  return bindings;
}
