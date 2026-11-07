import type { FrameVariantSnapshot } from "@/wab/client/react-global-hook/frame-variant-inputs";
import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ComponentVariantSnapshot, ViewVariantSnapshot } from "@/wab/client/studio-ctx/view-variant-state";
import { PinStateManager, type PinState } from "@/wab/shared/PinManager";
import { getImplicitlyActivatedStyleVariants } from "@/wab/shared/Variants";
import { arrayEq, assert, ensure, ensureInstance } from "@/wab/shared/common";
import { allComponentVariants, isContextCodeComponent } from "@/wab/shared/core/components";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { allGlobalVariants } from "@/wab/shared/core/sites";
import { Component, ObjInst, TplComponent, Variant } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";

export interface CanvasVariantPin { readonly variant: ModelRef<Variant>; readonly active: boolean; }
export interface CanvasOwnerPins { readonly key: string; readonly pins: readonly CanvasVariantPin[]; }
export interface CanvasRenderedRoot { readonly tpl: ModelRef<TplComponent>; readonly key: string; readonly fullKey: string; }
export interface CanvasVariantSnapshot {
  readonly root: CanvasRenderedRoot | undefined;
  readonly frames: readonly CanvasOwnerPins[];
  readonly globals: readonly CanvasVariantPin[];
  readonly defaultSlots: readonly string[];
}
const empty: CanvasVariantSnapshot = Object.freeze({ root: undefined, frames: Object.freeze([]), globals: Object.freeze([]), defaultSlots: Object.freeze([]) });

/** Immutable pin/render-slot inputs from native view state, declared model fields and committed Fibers. */
export class CanvasVariantInputs {
  private readonly models: ModelSnapshots;
  private readonly state = createStore(() => empty);
  private current = empty;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly runtime = new Map<string, { store: ModelFieldStore<FrameVariantSnapshot | undefined>; stop: () => void }>();
  private readonly ownerStores = new Map<string, ModelFieldStore<CanvasOwnerPins | undefined>>();
  private readonly slotStores = new Map<string, ModelFieldStore<boolean>>();
  private readonly subscriptions = new Set<() => void>();
  private readonly publicationListeners = new Set<(next: CanvasVariantSnapshot, previous: CanvasVariantSnapshot) => (() => void)>();
  private readonly stops: (() => void)[];
  private variantInput: ViewVariantSnapshot | undefined;
  private selectionInput: ReturnType<ViewCtx["selectionStore"]["getState"]> | undefined;
  private dirty = true;
  private disposed = false;
  readonly store: ModelFieldStore<CanvasVariantSnapshot> = {
    getState: () => this.current,
    getInitialState: () => this.current,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop); return stop;
    },
  };
  readonly globalStore = this.select((state) => state.globals);
  readonly rootStore = this.select((state) => state.root);

  constructor(private readonly view: ViewCtx) {
    this.models = view.studioCtx.modelSnapshots;
    this.stops = [
      view.variantStore.subscribe((next) => {
        const previous = this.variantInput;
        if (!previous || next.frames !== previous.frames || next.global !== previous.global || next.showDefaultSlots !== previous.showDefaultSlots) { this.sync(); }
      }),
      view.selectionStore.subscribe((next) => {
        const previous = this.selectionInput;
        if (!previous || next.context !== previous.context || next.tpls !== previous.tpls) { this.sync(); }
      }),
      view.frameState.valRootStore.subscribe(() => this.sync()),
    ];
    this.prepareCommit(); this.publishCommit();
  }

  ownerStore(key: string) {
    let store = this.ownerStores.get(key);
    if (!store) { store = this.select((state) => state.frames.find((frame) => frame.key === key)); this.ownerStores.set(key, store); }
    return store;
  }
  slotStore(key: string) {
    let store = this.slotStores.get(key);
    if (!store) { store = this.select((state) => state.defaultSlots.includes(key)); this.slotStores.set(key, store); }
    return store;
  }
  /** Clear retained ancestor results before any React selector can render. */
  subscribeBeforePublish(listener: (next: CanvasVariantSnapshot, previous: CanvasVariantSnapshot) => (() => void)) {
    this.publicationListeners.add(listener);
    return () => { this.publicationListeners.delete(listener); };
  }
  private select<Selected>(selector: (state: CanvasVariantSnapshot) => Selected): ModelFieldStore<Selected> {
    return {
      getState: () => selector(this.current), getInitialState: () => selector(this.current),
      subscribe: (listener) => {
        let current = selector(this.current);
        return this.store.subscribe((next) => {
          const value = selector(next);
          if (!Object.is(value, current)) { const before = current; current = value; listener(value, before); }
        });
      },
    };
  }
  private sync() {
    this.dirty = true;
    if (!this.view.studioCtx.hasPendingModelChanges()) { this.prepareCommit(); this.publishCommit(); }
  }

  prepareCommit() {
    if (this.disposed) { return; }
    const variantInput = this.view.variantStore.getState(), selectionInput = this.view.selectionStore.getState();
    const previousVariants = this.variantInput, previousSelection = this.selectionInput;
    const changed = !previousVariants || variantInput.frames !== previousVariants.frames || variantInput.global !== previousVariants.global ||
      variantInput.showDefaultSlots !== previousVariants.showDefaultSlots || !previousSelection ||
      selectionInput.context !== previousSelection.context || selectionInput.tpls !== previousSelection.tpls;
    if (!this.dirty && !changed) { return; }
    this.dirty = false;
    const variants = this.variantInput = variantInput;
    const selection = this.selectionInput = selectionInput;
    const fields = new Set<ModelFieldStore<unknown>>();
    const runtime = new Set<string>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const store = this.models.field(model, key); fields.add(store); return store.getState();
    };
    const runtimeInput = (key: string) => {
      runtime.add(key);
      let input = this.runtime.get(key);
      if (!input) {
        const store = this.view.frameState.variantInputs.getStore(key);
        input = { store, stop: store.subscribe(() => this.sync()) }; this.runtime.set(key, input);
      }
      this.view.frameState.variantInputs.prepareCurrent(key);
      return input.store.getState();
    };
    const watched = new Set<Component>();
    const watchVariant = (variant: Variant) => {
      read(variant, "name"); read(variant, "selectors"); read(variant, "forTpl");
      read(variant, "codeComponentName"); read(variant, "codeComponentVariantKeys");
    };
    const watchComponent = (component: Component) => {
      if (watched.has(component)) { return; } watched.add(component);
      read(component, "variants").forEach((ref) => watchVariant(this.models.resolve(ref)));
      for (const ref of read(component, "variantGroups")) {
        const group = this.models.resolve(ref);
        read(group, "variants").forEach((variant) => watchVariant(this.models.resolve(variant)));
        const param = this.models.resolve(read(group, "param"));
        const variable = this.models.resolve(read(param, "variable")); read(variable, "name");
      }
      const parent = read(component, "superComp"); if (parent) { watchComponent(this.models.resolve(parent)); }
    };
    const path = read(this.view.site, "globalContexts").map((ref) => {
      const tpl = this.models.resolve(ref), component = this.models.resolve(read(tpl, "component"));
      const child = read(component, "params").map((param) => this.models.resolve(param)).find((param) => {
        const variable = this.models.resolve(read(param, "variable")); return read(variable, "name") === "children";
      });
      return `${read(tpl, "uuid")}.${read(ensure(child, "Global contexts must have a children parameter"), "uuid")}`;
    }).join(".");
    const rootFrame = variants.frames[0];
    let runtimeRoot: ValComponent | undefined = this.view.frameState.valRootStore.getState() ?? undefined;
    while (runtimeRoot) {
      const component = this.models.resolve(read(runtimeRoot.tpl, "component"));
      read(component, "type");
      const meta = read(component, "codeComponentMeta"); if (meta) { read(this.models.resolve(meta), "isContext"); }
      if (!isContextCodeComponent(component)) { break; }
      const child = runtimeInput(runtimeRoot.fullKey)?.firstChild;
      if (child) { assert(child.component, "Global context roots must wrap a component value"); }
      runtimeRoot = child ? ensureInstance(this.view.frameState.renderState.fullKey2val(child.fullKey), ValComponent) : undefined;
    }
    const root = runtimeRoot ? runtimeInput(runtimeRoot.fullKey) : undefined;
    const context = selection.context ? runtimeInput(selection.context.valFullKey) : undefined;
    const owners = context?.owners ?? root?.owners ?? [];
    const focused = selection.tpls[0] ? this.models.resolve(selection.tpls[0]) : undefined;
    const pinState = (frame: ComponentVariantSnapshot): PinState => ({
      targetVariants: [...frame.targets, ...variants.global.targets].map((ref) => this.models.resolve(ref)),
      pinnedVariants: new Map([...frame.pins, ...variants.global.pins].map((pin) => [this.models.resolve(pin.variant), pin.active])),
    });
    const capturePins = (values: Iterable<readonly [Variant, boolean]>, previous: readonly CanvasVariantPin[]) => {
      const pins = [...values].map(([variant, active], index) => {
        const ref = this.models.ref(variant), before = previous[index];
        return before?.variant === ref && before.active === active ? before : Object.freeze({ variant: ref, active });
      });
      return arrayEq(previous, pins) ? previous : Object.freeze(pins);
    };
    const frames = (root ? variants.frames : variants.frames.slice(0, 1)).flatMap((frame, index) => {
      const component = this.models.resolve(frame.component); watchComponent(component);
      read(this.models.resolve(frame.tpl), "parent");
      const owner = index === 0 ? root?.owners[0] : owners.find((value) => value.tplUid === frame.tpl.uid);
      if (index > 0 && !owner) { return []; }
      const input = owner ? runtimeInput(owner.fullKey) : undefined;
      const evaluated = new Map(allComponentVariants(component).flatMap((variant) => {
        const active = input?.flags[variant.uid]; return active === undefined ? [] : [[variant, active] as const];
      }));
      const machine = new PinStateManager(this.view.site, component, evaluated), state = pinState(frame);
      const available = allComponentVariants(component, { includeSuperVariants: true });
      const active = new Map(available.flatMap((variant) => {
        const value = machine.isActive(state, variant); return value === undefined ? [] : [[variant, value] as const];
      }));
      getImplicitlyActivatedStyleVariants(available, new Set([...active].filter(([, value]) => value).map(([variant]) => variant)), focused)
        .forEach((variant) => active.set(variant, true));
      const key = owner?.key ?? `${path}.${read(this.models.resolve(frame.tpl), "uuid")}`;
      const before = this.current.frames.find((value) => value.key === key);
      const pins = capturePins(active, before?.pins ?? empty.globals);
      return [before && before.pins === pins ? before : Object.freeze({ key, pins })];
    });
    read(this.view.site, "activeScreenVariantGroup");
    const globalSites = [this.view.site, ...read(this.view.site, "projectDependencies").map((ref) => {
      const dependency = this.models.resolve(ref); read(dependency, "projectId"); return this.models.resolve(read(dependency, "site"));
    })];
    globalSites.forEach((site) => read(site, "globalVariantGroups").forEach((ref) => {
      const group = this.models.resolve(ref); read(group, "type"); read(group, "variants");
    }));
    const rootComponent = rootFrame ? this.models.resolve(rootFrame.component) : undefined;
    const globalMachine = rootComponent ? new PinStateManager(this.view.site, rootComponent, new Map()) : undefined;
    const globalState = rootFrame ? pinState(rootFrame) : undefined;
    const globals = globalMachine && globalState ? capturePins(allGlobalVariants(this.view.site, { includeDeps: "direct", excludeInactiveScreenVariants: true })
      .map((variant) => [variant, !!globalMachine.isActive(globalState, variant)] as const), this.current.globals) : empty.globals;
    const frameTpls = new Set(variants.frames.map((frame) => frame.tpl.uid));
    const slots = variants.showDefaultSlots && context ? context.owners.filter((owner, index) => index === 0 || frameTpls.has(owner.tplUid)).map((owner) => owner.key).sort() : [];
    const defaultSlots = arrayEq(this.current.defaultSlots, slots) ? this.current.defaultSlots : Object.freeze(slots);
    const capturedFrames = arrayEq(this.current.frames, frames) ? this.current.frames : Object.freeze(frames);
    const beforeRoot = this.current.root;
    const rootRef = runtimeRoot ? this.models.ref(runtimeRoot.tpl) : undefined;
    const renderedRoot = runtimeRoot && rootRef
      ? beforeRoot?.tpl === rootRef && beforeRoot.key === runtimeRoot.key && beforeRoot.fullKey === runtimeRoot.fullKey
        ? beforeRoot : Object.freeze({ tpl: rootRef, key: runtimeRoot.key, fullKey: runtimeRoot.fullKey })
      : undefined;
    if (capturedFrames !== this.current.frames || globals !== this.current.globals || defaultSlots !== this.current.defaultSlots || renderedRoot !== beforeRoot) {
      this.current = Object.freeze({ root: renderedRoot, frames: capturedFrames, globals, defaultSlots });
    }
    for (const [field, stop] of this.fields) { if (!fields.has(field)) { stop(); this.fields.delete(field); } }
    fields.forEach((field) => { if (!this.fields.has(field)) { this.fields.set(field, this.models.subscribePreparedField(field, () => { this.dirty = true; })); } });
    for (const [key, input] of this.runtime) { if (!runtime.has(key)) { input.stop(); this.runtime.delete(key); } }
  }

  publishCommit() {
    if (!this.disposed) {
      const previous = this.state.getState();
      if (previous !== this.current) {
        const notify = [...this.publicationListeners].map((prepare) => prepare(this.current, previous));
        this.state.setState(() => this.current, true);
        notify.forEach((publish) => publish());
      }
      this.view.frameState.variantInputs.publishCommit();
    }
  }
  dispose() {
    this.disposed = true;
    this.stops.forEach((stop) => stop()); this.subscriptions.forEach((stop) => stop()); this.subscriptions.clear();
    this.fields.forEach((stop) => stop()); this.fields.clear(); this.runtime.forEach((input) => input.stop()); this.runtime.clear();
    this.ownerStores.clear(); this.slotStores.clear(); this.current = empty; this.state.setState(empty, true);
    this.publicationListeners.clear();
  }
}
