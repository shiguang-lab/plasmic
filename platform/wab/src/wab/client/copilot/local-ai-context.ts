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
