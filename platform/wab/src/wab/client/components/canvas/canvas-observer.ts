import { canvasFactory } from "@/wab/client/components/canvas/canvas-factories";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type React from "react";

export interface CanvasObserverInput {
  getState(): unknown;
  subscribe(listener: () => void): () => void;
}

/** The projection holds a real ReactNode and the inputs/resources that produced
 * it. It can be evaluated during an external-store consistency check, so its
 * renderer must only return component elements and never call Hooks. */
export class CanvasObservedRenderSource {
  private current?: { node: React.ReactNode; pass: ReturnType<ViewCtx["canvasRenderOwner"]["beginRender"]>; input: unknown };
  private dirty = true;
  private disposed = true;
  private stopInput?: () => void;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly view: ViewCtx, private readonly render: (onRenderInvalidated: () => void) => React.ReactNode, private readonly input?: CanvasObserverInput, private readonly onUpdate?: () => void) {
    this.resume();
  }
  get isDisposed() { return this.disposed; }
  private resume() {
    if (!this.disposed || this.view.isDisposed || this.view.disposeSignal.aborted || this.view.canvasRenderOwner.isDisposed) { return; }
    this.disposed = false; this.dirty = true;
    this.view.trackCanvasObserver(this);
    this.view.disposeSignal.addEventListener("abort", this.retire, { once: true });
    this.view.canvasRenderOwner.lifetime.addEventListener("abort", this.retire, { once: true });
  }
  private retire = () => {
    const listeners = [...this.listeners];
    this.dispose();
    listeners.forEach((listener) => listener());
  };
  private publish = () => { if (!this.disposed && this.dirty) { this.listeners.forEach((listener) => listener()); } };
  private invalidate = () => {
    if (this.disposed) { return; }
    this.dirty = true;
    if (this.onUpdate) { this.onUpdate(); }
    else { this.view.addRerenderObserver(this.publish); }
  };
  getState = () => {
    this.resume();
    if (this.disposed) { return null; }
    const input = this.input?.getState();
    if (!this.current || this.dirty || this.current.input !== input) {
      const owner = this.view.canvasRenderOwner;
      const pass = owner.beginRender(this.invalidate);
      try {
        this.current = { pass, input, node: this.render(this.invalidate) };
        this.dirty = false;
      } finally { owner.endRender(pass); }
    }
    return this.current.node;
  };
  getInitialState = this.getState;
  subscribe = (listener: () => void) => {
    this.resume();
    if (this.disposed) { return () => undefined; }
    this.listeners.add(listener);
    this.stopInput ??= this.input?.subscribe(this.invalidate);
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.stopInput?.(); this.stopInput = undefined; }
    };
  };
  commit() {
    this.getState();
    if (!this.disposed && this.current) {
      this.view.commitCanvasObserver(this);
      this.view.canvasRenderOwner.commitRender(this.current.pass);
    }
  }
  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.stopInput?.(); this.stopInput = undefined;
    this.listeners.clear();
    this.view.disposeSignal.removeEventListener("abort", this.retire);
    this.view.canvasRenderOwner.lifetime.removeEventListener("abort", this.retire);
    this.view.canvasRenderOwner.releaseRenderListener(this.invalidate);
    this.view.disposeCanvasObserver(this);
  }
}

export const mkUseCanvasObserver = canvasFactory((sub: SubDeps, view: ViewCtx, input?: CanvasObserverInput) =>
  function renderWithCanvasInputs(render: (onRenderInvalidated: () => void) => React.ReactNode, _name = "canvas", onUpdate?: () => void) {
    return sub.React.createElement(sub.CanvasObserver, { source: new CanvasObservedRenderSource(view, render, input, onUpdate) });
  },
);
