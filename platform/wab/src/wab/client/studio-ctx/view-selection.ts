import { ValComponent, ValSlot } from "@/wab/shared/core/val-nodes";
import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import type { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { makeSelectableFullKey, makeSelectableKey, type Selectable } from "@/wab/shared/core/selection";
import { SlotSelection } from "@/wab/shared/core/slots";
import type { Component, Param, TplComponent, TplNode } from "@/wab/shared/model/classes";
import { Pt } from "@/wab/shared/geom";
import $ from "jquery";
import { isEqual } from "lodash";
import { createStore } from "zustand/vanilla";

/** UI identity. Runtime values are resolved only by command readers. */
export interface SelectionTargetRef {
  readonly kind: "value" | "slot";
  readonly tpl: ModelRef<TplNode>;
  readonly key: string | undefined;
  readonly fullKey: string | undefined;
  readonly slotParam: ModelRef<Param> | undefined;
  readonly slotOwner: ModelRef<TplComponent> | undefined;
  readonly owners: readonly Readonly<{ tpl: ModelRef<TplComponent>; fullKey: string }>[];
}

export interface ComponentContextRef {
  readonly component: ModelRef<Component>;
  readonly tpl: ModelRef<TplComponent>;
  readonly valKey: string;
  readonly valFullKey: string;
}

type DomElements = readonly HTMLElement[];
type PartSnapshot = Readonly<Omit<CanvasComponentPart, "tpl" | "props" | "text">> & {
  readonly tpl: ModelRef<TplComponent>;
  readonly props: readonly string[];
  readonly text: Readonly<{ prop: string; selector: string }> | undefined;
};

export interface ViewSelectionSnapshot {
  readonly tpls: readonly (ModelRef<TplNode> | null)[];
  readonly targets: readonly (SelectionTargetRef | null)[];
  readonly cloneKeys: readonly (string | undefined)[];
  readonly doms: readonly (DomElements | null)[];
  readonly hover: SelectionTargetRef | null | undefined;
  readonly hoverDom: DomElements | null | undefined;
  readonly context: ComponentContextRef | null;
  readonly part: PartSnapshot | undefined;
  readonly highlight: Readonly<{ tpl: ModelRef<TplComponent>; params: readonly ModelRef<Param>[] }> | undefined;
  readonly measure: DomElements | Pt | null | undefined;
  readonly disabledAutoOpenUuid: string | undefined;
}

export const emptyViewSelection: ViewSelectionSnapshot = Object.freeze({ tpls: Object.freeze([]), targets: Object.freeze([]), cloneKeys: Object.freeze([]), doms: Object.freeze([]), hover: null, hoverDom: null, context: null, part: undefined, highlight: undefined, measure: null, disabledAutoOpenUuid: undefined });
function initialSelection(): ViewSelectionSnapshot { return emptyViewSelection; }

function sameTarget(a: SelectionTargetRef | null | undefined, b: SelectionTargetRef | null | undefined) {
  return a === b || !!a && !!b && a.kind === b.kind && a.tpl === b.tpl && a.key === b.key && a.fullKey === b.fullKey && a.slotParam === b.slotParam && a.slotOwner === b.slotOwner && arrayEq(a.owners, b.owners, (left, right) => left.tpl === right.tpl && left.fullKey === right.fullKey);
}

function captureDoms(value: JQuery | null | undefined, previous: DomElements | null | undefined): DomElements | null | undefined {
  if (!value) { return value; }
  const elements = value.toArray();
  return previous && arrayEq(previous, elements) ? previous : Object.freeze(elements);
}

/** One canonical editor selection. Native transactions publish complete arrays together. */
export class ViewSelection {
  private readonly state = createStore<ViewSelectionSnapshot>(initialSelection);
  private snapshot = this.state.getState();
  private publicationDepth = 0;
  private readonly subscriptions = new Set<() => void>();
  private readonly targetCommands = new WeakMap<SelectionTargetRef, Selectable>();
  private readonly contextCommands = new WeakMap<ComponentContextRef, ComponentCtx>();
  private readonly tplCommands = new WeakMap<readonly (ModelRef<TplNode> | null)[], readonly (TplNode | null)[]>();
  private targetCommandsCache?: readonly (Selectable | null)[];
  private domCommandsSource?: ViewSelectionSnapshot["doms"];
  private domCommandsCache?: readonly (JQuery | null)[];
  private hoverDomSource: ViewSelectionSnapshot["hoverDom"];
  private hoverDomCommand: JQuery | null | undefined;
  private measureSource: ViewSelectionSnapshot["measure"];
  private measureCommand: JQuery | Pt | null | undefined;
  private pending: ViewSelectionSnapshot | undefined;
  private depth = 0;
  private transactionSnapshot: ViewSelectionSnapshot | undefined;
  private readonly targetWrites: [SelectionTargetRef, Selectable | undefined][] = [];
  private readonly contextWrites: [ComponentContextRef, ComponentCtx | undefined][] = [];
  private disposed = false;
  readonly store: ModelFieldStore<ViewSelectionSnapshot> = {
    getState: () => this.snapshot,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };

  constructor(private readonly models: () => ModelSnapshots) {}
  private assertActive() { assert(!this.disposed, "Cannot change a disposed canvas selection"); }

  /** Core command readers see staged values; subscribers see the completed transaction. */
  current() { return this.disposed ? this.snapshot : this.pending ?? this.snapshot; }

  /** Coordinated sources install all snapshots before notifying either source. */
  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publish(); }
  }
  private install(snapshot: ViewSelectionSnapshot) {
    this.snapshot = snapshot;
    this.publish();
  }
  private publish() {
    if (!this.publicationDepth && !this.depth && this.state.getState() !== this.snapshot) { this.state.setState(this.snapshot, true); }
  }

  transaction<Result>(command: () => Result): Result {
    this.assertActive();
    const checkpoint = { pending: this.pending, snapshot: this.snapshot, targets: this.targetWrites.length, contexts: this.contextWrites.length, targetCache: this.targetCommandsCache, domSource: this.domCommandsSource, domCache: this.domCommandsCache, hoverSource: this.hoverDomSource, hoverCommand: this.hoverDomCommand, measureSource: this.measureSource, measureCommand: this.measureCommand };
    if (!this.depth) { this.transactionSnapshot = this.snapshot; }
    this.depth++;
    let succeeded = false;
    try {
      const result = command();
      succeeded = true;
      return result;
    } catch (error) {
      if (this.disposed) { this.pending = undefined; throw error; }
      this.pending = checkpoint.pending;
      this.snapshot = checkpoint.snapshot;
      while (this.targetWrites.length > checkpoint.targets) {
        const [ref, previous] = ensure(this.targetWrites.pop(), "Expected selection command savepoint");
        if (previous) { this.targetCommands.set(ref, previous); } else { this.targetCommands.delete(ref); }
      }
      while (this.contextWrites.length > checkpoint.contexts) {
        const [ref, previous] = ensure(this.contextWrites.pop(), "Expected component context savepoint");
        if (previous) { this.contextCommands.set(ref, previous); } else { this.contextCommands.delete(ref); }
      }
      this.targetCommandsCache = checkpoint.targetCache;
      this.domCommandsSource = checkpoint.domSource;
      this.domCommandsCache = checkpoint.domCache;
      this.hoverDomSource = checkpoint.hoverSource;
      this.hoverDomCommand = checkpoint.hoverCommand;
      this.measureSource = checkpoint.measureSource;
      this.measureCommand = checkpoint.measureCommand;
      throw error;
    } finally {
      this.depth--;
      if (!this.depth) {
        this.targetWrites.length = 0;
        this.contextWrites.length = 0;
        if (!this.disposed && succeeded && this.pending) {
          const next = this.pending;
          this.pending = undefined;
          const before = this.transactionSnapshot ?? this.snapshot;
          const stable = this.shareSnapshot(next, before);
          if (stable.targets === before.targets) {
            this.targetCommandsCache = checkpoint.targetCache && arrayEq(checkpoint.targetCache, stable.targets.map((ref) => ref ? this.resolveTarget(ref) : null)) ? checkpoint.targetCache : undefined;
          }
          if (stable.doms === before.doms) { this.domCommandsSource = checkpoint.domSource; this.domCommandsCache = checkpoint.domCache; }
          if (stable.hoverDom === before.hoverDom) { this.hoverDomSource = checkpoint.hoverSource; this.hoverDomCommand = checkpoint.hoverCommand; }
          if (stable.measure === before.measure) { this.measureSource = checkpoint.measureSource; this.measureCommand = checkpoint.measureCommand; }
          if (this.snapshot !== stable) { this.install(stable); }
        }
        this.transactionSnapshot = undefined;
        this.publish();
      }
    }
  }

  private shareSnapshot(next: ViewSelectionSnapshot, before: ViewSelectionSnapshot): ViewSelectionSnapshot {
    let stable = next;
    for (const field of ["tpls", "targets", "cloneKeys", "doms", "hover", "hoverDom", "context", "part", "highlight", "measure", "disabledAutoOpenUuid"] as const) {
      if (isEqual(before[field], next[field])) { stable = { ...stable, [field]: before[field] }; }
    }
    for (let index = 0; index < stable.targets.length; index++) {
      const ref = stable.targets[index], current = next.targets[index];
      if (ref && current && ref !== current) { this.assignTargetCommand(ref, this.resolveTarget(current)); }
    }
    if (stable.hover && next.hover && stable.hover !== next.hover) { this.assignTargetCommand(stable.hover, this.resolveTarget(next.hover)); }
    if (stable.context && next.context && stable.context !== next.context) { this.assignContextCommand(stable.context, ensure(this.contextCommands.get(next.context), "Expected committed component context")); }
    const sameFields = (snapshot: ViewSelectionSnapshot) => Object.keys(stable).every((field) => Object.is(Reflect.get(snapshot, field), Reflect.get(stable, field)));
    return sameFields(before) ? before : sameFields(this.snapshot) ? this.snapshot : Object.freeze(stable);
  }

  private assignTargetCommand(ref: SelectionTargetRef, command: Selectable) {
    if (this.depth && this.targetCommands.get(ref) !== command) { this.targetWrites.push([ref, this.targetCommands.get(ref)]); }
    this.targetCommands.set(ref, command);
  }
  private assignContextCommand(ref: ComponentContextRef, command: ComponentCtx) {
    if (this.depth && this.contextCommands.get(ref) !== command) { this.contextWrites.push([ref, this.contextCommands.get(ref)]); }
    this.contextCommands.set(ref, command);
  }

  prepareCommit() {
    if (!this.disposed && this.pending) {
      this.install(this.shareSnapshot(this.pending, this.transactionSnapshot ?? this.snapshot));
    }
  }

  private update(patch: Partial<ViewSelectionSnapshot>) {
    this.assertActive();
    const before = this.current();
    if (Object.entries(patch).every(([key, value]) => Object.is(Reflect.get(before, key), value))) { return; }
    const next = Object.freeze({ ...before, ...patch });
    if (this.depth) { this.pending = next; }
    else { this.install(next); }
  }

  setTpls(tpls: readonly (TplNode | null)[]) { this.assertActive();
    const before = this.current().tpls;
    const refs = tpls.map((tpl) => tpl && this.models().ref(tpl));
    if (!arrayEq(before, refs)) { this.update({ tpls: Object.freeze(refs) }); }
  }
  tpls() {
    const refs = this.current().tpls;
    let commands = this.tplCommands.get(refs);
    if (!commands) {
      commands = Object.freeze(refs.map((ref) => ref ? this.models().resolve(ref) : null));
      this.tplCommands.set(refs, commands);
    }
    return commands;
  }

  private captureTarget(command: Selectable, previous?: SelectionTargetRef | null, selected = false) {
    const slot = command instanceof SlotSelection;
    const value = slot ? command.val : command;
    const owners: { tpl: ModelRef<TplComponent>; fullKey: string }[] = [];
    for (let owner = value instanceof ValComponent ? value : value?.valOwner; owner; owner = owner.valOwner) {
      owners.push(Object.freeze({ tpl: this.models().ref(owner.tpl), fullKey: owner.fullKey }));
    }
    const next = Object.freeze({ kind: slot ? "slot" as const : "value" as const, tpl: this.models().ref(slot ? command.getTpl() : command.tpl), key: makeSelectableKey(command), fullKey: makeSelectableFullKey(command), slotParam: slot ? this.models().ref(command.slotParam) : command instanceof ValSlot ? this.models().ref(command.tpl.param) : undefined, slotOwner: command instanceof ValSlot && command.valOwner ? this.models().ref(command.valOwner.tpl) : undefined, owners: Object.freeze(owners) });
    const ref = sameTarget(next, previous) ? ensure(previous, "Expected matching selection identity") : next;
    if (selected && ref === previous && this.targetCommands.get(ref) !== command) { this.targetCommandsCache = undefined; }
    this.assignTargetCommand(ref, command);
    return ref;
  }
  setTargets(commands: readonly (Selectable | null)[]) { this.assertActive();
    const before = this.current().targets;
    const targets = commands.map((command, i) => command ? this.captureTarget(command, before[i], true) : null);
    if (!arrayEq(before, targets)) { this.targetCommandsCache = undefined; this.update({ targets: Object.freeze(targets) }); }
  }
  resolveTarget(ref: SelectionTargetRef): Selectable {
    return ensure(this.targetCommands.get(ref), "Selection belongs to another canvas owner");
  }
  targets() {
    return this.targetCommandsCache ??= Object.freeze(this.current().targets.map((ref) => ref ? this.resolveTarget(ref) : null));
  }

  setCloneKeys(keys: readonly (string | undefined)[]) { this.assertActive();
    if (!arrayEq(keys, this.current().cloneKeys)) { this.update({ cloneKeys: Object.freeze([...keys]) }); }
  }
  setDoms(doms: readonly (JQuery | null)[]) { this.assertActive();
    const before = this.current().doms;
    const next = doms.map((dom, i) => captureDoms(dom, before[i]) ?? null);
    if (!arrayEq(before, next)) { this.update({ doms: Object.freeze(next) }); }
  }
  doms() {
    const doms = this.current().doms;
    if (this.domCommandsSource !== doms) {
      this.domCommandsSource = doms;
      this.domCommandsCache = Object.freeze(doms.map((elements) => elements ? $(elements) : null));
    }
    return ensure(this.domCommandsCache, "Expected captured selection DOM");
  }

  setHover(command: Selectable | null | undefined, dom: JQuery | null | undefined) {
    this.transaction(() => {
      const before = this.current();
      const hover = command ? this.captureTarget(command, before.hover) : command;
      this.update({ hover, hoverDom: captureDoms(dom, before.hoverDom) });
    });
  }
  hover() { const ref = this.current().hover; return ref ? this.resolveTarget(ref) : ref; }
  hoverDom() {
    const elements = this.current().hoverDom;
    if (this.hoverDomSource !== elements) {
      this.hoverDomSource = elements;
      this.hoverDomCommand = elements ? $(elements) : elements;
    }
    return this.hoverDomCommand;
  }

  setContext(command: ComponentCtx | null) { this.assertActive();
    if (!command) { this.update({ context: null }); return; }
    const before = this.current().context;
    const next = Object.freeze({ component: this.models().ref(command.component()), tpl: this.models().ref(command.tplComponent()), valKey: command.valComponent().key, valFullKey: command.valComponent().fullKey });
    const ref = before && before.component === next.component && before.tpl === next.tpl && before.valKey === next.valKey && before.valFullKey === next.valFullKey ? before : next;
    this.assignContextCommand(ref, command);
    this.update({ context: ref });
  }
  context() { const ref = this.current().context; return ref ? ensure(this.contextCommands.get(ref), "Expected owned component context") : null; }

  setPart(command: CanvasComponentPart | undefined) { this.assertActive();
    if (!command) { this.update({ part: undefined }); return; }
    const before = this.current().part;
    const tpl = this.models().ref(command.tpl);
    if (before && before.tpl === tpl && before.name === command.name && before.displayName === command.displayName && before.selector === command.selector && before.element === command.element && arrayEq(before.props, command.props) && before.text?.prop === command.text?.prop && before.text?.selector === command.text?.selector) { return; }
    this.update({ part: Object.freeze({ ...command, tpl, props: Object.freeze([...command.props]), text: command.text ? Object.freeze({ ...command.text }) : undefined }) });
  }
  part(): CanvasComponentPart | undefined {
    const part = this.current().part;
    return part ? { ...part, tpl: this.models().resolve(part.tpl), props: [...part.props] } : undefined;
  }
  setHighlight(command: { tpl: TplComponent; params: readonly Param[] } | undefined) { this.assertActive();
    if (!command) { this.update({ highlight: undefined }); return; }
    const tpl = this.models().ref(command.tpl);
    const params = command.params.map((param) => this.models().ref(param));
    const before = this.current().highlight;
    if (!before || before.tpl !== tpl || !arrayEq(before.params, params)) { this.update({ highlight: Object.freeze({ tpl, params: Object.freeze(params) }) }); }
  }
  highlight() {
    const highlight = this.current().highlight;
    return highlight ? { tpl: this.models().resolve(highlight.tpl), params: highlight.params.map((ref) => this.models().resolve(ref)) } : undefined;
  }
  setMeasure(command: JQuery | Pt | null | undefined) { this.assertActive();
    const before = this.current().measure;
    if (command instanceof Pt) {
      if (!(before instanceof Pt) || before.x !== command.x || before.y !== command.y) { this.update({ measure: Object.freeze(new Pt(command.x, command.y)) }); }
    } else { this.update({ measure: captureDoms(command, Array.isArray(before) ? before : undefined) }); }
  }
  measure() {
    const target = this.current().measure;
    if (this.measureSource !== target) {
      this.measureSource = target;
      this.measureCommand = target instanceof Pt || target == null ? target : $(target);
    }
    return this.measureCommand;
  }

  setDisabledAutoOpen(uuid: string | undefined) { this.assertActive(); this.update({ disabledAutoOpenUuid: uuid }); }

  clear() {
    this.targetCommandsCache = undefined;
    this.domCommandsSource = undefined;
    this.domCommandsCache = undefined;
    this.update(initialSelection());
  }
  dispose() {
    if (this.disposed) { return; }
    this.pending = undefined;
    this.disposed = true;
    this.snapshot = emptyViewSelection;
    this.targetCommandsCache = undefined;
    this.domCommandsSource = undefined;
    this.domCommandsCache = undefined;
    this.state.setState(this.snapshot, true);
    for (const stop of this.subscriptions) { stop(); }
  }
}
