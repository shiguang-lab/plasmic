import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useFileDragState } from "@/wab/client/file-drag/useFileDragState";
import { UiText } from "@/wab/client/i18n/UiText";
import UploadSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__UploadSvg";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import cx from "classnames";
import * as React from "react";

interface CanvasDndOverlayProps {
  /** The canvas container this overlay covers and reports drags over. */
  container: React.RefObject<HTMLElement | null>;
}

function CanvasDndOverlay_({ container }: CanvasDndOverlayProps) {
  const studioCtx = useStudioCtx();
  const interactive = useStudioRenderPolicy(studioCtx, (policy) => policy.interactive);
  const dragState = useFileDragState(container.current);
  if (!dragState || interactive) {
    return null;
  }
  return (
    <div
      className={cx("drop-overlay", "canvas-dnd-overlay", {
        "drop-overlay--dragover": dragState === "draggingOver",
      })}
    >
      <Icon icon={UploadSvgIcon} size={40} />
      <span>
        <UiText message={"Drop image to upload"} />
      </span>
    </div>
  );
}

export const CanvasDndOverlay = CanvasDndOverlay_;
