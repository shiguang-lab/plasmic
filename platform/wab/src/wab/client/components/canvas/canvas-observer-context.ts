import type { CanvasObserverInput } from "@/wab/client/components/canvas/canvas-observer";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq, ensure } from "@/wab/shared/common";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import type { Component, TplNode } from "@/wab/shared/model/classes";

export interface CanvasObserverContextSnapshot {
  readonly current: Component;
  readonly stack: readonly string[];
  readonly frames: readonly TplNode[];
  readonly slotKey: string | undefined;
  readonly slotParam: number | undefined;
  readonly defaultSlotContext: string | undefined;
}

/** One runtime/selection subscription per view. Hover, DOM and ordinary Tpl
 * selection changes do not publish when no rendering-context input changed. */
export class CanvasObserverContext {
  private current: CanvasObserverContextSnapshot | undefined;
  private published: CanvasObserverContextSnapshot | undefined;
  private native: readonly unknown[] = [];
  private readonly runtime = new Map<CanvasObserverInput, { value: unknown; stop?: () => void }>();
  private stops: (() => void)[] = [];
  private readonly listeners = new Set<() => void>();
  private connected = false;
  private disposed = false;
  constructor(private readonly view: ViewCtx) {}

  read = (): CanvasObserverContextSnapshot => {
    const view = this.view, selection = view.selectionStore.getState();
    const current = view.currentComponent(), frames = view.componentStackFrames().map((frame) => frame.tplComponent);
    const defaults = view.showDefaultSlotContents();
    const native = [selection, view.variantStore.getState(), view.frameState.valRootStore.getState(), current, defaults, ...frames];
    if (this.current && arrayEq(this.native, native) && [...this.runtime].every(([source, binding]) => source.getState() === binding.value)) { return this.current; }
    this.native = native;
    const stackValues = view.valComponentStack();
    const values = [...stackValues];
    const root = view.frameState.valRootStore.getState();
    if (root) { values.push(root); }
    const used = new Set<CanvasObserverInput>();
    values.forEach((value) => { used.add(value.runtimeInputs); if (isValComponent(value)) { used.add(value.componentRuntimeInputs); } });
    for (const [source, binding] of this.runtime) { if (!used.has(source)) { binding.stop?.(); this.runtime.delete(source); } }
    for (const source of used) {
      let binding = this.runtime.get(source);
      if (!binding) { binding = { value: source.getState() }; this.runtime.set(source, binding); }
      binding.value = source.getState();
      if (this.connected && !binding.stop) { binding.stop = source.subscribe(this.refresh); }
    }
    // The root above participates in subscriptions, not in owner-stack semantics.
    const stack = stackValues.map((value) => value.key);
    const target = selection.targets[0];
    const slotKey = target?.kind === "slot" ? target.key : undefined;
    const slotParam = target?.kind === "slot" ? target.slotParam?.uid : undefined;
    const defaultSlotContext = defaults ? selection.context?.valKey : undefined;
    const before = this.current;
    if (!before || before.current !== current || !arrayEq(before.stack, stack) || !arrayEq(before.frames, frames) || before.slotKey !== slotKey || before.slotParam !== slotParam || before.defaultSlotContext !== defaultSlotContext) {
      this.current = Object.freeze({ current, stack: Object.freeze(stack), frames: Object.freeze(frames), slotKey, slotParam, defaultSlotContext });
    }
    return ensure(this.current, "Canvas observer context must be captured");
  };
  private refresh = () => {
    if (this.disposed) { return; }
    const next = this.read();
    // A consistency check can read prepared inputs before their native source
    // publishes. Reading must not consume the notification for other nodes.
    if (next !== this.published) { this.published = next; this.listeners.forEach((listener) => listener()); }
  };
  private disconnect() {
    this.connected = false;
    this.stops.splice(0).forEach((stop) => stop());
    this.runtime.forEach((binding) => { binding.stop?.(); binding.stop = undefined; });
    this.view.disposeSignal.removeEventListener("abort", this.dispose);
  }
  subscribe = (listener: () => void) => {
    if (this.disposed || this.view.disposeSignal.aborted) { return () => undefined; }
    this.read(); this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.published = this.current;
      this.stops.push(this.view.selectionStore.subscribe(this.refresh), this.view.variantStore.subscribe(this.refresh), this.view.frameState.valRootStore.subscribe(this.refresh));
      this.runtime.forEach((binding, source) => { binding.stop = source.subscribe(this.refresh); });
      this.view.disposeSignal.addEventListener("abort", this.dispose, { once: true });
    }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
  dispose = () => {
    if (this.disposed) { return; }
    this.disposed = true; this.disconnect(); this.runtime.clear();
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
}
