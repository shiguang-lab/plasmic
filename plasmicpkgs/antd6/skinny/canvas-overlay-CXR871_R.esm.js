import { usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from '@plasmicapp/host';
import { useEffect } from 'react';

function getSelectedCanvasItemKey(items) {
  return items.find((item) => item.props.__plasmic_selection_prop__?.isSelected)?.key;
}
const previewOpenProp = {
  type: "boolean",
  displayName: "\u7F16\u8F91\u65F6\u5C55\u5F00",
  editOnly: true,
  description: "\u4EC5\u5728\u7F16\u8F91\u753B\u5E03\u4E2D\u5C55\u5F00\u6216\u5173\u95ED\u6D6E\u5C42\u3002\u672A\u8BBE\u7F6E\u65F6\u8DDF\u968F\u9009\u62E9\uFF0C\u4E0D\u6539\u53D8\u8FD0\u884C\u65F6\u7684 open \u72B6\u6001\u3002"
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
  const autoOpen = isEditing && !!selection?.isSelected && (!triggerSlotName || selection.selectedSlotName !== triggerSlotName);
  const autoOpened = autoOpen && previewOpen === void 0 && !open;
  useEffect(() => {
    if (autoOpened) {
      plasmicNotifyAutoOpenedContent?.();
    }
  }, [autoOpened, plasmicNotifyAutoOpenedContent]);
  return {
    props: rest,
    isEditing,
    open: isEditing ? previewOpen ?? (autoOpen || !!open) : open
  };
}

export { getSelectedCanvasItemKey as g, previewOpenProp as p, useCanvasOverlay as u };
//# sourceMappingURL=canvas-overlay-CXR871_R.esm.js.map
