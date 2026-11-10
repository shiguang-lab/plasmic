import { getLinkedCodeProps } from "@/wab/shared/cached-selectors";
import { isKnownTplComponent } from "@/wab/shared/model/classes";
import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import type { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert } from "@/wab/shared/common";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import type { Selectable } from "@/wab/shared/core/selection";
import { ValComponent, type ComponentEvalContext } from "@/wab/shared/core/val-nodes";
import type { Param, State, TplComponent, TplNode, TplTag } from "@/wab/shared/model/classes";
import { isPlainObject } from "lodash";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

/** Copy runtime data containers; executable values and host objects keep their identity. */
function captureData<T>(value: T, previous?: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object" || ("$$typeof" in value && typeof value.$$typeof === "symbol") || (!Array.isArray(value) && !isPlainObject(value))) {return value;}
  const captured = seen.get(value);
  if (captured) {return captured as T;}
  const array = Array.isArray(value);
  const before = previous && typeof previous === "object" && (array ? Array.isArray(previous) : isPlainObject(previous)) ? previous : undefined;
  const keys = Object.keys(value);
  const result: any = array ? new Array((value as unknown[]).length) : {};
  seen.set(value, result);
  let equal = !!before && keys.length === Object.keys(before).length && (!array || (before as unknown[]).length === (value as unknown[]).length);
  for (const key of keys) {
    result[key] = captureData((value as any)[key], (before as any)?.[key], seen);
    equal &&= !!before && Object.hasOwn(before, key) && Object.is(result[key], (before as any)[key]);
  }
  if (equal) { seen.set(value, before); return before as T; }
  return Object.freeze(result);
}

/** Registration context is an opaque runtime ABI, and may contain command handles. */
function captureEvaluation(current: ComponentEvalContext, previous?: ComponentEvalContext): ComponentEvalContext {
  const componentPropValues = captureData(current.componentPropValues, previous?.componentPropValues);
  const invalidArgs = captureData(current.invalidArgs, previous?.invalidArgs);
  const ccContextData = current.ccContextData;
  if (previous && previous.componentPropValues === componentPropValues && previous.invalidArgs === invalidArgs && previous.ccContextData === ccContextData) {
    return previous;
  }
  return Object.freeze({ componentPropValues, invalidArgs, ccContextData });
}

type RuntimeSource = {subscribe(listener: () => void): () => void};

class InspectorRead<T> {
  private readonly state: StoreApi<T>;
  private readonly subscriptions = new Set<() => void>();
  private disposed = false;
  private dirty = false;
  private readonly runtimeStops = new Map<RuntimeSource, () => void>();
  readonly store: ModelFieldStore<T>;

  constructor(private readonly read: (previous?: T) => T, private readonly sources: () => readonly RuntimeSource[] = () => [], private readonly active: () => boolean = () => true) {
    this.state = createStore<T>(() => read());
    this.store = {
      getState: () => { this.capture(); return this.state.getState(); },
      getInitialState: this.state.getInitialState,
      subscribe: (listener) => {
        if (this.disposed) {return () => undefined;}
        const unsubscribe = this.state.subscribe(listener);
        const stop = () => { unsubscribe(); this.subscriptions.delete(stop); if (!this.subscriptions.size) { this.disconnectRuntime(); this.dirty = true; } };
        const first = !this.subscriptions.size;
        this.subscriptions.add(stop);
        if (first) { this.refresh(); }
        return stop;
      },
    };
  }

  private disconnectRuntime() { this.runtimeStops.forEach(stop => stop()); this.runtimeStops.clear(); }
  refresh = () => {
    if (this.disposed || !this.active()) { return; }
    this.dirty = true;
    // Hidden/unmounted controls invalidate their cached data without copying
    // the runtime environment. Explicit reads and resubscription catch up.
    if (this.subscriptions.size) { this.capture(); }
  };
  private capture() {
    if (!this.dirty || this.disposed || !this.active()) { return; }
    this.dirty = false;
    this.state.setState(() => this.read(this.state.getState()), true);
    if (this.subscriptions.size) {
      const sources = new Set(this.sources());
      for (const source of sources) { if (!this.runtimeStops.has(source)) { this.runtimeStops.set(source, source.subscribe(this.refresh)); } }
      for (const [source, stop] of this.runtimeStops) { if (!sources.has(source)) {stop(); this.runtimeStops.delete(source);} }
    }
  }

  dispose() {
    this.disposed = true;
    this.disconnectRuntime();
    for (const stop of this.subscriptions) {stop();}
  }
}

export interface StateValueSnapshot {
  readonly value: unknown;
  readonly hasTempValue: boolean;
  readonly hasUnstableInitializer: boolean;
}

/** A committed focus owns demanded reads until a later focus commits. */
export class InspectorSelection {
  readonly componentCtx: ComponentCtx | null;
  readonly tpl: TplNode | null;
  readonly tplCount: number;
  readonly slotTpl: TplNode | null;
  readonly selectable: Selectable | null | undefined;
  readonly cloneKey: string | undefined;
  readonly componentPart: CanvasComponentPart | undefined;
  private paused = false;
  private disposed = false;
  private evaluations = new Map<TplTag | TplComponent, Map<Param | undefined, InspectorRead<ComponentEvalContext>>>();
  private environments = new Map<TplNode, Map<string, InspectorRead<ReturnType<ViewCtx["getCanvasEnvForTpl"]>>>>();
  private stateValues = new Map<State, InspectorRead<StateValueSnapshot>>();
  private domValue?: InspectorRead<ReturnType<ViewCtx["selectionDom"]> | null>;

  constructor(readonly viewCtx: ViewCtx, readonly generation: number) {
    this.componentCtx = viewCtx.currentComponentCtx();
    this.tpl = viewCtx.focusedTpl();
    this.tplCount = viewCtx.focusedTpls().length;
    this.slotTpl = viewCtx.focusedTpl(true);
    this.selectable = viewCtx.focusedSelectable();
    this.cloneKey = viewCtx.focusedCloneKey();
    this.componentPart = viewCtx.focusedComponentPart;
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.syncCanvas(); }

  domStore() {
    assert(!this.disposed, "Cannot request reads from a disposed Inspector selection");
    return (this.domValue ??= new InspectorRead(() => !this.paused && this.selectable ? this.viewCtx.selectionDom(this.selectable, this.cloneKey) : null)).store;
  }

  private runtimeSources(tpl: TplNode, ancestors = false): RuntimeSource[] {
    if (this.paused || this.disposed) { return []; }
    const sources: RuntimeSource[] = [];
    for (let node: TplNode | null | undefined = tpl; node; node = ancestors ? node.parent : undefined) {
      const values = this.viewCtx.maybeTpl2ValsInContext(node, {allowAnyContext: true, anchorCloneKey: this.cloneKey, ignoreFocusedCloneKey: true}) ?? [];
      for (const value of values) {
        sources.push(value.runtimeInputs);
        if (value instanceof ValComponent) { sources.push(value.componentRuntimeInputs); }
      }
    }
    return sources;
  }

  componentEvalStore(tpl: TplTag | TplComponent, param?: Param) {
    assert(!this.disposed, "Cannot request reads from a disposed Inspector selection");
    let entries = this.evaluations.get(tpl);
    if (!entries) { entries = new Map(); this.evaluations.set(tpl, entries); }
    let value = entries.get(param);
    if (!value) {
      value = new InspectorRead((previous) => captureEvaluation(this.paused ? { componentPropValues: {}, ccContextData: undefined, invalidArgs: [] } : this.viewCtx.getComponentEvalContext(tpl, param, { anchorCloneKey: this.cloneKey, ignoreFocusedCloneKey: true }), previous), () => {
        const linked = param && isKnownTplComponent(tpl) ? getLinkedCodeProps(tpl.component).get(param.variable.name)?.[0] : undefined;
        return this.runtimeSources(linked ?? tpl);
      }, () => !this.paused);
      entries.set(param, value);
    }
    return value.store;
  }

  canvasEnvStore(tpl: TplNode, options?: { forDataRepCollection?: boolean }) {
    assert(!this.disposed, "Cannot request reads from a disposed Inspector selection");
    let entries = this.environments.get(tpl);
    if (!entries) { entries = new Map(); this.environments.set(tpl, entries); }
    const key = `${!!options?.forDataRepCollection}`;
    let value = entries.get(key);
    if (!value) {
      value = new InspectorRead((previous) => {
        if (this.paused) {return undefined;}
        const env = this.viewCtx.getCanvasEnvForTpl(tpl, { ...options, anchorCloneKey: this.cloneKey, ignoreFocusedCloneKey: true });
        return captureData(env, previous);
      }, () => this.runtimeSources(tpl, true), () => !this.paused);
      entries.set(key, value);
    }
    return value.store;
  }

  stateValueStore(state: State) {
    assert(!this.disposed, "Cannot request reads from a disposed Inspector selection");
    let entry = this.stateValues.get(state);
    if (!entry) {
      entry = new InspectorRead<StateValueSnapshot>((previous) => {
        const current = this.paused ? undefined : this.viewCtx.getCanvasStateValue(state);
        const hasTempValue = !this.paused && this.viewCtx.getStateCurrentInitialValue(state) !== current;
        const value = captureData(current, previous?.value);
        const hasUnstableInitializer = !this.paused && this.viewCtx.hasUnstableStateInitializer(state);
        return previous && previous.value === value && previous.hasTempValue === hasTempValue && previous.hasUnstableInitializer === hasUnstableInitializer
          ? previous : Object.freeze({ value, hasTempValue, hasUnstableInitializer });
      }, () => this.runtimeSources(this.viewCtx.currentComponent().tplTree, true), () => !this.paused);
      this.stateValues.set(state, entry);
    }
    return entry.store;
  }

  /** Called after this ViewCtx installs a completed canvas evaluation/DOM update. */
  syncCanvas() {
    if (this.paused || this.disposed) {return;}
    this.domValue?.refresh();
    for (const entry of this.stateValues.values()) {entry.refresh();}
    for (const entries of this.evaluations.values()) {for (const entry of entries.values()) {entry.refresh();}}
    for (const entries of this.environments.values()) {for (const entry of entries.values()) {entry.refresh();}}
  }

  /** Context metadata is published independently of a canvas render. */
  syncContextData(valKey: string) {
    if (this.paused || this.disposed) {
      return;
    }
    for (const [tpl, entries] of this.evaluations) {
      const links = isKnownTplComponent(tpl) ? getLinkedCodeProps(tpl.component) : undefined;
      for (const [param, entry] of entries) {
        const actualTpl = param ? links?.get(param.variable.name)?.[0] ?? tpl : tpl;
        const source = this.viewCtx.maybeTpl2ValsInContext(actualTpl, { allowAnyContext: true, anchorCloneKey: this.cloneKey, ignoreFocusedCloneKey: true })?.[0];
        if (source?.key === valKey) {
          entry.refresh();
        }
      }
    }
  }

  /** Model edits invalidate only demanded reads whose tpl/component owns the change. */
  syncModel(changes: readonly ModelChange[]) {
    if (this.paused || this.disposed) {return;}
    const inputFields = new Set(["vsettings", "args", "attrs", "expr", "value", "text", "dataRep", "dataCond", "collection", "params", "defaultExpr", "previewExpr", "component", "codeComponentMeta", "states", "variables", "tplTree", "children"]);
    const affects = (tpl: TplNode) => changes.some(({ changeNode, path }) => {
      if (!inputFields.has(changeNode.field) && !path?.some((node) => inputFields.has(node.field) && node.field !== "tplTree" && node.field !== "children" && node.field !== "component")) {return false;}
      const owners = [tpl, ...("component" in tpl ? [tpl.component] : [])];
      return owners.some((owner) => changeNode.inst === owner || path?.some((node) => node.inst === owner));
    });
    if (this.stateValues.size) {
      const component = this.viewCtx.currentComponent();
      if (changes.some(({ changeNode, path }) => changeNode.inst === component || path?.some((node) => node.inst === component))) {
        for (const entry of this.stateValues.values()) {entry.refresh();}
      }
    }
    for (const [tpl, entries] of this.evaluations) {if (affects(tpl)) {for (const entry of entries.values()) {entry.refresh();}}}
    for (const [tpl, entries] of this.environments) {if (affects(tpl)) {for (const entry of entries.values()) {entry.refresh();}}}
  }

  dispose() {
    this.disposed = true;
    this.domValue?.dispose();
    for (const entry of this.stateValues.values()) {entry.dispose();}
    this.stateValues.clear();
    for (const entries of this.evaluations.values()) {for (const entry of entries.values()) {entry.dispose();}}
    for (const entries of this.environments.values()) {for (const entry of entries.values()) {entry.dispose();}}
    this.evaluations.clear(); this.environments.clear();
  }
}

/** Standalone data editors are not owned by a selected element. */
export function canEditInspectorSelection(studioCtx: StudioCtx, selection: InspectorSelection | undefined) {
  return !selection || (!studioCtx.isSelectionPending && studioCtx.inspectorSelection === selection && studioCtx.focusedViewCtx() === selection.viewCtx && !selection.viewCtx.isDisposed && selection.viewCtx.currentComponentCtx() === selection.componentCtx && selection.viewCtx.focusedTpl() === selection.tpl && selection.viewCtx.focusedCloneKey() === selection.cloneKey);
}
