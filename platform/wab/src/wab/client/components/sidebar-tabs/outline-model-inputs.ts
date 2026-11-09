import type { CanvasObserverInput } from "@/wab/client/components/canvas/canvas-observer";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq } from "@/wab/shared/common";
import { parentStackStyleProvider } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import { flattenTpls, isTplVariantable } from "@/wab/shared/core/tpls";
import { flattenVals, isValComponent } from "@/wab/shared/core/val-nodes";
import { isKnownTplComponent } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
interface OutlineObserverInput extends CanvasObserverInput { getState(): readonly unknown[]; }
const inactive: OutlineObserverInput = { getState: () => empty, subscribe: () => () => undefined };

/** The outline reads the actual artboard model capsules, registrations and
 * committed Val environments/props. No model read tracking or global revision. */
export class OutlineModelInputs implements OutlineObserverInput {
  private readonly models;
  private current: readonly unknown[] = empty;
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
    const components = new Set([view.component, ...view.componentStackFrames().map((frame) => frame.tplComponent.component)]);
    for (const component of components) {
      sources.add(view.canvasRenderOwner.observerInput(view, component));
      for (const node of flattenTpls(component.tplTree)) {
        sources.add(view.canvasRenderOwner.observerInput(view, node));
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
        if (isValComponent(value)) { sources.add(value.componentRuntimeInputs); }
      });
    }
    return sources;
  }
  private capture = () => {
    const version = ++this.captureVersion;
    if (this.closed()) { this.disconnect(); this.current = empty; return this.current; }
    const sources = this.sources();
    const values = [...sources].map((source) => source.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const source of sources) {
        if (!this.stops.has(source)) {
          // Native sources can publish catch-up synchronously while connecting.
          // Reserve this lease before that callback re-enters capture().
          const pending = () => undefined;
          this.stops.set(source, pending);
          const stop = source.subscribe(this.changed);
          if (this.connected && this.stops.get(source) === pending && !this.closed()) { this.stops.set(source, stop); }
          else { if (this.stops.get(source) === pending) { this.stops.delete(source); } stop(); }
        }
        // A nested capture owns the latest source set; never reconcile against
        // the outer, superseded topology after its subscription has returned.
        if (this.closed()) { this.disconnect(); this.current = empty; return this.current; }
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
  private disconnect = () => {
    this.captureVersion++;
    this.connected = false;
    this.view.disposeSignal.removeEventListener("abort", this.changed);
    this.view.canvasRenderOwner.lifetime.removeEventListener("abort", this.changed);
    this.stops.forEach((stop) => stop()); this.stops.clear();
  };
  private changed = () => { const previous = this.current; this.capture(); if (previous !== this.current) { this.listeners.forEach((listener) => listener()); } };
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
