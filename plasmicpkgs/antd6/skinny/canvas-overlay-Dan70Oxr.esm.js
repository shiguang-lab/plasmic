import { usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from '@plasmicapp/host';
import React, { useEffect } from 'react';

function getSelectedCanvasItemKey(items) {
  const index = items.findIndex((item) => item.props.__plasmic_selection_prop__?.isSelected);
  return index < 0 ? void 0 : items[index].key ?? String(index);
}
function renderCanvasSlot(children, render) {
  if (React.isValidElement(children) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React.cloneElement(children, { children: (...args) => renderCanvasSlot(renderChildren(...args), render) });
  }
  return render(children);
}
function getCanvasItems(children, isItem) {
  const items = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (isItem(child)) items.push(child);
    else items.push(...getCanvasItems(child.props.children, isItem));
  });
  return items;
}
const previewOpenProp = {
  type: "boolean",
  displayName: "Preview open",
  editOnly: true,
  description: "Show or hide the overlay on the editing canvas. When unset, follows selection without changing the runtime open state."
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

export { getSelectedCanvasItemKey as a, getCanvasItems as g, previewOpenProp as p, renderCanvasSlot as r, useCanvasOverlay as u };
//# sourceMappingURL=canvas-overlay-Dan70Oxr.esm.js.map
