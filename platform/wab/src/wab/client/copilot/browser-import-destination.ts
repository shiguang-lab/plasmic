import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { AnyArena, isDedicatedArena, isMixedArena } from "@/wab/shared/Arenas";

export function browserImportCanvasName() {
  return translate(getUiLocale(), "Free canvas");
}

export function browserImportCanvas(
  studio: StudioCtx,
  source: AnyArena | null = studio.currentArena,
) {
  if (isMixedArena(source)) {
    return source;
  }
  if (isDedicatedArena(source)) {
    const associated = studio.site.arenas.filter((arena) =>
      arena.children.some(
        (frame) => frame.container.component === source.component,
      ),
    );
    const recent = [...studio.recentArenas]
      .reverse()
      .find((arena) => associated.some((candidate) => candidate === arena));
    if (isMixedArena(recent)) {
      return recent;
    }
    if (associated[0]) {
      return associated[0];
    }
  }
  return studio.site.arenas.find(
    (arena) => arena.name === browserImportCanvasName(),
  );
}
