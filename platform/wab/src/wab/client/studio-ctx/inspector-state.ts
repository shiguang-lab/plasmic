import { emptyViewSelection, type ViewSelectionSnapshot } from "@/wab/client/studio-ctx/view-selection";
import { useShallow } from "zustand/react/shallow";
import type { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ComponentEvalContext } from "@/wab/shared/core/val-nodes";
import type { Param, TplComponent, TplNode, TplTag } from "@/wab/shared/model/classes";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const emptyInspector = createStore<{ selection: InspectorSelection | undefined; pending: boolean }>(() => ({ selection: undefined, pending: false }));
const emptyEvaluation = createStore<ComponentEvalContext>(() => Object.freeze({ componentPropValues: Object.freeze({}), ccContextData: undefined, invalidArgs: Object.freeze([]) as unknown as ComponentEvalContext["invalidArgs"] }));
const emptyEnvironment = createStore<ReturnType<ViewCtx["getCanvasEnvForTpl"]>>(() => undefined);
const emptyFocus = createStore<ViewSelectionSnapshot>(() => emptyViewSelection);
const emptyDom = createStore<ReturnType<ViewCtx["selectionDom"]> | null>(() => null);

export function useInspectorSelection(studio: StudioCtx | undefined) {
  return useStore(studio?.inspectorStore ?? emptyInspector, (state) => state.selection);
}

export function useInspectorPending(studio: StudioCtx) {
  return useStore(studio.inspectorStore, (state) => state.pending);
}

function useInspectorReadOwner(view: ViewCtx | undefined) {
  const selection = useInspectorSelection(view?.studioCtx);
  useStore(view && selection?.viewCtx !== view ? view.selectionStore ?? emptyFocus : emptyFocus, useShallow((state) => [state.tpls, state.targets, state.cloneKeys, state.context, state.disabledAutoOpenUuid]));
  return view && !view.isDisposed ? view.getInspectorReadOwner() : undefined;
}

export function useInspectorComponentEvalContext(view: ViewCtx | undefined, tpl: TplTag | TplComponent | undefined, param?: Param) {
  const owner = useInspectorReadOwner(tpl ? view : undefined);
  return useStore(owner && tpl ? owner.componentEvalStore(tpl, param) : emptyEvaluation);
}

export function useInspectorCanvasEnv(view: ViewCtx | undefined, tpl: TplNode | undefined, options?: { forDataRepCollection?: boolean }) {
  const owner = useInspectorReadOwner(tpl ? view : undefined);
  return useStore(owner && tpl ? owner.canvasEnvStore(tpl, options) : emptyEnvironment);
}

export function useInspectorDom(view: ViewCtx | undefined) {
  const selection = useInspectorSelection(view?.studioCtx);
  return useStore(selection && selection.viewCtx === view ? selection.domStore() : emptyDom);
}
