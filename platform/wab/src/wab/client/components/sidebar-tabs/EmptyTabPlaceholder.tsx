import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translateUiLabel } from "@/wab/client/i18n/locales";

import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isComponentArena, isPageArena } from "@/wab/shared/Arenas";
import { FRAME_CAP } from "@/wab/shared/Labels";
import React, { ReactNode } from "react";

export interface EmptyTabPlaceholderProps {
  children: ReactNode;
}

export function EmptyTabPlaceholder({ children }: EmptyTabPlaceholderProps) {
  const { t: studioUiT } = useI18n();

  const sc = useStudioCtx();
  const shouldShowTabs =
    isComponentArena(sc.currentArena) || isPageArena(sc.currentArena);

  return shouldShowTabs ? (
    <>{children}</>
  ) : (
    <div className={"EmptyTabPlaceholder"}>
      <div className={"panel-content"}>
        {!sc.currentArenaEmpty &&
          studioUiT("Select an {part1} first", {
            part1: translateUiLabel(getUiLocale(), FRAME_CAP),
          })}
      </div>
    </div>
  );
}
