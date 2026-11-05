import { usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from '@plasmicapp/host';
import React, { useRef, useEffect } from 'react';

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
    if (!React.isValidElement(child)) {
      return;
    }
    if (isItem(child)) {
      items.push(child);
    } else {
      items.push(...getCanvasItems(child.props.children, isItem));
    }
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
  const state = canvas ? selection?.getState?.("open", open, props.defaultOpen) : void 0;
  const editingOpen = previewOpen ?? (autoOpen || !!open);
  if (state && !selection?.states?.open) {
    const handler = rest.onOpenChange;
    rest.onOpenChange = (next, ...args) => {
      state.set(!isEditing && open !== void 0 ? open : next);
      if (!isEditing) {
        handler?.(next, ...args);
      }
    };
  }
  const resolvedOpen = state ? !!state.value : isEditing ? editingOpen : open;
  const previous = useRef({ isEditing, open: resolvedOpen });
  const silentTransition = useRef(false);
  const destroyEditingContent = useRef(false);
  if (!isEditing || resolvedOpen) {
    destroyEditingContent.current = false;
  } else if (previous.current.isEditing && previous.current.open) {
    destroyEditingContent.current = true;
  }
  if (previous.current.open !== resolvedOpen) {
    silentTransition.current = previous.current.isEditing !== isEditing;
  }
  previous.current = { isEditing, open: resolvedOpen };
  const lifecycleProps = rest;
  const { onOpenChange, afterOpenChange, afterClose } = lifecycleProps;
  lifecycleProps.onOpenChange = (next, ...args) => {
    if (isEditing && (next || !state)) {
      return;
    }
    if (!isEditing) {
      silentTransition.current = false;
    }
    return onOpenChange?.(next, ...args);
  };
  if (afterOpenChange) {
    lifecycleProps.afterOpenChange = (next) => {
      if (!isEditing && !silentTransition.current) {
        afterOpenChange(next);
      }
    };
  }
  if (afterClose) {
    lifecycleProps.afterClose = () => {
      if (!isEditing && !silentTransition.current) {
        afterClose();
      }
    };
  }
  useEffect(() => {
    if (autoOpened) {
      plasmicNotifyAutoOpenedContent?.();
    }
  }, [autoOpened, plasmicNotifyAutoOpenedContent]);
  return {
    props: rest,
    isEditing,
    destroyOnHidden: destroyEditingContent.current ? true : props.destroyOnHidden,
    // Studio already resolves the selection reveal. Its effective value must
    // not be fed back as a new reveal request after a real UI event closes it.
    open: resolvedOpen
  };
}

export { getSelectedCanvasItemKey as a, getCanvasItems as g, previewOpenProp as p, renderCanvasSlot as r, useCanvasOverlay as u };
//# sourceMappingURL=canvas-overlay-27tNRB55.esm.js.map
