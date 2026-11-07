import { useStudioArena, subscribeStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { useFocusedViewSelection, subscribeFocusedViewSelection, subscribeStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStore } from "zustand";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  getArenaName,
  isDedicatedArena,
  isMixedArena,
} from "@/wab/shared/Arenas";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";

export function getLocalAiContext(studioCtx: StudioCtx): LocalAiContext {
  const view = studioCtx.focusedViewCtx();
  const arena = studioCtx.currentArena;
  const component = isDedicatedArena(arena)
    ? arena.component
    : view?.currentComponent();
  return {
    scope: arena ? getArenaName(arena) : undefined,
    binding: arena
      ? {
          projectId: studioCtx.siteInfo.id,
          branchId: studioCtx.dbCtx().branchInfo?.id ?? null,
          sessionId: studioCtx.aiSessionId,
          changeCounter: studioCtx._changeCounter,
          componentUuid: component?.uuid ?? null,
          ...(isMixedArena(arena) ? { canvasName: arena.name } : {}),
          frameUuid: view?.arenaFrame().uuid ?? null,
          elementUuids:
            view?.focusedTpls().flatMap((tpl) => (tpl ? [tpl.uuid] : [])) ?? [],
        }
      : undefined,
  };
}

/** Native inputs read by getLocalAiContext; model fields still belong to the
 * caller's observer. Each field has a distinct source and publication fence. */
export function useLocalAiContextInputs(studio: StudioCtx): void {
  useStudioSaveState(studio, (state) => state.changeCounter);
  useStudioArena(studio, (state) => state.current);
  useStudioArena(studio, (state) => state.name);
  useFocusedViewSelection(studio, (state) => state.tpls);
  useFocusedViewSelection(studio, (state) => state.context);
  useStore(studio.uiEnvironment.store, (state) => state.branchId);
}

/** Subscribe only to the native inputs consumed by the context getter and
 * its access gate. The caller owns any remaining model reaction. */
export function subscribeLocalAiContextInputs(studio: StudioCtx, listener: () => void): () => void {
  const stops = [
    subscribeStudioArena(studio, (state) => state.current, listener),
    subscribeStudioArena(studio, (state) => state.name, listener),
    subscribeStudioSelection(studio, (state) => state.view, listener),
    subscribeFocusedViewSelection(studio, (state) => state.tpls, listener),
    subscribeFocusedViewSelection(studio, (state) => state.context, listener),
    studio.saveState.store.subscribe((next, before) => {
      if (next.changeCounter !== before.changeCounter) { listener(); }
    }),
    studio.uiEnvironment.store.subscribe((next, before) => {
      if (next.canEditProject !== before.canEditProject || next.branchId !== before.branchId) { listener(); }
    }),
  ];
  return () => stops.forEach((stop) => stop());
}
