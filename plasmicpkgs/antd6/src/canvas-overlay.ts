import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import React, { ReactElement, useEffect } from "react";

/** Child selection uses the same SDK contract as editing-only overlays. */
export function getSelectedCanvasItemKey(items: ReactElement[]) {
  const index = items.findIndex((item) => item.props.__plasmic_selection_prop__?.isSelected);
  return index < 0 ? undefined : items[index].key ?? String(index);
}

/** Evaluate SDK render-prop slot wrappers before a native container inspects children. */
export function renderCanvasSlot(children: React.ReactNode, render: (children: React.ReactNode) => React.ReactElement): React.ReactElement {
  if (React.isValidElement<{ children: (...args: unknown[]) => React.ReactNode }>(children) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React.cloneElement(children, { children: (...args: unknown[]) => renderCanvasSlot(renderChildren(...args), render) });
  }
  return render(children);
}

export function getCanvasItems(children: React.ReactNode, isItem: (item: ReactElement) => boolean): ReactElement[] {
  const items: ReactElement[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (isItem(child)) items.push(child);
    else items.push(...getCanvasItems(child.props.children, isItem));
  });
  return items;
}

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
    "Show or hide the overlay on the editing canvas. When unset, follows selection without changing the runtime open state.",
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
