import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { CanvasConfigButton } from "@/wab/client/components/canvas/CanvasFrame/CanvasConfigButton";
import { VariantsBar } from "@/wab/client/components/canvas/VariantsBar";
import S from "@/wab/client/components/studio/FocusedModeToolbar/FocusedModeToolbar.module.scss";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useI18n } from "@/wab/client/i18n";
import RefreshsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__RefreshSvg";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ok } from "neverthrow";
import React from "react";

export const FocusedModeToolbar = ({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) => {
  const focusedMode = useStudioArena(studioCtx, (state) => state.focusedMode);
  useStudioSelection(studioCtx, (state) => state.view);
  const { t: uiT } = useI18n();
  const onClick = async () => {
    await studioCtx.change(() => {
      studioCtx.refreshFocusedFrameArena();
      return ok();
    });
  };

  // The frame is only an opaque prop for CanvasConfigButton; that child keeps
  // its own frame/selection subscriptions.
  const currentArenaViewCtx = studioCtx.focusedViewCtx();
  const currentFrame = currentArenaViewCtx?.arenaFrame();

  return !focusedMode ? null : (
    <div className={S.root}>
      <div className={S.variantsBarContainer}>
        <VariantsBar contained />
      </div>
      <div className={"flex flex-vcenter"}>
        <IconButton
          tooltip={uiT("Refresh arena")}
          id={"refresh-canvas-btn"}
          onClick={onClick}
        >
          <Icon icon={RefreshsvgIcon} />
        </IconButton>
        {currentFrame && (
          <CanvasConfigButton
            contained
            studioCtx={studioCtx}
            frame={currentFrame}
          />
        )}
      </div>
    </div>
  );
};
