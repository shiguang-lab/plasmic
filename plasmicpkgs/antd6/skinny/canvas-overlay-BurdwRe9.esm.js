import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import { useEffect } from "react";

const previewOpenProp = {
  type: "boolean",
  displayName: "Preview open",
  editOnly: true,
  description:
    "Open or close the overlay only while editing. Unset to follow selection. Does not change the published open state.",
};
function useCanvasOverlay(props, triggerSlotName) {
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
  const autoOpened = autoOpen && previewOpen === void 0 && !open;
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

export { previewOpenProp as p, useCanvasOverlay as u };
//# sourceMappingURL=canvas-overlay-BurdwRe9.esm.js.map
