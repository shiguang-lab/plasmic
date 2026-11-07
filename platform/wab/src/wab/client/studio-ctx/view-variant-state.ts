import type { ModelChange } from "@/wab/shared/core/observable-model";
import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ensureValidCombo, isBaseVariant } from "@/wab/shared/Variants";
import { isFrameComponent } from "@/wab/shared/core/components";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { ComponentVariantFrame, GlobalVariantFrame } from "@/wab/shared/component-frame";
import { ArenaFrame, Component, ObjInst, Site, TplComponent, Variant, VariantGroup } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";

export interface VariantPinsSnapshot {
  readonly targets: readonly ModelRef<Variant>[];
  readonly pins: readonly { readonly variant: ModelRef<Variant>; readonly active: boolean }[];
}
export interface ComponentVariantSnapshot extends VariantPinsSnapshot {
  readonly tpl: ModelRef<TplComponent>;
  readonly component: ModelRef<Component>;
}
export interface ViewVariantSnapshot {
  readonly frames: readonly ComponentVariantSnapshot[];
  readonly global: VariantPinsSnapshot;
  readonly showDefaultSlots: boolean;
  readonly isEditingNonBaseVariant: boolean;
  readonly isTargetingNonBaseVariant: boolean;
}
interface VariantCommands {
  readonly frames: readonly ComponentVariantFrame[];
  readonly global: GlobalVariantFrame | undefined;
  readonly showDefaultSlots: boolean;
}
const emptyPins: VariantPinsSnapshot = Object.freeze({ targets: Object.freeze([]), pins: Object.freeze([]) });
const emptySnapshot: ViewVariantSnapshot = Object.freeze({ frames: Object.freeze([]), global: emptyPins, showDefaultSlots: false, isEditingNonBaseVariant: false, isTargetingNonBaseVariant: false });

/** One artboard's native variant input owner. Frame instances are commands;
 * consumers receive immutable model references and scalar pins. */
export class ViewVariantState {
  private commands: VariantCommands = { frames: Object.freeze([]), global: undefined, showDefaultSlots: false };
  private pending: VariantCommands | undefined;
  private depth = 0;
  private publicationDepth = 0;
  private current = emptySnapshot;
  private readonly state = createStore<ViewVariantSnapshot>(() => emptySnapshot);
  private readonly subscriptions = new Set<() => void>();
  private readonly frameStops: (() => void)[] = [];
  private readonly fields = new Map<ObjInst, Map<string, { stop: () => void; capture: () => void }>>();
  private dirty = false;
  private disposed = false;
  private readonly preparedListeners = new Set<() => void>();
  readonly store: ModelFieldStore<ViewVariantSnapshot> = {
    getState: () => this.current,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };
  constructor(
    private readonly models: () => ModelSnapshots,
    private readonly arenaFrame: () => ArenaFrame,
    private readonly site: () => Site,
    private readonly hasPendingModelChanges: () => boolean,
    private readonly hasValRoot: () => boolean,
  ) {}

  private readCommands() { return this.pending ?? this.commands; }
  frames() { return this.readCommands().frames; }
  global() { return ensure(this.readCommands().global, "Variant root must already be installed"); }
  showDefaultSlots() { return this.readCommands().showDefaultSlots; }
  private targetCombo(frame: ComponentVariantFrame, global: GlobalVariantFrame) {
    return ensureValidCombo(frame.component, [...frame.getTargetVariants(), ...global.getTargetVariants()]);
  }
  isEditingNonBaseVariant() {
    const commands = this.readCommands();
    const frame = commands.frames[commands.frames.length - 1];
    return !!frame && !!commands.global && this.hasValRoot() && !isFrameComponent(frame.component) && !isBaseVariant(this.targetCombo(frame, commands.global));
  }
  /** Same current-target combo as VariantTplMgr, including before first render. */
  isTargetingNonBaseVariant() {
    const commands = this.readCommands();
    const frame = commands.frames[commands.frames.length - 1];
    return !!frame && !!commands.global && !isBaseVariant(this.targetCombo(frame, commands.global));
  }
  syncRuntime() { this.invalidate(); }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }
  transaction<Result>(command: () => Result): Result {
    assert(!this.disposed, "Cannot update disposed variant inputs");
    const checkpoint = { pending: this.pending, current: this.current, dirty: this.dirty };
    this.depth++;
    let succeeded = false;
    try { const result = command(); succeeded = true; return result; }
    catch (error) { this.pending = this.disposed ? undefined : checkpoint.pending; if (!this.disposed) { this.current = checkpoint.current; this.dirty = checkpoint.dirty; this.bindModelFields(); } throw error; }
    finally {
      this.depth--;
      if (!this.disposed && !this.depth && succeeded && this.pending) {
        const next = this.pending;
        this.pending = undefined;
        const before = this.commands;
        this.commands = Object.freeze({
          ...next,
          frames: arrayEq(before.frames, next.frames) ? before.frames : next.frames,
        });
        if (before.frames !== this.commands.frames || before.global !== this.commands.global) { this.bindFrames(); }
        this.invalidate();
      }
    }
  }
  private update(patch: Partial<VariantCommands>) {
    assert(!this.disposed, "Cannot update disposed variant inputs");
    if (!this.depth) { this.transaction(() => this.update(patch)); return; }
    this.pending = Object.freeze({ ...this.readCommands(), ...patch });
    this.dirty = true;
  }
  replaceFrames(frames: readonly ComponentVariantFrame[]) {
    const previous = this.readCommands().frames;
    if (!arrayEq(previous, frames)) { this.update({ frames: Object.freeze(frames.slice()) }); }
  }
  setGlobal(frame: GlobalVariantFrame) {
    if (this.readCommands().global !== frame) { this.update({ global: frame }); }
  }
  setShowDefaultSlots(showDefaultSlots: boolean) {
    if (this.readCommands().showDefaultSlots !== showDefaultSlots) { this.update({ showDefaultSlots }); }
  }
  private bindFrames() {
    this.frameStops.splice(0).forEach((stop) => stop());
    const frames = this.commands.global ? [...this.commands.frames, this.commands.global] : this.commands.frames;
    for (const frame of frames) { this.frameStops.push(frame.subscribeInputs(() => this.invalidate())); }
  }
  private invalidate() {
    if (this.disposed) { return; }
    this.dirty = true;
    if (!this.depth && !this.hasPendingModelChanges()) { this.prepareCommit(); this.publishCommit(); }
  }

  prepareModelCommit(changes: readonly ModelChange[]) {
    if (changes.some(({ changeNode: { inst, field } }) => this.fields.get(inst)?.has(field))) { this.dirty = true; }
    this.prepareCommit();
  }

  /** Derived readers install matching snapshots here; callbacks never notify UI. */
  subscribePrepared(listener: () => void): () => void {
    if (this.disposed) { return () => undefined; }
    this.preparedListeners.add(listener);
    return () => { this.preparedListeners.delete(listener); };
  }

  /** Install values before Canvas prepares its corresponding inputs. */
  prepareCommit() {
    if (this.disposed || !this.dirty) { return; }
    this.dirty = false;
    const previous = this.current;
    const refs = this.models();
    const commands = this.readCommands();
    const frames = commands.frames.map((frame, index) => {
      const tpl = refs.ref(frame.tplComponent);
      const component = refs.ref(frame.component);
      const before = previous.frames[index];
      const pins = this.capturePins(frame, before);
      return before && before.tpl === tpl && before.component === component && before.targets === pins.targets && before.pins === pins.pins
        ? before : Object.freeze({ tpl, component, ...pins });
    });
    const capturedFrames = arrayEq(previous.frames, frames) ? previous.frames : Object.freeze(frames);
    const global = commands.global ? this.capturePins(commands.global, previous.global) : emptyPins;
    const isEditingNonBaseVariant = this.isEditingNonBaseVariant();
    const isTargetingNonBaseVariant = this.isTargetingNonBaseVariant();
    this.current = previous.frames === capturedFrames && previous.global === global && previous.showDefaultSlots === commands.showDefaultSlots && previous.isEditingNonBaseVariant === isEditingNonBaseVariant && previous.isTargetingNonBaseVariant === isTargetingNonBaseVariant
      ? previous : Object.freeze({ frames: capturedFrames, global, showDefaultSlots: commands.showDefaultSlots, isEditingNonBaseVariant, isTargetingNonBaseVariant });
    this.bindModelFields();
    if (this.current !== previous) { this.preparedListeners.forEach((prepare) => prepare()); }
  }
  /** Publish only after all model/Canvas projections have installed their inputs. */
  publishCommit() {
    if (!this.disposed && !this.publicationDepth && !this.depth && this.state.getState() !== this.current) { this.state.setState(this.current, true); }
  }
  private capturePins(frame: ComponentVariantFrame | GlobalVariantFrame, before: VariantPinsSnapshot | undefined): VariantPinsSnapshot {
    const refs = this.models();
    const targets = frame.getTargetVariants().map((variant) => refs.ref(variant));
    const capturedTargets = before && arrayEq(before.targets, targets) ? before.targets : Object.freeze(targets);
    const pins = [...frame.getPinnedVariants()].sort(([left], [right]) => left.uid - right.uid).map(([variant, active], index) => {
      const ref = refs.ref(variant);
      const previous = before?.pins[index];
      return previous && previous.variant === ref && previous.active === active ? previous : Object.freeze({ variant: ref, active });
    });
    const capturedPins = before && arrayEq(before.pins, pins) ? before.pins : Object.freeze(pins);
    return before && before.targets === capturedTargets && before.pins === capturedPins ? before : Object.freeze({ targets: capturedTargets, pins: capturedPins });
  }

  private bindModelFields() {
    const demanded = new Map<ObjInst, Set<string>>();
    const declare = (model: ObjInst, keys: readonly string[]) => {
      let fields = demanded.get(model);
      if (!fields) { fields = new Set(); demanded.set(model, fields); }
      keys.forEach((key) => fields.add(key));
    };
    const declareVariant = (variant: Variant) => {
      declare(variant, ["uuid", "name", "parent"]);
      if (variant.parent) { declareGroup(variant.parent); }
    };
    const declaredGroups = new Set<VariantGroup>();
    const declareGroup = (group: VariantGroup) => {
      if (declaredGroups.has(group)) { return; }
      declaredGroups.add(group);
      declare(group, ["variants", "multi", "type", "param"]);
      declare(group.param, ["variable"]);
      declare(group.param.variable, ["name"]);
      group.variants.forEach(declareVariant);
    };
    const declaredComponents = new Set<Component>();
    const declareComponent = (component: Component) => {
      if (declaredComponents.has(component)) { return; }
      declaredComponents.add(component);
      declare(component, ["variants", "variantGroups", "superComp", "type"]);
      component.variants.forEach(declareVariant);
      component.variantGroups.forEach(declareGroup);
      if (component.superComp) { declareComponent(component.superComp); }
    };
    const arena = this.arenaFrame();
    declare(arena, ["container", "targetVariants", "pinnedVariants", "targetGlobalVariants", "pinnedGlobalVariants"]);
    for (const frame of this.readCommands().frames) {
      declare(frame.tplComponent, ["component"]);
      declareComponent(frame.component);
      frame.getTargetVariants().forEach(declareVariant);
      [...frame.getPinnedVariants().keys()].forEach(declareVariant);
    }
    if (Object.keys(arena.pinnedGlobalVariants).length) {
      const site = this.site();
      declare(site, ["globalVariantGroups", "activeScreenVariantGroup", "projectDependencies"]);
      site.globalVariantGroups.forEach(declareGroup);
      for (const dependency of site.projectDependencies) {
        declare(dependency, ["site"]);
        declare(dependency.site, ["globalVariantGroups"]);
        dependency.site.globalVariantGroups.forEach(declareGroup);
      }
    }
    this.readCommands().global?.getTargetVariants().forEach(declareVariant);
    for (const [model, fields] of this.fields) {
      for (const [key, binding] of fields) {
        if (!demanded.get(model)?.has(key)) { binding.stop(); fields.delete(key); }
      }
      if (!fields.size) { this.fields.delete(model); }
    }
    for (const [model, keys] of demanded) {
      let fields = this.fields.get(model);
      if (!fields) { fields = new Map(); this.fields.set(model, fields); }
      for (const key of keys) {
        const before = fields.get(key);
        if (before) { before.capture(); }
        else {
          const store = this.models().declaredField(model, key);
          let captured = store.getState();
          const stop = store.subscribe((next) => { if (next !== captured) { this.dirty = true; } });
          fields.set(key, { stop, capture: () => { captured = store.getState(); } });
        }
      }
    }
  }
  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.preparedListeners.clear();
    this.pending = undefined;
    this.frameStops.splice(0).forEach((stop) => stop());
    for (const fields of this.fields.values()) { fields.forEach((binding) => binding.stop()); }
    this.fields.clear();
    for (const stop of this.subscriptions) { stop(); }
  }
}
