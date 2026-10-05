"use strict";

var host = require("@plasmicapp/host");
var React = require("react");

const previewOpenProp = {
  type: "boolean",
  displayName: "Preview open",
  editOnly: true,
  description:
    "Open or close the overlay only while editing. Unset to follow selection. Does not change the published open state.",
};
function useCanvasOverlay(props, triggerSlotName) {
  const canvas = host.usePlasmicCanvasContext();
  const selection = host.usePlasmicCanvasComponentInfo(props);
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
  React.useEffect(() => {
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

exports.previewOpenProp = previewOpenProp;
exports.useCanvasOverlay = useCanvasOverlay;
//# sourceMappingURL=canvas-overlay-S34meFm4.cjs.js.map
