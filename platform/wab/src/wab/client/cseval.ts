import { mkUseCanvasObserver } from "@/wab/client/components/canvas/canvas-observer";
import {
  renderFrameRoot,
} from "@/wab/client/components/canvas/canvas-rendering";
import { FrameState } from "@/wab/client/react-global-hook/types";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { CanvasGlobalContexts } from "@/wab/client/components/canvas/canvas-global-contexts";
import {
  ensureInstance,
  spawn,
} from "@/wab/shared/common";
import {
  isContextCodeComponent,
} from "@/wab/shared/core/components";
import { ValComponent, ValNode } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import { createStore } from "zustand/vanilla";
import { ok } from "neverthrow";
import React from "react";

export abstract class BaseCliSvrEvaluator {
  _viewCtx: ViewCtx;
  private _postEvalTasks: (() => any)[] = [];
  private readonly globalContexts: CanvasGlobalContexts;
  private readonly deferredTasks = new Set<ReturnType<typeof setTimeout>>();

  private deferPostCommit(task: () => void) {
    const handle = setTimeout(() => {
      this.deferredTasks.delete(handle);
      task();
    });
    this.deferredTasks.add(handle);
  }

  readonly renderStatusStore = createStore(() => ({ renderCount: 0, isFirstRenderComplete: false }));
  readonly valRootStore: FrameState["valRootStore"];

  private incrementRenderCount() {
    this.renderStatusStore.setState((current) => ({
      renderCount: current.renderCount + 1, isFirstRenderComplete: true,
    }));
  }
  get renderCount() {
    return this.renderStatusStore.getState().renderCount;
  }

  get isFirstRenderComplete() {
    return this.renderStatusStore.getState().isFirstRenderComplete;
  }

  constructor({
    viewCtx,
    frameState,
  }: {
    viewCtx: ViewCtx;
    frameState: FrameState;
  }) {
    this._viewCtx = viewCtx;

    this.globalContexts = viewCtx.canvasRenderOwner.globalContextInputs(viewCtx);

    this.valRootStore = frameState.valRootStore;
    const onValRootChanged = () => {
      // New Val Tree - we might need to rerender the aartboard to get
      // the updated component stack
      this.deferPostCommit(() => {
        if (!viewCtx.isDisposed) {
          viewCtx.flushRerenderQueue();
        }
      });
      this.deferPostCommit(() => {
        if (!viewCtx.isDisposed && !viewCtx.focusedSelectable()) {
          spawn(
            viewCtx.studioCtx.change(
              () => {
                const focusedTpl = viewCtx.focusedTpl();
                if (focusedTpl) {
                  viewCtx.setStudioFocusByTpl(focusedTpl);
                }
                return ok();
              },
              { noUndoRecord: true },
            ),
          );
        }
      });
    };
    this.valRootDispose = this.valRootStore.subscribe(onValRootChanged);
    onValRootChanged();
  }

  private valRootDispose: () => void;

  get valRoot() {
    return this.valRootStore.getState();
  }

  valState() {
    let sysRoot: ValNode | null | undefined = this.valRoot;
    while (
      sysRoot instanceof ValComponent &&
      isContextCodeComponent(sysRoot.tpl.component)
    ) {
      sysRoot =
        sysRoot.contents && sysRoot.contents.length > 0
          ? ensureInstance(sysRoot.contents[0], ValComponent)
          : undefined;
    }
    return new ValState({
      sysRoot: (sysRoot && ensureInstance(sysRoot, ValComponent)) ?? undefined,
      globalRoot: this.valRoot ?? undefined,
    });
  }

  dispose() {
    this.valRootDispose();
    this.deferredTasks.forEach(clearTimeout);
    this.deferredTasks.clear();
    (this._viewCtx as any) = null;
  }

  private viewCtx() {
    return this._viewCtx;
  }

  rootNode: React.ReactNode | undefined = undefined;

  private cliEval() {
    const viewCtx = this.viewCtx();
    if (this.rootNode == null) {
      this.rootNode = this.renderRoot();
      viewCtx.canvasCtx.Sub.ReactDOM.flushSync(() =>
        viewCtx.canvasCtx.rerender(this.rootNode, viewCtx),
      );
    }
    this.addPostEval(() => {
      this.incrementRenderCount();
    });
  }

  getGlobalContextTpl(contextName: string) {
    // Global contexts wrap the system root. Use their rendered tpl clones,
    // since the settings nodes in site.globalContexts aren't in renderState.
    let root: ValNode | null | undefined = this.valRoot;
    while (
      root instanceof ValComponent &&
      isContextCodeComponent(root.tpl.component)
    ) {
      if (root.tpl.component.name === contextName) {
        return root.tpl;
      }
      root = root.contents?.[0];
    }
    return undefined;
  }

  private renderRoot() {
    const vc = this.viewCtx();
    const sub = vc.canvasCtx.Sub;
    // Keep one root and subscribe to its explicit component inputs rather
    // than creating several root nodes to avoid unmounting the
    // canvas (currently `Sub.hostUtils.setPlasmicRootNode` forces the tree to remount)
    return sub.React.createElement(sub.CanvasStoreProjection<ReturnType<typeof this.globalContexts.store.getState>>, {
      store: this.globalContexts.store,
      render: (contexts) => mkUseCanvasObserver(sub, vc, vc.canvasRenderOwner.observerInput(vc, vc.component))(
        (onRenderInvalidated) => {
          const tpl = vc.componentArgsContainer();
          const tplRootWithContexts = vc.studioCtx.modelSnapshots.resolve(contexts.root);

          let reactRoot = renderFrameRoot(vc, tplRootWithContexts, onRenderInvalidated);

          if (tpl.component.pageMeta) {
            const pageParamsProviderProps = tpl.component.pageMeta
              ? {
                  route: tpl.component.pageMeta.path,
                  params: { ...tpl.component.pageMeta.params },
                  query: { ...tpl.component.pageMeta.query },
                }
              : {};
            if (pageParamsProviderProps && !!sub.PageParamsProvider) {
              reactRoot = sub.React.createElement(
                sub.PageParamsProvider,
                pageParamsProviderProps,
                reactRoot,
              );
            }
          }
          return reactRoot;
        },
        `renderRoot`,
      ),
    });
  }

  addPostEval(f: /*TWZ*/ () => any) {
    return this._postEvalTasks.push(f);
  }

  runPostEvalTasks() {
    const origPostEvalTasks = this._postEvalTasks || [];
    this._postEvalTasks = [];
    for (const task of origPostEvalTasks) {
      task();
    }
  }

  async evalAsync() {
    return this.cliEval();
  }

  protected abstract serverEval();
}

// This evaluator evaluates a tree of TplNode into a tree of CanvasElements. Internally,
// it uses viewCtx().evaluator() to evalutes the TplNode tree into a ValNode tree in between.
export class DevCliSvrEvaluator extends BaseCliSvrEvaluator {
  serverEval() {
    throw new Error();
  }
}

