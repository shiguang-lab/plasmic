import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { useShallow } from "zustand/react/shallow";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translateUiLabel } from "@/wab/client/i18n/locales";

import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { FRAME_CAP } from "@/wab/shared/Labels";
import React, { ReactNode } from "react";

export interface EmptyTabPlaceholderProps {
  children: ReactNode;
}

export function EmptyTabPlaceholder({ children }: EmptyTabPlaceholderProps) {
  const { t: studioUiT } = useI18n();

  const sc = useStudioCtx();
  const [kind, empty] = useStudioArena(sc, useShallow((state) => [state.kind, state.frames.length === 0] as const));
  const shouldShowTabs = kind === "component" || kind === "page";

  return shouldShowTabs ? (
    <>{children}</>
  ) : (
    <div className={"EmptyTabPlaceholder"}>
      <div className={"panel-content"}>
        {!empty &&
          studioUiT("Select an {part1} first", {
            part1: translateUiLabel(getUiLocale(), FRAME_CAP),
          })}
      </div>
    </div>
  );
}
