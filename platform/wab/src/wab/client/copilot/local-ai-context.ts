import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isComponentArena, isPageArena } from "@/wab/shared/Arenas";
import type { LocalAiContext } from "@/wab/shared/copilot/local-edit";
import { summarizeTpl } from "@/wab/shared/core/tpls";
import { isKnownTplComponent, isKnownTplTag } from "@/wab/shared/model/classes";

export function getLocalAiContext(studioCtx: StudioCtx): LocalAiContext {
  const view = studioCtx.focusedViewCtx();
  const arena = studioCtx.currentArena;
  const selected = view?.focusedTpl();
  const component =
    isPageArena(arena) || isComponentArena(arena)
      ? arena.component
      : view?.currentComponent();
  return {
    scope: selected
      ? ((isKnownTplComponent(selected) || isKnownTplTag(selected)) &&
          selected.name) ||
        summarizeTpl(selected)
      : component?.name,
    binding: component
      ? {
          projectId: studioCtx.siteInfo.id,
          branchId: studioCtx.dbCtx().branchInfo?.id ?? null,
          sessionId: studioCtx.aiSessionId,
          changeCounter: studioCtx._changeCounter,
          componentUuid: component.uuid,
          frameUuid: view?.arenaFrame().uuid ?? null,
          elementUuids:
            view?.focusedTpls().flatMap((tpl) => (tpl ? [tpl.uuid] : [])) ?? [],
        }
      : undefined,
  };
}
