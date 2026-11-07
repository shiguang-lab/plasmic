import {
  usePlasmicCanvasComponentInfo,
  usePlasmicCanvasContext,
  PlasmicCanvasProps,
} from "@plasmicapp/host";
import React, { ReactElement, useEffect, useRef } from "react";

/** Child selection uses the same SDK contract as editing-only overlays. */
export function getSelectedCanvasItemKey(items: ReactElement[]) {
  const index = items.findIndex((item) => React.isValidElement<PlasmicCanvasProps>(item) && item.props.__canvas?.selected);
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

/** Selection controls only the design canvas; preview keeps the native open state. */
export function useCanvasOverlay<
  P extends PlasmicCanvasProps & { open?: boolean; defaultOpen?: boolean; destroyOnHidden?: boolean },
>(props: P, triggerSlotName?: string) {
  const canvas = usePlasmicCanvasContext();
  const selection = usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const {
    open,
    __canvas,
    ...rest
  } = props;
  const onReveal = __canvas?.onReveal;
  const autoOpen =
    isEditing &&
    !!selection?.selected &&
    (!triggerSlotName || selection.slot !== triggerSlotName);
  const state = canvas ? selection?.getState?.("open", open, props.defaultOpen) : undefined;
  const autoOpened = autoOpen && !state && !open;
  const editingOpen = autoOpen || !!open;
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
      onReveal?.();
    }
  }, [autoOpened, onReveal]);

  return {
    props: rest,
    isEditing,
    destroyOnHidden: destroyEditingContent.current ? true : props.destroyOnHidden,
    // Studio already resolves the selection reveal. Its effective value must
    // not be fed back as a new reveal request after a real UI event closes it.
    open: resolvedOpen,
  };
}
