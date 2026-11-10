import type { CanvasObserverInput } from "@/wab/client/components/canvas/canvas-observer";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq, ensure } from "@/wab/shared/common";
import { parentStackStyleProvider } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import { flattenTpls, isTplVariantable } from "@/wab/shared/core/tpls";
import { flattenVals, isValComponent } from "@/wab/shared/core/val-nodes";
import { isKnownTplComponent } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
interface OutlineObserverInput extends CanvasObserverInput {
  getState(): readonly unknown[];
  getTreeState(): readonly unknown[];
}
const inactive: OutlineObserverInput = { getState: () => empty, getTreeState: () => empty, subscribe: () => () => undefined };

/** The outline reads the actual artboard model capsules, registrations and
 * committed Val environments/props. No model read tracking or global revision. */
export class OutlineModelInputs implements OutlineObserverInput {
  private readonly models;
  private current: readonly unknown[] = empty;
  private treeCurrent: readonly unknown[] = empty;
  private inputs: Set<CanvasObserverInput> | undefined;
  private rebindInputs = new Set<CanvasObserverInput>();
  private inputValues = new Map<CanvasObserverInput, unknown>();
  private context: readonly unknown[] = empty;
  private readonly listeners = new Set<() => void>();
  private readonly stops = new Map<CanvasObserverInput, () => void>();
  private connected = false;
  private retired = false;
  private captureVersion = 0;
  constructor(private readonly view: ViewCtx) { this.models = view.studioCtx.modelSnapshots; }
  private closed = () => {
    if (this.retired || this.view.disposeSignal.aborted || this.view.isDisposed || this.models !== this.view.studioCtx.modelSnapshots || this.view.canvasRenderOwner.isDisposed) { this.retired = true; return true; }
    return false;
  };
  private sources() {
    const { view } = this;
    const sources = new Set<CanvasObserverInput>([view.frameState.valRootStore, view.studioCtx.selectionStore, view.selectionStore, view.variantStore, view.canvasRenderOwner.dataTokenInputs(view).store]);
    // Render capsules can replace children/slot arguments, and committed Val
    // contents can introduce new runtime inputs. Lock and focus notifications
    // reuse the existing input set.
    this.rebindInputs = new Set([view.frameState.valRootStore]);
    const components = new Set([view.component, ...view.componentStackFrames().map((frame) => frame.tplComponent.component)]);
    for (const component of components) {
      const componentInput = view.canvasRenderOwner.observerInput(view, component);
      sources.add(componentInput); this.rebindInputs.add(componentInput);
      for (const node of flattenTpls(component.tplTree)) {
        const nodeInput = view.canvasRenderOwner.observerInput(view, node);
        sources.add(nodeInput); this.rebindInputs.add(nodeInput);
        sources.add(this.models.declaredField(node, "locked"));
        if (isTplVariantable(node)) {
          const native = parentStackStyleProvider(view, node).getNativeStyleSource();
          if (native.kind === "tpl") { sources.add(native.inputs.get(native.source, ["display", "flex-direction"]).projection.store); }
        }
        if (isKnownTplComponent(node)) { sources.add(view.canvasCtx.registrations.component(node.component.name)); }
      }
    }
    const root = view.frameState.valRootStore.getState();
    if (root) {
      flattenVals(root).forEach((value) => {
        sources.add(value.runtimeInputs);
        if (isValComponent(value)) { sources.add(value.componentRuntimeInputs); this.rebindInputs.add(value.componentRuntimeInputs); }
      });
    }
    return sources;
  }
  private capture = () => {
    const version = ++this.captureVersion;
    if (this.closed()) { this.disconnect(); this.current = this.treeCurrent = empty; return this.current; }
    const { view } = this;
    const context = [view.selectionStore.getState().context, view.variantStore.getState().frames];
    const rebind = !this.inputs || !arrayEq(this.context, context) ||
      [...this.rebindInputs].some((source) => !Object.is(this.inputValues.get(source), source.getState()));
    const sources = rebind ? this.sources() : ensure(this.inputs, "Outline inputs must be collected before reuse");
    this.inputs = sources;
    this.context = context;
    const values: unknown[] = [];
    // Repeated instances resolve conditions/hidden slots against the selected
    // clone's environment. Ordinary focus/hover changes keep the tree cached.
    const treeValues: unknown[] = [context[0], view.selectionStore.getState().cloneKeys[0]];
    this.inputValues = new Map();
    for (const source of sources) {
      const value = source.getState();
      values.push(value);
      this.inputValues.set(source, value);
      if (source !== view.selectionStore && source !== view.studioCtx.selectionStore) { treeValues.push(value); }
    }
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (!arrayEq(this.treeCurrent, treeValues)) { this.treeCurrent = Object.freeze(treeValues); }
    if (this.connected) {
      for (const source of sources) {
        if (!this.stops.has(source)) {
          // Native sources can publish catch-up synchronously while connecting.
          // Reserve this lease before that callback re-enters capture().
          const pending = () => undefined;
          this.stops.set(source, pending);
          const stop = source.subscribe(() => this.changed(source));
          if (this.connected && this.stops.get(source) === pending && !this.closed()) { this.stops.set(source, stop); }
          else { if (this.stops.get(source) === pending) { this.stops.delete(source); } stop(); }
        }
        // A nested capture owns the latest source set; never reconcile against
        // the outer, superseded topology after its subscription has returned.
        if (this.closed()) { this.disconnect(); this.current = this.treeCurrent = empty; return this.current; }
        if (version !== this.captureVersion) { return this.current; }
      }
      for (const [source, stop] of this.stops) {
        if (!sources.has(source)) { this.stops.delete(source); stop(); }
        if (version !== this.captureVersion) { return this.current; }
      }
    }
    return this.current;
  };
  getState = () => {
    if (this.closed() || !this.connected || this.current === empty) { return this.capture(); }
    return this.current;
  };
  getTreeState = () => { this.getState(); return this.treeCurrent; };
  private disconnect = () => {
    this.captureVersion++;
    this.connected = false;
    this.view.disposeSignal.removeEventListener("abort", this.changed);
    this.view.canvasRenderOwner.lifetime.removeEventListener("abort", this.changed);
    this.stops.forEach((stop) => stop()); this.stops.clear();
  };
  private changed = (source?: CanvasObserverInput | Event) => {
    // Native transactions install their final snapshots before publication.
    // The first callback captures all of them; subsequent field notifications
    // must not rescan/rebind the same artboard once per changed field.
    if (!this.closed() && source && "getState" in source &&
      (!this.inputValues.has(source) || Object.is(this.inputValues.get(source), source.getState()))) { return; }
    const previous = this.current;
    this.capture();
    if (previous !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  subscribe = (listener: () => void) => {
    if (this.closed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.view.disposeSignal.addEventListener("abort", this.changed, { once: true }); this.view.canvasRenderOwner.lifetime.addEventListener("abort", this.changed, { once: true }); this.capture(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
const owners = new WeakMap<ViewCtx, OutlineModelInputs>();
export function getOutlineModelInput(view: ViewCtx | undefined): OutlineObserverInput {
  if (!view) { return inactive; }
  let source = owners.get(view);
  if (!source) { source = new OutlineModelInputs(view); owners.set(view, source); }
  return source;
}
/** Convert the finite model/runtime input set to values consumed by one row. */
class OutlineModelProjection<Value> {
  private previous: readonly unknown[] | undefined;
  private value: Value | undefined;
  constructor(private readonly source: OutlineObserverInput, private readonly select: () => Value) {}
  read = () => {
    const input = this.source.getState();
    if (input !== this.previous) { this.previous = input; this.value = input.length ? this.select() : undefined; }
    return this.value;
  };
}
export function useOutlineModelValue<Value>(view: ViewCtx, select: () => Value) {
  const source = getOutlineModelInput(view);
  const projected = React.useMemo(() => new OutlineModelProjection(source, select), [source, select]);
  return React.useSyncExternalStore(source.subscribe, projected.read, projected.read);
}
