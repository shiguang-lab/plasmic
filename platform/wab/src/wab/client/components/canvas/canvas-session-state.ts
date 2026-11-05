import { cloneDeep, isEqual } from "lodash";
import { observable } from "mobx";
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
export class CanvasSessionState {
  private entries = observable.map<string, Entry>(undefined, { deep: false });

  private key(instance: string, name: string) {
    return JSON.stringify([instance, name]);
  }

  resolve(instance: string, name: string, nativeValue: unknown, initialValue?: unknown) {
    const key = this.key(instance, name);
    let entry = this.entries.get(key);
    if (entry && !entry.initialized) {
      entry = {
        ...entry, nativeValue: cloneDeep(nativeValue), initialValue: cloneDeep(initialValue),
        beforeReveal: nativeValue !== undefined ? nativeValue : initialValue, initialized: true,
      };
      this.entries.set(key, entry);
    }
    if (!entry || !isEqual(entry.nativeValue, nativeValue) || !isEqual(entry.initialValue, initialValue)) {
      entry = {
        nativeValue: cloneDeep(nativeValue), initialValue: cloneDeep(initialValue),
        value: nativeValue !== undefined ? nativeValue : initialValue, revealInput: entry?.revealInput,
        hasRevealInput: entry?.hasRevealInput ?? false, revealed: false, initialized: true,
        sourceChanged: !!entry,
      };
      this.entries.set(key, entry);
    } else if (entry.sourceChanged) {
      entry = { ...entry, sourceChanged: false };
      this.entries.set(key, entry);
    }
    return entry.value;
  }

  reveal(instance: string, name: string, value: unknown) {
    const key = this.key(instance, name);
    const entry = ensure(this.entries.get(key), `Canvas state ${name} was not initialized`);
    if (entry.locked) {
      return entry.value;
    }
    if (entry.sourceChanged) {
      this.entries.set(key, { ...entry, revealInput: cloneDeep(value), hasRevealInput: true, sourceChanged: false });
      return entry.value;
    }
    if (!entry.hasRevealInput || !isEqual(entry.revealInput, value)) {
      const releasing = isEqual(value, sourceValue(entry));
      this.entries.set(key, {
        ...entry,
        value: releasing && entry.revealed ? entry.beforeReveal : value,
        beforeReveal: releasing ? undefined : entry.revealed ? entry.beforeReveal : entry.value,
        revealInput: cloneDeep(value), hasRevealInput: true, revealed: !releasing,
      });
    }
    return this.entries.get(key)?.value;
  }

  set(instance: string, name: string, value: unknown, revealed = false) {
    const key = this.key(instance, name);
    const entry = this.entries.get(key);
    if (!entry) {
      this.entries.set(key, { nativeValue: undefined, initialValue: undefined, value,
        hasRevealInput: false, revealed, initialized: false, locked: revealed });
      return;
    }
    if (!isEqual(entry.value, value) || entry.revealed !== revealed) {
      this.entries.set(key, { ...entry, value, revealed, locked: revealed,
        beforeReveal: revealed ? entry.revealed ? entry.beforeReveal : entry.value : undefined });
    }
  }

  get(instance: string, name: string) {
    return this.entries.get(this.key(instance, name))?.value;
  }

  getRuntime(instance: string, name: string) {
    const entry = this.entries.get(this.key(instance, name));
    return entry?.revealed ? entry.beforeReveal : entry?.value;
  }

  setRuntime(instance: string, name: string, value: unknown) {
    const key = this.key(instance, name);
    const entry = this.entries.get(key);
    if (entry?.revealed) {
      if (!isEqual(entry.beforeReveal, value)) {
        this.entries.set(key, { ...entry, beforeReveal: cloneDeep(value) });
      }
    } else {
      this.set(instance, name, value);
    }
  }

  has(instance: string, name: string) {
    return this.entries.has(this.key(instance, name));
  }

  get hasReveals() {
    return Array.from(this.entries.values()).some((entry) =>
      entry.revealed && entry.value !== false && !isEqual(entry.value, sourceValue(entry)),
    );
  }

  hideReveals() {
    for (const [key, entry] of this.entries) {
      if (entry.revealed && entry.value !== false && !isEqual(entry.value, sourceValue(entry))) {
        this.entries.set(key, { ...entry, value: entry.beforeReveal, revealed: false, beforeReveal: undefined });
      }
    }
  }

  clear() {
    this.entries.clear();
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
  const read = (name: string) => interactive && isOverlay && name === "open"
    ? session.getRuntime(instance, name)
    : session.get(instance, name);
  const bindings: Record<string, { value: unknown; reveal: (value: unknown) => unknown }> = {};
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
  const selection = props.__plasmic_selection_prop__ ?? (props.__plasmic_selection_prop__ = {});
  selection.sessionInstance = instance;
  selection.getState = (name: string, nativeValue: unknown, initialValue?: unknown) => {
    const spec = specs.find((item) => item.valueProp === name);
    const source = spec ? stateSource(spec)[name] : nativeValue;
    const initial = spec?.initialValueProp ? stateSource(spec)[spec.initialValueProp] : initialValue;
    session.resolve(instance, name, source, initial);
    return {
      get value() { return read(name); },
      reveal: (value: unknown) => session.reveal(instance, name, value),
      set: (value: unknown) => { session.set(instance, name, value); onChange(); },
    };
  };
  return bindings;
}
