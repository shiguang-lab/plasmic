import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq, assert } from "@/wab/shared/common";
import { allComponents, isTplAttachedToSite } from "@/wab/shared/core/sites";
import { findExprsInNode, isEventHandlerKeyForParam, type EventHandlerKeyType } from "@/wab/shared/core/tpls";
import { isKnownTplComponent, type Component, type EventHandler, type Interaction, type ObjInst, type State, type TplComponent, type TplNode, type TplTag } from "@/wab/shared/model/classes";
import { groupBy } from "lodash";
import * as React from "react";

/** Committed read leases for the two sidebar lists. Models keep ownership;
 * these resources retain only finite fields and immutable command references. */
abstract class StateListInputs<Value> {
  protected readonly models;
  protected readonly site;
  private readonly lifetime;
  private readonly fields = new Map<ModelFieldStore<unknown>, { value: unknown; prepared?: () => void; published?: () => void }>();
  private readonly listeners = new Set<() => void>();
  private used: Set<ModelFieldStore<unknown>> | undefined;
  private connected = false;
  private closed = false;
  private dirty = true;
  private current: Value;
  private published: Value;

  constructor(protected readonly view: ViewCtx, component: Component, private readonly empty: Value) {
    this.models = view.studioCtx.modelSnapshots; this.site = view.site; this.lifetime = view.disposeSignal;
    this.current = empty; this.published = empty;
    if (!this.isClosed()) { assert(allComponents(this.site, { includeDeps: "all" }).includes(component), "State sidebar component belongs to another model world"); }
  }
  protected isClosed() { return this.closed || this.lifetime.aborted || this.view.studioCtx.modelSnapshots !== this.models || this.view.site !== this.site; }
  protected read<T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) {
    const store = this.models.field(model, key);
    let binding = this.fields.get(store);
    if (!binding) { binding = { value: store.getState() }; this.fields.set(store, binding); }
    binding.value = store.getState(); this.used?.add(store);
    if (this.connected && !binding.prepared) {
      binding.prepared = this.models.subscribePreparedField(store, this.invalidate);
      binding.published = store.subscribe(this.publish);
    }
    return store.getState();
  }
  protected abstract capture(previous: Value): Value;
  private invalidate = () => { this.dirty = true; };
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.close);
    for (const binding of this.fields.values()) { binding.prepared?.(); binding.published?.(); binding.prepared = undefined; binding.published = undefined; }
  };
  private close = () => {
    if (this.closed) { return; } this.closed = true; this.disconnect(); this.fields.clear(); this.current = this.empty;
    this.publishSnapshot(); this.listeners.clear();
  };
  private publishSnapshot() {
    if (this.current === this.published) { return; }
    this.published = this.current; this.listeners.forEach((listener) => listener());
  }
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): Value => {
    if (this.isClosed()) { this.close(); return this.current; }
    if (!this.connected && [...this.fields].some(([store, binding]) => store.getState() !== binding.value)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>(); this.used = used;
    try { this.current = this.capture(this.current); }
    finally { this.used = undefined; }
    for (const [store, binding] of this.fields) {
      if (!used.has(store)) { binding.prepared?.(); binding.published?.(); this.fields.delete(store); }
    }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { this.close(); return () => undefined; }
    if (!this.listeners.size) { this.published = this.getSnapshot(); }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.dirty = true;
      try { this.getSnapshot(); }
      catch (error) { this.listeners.delete(listener); this.disconnect(); throw error; }
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
  resolve<Ref extends ModelRef>(ref: Ref) { return this.models.resolve(ref); }
}

export interface VariableRosterSnapshot {
  readonly regular: readonly ModelRef<State>[];
  readonly implicit: readonly ModelRef<TplTag | TplComponent>[];
  readonly emptyBody: boolean;
}
const noVariables: VariableRosterSnapshot = Object.freeze({ regular: Object.freeze([]), implicit: Object.freeze([]), emptyBody: true });
export class VariableRosterInputs extends StateListInputs<VariableRosterSnapshot> {
  constructor(view: ViewCtx, private readonly component: Component) { super(view, component, noVariables); }
  protected capture(previous: VariableRosterSnapshot): VariableRosterSnapshot {
    const states = this.read(this.component, "states").map((ref) => {
      const state = this.models.resolve(ref), tpl = this.read(state, "tplNode");
      return { ref, variableType: this.read(state, "variableType"), tpl, name: tpl ? this.read(this.models.resolve(tpl), "name") : undefined };
    });
    const nextRegular = states.filter((state) => state.variableType !== "variant" && !state.tpl).map((state) => state.ref);
    // Retain lodash's property-key grouping and Object.values order, including
    // distinct TplNodes sharing a name and integer-like node names.
    const nextImplicit = Object.values(groupBy(states.filter((state) => state.tpl), (state) => state.name)).map((group) => {
      const tpl = group[0].tpl; assert(tpl, "Implicit state should have a tpl"); return tpl;
    });
    const regular = arrayEq(previous.regular, nextRegular) ? previous.regular : Object.freeze(nextRegular);
    const implicit = arrayEq(previous.implicit, nextImplicit) ? previous.implicit : Object.freeze(nextImplicit);
    const emptyBody = !states.some((state) => state.variableType !== "variant");
    return regular === previous.regular && implicit === previous.implicit && emptyBody === previous.emptyBody ? previous : Object.freeze({ regular, implicit, emptyBody });
  }
}
export function useVariableRoster(view: ViewCtx, component: Component) {
  const source = React.useMemo(() => new VariableRosterInputs(view, component), [view, component]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, source };
}

export interface HandlerListSnapshot {
  readonly interactions: readonly ModelRef<Interaction>[];
  readonly formSubmissionWarning: boolean;
}
const noHandler: HandlerListSnapshot = Object.freeze({ interactions: Object.freeze([]), formSubmissionWarning: false });
export class HandlerListInputs extends StateListInputs<HandlerListSnapshot> {
  constructor(view: ViewCtx, component: Component, private readonly tpl: TplTag | TplComponent, private readonly handler: EventHandler | null | undefined, private readonly eventKey: EventHandlerKeyType) {
    super(view, component, noHandler);
    if (!this.isClosed()) {
      assert(isTplAttachedToSite(this.site, tpl), "Handler sidebar node belongs to another model world");
      assert(!handler || findExprsInNode(tpl).some(({ expr }) => expr === handler), "Handler sidebar requires the original expression from its node");
      if (isEventHandlerKeyForParam(eventKey)) {
        assert(isKnownTplComponent(tpl) && tpl.component.params.includes(eventKey.param), "Handler parameter belongs to another component contract");
      }
    }
  }
  protected capture(previous: HandlerListSnapshot): HandlerListSnapshot {
    const nextInteractions = this.handler ? this.read(this.handler, "interactions") : noHandler.interactions;
    const interactions = arrayEq(previous.interactions, nextInteractions) ? previous.interactions : nextInteractions;
    let formSubmissionWarning = false;
    if (isEventHandlerKeyForParam(this.eventKey) && isKnownTplComponent(this.tpl)) {
      const variable = this.models.resolve(this.read(this.eventKey.param, "variable"));
      if (this.read(variable, "name") === "onClick") {
        const component = this.models.resolve(this.read(this.tpl, "component"));
        if (this.read(component, "name").toLowerCase().includes("button")) {
          let node: TplNode = this.tpl;
          while (true) {
            if (isKnownTplComponent(node)) {
              const ancestorComponent = this.models.resolve(this.read(node, "component"));
              if (this.read(ancestorComponent, "name") === "plasmic-antd5-form") { formSubmissionWarning = true; break; }
            }
            const parent = this.read(node, "parent");
            if (!parent) { break; }
            node = this.models.resolve(parent);
          }
        }
      }
    }
    return interactions === previous.interactions && formSubmissionWarning === previous.formSubmissionWarning ? previous : Object.freeze({ interactions, formSubmissionWarning });
  }
}
export function useHandlerList(view: ViewCtx, component: Component, tpl: TplTag | TplComponent, handler: EventHandler | null | undefined, eventKey: EventHandlerKeyType) {
  const key = "attr" in eventKey ? eventKey.attr : "param" in eventKey ? eventKey.param : eventKey.funcType;
  const source = React.useMemo(() => new HandlerListInputs(view, component, tpl, handler, eventKey), [view, component, tpl, handler, key]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, source };
}
