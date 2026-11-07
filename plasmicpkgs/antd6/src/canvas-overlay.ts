import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
} from "@plasmicapp/host";
import React, { ReactElement, useEffect, useRef } from "react";

/** Child selection uses the same SDK contract as editing-only overlays. */
export function getSelectedCanvasItemKey(items: ReactElement[]) {
  const index = items.findIndex((item) => React.isValidElement<{ __plasmic_selection_prop__?: { isSelected?: boolean } }>(item) && item.props.__plasmic_selection_prop__?.isSelected);
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
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) {return;}
    if (isItem(child)) {items.push(child);}
    else {items.push(...getCanvasItems(child.props.children, isItem));}
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
  P extends CanvasOverlayProps & { open?: boolean; defaultOpen?: boolean; destroyOnHidden?: boolean },
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
  const state = canvas ? selection?.getState?.("open", open, props.defaultOpen) : undefined;
  const editingOpen = previewOpen ?? (autoOpen || !!open);
  if (state && !selection?.states?.open) {
    const handler = (rest as { onOpenChange?: (...args: any[]) => void }).onOpenChange;
    (rest as { onOpenChange?: (...args: any[]) => void }).onOpenChange = (next: boolean, ...args: any[]) => {
      state.set(!isEditing && open !== undefined ? open : next);
      if (!isEditing) {handler?.(next, ...args);}
    };
  }

  const resolvedOpen = state ? !!state.value : isEditing ? editingOpen : open;
  const previous = useRef({ isEditing, open: resolvedOpen });
  const silentTransition = useRef(false);
  const destroyEditingContent = useRef(false);
  // Dismissing content in the editor removes nested body portals. A mode switch
  // only hides the editing reveal and must preserve the mounted runtime content.
  if (!isEditing || resolvedOpen) {
    destroyEditingContent.current = false;
  } else if (previous.current.isEditing && previous.current.open) {
    destroyEditingContent.current = true;
  }
  if (previous.current.open !== resolvedOpen) {
    silentTransition.current = previous.current.isEditing !== isEditing;
  }
  previous.current = { isEditing, open: resolvedOpen };
  const lifecycleProps = rest as {
    onOpenChange?: (...args: any[]) => void;
    afterOpenChange?: (open: boolean) => void;
    afterClose?: () => void;
  };
  const { onOpenChange, afterOpenChange, afterClose } = lifecycleProps;
  // Native events resume lifecycle callbacks after a silent mode transition.
  lifecycleProps.onOpenChange = (next: boolean, ...args) => {
    if (isEditing && (next || !state)) {return;}
    if (!isEditing) {silentTransition.current = false;}
    return onOpenChange?.(next, ...args);
  };
  if (afterOpenChange) {
    lifecycleProps.afterOpenChange = (next) => {
      if (!isEditing && !silentTransition.current) {afterOpenChange(next);}
    };
  }
  if (afterClose) {
    lifecycleProps.afterClose = () => {
      if (!isEditing && !silentTransition.current) {afterClose();}
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
    open: resolvedOpen,
  };
}
