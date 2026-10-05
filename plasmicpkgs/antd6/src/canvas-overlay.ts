import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { useEffect } from "react";

export interface CanvasOverlayProps {
  previewOpen?: boolean;
  plasmicNotifyAutoOpenedContent?: () => void;
  __plasmic_selection_prop__?: unknown;
}

export const previewOpenProp = {
  type: "boolean" as const,
  displayName: "Preview open",
  editOnly: true,
  description:
    "Open or close the overlay only while editing. Unset to follow selection. Does not change the published open state.",
};

/** Selection controls only the design canvas; preview keeps the native open state. */
export function useCanvasOverlay<
  P extends CanvasOverlayProps & { open?: boolean },
>(props: P, triggerSlotName?: string) {
  const canvas = usePlasmicCanvasContext();
  const selection = usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const {
    open,
    previewOpen,
    plasmicNotifyAutoOpenedContent,
    __plasmic_selection_prop__: _selection,
    ...rest
  } = props;
  const autoOpen =
    isEditing &&
    !!selection?.isSelected &&
    (!triggerSlotName || selection.selectedSlotName !== triggerSlotName);
  const autoOpened = autoOpen && previewOpen === undefined && !open;

  useEffect(() => {
    if (autoOpened) {
      plasmicNotifyAutoOpenedContent?.();
    }
  }, [autoOpened, plasmicNotifyAutoOpenedContent]);

  return {
    props: rest,
    isEditing,
    open: isEditing ? (previewOpen ?? (autoOpen || !!open)) : open,
  };
}
